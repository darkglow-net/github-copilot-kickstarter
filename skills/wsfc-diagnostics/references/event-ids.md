# WSFC Critical Event IDs Reference

Event IDs from Windows Server Failover Clustering used for diagnostic analysis. Verify meanings with `mcp_microsoftdocs_microsoft_docs_search` when performing RCA.

## FailoverClustering/Operational Channel

| Event ID | Name | Severity | Description |
| ---------- | ------ | ---------- | ------------- |
| 1000 | UNEXPECTED_FATAL_ERROR | Critical | Cluster service cannot start — software/hardware issue |
| 1006 | NM_EVENT_MEMBERSHIP_HALT | Critical | Cluster service halted — lost connectivity to other nodes |
| 1069 | RESOURCE_FAILED_TO_COME_ONLINE | Error | Clustered resource failed to come online |
| 1135 | NODE_REMOVED_FROM_MEMBERSHIP | Warning | Node removed from active cluster membership |
| 1146 | RESOURCE_FAILURE | Error | Resource failure detected |
| 1177 | QUORUM_LOSS | Critical | Quorum lost — cluster may halt |
| 1230 | RESOURCE_TIMEOUT | Error | Resource exceeded online/offline timeout |
| 1635 | RCM_RESOURCE_FAILURE_INFO | Error | Shared resource failed to come online (SQL Server, disks) |
| 1637 | RCM_RESOURCE_STATE_TRANSITION | Info | Resource state transition (not necessarily an error) |

## System Channel (Source: Microsoft-Windows-FailoverClustering)

| Event ID | Meaning |
| ---------- | --------- |
| 5120 | CSV volume not accessible |
| 5121 | CSV volume entering redirected access |
| 5126 | CSV volume entering paused state |
| 7024 | Service terminated with error |
| 7031 | Service terminated unexpectedly |
| 7034 | Service terminated unexpectedly (SSL/cert) |
| 7036 | Service state change |

## Health Service Events

| Event ID | Pattern | Common Cause |
| ---------- | --------- | ------------- |
| 1676 | Health check triggers failover | Missed heartbeat, IsAlive threshold, VSS |
| 1135 + 1177 | Node eviction + quorum loss | Network partition, simultaneous node failure |
| 1069 + 1146 | Resource failure chain | Dependency failure, storage timeout |
