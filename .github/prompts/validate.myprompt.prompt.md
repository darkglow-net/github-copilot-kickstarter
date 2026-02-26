---
name: validate.myprompt
description: 'Three-agent parallel review of a workspace template file against baseline authoring standards.'
agent: 'agent'
argument-hint: 'The prompt, agent, instruction, or skill file to validate'
---

# Validate Workspace Template

## Mission

You are the **coordinator**. Dispatch reviews to subagents, collect their findings, and synthesize.

Do not review the target file yourself. In degraded mode (one or more reviewers unavailable), you may only synthesize returned reviewer findings and must report reduced confidence.

Validate the specified template file (`.prompt.md`, `.agent.md`, `.instructions.md`, or `SKILL.md`) against this workspace's authoring standards, then synthesize findings into a single prioritized report.

## Inputs

- **Target file path**: `${input:targetFilePath:Path to template file}`
- **Optional additional paths**: `${input:additionalTargetPaths:Optional newline-separated template file paths}`

If multiple files are provided, validate each independently and produce one full report per file.

> This prompt requires subagent dispatch capability from the active chat mode. If unavailable, stop with: "Cannot proceed - subagent dispatch capability is unavailable in the active chat mode."

## Prerequisites

This prompt requires three specialist agents in the workspace:

- [`critical-thinking`](../agents/critical-thinking.agent.md)
- [`code-review`](../agents/code-review.agent.md)
- [`prompt-builder`](../agents/prompt-builder.agent.md)

Before Step 1:
- Verify subagent dispatch capability exists.
- Verify each agent file exists.

If any are missing, report them by name (e.g., "Missing agents: `critical-thinking`, `prompt-builder`").
If all three are missing, halt with: "Cannot proceed - all required reviewer agents are missing from the workspace."
If one or two are missing, continue with only available reviewers, keep coordinator in synthesis-only mode, and note reduced confidence in the final report.

## Scope & Standards

All reviewers should evaluate the target file against the workspace-baseline authoring standards:

- **Prompts** → frontmatter conventions, section flow (Mission → Inputs → Workflow → Output → QA), tool/agent declarations per `prompt.instructions.md`
- **Agents** → required frontmatter (`description`, `name`), Hard Rules compliance, no cross-agent calls per `agents.instructions.md`
- **Instructions** → required frontmatter (`description`, `applyTo`), technology-appropriate examples per `instructions.instructions.md`
- **Skills** → `SKILL.md` format, bundled resources, trigger descriptions per `agent-skills.instructions.md`

Cross-cutting rules from `copilot-instructions.md`:
- No project-specific references in root templates (root is authoritative, `.github/` is consumer)
- MCP tool references must use correct tool names and parameter patterns
- Externally sourced files must be sanitized of project-specific contamination

## Workflow

### Step 1 — Read Target

Resolve target files from `${input:targetFilePath}` plus optional `${input:additionalTargetPaths}`.

For each file:
1. Read the entire target file.
2. Determine template type using this logic:
   - Basename `SKILL.md` -> Skill template.
   - Suffix `.prompt.md` -> Prompt template.
   - Suffix `.agent.md` -> Agent template.
   - Suffix `.instructions.md` -> Instruction template.
3. If file is missing or empty, report error for that file and skip synthesis for that file.
4. If type is unsupported, report: "Unsupported template type. Supported: `.prompt.md`, `.agent.md`, `.instructions.md`, `SKILL.md`." and skip that file.

### Step 2 — Dispatch Parallel Reviews

For each valid target file, dispatch to available reviewers **in parallel**.

Dispatch policy:
- If all three are available, dispatch all three.
- If one or two are missing/unavailable, dispatch only available reviewers and record reviewer gaps.
- Never perform direct coordinator review to replace missing reviewers.

Payload policy:
- If file is <= 400 lines, pass full file content.
- If file is > 400 lines, pass chunked content that covers the full file with line-range labels.

Execution reliability policy:
- Set per-reviewer timeout to 120 seconds.
- Retry each failed reviewer once.
- If still failed, mark that reviewer as failed and continue synthesis with available results.

Use this focused review brief:

| Subagent | Agent reference | Review focus |
|----------|-----------------|--------------|
| Critical Thinking | `critical-thinking` | Challenge assumptions, surface internal contradictions, identify conflicting instructions, flag unstated dependencies, verify claims match workspace conventions |
| Code Review | `code-review` | Evaluate structural quality: frontmatter completeness, section consistency, error handling, edge cases, adherence to the matching authoring standard (see Scope above) |
| Prompt Builder | `prompt-builder` | Assess prompt engineering effectiveness: clarity of intent, constraint specificity, determinism of instructions, whether the template reliably produces the desired behavior from its target audience |

Each subagent must return findings as a **numbered list** (max 15 per reviewer). Per finding include: category, severity, one-line description, affected section or line reference.

Line-reference format requirement:
- Prefer `path:line`.
- If exact line is unavailable, use explicit section heading text.

If a subagent fails or returns no findings, note the gap in the final report and synthesize from the remaining results.

### Step 3 — Synthesize Unified Report

For each file, after reviewer execution completes:

1. **Deduplicate** overlapping findings — two findings are duplicates when they describe the same issue in the same section, even if worded differently
2. **Categorize** each finding using one of: `CONFLICT`, `GAP`, `AMBIGUITY`, `OMISSION` (a known best practice or convention the file does not follow), `IMPROVEMENT`
3. **Assign severity** with action guidance:
   - **Critical** — blocks correct use; must fix before using the template
   - **High** — significant quality risk; fix before adding to the catalog
   - **Medium** — improvement opportunity; address when convenient
   - **Low** — minor polish; optional
4. **Sort** by severity descending

Disagreement resolution:
- If reviewers disagree on severity for the same finding, use the higher severity.
- If reviewers disagree on category for the same finding, use this precedence: `CONFLICT` > `GAP` > `AMBIGUITY` > `OMISSION` > `IMPROVEMENT`.

## Output Expectations

For each file, present a unified report as a Markdown table with these columns:

| # | Category | Severity | Description | Affected Section | Suggested Fix | Source |
|---|----------|----------|-------------|------------------|---------------|--------|
| 1 | OMISSION | High | Missing `applyTo` in frontmatter | Frontmatter | Add `applyTo: '**/*.ts'` matching target files | CR |

- **Source** identifies which reviewer(s) raised the finding (use initials: CT, CR, PB)
- End each file report with:
   - **Summary count** by severity
   - **Recommended implementation order** (group related fixes, then order by dependency chain and severity)
   - **Dedup ledger**: pre-dedup finding count, final finding count, number removed, and removal reasons
   - **Reviewer coverage**: available, missing, failed, and no-findings reviewers
   - **Confidence**: `Normal` (3 reviewers) or `Reduced` (fewer than 3 reviewers)

## Quality Assurance

- Verify every finding references a specific section or line in the target file — scan the report for any row with an empty "Affected Section" cell
- Confirm no reviewer's findings were silently dropped during deduplication — compare the sum of pre-dedup findings to the final count and account for each removal
- If two reviewers disagree on severity or category for the same finding, apply Step 3 tie-break rules and note disagreement in the "Source" column
