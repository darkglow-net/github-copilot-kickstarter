---
agent: "agent"
description: "Structured workflow for bug fixes, small features, and refactors. Routes large features to workon.myspec.prompt.md."
---

## Objective

[State what you want to accomplish in 1-2 sentences]

---

## Project Configuration

Customize this section for your workspace.

### Test & Validation

| Action | Command | Notes |
|--------|---------|-------|
| Run tests | `<test-command>` | Replace with your test runner (e.g., `npm test`, `pytest`, `Invoke-Build Test`, `dotnet test`) |
| Check errors | `get_errors` tool | Built-in Copilot tool — works in all workspaces |

### MCP Tools (use when available, skip when not)

| Need | Tool | Fallback if unavailable |
|------|------|-------------------------|
| Microsoft/.NET docs | `mcp_microsoftdocs_microsoft_docs_search` | Web search or training data |
| Library/framework docs | `mcp_context7_resolve-library-id` → `get-library-docs` | Web search |
| Current versions/APIs | `mcp_brave-search_brave_web_search` | Note uncertainty to user |

> **Rule**: Never guess API signatures or version numbers. Use MCP tools or explicitly note uncertainty.

---

## Phase 0: Work Classification

**Determine if request qualifies for specification-driven workflow.**

### Qualification Criteria (Feature Qualifies for Spec if ANY):

- New capability requiring database schema changes
- New capability requiring new UI components
- Requires architecture decisions (new modules, cross-layer changes)
- 4+ files to modify (routine 2-3 file changes stay here)

### Decision Point

**If YES (spec-worthy)**:
1. Check specs directory for existing specification using `file_search`
2. If spec exists: Note spec number, proceed to Phase 1 (use spec as contract)
3. If NO spec exists: **HAND OFF TO USER**:
   - Report: "This work requires specification-driven workflow"
   - Instruct: "Please reinvoke with `workon.myspec.prompt.md` to create specification"
   - **EXIT this prompt** (user chooses spec workflow)

**If NO (non-spec work)**:
- Document justification for skipping spec
- Initialize progress tracking with ALL 6 phases (see template below)
- Continue to Phase 1 (Research & Context)

---

## Todo List Management

**CRITICAL**: `manage_todo_list` replaces the entire list on every call. This is the primary cause of phase loss.

### Rules

1. Every update MUST include ALL 6 phases (IDs 1-6) — no exceptions
2. Dynamic fix tasks use IDs 100+ (inserted between ID 4 and ID 5)
3. **NEVER** omit not-started phases — even when adding dynamic tasks
4. **Self-check**: Before every `manage_todo_list` call, verify: "Are IDs 5 and 6 present in my update?"

### Template (always include all 6):

```javascript
{ id: 1, title: "Phase 1: Research & Context", status: "..." },
{ id: 2, title: "Phase 2: Plan & Track", status: "..." },
{ id: 3, title: "Phase 3: Implement", status: "..." },
{ id: 4, title: "Phase 4: Code Review", status: "..." },
// Dynamic fix tasks (id 100+) inserted here when needed
{ id: 5, title: "Phase 5: Validate", status: "..." },
{ id: 6, title: "Phase 6: Document", status: "..." }
```

❌ **NEVER** write a list missing IDs 5-6 (Validate and Document)
✅ **VERIFY** before every `manage_todo_list` call: "Do IDs 5 and 6 exist in my update?"

### Phase Transition Check

Before moving to the next phase:
1. Verify IDs 5 and 6 exist in the current todo list
2. Mark current phase completed
3. Mark next phase in-progress
4. Report to user: "Phase X complete → Phase Y. Remaining: [list remaining phases]"

---

## Phase 1: Research & Context

**This phase is MANDATORY.** Research before implementing.

- **Classify**: What kind of change is this? (bug fix, small feature, refactor)
- **Scope**: Identify affected files/modules via `grep_search` or `semantic_search`
- **Research**: Read existing patterns in affected modules
- **Use subagent for research** when 3+ files need reading (docs consume context)
- **MCP tools**: Use tools from Configuration section when external knowledge is needed. Skip tools that are not configured — do not halt on missing MCP tools.
- **Clarify ambiguities**: For 2+ valid interpretations, ask ONE question with researched options

