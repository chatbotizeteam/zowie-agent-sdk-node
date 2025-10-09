# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
