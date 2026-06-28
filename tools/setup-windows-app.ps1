$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LauncherPath = Join-Path $ProjectRoot 'tools\run-vp-light-dev.cmd'
$IconPath = Join-Path $ProjectRoot 'assets\icons\icon.ico'

function New-VPLightShortcut {
    param([string]$ShortcutPath)

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $LauncherPath
    $shortcut.WorkingDirectory = $ProjectRoot
    $shortcut.IconLocation = "$IconPath,0"
    $shortcut.Description = 'VP Light - Lighting Control Software'
    $shortcut.Save()
}

$DesktopShortcut = Join-Path $env:USERPROFILE 'Desktop\VP Light.lnk'
$StartMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$StartMenuShortcut = Join-Path $StartMenuDir 'VP Light.lnk'

New-Item -ItemType Directory -Force -Path $StartMenuDir | Out-Null
New-VPLightShortcut -ShortcutPath $DesktopShortcut
New-VPLightShortcut -ShortcutPath $StartMenuShortcut

Write-Host '[VP Light] atalho da area de trabalho:'
Write-Host $DesktopShortcut
Write-Host '[VP Light] atalho do menu iniciar:'
Write-Host $StartMenuShortcut
Write-Host '[VP Light] launcher:'
Write-Host $LauncherPath
Write-Host '[VP Light] icone:'
Write-Host $IconPath
