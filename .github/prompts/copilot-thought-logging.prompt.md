---
description: 'Enable Copilot process logging to Copilot-Processing.md for debugging and observing how templates, agents, or prompts behave during development. Invoke this prompt when you want to capture the full planning and execution trace of a session.'
agent: 'agent'
---

# Enable Copilot Process Logging

You are entering a **process-logging session**. Your task is to persist your planning, reasoning, and execution trace to `Copilot-Processing.md` in the workspace root so the developer can review how you interpreted and executed their request.

This is used when **developing or testing Copilot templates** (agents, prompts, instructions, skills) to observe the actual thought process and output of the template under test.

## When to Use This Prompt

- Testing a new or modified agent/prompt to see how it reasons
- Debugging unexpected behavior from a template
- Capturing a session trace for a prompt-craft lessons-learned article
- Reviewing how Copilot interprets complex multi-phase workflows

## Phase 1: Initialization

- Create or overwrite `Copilot-Processing.md` in the workspace root
- Record the user's request verbatim
- Note which templates/agents are active (from frontmatter, instructions, etc.)
- Work silently — no phase announcements in chat

## Phase 2: Planning

- Write your action plan into `Copilot-Processing.md`
- Break the plan into granular, trackable tasks with status markers (`[ ]` / `[x]`)
- Include:
  - Specific tasks for each action item
  - Dependencies or prerequisites
  - Which files will be read/modified
- Work silently — no phase announcements in chat

## Phase 3: Execution

- Execute action items from the plan
- After completing each task, update `Copilot-Processing.md` to mark it `[x]`
- Log any decisions, deviations, or tool outputs that would help the developer understand behavior
- Repeat until all tasks are complete

## Phase 4: Summary

- Append a summary section to `Copilot-Processing.md` with:
  - What was accomplished
  - Any issues or unexpected behavior encountered
  - Observations about template effectiveness (if testing a template)
- Inform the user: "Session trace saved to `Copilot-Processing.md`."
- Remind the user to review and delete the file before committing (it should not be checked in)

## Rules

- **Do NOT announce phases** in chat output — all logging goes to the file
- **Do NOT flood chat** with status updates; the file is the artifact
- **Do NOT combine phases** — execute sequentially
- Keep the file structured and scannable
- If the session is interrupted, the file should still be useful up to the point of interruption
