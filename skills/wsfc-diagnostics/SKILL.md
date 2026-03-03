---
name: wsfc-diagnostics
description: 'Domain knowledge for analyzing Windows Server Failover Clustering (WSFC) diagnostic output from Get-ClusterDiagnosticInfo and Get-ClusterLog. Use when troubleshooting cluster health, performing root cause analysis on failover events, correlating events across nodes, or auditing cluster configuration. Triggers on "cluster diagnostic", "failover cluster", "WSFC", "cluster log", "Get-ClusterDiagnosticInfo", "cluster RCA", "cluster health".'
---

# WSFC Diagnostics Skill

Domain knowledge for intelligently parsing and analyzing Windows Server Failover Clustering diagnostic output without overwhelming context windows. Designed for a hybrid approach: PowerShell pre-processor creates a structured index, then the agent uses it to selectively drill into relevant files.

## When to Use This Skill

- Analyzing output from `Get-ClusterDiagnosticInfo` (extracted zip folders)
- Reading and interpreting cluster debug logs from `Get-ClusterLog`
- Performing root cause analysis (RCA) on cluster failovers or outages
- Correlating events across multiple cluster nodes and time windows
- Auditing cluster configuration against best practices
- Troubleshooting cluster health issues (quorum, networking, storage, resources)

## Bundled Resources

| Resource | Path | Use When |
|----------|------|----------|
| Pre-processor script | `scripts/New-ClusterDiagIndex.ps1` | First step: index extracted diagnostics folder |
| Event ID reference | `references/event-ids.md` | Looking up FailoverClustering event meanings |
| Log anatomy reference | `references/log-anatomy.md` | Parsing cluster debug log entry format |
| Analysis playbooks | `references/playbooks.md` | Step-by-step guides for common scenarios |

---

## Architecture: Hybrid Chunking Strategy

The diagnostic output from `Get-ClusterDiagnosticInfo` can exceed 15MB across dozens of files. Feeding this raw data into an agent destroys the context window. Instead, use a two-stage hybrid approach:

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Extracted Zip      │     │  PS Pre-Processor     │     │  Agent Analysis     │
│  (15MB+ raw data)   │────▶│  New-ClusterDiagIndex │────▶│  Reads index first  │
│                     │     │  Creates index.json   │     │  Drills into files  │
│  - Cluster logs     │     │  + summary.md         │     │  on demand          │
│  - Event logs       │     │                       │     │                     │
│  - Config exports   │     │  ~5KB structured      │     │  Context-efficient  │
│  - Health reports   │     │  metadata              │     │  analysis           │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

### Stage 1: Pre-Processor (PowerShell)

Run `New-ClusterDiagIndex.ps1` against the extracted diagnostic folder. It produces:

1. **`_diag_index.json`** — File manifest with sizes, types, date ranges, and error/warning counts
2. **`_diag_summary.md`** — Human/agent-readable summary with:
   - Cluster name, node list, OS versions
   - Timeline of ERR/WARN events per node
   - Top error event IDs with counts
   - Critical/error events extracted from `.evtx` files (via `Get-WinEvent`, Windows only)
   - Failed/warning tests extracted from XML health reports (via `Select-Xml`)
   - File inventory with sizes (flagging files > 500KB)
   - Quick health verdict

### Stage 2: Agent-Driven Analysis

The agent reads `_diag_summary.md` first (~2-5KB), then uses targeted `read_file` calls with specific line ranges to drill into only the relevant sections of large files. The agent NEVER reads an entire 15MB log file.

---

## Diagnostic Output Structure

### Get-ClusterDiagnosticInfo Output

When extracted, the zip typically contains:

| Folder/File Pattern | Contents | Typical Size |
|---------------------|----------|-------------|
| `*_cluster.log` | Cluster debug log per node | 1-10MB |
| `*_SystemEventLog.evtx` | System event log exports | 1-5MB |
| `*_ApplicationEventLog.evtx` | Application event log exports | 0.5-3MB |
| `ClusterHealthReport*.xml` | Cluster validation health reports | 10-100KB |
| `Get-Cluster*.txt` | PowerShell cmdlet output snapshots | 1-50KB |
| `Get-ClusterNode*.txt` | Node configuration details | 1-20KB |
| `Get-ClusterResource*.txt` | Resource status snapshots | 1-30KB |
| `Get-ClusterNetwork*.txt` | Network configuration | 1-10KB |
| `ipconfig_*.txt` | Network adapter details per node | 1-5KB |

