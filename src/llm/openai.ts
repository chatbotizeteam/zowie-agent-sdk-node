/**
 * OpenAI LLM provider implementation
 */

import type OpenAI_NS from "openai";
import { OpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
// biome-ignore lint/style/useImportType: z is used at runtime for zodResponseFormat
import { z } from "zod";
import type { OpenAIProviderConfig } from "../domain.js";
import type { Event, Message, Persona } from "../protocol.js";
import { BaseLLMProvider } from "./base.js";

export class OpenAIProvider extends BaseLLMProvider {
  private openai?: OpenAI;
  private readonly reasoningEffort: "minimal" | "low" | "medium" | "high" | undefined;
  private readonly baseURL: string | undefined;

  constructor(
    config: OpenAIProviderConfig,
    includePersonaDefault = true,
    includeContextDefault = true
  ) {
    super(config, "OpenAIProvider", includePersonaDefault, includeContextDefault);
    this.reasoningEffort = config.reasoningEffort;
    this.baseURL = config.baseURL;
  }

  private getOpenAI() {
    if (!this.openai) {
      try {
        this.openai = new OpenAI({
          apiKey: this.apiKey,
          maxRetries: 3,
          ...(this.baseURL && { baseURL: this.baseURL }),
        });
      } catch (_error) {
        throw new Error("Failed to initialize OpenAI provider. Please check your API key.");
      }
    }
    return this.openai;
  }

  async generateContent(
    messages: Message[],
    systemInstruction?: string,
    includePersona?: boolean,
    includeContext?: boolean,
    persona?: Persona,
    context?: string,
    events: Event[] = [],
    parameters?: Partial<
      Omit<OpenAI_NS.Chat.ChatCompletionCreateParamsNonStreaming, "model" | "messages">
    >
  ): Promise<string> {
    const openai = this.getOpenAI();

    const systemInstructionText = this.buildSystemInstruction(
      systemInstruction,
      includePersona,
      includeContext,
      persona,
      context
    );

    const openaiMessages = this.prepareMessages(messages, systemInstructionText);

    return this.withTiming(
      async () => {
        const completion = await openai.chat.completions.create({
          model: this.model,
          messages: openaiMessages,
          ...(this.reasoningEffort && {
            reasoning_effort: this.reasoningEffort,
          }),
          ...parameters,
        });

        const message = completion.choices[0]?.message;
        const content = message?.content;

        if (!content) {
          // Check for refusal (common in reasoning models)
          if (message?.refusal) {
            throw new Error(`OpenAI refused to respond: ${message.refusal}`);
          }
          throw new Error(
            `No content received from OpenAI. Response: ${JSON.stringify(completion.choices[0])}`
          );
        }

        return content;
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
    parameters?: Partial<
      Omit<
        OpenAI_NS.Chat.ChatCompletionCreateParamsNonStreaming,
        "model" | "messages" | "response_format"
      >
    >
  ): Promise<T> {
    const openai = this.getOpenAI();

    const systemInstructionText = this.buildSystemInstruction(
      systemInstruction,
      includePersona,
      includeContext,
      persona,
      context
    );

    const openaiMessages = this.prepareMessages(messages, systemInstructionText);

    return this.withTiming(
      async () => {
        const completion = await openai.chat.completions.parse({
          model: this.model,
          messages: openaiMessages,
          response_format: zodResponseFormat(schema, "response"),
          ...(this.reasoningEffort && {
            reasoning_effort: this.reasoningEffort,
          }),
          ...parameters,
        });

        const message = completion.choices[0]?.message;
        if (!message?.parsed) {
          throw new Error("No parsed content received from OpenAI");
        }

        return message.parsed;
      },
      messages,
      systemInstructionText,
      events,
      schema,
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
    parameters?: Partial<
      Omit<OpenAI_NS.Chat.ChatCompletionCreateParamsNonStreaming, "model" | "messages" | "n">
    >
  ): Promise<string[]> {
    const openai = this.getOpenAI();

    const systemInstructionText = this.buildSystemInstruction(
      systemInstruction,
      includePersona,
      includeContext,
      persona,
      context
    );

    const openaiMessages = this.prepareMessages(messages, systemInstructionText);

    return this.withTiming(
      async () => {
        const completion = await openai.chat.completions.create({
          model: this.model,
          messages: openaiMessages,
          n: candidateCount,
          ...(this.reasoningEffort && {
            reasoning_effort: this.reasoningEffort,
          }),
          ...parameters,
        });

        const results: string[] = [];
        for (const choice of completion.choices) {
          const content = choice.message?.content;
          if (content) {
            results.push(content);
          } else if (choice.message?.refusal) {
            this.logger.warn(`Candidate refused: ${choice.message.refusal}`);
          }
        }

        if (results.length === 0) {
          throw new Error(
            `No content received from OpenAI. Choices: ${JSON.stringify(completion.choices)}`
          );
        }

        return results;
      },
      messages,
      systemInstructionText,
      events,
      undefined,
      { ...parameters, n: candidateCount }
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
    parameters?: Partial<
      Omit<
        OpenAI_NS.Chat.ChatCompletionCreateParamsNonStreaming,
        "model" | "messages" | "response_format" | "n"
      >
    >
  ): Promise<T[]> {
    const openai = this.getOpenAI();

    const systemInstructionText = this.buildSystemInstruction(
      systemInstruction,
      includePersona,
      includeContext,
      persona,
      context
    );

    const openaiMessages = this.prepareMessages(messages, systemInstructionText);

    return this.withTiming(
      async () => {
        const completion = await openai.chat.completions.parse({
          model: this.model,
          messages: openaiMessages,
          response_format: zodResponseFormat(schema, "response"),
          n: candidateCount,
          ...(this.reasoningEffort && {
            reasoning_effort: this.reasoningEffort,
          }),
          ...parameters,
        });

        const results: T[] = [];
        for (const choice of completion.choices) {
          const parsed = choice.message?.parsed;
          if (parsed) {
            results.push(parsed);
          }
        }

        if (results.length === 0) {
          throw new Error("No parsed content received from OpenAI");
        }

        return results;
      },
      messages,
      systemInstructionText,
      events,
      schema,
      { ...parameters, n: candidateCount }
    );
  }

  private prepareMessages(messages: Message[], systemInstruction?: string) {
    const openaiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

    if (systemInstruction) {
      openaiMessages.push({
        role: "system",
        content: systemInstruction,
      });
    }

    for (const message of messages) {
      openaiMessages.push({
        role: message.author === "User" ? "user" : "assistant",
        content: message.content,
      });
    }

    return openaiMessages;
  }
}
