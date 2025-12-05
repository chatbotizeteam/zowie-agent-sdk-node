# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2025-12-05

### Added

- **Region/location configuration for LLM providers**
  - **Google Vertex AI support** - New `vertexai` config option for regional deployments
    - `VertexAIConfig` type with `project` and `location` fields
    - Uses [Application Default Credentials (ADC)](https://cloud.google.com/docs/authentication/application-default-credentials) for authentication
    - Enables GDPR compliance and latency optimization with regional endpoints (e.g., `europe-west1`)
  - **OpenAI custom endpoint** - New `baseURL` option for custom API endpoints
    - Supports proxies, Azure-compatible endpoints, and other OpenAI-compatible APIs

## [0.5.0] - 2025-12-04

### Added

- **Manual event logging** - New methods on `Context` for logging events from external clients
  - `context.logLLMCall()` - Log LLM calls made with external clients (e.g., direct OpenAI SDK)
  - `context.logAPICall()` - Log HTTP calls made with external clients (e.g., axios, got)
  - Events appear in Supervisor alongside automatically tracked events
  - New exported types: `LLMCallInput`, `APICallInput`

## [0.4.0] - 2025-12-03

### Added

- **Framework-agnostic request handling** - New `agent.handleRequest(body, path)` method
  - Enables use with Next.js App Router, Cloudflare Workers, AWS Lambda, etc.
  - Bypasses Express for serverless/edge deployments
  - Returns `ExternalAgentResponse` directly (now exported from SDK)

## [0.3.0] - 2025-12-03

### Added

- **Path-based routing** - Agent now handles POST requests on all paths, not just `/`
  - New `context.path` property exposes the HTTP request path (e.g., `"/"`, `"/v2/handle"`)
  - Enables implementing custom routing logic within the agent's `handle()` method

### Changed

- **Reduced public API surface** - Removed internal types and utilities from public exports
  - Removed internal classes: `AuthError`, `AuthValidator`, `HTTPClient`, `LLM`, `BaseLLMProvider`, `ContextualHTTPClient`, `ContextualLLM`
  - Removed factory helpers: `createAPIKeyAuth`, `createBasicAuth`, `createBearerTokenAuth` (use object literals instead)
  - Removed internal utilities: `getLogger`, `getTimeMs`, `isAbortError`, `isTimeoutError`
  - Removed all Zod schemas (`*Schema`) - internal parsing implementation details
  - Removed `parseIncomingRequest`, `serializeExternalAgentResponse` - internal protocol handling
  - Removed `GenerateContentConfig`, `OpenAI` type re-exports - import directly from providers if needed
  - Removed unused `VERSION` constant
  - Removed event types (`Event`, `LLMCallEvent`, `APICallEvent`, etc.) - internal protocol types

### Fixed

- Removed dead code: `serializeExternalAgentResponse` was never used internally

## [0.2.1] - 2025-11-20

### Added

- **Retry Logic for LLM Providers** - Implemented and verified exponential backoff retry logic for both Google GenAI and OpenAI providers
  - Google: Custom retry implementation handling retryable errors (429, 5xx) with exponential backoff
  - OpenAI: Configured to use 3 retries (matching Google) via SDK's built-in retry mechanism
  - Includes comprehensive test suite with verification of backoff behavior

## [0.2.0] - 2025-01-14

### Added

- **Per-request LLM parameters** - All `generateContent` and `generateStructuredContent` methods now accept an optional `parameters` object that is passed directly to the underlying LLM provider
  - Allows customizing temperature, max tokens, reasoning effort, thinking budget, and other provider-specific parameters on a per-request basis
  - Fully type-safe with IDE autocomplete support for provider-specific parameters
  - Parameters are automatically logged in events for debugging and observability
- **Multi-candidate generation** - New methods for generating multiple response candidates in a single API call:
  - `generateContentWithCandidates()` - Returns an array of text responses
  - `generateStructuredContentWithCandidates()` - Returns an array of validated structured outputs
  - Useful for A/B testing, generating diverse creative content, and selecting the best response from multiple options
- **Enhanced event tracking** - LLM call events now include the parameters used in each request, providing complete visibility into how the LLM was configured for each call

### Changed

- None (fully backward compatible)

### Fixed

- None

## [0.1.4] - 2025-10-09

### Added

- Request duration tracking in logs - all request processing logs now include `durationMs` field showing execution time in milliseconds

## [0.1.3] - 2025-10-09

### Added

- Optional `thinkingBudget` parameter for Google provider to control reasoning token budget
  - Positive values (e.g., 1024, 2048): Set specific token budget
  - 0: Disable thinking/reasoning
  - -1: Enable dynamic thinking budget
- Optional `reasoningEffort` parameter for OpenAI provider to tune reasoning level
  - "minimal": Minimal reasoning tokens, fastest time-to-first-token
  - "low": Fewer reasoning tokens (faster)
  - "medium": Balanced reasoning tokens (default)
  - "high": More reasoning tokens (more thorough)

## [0.1.2] - 2025-10-09

### Changed

- Updated README with correct organization name
- Removed Python SDK references from documentation

## [0.1.1] - 2025-10-09

### Fixed

- CI pipeline fixes

## [0.1.0] - 2025-10-09

### Added

- Initial release of Zowie Agent SDK for Node.js/TypeScript
- Support for OpenAI GPT models (including o1, o3, GPT-5 series)
- Support for Google Gemini models (2.5-flash, 2.5-pro)
- Express-based HTTP server for agent endpoints
- Built-in persona and context injection
- Schema-based response validation with Zod
- Comprehensive test suite
- Example implementations and documentation
