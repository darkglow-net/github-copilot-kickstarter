<#
.SYNOPSIS
    Indexes extracted Get-ClusterDiagnosticInfo output for context-efficient AI analysis.

.DESCRIPTION
    Scans an extracted WSFC diagnostic folder and produces two files:
      - _diag_index.json  : structured file manifest with metadata
      - _diag_summary.md  : agent-readable summary (~2-5KB)

    The agent reads the summary first, then drills into specific files on demand.

.PARAMETER DiagPath
    Path to the extracted Get-ClusterDiagnosticInfo folder.

.PARAMETER MaxErrorLines
    Maximum ERR/WARN lines to include in the summary per node. Default: 50.

.PARAMETER LargeLogThresholdMB
    Cluster log files over this size (MB) are parsed using Get-Content -Tail instead of a full
    StreamReader scan. Prevents loading hundreds-of-megabyte log files into memory. Default: 100.

.PARAMETER LargeLogTailLines
    Number of lines to read from the tail of large log files (those exceeding LargeLogThresholdMB).
    Covers roughly the last 30-60 minutes of a busy cluster log at the default. Default: 50000.

.EXAMPLE
    .\New-ClusterDiagIndex.ps1 -DiagPath C:\Diagnostics\ClusterDiag_2024-01-15

.EXAMPLE
    # Override thresholds for a high-volume cluster with 500MB+ logs
    .\New-ClusterDiagIndex.ps1 -DiagPath C:\Diagnostics\ClusterDiag_2024-01-15 `
        -LargeLogThresholdMB 50 -LargeLogTailLines 100000

.NOTES
    Designed for use with the wsfc-diagnostics Copilot skill.
    Does not modify any source files — read-only indexing.
    Produces _diag_summary.md sections: Quick Health Verdict, Node Log Summary, Error/Warning Timeline,
    Event Log Summary (.evtx via Get-WinEvent, Windows only), Health Report Summary (XML via Select-Xml),
    File Inventory, and Agent Analysis Instructions.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Container })]
    [string]$DiagPath,

    [Parameter()]
    [ValidateRange(10, 500)]
    [int]$MaxErrorLines = 50,

    # Log files over this size (MB) are parsed tail-first instead of full scan.
    [Parameter()]
    [ValidateRange(1, 2000)]
    [int]$LargeLogThresholdMB = 100,

    # Number of lines to read from the tail of large log files.
    [Parameter()]
    [ValidateRange(1000, 500000)]
    [int]$LargeLogTailLines = 50000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

#region Helper Functions

function Get-FileCategory {
    [CmdletBinding()]
    [OutputType([string])]
    param([string]$FileName)

    switch -Regex ($FileName) {
        '_cluster\.log$'          { return 'ClusterLog' }
        'SystemEventLog'          { return 'SystemEventLog' }
        'ApplicationEventLog'     { return 'AppEventLog' }
        'ClusterHealth'           { return 'HealthReport' }
        '^Get-Cluster\.txt$'      { return 'ClusterConfig' }
        '^Get-ClusterNode'        { return 'NodeConfig' }
        '^Get-ClusterResource'    { return 'ResourceConfig' }
        '^Get-ClusterNetwork'     { return 'NetworkConfig' }
        '^Get-ClusterGroup'       { return 'GroupConfig' }
        '^Get-ClusterQuorum'      { return 'QuorumConfig' }
        'ipconfig'                { return 'NetworkAdapter' }
        '\.evtx$'                 { return 'EventLogBinary' }
        '\.xml$'                  { return 'XMLReport' }
        '\.log$'                  { return 'LogFile' }
        '\.txt$'                  { return 'TextExport' }
        default                   { return 'Other' }
    }
}

function Get-ClusterLogStats {
    [CmdletBinding()]
    param(
        [string]$FilePath,
        [int]$MaxLines,
        [long]$FileSizeBytes = 0,
        [int]$TailLines = 0
    )

    $useTail = ($TailLines -gt 0) -and ($FileSizeBytes -gt 0)

    $stats = [ordered]@{
        ErrorCount    = 0
        WarningCount  = 0
        InfoCount     = 0
        FirstEntry    = $null
        LastEntry     = $null
        TopErrors     = [System.Collections.Generic.List[string]]::new()
        TopWarnings   = [System.Collections.Generic.List[string]]::new()
        Components    = [System.Collections.Generic.HashSet[string]]::new()
        NodeName      = $null
        TailOnly      = $useTail
        TailLinesUsed = 0
    }

    # Extract node name from filename pattern: NodeName_cluster.log
    if ($FilePath -match '([^\\\/]+)_cluster\.log$') {
        $stats.NodeName = $Matches[1]
    }

    $timestampPattern = '^\w+\.\w+::(\d{4}/\d{2}/\d{2}-\d{2}:\d{2}:\d{2}\.\d{3})'
    $levelPattern     = '::\d{4}/\d{2}/\d{2}-\d{2}:\d{2}:\d{2}\.\d{3}\s+(ERR|WARN|INFO|DBG)\s+'
    $componentPattern = '\[(\w+)\]'

    if ($useTail) {
        # Large file: Get-Content -Tail seeks from end of file — fast even on 500MB+ logs.
        # Loads only the requested tail lines into memory rather than the full file.
        $lines = Get-Content -LiteralPath $FilePath -Tail $TailLines
        $stats.TailLinesUsed = $lines.Count
        $stats['TotalLines'] = $lines.Count

        foreach ($line in $lines) {
            if ($line -match $timestampPattern) {
                $ts = $Matches[1]
                if ($null -eq $stats.FirstEntry) { $stats.FirstEntry = $ts }
                $stats.LastEntry = $ts
            }

            if ($line -match $levelPattern) {
                $level = $Matches[1]
                switch ($level) {
                    'ERR' {
                        $stats.ErrorCount++
                        if ($stats.TopErrors.Count -lt $MaxLines) {
                            $stats.TopErrors.Add($line.Substring(0, [Math]::Min($line.Length, 300)))
                        }
                    }
                    'WARN' {
                        $stats.WarningCount++
                        if ($stats.TopWarnings.Count -lt $MaxLines) {
                            $stats.TopWarnings.Add($line.Substring(0, [Math]::Min($line.Length, 300)))
                        }
                    }
                    'INFO' { $stats.InfoCount++ }
                }
            }

            if ($line -match $componentPattern) {
                [void]$stats.Components.Add($Matches[1])
            }
        }
    }
    else {
        # Full scan: StreamReader reads one line at a time — constant memory regardless of file size.
        $reader = $null
        try {
            $reader = [System.IO.StreamReader]::new($FilePath)
            $lineCount = 0

            while ($null -ne ($line = $reader.ReadLine())) {
                $lineCount++

                if ($line -match $timestampPattern) {
                    $ts = $Matches[1]
                    if ($null -eq $stats.FirstEntry) { $stats.FirstEntry = $ts }
                    $stats.LastEntry = $ts
                }

                if ($line -match $levelPattern) {
                    $level = $Matches[1]
                    switch ($level) {
                        'ERR' {
                            $stats.ErrorCount++
                            if ($stats.TopErrors.Count -lt $MaxLines) {
                                $stats.TopErrors.Add($line.Substring(0, [Math]::Min($line.Length, 300)))
                            }
                        }
                        'WARN' {
                            $stats.WarningCount++
                            if ($stats.TopWarnings.Count -lt $MaxLines) {
                                $stats.TopWarnings.Add($line.Substring(0, [Math]::Min($line.Length, 300)))
                            }
                        }
                        'INFO' { $stats.InfoCount++ }
                    }
                }

                if ($line -match $componentPattern) {
                    [void]$stats.Components.Add($Matches[1])
                }
            }

            $stats['TotalLines'] = $lineCount
        }
        finally {
            if ($reader) { $reader.Dispose() }
        }
    }

    return $stats
}

function Get-TextFilePreview {
    [CmdletBinding()]
    param(
        [string]$FilePath,
        [int]$Lines = 30
    )

    $content = Get-Content -LiteralPath $FilePath -TotalCount $Lines -ErrorAction SilentlyContinue
    if ($content) {
        return ($content -join "`n")
    }
    return ''
}