## Phase 2: Plan & Track

- Use `manage_todo_list` to add discrete implementation tasks (IDs 100+)
- **Test-first**: Plan test cases before implementation
- Identify which files/functions to modify
- For complex work: Plan subagent delegation (research → implementation → review)
- ⚠️ When adding implementation tasks, include ALL 6 phases (IDs 1-6) in the update

## Phase 3: Implement

- Write tests FIRST (Red phase), then implementation (Green phase)
- Mark implementation tasks (IDs 100+) complete as you progress
- **Verify file writes**: If subagent returns no output, confirm file exists before retrying
- ⚠️ **Before marking Phase 3 complete**: Run Phase Transition Check. Verify IDs 5-6 still exist.

## Phase 4: Code Review

**Pre-review error check**: Run `get_errors` on all modified files BEFORE delegating. Include any findings in the delegation prompt — the review agent cannot access IDE diagnostics and is blind to compile/lint errors unless you pass them.

**Delegate to Code Review Agent**: Fresh-context validation.

**Attempts tracked**: Maximum 2 review iterations before escalation.

**Agent returns**:

| Verdict | Action |
|---------|--------|
| **APPROVED** (0 critical/high) | Proceed to Phase 5 |
| **CONDITIONAL** (1-3 issues) | User decides: accept or revise |
| **REJECTED** (4+ issues) | See rejection handling below |

### Rejection Handling

1. Increment review attempt counter
2. **If attempt ≤ 2**: Insert fix tasks (IDs 100+). **PRESERVE IDs 5-6**. Return to Phase 3 with fix tasks only.
3. **If attempt > 2**: **HALT and escalate to user** with full analysis across all attempts.

### Todo List Update After Rejection

The updated list MUST include:
- IDs 1-4 (existing phases, with 3 reset to in-progress)
- IDs 100+ (new fix tasks)
- IDs 5-6 (Validate and Document — **NEVER** remove these)

⚠️ Verify IDs 5 and 6 are present before submitting the update.

## Phase 5: Validate

**This phase is MANDATORY** — do not skip, do not merge with Phase 4.

1. **Run tests**: Execute the test command from Configuration section
   - If tests fail: report failures with details. User decides next step.
2. **Check errors**: Run `get_errors` on all modified files
   - Report any remaining lint/compile errors with file paths
3. **Task audit**: Confirm all implementation tasks (IDs 100+) marked complete
4. **Report**: Test results, error count, tasks complete, overall pass/fail

## Phase 6: Document

**This phase is MANDATORY** — do not skip, even for "small" changes.

1. **Code docs**: If public APIs changed, update inline documentation
2. **Project docs**: If user-visible behavior changed, update project documentation
3. **Architecture docs**: If architectural patterns changed, update relevant docs
4. **Confirm**: List all docs updated (or state "no doc changes needed" with justification)

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Subagent no output | Verify file(s) exist before retry |
| Test failures in Phase 3 | Normal TDD — fix in GREEN step |
| Review REJECTED (attempt ≤ 2) | Insert fix tasks (IDs 100+), **PRESERVE IDs 5-6**, return to Phase 3 |
| Review REJECTED (attempt > 2) | **HALT** — escalate to user with full analysis |
| Todo list update | **ALWAYS** include ALL phases (IDs 1-6) plus dynamic tasks (100+) |

---

## Rules

- ✅ Research before implementing: internal docs → official docs → vendor docs
- ✅ YAGNI: Implement only what's specified — no speculative features
- ✅ Use MCP tools for current versions when available (training data may be outdated)
- ✅ Test-first development: Write tests before implementation
- ✅ Delegate to Code Review Agent after implementation (Phase 4)
- ✅ Run Phase Transition Check before every phase change
- ✅ Verify IDs 5-6 exist before every todo list update
- ❌ NEVER skip Phase 5 (Validate) or Phase 6 (Document)
- ❌ NEVER write a todo list update without IDs 5-6
- ❌ NEVER return to Phase 2 on review rejection — return to Phase 3 only
