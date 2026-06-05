## ADDED Requirements

### Requirement: Single-page workbench delivery
Phase-1 SHALL ship as a single-page workbench experience with all primary controls and outputs available on the home page.

#### Scenario: The application loads
- **WHEN** the user opens the phase-1 application
- **THEN** the home page exposes the full demo workflow without requiring route changes to other pages

### Requirement: Required workbench areas
The home page SHALL include a project title, source status, control area, primary subtitle workspace, and summary area.

#### Scenario: The user views the workbench
- **WHEN** the home page renders
- **THEN** all required workbench areas are visible within the single-page experience

### Requirement: Rolling paired subtitle display
The primary subtitle workspace SHALL display a rolling window of the most recent two paired subtitle segments.

#### Scenario: Two recent translated segments exist
- **WHEN** at least two translated segments are available
- **THEN** the workspace shows the newest two paired segments as the primary display

#### Scenario: A newer segment arrives
- **WHEN** a newly translated segment becomes the latest item
- **THEN** the oldest segment in the two-segment primary window is replaced in first-in, first-out order

### Requirement: Paired English-above-Chinese rendering
Each visible primary subtitle segment SHALL render the English source line above the Chinese translated line.

#### Scenario: A primary subtitle segment is displayed
- **WHEN** the workbench renders a visible subtitle segment
- **THEN** the segment presents English on top and Chinese below within the same paired block

### Requirement: Lightweight subtitle status cues
The UI SHALL distinguish `draft`, `final`, and `corrected` subtitle states through lightweight, readable visual cues.

#### Scenario: A segment is not finalized yet
- **WHEN** a visible segment is in draft state
- **THEN** the workbench indicates it as draft without overwhelming the reading experience

#### Scenario: A visible segment was corrected
- **WHEN** a visible segment is replaced after its English source changed
- **THEN** the workbench indicates the corrected state with a lightweight correction cue
