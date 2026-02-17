---
description: 'PowerShell 7.5+ coding standards and cross-platform compatibility patterns'
applyTo: '**/*.ps1'
---

# PowerShell Development Standards

## Language Requirements

- **PowerShell 7.5+** syntax only (no Windows PowerShell 5.1 compatibility)
- Cross-platform by default (Windows, Linux, macOS, containers)
- Use `Join-Path` for all path operations (never hardcode `\` or `/`)

## Function Structure

```powershell
function Verb-Noun {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateNotNullOrEmpty()]
        [string]$Name,

        [Parameter()]
        [ValidateScript({Test-Path $_ -PathType Container})]
        [string]$Path
    )

    try {
        # Implementation
    }
    catch {
        Write-Error "Error processing '$Name': $_"
        throw
    }
}
```

**Function Rules:**
- ✅ Always use `[CmdletBinding()]` on public functions
- ✅ Use `[ValidateScript()]`, `[ValidateSet()]`, `[ValidateNotNullOrEmpty()]` for input validation
- ✅ Use `[Parameter(Mandatory)]` for required parameters
- ✅ Prefix unused parameters with `_` (e.g., `$_options`)

## Performance Patterns

- **Use `[System.Collections.Generic.List[Object]]`** for loops, never `@() +=`
- **Use `$script:` hashtable caches** for O(1) lookups — never repeated lookups in loops
- **Stream with `Get-ChildItem -File`** for large directories
- **Use `-ErrorAction Stop`** in try blocks for proper exception handling
- **Suppress output with `$null =`** assignment (faster than `| Out-Null` in loops)
- **Set-based operations** — process collections as wholes, never row-by-row

```powershell
# ✅ GOOD: O(1) lookup cache
$script:Lookup = @{}
$items | ForEach-Object { $script:Lookup[$_.Id] = $_.Name }

# ❌ BAD: O(n) per-item lookup
$name = ($items | Where-Object { $_.Id -eq $targetId }).Name
```

## Security Patterns

- **Never hardcode credentials** — use environment variables or SecretManagement module
- **Validate all user input** — use `[ValidateScript()]` parameter attributes
- **Use `-LiteralPath`** when accepting user-provided paths (prevents wildcard injection)
- **Escape regex patterns** from user input with `[regex]::Escape()`

## Error Message Formatting

```powershell
# Include context and suggest action
Write-Error "Failed to process file '$($file.Name)': Access denied. Check file permissions and retry."

# Write-Verbose for debug info (respects -Verbose preference)
Write-Verbose "Processing file: $($file.FullName)"

# Write-Warning for non-blocking issues
Write-Warning "Skipped inaccessible directory: $path"
```

## Advanced Error Handling

```powershell
# In [CmdletBinding()] functions, use proper ErrorRecord construction
if (-not (Test-Path $Path)) {
    $errorRecord = [System.Management.Automation.ErrorRecord]::new(
        [System.Exception]::new("Path not found: $Path"),
        'PathNotFound',
        [System.Management.Automation.ErrorCategory]::ObjectNotFound,
        $Path
    )
    $PSCmdlet.WriteError($errorRecord)  # Non-terminating
    # OR
    $PSCmdlet.ThrowTerminatingError($errorRecord)  # Terminating
}
```

## ShouldProcess Pattern (WhatIf/Confirm Support)

```powershell
function Remove-CacheFile {
    [CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
    param([Parameter(Mandatory)][string]$Path)

    if ($PSCmdlet.ShouldProcess($Path, "Remove cache file")) {
        Remove-Item -Path $Path -Force
    }
}
# Use: -WhatIf (preview), -Confirm (prompt), ConfirmImpact: Low/Medium/High
```

## Module Patterns

- **Public functions**: Export from module manifest `FunctionsToExport`
- **Private functions**: Place in `Private/` or `src/private/`, dot-source in `.psm1`
- **Nested modules**: Use `NestedModules` for domain-specific sub-modules
- **Module-level caches**: Use `$script:` scope for hashtables and lookup tables

## Null Safety Patterns

```powershell
# ❌ BAD: Direct property access on potentially null collection
for ($i = 0; $i -lt $items.Count; $i++) { }  # Fails if $items is $null

# ✅ GOOD: Check for null/empty before accessing properties
if ($items -and $items.Count -gt 0) {
    for ($i = 0; $i -lt $items.Count; $i++) { }
}

# ❌ BAD: Measure-Object properties when collection is empty
$totalSize = ($files | Measure-Object -Property Length -Sum).Sum  # .Sum is $null if no files

# ✅ GOOD: Safe property access with fallback
$stats = $files | Measure-Object -Property Length -Sum
$totalSize = if ($stats -and $stats.Sum) { $stats.Sum } else { 0 }
```

## Validation

```powershell
# Run tests before commit
Invoke-Build Test

# Analyze code quality
Invoke-ScriptAnalyzer -Path '.' -Recurse -Settings ./PSScriptAnalyzerSettings.psd1
```
