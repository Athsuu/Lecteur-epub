<#
backup.ps1
Crée des backups ZIP horodatés du dépôt dans le dossier .backups
Usage: PowerShell -NoProfile -ExecutionPolicy Bypass -File .\backup.ps1
#>

# Emplacement du repo (script doit être placé à la racine du repo)
$repo = $PSScriptRoot
$destDir = Join-Path $repo ".backups"
if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir | Out-Null }

$timestamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
$zipName = "backup-$timestamp.zip"
$zipPath = Join-Path $destDir $zipName

# Temp folder pour copie (évite d'archiver le dossier .backups lui-même)
$temp = Join-Path $env:TEMP ("lecteur_backup_$timestamp")
if (Test-Path $temp) { Remove-Item -Recurse -Force $temp }
New-Item -ItemType Directory -Path $temp | Out-Null

# Copier tout le repo vers le temp (exclut .backups et .git)
$excludeDirs = @('.backups', '.git')
$robocopyArgs = @($repo, $temp, '/MIR', '/NDL', '/NFL', '/NJH', '/NJS')
foreach ($d in $excludeDirs) { $robocopyArgs += "/XD"; $robocopyArgs += (Join-Path $repo $d) }
# Exécuter robocopy (ret code >= 8 = error, but on success it can return non-zero codes)
robocopy @robocopyArgs | Out-Null

# Créer l'archive
Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $zipPath -Force

# Nettoyage du temp
Remove-Item -Recurse -Force $temp

# Garder seulement les N derniers backups (ici 10 sauvegardes maximum)
$keep = 10
Get-ChildItem -Path $destDir -Filter "*.zip" | Sort-Object CreationTime -Descending | Select-Object -Skip $keep | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Output "Backup created: $zipPath"
