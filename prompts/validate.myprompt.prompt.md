---
name: validate.myprompt
description: 'Three-agent parallel review of a workspace template file against baseline authoring standards.'
agent: 'agent'
argument-hint: 'One or more template file paths to validate'
---

# Validate Workspace Template

## Mission

You are the **coordinator**. Dispatch reviews to subagents, collect their findings, and synthesize.

Do not review the target file yourself. In degraded mode (one or more reviewers unavailable), you may only synthesize returned reviewer findings and must report reduced confidence.

Validate the specified template file (`.prompt.md`, `.agent.md`, `.instructions.md`, or `SKILL.md`) against this workspace's authoring standards, then synthesize findings into a single prioritized report.

## Inputs

- **Target file path**: `${input:targetFilePath:Path to template file}`
- **Optional additional paths**: `${input:additionalTargetPaths:Optional newline-separated template file paths}`

If multiple files are provided, validate each independently and produce one full report per file. Treat blank or whitespace-only additional paths as omitted.

> This prompt requires subagent dispatch capability from the active chat mode. If unavailable, stop with: "Cannot proceed - subagent dispatch capability is unavailable in the active chat mode."

## Scope and Standards

This prompt requires three specialist agents in the workspace:

- `critical-thinking` — challenge assumptions, surface contradictions
- `code-review` — structural quality and standards compliance
- `prompt-builder` — prompt engineering effectiveness

> **Portability note**: Agent paths are relative (`../agents/`). Adjust if your workspace uses a different layout.

Before starting the workflow:
- Verify each agent file exists.
- If any are missing, report them by name.
- If all three are missing, halt with: "Cannot proceed - all required reviewer agents are missing."
- If one or two are missing, continue with available reviewers and note reduced confidence.

All subagent reviewers should evaluate the target file against the workspace's authoring standards (or equivalent):

- **Prompts** -> frontmatter conventions, section flow, tool/agent declarations per `prompt.instructions.md` or equivalent
- **Agents** -> required frontmatter (`description`, `name`), no cross-agent calls per `agents.instructions.md` or equivalent
- **Instructions** -> required frontmatter (`description`, `applyTo`), technology-appropriate examples per `instructions.instructions.md` or equivalent
- **Skills** -> `SKILL.md` format, bundled resources, trigger descriptions per `agent-skills.instructions.md` or equivalent

Cross-cutting rules (from `copilot-instructions.md` or equivalent workspace config):
- No project-specific references in root templates
- MCP tool references must use correct tool names and parameter patterns
- Externally sourced files must be sanitized of project-specific contamination

## Workflow

### Step 1 - Read Target

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

### Step 2 - Dispatch Parallel Reviews

For each valid target file, dispatch to available reviewers **in parallel**.

- Dispatch all available reviewers. Never perform a coordinator review to replace a missing reviewer.
- Pass full file content to each reviewer along with the Scope and Standards context and the expected return format below.
- If a reviewer fails or returns no findings, note the gap and continue with remaining results.

Review brief per subagent:

| Subagent | Agent reference | Review focus |
|----------|-----------------|--------------|
| Critical Thinking | `critical-thinking` | Challenge assumptions, surface contradictions, flag unstated dependencies, verify claims match workspace conventions |
| Code Review | `code-review` | Structural quality: frontmatter completeness, section consistency, error handling, adherence to the matching authoring standard (see Scope) |
| Prompt Builder | `prompt-builder` | Prompt engineering effectiveness: clarity of intent, constraint specificity, determinism, whether the template reliably produces desired behavior |

Each subagent must return findings as a **numbered list** (max 15). Per finding include: category, severity, one-line description, affected section or line reference. If no issues found, return: "No findings."

### Step 3 - Synthesize Unified Report

For each file, after reviewer execution completes:

1. **Deduplicate** overlapping findings - same section + same actionable fix = duplicate, even if worded differently
2. **Categorize** each finding using one of: `CONFLICT`, `GAP`, `AMBIGUITY`, `OMISSION`, `IMPROVEMENT`
3. **Assign severity** with action guidance:
   - **Critical** - blocks correct use; must fix before using the template
   - **High** - significant quality risk; fix before adding to the catalog
   - **Medium** - improvement opportunity; address when convenient
   - **Low** - minor polish; optional
4. **Sort** by severity descending

Disagreement resolution:
- Severity: use the higher severity.
- Category: use this precedence (most specific first): `CONFLICT` > `GAP` > `AMBIGUITY` > `OMISSION` > `IMPROVEMENT`.
- Note disagreements in the Source column (e.g., `CT↑CR` = CT's higher severity adopted).

## Output Expectations

For each file, present a unified report as a Markdown table with these columns:

| # | Category | Severity | Description | Affected Section | Suggested Fix | Source |
|---|----------|----------|-------------|------------------|---------------|--------|
| 1 | OMISSION | High | Missing `applyTo` in frontmatter | Frontmatter | Add `applyTo` matching target files | CR |

- **Source** identifies which reviewer(s) raised the finding (use initials: CT, CR, PB)
- End each file report with:
  - **Summary count** by severity
  - **Recommended implementation order** (group related fixes, then order by dependency chain and severity)
  - **Dedup ledger**: pre-dedup finding count, final finding count, number removed, and removal reasons
  - **Reviewer coverage**: available, missing, failed, and no-findings reviewers
  - **Confidence**: `Normal` (3 reviewers) or `Reduced` (fewer than 3 reviewers)

## Quality Assurance

- Every finding must reference a specific section or line in the target file.
- No reviewer's findings should be silently dropped — account for all removals in the dedup ledger.
- Apply Step 3 tie-break rules when reviewers disagree on severity or category.
