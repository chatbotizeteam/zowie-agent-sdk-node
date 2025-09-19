/**
 * OpenAI LLM provider implementation
 */

import { OpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
// biome-ignore lint/style/useImportType: z is used at runtime for zodResponseFormat
import { z } from "zod";
import type { OpenAIProviderConfig } from "../domain.js";
import type { Event, Message, Persona } from "../protocol.js";
import { BaseLLMProvider } from "./base.js";

export class OpenAIProvider extends BaseLLMProvider {
  private openai?: OpenAI;

  constructor(
    config: OpenAIProviderConfig,
    includePersonaDefault = true,
    includeContextDefault = true
  ) {
    super(config, "OpenAIProvider", includePersonaDefault, includeContextDefault);
  }

  private getOpenAI() {
    if (!this.openai) {
      try {
        this.openai = new OpenAI({
          apiKey: this.apiKey,
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
    events: Event[] = []
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
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content received from OpenAI");
        }

        return content;
      },
      messages,
      systemInstructionText,
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
      schema
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