function Get-EvtxSummary {
    <#
    .SYNOPSIS
        Extracts critical/error FailoverClustering events from an exported .evtx file.
    .NOTES
        Windows-only — requires the Microsoft.PowerShell.Diagnostics module (Get-WinEvent).
        Fails gracefully on non-Windows or when the .evtx file is corrupt/inaccessible.
        Status values: 'OK' (events found), 'Clean' (no matching events), 'Failed' (parse error), 'Skipped' (non-Windows).
    #>
    [CmdletBinding()]
    param(
        [string]$FilePath,
        [int]$MaxEvents = 50
    )

    $summary = [ordered]@{
        Source        = (Split-Path $FilePath -Leaf)
        Status        = 'OK'
        EventCount    = 0
        CriticalCount = 0
        ErrorCount    = 0
        Events        = [System.Collections.Generic.List[object]]::new()
        TimeRange     = $null
        ErrorDetail   = $null
    }

    if ($PSVersionTable.Platform -eq 'Unix') {
        $summary.Status      = 'Skipped'
        $summary.ErrorDetail = 'Get-WinEvent is not available on non-Windows platforms'
        return $summary
    }

    try {
        $events = Get-WinEvent -FilterHashtable @{
            Path         = $FilePath
            ProviderName = 'Microsoft-Windows-FailoverClustering'
            Level        = 1, 2   # Critical, Error
        } -MaxEvents $MaxEvents -ErrorAction Stop

        $summary.EventCount    = $events.Count
        $summary.CriticalCount = ($events | Where-Object Level -eq 1).Count
        $summary.ErrorCount    = ($events | Where-Object Level -eq 2).Count

        if ($events.Count -gt 0) {
            $sorted = $events | Sort-Object TimeCreated
            $summary.TimeRange = "$($sorted[0].TimeCreated.ToString('yyyy-MM-dd HH:mm:ss')) → $($sorted[-1].TimeCreated.ToString('yyyy-MM-dd HH:mm:ss'))"
        }

        # Events come back newest-first from Get-WinEvent by default
        foreach ($evt in $events | Select-Object -First 20) {
            $summary.Events.Add([ordered]@{
                Time    = $evt.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss')
                Id      = $evt.Id
                Level   = $evt.LevelDisplayName
                Message = $evt.Message.Substring(0, [Math]::Min($evt.Message.Length, 200))
            })
        }
    }
    catch [Exception] {
        if ($_.Exception.Message -like '*No events were found*') {
            $summary.Status = 'Clean'
        }
        else {
            $summary.Status      = 'Failed'
            $summary.ErrorDetail = "Failed to read .evtx: $($_.Exception.Message)"
        }
    }

    return $summary
}

