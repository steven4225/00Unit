## ADDED Requirements

### Requirement: Stable transcript event contract
The system SHALL represent all transcript updates through a stable `TranscriptEvent` contract containing `id`, `text`, `isFinal`, `startMs`, `endMs`, and `source`.

#### Scenario: A transcript update enters the system
- **WHEN** any transcript source emits a new or updated segment
- **THEN** the update is expressed as a valid `TranscriptEvent`

#### Scenario: A future ASR source is added
- **WHEN** a later implementation introduces a non-mock transcript source
- **THEN** it emits the same `TranscriptEvent` shape without requiring downstream rewrite

### Requirement: Phase-1 mock-only source boundary
Phase-1 SHALL exclude real ASR implementation and SHALL use a mock transcript source as the only active source.

#### Scenario: Phase-1 playback starts
- **WHEN** the user starts a session in phase 1
- **THEN** transcript events are emitted by the mock transcript source rather than by a real ASR implementation

### Requirement: Scripted interim and correction coverage
The phase-1 mock source SHALL provide at least two interim-to-final progressions and at least two correction cases.

#### Scenario: Interim-to-final behavior is demonstrated
- **WHEN** the mock playback runs through a scripted segment
- **THEN** the system observes at least one non-final update before the final version of that segment

#### Scenario: Correction behavior is demonstrated
- **WHEN** the mock playback reaches a scripted correction point
- **THEN** an existing segment id receives updated English text after a previous version has already been shown
