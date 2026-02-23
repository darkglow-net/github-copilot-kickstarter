---
description: 'PowerShell 7.5+ coding standards and cross-platform compatibility patterns'
applyTo: '**/*.ps1'
---

# PowerShell Development Standards

## Language Requirements

- **PowerShell 7.5+** syntax only (no Windows PowerShell 5.1 compatibility)
- Cross-platform by default (Windows, Linux, macOS, containers)
- `Join-Path` for all path operations (never hardcode `\` or `/`)
- Full cmdlet names only — never aliases (`gci`, `?`, `%`) in scripts

## Function Structure

```powershell
function Verb-Noun {
    [CmdletBinding()]
    [OutputType([pscustomobject])]
    param(
        [Parameter(Mandatory)]
        [ValidateNotNullOrEmpty()]
        [string]$Name,

        [Parameter()]
        [ValidateScript({Test-Path $_ -PathType Container})]
        [string]$Path
    )

    process {
        try {
            $result = Get-Item -LiteralPath $Path -ErrorAction Stop
            $result
        }
        catch {
            $PSCmdlet.ThrowTerminatingError($PSItem)
        }
    }
}
```

**Function Rules:**
- Always `[CmdletBinding()]` — enables `-Verbose`, `-ErrorAction`, common parameters
- Always `[OutputType()]` — documents return type for callers and tooling
- Validate every parameter — `[ValidateNotNullOrEmpty()]`, `[ValidateSet()]`, `[ValidateRange()]`, `[ValidateScript()]`
- `SupportsShouldProcess` on any function that modifies state
- `-LiteralPath` for user-provided paths (prevents wildcard injection)
- Prefix unused parameters with `_` (e.g., `$_options`)

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Functions | Verb-Noun (approved verbs) | `Get-UserProfile` |
| Parameters | PascalCase | `$OutputPath` |
| Local variables | camelCase | `$itemCount` |
| Script scope | `$script:PascalCase` | `$script:CacheData` |
| Constants | UPPER_SNAKE_CASE | `$MAX_RETRIES` |

## Error Handling

```powershell
# Typed exceptions for specific errors
throw [System.IO.FileNotFoundException]::new("Config not found: $path")
throw [System.ArgumentException]::new("Invalid format: $format")
```

- `-ErrorAction Stop` inside `try` — converts non-terminating to terminating
- `$PSCmdlet.ThrowTerminatingError($PSItem)` — error points at caller, not internals
- Never empty catch blocks — at minimum log the error
- Include context in error messages: what failed, what value, what to do

## Performance Patterns

```powershell
# FASTEST: Direct loop assignment (preferred)
$results = foreach ($item in $collection) { Process-Item $item }

# GOOD: List<T> for complex accumulation
$list = [System.Collections.Generic.List[object]]::new()
foreach ($item in $collection) { $list.Add((Process-Item $item)) }

# NEVER: += in loops (copies entire array each iteration)
```

- **Hashtable caches** for O(1) lookups — never `Where-Object` in loops
- **`$null =`** for output suppression (fastest)
- **`-join`** for string building in loops — never `+=` concatenation
- **`[pscustomobject]@{}`** for object creation — 5-7x faster than `New-Object`
- **Set-based operations** — process collections as wholes, never row-by-row

## PowerShell 7+ Operators

```powershell
$status = $isActive ? 'Active' : 'Inactive'   # Ternary
$value = $config.Setting ?? 'default'          # Null-coalescing
$config.Timeout ??= 30                         # Null-coalescing assignment
```

## Splatting

```powershell
# Preferred for 3+ parameters
$params = @{ Path = $source; Destination = $dest; Force = $true }
Copy-Item @params
```

## Security Patterns

- **Never hardcode credentials** — use `[PSCredential]`, environment variables, or `SecretManagement`
- **Validate all user input** — use `[ValidateScript()]` parameter attributes
- **Use `-LiteralPath`** for user-provided paths (prevents wildcard injection)
- **Escape regex** from user input with `[regex]::Escape()`
- **Never `Invoke-Expression`** with user input

## Output Streams

```powershell
Write-Verbose "Debug-level detail"           # -Verbose to see
Write-Information "Informational message"     # -InformationAction to see
Write-Warning "Non-blocking issue"            # Always visible
Write-Error "Error with context"             # Error stream
# Never Write-Host in functions — bypasses output streams
```

## Module Patterns

- **Public functions**: Export explicitly from manifest `FunctionsToExport` — never `'*'`
- **Private functions**: Place in `Private/`, dot-source in `.psm1`
- **Module-level caches**: Use `$script:` scope for hashtables and lookup tables

## Null Safety

- `$null` always on the left: `if ($null -eq $value)` — PSScriptAnalyzer rule
- Check before property access: `if ($items -and $items.Count -gt 0)`
- Guarantee array from pipeline: `$results = @(Get-ChildItem ...)`

## Validation

```powershell
Invoke-Build Test
Invoke-ScriptAnalyzer -Path '.' -Recurse -Settings ./PSScriptAnalyzerSettings.psd1
```

> **Deep reference**: The `powershell-7` skill provides benchmarks, Pester 5 testing patterns, module development, cross-platform details, anti-patterns, and PSScriptAnalyzer configuration.