### Get-ClusterLog Output

The cluster debug log (`cluster.log`) is the most detailed source. Default location: `%WINDIR%\cluster\reports`.

**Generation commands:**

```powershell
# Basic - all nodes, default 60 minutes
Get-ClusterLog -Destination . -UseLocalTime

# Targeted - specific timespan for one node
Get-ClusterLog -Node $NodeName -Destination . -TimeSpan 40 -UseLocalTime

# Full diagnostic zip
Get-ClusterDiagnosticInfo -WriteToPath "C:\Diagnostics\" -IncludeEvents
```

---

## Cluster Debug Log Reference

Log entry format, component tags, and search patterns are documented in [`references/log-anatomy.md`](references/log-anatomy.md). Key subsystems: `[RES]` (resource health), `[RCM]` (failover decisions), `[NM]` (node membership), `[FM]` (group movement), `[QUORUM]` (quorum state).

---

## Critical Event IDs Reference

Full event ID tables (FailoverClustering/Operational, System Channel, Health Service patterns) are in [`references/event-ids.md`](references/event-ids.md). Critical IDs to know: 1000 (fatal), 1006 (membership halt), 1069 (resource failure), 1135 (node eviction), 1177 (quorum loss).

---

## Analysis Playbooks

Step-by-step playbooks for common scenarios are in [`references/playbooks.md`](references/playbooks.md):

| Playbook | Use When |
|----------|----------|
| 1 — Quick Health Assessment | First look at cluster state |
| 2 — Root Cause Analysis | Deep-dive into a specific incident |
| 3 — Event Correlation | Cross-node timeline reconstruction |
| 4 — Configuration Audit | Validating cluster settings |
| 5 — Full Spectrum Analysis | Running all playbooks in sequence |

---

## Search Patterns and Parsing Strategies

Targeted `Select-String` patterns for cluster debug logs, `Get-WinEvent` queries for `.evtx` event logs, and `Select-Xml` patterns for XML health reports are documented in [`references/log-anatomy.md`](references/log-anatomy.md).

---

## MCP Tool Integration

When analyzing cluster diagnostics, use these MCP tools for verification:

| Need | Tool | Query Example |
|------|------|--------------|
| Event ID meaning | `mcp_microsoftdocs_microsoft_docs_search` | "Event ID 1135 failover clustering" |
| Cluster best practices | `mcp_microsoftdocs_microsoft_docs_search` | "failover cluster best practices Windows Server 2022" |
| Quorum configuration | `mcp_microsoftdocs_microsoft_docs_search` | "configure cluster quorum witness" |
| CSV troubleshooting | `mcp_microsoftdocs_microsoft_docs_search` | "cluster shared volume troubleshooting" |
| Full doc deep-dive | `mcp_microsoftdocs_microsoft_docs_fetch` | Fetch specific MS Learn URL |

---

## Key References

- [Get-ClusterDiagnosticInfo](https://learn.microsoft.com/powershell/module/failoverclusters/get-clusterdiagnosticinfo)
- [Get-ClusterLog](https://learn.microsoft.com/powershell/module/failoverclusters/get-clusterlog)
- [Failover Clustering system log events](https://learn.microsoft.com/windows-server/failover-clustering/system-events)
- [Troubleshooting Failover Clusters with WER](https://learn.microsoft.com/windows-server/failover-clustering/troubleshooting-using-wer-reports)
- [WSFC Health Service troubleshooting](https://learn.microsoft.com/troubleshoot/windows-server/high-availability/windows-server-failover-cluster-health-service)
- [Cluster log analysis (Edwin Sarmiento)](https://learnsqlserverhadr.com/analyze-wsfc-cluster-log/)
- [NXLog WSFC integration reference](https://docs.nxlog.co/integrations/network/windows-server-failover-clustering.html)
