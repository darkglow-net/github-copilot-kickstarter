---
agent: 'wsfc-diagnostics'
description: 'Analyze Windows Server Failover Clustering diagnostic output. Indexes large diagnostic bundles, performs progressive triage, RCA, event correlation, and configuration audits. Provide the path to an extracted Get-ClusterDiagnosticInfo folder.'
tools: ['read', 'search', 'execute']
---

# Analyze WSFC Cluster Diagnostics

This prompt launches a **WSFC diagnostic analysis session** using the structured workflow in the `wsfc-diagnostics` agent.

## Input

**Diagnostic folder path**: ${input:diagnosticFolderPath:Path to extracted Get-ClusterDiagnosticInfo folder}

## Workflow

### Step 1: Load Domain Knowledge

Read the skill reference for log format, event IDs, and analysis playbooks:

```
skills/wsfc-diagnostics/SKILL.md
```

### Step 2: Index the Diagnostic Data

Run the pre-processor to generate a lightweight index and summary:

```powershell
& "${workspaceFolder}/skills/wsfc-diagnostics/scripts/New-ClusterDiagIndex.ps1" -DiagPath "${input:diagnosticFolderPath}"
```

Then read the generated `_diag_summary.md` from the diagnostic folder.

### Step 3: Execute Agent Workflow

Follow the agent’s phased workflow (triage → investigation → report) as defined in the `wsfc-diagnostics` agent. Present the health verdict, ask the user what to investigate, then execute the matching playbook and deliver a structured report.

## Tips for Best Results

- Run `Get-ClusterDiagnosticInfo -WriteToPath "C:\Diag" -IncludeEvents` to capture event logs
- Use `-TimeSpan 40` with `Get-ClusterLog` to narrow the log window around an incident
- Extract the zip before providing the path to this prompt
- For SQL Server Always On issues, also collect `Get-ClusterLog -Node <primary-replica>`
- `.evtx` event log files cannot be read as text by the agent — the pre-processor extracts key metadata from them instead
