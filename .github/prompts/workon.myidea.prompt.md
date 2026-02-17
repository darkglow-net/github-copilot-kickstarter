---
agent: "agent"
description: "Structured workflow for bug fixes, small features, and refactors. Routes large features to workon.spec.prompt.md."
---
## Objective
[State what you want to accomplish in 1-2 sentences]

## Phase 0: Work Classification

**Determine if request qualifies for specification-driven workflow.**

### Qualification Criteria (Feature Qualifies for Spec if ANY):
- New capability requiring database schema changes
- New capability requiring new UI components
- Requires architecture decisions (new modules, cross-layer changes)
- 4+ files to modify (routine 2-3 file changes stay here)

### Decision Point

**If YES (spec-worthy)**:
1. Check `specs/` directory for existing specification using `file_search`
2. If spec exists: Note spec number, proceed to Phase 1 (use spec as contract)
3. If NO spec exists: **HAND OFF TO USER**:
   - Report: "This work requires specification-driven workflow"
   - Instruct: "Please reinvoke with `workon.spec.prompt.md` to create specification"
   - **EXIT this prompt** (user chooses spec workflow)

**If NO (non-spec work)**:
- Document justification for skipping spec
- Initialize progress tracking: `manage_todo_list({ operation: "write", todoList: [...tasks] })`
- Continue to Phase 1 (Research & Context)

**Rationale**: Specification-driven work requires different workflow (SpecKit orchestration) than ad-hoc changes.

---

## Todo List Management Rules

**CRITICAL**: `manage_todo_list` only supports full replacement. Every write MUST include ALL phases.

**Rules**:
1. Every update includes phases 1-6 (ids 1-6)
2. Dynamic tasks use ids 100+ (inserted before remaining phases)
3. Never omit not-started phases

**Template** (always include all 6 phases):
```javascript
{ id: 1, title: "Phase 1: Research & Context", status: "..." },
{ id: 2, title: "Phase 2: Plan & Track", status: "..." },
{ id: 3, title: "Phase 3: Implement", status: "..." },
{ id: 4, title: "Phase 4: Code Review", status: "..." },
// Dynamic tasks (id 100+) inserted here when needed
{ id: 5, title: "Phase 5: Validate", status: "..." },
{ id: 6, title: "Phase 6: Document", status: "..." }
```

❌ **NEVER** write a list missing phases 5-6

---

## Phase 1: Research & Context

**This phase is MANDATORY.** Execute the Pre-Work Checklist from `copilot-instructions.md` (CLASSIFY → SCOPE → RESEARCH) before proceeding.

- **Use subagent for research** when 3+ files need reading (docs consume context)
- Research hierarchy: Internal docs → official docs → vendor docs
- Read `docs/NAVIGATION-GUIDE.md` → route to relevant architecture/patterns
- **MCP tools are MANDATORY when external knowledge is needed** (see copilot-instructions.md)
- **Clarify ambiguities**: For 2+ valid interpretations, ask ONE question with researched options

## Phase 2: Plan & Track
- Use `manage_todo_list` to break work into discrete tasks
- **Test-first**: Plan test cases before implementation
- Identify which files/functions to modify
- For complex work: Plan subagent delegation (research → implementation → review)

## Phase 3: Implement
- Write tests FIRST (Red phase), then implementation (Green phase)
- Use subagents per thresholds in copilot-instructions.md
- Mark tasks complete in todo list as you progress
- **Verify file writes**: If subagent returns no output, confirm file exists before retrying

## Phase 4: Code Review (Agent Delegation)
- **Delegate to Code Review Agent** (.github/agents/code-review.agent.md): Fresh context validation
- Agent validates: Constitutional compliance (Principles I-XIII), code quality, pattern compliance, test coverage
- **Agent returns**:
  * APPROVED (0 critical/high issues): Proceed to Phase 5
  * CONDITIONAL (1-3 issues): User decides accept/revise
  * REJECTED (4+ issues): Return to Phase 2 with analysis
- **Multiple failures (3+ iterations)**: Escalate to user with remediation options

### Todo List Update

Apply **Todo List Management Rules** (above). Insert fix tasks (ids 100+) before Phase 5-6. Never omit remaining phases.

## Phase 5: Validate
- Run tests: `Invoke-Build Test` (NEVER use `-Output Detailed`)
- Check errors: Use `get_errors` to validate changes
- Confirm all todo tasks marked complete

## Phase 6: Document
- Update relevant docs in `docs/` to match code changes (single source of truth)
- Reference best-practice doc line numbers, NOT code block line numbers
- Follow project documentation standards (breadcrumbs, cross-references)

## Error Handling

| Scenario | Action |
|----------|--------|
| Subagent no output | Verify file(s) exists before retry |
| Test failures | Normal TDD - fix in GREEN step |
| Review REJECTED | Insert fix tasks (IDs 100+), PRESERVE Phase 5-6, return to fixing |
| 3+ review failures | Escalate to user |
| Todo list update | ALWAYS include ALL phases (1-6) plus any dynamic tasks (100+) |

---

## Rules
- ✅ Use imperative language in prompts (MUST, WILL, NEVER)
- ✅ Research before implementing: Internal docs → official docs → vendor docs
- ✅ YAGNI: Implement only what's specified - no speculative features
- ✅ PowerShell is object-oriented: Verify return types
- ✅ Use MCP tools for current versions (LLM knowledge is outdated)
- ✅ Test-first development: Write tests before implementation
- ✅ Check specs/ before implementing features (Principle IX)
- ✅ Delegate to Code Review Agent after implementation (Phase 4)
- ✅ Use search tools for discovery, read_file for verification
- ✅ Follow subagent thresholds (see copilot-instructions.md)
- ❌ NEVER add backwards compatibility (project is pre-1.0 alpha)
- ❌ NEVER skip Code Review phase for multi-file changes