# Cluster Debug Log Anatomy

Reference for parsing cluster debug log entries from `Get-ClusterLog` output.

## Log Entry Format

Each line follows this structure:

```text
PPPPPPPP.TTTTTTTT::YYYY/MM/DD-HH:MM:SS.mmm LEVEL   [COMPONENT] Resource <Name>: Message
```

| Field | Description | Example |
| ------- | ------------- | --------- |
| `PPPPPPPP` | Process ID (hex) — typically RHS | `000012e4` |
| `TTTTTTTT` | Thread ID (hex) — trace a thread's activity | `00000674` |
| `YYYY/MM/DD-HH:MM:SS.mmm` | Timestamp (UTC unless `-UseLocalTime`) | `2024/01/15-14:30:22.561` |
| `LEVEL` | Entry type: `INFO`, `WARN`, `ERR`, `DBG` | `ERR` |
| `[COMPONENT]` | Subsystem tag (see table below) | `[RES]` |
| `Resource <Name>` | Cluster resource type and name | `Network Name <SQL01>` |
| `Message` | Human-readable event description | `IsAlive has indicated failure` |

## Key Components

| Tag | Full Name | Responsibility |
| ----- | ----------- | --------------- |
| `[RES]` | Resource | Resource-level operations (online/offline/health) |
| `[RCM]` | Resource Control Manager | Resource state transitions, failover decisions |
| `[GUM]` | Global Update Manager | Cluster database updates, replication |
| `[NM]` | Node Manager | Node membership, heartbeat, join/evict |
| `[FM]` | Failover Manager | Group movement, failover orchestration |
| `[CS]` | Cluster Service | Service lifecycle, startup, shutdown |
| `[API]` | Cluster API | External API calls to cluster |
| `[QUORUM]` | Quorum Manager | Quorum state, witness, voting |
| `[NETFT]` | Network Fault Tolerant | Network adapter health, virtual adapter |
| `[SV]` | Shared Volume | CSV operations, redirected I/O |

## Diagnostic Output Structure

### Get-ClusterDiagnosticInfo Output

When extracted, the zip typically contains:

| Folder/File Pattern | Contents | Typical Size |
| --------------------- | ---------- | ------------- |
| `*_cluster.log` | Cluster debug log per node | 1-10MB |
| `*_SystemEventLog.evtx` | System event log exports | 1-5MB |
| `*_ApplicationEventLog.evtx` | Application event log exports | 0.5-3MB |
| `ClusterHealthReport*.xml` | Cluster validation health reports | 10-100KB |
| `Get-Cluster*.txt` | PowerShell cmdlet output snapshots | 1-50KB |
| `Get-ClusterNode*.txt` | Node configuration details | 1-20KB |
| `Get-ClusterResource*.txt` | Resource status snapshots | 1-30KB |
| `Get-ClusterNetwork*.txt` | Network configuration | 1-10KB |
| `ipconfig_*.txt` | Network adapter details per node | 1-5KB |

