# Collaboration Rules

This repository follows a small-PR workflow for feature delivery and review.

## Pull Request Rules

- Each PR MUST implement or modify exactly one feature or one tightly scoped improvement.
- Large features MUST be split into multiple independent PRs delivered step by step.
- PRs SHOULD stay as small as practical to keep review and rollback simple.
- The default bar for merging is that the main branch remains runnable and demoable after the PR lands.

## Required PR Structure

Every PR description MUST contain these sections:

1. `标题`
   One sentence describing what the PR adds or changes.
2. `功能描述`
   Explain what the feature does and how it is used.
3. `实现思路`
   Summarize the technical approach or core implementation logic.
4. `测试方式`
   Explain how the change was verified.

The repository PR template mirrors this structure and should be used for every PR.

## Review Expectations

- Reviewers should reject PRs that bundle unrelated features together.
- Reviewers should ask for PR splitting when a change is too large to review safely.
- Reviewers should verify that the documented test steps are sufficient to reproduce the demonstrated behavior.

## Current Project Focus

Until phase 1 is complete, prioritize changes that improve the caption translation workbench demo path:

- mock transcript playback
- subtitle translation
- correction handling
- summary generation

Defer unrelated infrastructure or speculative architecture work unless it is required to keep the main branch runnable.
