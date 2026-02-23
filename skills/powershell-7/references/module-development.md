# Module Development Patterns

PowerShell 7 module structure, manifests, and loader patterns. Referenced from the main [SKILL.md](../SKILL.md).

---

## Folder Structure (HIGH)

```
MyModule/
├── MyModule.psd1          # Module manifest (required)
├── MyModule.psm1          # Root module / loader
├── Public/                # Exported functions (one per file)
│   ├── Get-Thing.ps1
│   └── Set-Thing.ps1
├── Private/               # Internal functions (not exported)
│   ├── Helper.ps1
│   └── Utility.ps1
├── Data/                  # JSON/XML configuration data
├── lib/                   # Bundled dependencies
└── en-US/                 # Localization / help files
    └── MyModule-help.xml
```

---

## Module Manifest (CRITICAL)

```powershell
@{
    RootModule           = 'MyModule.psm1'
    ModuleVersion        = '1.0.0'
    GUID                 = 'unique-guid-here'
    Author               = 'Author Name'
    Description          = 'Module description'
    PowerShellVersion    = '7.2'
    CompatiblePSEditions = @('Core')
    FunctionsToExport    = @('Get-Thing', 'Set-Thing')  # NEVER use '*'
    CmdletsToExport      = @()
    VariablesToExport     = @()
    AliasesToExport       = @()
    PrivateData = @{
        PSData = @{
            Tags       = @('tag1', 'tag2')
            LicenseUri = 'https://...'
            ProjectUri = 'https://...'
        }
    }
}
```

### Manifest Rules

- **Always specify `FunctionsToExport`** explicitly — never use `'*'`
- **Set empty arrays** for `CmdletsToExport`, `VariablesToExport`, `AliasesToExport` to block accidental exports
- **`PowerShellVersion = '7.2'`** minimum for PS 7 targeting (or `'7.4'` for current LTS)
- **Use `CompatiblePSEditions = @('Core')`** for PS 7-only modules
- **Semantic versioning**: Major.Minor.Patch

---

## Root Module Loader (HIGH)

```powershell
# MyModule.psm1 — Dependency-ordered dot-sourcing
$Public = @(Get-ChildItem -Path "$PSScriptRoot/Public/*.ps1" -ErrorAction SilentlyContinue)
$Private = @(Get-ChildItem -Path "$PSScriptRoot/Private/*.ps1" -ErrorAction SilentlyContinue)

# Dot-source private first (dependencies), then public
foreach ($file in @($Private + $Public)) {
    try {
        . $file.FullName
    }
    catch {
        Write-Error "Failed to import $($file.FullName): $_"
    }
}

# Export only public functions
Export-ModuleMember -Function $Public.BaseName
```

---

## ShouldProcess Pattern

Functions that modify state must support `-WhatIf` and `-Confirm`:

```powershell
function Remove-CacheData {
    [CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
    param(
        [Parameter(Mandatory)]
        [ValidateScript({ Test-Path $_ -PathType Container })]
        [string]$CachePath
    )

    process {
        if ($PSCmdlet.ShouldProcess($CachePath, 'Remove all cache files')) {
            Remove-Item -Path (Join-Path $CachePath '*') -Recurse -Force
        }
    }
}
```

- Use `ConfirmImpact = 'High'` for destructive operations (auto-prompts for confirmation)
- Pass `-WhatIf:$WhatIfPreference` explicitly to called cmdlets
- `ShouldProcess` doubles as verbose output automatically

---

## Publishing Checklist

- [ ] `FunctionsToExport` lists only public functions
- [ ] `GUID` is a unique GUID (use `New-Guid`)
- [ ] `Description` is non-empty
- [ ] `PowerShellVersion` set to minimum required
- [ ] All exported functions have `[CmdletBinding()]`
- [ ] All exported functions have comment-based help or XML help
- [ ] Module loads without errors: `Import-Module ./MyModule.psd1 -Force`

---

## References

- [Module Manifest Guide](https://learn.microsoft.com/en-us/powershell/scripting/developer/module/how-to-write-a-powershell-module-manifest?view=powershell-7.5)
- [PowerShell Gallery Publishing Guidelines](https://learn.microsoft.com/en-us/powershell/gallery/concepts/publishing-guidelines)
- [Everything about ShouldProcess](https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/everything-about-shouldprocess?view=powershell-7.5)
