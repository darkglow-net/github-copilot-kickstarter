# WSFC Analysis Playbooks

Step-by-step guides for common cluster diagnostic scenarios. Each playbook follows the hybrid chunking strategy: read the `_diag_summary.md` index first, then drill into specific files on demand.

## Prerequisites

- PowerShell 7+ available on the analysis machine
- Extracted `Get-ClusterDiagnosticInfo` output folder
- Pre-processor index generated (`_diag_summary.md` exists in the diagnostic folder)

## Playbook 1: Quick Health Assessment

1. Read `_diag_summary.md` — check health verdict
2. If ERR count > 0: read the error timeline section
3. Check cluster node status (all nodes `Up`?)
4. Check quorum status (healthy witness?)
5. Review resource status (any `Failed` or `Offline`?)

## Playbook 2: Root Cause Analysis (RCA)

1. **Establish timeline**: Identify when the incident occurred from error events
2. **Find the trigger**: Search for the first ERR/WARN entry near the incident time
3. **Trace the thread**: Use the thread ID from the error to follow the full sequence
4. **Identify the component**: Which subsystem ([RCM], [NM], [FM], [RES]) reported first?
5. **Check dependencies**: Did a lower-level resource fail causing cascading failures?
6. **Cross-node correlation**: Compare timestamps across node logs for the same event window
7. **Check external factors**: Network events, storage events, system events near the same time

## Playbook 3: Event Correlation

1. Identify the primary event (e.g., node eviction Event ID 1135)
2. Note the exact timestamp
3. Search all node logs within a ±30-second window
4. Look for preceding events: heartbeat failures, network timeouts, storage I/O errors
5. Build causal chain: trigger → detection → response → recovery

## Playbook 4: Configuration Audit

1. Read cluster configuration exports (`Get-Cluster*.txt`)
2. Verify quorum model matches node count (dynamic witness, file share witness)
3. Check network configuration (dedicated heartbeat network?)
4. Verify resource dependencies are correctly chained
5. Check anti-affinity rules and preferred owners
6. Compare against MS best practices using `mcp_microsoftdocs_microsoft_docs_search`

## Playbook 5: Full Spectrum Analysis

Run all playbooks in sequence for comprehensive diagnostics:

1. **Health Assessment** (Playbook 1) — establish baseline state
2. **Root Cause Analysis** (Playbook 2) — investigate any errors found in the health assessment
3. **Event Correlation** (Playbook 3) — cross-reference events across nodes for the RCA timeline
4. **Configuration Audit** (Playbook 4) — check if configuration issues contributed to the incident

After completing all playbooks, synthesize findings into a single report that covers:

- Overall health state with evidence
- Root cause chain (if errors exist)
- Cross-node event timeline
- Configuration deviations from best practices
- Prioritized recommendations (immediate actions first, then preventive measures)
