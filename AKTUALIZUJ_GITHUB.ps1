$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$env:GIT_TERMINAL_PROMPT = "0"
$env:GCM_INTERACTIVE = "Never"

$RepoUrl = "https://github.com/tomalawsb/Angielski-nauka-.git"
$Branch = "main"
$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PublishDir = Join-Path $env:TEMP "Angielski-nauka-publish"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Nie znaleziono programu Git. Zainstaluj Git for Windows."
}

if (Test-Path $PublishDir) {
    Remove-Item $PublishDir -Recurse -Force
}

git clone $RepoUrl $PublishDir
if ($LASTEXITCODE -ne 0) {
    throw "Nie udało się pobrać repozytorium. Sprawdź połączenie i zapisane logowanie GitHub."
}

Get-ChildItem -LiteralPath $PublishDir -Force |
    Where-Object { $_.Name -ne ".git" } |
    Remove-Item -Recurse -Force

Get-ChildItem -LiteralPath $SourceDir -Force |
    Where-Object {
        $_.Name -ne ".git" -and
        $_.Extension -notin @(".zip", ".log")
    } |
    Copy-Item -Destination $PublishDir -Recurse -Force

Set-Location $PublishDir

git checkout -B $Branch
if ($LASTEXITCODE -ne 0) {
    throw "Nie udało się ustawić gałęzi $Branch."
}

if (-not (git config user.name)) {
    git config user.name "tomalawsb"
}
if (-not (git config user.email)) {
    git config user.email "tomalawsb@users.noreply.github.com"
}

git add -A

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "Repozytorium jest już aktualne."
    exit 0
}

$CommitMessage = "Aktualizacja aplikacji v5.7.3 - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git commit -m $CommitMessage
if ($LASTEXITCODE -ne 0) {
    throw "Nie udało się utworzyć commita."
}

git push origin "HEAD:$Branch"
if ($LASTEXITCODE -ne 0) {
    throw "Nie udało się wysłać zmian do GitHub. Sprawdź zapisane uwierzytelnienie."
}

Write-Host "GitHub zaktualizowany: $RepoUrl ($Branch)"
