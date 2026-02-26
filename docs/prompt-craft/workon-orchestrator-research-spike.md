# Research Spike: Orchestrator Prompt Patterns & Spec-Driven Development Frameworks

**Status**: Complete
**Date**: 2026-02-24
**Scope**: Exhaustive research (broad survey + deep dive) for improving `workon.myidea.prompt.md` and `workon.myspec.prompt.md`
**Pain Points Under Investigation**: Context drift mid-workflow, SpecKit coupling

---

## Executive Summary

Surveyed 10+ code-based frameworks, 5 Copilot-native orchestration patterns, 6+ spec-driven development tools, and dozens of articles/papers on context management. Key findings:

1. **File-based state persistence is the universal pattern.** Every successful orchestrator (Gem Team, RUG, BMAD, Spec Kit, Kiro) uses files as the authoritative state store — not in-memory todo lists. Our `manage_todo_list` phase-loss bug is a known anti-pattern across the ecosystem.

2. **Filesystem-based phase detection eliminates context drift.** The Gem Team pattern — determine current phase by checking which files exist — makes workflows resumable across session breaks without conversation memory.

3. **Validation subagents are non-negotiable.** RUG's "never trust self-reported completion" pattern aligns with our code review phase, but could be applied at finer granularity.

4. **GitHub Spec Kit and BMAD-METHOD are the two leading SpecKit replacements.** Spec Kit is GitHub-official (17+ AI assistants, Constitution pattern). BMAD is the most comprehensive community framework (12+ agents, scale-adaptive, v6). Both active, both production-ready.

5. **Kiro (AWS) validates the spec-driven approach.** AWS built an entire IDE around it, confirming that spec-driven development is not a niche pattern but an emerging industry standard.

6. **Self-reflection quality gates prevent wasted review cycles.** Blueprint Mode's scoring rubric (1-10 across fixed categories, all must be >8) catches incomplete work before delegating to a costly fresh-context review agent.

---

## Table of Contents