> **Note**: `.evtx` files are binary and cannot be opened with `read_file`. Use `Get-WinEvent` in the terminal to query them — see [Parsing .evtx Event Logs](#parsing-evtx-event-logs) below.

### Get-ClusterLog Generation Commands

```powershell
# Basic - all nodes, default 60 minutes
Get-ClusterLog -Destination . -UseLocalTime

# Targeted - specific timespan for one node
Get-ClusterLog -Node $NodeName -Destination . -TimeSpan 40 -UseLocalTime

# Full diagnostic zip
Get-ClusterDiagnosticInfo -WriteToPath "C:\Diagnostics\" -IncludeEvents
```

## Search Patterns for Cluster Logs

When searching large cluster debug logs, use these targeted patterns:

```powershell
# Find errors — use space padding to avoid false matches
Select-String -Pattern ' ERR  ' -Path *_cluster.log

# Find warnings
Select-String -Pattern ' WARN ' -Path *_cluster.log

# Find resource failures
Select-String -Pattern 'IsAlive has indicated failure' -Path *_cluster.log

# Find node membership changes
Select-String -Pattern '\[NM\].*membership' -Path *_cluster.log

# Find failover events
Select-String -Pattern '\[FM\].*failover|Group move' -Path *_cluster.log

# Find quorum issues
Select-String -Pattern '\[QUORUM\]|quorum' -Path *_cluster.log

# Find specific resource by name
Select-String -Pattern 'Resource.*<YourResourceName>' -Path *_cluster.log

# Time-window search — replace with actual incident timestamp
Select-String -Pattern '<YYYY/MM/DD-HH:M>' -Path *_cluster.log
```

## Parsing .evtx Event Logs

`.evtx` files are binary event logs exported by `Get-ClusterDiagnosticInfo`. They cannot be read as text — use `Get-WinEvent` (Windows-only, `Microsoft.PowerShell.Diagnostics` module) in the terminal.

### Quick Queries

```powershell
# All FailoverClustering critical/error events from an exported .evtx
Get-WinEvent -FilterHashtable @{
    Path         = '*_SystemEventLog.evtx'
    ProviderName = 'Microsoft-Windows-FailoverClustering'
    Level        = 1, 2
} -MaxEvents 50 -ErrorAction SilentlyContinue |
    Select-Object TimeCreated, Id, LevelDisplayName, Message

# Specific event IDs (node eviction, resource failure, quorum loss)
Get-WinEvent -FilterHashtable @{
    Path = '*_SystemEventLog.evtx'
    Id   = 1135, 1069, 1177, 1000, 1006
} -ErrorAction SilentlyContinue |
    Select-Object TimeCreated, Id, LevelDisplayName, Message
```

### Time-Window Filtering

```powershell
# Events within a known incident window
Get-WinEvent -FilterHashtable @{
    Path      = '*_SystemEventLog.evtx'
    Level     = 1, 2
    StartTime = [datetime]'2024-01-15 14:00:00'
    EndTime   = [datetime]'2024-01-15 16:00:00'
} -ErrorAction SilentlyContinue
```

### XPath Filtering

```powershell
# Complex XPath query for specific providers and event ranges
Get-WinEvent -Path '*_SystemEventLog.evtx' -FilterXPath @"
*[System[Provider[@Name='Microsoft-Windows-FailoverClustering']
  and (EventID=1135 or EventID=1069)
  and TimeCreated[timediff(@SystemTime) <= 86400000]]]
"@ -ErrorAction SilentlyContinue
```

### Level Values

| Level | Meaning |
| ----- | ------- |
| 1 | Critical |
| 2 | Error |
| 3 | Warning |
| 4 | Information |

## Parsing XML Health Reports

Cluster validation health reports (`ClusterHealthReport*.xml`) contain test results in XML format. Use `Select-Xml` (cross-platform, `Microsoft.PowerShell.Utility` module) for targeted extraction.

### Extract Failed and Warning Tests

```powershell
# Find all failed tests across health report XMLs
Select-Xml -Path 'ClusterHealthReport*.xml' -XPath "//Test[@Result='Fail']" |
    ForEach-Object { $_.Node } |
    Select-Object @{N='Test'; E={$_.Description}}, Result, @{N='Detail'; E={$_.InnerText}}

# Find both failed and warning tests
Select-Xml -Path 'ClusterHealthReport*.xml' `
    -XPath "//Test[@Result='Fail' or @Result='Warn']" |
    ForEach-Object { $_.Node }
```

### DOM Navigation for Complex Extraction

```powershell
# Load entire report for DOM navigation when XPath is insufficient
$report = [xml](Get-Content -LiteralPath 'ClusterHealthReport_2024-01-15.xml')

# Navigate to specific sections
$report.Report.Category | ForEach-Object {
    [PSCustomObject]@{
        Category = $_.Name
        Failed   = ($_.Test | Where-Object Result -eq 'Fail').Count
        Warned   = ($_.Test | Where-Object Result -eq 'Warn').Count
        Passed   = ($_.Test | Where-Object Result -eq 'Pass').Count
    }
}
```

### Handling Namespaced XML

```powershell
# Some cluster XML files use namespaces — provide a namespace table
$ns = @{ fc = 'http://schemas.microsoft.com/windowsserver/failoverclustering' }
Select-Xml -Path 'report.xml' -XPath '//fc:Resource' -Namespace $ns |
    ForEach-Object { $_.Node }
```
