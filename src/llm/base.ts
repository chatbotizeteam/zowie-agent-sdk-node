/**
 * Base LLM provider interface and common functionality
 */

import type winston from "winston";
import type { z } from "zod";
import type { GoogleProviderConfig, LLMConfig, OpenAIProviderConfig } from "../domain.js";
import { getLogger } from "../logger.js";
import type { Event, LLMCallEvent, Message, Persona } from "../protocol.js";
import { getTimeMs } from "../utils.js";

export abstract class BaseLLMProvider {
  protected readonly model: string;
  protected readonly apiKey: string;
  protected readonly includePersonaDefault: boolean;
  protected readonly includeContextDefault: boolean;
  protected readonly logger: winston.Logger;

  constructor(
    config: OpenAIProviderConfig | GoogleProviderConfig,
    providerName: string,
    includePersonaDefault = true,
    includeContextDefault = true
  ) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.includePersonaDefault = includePersonaDefault;
    this.includeContextDefault = includeContextDefault;
    this.logger = getLogger(`zowie_agent.${providerName}`);
  }

  /**
   * Generate content using the LLM
   */
  abstract generateContent(
    messages: Message[],
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    persona?: Persona,
    context?: string,
    events?: Event[]
  ): Promise<string>;

  /**
   * Generate structured content using the LLM with schema validation
   */
  abstract generateStructuredContent<T>(
    messages: Message[],
    schema: z.ZodSchema<T>,
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    persona?: Persona,
    context?: string,
    events?: Event[]
  ): Promise<T>;

  /**
   * Build system instruction combining persona, instructions, and context
   */
  protected buildSystemInstruction(
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    persona?: Persona,
    context?: string
  ): string {
    const shouldIncludePersona = includePersona ?? this.includePersonaDefault;
    const shouldIncludeContext = includeContext ?? this.includeContextDefault;

    const parts: string[] = [];

    // Add persona if needed
    if (shouldIncludePersona && persona) {
      parts.push(this.buildPersonaInstruction(persona));
    }

    // Add instructions tags only if content exists
    if (systemInstruction) {
      parts.push(`<instructions>\\n${systemInstruction}\\n</instructions>`);
    }

    // Add context only if provided AND should include
    if (context && shouldIncludeContext) {
      parts.push(`<context>\\n${context}\\n</context>`);
    }

    return parts.join("\\n\\n");
  }

  /**
   * Build persona instruction from persona object
   */
  protected buildPersonaInstruction(persona: Persona): string {
    const parts: string[] = [];

    if (persona.name) {
      parts.push(`<name>${persona.name}</name>`);
    }

    if (persona.businessContext) {
      parts.push(`<business_context>\\n${persona.businessContext}\\n</business_context>`);
    }

    if (persona.toneOfVoice) {
      parts.push(`<tone_of_voice>\\n${persona.toneOfVoice}\\n</tone_of_voice>`);
    }

    const content = parts.length > 0 ? `\\n${parts.join("\\n\\n")}\\n` : "\\n";
    return `<persona>${content}</persona>`;
  }

  /**
   * Create an LLM call event for tracking
   */
  protected createLLMCallEvent(
    messages: Message[],
    systemInstruction: string,
    response: string,
    durationMs: number,
    responseSchema?: unknown
  ): LLMCallEvent {
    const promptData: Record<string, unknown> = {
      messages,
      system_instruction: systemInstruction,
    };

    if (responseSchema) {
      // biome-ignore lint/complexity/useLiteralKeys: Required by TypeScript noPropertyAccessFromIndexSignature
      promptData["response_schema"] = responseSchema;
    }

    return {
      type: "llm_call",
      payload: {
        prompt: JSON.stringify(promptData, null, 2),
        response,
        model: this.model,
        durationInMillis: durationMs,
      },
    };
  }

  /**
   * Measure execution time and create event
   */
  protected async withTiming<T>(
    operation: () => Promise<T>,
    messages: Message[],
    systemInstruction: string,
    events: Event[],
    responseSchema?: unknown
  ): Promise<T> {
    this.logger.debug(
      `Making ${this.constructor.name.replace("Provider", "")} LLM request with model ${this.model}`
    );

    const startTime = getTimeMs();
    try {
      const result = await operation();
      const endTime = getTimeMs();
      const duration = endTime - startTime;

      this.logger.debug(
        `${this.constructor.name.replace("Provider", "")} LLM request completed in ${duration}ms with model ${this.model}`
      );

      const responseText = typeof result === "string" ? result : JSON.stringify(result);
      events.push(
        this.createLLMCallEvent(messages, systemInstruction, responseText, duration, responseSchema)
      );

      return result;
    } catch (error) {
      const endTime = getTimeMs();
      const duration = endTime - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `${this.constructor.name.replace("Provider", "")} LLM request failed after ${duration}ms: ${errorMessage}`
      );

      events.push(
        this.createLLMCallEvent(
          messages,
          systemInstruction,
          `Error: ${errorMessage}`,
          duration,
          responseSchema
        )
      );
      throw error;
    }
  }
}

/**
 * Main LLM class that delegates to provider implementations
 */
export class LLM {
  private readonly provider?: BaseLLMProvider | undefined;
  private readonly providerPromise?: Promise<BaseLLMProvider> | undefined;

  constructor(config?: LLMConfig, includePersonaDefault = true, includeContextDefault = true) {
    if (!config) {
      // Type assertion needed since TypeScript can't infer conditional property assignment
      (this as unknown as { provider?: undefined; providerPromise?: undefined }).provider =
        undefined;
      (this as unknown as { provider?: undefined; providerPromise?: undefined }).providerPromise =
        undefined;
      return;
    }

    this.providerPromise = this.initializeProvider(
      config,
      includePersonaDefault,
      includeContextDefault
    );
  }

  private async initializeProvider(
    config: LLMConfig,
    includePersonaDefault: boolean,
    includeContextDefault: boolean
  ): Promise<BaseLLMProvider> {
    if (config.provider === "openai") {
      const { OpenAIProvider } = await import("./openai.js");
      return new OpenAIProvider(config, includePersonaDefault, includeContextDefault);
    }
    if (config.provider === "google") {
      const { GoogleProvider } = await import("./google.js");
      return new GoogleProvider(config, includePersonaDefault, includeContextDefault);
    }

    throw new Error(`Unknown LLM provider`);
  }

  private async getProvider(): Promise<BaseLLMProvider> {
    if (!this.providerPromise) {
      throw new Error("LLM provider not configured");
    }
    return this.providerPromise;
  }

  async generateContent(
    messages: Message[],
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    persona?: Persona,
    context?: string,
    events: Event[] = []
  ): Promise<string> {
    const provider = await this.getProvider();
    return provider.generateContent(
      messages,
      systemInstruction,
      includePersona,
      includeContext,
      persona,
      context,
      events
    );
  }

  async generateStructuredContent<T>(
    messages: Message[],
    schema: z.ZodSchema<T>,
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    persona?: Persona,
    context?: string,
    events: Event[] = []
  ): Promise<T> {
    const provider = await this.getProvider();
    return provider.generateStructuredContent(
      messages,
      schema,
      systemInstruction,
      includePersona,
      includeContext,
      persona,
      context,
      events
    );
  }
}