function Get-XmlHealthSummary {
    <#
    .SYNOPSIS
        Extracts failed and warning test results from a cluster health report XML file.
    .NOTES
        Uses Select-Xml (cross-platform). Falls back to DOM loading if XPath patterns
        do not match the expected structure.
    #>
    [CmdletBinding()]
    param([string]$FilePath)

    $summary = [ordered]@{
        Source      = (Split-Path $FilePath -Leaf)
        FailedTests  = [System.Collections.Generic.List[object]]::new()
        WarningTests = [System.Collections.Generic.List[object]]::new()
        TotalTests   = 0
        Error        = $null
    }

    try {
        # Try XPath extraction for standard cluster health report structure
        $failNodes = Select-Xml -LiteralPath $FilePath `
            -XPath "//Test[@Result='Fail' or @Result='Warn']" `
            -ErrorAction SilentlyContinue

        if ($failNodes) {
            foreach ($node in $failNodes) {
                $testInfo = [ordered]@{
                    Name   = if ($node.Node.Description) { $node.Node.Description } else { $node.Node.Name }
                    Result = $node.Node.Result
                }
                if ($node.Node.Result -eq 'Fail') {
                    $summary.FailedTests.Add($testInfo)
                }
                else {
                    $summary.WarningTests.Add($testInfo)
                }
            }
        }

        # Count total tests regardless of result
        $allTests = Select-Xml -LiteralPath $FilePath -XPath '//Test' -ErrorAction SilentlyContinue
        if ($allTests) {
            $summary.TotalTests = @($allTests).Count
        }

        # If XPath found nothing, fall back to DOM loading for non-standard schemas
        if ($summary.TotalTests -eq 0) {
            $xml = [xml](Get-Content -LiteralPath $FilePath -Raw)
            $testElements = $xml.SelectNodes('//*[local-name()="Test"]')
            if ($testElements -and $testElements.Count -gt 0) {
                $summary.TotalTests = $testElements.Count
                foreach ($el in $testElements) {
                    if ($el.Result -in 'Fail', 'Warn') {
                        $testInfo = [ordered]@{
                            Name   = if ($el.Description) { $el.Description } else { $el.Name }
                            Result = $el.Result
                        }
                        if ($el.Result -eq 'Fail') { $summary.FailedTests.Add($testInfo) }
                        else { $summary.WarningTests.Add($testInfo) }
                    }
                }
            }
        }
    }
    catch [Exception] {
        $summary.Error = "Failed to parse XML: $($_.Exception.Message)"
    }

    return $summary
}

