## ADDED Requirements

### Requirement: Manual summary generation
Phase-1 summary generation SHALL be user-triggered and SHALL remain separate from the live subtitle rendering path.

#### Scenario: The user requests a summary
- **WHEN** the user activates the summary control after transcript content exists
- **THEN** the system submits the current session transcript for summary generation

#### Scenario: Subtitle playback continues without summary refresh
- **WHEN** transcript playback continues and the user does not request a summary
- **THEN** the summary area does not auto-refresh during playback

### Requirement: Structured summary output
The summary API SHALL return `summary`, `keywords`, and `uncertainTerms`.

#### Scenario: The summary request succeeds
- **WHEN** the summary API returns successfully
- **THEN** the response includes all three structured output fields

### Requirement: Full-session transcript basis
Summary generation SHALL use the internally retained full English transcript history rather than only the current two-segment primary display window.

#### Scenario: Older segments have scrolled out of the primary subtitle window
- **WHEN** the user requests summary after multiple segments have been displayed
- **THEN** the summary still incorporates the full retained session transcript
