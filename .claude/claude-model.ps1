param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("north","laguna","nex","nemotron","auto")]
    [string]$Model
)

$models = @{
    north    = "cohere/north-mini-code:free"
    laguna   = "poolside/laguna-xs-2.1:free"
    nex      = "nex-agi/nex-n2.5-mini:free"
    nemotron = "nvidia/nemotron-3-ultra-550b-a55b:free"
    auto     = "openrouter/free"
}

$selected = $models[$Model]

$env:ANTHROPIC_MODEL = $selected
$env:ANTHROPIC_DEFAULT_OPUS_MODEL = $selected
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = $selected
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $selected
$env:CLAUDE_CODE_SUBAGENT_MODEL = $selected

Write-Host ""
Write-Host "Starting Claude Code with:"
Write-Host $selected
Write-Host ""

claude