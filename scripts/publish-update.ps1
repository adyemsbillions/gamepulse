# Publish an over-the-air update (EAS Update) to the production channel.
#
#   powershell -ExecutionPolicy Bypass -File scripts\publish-update.ps1 -Message "What changed"
#
# `eas update --environment production` takes env vars from EAS, not .env.local, so a plain run
# ships a bundle without the Supabase keys and the app falls back to sample data. This script
# bundles with the keys from .env.local, checks they're inside, and only then publishes that bundle.
param(
  [Parameter(Mandatory = $true)][string]$Message,
  [string]$Channel = 'production'
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$env:CI = '1'
$env:NODE_ENV = 'production'
$env:EAS_SKIP_AUTO_FINGERPRINT = '1'

foreach ($line in Get-Content '.env.local') {
  if ($line -match '^\s*(EXPO_PUBLIC_[A-Z_]+)\s*=\s*(.+?)\s*$') {
    Set-Item -Path ("env:" + $Matches[1]) -Value ($Matches[2].Trim('"'))
  }
}
if (-not $env:EXPO_PUBLIC_SUPABASE_URL) { throw '.env.local has no EXPO_PUBLIC_SUPABASE_URL' }
$host_ = ([Uri]$env:EXPO_PUBLIC_SUPABASE_URL).Host

if (Test-Path dist) { Remove-Item -Recurse -Force dist }
# --clear: Metro's cache can hold files transformed without the keys (e.g. from a plain eas update).
npx expo export --platform android --output-dir dist --clear
if ($LASTEXITCODE -ne 0) { throw 'expo export failed' }

$bundle = Get-ChildItem 'dist\_expo\static\js\android\*.hbc' | Select-Object -First 1
$text = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($bundle.FullName))
if (-not $text.Contains($host_)) { throw "Bundle is missing $host_; not publishing." }
Write-Host "Bundle checked: $host_ present." -ForegroundColor Green

npx eas-cli@latest update --channel $Channel --environment production --platform android --non-interactive --skip-bundler --input-dir dist --message $Message
if ($LASTEXITCODE -ne 0) { throw 'eas update failed (if it was a network error, run this again)' }