#endregion

#region Main Logic

Write-Host "Indexing WSFC diagnostics at: $DiagPath" -ForegroundColor Cyan

$allFiles = Get-ChildItem -LiteralPath $DiagPath -Recurse -File
$index = [System.Collections.Generic.List[object]]::new()
$clusterLogStats = [System.Collections.Generic.List[object]]::new()
$clusterName = 'Unknown'
$nodeNames = [System.Collections.Generic.List[string]]::new()
$quorumInfo = ''
$resourceSummary = ''
$evtxSummaries = [System.Collections.Generic.List[object]]::new()
$xmlHealthSummaries = [System.Collections.Generic.List[object]]::new()

foreach ($file in $allFiles) {
    $relativePath = $file.FullName.Substring($DiagPath.TrimEnd('\', '/').Length + 1)
    $category = Get-FileCategory -FileName $file.Name

    $entry = [ordered]@{
        Name         = $file.Name
        RelativePath = $relativePath
        Category     = $category
        SizeBytes    = $file.Length
        SizeDisplay  = if ($file.Length -ge 1MB) { '{0:N1} MB' -f ($file.Length / 1MB) }
                       elseif ($file.Length -ge 1KB) { '{0:N1} KB' -f ($file.Length / 1KB) }
                       else { "$($file.Length) B" }
        LastModified = $file.LastWriteTimeUtc.ToString('o')
    }

    # Parse cluster logs for stats
    if ($category -eq 'ClusterLog' -and $file.Extension -eq '.log') {
        $tailLines = if ($file.Length -gt ($LargeLogThresholdMB * 1MB)) { $LargeLogTailLines } else { 0 }
        $parseMode = if ($tailLines -gt 0) { "tail mode — last $tailLines lines" } else { 'full scan' }
        Write-Host "  Parsing cluster log: $($file.Name) ($($entry.SizeDisplay), $parseMode)..." -ForegroundColor Yellow
        $logStats = Get-ClusterLogStats -FilePath $file.FullName -MaxLines $MaxErrorLines -FileSizeBytes $file.Length -TailLines $tailLines
        $entry['LogStats'] = $logStats
        $clusterLogStats.Add(@{ Node = $logStats.NodeName; Stats = $logStats })
        if ($logStats.NodeName -and $logStats.NodeName -notin $nodeNames) {
            $nodeNames.Add($logStats.NodeName)
        }
    }

    # Extract cluster name from Get-Cluster.txt
    if ($file.Name -eq 'Get-Cluster.txt') {
        $preview = Get-TextFilePreview -FilePath $file.FullName -Lines 10
        if ($preview -match 'Name\s*[\r\n]+[-]+\s*[\r\n]+(\S+)') {
            $clusterName = $Matches[1]
        }
        elseif ($preview -match '^\s*(\S+)\s*$') {
            $clusterName = $Matches[1]
        }
    }

    # Extract quorum info
    if ($file.Name -like 'Get-ClusterQuorum*') {
        $quorumInfo = Get-TextFilePreview -FilePath $file.FullName -Lines 20
    }

    # Extract resource summary
    if ($file.Name -like 'Get-ClusterResource*' -and -not $resourceSummary) {
        $resourceSummary = Get-TextFilePreview -FilePath $file.FullName -Lines 50
    }

    # Small config files: include preview
    if ($category -in 'ClusterConfig', 'NodeConfig', 'QuorumConfig', 'GroupConfig' -and $file.Length -lt 50KB) {
        $entry['Preview'] = Get-TextFilePreview -FilePath $file.FullName -Lines 30
    }

    # Parse .evtx event logs for FailoverClustering critical/error events
    if ($category -eq 'EventLogBinary' -or ($category -in 'SystemEventLog', 'AppEventLog' -and $file.Extension -eq '.evtx')) {
        Write-Host "  Parsing event log: $($file.Name) ($($entry.SizeDisplay))..." -ForegroundColor Yellow
        $evtxStats = Get-EvtxSummary -FilePath $file.FullName -MaxEvents $MaxErrorLines
        $entry['EvtxSummary'] = $evtxStats
        $evtxSummaries.Add($evtxStats)
    }

    # Parse XML health reports for failed/warning tests
    if ($category -in 'HealthReport', 'XMLReport' -and $file.Extension -eq '.xml') {
        Write-Host "  Parsing health report: $($file.Name) ($($entry.SizeDisplay))..." -ForegroundColor Yellow
        $xmlStats = Get-XmlHealthSummary -FilePath $file.FullName
        $entry['HealthSummary'] = $xmlStats
        $xmlHealthSummaries.Add($xmlStats)
    }

    $index.Add($entry)
}

# Write JSON index
$indexPath = Join-Path -Path $DiagPath -ChildPath '_diag_index.json'
$index | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $indexPath -Encoding utf8

# Build summary markdown
$summaryPath = Join-Path -Path $DiagPath -ChildPath '_diag_summary.md'
$sb = [System.Text.StringBuilder]::new()

[void]$sb.AppendLine('# WSFC Diagnostic Summary')
[void]$sb.AppendLine()
[void]$sb.AppendLine("**Generated**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') UTC")
[void]$sb.AppendLine("**Source**: ``$DiagPath``")
[void]$sb.AppendLine("**Cluster**: $clusterName")
[void]$sb.AppendLine("**Nodes**: $($nodeNames -join ', ')")
[void]$sb.AppendLine("**Total files**: $($allFiles.Count)")
[void]$sb.AppendLine("**Total size**: {0:N1} MB" -f (($allFiles | Measure-Object -Property Length -Sum).Sum / 1MB))
[void]$sb.AppendLine()

# Health verdict
$totalErrors   = ($clusterLogStats | ForEach-Object { $_.Stats.ErrorCount }  | Measure-Object -Sum).Sum
$totalWarnings = ($clusterLogStats | ForEach-Object { $_.Stats.WarningCount } | Measure-Object -Sum).Sum
$evtxCriticalTotal = ($evtxSummaries | Measure-Object -Property CriticalCount -Sum).Sum
$evtxErrorTotal    = ($evtxSummaries | Measure-Object -Property ErrorCount    -Sum).Sum
# Coerce null (no files of that type) to 0 for safe comparisons
$totalErrors       = [int]$totalErrors
$totalWarnings     = [int]$totalWarnings
$evtxCriticalTotal = [int]$evtxCriticalTotal
$evtxErrorTotal    = [int]$evtxErrorTotal

$verdict = if ($totalErrors -gt 20 -or $evtxCriticalTotal -gt 0) {
               'CRITICAL — Critical events or high error count detected, immediate investigation needed'
           } elseif ($totalErrors -gt 0 -or $evtxErrorTotal -gt 0) {
               'WARNING — Errors detected, review error timeline and event log summary below'
           } elseif ($totalWarnings -gt 10) {
               'CAUTION — Elevated warnings, review timeline'
           } else {
               'NOMINAL — No errors detected in cluster logs or event logs'
           }

[void]$sb.AppendLine('## Quick Health Verdict')
[void]$sb.AppendLine()
[void]$sb.AppendLine("**$verdict**")
[void]$sb.AppendLine("- Cluster log ERR entries: $totalErrors")
[void]$sb.AppendLine("- Cluster log WARN entries: $totalWarnings")
[void]$sb.AppendLine("- Event log critical events (.evtx): $evtxCriticalTotal")
[void]$sb.AppendLine("- Event log error events (.evtx): $evtxErrorTotal")
[void]$sb.AppendLine()

# Per-node summary
[void]$sb.AppendLine('## Node Log Summary')
[void]$sb.AppendLine()
[void]$sb.AppendLine('| Node | Lines | ERR | WARN | Time Range | Components |')
[void]$sb.AppendLine('|------|-------|-----|------|------------|------------|')

foreach ($entry in $clusterLogStats) {
    $s = $entry.Stats
    $timeRange = if ($s.FirstEntry -and $s.LastEntry) {
        "$($s.FirstEntry) → $($s.LastEntry)"
    } else { 'N/A' }
    $components  = ($s.Components | Sort-Object) -join ', '
    $lineDisplay = if ($s.TailOnly) { "~last $($s.TailLinesUsed) lines" } else { $s.TotalLines }
    [void]$sb.AppendLine("| $($entry.Node) | $lineDisplay | $($s.ErrorCount) | $($s.WarningCount) | $timeRange | $components |")
}
[void]$sb.AppendLine()

# Error timeline
if ($totalErrors -gt 0) {
    [void]$sb.AppendLine('## Error Timeline')
    [void]$sb.AppendLine()
    [void]$sb.AppendLine('> First errors from each node (truncated to 300 chars). Use `read_file` on the cluster log for full context.')
    [void]$sb.AppendLine()

    foreach ($entry in $clusterLogStats) {
        if ($entry.Stats.ErrorCount -gt 0) {
            [void]$sb.AppendLine("### Node: $($entry.Node) ($($entry.Stats.ErrorCount) errors)")
            [void]$sb.AppendLine()
            [void]$sb.AppendLine('```')
            $entry.Stats.TopErrors | Select-Object -First 20 | ForEach-Object {
                [void]$sb.AppendLine($_)
            }
            [void]$sb.AppendLine('```')
            [void]$sb.AppendLine()
        }
    }
}

# Warning timeline
if ($totalWarnings -gt 0) {
    [void]$sb.AppendLine('## Warning Timeline')
    [void]$sb.AppendLine()

    foreach ($entry in $clusterLogStats) {
        if ($entry.Stats.WarningCount -gt 0) {
            [void]$sb.AppendLine("### Node: $($entry.Node) ($($entry.Stats.WarningCount) warnings)")
            [void]$sb.AppendLine()
            [void]$sb.AppendLine('```')
            $entry.Stats.TopWarnings | Select-Object -First 10 | ForEach-Object {
                [void]$sb.AppendLine($_)
            }
            [void]$sb.AppendLine('```')
            [void]$sb.AppendLine()
        }
    }
}

# Quorum info
if ($quorumInfo) {
    [void]$sb.AppendLine('## Quorum Configuration')
    [void]$sb.AppendLine()
    [void]$sb.AppendLine('```')
    [void]$sb.AppendLine($quorumInfo)
    [void]$sb.AppendLine('```')
    [void]$sb.AppendLine()
}

# Resource summary
if ($resourceSummary) {
    [void]$sb.AppendLine('## Resource Status Snapshot')
    [void]$sb.AppendLine()
    [void]$sb.AppendLine('```')
    [void]$sb.AppendLine($resourceSummary)
    [void]$sb.AppendLine('```')
    [void]$sb.AppendLine()
}

# Event log summary (.evtx)
$evtxWithEvents = $evtxSummaries | Where-Object { $_.EventCount -gt 0 }
$evtxFailed     = $evtxSummaries | Where-Object { $_.Status -eq 'Failed' }
$evtxClean      = $evtxSummaries | Where-Object { $_.Status -eq 'Clean' }

if ($evtxSummaries.Count -gt 0) {
    [void]$sb.AppendLine('## Event Log Summary (.evtx)')
    [void]$sb.AppendLine()

    if ($evtxWithEvents) {
        [void]$sb.AppendLine('| Source | Critical | Error | Time Range |')
        [void]$sb.AppendLine('|--------|----------|-------|------------|')
        foreach ($evtx in $evtxWithEvents) {
            [void]$sb.AppendLine("| $($evtx.Source) | $($evtx.CriticalCount) | $($evtx.ErrorCount) | $($evtx.TimeRange) |")
        }
        [void]$sb.AppendLine()

        # Events are newest-first (Get-WinEvent default) — table shows most recent
        foreach ($evtx in $evtxWithEvents) {
            if ($evtx.Events.Count -gt 0) {
                [void]$sb.AppendLine("### $($evtx.Source) — Most Recent Events")
                [void]$sb.AppendLine()
                [void]$sb.AppendLine('| Time | ID | Level | Message (truncated) |')
                [void]$sb.AppendLine('|------|----|-------|---------------------|')
                foreach ($evt in $evtx.Events | Select-Object -First 10) {
                    $msg = $evt.Message -replace '\|', '/' -replace '\r?\n', ' '
                    [void]$sb.AppendLine("| $($evt.Time) | $($evt.Id) | $($evt.Level) | $msg |")
                }
                [void]$sb.AppendLine()
            }
        }
    }

    if ($evtxClean) {
        [void]$sb.AppendLine("✅ $($evtxClean.Count) event log file(s) scanned — no FailoverClustering critical/error events found.")
        [void]$sb.AppendLine()
    }

    if ($evtxFailed) {
        [void]$sb.AppendLine('> **Note**: Some .evtx files could not be parsed:')
        foreach ($evtx in $evtxFailed) {
            [void]$sb.AppendLine("> - $($evtx.Source): $($evtx.ErrorDetail)")
        }
        [void]$sb.AppendLine()
    }

    [void]$sb.AppendLine('> For deeper .evtx queries, run `Get-WinEvent` in the terminal. See `references/log-anatomy.md` for patterns.')
    [void]$sb.AppendLine()
}

# Health report summary (XML)
$xmlWithResults = $xmlHealthSummaries | Where-Object { $_.TotalTests -gt 0 }
$xmlWithErrors = $xmlHealthSummaries | Where-Object { $_.Error }

if ($xmlWithResults -or $xmlWithErrors) {
    [void]$sb.AppendLine('## Health Report Summary (XML)')
    [void]$sb.AppendLine()

    if ($xmlWithResults) {
        foreach ($xml in $xmlWithResults) {
            $failCount = $xml.FailedTests.Count
            $warnCount = $xml.WarningTests.Count
            $passCount = $xml.TotalTests - $failCount - $warnCount
            [void]$sb.AppendLine("### $($xml.Source)")
            [void]$sb.AppendLine()
            [void]$sb.AppendLine("- **Total tests**: $($xml.TotalTests) (✅ $passCount passed, ❌ $failCount failed, ⚠️ $warnCount warnings)")

            if ($failCount -gt 0) {
                [void]$sb.AppendLine()
                [void]$sb.AppendLine('**Failed Tests:**')
                [void]$sb.AppendLine()
                foreach ($test in $xml.FailedTests) {
                    [void]$sb.AppendLine("- ❌ $($test.Name)")
                }
            }

            if ($warnCount -gt 0) {
                [void]$sb.AppendLine()
                [void]$sb.AppendLine('**Warning Tests:**')
                [void]$sb.AppendLine()
                foreach ($test in $xml.WarningTests) {
                    [void]$sb.AppendLine("- ⚠️ $($test.Name)")
                }
            }
            [void]$sb.AppendLine()
        }

        [void]$sb.AppendLine('> For detailed health report analysis, use `Select-Xml` queries. See `references/log-anatomy.md` for patterns.')
        [void]$sb.AppendLine()
    }

    if ($xmlWithErrors) {
        [void]$sb.AppendLine('> **Note**: Some XML files could not be parsed:')
        foreach ($xml in $xmlWithErrors) {
            [void]$sb.AppendLine("> - $($xml.Source): $($xml.Error)")
        }
        [void]$sb.AppendLine()
    }
}

# File inventory
[void]$sb.AppendLine('## File Inventory')
[void]$sb.AppendLine()
[void]$sb.AppendLine('| File | Category | Size | Notes |')
[void]$sb.AppendLine('|------|----------|------|-------|')

foreach ($fileEntry in ($index | Sort-Object { $_.Category }, { $_.Name })) {
    $notes = if ($fileEntry.SizeBytes -ge 1MB) { '⚠️ Large file — use targeted line ranges' }
             elseif ($fileEntry.SizeBytes -lt 1KB) { 'Tiny — safe to read fully' }
             else { '' }
    [void]$sb.AppendLine("| ``$($fileEntry.RelativePath)`` | $($fileEntry.Category) | $($fileEntry.SizeDisplay) | $notes |")
}
[void]$sb.AppendLine()

# Agent instructions
[void]$sb.AppendLine('## Agent Analysis Instructions')
[void]$sb.AppendLine()
[void]$sb.AppendLine('1. Start with the **Quick Health Verdict** above')
[void]$sb.AppendLine('2. If errors exist, review the **Error Timeline** for initial triage')
[void]$sb.AppendLine('3. Check **Event Log Summary** and **Health Report Summary** for pre-extracted .evtx/.xml findings')
[void]$sb.AppendLine('4. Use `read_file` with specific line ranges to drill into cluster logs')
[void]$sb.AppendLine('5. Search patterns for cluster logs: `Select-String -Pattern '' ERR  '' -Path *_cluster.log`')
[void]$sb.AppendLine('6. For deeper .evtx queries, run `Get-WinEvent` in the terminal')
[void]$sb.AppendLine('7. For event ID lookups, use `mcp_microsoftdocs_microsoft_docs_search`')
[void]$sb.AppendLine('8. Cross-reference timestamps across node logs for correlation')
[void]$sb.AppendLine('9. Never read an entire cluster log file — always use targeted ranges')

$sb.ToString() | Set-Content -LiteralPath $summaryPath -Encoding utf8

Write-Host "`nIndex created: $indexPath" -ForegroundColor Green
Write-Host "Summary created: $summaryPath" -ForegroundColor Green
Write-Host "Summary size: {0:N1} KB" -f ((Get-Item -LiteralPath $summaryPath).Length / 1KB) -ForegroundColor Green

#endregion
