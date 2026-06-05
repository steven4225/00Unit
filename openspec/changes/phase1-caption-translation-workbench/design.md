## Context

This phase establishes the first product-ready workbench for English speech subtitle translation in talk, conference, and course scenarios. The current business goal is not to prove audio capture or recognition infrastructure, but to prove that a live transcript stream can be turned into readable translated subtitles, corrected when recent text changes, and summarized afterward in a form that feels presentation-ready.

The implementation target is a single-repository, single-runtime Next.js application using App Router, TypeScript, Tailwind CSS, Route Handlers, Zod, and OpenAI-backed APIs. Real ASR is intentionally excluded from phase-1 delivery, but future ASR integration must remain easy by keeping the input boundary stable and source-agnostic.

## Goals / Non-Goals

**Goals:**
- Deliver a single-page caption workbench that feels like a usable product prototype.
- Keep the system ASR-ready through a stable `TranscriptEvent` contract while using a mock source in phase 1.
- Separate interim display behavior from final translation behavior to stabilize subtitle readability.
- Translate incrementally by segment id and support recent correction-driven subtitle replacement.
- Generate manual post-session summary output as structured Chinese summary text, keywords, and uncertain terms.

**Non-Goals:**
- Real microphone capture, browser speech recognition, cloud speech recognition, or Windows-local speech recognition in phase 1.
- Token-level streaming subtitle output.
- Multi-page app structure, persistence, authentication, or cloud deployment.
- External client state libraries such as Zustand, Redux, or XState.
- Long-range context memory, glossary management UI, or multi-stage translation refinement.

## Decisions

### 1. Keep phase-1 input mock-only while preserving an ASR-ready contract

Phase-1 will emit transcript data only through a mock transcript source. All downstream logic must consume a stable `TranscriptEvent` contract with `id`, `text`, `isFinal`, `startMs`, `endMs`, and `source`.

Why:
- It protects the schedule from ASR integration uncertainty.
- It lets the subtitle and summary product logic mature first.
- It guarantees future source replacement without rewriting the workbench core.

Alternatives considered:
- Integrating a real ASR source immediately: rejected because it would dominate the phase-1 schedule and destabilize the demo target.

### 2. Use reducer-based local state as the subtitle state machine

The session orchestration layer will use React `useReducer` to manage transcript ingestion, subtitle patching, correction handling, and summary request state.

Why:
- The application is a single-page, event-driven workbench with clear transitions.
- The main complexity is subtitle state change logic, not global application state sharing.
- `useReducer` keeps the rules explicit without introducing external client state dependencies.

Alternatives considered:
- Zustand or Redux: rejected as unnecessary complexity for phase 1.
- XState: rejected because the state graph does not justify the extra modeling overhead at this stage.

### 3. Translate only finalized or corrected segments

Interim transcript updates remain display-only. Final transcript updates trigger translation. Corrections to an existing segment trigger retranslation for that same segment.

Why:
- It prevents unstable, constantly changing Chinese subtitle output.
- It supports a cleaner reading experience for English-to-Chinese translation where word order frequently needs full-sentence restructuring.
- It keeps API and correction logic predictable.

Alternatives considered:
- Translating every interim update: rejected because it would increase churn, cost, and UI instability.
- Token-level streaming subtitles: rejected because segment-level replacement is more appropriate than incremental character-by-character output for this product shape.

### 4. Use segment-level incremental translation with structured JSON output

Each translation request will process only the most recent one or two changed segments and return structured JSON keyed by segment id.

Why:
- It matches the rolling subtitle window and correction patch model.
- It avoids full-history retranslation.
- It gives the UI atomic, sentence-level replacement behavior.

Alternatives considered:
- Full-history translation on every update: rejected because it is wasteful and destabilizes subtitle identity.
- Streaming token output: rejected because it fights the sentence-level paired subtitle display.

### 5. Use a rolling two-segment paired subtitle display

The primary subtitle workspace will show the most recent two subtitle segments only. Each segment is rendered as English on top and Chinese below. Full history remains internal for correction and summary.

Why:
- It better matches subtitle consumption than side-by-side transcript panels.
- It keeps attention on the latest content rather than on a growing log.
- It aligns with sentence-level patching and replacement.

Alternatives considered:
- Left-right English/Chinese dual-pane layout: rejected as less natural for real-time subtitle reading.
- Full scrolling subtitle history as the main display: rejected because it looks more like a debug console than a product workbench.

### 6. Keep summary manual and separate from live subtitle flow

Summary generation is triggered explicitly by the user and returns `summary`, `keywords`, and `uncertainTerms`.

Why:
- Summary is a post-processing activity, not part of the real-time subtitle rendering path.
- It avoids constant re-summarization during playback.
- It provides a clean second act in the demo flow.

Alternatives considered:
- Auto-refreshing live summary: rejected as unnecessary scope and as a source of distracting UI churn.

## Risks / Trade-offs

- [Mock playback may feel too synthetic] → Use scripted interim-to-final progressions and at least two correction cases to make the session believable.
- [English-to-Chinese translation may still feel delayed at sentence boundaries] → Favor complete segment replacement over unstable token output, and keep segment scope small.
- [Future ASR sources may expose timing details beyond current phase-1 use] → Keep the transcript contract stable and timing fields mandatory even if the UI uses them lightly for now.
- [The rolling two-segment display may hide older subtitle content from the main view] → Retain complete internal history for summary generation and future auxiliary views.

## Migration Plan

1. Implement phase-1 against the mock transcript source and reducer-based workbench state.
2. Keep transcript ingestion abstracted behind the `TranscriptEvent` contract.
3. In a later phase, add a real `TranscriptSource` implementation for `cloud-asr` or `windows-live-captions`.
4. Preserve the translation, correction, and summary contracts while swapping the input source.

## Open Questions

- None for phase-1 boundary definition. Future ASR source selection remains intentionally deferred to a later phase.
