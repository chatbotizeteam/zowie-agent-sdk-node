# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
