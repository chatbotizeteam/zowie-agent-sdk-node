/**
 * Google Generative AI provider implementation
 */

import type { GenerateContentConfig } from "@google/genai";
import { ApiError, GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { GoogleProviderConfig } from "../domain.js";
import type { Event, Message, Persona } from "../protocol.js";
import { BaseLLMProvider } from "./base.js";

export class GoogleProvider extends BaseLLMProvider {
  private genAI?: GoogleGenAI;
  private readonly thinkingBudget: number | undefined;

  constructor(
    config: GoogleProviderConfig,
    includePersonaDefault = true,
    includeContextDefault = true
  ) {
    super(config, "GoogleProvider", includePersonaDefault, includeContextDefault);
    this.thinkingBudget = config.thinkingBudget;
  }

  private getGenAI() {
    if (!this.genAI) {
      try {
        this.genAI = new GoogleGenAI({ apiKey: this.apiKey });
      } catch (_error) {
        throw new Error(
          "Failed to initialize Google Generative AI provider. Please check your API key."
        );
      }
    }
    return this.genAI;
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries && this.isRetryableError(error)) {
          const delay = baseDelay * 2 ** attempt + Math.random() * 500;
          this.logger.warn(
            `Google API request failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${Math.round(delay)}ms... Error: ${error}`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof ApiError) {
      // Retry on:
      // - 429: Too Many Requests (rate limiting)
      // - >= 500: Server errors (transient issues)
      return error.status === 429 || error.status >= 500;
    }

    return false;
  }

  async generateContent(
    messages: Message[],
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    persona?: Persona,
    context?: string,
    events: Event[] = [],
    parameters?: Partial<GenerateContentConfig>
  ): Promise<string> {
    const genAI = this.getGenAI();

    const systemInstructionText = this.buildSystemInstruction(
      systemInstruction,
      includePersona,
      includeContext,
      persona,
      context
    );

    const chatHistory = this.prepareHistory(messages);

    return this.withTiming(
      async () => {
        const response = await this.retryWithBackoff(() =>
          genAI.models.generateContent({
            model: this.model,
            contents: chatHistory,
            config: {
              ...(systemInstructionText && {
                systemInstruction: systemInstructionText,
              }),
              ...(this.thinkingBudget !== undefined && {
                thinkingConfig: {
                  thinkingBudget: this.thinkingBudget,
                },
              }),
              ...parameters,
            },
          })
        );
        return response.text || "";
      },
      messages,
      systemInstructionText,
      events,
      undefined,
      parameters
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
    events: Event[] = [],
    parameters?: Partial<GenerateContentConfig>
  ): Promise<T> {
    const genAI = this.getGenAI();

    const systemInstructionText = this.buildSystemInstruction(
      systemInstruction,
      includePersona,
      includeContext,
      persona,
      context
    );

    const chatHistory = this.prepareHistory(messages);
    const responseSchema = zodToJsonSchema(schema);

    return this.withTiming(
      async () => {
        const response = await this.retryWithBackoff(() =>
          genAI.models.generateContent({
            model: this.model,
            contents: chatHistory,
            config: {
              ...(systemInstructionText && {
                systemInstruction: systemInstructionText,
              }),
              responseMimeType: "application/json",
              responseSchema,
              ...(this.thinkingBudget !== undefined && {
                thinkingConfig: {
                  thinkingBudget: this.thinkingBudget,
                },
              }),
              ...parameters,
            },
          })
        );

        const content = response.text || "";

        try {
          const parsed = JSON.parse(content);
          return schema.parse(parsed);
        } catch (error) {
          throw new Error(`Failed to parse structured response: ${error}\nResponse: ${content}`);
        }
      },
      messages,
      systemInstructionText,
      events,
      responseSchema,
      parameters
    );
  }

  async generateContentWithCandidates(
    messages: Message[],
    candidateCount: number,
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    persona?: Persona,
    context?: string,
    events: Event[] = [],
    parameters?: Partial<GenerateContentConfig>
  ): Promise<string[]> {
    const genAI = this.getGenAI();

    const systemInstructionText = this.buildSystemInstruction(
      systemInstruction,
      includePersona,
      includeContext,
      persona,
      context
    );

    const chatHistory = this.prepareHistory(messages);

    return this.withTiming(
      async () => {
        const response = await this.retryWithBackoff(() =>
          genAI.models.generateContent({
            model: this.model,
            contents: chatHistory,
            config: {
              ...(systemInstructionText && {
                systemInstruction: systemInstructionText,
              }),
              candidateCount,
              ...(this.thinkingBudget !== undefined && {
                thinkingConfig: {
                  thinkingBudget: this.thinkingBudget,
                },
              }),
              ...parameters,
            },
          })
        );

        const results: string[] = [];
        if (response.candidates) {
          for (const candidate of response.candidates) {
            const text = candidate.content?.parts?.[0]?.text;
            if (text) {
              results.push(text);
            }
          }
        }

        if (results.length === 0) {
          throw new Error("No content received from Google");
        }

        return results;
      },
      messages,
      systemInstructionText,
      events,
      undefined,
      { ...parameters, candidateCount }
    );
  }

  async generateStructuredContentWithCandidates<T>(
    messages: Message[],
    candidateCount: number,
    schema: z.ZodSchema<T>,
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    persona?: Persona,
    context?: string,
    events: Event[] = [],
    parameters?: Partial<GenerateContentConfig>
  ): Promise<T[]> {
    const genAI = this.getGenAI();

    const systemInstructionText = this.buildSystemInstruction(
      systemInstruction,
      includePersona,
      includeContext,
      persona,
      context
    );

    const chatHistory = this.prepareHistory(messages);
    const responseSchema = zodToJsonSchema(schema);

    return this.withTiming(
      async () => {
        const response = await this.retryWithBackoff(() =>
          genAI.models.generateContent({
            model: this.model,
            contents: chatHistory,
            config: {
              ...(systemInstructionText && {
                systemInstruction: systemInstructionText,
              }),
              responseMimeType: "application/json",
              responseSchema,
              candidateCount,
              ...(this.thinkingBudget !== undefined && {
                thinkingConfig: {
                  thinkingBudget: this.thinkingBudget,
                },
              }),
              ...parameters,
            },
          })
        );

        const results: T[] = [];
        if (response.candidates) {
          for (const candidate of response.candidates) {
            const text = candidate.content?.parts?.[0]?.text;
            if (text) {
              try {
                const parsed = JSON.parse(text);
                const validated = schema.parse(parsed);
                results.push(validated);
              } catch (error) {
                // Skip invalid candidates
                this.logger.warn(`Failed to parse candidate: ${error}`);
              }
            }
          }
        }

        if (results.length === 0) {
          throw new Error("No valid parsed content received from Google");
        }

        return results;
      },
      messages,
      systemInstructionText,
      events,
      responseSchema,
      { ...parameters, candidateCount }
    );
  }

  private prepareHistory(messages: Message[]) {
    const history: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const message of messages) {
      history.push({
        role: message.author === "User" ? "user" : "model",
        parts: [{ text: message.content }],
      });
    }

    return history;
  }
}
