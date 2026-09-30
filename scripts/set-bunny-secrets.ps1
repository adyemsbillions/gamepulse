# Sets the Bunny Stream secrets for the `videos` Edge Function and deploys it.
# The two keys are typed at the prompt (hidden). They are never written to a file,
# the repo, or PowerShell history.
#
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File scripts\set-bunny-secrets.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Read-Secret([string]$label) {
  $secure = Read-Host $label -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$libraryId = '765524'
$cdnHost   = 'vz-98afcc0a-c40.b-cdn.net'

Write-Host "GamePulse - Bunny secrets for library $libraryId ($cdnHost)" -ForegroundColor Cyan
$apiKey = Read-Secret 'Bunny API Key (the new, reset one)'
$roKey  = Read-Secret 'Bunny Read-only API Key (the new, reset one)'
if (-not $apiKey -or -not $roKey) { throw 'Both keys are required.' }

Write-Host "`nSetting secrets..." -ForegroundColor Cyan
npx supabase secrets set "BUNNY_LIBRARY_ID=$libraryId" "BUNNY_CDN_HOSTNAME=$cdnHost" "BUNNY_API_KEY=$apiKey" "BUNNY_READONLY_API_KEY=$roKey"
if ($LASTEXITCODE -ne 0) { throw 'Setting secrets failed. Run "npx supabase login" first, then run this script again.' }
Remove-Variable apiKey, roKey

Write-Host "`nDeploying the videos function..." -ForegroundColor Cyan
npx supabase functions deploy videos --no-verify-jwt --use-api
if ($LASTEXITCODE -ne 0) { throw 'Deploy failed. Paste the error above to Claude (not the keys).' }

Write-Host "`nSecrets on the project:" -ForegroundColor Cyan
npx supabase secrets list

Write-Host "`nDone. Last step: in Bunny, set the library's Webhook URL to:" -ForegroundColor Green
Write-Host "https://priumjuvygdulevqxkza.supabase.co/functions/v1/videos/webhook" -ForegroundColor Green