- [Part 1: Copilot-Native Orchestration Patterns (Deep Dive)](#part-1-copilot-native-orchestration-patterns)
- [Part 2: Code-Based Multi-Agent Frameworks (Survey)](#part-2-code-based-multi-agent-frameworks)
- [Part 3: Spec-Driven Development Frameworks (Deep Dive)](#part-3-spec-driven-development-frameworks)
- [Part 4: Context Persistence & Drift Prevention Patterns](#part-4-context-persistence--drift-prevention-patterns)
- [Part 5: Anti-Patterns Catalog](#part-5-anti-patterns-catalog)
- [Part 6: Reusable Pattern Library](#part-6-reusable-pattern-library)
- [Part 7: Recommendations](#part-7-recommendations)
- [Sources](#sources)

---

## Part 1: Copilot-Native Orchestration Patterns

These are prompt/agent files designed for GitHub Copilot or similar AI coding assistants. Directly applicable to our workon prompts.

### Gem Team (awesome-copilot collection)

**Architecture**: DAG-based multi-agent with orchestrator. 8 specialized agents: orchestrator, researcher, planner, implementer, chrome-tester, devops, reviewer, documentation-writer.

**Key Innovations**:

- **Phase detection from filesystem state**: Determines current phase by inspecting which files exist:
  - No `plan.yaml` → Phase 1: Research (new project)
  - Plan exists + user feedback → Phase 2: Planning
  - Plan exists + tasks pending → Phase 3: Execution
  - All tasks completed → Phase 4: Completion
- **plan.yaml as single source of truth**: All task status, dependencies, and results tracked in YAML file in `docs/plan/{plan_id}/`
- **Up to 4 concurrent subagent delegation**: Tasks with no dependency conflicts run in parallel
- **Orchestrator NEVER executes tasks directly**: Only updates plan.yaml status and uses runSubagent
- **Failure routing**: Fixable failures go back to implementer; systemic failures trigger replanning via planner

**Delegation Protocol**:
```
Phase-detect → Delegate via runSubagent → Track state in plan.yaml → Summarize via walkthrough_review
```

**Relevance to our prompts**: ★★★★★ — The filesystem-based phase detection pattern directly solves our context drift problem. The plan.yaml state file pattern validates our PROGRESS.json approach and suggests we should derive todo list state from the file, not the reverse.

---

### RUG — Repeat Until Good (awesome-copilot collection)

**Architecture**: Pure orchestrator + 2 subagents (SWE implementation + QA validation). Three-agent team.

**Cardinal Rule**: "You NEVER write code, edit files, run commands, or do implementation work yourself." Only 2 tools allowed directly: `runSubagent` and `manage_todo_list`.

**Rationale**: "Every token you spend doing work yourself is a token that makes you dumber and less capable of orchestrating. Subagents get fresh context windows. That is your superpower."

**Key Innovations**:

- **Separate validation subagent for every work product**: Never trust self-reported completion. A second agent with fresh context verifies every claim.
- **Anti-laziness prompting**: Subagent prompts must include:
  - "Do NOT return until every requirement is fully implemented"
  - "DO NOT skip..." and "You MUST complete ALL of..."
  - Explicit file lists, not just descriptions
  - Individual acceptance criterion confirmations required
- **Specification adherence enforcement**: When user specifies technology X, the prompt echoes "You MUST use X. Do NOT substitute alternatives." Validation MUST check actual technology used, auto-FAIL if substituted.
- **Prompt template structure**: Every delegation includes CONTEXT, SCOPE, REQUIREMENTS, ACCEPTANCE CRITERIA, SPECIFIED TECHNOLOGIES, CONSTRAINTS, WHEN DONE sections.
- **"Just a quick read" prohibition**: Even reading a single file must be delegated. No exceptions.

**Common Failure Modes Called Out**:
1. "Let me quickly read one file..." syndrome (context pollution)
2. Monolithic delegation (one giant subagent degrades like you would)
3. Trusting self-reported completion ("It's probably lying")
4. Giving up after one failure (RUG means repeat)
5. "I'll write just the orchestration logic myself" (that's implementation)

**Relevance to our prompts**: ★★★★★ — The validation-subagent pattern and anti-laziness prompting are directly adoptable. The pure-orchestrator philosophy is a strong argument for our workon.myspec to delegate more aggressively. The prompt template structure is more rigorous than our current delegation format.

---

### Blueprint Mode v39 (awesome-copilot agent)

**Architecture**: Single agent with adaptive workflow selection. Not multi-agent — single agent chooses from 4 structured workflows.

**Workflow Classification** (first step, always):
- Repetitive across files → **Loop** (batch-process items)
- Bug with clear repro → **Debug** (Diagnose→Implement→Verify)
- Small, local change (≤2 files, low complexity) → **Express** (Implement→Verify)
- Everything else → **Main** (Analyze→Design→Plan→Implement→Verify)

**Key Innovations**:

- **Self-reflection scoring rubric** (non-negotiable quality gate):
  - 5 fixed categories: Correctness, Robustness, Simplicity, Maintainability, Consistency
  - Each scored 1-10
  - All must be >8 to pass
  - If any < 8 → create actionable issue, return to appropriate phase
  - Max 3 iterations → mark FAILED
- **Confidence-based ambiguity resolution**:
  - Score > 90: Proceed without asking user
  - Score < 90: Halt, ask ONE concise question
  - Tie-break rules for borderline scores
- **Think-Before-Action mandate**: Use `think` tool for planning before any execution
- **Retry protocol**: On failure, retry internally up to 3 times with varied approaches. After all tasks complete, revisit FAILED for root cause analysis.
- **Libraries/Frameworks verification**: "Never assume. Verify usage in project files before using."

**Communication Style**: "Blunt, pragmatic senior engineer with dry humor. Minimal words. Direct answers ≤3 sentences."

**Relevance to our prompts**: ★★★★☆ — The self-reflection rubric is immediately adoptable as a pre-review quality gate. The workflow classification pattern (Express/Debug/Main) maps to our Phase 0 routing logic and could improve it. Confidence scoring is valuable for Phase 1.

---

### Spec-Driven Workflow v1 (awesome-copilot instruction)

**Architecture**: 6-phase loop: Analyze → Design → Implement → Validate → Reflect → Handoff. Single agent with persistent artifacts.

**Key Innovations**:

- **EARS Notation** for requirements (Easy Approach to Requirements Syntax):
  - Ubiquitous: `THE SYSTEM SHALL [expected behavior]`
  - Event-driven: `WHEN [trigger] THE SYSTEM SHALL [expected behavior]`
  - State-driven: `WHILE [state] THE SYSTEM SHALL [expected behavior]`
  - Unwanted: `IF [unwanted condition] THEN THE SYSTEM SHALL [response]`
  - Optional: `WHERE [feature included] THE SYSTEM SHALL [expected behavior]`
- **Confidence-gated execution strategy**:
  - High (>85%): Full implementation, skip PoC
  - Medium (66-85%): Build PoC/MVP first, validate, then expand
  - Low (<66%): Research loop first, re-run Analyze after research
- **Triple artifact persistence**: `requirements.md` + `design.md` + `tasks.md` as living documents
- **Action Documentation Template**: Every step recorded with Objective, Context, Decision, Execution, Output, Validation, Next
- **Decision Records**: Every architectural decision captured with Context, Options, Rationale, Impact, Review date
- **Technical Debt Management**: Automated identification and issue creation during implementation
- **Handoff Phase**: Explicit packaging for review/deployment with executive summary

**Relevance to our prompts**: ★★★★☆ — EARS notation could formalize our spec requirements. Confidence gating would add sophistication to Phase 0/Phase 1 routing. The Handoff phase concept (packaging for review/deployment) is something our prompts skip.

---

### Project Planning Collection (awesome-copilot)

**Architecture**: 8 specialized agents + 2 instructions + 8 prompts. Modular toolkit for project planning lifecycle.

**Agent Inventory**:
- `task-planner` — breaks features into implementation tasks
- `task-researcher` — comprehensive project analysis
- `planner` — general planning agent
- `plan` — implementation plan creator
- `prd` — product requirements document generator
- `implementation-plan` — detailed implementation planning
- `research-technical-spike` — technical investigation

**Task Implementation Instruction** (microsoft/edge-ai):
- Uses `.copilot-tracking/` directory for persistent state:
  - `plans/**` — task plans
  - `details/**` — task details
  - `changes/**` — change records (Added/Modified/Removed with file paths)
- **Progressive tracking**: After EVERY task completion, update both plan file (`[ ]` → `[x]`) and changes file
- **Mandatory reads before implementation**: Read plan file, changes file, and details file completely
- **Divergence documentation**: If implementation diverges from plan, explicitly call out what changed and why

**Relevance to our prompts**: ★★★★☆ — The `.copilot-tracking/` directory pattern from microsoft/edge-ai is a more structured approach to our PROGRESS.json. The change record pattern (Added/Modified/Removed with file paths after every task) would improve our Phase 6 validation.

---

### Conductor (Cursor community)

**Architecture**: Track-based development. Spec → Plan → Implement pipeline.

**Key Concepts**:
- Product vision, tech stack, workflow rules, style guides as persistent context files
- Features developed as "tracks" with independent lifecycle
- `/conductor:setup` → `/conductor:new-track` → `/conductor:implement`
- TDD workflow with verification checkpoints

**Relevance to our prompts**: ★★★☆☆ — The "track" concept is useful for multi-feature branches. Less directly applicable since we're Copilot-focused, but the persistent context file pattern reinforces the file-based state approach.

---

## Part 2: Code-Based Multi-Agent Frameworks

These are Python/code-based frameworks, not directly usable as prompt files. Surveyed for architectural patterns.

| Framework | License | Architecture | Context Strategy | Our Takeaway |
|-----------|---------|-------------|-----------------|--------------|
| **LangGraph** | MIT | Stateful graph (DAG with cycles) | Serializable state object per node; built-in checkpointing and replay | State-as-graph-node — every function receives and mutates a typed state object. Most debuggable pattern. |
| **CrewAI** | MIT | Role-based agent teams | Task output persistence; sequential/parallel processes | Role-based delegation with defined goals/backstories. Fastest time-to-production. |
| **AutoGen** | MIT | Multi-agent conversation | Shared memory objects; manual save/load state | Shared memory pattern — agents write/read from common objects. Self-correction loops built in. |
| **MetaGPT** | MIT | SOP-based virtual company | Role-based artifacts (PRD→Design→Tasks→Code) | "Code = SOP(Team)" — PM→Architect→Engineer pipeline. Directly mirrors spec-driven dev. |
| **OpenHands** | MIT | Agent SDK w/ execution tracking | Pause/resume mechanism; task_tracker for long-horizon tasks | Only framework with first-class checkpoint/resume. |
| **claude-flow** | MIT | Hierarchical/mesh swarms | Shared memory via MCP; memory-coordinator agent | 54+ specialized agents with topology options. Ambitious but complex. |
| **OpenAI Swarm** | MIT | Function-calling handoffs | Thread-based conversation history | Minimal overhead. Good for simple handoffs, not complex workflows. |
| **Aider** | Apache-2.0 | Single agent + repo context | Repository map (compressed graph of signatures/structure) | Repo map gives architectural awareness without loading full files. Directly useful for Phase 1 research. |

### Key Patterns Extracted

**MetaGPT's SOP pipeline** is the closest code-framework analog to our spec-driven workflow:
```
Requirements (1 line) → PM generates PRD → Architect generates Design + Tasks → Engineer implements → QA tests
```
Each role receives the previous role's artifact and produces a new one. Artifacts are the handoff mechanism.

**Aider's Repository Map** builds a concise index of class names, method signatures, and relationships instead of loading full files. This is directly applicable to our Phase 1 (Research) — building a "module map" artifact that summarizes the architecture without consuming the context window.

---

## Part 3: Spec-Driven Development Frameworks

### GitHub Spec Kit (Official)

**URL**: [github/spec-kit](https://github.com/github/spec-kit)
**Status**: Production, actively maintained by GitHub
**AI Support**: 17+ assistants (Copilot, Claude Code, Cursor, Gemini CLI, Windsurf, Qwen, OpenCode, etc.)

**Core Pipeline**: `/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → implement

**Key Differentiators**:
- **The Constitution Pattern**: Immutable architectural principles defined at project init. Re-read and enforced at every phase. LLM cannot proceed without passing gates or documenting justified exceptions.
  - Provides consistency across time (future code follows same rules)
  - Provides consistency across LLMs (different models produce compatible code)
  - Acts as "compile-time checks" for architecture
- **Agent-agnostic**: Works with any AI coding assistant, not locked to Copilot
- **Executable specifications**: Specs serve as both documentation and implementation contracts
- **Clarify/Analyze/Checklist**: Optional validation steps (`/speckit.clarify`, `/speckit.analyze`, `/speckit.checklist`)

**Strengths**:
- Official GitHub backing = long-term maintenance
- Broad ecosystem support (17+ AI tools)
- Constitution concept directly addresses context drift
- Simple, focused toolset (not over-engineered)

**Limitations**:
- Focused narrowly on specification → code workflow
- Doesn't include orchestration/coordination logic — it's a toolkit, not a workflow manager
- No built-in phase tracking or progress persistence

**Relevance**: High as a toolkit that our orchestrator coordinates, rather than a replacement for the orchestrator itself.

---

### BMAD-METHOD v6

**URL**: [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
**Status**: Production (v6.0.0-alpha, npm-installable)
**AI Support**: Claude Code, Cursor, and others

**Core Philosophy**: "Breakthrough Method for Agile AI-Driven Development" — simulates a complete agile team with specialized AI agent roles.

**Agent Roster** (12+):
- Analyst, Product Manager, Architect, Developer, UX Designer, Scrum Master, Test Architect, QA Engineer, Documentation Writer, DevOps Engineer, Creative Intelligence (expansion), Game Dev (expansion)

**Key Differentiators**:
- **Scale-Adaptive Intelligence**: Automatically adjusts planning depth based on project complexity. A bug fix gets minimal ceremony; an enterprise feature gets full PRD + architecture + stories + test strategy.
- **Document Sharding**: Splits large documents into smaller, high-context pieces. Agents load only relevant shards, preventing token waste. Reported as "90% token savings" by users.
- **Party Mode**: Multi-agent collaboration where agents interact to refine artifacts
- **Module Ecosystem**: Core + expansion packs (test architect, game dev, creative intelligence)
- **4-Phase SDLC**: Discovery → Planning → Implementation → Verification

**Architecture**:
```
User → BMAD CLI → Select Agent Role → Generate Artifacts → Implement → Verify
```

**Strengths**:
- Most comprehensive community framework
- Scale-adaptive intelligence is a standout feature
- Document sharding addresses context window limitations
- npm-installable (easy setup)
- Active development and community

**Limitations**:
- More opinionated than Spec Kit (prescribes specific roles and artifacts)
- v6 is still alpha
- Community skepticism: some view it as over-engineered ("technical masturbation" — Reddit)
- Less proven at scale than Spec Kit

**Relevance**: High for patterns (scale-adaptive routing, document sharding). Medium for direct adoption.

---

### Kiro (AWS)

**URL**: AWS-proprietary (Kiro IDE)
**Status**: Production (launched preview July 2025, GA at re:Invent 2025)

**Core Concept**: "Spec coding" — a methodology where the spec is the source of truth in the repository, and an agentic IDE plans and proposes auditable changes against that spec.

**Key Innovations**:
- Spec lives in the repo as a first-class artifact (not throwaway documentation)
- AI plans against the spec and proposes changes
- Human reviews changes before they're applied
- Automatic test strategy suggested by the spec workflow

**Relevance**: Low for direct adoption (proprietary IDE), but validates spec-driven development as an emerging industry standard worthy of investment.

---

### OpenSpec

**URL**: Community CLI tool
**Status**: Early, less mature

**Core Concept**: Lightweight, portable spec-driven workflow for AI coding assistants. No API keys needed.

**Three-step workflow**: Proposal (markdown spec) → Apply (AI codes from spec) → Archive

**Key Concept**: `AGENTS.md` as "README for Robots" — contains fine-grained AI instructions (how to read context, format output, follow workflow state machine). Distinct from human-facing `README.md`.

**Relevance**: Low (less mature than Spec Kit/BMAD). The AGENTS.md concept is interesting but addressed by our copilot-instructions.md approach.

---

### Autospec

**URL**: Community CLI tool
**Status**: Early

**Core Concept**: CLI tool inspired by GitHub Spec Kit, built specifically for Claude Code usage.

**Relevance**: Low (single-tool narrow scope).

---

### Framework Comparison Matrix

| Feature | GitHub Spec Kit | BMAD v6 | OpenSpec | Kiro | Our SpecKit |
|---------|----------------|---------|---------|------|-------------|
| **Maintained** | ✅ Active (GitHub) | ✅ Active (community) | ⚠️ Early | ✅ Active (AWS) | ❌ Semi-abandoned |
| **Agent-agnostic** | ✅ 17+ tools | ⚠️ Focus on Claude/Cursor | ✅ | ❌ Proprietary | ❌ Copilot-only |
| **Scale-adaptive** | ❌ | ✅ | ❌ | ⚠️ | ❌ |
| **Constitution** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Orchestrator included** | ❌ | ✅ | ❌ | ✅ | ❌ (our prompts do this) |
| **Phase tracking** | ❌ | ⚠️ | ❌ | ✅ | ✅ (PROGRESS.json) |
| **Document sharding** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **npm installable** | ✅ | ✅ | ❌ | N/A | ❌ |
| **Custom agents** | ✅ | ✅ | ❌ | ❌ | ✅ |

---

## Part 4: Context Persistence & Drift Prevention Patterns

### Pattern 1: File-Based State Store (Universal)

**Used by**: Gem Team, our prompts, Spec Kit, BMAD, Conductor, Task Implementation

```
Read state file → determine current state → execute phase → write updated state → update display
```

Files survive session breaks, can be version-controlled, and are readable by any agent without conversation history. The `manage_todo_list` full-replacement API is the opposite — it requires perfect reconstruction from memory every time.

### Pattern 2: Filesystem-Based Phase Detection (Gem Team)

Determine current phase by inspecting which files and artifacts exist on disk:
```
No spec.md         → Phase 0: Routing
spec.md exists     → Phase 2: Specification complete  
plan.md exists     → Phase 3a: Plan complete
tasks.md exists    → Phase 3b: Tasks generated
All [x] in tasks   → Phase 4: Implementation complete
review-pass.md     → Phase 5: Review complete
```

This is completely resilient to context loss. Any new session resumes from the correct phase by checking filesystem state.

### Pattern 3: Constitution / Guardrails (Spec Kit)

Immutable architectural principles re-read at every phase transition. The LLM cannot proceed without passing gates. Directly addresses context drift by making implicit assumptions explicit rules.

### Pattern 4: Repository Map (Aider)

Build a compressed index of the codebase (class names, method signatures, relationships) instead of loading full files. Gives architectural awareness without consuming the full context window. Applicable to Phase 1 (Research) as an "architecture map" artifact.

### Pattern 5: Shared Context File (AutoGen, claude-flow)

A `context.md` or `research-notes.md` file that accumulates findings across phases. Re-read at each phase transition. Prevents the "telephone game" where each agent gets a summarized/lossy version of prior context.

### Pattern 6: Progressive Change Tracking (edge-ai/Task Implementation)

`.copilot-tracking/changes/` directory with Added/Modified/Removed sections updated after EVERY task completion. Provides a running record of what changed across the workflow.

### Pattern 7: Context Anchoring in Delegation (Our Prompts + RUG)

When delegating to a subagent, explicitly state what the subagent does NOT own:
> "After implementation, the coordinator proceeds to Phase 5 (Code Review), Phase 6 (Validate), and Phase 7 (Document). The implement agent does NOT manage these phases."

Prevents subagents from assuming expanded scope and makes return boundaries clear.

### Academic/Industry Research on Context Drift

- **GitHub Blog**: "Smart context management so agents always get the right information, not just more information" — context engineering as a discipline
- **Google Developers Blog**: "Agents as Tools" pattern — callee sees only specific instructions and necessary artifacts, no history
- **LangChain Blog**: Anthropic's multi-agent researcher saves its plan to Memory to persist context since context windows get truncated after 200K tokens
- **arXiv (2510.04618)**: "Agentic Context Engineering" — treats contexts as evolving playbooks that accumulate, refine, and organize strategies through generation, reflection, and curation
- **arXiv (2601.04170)**: "Agent Drift" — progressive behavioral degradation over extended interactions. Agents don't fail suddenly, they drift.

---

## Part 5: Anti-Patterns Catalog

### 1. Todo List as Source of Truth
**What**: Using `manage_todo_list` full-replacement semantics as the tracking mechanism.
**Why it fails**: LLM must perfectly reconstruct the entire list every time. Under cognitive load, later phases get omitted.
**Fix**: File-based state store. Todo list becomes display-only projection.

### 2. "Bag of Agents" / 17x Error Trap
**Source**: Towards Data Science
**What**: Unstructured agent proliferation without clear coordination.
**Why it fails**: Each agent adds error probability. Without structured orchestration, errors compound to 17x amplification.
**Fix**: Structured workflow with explicit phase transitions and validation gates.

### 3. Monolithic Delegation
**What**: Asking one subagent to do everything.
**Why it fails**: Single subagent hits context limits and degrades just like the coordinator would.
**Fix**: "One file = one subagent" or "one logical concern = one subagent."

### 4. Trusting Self-Reported Completion
**What**: Work agent says "Done!", you believe it.
**Why it fails**: Agents will claim completion rather than admitting partial work.
**Fix**: Separate validation subagent for every work product.

### 5. Context Pollution / "Just a Quick Read"
**What**: Orchestrator reads files, runs searches, analyzes code "just to check."
**Why it fails**: Fills orchestrator's context window with implementation details, degrading coordination.
**Fix**: Delegate all reading to subagents (strict) or budget direct reads tightly (hybrid).

### 6. Progressive Agent Drift
**Source**: arXiv paper
**What**: Performance degrades gradually through accumulated context and compounding small errors.
**Why it fails**: Multi-agent systems exhibit behavioral degradation over extended interactions.
**Fix**: Keep interactions short/focused. Re-anchor to source-of-truth files at every transition.

### 7. Insufficient Handoff Design
**What**: Poor handoff between agents leads to information loss, duplicated work, confused state.
**Fix**: Standardized handoff protocol — every subagent receives the same structure (USER REQUEST, context, directory) and returns in a predictable format.

### 8. Specification Substitution
**What**: User says "use X", subagent uses Y because "it knows better."
**Fix**: Echo specs in every prompt as hard constraints. Validation must check actual technology used.

### 9. Over-Engineering Initial Orchestration
**Source**: Enterprise multi-agent failure stories
**What**: 18 months building a perfect orchestration system that was obsolete on launch.
**Fix**: Incremental improvement. Adopt patterns one at a time.

---

## Part 6: Reusable Pattern Library

### For Phase 0 (Routing)

**Scale-Adaptive Complexity Score** (from BMAD):
```
Files affected: 1-3 (low=0), 4-8 (medium=2), 9+ (high=4)
Schema changes: +2
New UI components: +2  
Cross-layer changes: +2
Architecture decisions: +3

Score 0-3  → workon.myidea (lightweight)
Score 4-7  → workon.myspec (standard ceremony)
Score 8+   → workon.myspec (extended: add security review, performance review)
```

**Workflow Classification** (from Blueprint Mode):
```
Repetitive across files → Loop workflow
Bug with clear repro    → Debug workflow
≤2 files, low complexity → Express workflow
Everything else         → Full workflow
```

### For Phase 1 (Research)

**Confidence-Gated Progression** (from Spec-Driven Workflow v1):
```
High (>85%):   Proceed to specification/implementation directly
Medium (66-85%): Build PoC/MVP first, validate, then expand
Low (<66%):     Research loop — defer implementation until confidence rises
```

### For Delegation (All Phases)

**RUG Prompt Template**:
```markdown
CONTEXT: The user asked: "[original request verbatim]"
YOUR TASK: [specific decomposed task]
SCOPE:
- Files to modify: [list]
- Files to create: [list]  
- Files to NOT touch: [list]
REQUIREMENTS: [numbered list]
ACCEPTANCE CRITERIA: [checkboxes]
CONSTRAINTS: [what NOT to do]
WHEN DONE: Report: files created/modified, summary, issues, criterion confirmation
```

**Anti-Laziness Addendum**:
```markdown
Do NOT return until every requirement is fully implemented.
Partial work is not acceptable.
DO NOT skip any requirement listed above.
You MUST complete ALL acceptance criteria.
Confirm each acceptance criterion individually in your response.
```

### For Phase Transitions (All)

**File-First Transition Protocol**:
```
1. Read PROGRESS.json (or state file)
2. Detect current phase from file state
3. Verify next phase prerequisites exist on filesystem
4. Execute phase work
5. Write updated state to PROGRESS.json
6. Derive todo list from PROGRESS.json → update manage_todo_list display
```

### For Quality Gates (Pre-Review)

**Self-Reflection Rubric** (from Blueprint Mode):
```
Score each 1-10:
1. Correctness: Does it meet explicit requirements?
2. Robustness: Does it handle edge cases?
3. Simplicity: Is it free of over-engineering?
4. Maintainability: Can another developer extend/debug it?
5. Consistency: Does it follow project conventions?

Pass: All ≥ 8
Fail: Any < 8 → create actionable issue, return to appropriate phase
Max iterations: 3 → mark FAILED
```

---

## Part 7: Recommendations

### Immediate Adoptions (Low Effort, High Impact)

#### R1: Filesystem-Based Phase Detection
Add phase detection from artifacts as the first step of every phase transition:
```
Has spec.md? Has plan.md? Has tasks.md? All tasks [x]? Review passed?
```
Falls back to PROGRESS.json if artifacts don't fully determine state. Makes workflow resumable across sessions.

#### R2: Self-Reflection Quality Gate (Pre-Review)
Add Blueprint Mode's scoring rubric before Phase 5 (Code Review). Catches incomplete work before wasting a fresh-context review agent. Lightweight: 5 categories, 1-10 scoring, all must be ≥7 to advance.

#### R3: Standardized Delegation Template
Adopt RUG's prompt template structure for all subagent delegations. Current prompts specify what to include but don't enforce a consistent structure. The template ensures nothing gets omitted.

### Medium-Term Improvements (Medium Effort)

#### R4: Demote manage_todo_list to Display-Only
PROGRESS.json first, todo list as projection. Phase Transition Protocol becomes:
1. Read PROGRESS.json → determine state
2. Execute phase
3. Write PROGRESS.json
4. Derive todo list → update display

For workon.myidea (currently no state file), add a lightweight `progress.json` in the working directory.

#### R5: Unify the Two Prompts' Shared Patterns
Both prompts have identical concerns (MCP tools table, error handling, phase transition, delegation) but express them differently. Extract shared sections into either:
- A shared instruction file that both prompts reference
- Identical section headers with consistent structure

### Strategic Decisions (Higher Effort, Requires Design)

#### R6: Evaluate GitHub Spec Kit as SpecKit Replacement
GitHub's official Spec Kit provides the specify→plan→tasks pipeline our SpecKit agents implement, but with 17+ AI tool support, active maintenance, and the Constitution pattern.

**Evaluation path**: Test in isolated project → compare artifact quality → assess whether our orchestrator can coordinate Spec Kit commands instead of our custom speckit.* agents.

**Key question**: Does Spec Kit provide enough hooks for our orchestrator to coordinate, or would we need to wrap it?

#### R7: Adopt BMAD's Scale-Adaptive Routing
Instead of binary routing (myidea vs. spec), add a complexity score in Phase 0. Low scores get lightweight phase ceremony; high scores get extended ceremony (security review, performance review, ADR generation).

#### R8: Consider Constitution Pattern
Spec Kit's "Constitution" — immutable architectural principles that LLMs must follow — directly addresses context drift across long workflows. Worth exploring whether our copilot-instructions.md already serves this role or whether a separate constitution artifact adds value.

---

## Sources

### Frameworks & Repositories
- [LangGraph](https://github.com/langchain-ai/langgraph) — Graph-based stateful agent workflows
- [CrewAI](https://github.com/crewAIInc/crewAI) — Role-based multi-agent teams
- [AutoGen](https://github.com/microsoft/autogen) — Multi-agent conversation orchestration
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) — Virtual software company ("Code = SOP(Team)")
- [OpenHands](https://github.com/All-Hands-AI/OpenHands) — Agent SDK with pause/resume
- [claude-flow](https://github.com/ruvnet/claude-flow) — Multi-agent swarm orchestration
- [Aider](https://github.com/Aider-AI/aider) — AI pair programming with repository map
- [GitHub Spec Kit](https://github.com/github/spec-kit) — Official SDD toolkit
- [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) — Agile AI-Driven Development (v6)
- [github/awesome-copilot](https://github.com/github/awesome-copilot) — Community configurations

### Community Orchestration Patterns (awesome-copilot)
- Gem Team collection — DAG-based multi-agent with plan.yaml state
- RUG Agentic Workflow — Pure orchestrator + validation subagents
- Blueprint Mode agent — Self-reflection rubric + workflow classification
- Project Planning collection — Task planners, PRD generators, implementation agents
- Spec-Driven Workflow v1 instruction — EARS requirements + confidence scoring

### Articles & Analysis
- [How to build reliable AI workflows with agentic primitives and context engineering (GitHub Blog)](https://github.blog/ai-and-ml/github-copilot/how-to-build-reliable-ai-workflows-with-agentic-primitives-and-context-engineering/)
- [Spec-driven development with AI (GitHub Blog)](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
- [Diving into SDD with Spec Kit (Microsoft Developer Blog)](https://developer.microsoft.com/blog/spec-driven-development-spec-kit)
- [BMAD vs Spec Kit vs OpenSpec vs PromptX (Redreamality)](https://redreamality.com/blog/-sddbmad-vs-spec-kit-vs-openspec-vs-promptx/)
- [GitHub Spec Kit vs BMAD (Medium)](https://medium.com/@visrow/github-spec-kit-vs-bmad-method-a-comprehensive-comparison-part-1-996956a9c653)
- [Kiro: Spec-Driven Agentic IDE (Forbes)](https://www.forbes.com/sites/janakirammsv/2025/07/15/aws-launches-kiro-a-specification-driven-agentic-ide/)
- [Architecting efficient context-aware multi-agent framework (Google Developers Blog)](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)
- [Context Engineering for Agents (LangChain Blog)](https://blog.langchain.com/context-engineering-for-agents/)
- [Why your multi-agent system is failing (Towards Data Science)](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/)
- [Applied BMAD: Reclaiming Control in AI Dev (Benny Cheung)](https://bennycheung.github.io/bmad-reclaiming-control-in-ai-dev)
- [From Token Hell to 90% Savings: BMAD v6 (Medium)](https://medium.com/@hieutrantrung.it/from-token-hell-to-90-savings-how-bmad-v6-revolutionized-ai-assisted-development-09c175013085)

### Academic Papers
- [Agentic Context Engineering (arXiv 2510.04618)](https://arxiv.org/abs/2510.04618) — Evolving contexts as playbooks
- [Agent Drift: Behavioral Degradation (arXiv 2601.04170)](https://arxiv.org/html/2601.04170) — Progressive drift in multi-agent systems
- [Context Engineering for Multi-Agent LLM Code Assistants (arXiv 2508.08322)](https://arxiv.org/html/2508.08322v1) — CLAUDE.md as shared context base
- [Agentic Software Engineering: Foundational Pillars (arXiv 2509.06216)](https://arxiv.org/html/2509.06216v1) — Research roadmap including BMAD analysis
- [Memory in the Age of AI Agents (arXiv 2512.13564)](https://arxiv.org/abs/2512.13564) — Survey of memory architectures

### Context Drift & State Management
- [8 Tactics to Reduce Context Drift (Lumenalta)](https://lumenalta.com/insights/8-tactics-to-reduce-context-drift-with-parallel-ai-agents)
- [Your AI Agents Are Spinning Their Wheels (Tacnode)](https://tacnode.io/post/your-ai-agents-are-spinning-their-wheels)
- [12 Failure Patterns of Agentic AI (Concentrix)](https://www.concentrix.com/insights/blog/12-failure-patterns-of-agentic-ai-systems/)
- [Context Engineering: LLM Memory and Retrieval (Weaviate)](https://weaviate.io/blog/context-engineering)
- [What is Context Engineering for AI Agents? (Adaline)](https://labs.adaline.ai/p/what-is-context-engineering-for-ai)
- [Context Management: Missing Piece for Agentic AI (DataHub)](https://datahub.com/blog/context-management/)

---

## Related

- [Workon Phase Loss — Lessons Learned](workon-phase-loss-lessons-learned.md) — Prior analysis of the todo-list phase loss bug
- [PowerShell 7 Skill Research Spike](powershell-7-skill-research-spike.md) — Example of research spike format

---

## Design Decisions (2026-02-24)

Decisions made during research review, to be implemented in subsequent prompt revisions.

### D1: PROGRESS.json Everywhere
**Decision**: Both prompts use PROGRESS.json as the authoritative state store. `manage_todo_list` becomes a display-only projection derived from the file.
**Rationale**: Universal pattern across all surveyed frameworks. Eliminates the phase-loss bug caused by full-replacement semantics. Makes workflows resumable across sessions.
**Impact**: workon.myidea gains a state file it didn't have before. Phase Transition Protocol becomes read→execute→write→display for both prompts.

### D2: Adopt GitHub Spec Kit
**Decision**: Replace semi-abandoned SpecKit agents with GitHub Spec Kit commands (/specify, /plan, /tasks). Our workon.myspec.prompt.md becomes the orchestrator coordinating Spec Kit.
**Rationale**: GitHub-official, 17+ AI tool support, active maintenance, Constitution pattern for architectural consistency. Our orchestrator adds phase tracking, quality gates, and documentation management that Spec Kit doesn't include.
**Impact**: Spec Kit handles artifact generation; our orchestrator handles coordination, state tracking, review, validation, and documentation. Decouples from custom speckit.* agents.

### D3: Delegation Strategy — Status Quo + Templates
**Decision**: workon.myspec stays pure orchestrator (delegates everything). workon.myidea stays hybrid (executes simple phases directly, delegates complex ones). Both adopt standardized RUG-style delegation templates.
**Rationale**: The pure-orchestrator model preserves context window for the spec workflow's longer lifecycle. The hybrid model is more efficient for myidea's shorter, simpler workflows. Standardized templates ensure consistent delegation quality.
**Impact**: Add RUG prompt template (CONTEXT, SCOPE, REQUIREMENTS, ACCEPTANCE CRITERIA, CONSTRAINTS, WHEN DONE) and anti-laziness addendum to all delegation instructions.

### D4: Quality Gates — Rubric + Validation Subagents
**Decision**: Add Blueprint Mode's self-reflection scoring rubric before code review delegation, AND add separate validation subagents after every major phase.
**Rationale**: The rubric catches incomplete work before wasting a fresh-context review agent. Validation subagents enforce "never trust self-reported completion" across all phases, not just code review.
**Impact**: Adds a pre-review self-check step and post-phase validation subagent calls. Increases subagent usage but improves quality assurance. Max 3 rubric iterations before FAILED.
