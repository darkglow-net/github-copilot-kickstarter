---
description: 'InvokeBuild task patterns for PowerShell build automation'
applyTo: '**/*.build.ps1'
---

# InvokeBuild Development Standards

## Build File Structure

```powershell
# Project.build.ps1 — InvokeBuild task definitions
param(
    [string]$Version,
    [string]$TestFile
)

# Synopsis: Run PSScriptAnalyzer on source files
task Analyze {
    $results = Invoke-ScriptAnalyzer -Path './src' -Recurse -Settings ./PSScriptAnalyzerSettings.psd1
    if ($results) {
        $results | Format-Table RuleName, Severity, ScriptName, Line, Message -AutoSize
        throw "PSScriptAnalyzer found $($results.Count) issue(s)"
    }
}

# Synopsis: Run Pester tests
task Test {
    $config = New-PesterConfiguration
    $config.Run.Path = if ($TestFile) { $TestFile } else { './tests' }
    $config.Output.Verbosity = 'Normal'
    $config.TestResult.Enabled = $true

    $result = Invoke-Pester -Configuration $config
    if ($result.FailedCount -gt 0) {
        throw "$($result.FailedCount) test(s) failed"
    }
}

# Synopsis: Default task — Analyze then Test
task . Analyze, Test
```

## Common Task Patterns

### Release Task

```powershell
# Synopsis: Bump version and update cascading files
task Release {
    if (-not $Version) { throw "Version parameter required: Invoke-Build Release -Version '1.2.3'" }

    # Update module manifest
    Update-ModuleManifest -Path './Module.psd1' -ModuleVersion $Version

    # Update CHANGELOG
    $date = Get-Date -Format 'yyyy-MM-dd'
    $header = "## [$Version] - $date"
    $changelog = Get-Content './CHANGELOG.md' -Raw
    $changelog = $changelog -replace '## \[Unreleased\]', "## [Unreleased]`n`n$header"
    Set-Content './CHANGELOG.md' -Value $changelog
}
```

### Clean Task

```powershell
# Synopsis: Remove build artifacts
task Clean {
    $paths = @('./build', './release', './TestResults')
    foreach ($path in $paths) {
        if (Test-Path $path) {
            Remove-Item $path -Recurse -Force
            Write-Build Green "Removed: $path"
        }
    }
}
```

### Package Task

```powershell
# Synopsis: Package module for distribution
task Package Analyze, Test, {
    $buildPath = Join-Path './build' 'ModuleName'
    New-Item -Path $buildPath -ItemType Directory -Force | Out-Null

    # Copy module files
    Copy-Item -Path './ModuleName.psd1' -Destination $buildPath
    Copy-Item -Path './ModuleName.psm1' -Destination $buildPath
    Copy-Item -Path './src' -Destination $buildPath -Recurse
}
```

## Task Conventions

- ✅ Use `task .` for the default composite task (typically `Analyze, Test`)
- ✅ Add `# Synopsis:` comment above each task for documentation
- ✅ Use `param()` block for configurable values (version, test file)
- ✅ Use `Write-Build` for colored build output
- ✅ Throw on failure — InvokeBuild catches and reports
- ✅ Chain dependent tasks: `task Package Analyze, Test, { ... }`

## VS Code Integration

```json
{
    "label": "InvokeBuild: Default (Analyze + Test)",
    "type": "shell",
    "command": "pwsh",
    "args": ["-NoProfile", "-Command", "Invoke-Build -File ./Project.build.ps1"],
    "group": { "kind": "build", "isDefault": true }
}
```

## Validation

```powershell
# Run default task (Analyze + Test)
Invoke-Build

# Run specific task
Invoke-Build Test

# Run tests for single file
Invoke-Build Test -TestFile './tests/MyModule.Tests.ps1'

# Release with version
Invoke-Build Release -Version '1.2.0'
```
