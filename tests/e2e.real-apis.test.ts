/**
 * Real end-to-end tests that call actual external APIs.
 *
 * These tests are OPTIONAL and only run when real API keys are provided.
 * They test the complete integration with real LLM providers and external services.
 *
 * To run these tests, set environment variables:
 * - GOOGLE_API_KEY (for Gemini tests)
 * - OPENAI_API_KEY (for OpenAI tests)
 *
 * Usage:
 *   # Run with real API keys
 *   GOOGLE_API_KEY=your_key OPENAI_API_KEY=your_key pnpm test:real
 *
 *   # Skip if no API keys
 *   pnpm test  # Will skip tests
 */

// Type declaration for environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GOOGLE_API_KEY?: string;
      OPENAI_API_KEY?: string;
    }
  }
}

import type { Server } from "node:http";
import { z } from "zod";
import { Agent, type AgentResponse, type Context } from "../src/index.js";
import type { Event } from "../src/protocol.js";

const hasApiKeys = Boolean(process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY);

// Skip all tests if no API keys are provided
const describeWithApiKeys = hasApiKeys ? describe : describe.skip;

describeWithApiKeys("Real API Integration Tests", () => {
  beforeAll(() => {
    if (!hasApiKeys) {
      console.log(
        "⚠️  Skipping real API tests - set GOOGLE_API_KEY or OPENAI_API_KEY to run real E2E tests"
      );
    }
  });

  class RealLLMTestAgent extends Agent {
    async handle(context: Context): Promise<AgentResponse> {
      if (context.messages.length === 0) {
        return {
          type: "continue",
          message: "Hello! I'm a real AI assistant. What can I help you with?",
        };
      }

      // Make a real LLM call
      const response = await context.llm.generateContent(
        context.messages,
        "You are a helpful assistant. Keep your response to 1-2 sentences."
      );

      // Store the fact that we made a real API call
      context.storeValue("real_llm_call_made", true);
      context.storeValue("response_length", response.length);

      return { type: "continue", message: response };
    }
  }

  class RealHTTPTestAgent extends Agent {
    async handle(context: Context): Promise<AgentResponse> {
      if (context.messages.length === 0) {
        return { type: "continue", message: "Send me a request to test HTTP calls." };
      }

      // Make a real HTTP call to a public API (using a simpler endpoint)
      try {
        const response = await context.http.get(
          "https://api.github.com/zen",
          { "User-Agent": "ZowieSDK-E2E-Test/1.0" },
          { timeout: 5000 }
        );

        if (response.ok) {
          const zen = await response.text();
          context.storeValue("real_http_call_made", true);
          context.storeValue("api_response_zen", zen);

          return {
            type: "continue",
            message: `Successfully called GitHub API and got zen: "${zen}"`,
          };
        } else {
          return { type: "continue", message: `HTTP call failed with status ${response.status}` };
        }
      } catch (error) {
        context.storeValue("http_error", String(error));
        return { type: "continue", message: `HTTP call failed with error: ${String(error)}` };
      }
    }
  }

  const UserRequestSchema = z.object({
    intent: z.string(),
    urgency: z.number().min(1).max(10),
    needsHuman: z.boolean(),
  });

  class StructuredTestAgent extends Agent {
    async handle(context: Context): Promise<AgentResponse> {
      if (context.messages.length === 0) {
        return { type: "continue", message: "Send me a message to analyze." };
      }

      // Make real structured LLM call
      const analysis = await context.llm.generateStructuredContent(
        context.messages,
        UserRequestSchema,
        "Analyze the user's message. Rate urgency 1-10 where 10 is emergency."
      );

      context.storeValue("detected_intent", analysis.intent);
      context.storeValue("urgency_score", analysis.urgency);
      context.storeValue("needs_human", analysis.needsHuman);

      return {
        type: "continue",
        message: `I analyzed your message: Intent=${analysis.intent}, Urgency=${analysis.urgency}/10, Needs human=${analysis.needsHuman}`,
      };
    }
  }

  // Helper function to simulate HTTP request to agent
  async function callAgent(agent: Agent, requestData: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let serverInstance: Server;

      // Start server on a random port
      serverInstance = agent.app.listen(0, () => {
        const address = serverInstance.address();
        if (!address || typeof address === "string") {
          throw new Error("Failed to get server port");
        }
        const port = address.port;

        // Make actual HTTP request
        fetch(`http://localhost:${port}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        })
          .then((response) => response.json())
          .then((data) => {
            serverInstance.close(() => {
              resolve(data);
            });
          })
          .catch((error) => {
            serverInstance.close(() => {
              reject(error);
            });
          });
      });
    });
  }

  const describeGoogle = process.env.GOOGLE_API_KEY ? describe : describe.skip;

  describeGoogle("Google Gemini Integration", () => {
    test("should work with real Google Gemini API", async () => {
      const agent = new RealLLMTestAgent({
        llmConfig: {
          provider: "google",
          apiKey: process.env.GOOGLE_API_KEY!,
          model: "gemini-2.5-flash",
        },
      });

      const requestData = {
        metadata: {
          requestId: "real-google-test-1",
          chatbotId: "e2e-test-bot",
          conversationId: "real-google-conv",
        },
        messages: [
          {
            author: "User" as const,
            content: "What is 2+2? Just give me the number.",
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
      };

      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const data = (await callAgent(agent, requestData)) as any;

      console.log("🔍 Google API Response:", JSON.stringify(data, null, 2));
      expect(data.command.type).toBe("send_message");

      // Verify we got a real response
      const message = data.command.payload.message;
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);

      // Verify our tracking worked
      expect(data.valuesToSave.real_llm_call_made).toBe(true);
      expect(data.valuesToSave.response_length).toBeGreaterThan(0);

      // Verify events were tracked
      expect(data.events).toBeDefined();
      expect(Array.isArray(data.events)).toBe(true);
      expect(data.events.length).toBeGreaterThan(0);
      expect(data.events[0].type).toBe("llm_call");

      console.log(` Real Gemini response: ${message}`);
    });

    test("should work with real Google structured output", async () => {
      const agent = new StructuredTestAgent({
        llmConfig: {
          provider: "google",
          apiKey: process.env.GOOGLE_API_KEY!,
          model: "gemini-2.5-flash",
        },
      });

      const requestData = {
        metadata: {
          requestId: "real-google-structured-test-1",
          chatbotId: "e2e-test-bot",
          conversationId: "real-google-structured-conv",
        },
        messages: [
          {
            author: "User" as const,
            content: "I need help resetting my password please",
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
      };

      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const data = (await callAgent(agent, requestData)) as any;

      expect(data.command.type).toBe("send_message");

      // Verify structured analysis worked
      expect(data.valuesToSave.detected_intent).toBeDefined();
      expect(data.valuesToSave.urgency_score).toBeDefined();
      expect(data.valuesToSave.needs_human).toBeDefined();

      const intent = data.valuesToSave.detected_intent;
      const urgency = data.valuesToSave.urgency_score;

      expect(typeof intent).toBe("string");
      expect(intent.length).toBeGreaterThan(0);
      expect(typeof urgency).toBe("number");
      expect(urgency).toBeGreaterThanOrEqual(1);
      expect(urgency).toBeLessThanOrEqual(10);

      console.log(` Real Google structured analysis: Intent='${intent}', Urgency=${urgency}/10`);
    });
  });

  const describeOpenAI = process.env.OPENAI_API_KEY ? describe : describe.skip;

  describeOpenAI("OpenAI Integration", () => {
    test("should work with real OpenAI API", async () => {
      const agent = new RealLLMTestAgent({
        llmConfig: {
          provider: "openai",
          apiKey: process.env.OPENAI_API_KEY!,
          model: "gpt-5-mini",
        },
      });

      const requestData = {
        metadata: {
          requestId: "real-openai-test-1",
          chatbotId: "e2e-test-bot",
          conversationId: "real-openai-conv",
        },
        messages: [
          {
            author: "User" as const,
            content: "What is the capital of France? One word answer only.",
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
      };

      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const data = (await callAgent(agent, requestData)) as any;

      expect(data.command.type).toBe("send_message");

      const message = data.command.payload.message;
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);

      expect(data.valuesToSave.real_llm_call_made).toBe(true);
      expect(data.valuesToSave.response_length).toBeGreaterThan(0);

      expect(data.events).toBeDefined();
      expect(data.events.length).toBeGreaterThan(0);
      expect(data.events[0].type).toBe("llm_call");

      console.log(` Real OpenAI response: ${message}`);
    });

    test("should work with real OpenAI structured output", async () => {
      const agent = new StructuredTestAgent({
        llmConfig: {
          provider: "openai",
          apiKey: process.env.OPENAI_API_KEY!,
          model: "gpt-5-mini",
        },
      });

      const requestData = {
        metadata: {
          requestId: "real-openai-structured-test-1",
          chatbotId: "e2e-test-bot",
          conversationId: "real-openai-structured-conv",
        },
        messages: [
          {
            author: "User" as const,
            content: "URGENT: My account has been hacked and I can't access it!",
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
      };

      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const data = (await callAgent(agent, requestData)) as any;

      expect(data.command.type).toBe("send_message");

      // Verify structured analysis worked
      const intent = data.valuesToSave.detected_intent;
      const urgency = data.valuesToSave.urgency_score;
      const needsHuman = data.valuesToSave.needs_human;

      expect(typeof intent).toBe("string");
      expect(intent.length).toBeGreaterThan(0);
      expect(typeof urgency).toBe("number");
      expect(urgency).toBeGreaterThanOrEqual(1);
      expect(urgency).toBeLessThanOrEqual(10);
      expect(typeof needsHuman).toBe("boolean");

      // For a hacking report, urgency should be high
      expect(urgency).toBeGreaterThanOrEqual(7);

      console.log(
        ` Real OpenAI structured analysis: Intent='${intent}', Urgency=${urgency}/10, NeedsHuman=${needsHuman}`
      );
    });
  });

  test("should work with real HTTP API integration", async () => {
    const agent = new RealHTTPTestAgent({
      llmConfig: {
        provider: "google",
        apiKey: "dummy-key-for-http-test",
        model: "gemini-2.5-flash",
      },
    });

    const requestData = {
      metadata: {
        requestId: "real-http-test-1",
        chatbotId: "e2e-test-bot",
        conversationId: "real-http-conv",
      },
      messages: [
        {
          author: "User" as const,
          content: "Test the HTTP API",
          timestamp: "2024-01-01T00:00:00Z",
        },
      ],
    };

    // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
    const data = (await callAgent(agent, requestData)) as any;

    expect(data.command.type).toBe("send_message");

    const message = data.command.payload.message;
    expect(message).toContain("GitHub API");
    expect(message).toContain("Successfully called");

    expect(data.valuesToSave.real_http_call_made).toBe(true);
    expect(data.valuesToSave.api_response_zen).toBeDefined();

    expect(data.events).toBeDefined();
    expect(data.events.length).toBeGreaterThan(0);

    const apiEvents = data.events.filter((e: Event) => e.type === "api_call");
    expect(apiEvents.length).toBeGreaterThan(0);

    const apiEvent = apiEvents[0];
    expect(apiEvent.payload.url).toBe("https://api.github.com/zen");
    expect(apiEvent.payload.requestMethod).toBe("GET");
    expect(apiEvent.payload.responseStatusCode).toBe(200);

    console.log(` Real HTTP response: ${message}`);
  });

  describeGoogle("Google Gemini with Parameters", () => {
    test("should work with custom temperature parameter", async () => {
      class ParameterTestAgent extends Agent {
        async handle(context: Context): Promise<AgentResponse> {
          if (context.messages.length === 0) {
            return { type: "continue", message: "Send me a message" };
          }

          // Use high temperature for creative response
          const response = await context.llm.generateContent(
            context.messages,
            "You are a creative assistant. Keep responses to 1-2 sentences.",
            undefined,
            undefined,
            { temperature: 1.5 }
          );

          context.storeValue("used_custom_params", true);
          return { type: "continue", message: response };
        }
      }

      const agent = new ParameterTestAgent({
        llmConfig: {
          provider: "google",
          apiKey: process.env.GOOGLE_API_KEY!,
          model: "gemini-2.5-flash",
        },
      });

      const requestData = {
        metadata: {
          requestId: "params-test-1",
          chatbotId: "e2e-test-bot",
          conversationId: "params-conv",
        },
        messages: [
          {
            author: "User" as const,
            content: "Tell me a creative fact about space.",
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
      };

      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const data = (await callAgent(agent, requestData)) as any;

      expect(data.command.type).toBe("send_message");
      expect(data.valuesToSave.used_custom_params).toBe(true);

      const message = data.command.payload.message;
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);

      console.log(` Response with custom parameters: ${message}`);
    });

    test("should generate multiple candidates", async () => {
      class MultiCandidateAgent extends Agent {
        async handle(context: Context): Promise<AgentResponse> {
          if (context.messages.length === 0) {
            return { type: "continue", message: "Send me a message" };
          }

          // Generate 3 different responses
          const responses = await context.llm.generateContentWithCandidates(
            context.messages,
            3,
            "You are a helpful assistant. Give a very short answer (5 words or less).",
            undefined,
            undefined,
            { temperature: 0.9 }
          );

          context.storeValue("candidate_count", responses.length);
          context.storeValue("candidate_1", responses[0]);
          context.storeValue("candidate_2", responses[1]);
          context.storeValue("candidate_3", responses[2]);

          return {
            type: "continue",
            message: `Generated ${responses.length} responses:\n1. ${responses[0]}\n2. ${responses[1]}\n3. ${responses[2]}`,
          };
        }
      }

      const agent = new MultiCandidateAgent({
        llmConfig: {
          provider: "google",
          apiKey: process.env.GOOGLE_API_KEY!,
          model: "gemini-2.5-flash",
        },
      });

      const requestData = {
        metadata: {
          requestId: "multi-candidate-test-1",
          chatbotId: "e2e-test-bot",
          conversationId: "multi-candidate-conv",
        },
        messages: [
          {
            author: "User" as const,
            content: "What is 5+5?",
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
      };

      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const data = (await callAgent(agent, requestData)) as any;

      expect(data.command.type).toBe("send_message");
      expect(data.valuesToSave.candidate_count).toBe(3);
      expect(typeof data.valuesToSave.candidate_1).toBe("string");
      expect(typeof data.valuesToSave.candidate_2).toBe("string");
      expect(typeof data.valuesToSave.candidate_3).toBe("string");

      console.log(` Generated ${data.valuesToSave.candidate_count} candidates:`);
      console.log(`   1: ${data.valuesToSave.candidate_1}`);
      console.log(`   2: ${data.valuesToSave.candidate_2}`);
      console.log(`   3: ${data.valuesToSave.candidate_3}`);
    });

    test("should generate multiple structured candidates", async () => {
      const SentimentSchema = z.object({
        sentiment: z.enum(["positive", "neutral", "negative"]),
        score: z.number().min(0).max(1),
      });

      class StructuredMultiCandidateAgent extends Agent {
        async handle(context: Context): Promise<AgentResponse> {
          if (context.messages.length === 0) {
            return { type: "continue", message: "Send me a message" };
          }

          const analyses = await context.llm.generateStructuredContentWithCandidates(
            context.messages,
            3,
            SentimentSchema,
            "Analyze the sentiment of the user's message."
          );

          context.storeValue("analysis_count", analyses.length);
          for (let i = 0; i < analyses.length; i++) {
            context.storeValue(`analysis_${i + 1}_sentiment`, analyses[i]?.sentiment);
            context.storeValue(`analysis_${i + 1}_score`, analyses[i]?.score);
          }

          return {
            type: "continue",
            message: `Generated ${analyses.length} sentiment analyses`,
          };
        }
      }

      const agent = new StructuredMultiCandidateAgent({
        llmConfig: {
          provider: "google",
          apiKey: process.env.GOOGLE_API_KEY!,
          model: "gemini-2.5-flash",
        },
      });

      const requestData = {
        metadata: {
          requestId: "structured-multi-test-1",
          chatbotId: "e2e-test-bot",
          conversationId: "structured-multi-conv",
        },
        messages: [
          {
            author: "User" as const,
            content: "I'm really happy with your service!",
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
      };

      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const data = (await callAgent(agent, requestData)) as any;

      expect(data.command.type).toBe("send_message");
      expect(data.valuesToSave.analysis_count).toBe(3);

      // Verify all analyses have valid sentiment and score
      for (let i = 1; i <= 3; i++) {
        const sentiment = data.valuesToSave[`analysis_${i}_sentiment`];
        const score = data.valuesToSave[`analysis_${i}_score`];

        expect(["positive", "neutral", "negative"]).toContain(sentiment);
        expect(typeof score).toBe("number");
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);

        console.log(`   Analysis ${i}: ${sentiment} (score: ${score})`);
      }
    });
  });

  describeOpenAI("OpenAI with Parameters", () => {
    test("should work with custom parameters", async () => {
      class OpenAIParameterTestAgent extends Agent {
        async handle(context: Context): Promise<AgentResponse> {
          if (context.messages.length === 0) {
            return { type: "continue", message: "Send me a message" };
          }

          const response = await context.llm.generateContent(
            context.messages,
            "You are a precise assistant. Answer briefly."
          );

          context.storeValue("used_custom_params", true);
          return { type: "continue", message: response };
        }
      }

      const agent = new OpenAIParameterTestAgent({
        llmConfig: {
          provider: "openai",
          apiKey: process.env.OPENAI_API_KEY!,
          model: "gpt-5-mini",
        },
      });

      const requestData = {
        metadata: {
          requestId: "openai-params-test-1",
          chatbotId: "e2e-test-bot",
          conversationId: "openai-params-conv",
        },
        messages: [
          {
            author: "User" as const,
            content: "What is TypeScript?",
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
      };

      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const data = (await callAgent(agent, requestData)) as any;

      expect(data.command.type).toBe("send_message");
      expect(data.valuesToSave.used_custom_params).toBe(true);

      const message = data.command.payload.message;
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);

      console.log(` OpenAI response with custom params: ${message}`);
    });

    test("should generate multiple candidates with OpenAI", async () => {
      class OpenAIMultiCandidateAgent extends Agent {
        async handle(context: Context): Promise<AgentResponse> {
          if (context.messages.length === 0) {
            return { type: "continue", message: "Send me a message" };
          }

          const responses = await context.llm.generateContentWithCandidates(
            context.messages,
            2,
            "Answer with exactly one word."
          );

          context.storeValue("candidate_count", responses.length);
          context.storeValue("candidate_1", responses[0]);
          context.storeValue("candidate_2", responses[1]);

          return {
            type: "continue",
            message: `Candidates: ${responses[0]}, ${responses[1]}`,
          };
        }
      }

      const agent = new OpenAIMultiCandidateAgent({
        llmConfig: {
          provider: "openai",
          apiKey: process.env.OPENAI_API_KEY!,
          model: "gpt-5-mini",
        },
      });

      const requestData = {
        metadata: {
          requestId: "openai-multi-test-1",
          chatbotId: "e2e-test-bot",
          conversationId: "openai-multi-conv",
        },
        messages: [
          {
            author: "User" as const,
            content: "What color is the sky?",
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
      };

      // biome-ignore lint/suspicious/noExplicitAny: any is allowed in tests
      const data = (await callAgent(agent, requestData)) as any;

      expect(data.command.type).toBe("send_message");
      expect(data.valuesToSave.candidate_count).toBe(2);
      expect(typeof data.valuesToSave.candidate_1).toBe("string");
      expect(typeof data.valuesToSave.candidate_2).toBe("string");

      console.log(`   OpenAI Candidate 1: ${data.valuesToSave.candidate_1}`);
      console.log(`   OpenAI Candidate 2: ${data.valuesToSave.candidate_2}`);
    });
  });
});
