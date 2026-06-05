## Why

The project needs a stable phase-1 product prototype that demonstrates subtitle translation, correction, and summary generation without getting blocked by real-time ASR integration risk. Locking the downstream workbench boundary now makes the three-day implementation target achievable while preserving a clean path for future ASR input sources.

## What Changes

- Define a stable transcript event contract and a mock-only phase-1 transcript source boundary.
- Add a reducer-driven subtitle orchestration flow that separates interim display from final translation and correction handling.
- Add a single-page caption workbench with a rolling two-segment paired subtitle display, source status, controls, and summary area.
- Add structured translation and summary API contracts backed by schema validation.
- Add acceptance expectations for interim-to-final progression, correction handling, and manual summary generation.

## Capabilities

### New Capabilities
- `transcript-event-contract`: Canonical transcript event schema and phase-1 mock source boundary for ASR-ready downstream integration.
- `segment-translation-orchestration`: Incremental segment translation, correction-triggered retranslation, and reducer-based subtitle state rules.
- `caption-workbench-ui`: Single-page workbench UI with paired English/Chinese subtitle segments, rolling two-segment display, controls, and source status.
- `session-summary-generation`: Manual summary generation with structured outputs for summary text, keywords, and uncertain terms.

### Modified Capabilities
- None.

## Impact

- Affected areas: Next.js App Router UI, Route Handler APIs, client-side session orchestration, mock transcript modules, and schema definitions.
- External dependencies in scope: OpenAI API, Zod, and the existing Next.js/TypeScript/Tailwind stack.
- Explicitly not included in this change: real ASR implementation, token streaming subtitles, external state libraries, persistence, or multi-page routing.
