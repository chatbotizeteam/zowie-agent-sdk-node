/**
 * Document Verification Expert Agent
 *
 * A specialized agent that demonstrates advanced SDK features:
 * - Scope detection: Determines if questions are within its expertise
 * - Structured responses: Returns JSON-formatted answers for document queries
 * - Transfer capability: Uses TransferToBlockResponse for out-of-scope questions
 * - Internal system simulation: Connects to a non-public expert system for document tracking
 * - LLM-powered analysis: Uses structured content generation for intent detection
 *
 * This agent represents a realistic use case where an internal expert system
 * (that cannot expose a public API) provides document verification requirements
 * through an intelligent conversational interface.
 */

import {
  Agent,
  type AgentResponse,
  type AuthConfig,
  type Context,
  type LLMConfig,
} from "@zowieteam/zowie-agent-sdk";
import { z } from "zod";

// Document types enum
const DocumentTypeSchema = z.enum([
  "id_card",
  "passport",
  "drivers_license",
  "proof_of_residence",
  "utility_bill",
  "bank_statement",
  "employment_letter",
  "tax_return",
]);

// Document status enum
const DocumentStatusSchema = z.enum([
  "not_submitted",
  "pending_review",
  "approved",
  "rejected",
  "expired",
]);

// Document schema
const DocumentSchema = z.object({
  type: DocumentTypeSchema,
  status: DocumentStatusSchema,
  submittedDate: z.string().optional(),
  reviewNotes: z.string().optional(),
  expiryDate: z.string().optional(),
});

type Document = z.infer<typeof DocumentSchema>;

