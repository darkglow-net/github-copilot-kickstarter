@{
    # PSScriptAnalyzer Settings for PowerShell 7 Projects
    # Drop into project root and reference with:
    #   Invoke-ScriptAnalyzer -Path ./src -Settings ./PSScriptAnalyzerSettings.psd1 -Recurse

    Rules = @{
        # Enforce approved verbs for exported functions
        PSUseApprovedVerbs                    = @{ Enable = $true }

        # Require [CmdletBinding()] on all functions
        PSUseCmdletCorrectly                  = @{ Enable = $true }

        # Require [OutputType()] attribute
        PSUseOutputTypeCorrectly              = @{ Enable = $true }

        # Enforce ShouldProcess on state-changing functions
        PSUseShouldProcessForStateChangingFunctions = @{ Enable = $true }

        # Flag aliases — use full cmdlet names in scripts
        PSAvoidUsingCmdletAliases             = @{ Enable = $true }

        # Block Write-Host in function/module code
        PSAvoidUsingWriteHost                 = @{ Enable = $true }

        # Block positional parameters for clarity
        PSAvoidUsingPositionalParameters      = @{ Enable = $true }

        # Require explicit -Scope on Get-Variable / Set-Variable
        PSAvoidGlobalVars                     = @{ Enable = $true }

        # Flag hardcoded credentials and plaintext passwords
        PSAvoidUsingPlainTextForPassword      = @{ Enable = $true }
        PSAvoidUsingConvertToSecureStringWithPlainText = @{ Enable = $true }

        # Flag Invoke-Expression (security risk)
        PSAvoidUsingInvokeExpression           = @{ Enable = $true }

        # Flag empty catch blocks
        PSAvoidUsingEmptyCatchBlock           = @{ Enable = $true }

        # Require $null on left side of comparisons
        PSPossibleIncorrectComparisonWithNull  = @{ Enable = $true }

        # Compatibility: target PowerShell 7.x only
        PSUseCompatibleSyntax                 = @{
            Enable         = $true
            TargetVersions = @('7.0')
        }

        # Formatting rules (customize to team preferences)
        PSPlaceOpenBrace                      = @{
            Enable             = $true
            OnSameLine         = $true
            NewLineAfter       = $true
            IgnoreOneLineBlock = $true
        }
        PSPlaceCloseBrace                     = @{
            Enable             = $true
            NewLineAfter       = $true
            IgnoreOneLineBlock = $true
            NoEmptyLineBefore  = $false
        }
        PSUseConsistentIndentation            = @{
            Enable          = $true
            IndentationSize = 4
            PipelineIndentation = 'IncreaseIndentationForFirstPipeline'
            Kind            = 'space'
        }
        PSUseConsistentWhitespace             = @{
            Enable                          = $true
            CheckInnerBrace                 = $true
            CheckOpenBrace                  = $true
            CheckOpenParen                  = $true
            CheckOperator                   = $true
            CheckPipe                       = $true
            CheckPipeForRedundantWhitespace = $true
            CheckSeparator                  = $true
            IgnoreAssignmentOperatorInsideHashTable = $false
        }
    }

    # Exclude generated/vendored paths
    ExcludeRules = @()
}
