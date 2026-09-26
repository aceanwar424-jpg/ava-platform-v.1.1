# ============================================================
# Claude Code + OpenRouter Free Model Launcher
# ============================================================

param(
    [ValidateSet(
        "north",
        "laguna",
        "nex",
        "nexpro",
        "nemotron",
        "nemotron35",
        "dots",
        "ling",
        "auto"
    )]
    [string]$Model
)

# ------------------------------------------------------------
# AVAILABLE MODELS
# ------------------------------------------------------------

$models = [ordered]@{

    north = @{
        Name = "North Mini Code"
        ID   = "cohere/north-mini-code:free"
        Info = "Coding / Terminal / Agentic"
    }

    laguna = @{
        Name = "Laguna XS 2.1"
        ID   = "poolside/laguna-xs-2.1:free"
        Info = "Agentic Coding / Tools / Reasoning"
    }

    nex = @{
        Name = "Nex N2.5 Mini"
        ID   = "nex-agi/nex-n2.5-mini:free"
        Info = "Coding / Multi-file / Testing"
    }

    nexpro = @{
        Name = "Nex N2.5 Pro"
        ID   = "nex-agi/nex-n2.5-pro:free"
        Info = "Advanced Coding Agent"
    }

    nemotron = @{
        Name = "Nemotron 3 Ultra"
        ID   = "nvidia/nemotron-3-ultra-550b-a55b:free"
        Info = "Large Codebase / Reasoning"
    }

    nemotron35 = @{
        Name = "Nemotron 3.5 Lightning"
        ID   = "nvidia/nemotron-3.5-lightning:free"
        Info = "Fast Agentic / Tool Calling"
    }

    dots = @{
        Name = "Dots3 Note Preview"
        ID   = "dots-studio/dots3-note-preview:free"
        Info = "Coding / Agent Workflow"
    }

    ling = @{
        Name = "Ling 3.0 Flash VL"
        ID   = "inclusionai/ling-3.0-flash-vl:free"
        Info = "Reasoning / Tool Calling"
    }

    auto = @{
        Name = "OpenRouter Free Auto"
        ID   = "openrouter/free"
        Info = "Automatic Free Model Router"
    }
}


# ------------------------------------------------------------
# INTERACTIVE MENU
# ------------------------------------------------------------

if (-not $Model) {

    Clear-Host

    Write-Host ""
    Write-Host "========================================================"
    Write-Host "        CLAUDE CODE - OPENROUTER MODEL SELECTOR"
    Write-Host "========================================================"
    Write-Host ""

    Write-Host "  1. North Mini Code"
    Write-Host "     Coding / Terminal / Agentic"
    Write-Host ""

    Write-Host "  2. Laguna XS 2.1"
    Write-Host "     Agentic Coding / Tools / Reasoning"
    Write-Host ""

    Write-Host "  3. Nex N2.5 Mini"
    Write-Host "     Coding / Multi-file / Testing"
    Write-Host ""

    Write-Host "  4. Nex N2.5 Pro"
    Write-Host "     Advanced Coding Agent"
    Write-Host ""

    Write-Host "  5. Nemotron 3 Ultra"
    Write-Host "     Large Codebase / Reasoning"
    Write-Host ""

    Write-Host "  6. Nemotron 3.5 Lightning"
    Write-Host "     Fast Agentic / Tool Calling"
    Write-Host ""

    Write-Host "  7. Dots3 Note Preview"
    Write-Host "     Coding / Agent Workflow"
    Write-Host ""

    Write-Host "  8. Ling 3.0 Flash VL"
    Write-Host "     Reasoning / Tool Calling"
    Write-Host ""

    Write-Host "  9. OpenRouter Free Auto"
    Write-Host "     Automatic Free Model Router"
    Write-Host ""

    Write-Host "  0. Exit"
    Write-Host ""

    $choice = Read-Host "Select model"

    switch ($choice) {

        "1" { $Model = "north" }

        "2" { $Model = "laguna" }

        "3" { $Model = "nex" }

        "4" { $Model = "nexpro" }

        "5" { $Model = "nemotron" }

        "6" { $Model = "nemotron35" }

        "7" { $Model = "dots" }

        "8" { $Model = "ling" }

        "9" { $Model = "auto" }

        "0" {
            Write-Host ""
            Write-Host "Cancelled."
            exit
        }

        default {
            Write-Host ""
            Write-Host "Invalid selection."
            exit 1
        }
    }
}


# ------------------------------------------------------------
# SELECT MODEL
# ------------------------------------------------------------

$selected = $models[$Model]

if (-not $selected) {

    Write-Host ""
    Write-Host "Model not found."
    exit 1
}


# ------------------------------------------------------------
# CLEAR OLD MODEL OVERRIDES
# ------------------------------------------------------------

Remove-Item Env:ANTHROPIC_MODEL -ErrorAction SilentlyContinue
Remove-Item Env:ANTHROPIC_DEFAULT_OPUS_MODEL -ErrorAction SilentlyContinue
Remove-Item Env:ANTHROPIC_DEFAULT_SONNET_MODEL -ErrorAction SilentlyContinue
Remove-Item Env:ANTHROPIC_DEFAULT_HAIKU_MODEL -ErrorAction SilentlyContinue
Remove-Item Env:CLAUDE_CODE_SUBAGENT_MODEL -ErrorAction SilentlyContinue


# ------------------------------------------------------------
# SET SELECTED MODEL
# ------------------------------------------------------------

$env:ANTHROPIC_MODEL = $selected.ID

$env:ANTHROPIC_DEFAULT_OPUS_MODEL = $selected.ID
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = $selected.ID
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $selected.ID

$env:CLAUDE_CODE_SUBAGENT_MODEL = $selected.ID


# ------------------------------------------------------------
# DISPLAY CONFIGURATION
# ------------------------------------------------------------

Clear-Host

Write-Host ""
Write-Host "========================================================"
Write-Host "              STARTING CLAUDE CODE"
Write-Host "========================================================"
Write-Host ""

Write-Host "Model : $($selected.Name)"
Write-Host "ID    : $($selected.ID)"
Write-Host "Use   : $($selected.Info)"

Write-Host ""
Write-Host "Project:"
Write-Host "$(Get-Location)"

Write-Host ""
Write-Host "Launching Claude Code..."
Write-Host ""


# ------------------------------------------------------------
# START CLAUDE CODE
# ------------------------------------------------------------

claude
