param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
$taskVenv = Join-Path $taskProject '.venv-background'
$taskInterpreter = Join-Path $taskVenv 'Scripts/python.exe'
Write-Host 'Optional local portrait removal. Requires Python 3.12-3.13 and one-time internet access.'
Write-Host 'Installs only inside this project; no administrator rights or system font changes.'
& $Python -c 'import sys; assert (3,12) <= sys.version_info[:2] < (3,14), "Use Python 3.12-3.13"'
if ($LASTEXITCODE -ne 0) { throw 'Python 3.12-3.13 is required.' }
& $Python -m venv $taskVenv
if ($LASTEXITCODE -ne 0) { throw 'Could not create the project virtual environment.' }
& $taskInterpreter -m pip install -r (Join-Path $PSScriptRoot 'portrait-requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your network and retry.' }
$env:U2NET_HOME = Join-Path $taskProject 'runtime/background'
& $taskInterpreter (Join-Path $PSScriptRoot 'setup-portrait.py') $env:U2NET_HOME
if ($LASTEXITCODE -ne 0) { throw 'Model setup failed. Check your network and retry.' }
Write-Host 'Ready. Return to the pre-match roster and click the environment check button.'
