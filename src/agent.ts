/**
 * Base class for Zowie agents.
 *
 * Agents handle incoming requests from Zowie's Decision Engine, process them using
 * LLMs and external APIs, and return responses to continue conversations or
 * transfer to other workflow blocks.
 */

import type { Server } from "node:http";
import type { Express, Request, Response } from "express";
import express from "express";
import type winston from "winston";
import { AuthValidator } from "./auth.js";
import { Context } from "./context.js";
import type { AgentResponse, AuthConfig, LLMConfig } from "./domain.js";
import { HTTPClient } from "./http.js";
import { LLM } from "./llm/index.js";
import { getLogger } from "./logger.js";
import type { Event, ExternalAgentResponse, IncomingRequest } from "./protocol.js";
import { parseIncomingRequest } from "./protocol.js";
import { getTimeMs } from "./utils.js";

// Configuration constants
const DEFAULT_HTTP_TIMEOUT_MS = 10000;
const DEFAULT_REQUEST_SIZE_LIMIT = "10mb";
const DEFAULT_SERVER_PORT = 3000;

/**
 * Configuration options for creating an Agent instance
 */
export interface AgentOptions {
  /** LLM provider configuration (Google or OpenAI) */
  llmConfig: LLMConfig;

  /** Default timeout for HTTP requests in milliseconds (default: 10000) */
  httpTimeoutMs?: number | undefined;

  /** Authentication configuration for securing the agent endpoint */
  authConfig?: AuthConfig | undefined;

  /** Whether to include persona in LLM calls by default (default: true) */
  includePersonaByDefault?: boolean | undefined;

  /** Whether to include context in LLM calls by default (default: true) */
  includeContextByDefault?: boolean | undefined;

  /** Whether to include HTTP headers in event logs (default: true) */
  includeHttpHeadersByDefault?: boolean | undefined;

  /** Whether to include HTTP request bodies in event logs (default: true) */
  includeRequestBodiesInEventsByDefault?: boolean | undefined;

  /** Logging level (default: "info") */
  logLevel?: string | undefined;

  /** Port to listen on when using agent.listen() (default: 3000) */
  port?: number | undefined;
}

/**
 * Base class for Zowie agents.
 *
 * Agents handle incoming requests from Zowie's Decision Engine, process them using
 * LLMs and external APIs, and return responses to continue conversations or
 * transfer to other workflow blocks.
 *
 * @example
 * ```typescript
 * class MyAgent extends Agent {
 *   async handle(context: Context): Promise<AgentResponse> {
 *     const response = await context.llm.generateContent(
 *       context.messages,
 *       "You are a helpful assistant"
 *     );
 *     return { type: "continue", message: response };
 *   }
 * }
 * ```
 */
export abstract class Agent {
  /** The Express application instance exposed for advanced customization */
  public readonly app: Express;

  private readonly llmConfig: LLMConfig;
  private readonly httpTimeoutMs?: number | undefined;
  private readonly includePersonaByDefault: boolean;
  private readonly includeContextByDefault: boolean;
  private readonly includeHttpHeadersByDefault: boolean;
  private readonly includeRequestBodiesInEventsByDefault: boolean;
  private readonly logLevel: string;
  private readonly authValidator: AuthValidator;
  private readonly baseLLM: LLM;
  private readonly baseHTTPClient: HTTPClient;
  private server: Server | undefined;

  /** Logger instance for this agent, automatically configured with the agent's class name */
  protected readonly logger: winston.Logger;

  constructor(options: AgentOptions) {
    // Initialize configuration
    this.llmConfig = options.llmConfig;
    this.httpTimeoutMs = options.httpTimeoutMs;
    this.includePersonaByDefault = options.includePersonaByDefault ?? true;
    this.includeContextByDefault = options.includeContextByDefault ?? true;
    this.includeHttpHeadersByDefault = options.includeHttpHeadersByDefault ?? true;
    this.includeRequestBodiesInEventsByDefault =
      options.includeRequestBodiesInEventsByDefault ?? true;
    this.logLevel = options.logLevel ?? "info";
    this.authValidator = new AuthValidator(options.authConfig);

    // Initialize logger with component name based on class
    this.logger = getLogger(`zowie_agent.${this.constructor.name}`, this.logLevel);

    // Initialize services
    this.baseLLM = new LLM(
      this.llmConfig,
      this.includePersonaByDefault,
      this.includeContextByDefault
    );

    this.baseHTTPClient = new HTTPClient(
      this.httpTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
      this.includeHttpHeadersByDefault,
      this.includeRequestBodiesInEventsByDefault
    );

    // Initialize Express app
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();

    this.logger.info("Agent initialized");
  }