// Query analysis schema
const QueryAnalysisSchema = z.object({
  isDocumentRelated: z
    .boolean()
    .describe("Whether the query is about document verification, requirements, or status"),
  specificTopic: z
    .string()
    .optional()
    .describe("Specific document topic if identified (e.g., 'passport status')"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence that this query is within agent's scope"),
  requiresStatusCheck: z
    .boolean()
    .describe("Whether we need to check the user's current document status"),
  userQuestion: z.string().describe("Summary of what the user is asking"),
});

type QueryAnalysis = z.infer<typeof QueryAnalysisSchema>;

// Document requirements schema
const DocumentRequirementsSchema = z.object({
  userId: z.string(),
  accountType: z.string(),
  requiredDocuments: z.array(DocumentSchema),
  verificationDeadline: z.string().optional(),
  overallStatus: z.enum(["incomplete", "pending_review", "approved", "rejected"]),
});

type DocumentRequirements = z.infer<typeof DocumentRequirementsSchema>;

class DocumentVerificationExpertAgent extends Agent {
  async handle(context: Context): Promise<AgentResponse> {
    // Handle initial greeting when there are no previous messages
    if (context.messages.length === 0) {
      return {
        type: "continue",
        message:
          "Hello! I'm the Document Verification Expert. I can help you understand:\\n" +
          "• What documents you need to submit\\n" +
          "• The status of documents you've already submitted\\n" +
          "• Why a document might have been rejected\\n" +
          "• Next steps for completing your verification\\n\\n" +
          "What would you like to know about your document requirements?",
      };
    }

    // Step 1: Analyze if the query is within scope (document-related)
    const queryAnalysis = await context.llm.generateStructuredContent(
      context.messages,
      QueryAnalysisSchema,
      "Analyze if this query is about document verification, document requirements, " +
        "document status, or the verification process. Be strict: only mark as " +
        "document_related if it's specifically about documents needed for account " +
        "verification. General account questions, technical support, orders, passwords, " +
        "business hours, or other non-document topics should be marked as NOT " +
        "document_related."
    );

    this.logger.info(
      `Query analysis - Topic: ${queryAnalysis.specificTopic}, ` +
        `Document related: ${queryAnalysis.isDocumentRelated}, ` +
        `Confidence: ${queryAnalysis.confidence}`
    );

    // Step 2: If out of scope, transfer to general support
    if (!queryAnalysis.isDocumentRelated || queryAnalysis.confidence < 0.7) {
      this.logger.info(
        `Query out of scope. Topic: ${queryAnalysis.specificTopic}, ` +
          `Confidence: ${queryAnalysis.confidence}`
      );

      // Generate a polite transfer message
      const transferMessage = `I specialize in document verification requirements, but your question about '${queryAnalysis.userQuestion}' is outside my area of expertise. Let me transfer you to our general support team who can better assist you.`;

      return {
        type: "finish",
        nextBlock: "general-support",
        message: transferMessage,
      };
    }

    // Step 3: Query is in scope - get document requirements and generate response
    try {
      const documentRequirements = await this.getDocumentRequirements(context);

      // Generate natural conversational response
      const response = await context.llm.generateContent(
        context.messages,
        this.buildSystemInstruction(queryAnalysis, documentRequirements)
      );

      return { type: "continue", message: response };
    } catch (error) {
      this.logger.error(`Failed to process document query: ${error}`);
      return {
        type: "continue",
        message:
          "I'm having trouble accessing the document verification system. " +
          "Please try again in a moment, or contact support if the issue persists.",
      };
    }
  }

  private async getDocumentRequirements(context: Context): Promise<DocumentRequirements> {
    /**
     * Simulate querying internal expert system for document requirements.
     *
     * MOCK API DEMONSTRATION:
     * This method demonstrates connecting to an internal expert system that:
     * 1. Cannot expose a public API for security/business reasons
     * 2. Contains complex business logic only developers understand
     * 3. Provides document verification requirements for users
     *
     * In production, this would be a real HTTP call to an internal service like:
     * - POST https://internal-verification-system.company.com/api/v1/users/{user_id}/requirements
     * - With proper authentication, error handling, and business logic
     *
     * For demo purposes, we use a public random number API to simulate different
     * document scenarios and business rules.
     */
    const userId = context.metadata.conversationId;

    // MOCK: Use external random number service to simulate internal API response
    const response = await context.http.get(
      "https://csrng.net/csrng/csrng.php?min=1&max=100",
      { "User-Agent": "DocumentExpertSystem/1.0" },
      { timeout: 5000 }
    );

    // MOCK: Extract random seed to simulate different business scenarios
    let seed = 50;
    if (response.ok) {
      try {
        const data = await response.json();
        if (Array.isArray(data) && data[0]?.random) {
          seed = data[0].random;
        }
      } catch {
        // Use default seed if parsing fails
      }
    }

    // MOCK: Generate realistic document requirements based on seed
    const documents: Document[] = [];

    // MOCK BUSINESS LOGIC: Always require government-issued ID
    // Seed > 30 means user already submitted and it was approved
    documents.push({
      type: "id_card",
      status: seed > 30 ? "approved" : "not_submitted",
      submittedDate: seed > 30 ? "2024-01-10T10:00:00Z" : undefined,
    });

    // MOCK BUSINESS LOGIC: Proof of residence requirements
    // Seed divisible by 3 = document was submitted but rejected (common scenario)
    if (seed % 3 === 0) {
      documents.push({
        type: "proof_of_residence",
        status: "rejected",
        submittedDate: "2024-01-11T14:30:00Z",
        reviewNotes: "Address not clearly visible",
      });
    } else {
      // Otherwise, either not submitted (seed < 50) or approved (seed >= 50)
      documents.push({
        type: "proof_of_residence",
        status: seed < 50 ? "not_submitted" : "approved",
        submittedDate: seed >= 50 ? "2024-01-12T09:00:00Z" : undefined,
      });
    }

    // MOCK BUSINESS LOGIC: Premium accounts (seed > 60) require additional verification
    if (seed > 60) {
      documents.push({
        type: "utility_bill",
        status: "not_submitted",
        reviewNotes: "Required for premium account verification",
      });
    }

    // MOCK BUSINESS LOGIC: Business accounts (seed % 5 == 0) need employment verification
    if (seed % 5 === 0) {
      documents.push({
        type: "employment_letter",
        status: "pending_review",
        submittedDate: "2024-01-13T16:00:00Z",
      });
    }

    // Determine overall status
    const allApproved = documents.every((d) => d.status === "approved");
    const hasPending = documents.some((d) => d.status === "pending_review");
    const hasRejected = documents.some((d) => d.status === "rejected");

    let overallStatus: "incomplete" | "pending_review" | "approved" | "rejected";
    if (allApproved) {
      overallStatus = "approved";
    } else if (hasRejected) {
      overallStatus = "rejected";
    } else if (hasPending) {
      overallStatus = "pending_review";
    } else {
      overallStatus = "incomplete";
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);

    return {
      userId,
      accountType: seed > 60 ? "premium" : "standard",
      requiredDocuments: documents,
      verificationDeadline: deadline.toISOString(),
      overallStatus,
    };
  }

  private buildSystemInstruction(
    queryAnalysis: QueryAnalysis,
    requirements: DocumentRequirements
  ): string {
    // Identify missing and rejected documents
    const missing = requirements.requiredDocuments
      .filter((doc) => doc.status === "not_submitted")
      .map((doc) => doc.type);

    const rejected = requirements.requiredDocuments
      .filter((doc) => doc.status === "rejected")
      .map((doc) => `${doc.type} (${doc.reviewNotes || "needs resubmission"})`);

    const userQuestion = queryAnalysis.userQuestion;
    const overallStatus = requirements.overallStatus;
    const accountType = requirements.accountType;
    const deadline = requirements.verificationDeadline;

    return `
You are a helpful document verification expert. The user is asking: ${userQuestion}

Current document status:
- Overall status: ${overallStatus}
- Account type: ${accountType}
- Missing documents: ${missing.length > 0 ? missing.join(", ") : "None"}
- Rejected documents: ${rejected.length > 0 ? rejected.join(", ") : "None"}
- Deadline: ${deadline}

Respond naturally and conversationally. Be helpful and specific about their document
requirements. If documents are missing or rejected, clearly explain what they need to do.
Keep the tone professional but friendly.
`;
  }
}

function createAgent(): DocumentVerificationExpertAgent {
  // Configure LLM provider
  let llmConfig: LLMConfig;
  if (process.env.GOOGLE_API_KEY) {
    llmConfig = {
      provider: "google",
      apiKey: process.env.GOOGLE_API_KEY,
      model: "gemini-2.5-flash",
    };
    console.log("Using Google Gemini for document verification expert");
  } else if (process.env.OPENAI_API_KEY) {
    llmConfig = {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-5-mini",
    };
    console.log("Using OpenAI GPT for document verification expert");
  } else {
    throw new Error("Please set GOOGLE_API_KEY or OPENAI_API_KEY environment variable");
  }

  // Optional authentication
  const authConfig: AuthConfig | undefined = process.env.AGENT_API_KEY
    ? { type: "bearer", token: process.env.AGENT_API_KEY }
    : undefined;

  if (authConfig) {
    console.log("API key authentication enabled");
  }

  return new DocumentVerificationExpertAgent({
    llmConfig,
    authConfig,
  });
}

// Create the agent and expose globally
const agent = createAgent();

// Start the server
const port = Number.parseInt(process.env.PORT || "3000", 10);

await agent.listen(port);
