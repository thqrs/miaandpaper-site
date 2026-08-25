# Exportador de pacote completo de sprites do Miu
$repo = (Get-Item -Path $PSScriptRoot).Parent.FullName
$outZip = Join-Path $repo 'miu-sprites-pacote.zip'

if (Test-Path $outZip) {
    Remove-Item $outZip -Force
}

$tempFolder = Join-Path ([System.IO.Path]::GetTempPath()) ('miu-pack-' + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempFolder -Force | Out-Null

# 1. Copiar site/content/brand/miu/
$brandDir = Join-Path $repo 'site\content\\brand\miu'
$targetBrand = Join-Path $tempFolder 'site\content\\brand\miu'
New-Item -ItemType Directory -Path $targetBrand -Force | Out-Null
Copy-Item -Path (Join-Path $brandDir '*') -Destination $targetBrand -Recurse -Force

# 2. Copiar ficheiros individuais
$individual = @(
    'site\sprites.php',
    'site\bot.php',
    'site\bot-api.php',
    'site\admin-open.php',
    'site\admin-nav.js',
    'site\admin-nav.css',
    'site\tools\index.php',
    'site\lib\miu-face-animations.php',
    'site\lib\miu-animations.php',
    'site\js\24-miu.js',
    'site\css\13-miu.css',
    'docs\12-miu.md',
    'trabalhar-nas-animacoes-do-miu.md',
    'AGENTS.md'
)

foreach ($rel in $individual) {
    $src = Join-Path $repo $rel
    if (Test-Path $src -PathType Leaf) {
        $dest = Join-Path $tempFolder $rel
        $destDir = [System.IO.Path]::GetDirectoryName($dest)
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item -Path $src -Destination $dest -Force
    }
}

# Criar ZIP
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempFolder, $outZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

Remove-Item -Path $tempFolder -Recurse -Force

$sizeMb = [Math]::Round((Get-Item $outZip).Length / 1MB, 2)
Write-Host 'Sucesso! Pacote ZIP completo criado com todas as pastas preservadas.' -ForegroundColor Green
Write-Host ('Ficheiro ZIP (' + $sizeMb + ' MB) disponivel em: ' + $outZip) -ForegroundColor Cyan
