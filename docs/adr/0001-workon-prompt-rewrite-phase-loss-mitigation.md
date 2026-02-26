---
title: "ADR-0001: Workon Prompt Rewrite — Phase Loss Mitigation"
status: "Accepted"
date: "2026-02-18"
authors: "darkglow-net (workspace owner)"
tags: ["prompts", "orchestration", "phase-loss", "workon"]
supersedes: ""
superseded_by: ""
---

## Status

Accepted

## Context

The `workon.myspec.prompt.md` and `workon.myidea.prompt.md` orchestration prompts coordinate multi-phase development workflows using subagent delegation. Both suffered from a recurring failure: **later phases (code review, validation, documentation) were consistently lost** as the coordinator's todo list was overwritten during implementation iterations.

Root cause analysis identified 12 failure modes:

| Severity | Issues |
| -------- | ------ |
| **Critical** | Phase loss via todo overwrites; `manage_todo_list` full-replacement semantics erase non-repeated items |
| **High** | Branch conflict (coordinator vs speckit.specify both creating branches); infinite review loops; REJECTED routing back to planning instead of implementation |
| **Medium** | Portability (hardcoded project references); thin later phases (3-line validate/document steps easily skipped) |
| **Low** | Missing context anchors in delegation; no persistent progress tracking |

## Decision

Rewrite both prompts with the following mitigations:

### 1. Phase Transition Protocol

Every phase change requires reading and updating a progress tracker before proceeding. For `workon.myspec`, this is a persistent `PROGRESS.md` file in the spec directory. For `workon.myidea`, this is a reinforced todo list with self-check instructions.

### 2. Fixed Todo List Structure

Todo items for later phases are given explicit IDs and a self-check instruction: *"Verify IDs for Validate and Document phases still exist before every phase transition."* This prevents silent erasure.

### 3. Review Loop Cap

Code review is capped at 2 fix-and-re-review iterations. A third rejection HALTs the workflow and escalates to the user, preventing infinite loops.

### 4. REJECTED Routing Fix

In `workon.myidea`, a REJECTED code review now routes back to Phase 3 (Implement fixes) instead of Phase 2 (Plan), since code quality issues don't invalidate the plan.

### 5. Branch Ownership

Branch creation is removed from the coordinator prompt. The `speckit.specify` agent owns branching via its dedicated scripts, eliminating a conflict where both tried to create branches.

### 6. Expanded Later Phases

Phase 6 (Validate) expanded from 3 lines to a multi-step checklist with a structured report template. Phase 7 (Document) similarly expanded with specific update targets (README, ADR, architecture docs, development notes).

### 7. Two-Tier Portability

Root `prompts/` versions use a Configuration section with placeholder tables and HTML comment markers for project-specific customization. `.github/prompts/` versions are tailored specifically to this workspace (template library with structural validation, no test runner).

### 8. Context Anchor in Delegation

Phase 4 delegation to the implement agent now includes an explicit statement that the agent does not own phases beyond implementation, preventing subagent scope creep.

## Consequences

### Positive

- Phase loss is structurally prevented by persistent tracking and self-check instructions
- Review loops are bounded, preventing runaway iterations
- Root templates are portable to any project via Configuration placeholders
- Workspace-tailored versions leverage this project's specific validation (frontmatter, naming, README sync)
- Branch creation conflict eliminated

### Negative

- Prompts are significantly longer (workon.myspec: 201 → 364 lines baseline, 425 tailored; workon.myidea: 130 → 199 baseline, 256 tailored)
- PROGRESS.md adds a file artifact per spec feature that must be cleaned up
- The 2-iteration review cap may occasionally require manual intervention for legitimately complex fixes

### Risks

- The self-check instruction relies on LLM compliance — a sufficiently distracted model may still skip it
- PROGRESS.md could drift from actual state if a session crashes mid-phase

## Files Changed

| File | Change |
| ---- | ------ |
| `prompts/workon.myspec.prompt.md` | Rewritten as portable template (364 lines) |
| `prompts/workon.myidea.prompt.md` | Rewritten as portable template (199 lines) |
| `.github/prompts/workon.myspec.prompt.md` | Rewritten as workspace-tailored version (425 lines) |
| `.github/prompts/workon.myidea.prompt.md` | Rewritten as workspace-tailored version (256 lines) |
