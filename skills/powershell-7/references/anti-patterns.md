# Anti-Patterns & Migration Gotchas

Common mistakes to avoid in PowerShell 7 development, plus 5.1→7 migration pitfalls. Referenced from the main [SKILL.md](../SKILL.md).

---

## Anti-Pattern Checklist (CRITICAL)

| Anti-Pattern | Do This Instead |
|-------------|----------------|
| `+= @()` in loops | `$list = [System.Collections.Generic.List[object]]::new()` then `$list.Add()` — or direct loop assignment `$results = foreach (...) { ... }` |
| `Write-Host` in functions | `Write-Verbose`, `Write-Information`, or `Write-Warning` |
| Bare `catch {}` | `catch [SpecificException]` with logging/re-throw |
| Hardcoded `\` or `/` path separators | `Join-Path` or `[IO.Path]::Combine()` |
| `$null -eq $var` reversed | Always put `$null` on the left: `if ($null -eq $value)` |
| String concatenation in loops | `[System.Text.StringBuilder]` or `-join` operator |
| `Invoke-Expression` with user input | Use splatting, `& $command`, or parameterized alternatives |
| No `[CmdletBinding()]` | Always add `[CmdletBinding()]` to every function |
| Missing `-ErrorAction Stop` | Use `-ErrorAction Stop` inside `try` blocks for non-terminating cmdlets |
| `Select-Object *` in pipeline | Select only needed properties: `Select-Object Name, Id, Status` |
| Missing `$ErrorActionPreference` in scripts | Set `$ErrorActionPreference = 'Stop'` at script scope for fail-fast |
| Global variables for state | Pass state through parameters; use `$script:` only in module-scoped singletons |
| `Format-*` cmdlets in functions | Return objects; let the caller format — `Format-Table` destroys object data |
| Aliases in scripts | Use full cmdlet names: `Where-Object` not `?`, `ForEach-Object` not `%` |
| Not disposing .NET objects | Use `try/finally` with `.Dispose()` for `StreamReader`, `HttpClient`, etc. |

---

## Windows PowerShell 5.1 → PowerShell 7 Migration

| 5.1 Pattern | 7.x Replacement | Notes |
|------------|-----------------|-------|
| `$PSScriptRoot` in modules | Works the same | No change needed |
| Removed aliases (`curl`, `wget`, `sort`) | Use full cmdlet names | `Invoke-WebRequest`, `Sort-Object` |
| `[void]` or `Out-Null` for output suppression | `$null = ...` preferred | Fastest in 7.x |
| COM objects (`New-Object -ComObject`) | Not available on Linux/macOS | Use .NET alternatives or platform guards |
| WMI (`Get-WmiObject`) | `Get-CimInstance` | WMI removed in 7.x |
| `Start-Sleep -Milliseconds` | Same, but consider async | 7.x supports `ForEach-Object -Parallel` |
| PowerShell Workflows | Not supported in 7.x | Use `ForEach-Object -Parallel` or runspaces |
| DSC v1 resources | DSC v3 (machine configuration) | Different architecture |
| `$Host.UI.RawUI` window manipulation | Not portable | Use ANSI escape sequences instead |
| ISE-specific `$psISE` | Not available | Use VS Code + PowerShell extension |
| `-UseBasicParsing` on `Invoke-WebRequest` | Default in 7.x | No longer needed |

---

## Diagnostic Patterns

### Identify 5.1-isms in Your Code

```powershell
# Search for common 5.1 patterns that need updating
$patterns = @(
    'Get-WmiObject'
    'New-Object -ComObject'
    '\bsort\b(?!\s*-)'      # bare 'sort' alias
    '\bcurl\b'               # bare 'curl' alias
    'Write-Host'
    '\+=\s*@\('              # array concatenation in loops
)

Get-ChildItem -Path ./src -Recurse -Filter *.ps1 |
    Select-String -Pattern $patterns
```

### Verify Cross-Platform Compatibility

```powershell
# Quick check for Windows-only patterns
Get-ChildItem -Path ./src -Recurse -Filter *.ps1 |
    Select-String -Pattern '\\\\|C:\\|HKLM:|HKCU:|Registry::|Get-WmiObject' |
    ForEach-Object { Write-Warning "$($_.Filename):$($_.LineNumber) — $_" }
```

---

## References

- [Migrating from Windows PowerShell 5.1 to PowerShell 7](https://learn.microsoft.com/en-us/powershell/scripting/whats-new/migrating-from-windows-powershell-51-to-powershell-7)
- [Differences between Windows PowerShell 5.1 and PowerShell 7.x](https://learn.microsoft.com/en-us/powershell/scripting/whats-new/differences-from-windows-powershell)
- [PSScriptAnalyzer Rules](https://learn.microsoft.com/en-us/powershell/utility-modules/psscriptanalyzer/rules/readme)
