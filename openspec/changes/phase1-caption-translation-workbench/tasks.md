## 1. Project foundation

- [x] 1.1 Scaffold the Next.js App Router application with TypeScript, Tailwind CSS, and the existing OpenSpec repository structure.
- [ ] 1.2 Add environment variable handling for the OpenAI API key and document local startup expectations.
- [x] 1.3 Create the initial single-page workbench shell with source status, controls, subtitle workspace, and summary area.

## 2. Contracts and mock transcript source

- [x] 2.1 Define Zod schemas and TypeScript types for `TranscriptEvent`, `SubtitleItem`, translation payloads, and summary payloads.
- [x] 2.2 Implement the phase-1 mock transcript source with at least two interim-to-final progressions and two correction cases.
- [x] 2.3 Introduce a transcript source boundary that keeps downstream logic independent from future ASR source implementations.

## 3. Subtitle orchestration and translation

- [x] 3.1 Implement a reducer-based session orchestration layer for transcript ingestion, stable segment patching, subtitle statuses, and reset behavior.
- [x] 3.2 Implement translation triggering rules so interim updates remain display-only while final and corrected segments trigger translation.
- [x] 3.3 Add the translation Route Handler with structured JSON responses keyed by segment id for the most recent one to two changed segments.
- [x] 3.4 Add request cancellation or stale-result protection so outdated translation responses do not overwrite newer segment state.

## 4. Summary and workbench UI

- [x] 4.1 Implement the summary Route Handler to return `summary`, `keywords`, and `uncertainTerms` from the full English transcript.
- [x] 4.2 Build the rolling two-segment primary subtitle workspace with paired English-above-Chinese rendering and lightweight draft/final/corrected cues.
- [x] 4.3 Connect start, pause, reset, and manual summary generation controls to the mock source and reducer state.

## 5. Verification and handoff

- [x] 5.1 Verify the phase-1 demo path locally, including mock playback, two interim-to-final progressions, two correction cases, and summary generation.
- [ ] 5.2 Document the future ASR insertion point so later `cloud-asr` or `windows-live-captions` sources can adopt the existing transcript contract.
