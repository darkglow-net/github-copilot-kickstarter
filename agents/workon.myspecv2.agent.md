---
name: workon.myspecv2
description: Orchestrates spec-driven development workflow using MCP workflow state
tools:
  - 'workflow-state-service/*'
  - 'read'
  - 'edit'
  - 'search'
  - 'agent'
  - 'todo'
agents:
  - 'speckit.specify'
  - 'speckit.plan'
  - 'speckit.tasks'
  - 'speckit.analyze'
  - 'speckit.implement'
  - 'code-review'
---