  /**
   * Override this method to implement your agent's logic
   *
   * @param context - Request context containing messages, metadata, and clients
   * @returns Promise resolving to either ContinueConversationResponse or TransferToBlockResponse
   */
  abstract handle(context: Context): Promise<AgentResponse>;

  /**
   * Start the agent server on the specified port
   *
   * @param port - Port to listen on (defaults to 3000)
   * @returns Promise that resolves when the server is listening
   */
  listen(port?: number): Promise<void> {
    const serverPort = port ?? DEFAULT_SERVER_PORT;
    return new Promise((resolve, reject) => {
      const server = this.app.listen(serverPort, () => {
        this.logger.info("Agent listening", { port: serverPort });
        resolve();
      });

      // Handle server errors
      server.on("error", (error) => {
        this.logger.error("Server error", { error: error.message });
        reject(error);
      });

      // Keep reference to prevent garbage collection
      this.server = server;
    });
  }

  private setupMiddleware(): void {
    // Parse JSON request bodies from Zowie Decision Engine
    // Large limit needed for requests with extensive conversation history
    this.app.use(express.json({ limit: DEFAULT_REQUEST_SIZE_LIMIT }));

    // Trust proxy headers for accurate client IP logging in load-balanced deployments
    this.app.set("trust proxy", true);
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get("/health", (_req: Request, res: Response) => {
      res.json({
        status: "healthy",
        agent: this.constructor.name,
        timestamp: getTimeMs(),
      });
    });

    // Main agent endpoint with authentication
    this.app.post("/", this.authValidator.middleware(), async (req: Request, res: Response) => {
      const requestId = "unknown";
      const startTime = Date.now();
      try {
        // Validate the complete incoming request
        const request: IncomingRequest = parseIncomingRequest(req.body);

        const actualRequestId = request.metadata.requestId;
        this.logger.info("Processing request", { requestId: actualRequestId });

        const valueStorage: Record<string, unknown> = {};
        const events: Event[] = [];

        const storeValue = (key: string, value: unknown): void => {
          valueStorage[key] = value;
        };

        const context = new Context(
          request.metadata,
          request.messages,
          storeValue,
          this.baseLLM,
          this.baseHTTPClient,
          request.persona || undefined,
          request.context || undefined,
          events
        );

        const result = await this.handle(context);

        // Build response directly - TypeScript ensures type safety
        const response: ExternalAgentResponse = {
          command:
            result.type === "continue"
              ? {
                  type: "send_message",
                  payload: { message: result.message },
                }
              : {
                  type: "go_to_next_block",
                  payload: {
                    nextBlockReferenceKey: result.nextBlock,
                    message: result.message,
                  },
                },
          valuesToSave: Object.keys(valueStorage).length > 0 ? valueStorage : undefined,
          events: events.length > 0 ? events : undefined,
        };

        this.logger.info("Request processed successfully", {
          requestId: actualRequestId,
          durationMs: Date.now() - startTime,
        });

        res.json(response);
      } catch (error) {
        const durationMs = Date.now() - startTime;
        // Check if it's a validation error (Zod error)
        if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
          this.logger.warn("Invalid request format", {
            requestId,
            durationMs,
            error: error instanceof Error ? error.message : String(error),
          });
          res.status(400).json({
            error: "Bad request",
            message: "Invalid request format",
          });
        } else {
          this.logger.error("Error processing request", {
            requestId,
            durationMs,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          res.status(500).json({
            error: "Internal server error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    // Catch-all for unsupported routes (Express 5 compatible)
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: "Not found",
        message: `Route ${req.method} ${req.path} not found`,
      });
    });
  }

  /**
   * Gracefully close the HTTP server
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((error: Error | undefined) => {
          if (error) {
            this.logger.error("Error closing server", { error: error.message });
            reject(error);
          } else {
            this.logger.info("Server closed successfully");
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}
