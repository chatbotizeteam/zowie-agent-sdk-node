/**
 * Request context provided to agent implementations.
 *
 * Contains all data needed to process a request: conversation messages,
 * metadata, persona, and pre-configured LLM and HTTP clients with
 * automatic event tracking.
 */

import type { z } from "zod";
import type { APICallInput, LLMCallInput } from "./domain.js";
import type { HTTPClient, HTTPRequestOptions } from "./http.js";
import type { LLM } from "./llm/index.js";
import type { APICallEvent, Event, LLMCallEvent, Message, Metadata, Persona } from "./protocol.js";

export class Context {
  public readonly metadata: Metadata;
  public readonly messages: Message[];
  public readonly path: string;
  public readonly persona?: Persona | undefined;
  public readonly context?: string | undefined;
  public readonly events: Event[];
  public readonly storeValue: (key: string, value: unknown) => void;
  public readonly llm: ContextualLLM;
  public readonly http: ContextualHTTPClient;

  private readonly baseLLM: LLM;
  private readonly baseHTTP: HTTPClient;

  constructor(
    metadata: Metadata,
    messages: Message[],
    path: string,
    storeValue: (key: string, value: unknown) => void,
    llm: LLM,
    http: HTTPClient,
    persona?: Persona | undefined,
    context?: string | undefined,
    events: Event[] = []
  ) {
    this.metadata = metadata;
    this.messages = messages;
    this.path = path;
    this.storeValue = storeValue;
    this.baseLLM = llm;
    this.baseHTTP = http;
    this.persona = persona;
    this.context = context;
    this.events = events;

    this.llm = new ContextualLLM(this.baseLLM, this.persona, this.context, this.events);
    this.http = new ContextualHTTPClient(this.baseHTTP, this.events);
  }

  logLLMCall(input: LLMCallInput): void {
    const event: LLMCallEvent = {
      type: "llm_call",
      payload: {
        prompt: input.prompt,
        response: input.response,
        model: input.model,
        durationInMillis: input.durationInMillis,
      },
    };
    this.events.push(event);
  }

  logAPICall(input: APICallInput): void {
    const event: APICallEvent = {
      type: "api_call",
      payload: {
        url: input.url,
        requestMethod: input.requestMethod,
        requestHeaders: input.requestHeaders ?? {},
        requestBody: input.requestBody,
        responseHeaders: input.responseHeaders ?? {},
        responseStatusCode: input.responseStatusCode,
        responseBody: input.responseBody,
        durationInMillis: input.durationInMillis,
      },
    };
    this.events.push(event);
  }
}

/**
 * LLM wrapper that automatically passes persona/context to LLM calls
 */
export class ContextualLLM {
  constructor(
    private readonly baseLLM: LLM,
    private readonly persona?: Persona,
    private readonly context?: string,
    private readonly events: Event[] = []
  ) {}

  async generateContent(
    messages: Message[],
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    parameters?: Record<string, unknown>
  ): Promise<string> {
    return this.baseLLM.generateContent(
      messages,
      systemInstruction,
      includePersona,
      includeContext,
      this.persona,
      this.context,
      this.events,
      parameters
    );
  }

  async generateStructuredContent<T>(
    messages: Message[],
    schema: z.ZodSchema<T>,
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    parameters?: Record<string, unknown>
  ): Promise<T> {
    return this.baseLLM.generateStructuredContent(
      messages,
      schema,
      systemInstruction,
      includePersona,
      includeContext,
      this.persona,
      this.context,
      this.events,
      parameters
    );
  }

  async generateContentWithCandidates(
    messages: Message[],
    candidateCount: number,
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    parameters?: Record<string, unknown>
  ): Promise<string[]> {
    return this.baseLLM.generateContentWithCandidates(
      messages,
      candidateCount,
      systemInstruction,
      includePersona,
      includeContext,
      this.persona,
      this.context,
      this.events,
      parameters
    );
  }

  async generateStructuredContentWithCandidates<T>(
    messages: Message[],
    candidateCount: number,
    schema: z.ZodSchema<T>,
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    parameters?: Record<string, unknown>
  ): Promise<T[]> {
    return this.baseLLM.generateStructuredContentWithCandidates(
      messages,
      candidateCount,
      schema,
      systemInstruction,
      includePersona,
      includeContext,
      this.persona,
      this.context,
      this.events,
      parameters
    );
  }
}

/**
 * HTTP wrapper that automatically passes events to HTTP calls for clean user API
 */
export class ContextualHTTPClient {
  constructor(
    private readonly baseHTTP: HTTPClient,
    private readonly events: Event[]
  ) {}

  async get(
    url: string,
    headers: Record<string, string> = {},
    options?: HTTPRequestOptions
  ): Promise<Response> {
    return this.baseHTTP.get(url, headers, this.events, options);
  }

  async post(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    options?: HTTPRequestOptions
  ): Promise<Response> {
    return this.baseHTTP.post(url, body, headers, this.events, options);
  }

  async put(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    options?: HTTPRequestOptions
  ): Promise<Response> {
    return this.baseHTTP.put(url, body, headers, this.events, options);
  }

  async patch(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    options?: HTTPRequestOptions
  ): Promise<Response> {
    return this.baseHTTP.patch(url, body, headers, this.events, options);
  }

  async delete(
    url: string,
    headers: Record<string, string> = {},
    options?: HTTPRequestOptions
  ): Promise<Response> {
    return this.baseHTTP.delete(url, headers, this.events, options);
  }
}
