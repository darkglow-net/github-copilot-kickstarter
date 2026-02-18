# Workon Prompt Phase Loss — Lessons Learned

## Context

The `workon.spec` and `workon.myidea` orchestration prompts coordinate multi-phase development workflows through subagent delegation. After repeated use, a pattern emerged: **later phases (code review, validation, documentation) were consistently lost** during implementation iterations.

This document captures the failure analysis and mitigation strategies applied in the February 2026 rewrite.

## The Problem

The `manage_todo_list` tool has **full-replacement semantics** — every call must include ALL items, not just changes. When the implementation phase generates many tasks and the coordinator rebuilds its todo list, items for later phases (review, validate, document) are omitted because they aren't top-of-mind during implementation work.

This creates a cascade:

1. Coordinator delegates to implement agent with a full todo list
2. Implement agent creates its own sub-tasks, filling the todo list with implementation items
3. When control returns, the coordinator rebuilds its todo list from memory — but phases 5-7 are forgotten
4. The workflow ends after implementation, skipping review, validation, and documentation

## What We Tried

### Approach 1: Stronger Phase Descriptions (Failed)

Adding more detail to phase 5-7 descriptions didn't help. The problem isn't that the LLM doesn't understand the phases — it's that todo list reconstruction from memory is lossy.

### Approach 2: Persistent Progress Tracking (Worked)

For `workon.spec`, we added a `PROGRESS.md` file in the spec directory that persists phase status to disk. Before every phase transition, the coordinator must read, verify, and update this file. This survived session boundaries and implementation context overload.

### Approach 3: Self-Check Instructions (Worked)

Adding an explicit instruction — *"Before updating the todo list, verify that IDs for Validate and Document phases still exist"* — significantly reduced phase loss. The LLM follows explicit procedural checks more reliably than implicit expectations.

### Approach 4: Context Anchor in Delegation (Worked)

When delegating to the implement agent, the coordinator now states: *"You do not own phases beyond implementation."* This prevents the subagent from assuming it should handle everything, and makes the return boundary clear.

## Key Findings

1. **Full-replacement APIs are hostile to multi-phase workflows.** Any tool that requires repeating all state on every call will lose items under cognitive load. Mitigation: persist state externally (file or repeated self-check).

2. **Phase expansion prevents skipping.** The original prompts had 3-line descriptions for validate and document phases. These were easily treated as optional. Expanding them to multi-step checklists with report templates made them structurally equivalent to implementation — too substantial to skip.

3. **Review loops need caps.** Without a maximum iteration count, "fix and re-review" can loop indefinitely. Capping at 2 iterations with escalation on the 3rd prevents this while still allowing genuine fixes.

4. **REJECTED routing matters.** When code review rejects, routing back to "Plan" (Phase 2) wastes effort — the plan is usually fine, the code just needs fixes. Routing to "Implement fixes" (Phase 3) is more appropriate.

5. **Branch ownership must be singular.** When both the coordinator prompt and a subagent (speckit.specify) try to create branches, conflicts arise. Assign ownership to exactly one — the specialized agent with scripts for it.

6. **Two-tier templates work well.** Root versions stay portable with Configuration placeholder tables. Workspace-tailored versions in `.github/` substitute specific values. This mirrors how the entire workspace-baseline library is designed to work.

## Patterns for Future Prompt Design

- **Persistent checkpoints** — For workflows with 5+ phases, write phase status to a file, not just to the todo list
- **Self-check before transition** — Add explicit instructions to verify remaining phases exist before every transition
- **Bounded loops** — Any retry mechanism needs a maximum count and an escalation path
- **Explicit scope boundaries** — When delegating, tell the subagent what it does NOT own
- **Weight balance** — Later phases should be roughly as detailed as earlier phases to prevent skipping bias

## Related

- [ADR-0001: Workon Prompt Rewrite](../adr/0001-workon-prompt-rewrite-phase-loss-mitigation.md)
- [workon.spec prompt](../../prompts/workon.spec.prompt.md) (root template)
- [workon.myidea prompt](../../prompts/workon.myidea.prompt.md) (root template)
