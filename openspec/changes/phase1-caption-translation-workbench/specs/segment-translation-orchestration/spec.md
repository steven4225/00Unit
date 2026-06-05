## ADDED Requirements

### Requirement: Interim updates are display-only
Interim transcript updates SHALL update visible source text only and SHALL NOT trigger formal subtitle translation.

#### Scenario: A non-final transcript update is received
- **WHEN** the system ingests a `TranscriptEvent` with `isFinal` set to `false`
- **THEN** the subtitle source text may update while no formal translation request is issued for that segment

### Requirement: Final and corrected segments trigger translation
Final transcript updates SHALL trigger translation, and corrections to an existing segment SHALL trigger retranslation for that same segment.

#### Scenario: A segment is finalized
- **WHEN** the system ingests a final transcript event for a segment
- **THEN** it requests translation for that segment

#### Scenario: A previously known segment changes
- **WHEN** the English text for an existing segment id changes after an earlier version was stored
- **THEN** the system marks that segment as corrected and requests a replacement translation for that segment

### Requirement: Incremental translation scope
Each translation request SHALL process only the most recent one to two changed segments and SHALL NOT retranslate the full subtitle history on every update.

#### Scenario: A new segment finalizes
- **WHEN** the newest finalized segment triggers translation
- **THEN** the translation request contains only that segment or at most one adjacent recently changed segment

#### Scenario: Older subtitle history already exists
- **WHEN** translation is triggered for recent changes
- **THEN** unchanged historical segments are excluded from the request

### Requirement: Segment-level structured translation responses
Phase-1 translation APIs SHALL return structured JSON responses keyed by segment id and SHALL NOT emit token-level streaming subtitle output.

#### Scenario: The translation API succeeds
- **WHEN** the client submits one or more changed segments for translation
- **THEN** the response returns complete translated subtitle strings keyed by the same segment ids

#### Scenario: The UI applies translated subtitles
- **WHEN** the client receives translated subtitle results
- **THEN** each affected segment is replaced atomically at the sentence level rather than through token-by-token streaming

### Requirement: Reducer-based orchestration and stale result protection
Phase-1 subtitle orchestration SHALL use React `useReducer`, and outdated translation responses MUST NOT overwrite newer segment state.

#### Scenario: A newer correction arrives before an older translation response completes
- **WHEN** an earlier translation request resolves after a newer request has already superseded it
- **THEN** the outdated result is discarded or ignored instead of replacing the latest segment state
