---
name: validate.myprompt
description: 'Dispatch three parallel specialist reviews of a prompt file then synthesize findings into a prioritized action plan.'
agent: 'agent'
argument-hint: 'The prompt or agent file to validate'
---

# Multi-Agent Prompt Validation

You are the **coordinator**. Dispatch reviews to subagents, collect their findings, and synthesize — do not review the target file yourself.

Validate the specified prompt or agent file by dispatching three parallel specialist reviews and synthesizing their findings into a single prioritized report.

## Inputs

- **Target file**: The prompt (`.prompt.md`) or agent (`.agent.md`) file provided by the user. Read its full contents before dispatching reviews. If multiple files are provided, validate each independently.

> This prompt relies on subagent dispatch capability inherited from the active chat mode.

## Prerequisites

This prompt requires three specialist agents in the workspace:

- [`critical-thinking`](../agents/critical-thinking.agent.md)
- [`code-review`](../agents/code-review.agent.md)
- [`prompt-builder`](../agents/prompt-builder.agent.md)

Before Step 1, verify each agent file exists. If any are missing, report them by name (e.g., "Missing agents: `critical-thinking`, `prompt-builder`"). If all three are missing, halt with: "Cannot proceed — all required reviewer agents are missing from the workspace." If one or two are missing, continue with the available reviewers and note the gaps in the final report.

## Workflow

### Step 1 — Read Target

Read the entire target file. If the file cannot be found or is empty, report the error and stop.

### Step 2 — Dispatch Parallel Reviews

Delegate to all three reviewers **in parallel**. Pass the full target file contents to each subagent with a focused review brief:

| Subagent | Agent reference | Review focus |
|----------|-----------------|--------------|
| Critical Thinking | [`critical-thinking`](../agents/critical-thinking.agent.md) | Challenge assumptions, surface internal contradictions, identify ambiguous or conflicting instructions, flag unstated dependencies |
| Code Review | [`code-review`](../agents/code-review.agent.md) | Evaluate structural quality: consistency, completeness, error handling, edge cases, adherence to the file's own stated conventions |
| Prompt Builder | [`prompt-builder`](../agents/prompt-builder.agent.md) | Assess prompt engineering effectiveness: clarity of intent, constraint specificity, determinism of instructions, whether the prompt reliably produces the desired behavior from its target audience |

Each subagent must return findings as a **numbered list** (max 15 per reviewer). Per finding include: category, severity, one-line description, affected section or line reference.

If a subagent fails or returns no findings, note the gap in the final report and synthesize from the remaining results.

### Step 3 — Synthesize Unified Report

After all three reviews complete:

1. **Deduplicate** overlapping findings — two findings are duplicates when they describe the same issue in the same section, even if worded differently
2. **Categorize** each finding using one of: `CONFLICT`, `GAP`, `AMBIGUITY`, `OMISSION` (a known best practice or convention the file does not follow), `IMPROVEMENT`
3. **Assign severity** with action guidance:
   - **Critical** — blocks correct use; must fix before using the prompt
   - **High** — significant quality risk; fix before production use
   - **Medium** — improvement opportunity; address when convenient
   - **Low** — minor polish; optional
4. **Sort** by severity descending

## Output Expectations

Present the unified report as a Markdown table with these columns:

| # | Category | Severity | Description | Affected Section | Suggested Fix | Source |
|---|----------|----------|-------------|------------------|---------------|--------|
| 1 | GAP | High | No error handling for subagent failures | Step 2 | Add fallback when a reviewer returns nothing | CT, CR |

- **Source** identifies which reviewer(s) raised the finding (use initials: CT, CR, PB)
- End with a **summary count** by severity and a **recommended implementation order** — group related fixes, then order by dependency chain and severity

## Quality Assurance

- Verify every finding references a specific section or line in the target file — scan the report for any row with an empty "Affected Section" cell
- Confirm no reviewer's findings were silently dropped during deduplication — compare the sum of pre-dedup findings to the final count and account for each removal
- If two reviewers disagree on severity for the same finding, use the higher severity and note the disagreement in the "Source" column
