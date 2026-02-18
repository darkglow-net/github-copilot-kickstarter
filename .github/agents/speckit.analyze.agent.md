---
description: Perform a non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md for workspace-baseline template features.
name: SpecKit Analyze
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Goal

Identify inconsistencies, duplications, ambiguities, and underspecified items across the three core artifacts (`spec.md`, `plan.md`, `tasks.md`) before implementation. This command MUST run only after `/speckit.tasks` has successfully produced a complete `tasks.md`.

## Workspace Context

This is **workspace-baseline** — a template library of reusable GitHub Copilot MD files. Features here are typically new templates, structural reorganizations, or workflow improvements. Analysis should account for:
- Templates must be generic/portable (no hardcoded project references in root versions)
- Naming conventions must follow established patterns (see `copilot-instructions.md`)
- README.md sync is a mandatory deliverable for any catalog change
- ADRs are required for significant decisions
- No test runner exists — validation is structural (frontmatter, naming, cross-references)

## Operating Constraints

**STRICTLY READ-ONLY**: Do **not** modify any files. Output a structured analysis report. Offer an optional remediation plan (user must explicitly approve before any edits).

**Constitution Authority**: If `.specify/memory/constitution.md` exists and is populated, it is **non-negotiable**. Constitution conflicts are automatically CRITICAL. If no constitution is populated, skip constitution checks and note this in the report.

## Execution Steps

### 1. Initialize Analysis Context

Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` once from repo root and parse JSON for FEATURE_DIR and AVAILABLE_DOCS. Derive absolute paths:

- SPEC = FEATURE_DIR/spec.md
- PLAN = FEATURE_DIR/plan.md
- TASKS = FEATURE_DIR/tasks.md

Abort with an error message if any required file is missing.

### 2. Load Artifacts (Progressive Disclosure)

Load only the minimal necessary context from each artifact:

**From spec.md:**
- Overview/Context
- Functional Requirements
- Non-Functional Requirements
- User Stories
- Edge Cases (if present)

**From plan.md:**
- Architecture/stack choices
- Phases
- Technical constraints
- File paths and naming conventions

**From tasks.md:**
- Task IDs
- Descriptions
- Phase grouping
- Parallel markers [P]
- Referenced file paths

**From constitution** (if populated):
- Load `.specify/memory/constitution.md` for principle validation

### 3. Build Semantic Models

Create internal representations (do not output raw artifacts):

- **Requirements inventory**: Each functional + non-functional requirement with a stable key
- **Task coverage mapping**: Map each task to one or more requirements
- **Constitution rule set** (if available): Extract principle names and normative statements

### 4. Detection Passes

Focus on high-signal findings. Limit to 50 findings total.

#### A. Template Library-Specific Checks

- Tasks that create files — do they follow naming conventions?
- Tasks that modify root templates — do they also update `.github/` copies?
- Tasks that add/remove templates — is there a README.md update task?
- Tasks involving decisions — is there an ADR creation task?
- Frontmatter requirements specified for new template files?

#### B. Duplication Detection

- Near-duplicate requirements
- Mark lower-quality phrasing for consolidation

#### C. Ambiguity Detection

- Vague adjectives (fast, scalable, robust) lacking measurable criteria
- Unresolved placeholders (TODO, TKTK, ???, `<placeholder>`)

#### D. Underspecification

- Requirements with verbs but missing object or measurable outcome
- Tasks referencing files or components not defined in spec/plan

#### E. Constitution Alignment (if available)

- Any requirement or plan element conflicting with a MUST principle
- Missing mandated sections or quality gates

#### F. Coverage Gaps

- Requirements with zero associated tasks
- Tasks with no mapped requirement
- Non-functional requirements not reflected in tasks

#### G. Inconsistency

- Terminology drift across files
- Task ordering contradictions
- Conflicting requirements

### 5. Severity Assignment

- **CRITICAL**: Constitution violation, missing core artifact, requirement with zero coverage blocking baseline functionality
- **HIGH**: Duplicate/conflicting requirement, ambiguous quality attribute, missing README update task
- **MEDIUM**: Terminology drift, missing non-functional coverage, underspecified edge case
- **LOW**: Style/wording improvements, minor redundancy

### 6. Produce Analysis Report

Output a Markdown report (no file writes):

```markdown
## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| A1 | Template | HIGH | tasks.md:L45 | New instruction added without README update task | Add README.md sync task |

**Coverage Summary:**

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|

**Template Library Checks:**
- [ ] Naming conventions followed
- [ ] README sync task exists
- [ ] ADR task exists (if significant decision)
- [ ] Frontmatter requirements specified
- [ ] Root-first file creation order

**Constitution Alignment Issues:** (if applicable)

**Unmapped Tasks:** (if any)

**Metrics:**
- Total Requirements
- Total Tasks
- Coverage %
- Ambiguity Count
- Template Convention Violations
```

### 7. Next Actions

- If CRITICAL issues exist: Recommend resolving before `/speckit.implement`
- If only LOW/MEDIUM: User may proceed with noted improvements
- Provide explicit command suggestions

### 8. Offer Remediation

Ask: "Would you like me to suggest concrete remediation edits for the top N issues?" (Do NOT apply automatically.)

## Operating Principles

- **NEVER modify files** (read-only analysis)
- **NEVER hallucinate missing sections** (report accurately)
- **Prioritize template convention violations** (these are workspace-specific CRITICAL/HIGH)
- **Use examples over exhaustive rules** (cite specific instances)
- **Report zero issues gracefully** (emit success report with coverage statistics)
