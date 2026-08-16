# Exporta todo o código, documentação, esquemas e configurações do site
# para um ficheiro ZIP compacto (~1-2 MB), otimizado para LLMs.
# Exclui imagens, vídeos, PDFs, bases de dados SQLite, logs analíticos,
# backups, ficheiros Office e bundles pesados.

param(
    [string]$OutputZip = ""
)

$ErrorActionPreference = 'Stop'

# Determina a raiz do repositório
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
if (-not (Test-Path (Join-Path $repoRoot "AGENTS.md"))) {
    # Fallback se for executado diretamente a partir da raiz
    $repoRoot = (Get-Location).Path
}

if ([string]::IsNullOrWhiteSpace($OutputZip)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputZip = Join-Path $repoRoot "$timestamp.zip"
}

Write-Host "Raiz do repositório: $repoRoot" -ForegroundColor Cyan
Write-Host "Destino do arquivo ZIP: $OutputZip" -ForegroundColor Cyan
Write-Host "A filtrar ficheiros..." -ForegroundColor Yellow

# Pastas a ignorar completamente
$excludeDirs = @(
    '.git',
    '.claude',
    '.codex-tmp',
    'imagens',
    'novos_designs',
    'audios',
    'borboleta',
    'private-local'
)

# Extensões binárias/pesadas a excluir
$excludeExts = @(
    '.webp',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.pdf',
    '.sqlite',
    '.sqlite3',
    '.xlsx',
    '.zip',
    '.mhtml',
    '.ogg',
    '.mp4',
    '.jsonl',
    '.log',
    '.lnk'
)

# Ficheiros específicos a excluir
$excludeFiles = @(
    'gerador-cartoes.php', # 5.3 MB de bibliotecas minificadas
    'prompts-geracao-imagens.json',
    'catalogo-tracking-corrigido.txt',
    'metro_live_visitors_mockup.html',
    'webp_migration_report.json',
    'image-catalog.json'
)

# Carrega classes .NET para manipulação eficiente de ZIP mantendo hierarquia relativa
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$allFiles = Get-ChildItem -Path $repoRoot -Recurse -File

$selectedFiles = @()
$totalUncompressedBytes = 0

foreach ($f in $allFiles) {
    # Caminho relativo com barras normais
    $rel = $f.FullName.Substring($repoRoot.Length).TrimStart('\', '/').Replace('\', '/')
    
    # 1. Ignorar pastas proibidas
    $skip = $false
    foreach ($d in $excludeDirs) {
        if ($rel -like "$d/*" -or $rel -like "*/$d/*") {
            $skip = $true
            break
        }
    }
    if ($skip) { continue }

    # 2. Ignorar subpastas e dados gerados em private/
    if ($rel -like "private/snapshots/*" -or 
        $rel -like "private/order-uploads/*" -or 
        $rel -like "private/funnel-jsonl/*" -or 
        $rel -like "private/product-backups/*") {
        continue
    }

    # 3. Em private/, manter apenas definições estruturais essenciais
    if ($rel -like "private/*" -and $f.Name -notin @("custos.json", "materiais.json", "image-label-aliases.json", "image-mapping-review.json")) {
        continue
    }

    # 4. Ignorar por extensão pesada / binária
    if ($excludeExts -contains $f.Extension.ToLower()) {
        continue
    }

    # 5. Ignorar ficheiros específicos na lista de exclusão
    if ($excludeFiles -contains $f.Name) {
        continue
    }

    # 6. Ignorar ficheiros de backup / temporários
    if ($f.Name -like "*sqlite*" -or 
        $f.Name -like "*.bak*" -or 
        $f.Name -like "*.legacy*" -or 
        $f.Name -like "*.precos-bak*" -or 
        $f.Name -like "*.galeria-bak*" -or 
        $f.Name -like "*.homepage-bak*" -or 
        $f.Name -like "*.reviews-bak*" -or
        $f.Name -like "*.lock") {
        continue
    }

    # 7. Ignorar o próprio ficheiro ZIP de saída se já existir no caminho
    if ($f.FullName -eq (Resolve-Path -Path $OutputZip -ErrorAction SilentlyContinue)) {
        continue
    }

    $selectedFiles += @{
        File = $f
        RelPath = $rel
    }
    $totalUncompressedBytes += $f.Length
}

if ($selectedFiles.Count -eq 0) {
    Write-Warning "Nenhum ficheiro selecionado para empacotar."
    exit 0
}

# Remove zip anterior se existir
if (Test-Path $OutputZip) {
    Remove-Item $OutputZip -Force
}

Write-Host "A criar arquivo ZIP com $($selectedFiles.Count) ficheiros..." -ForegroundColor Yellow

$zip = [System.IO.Compression.ZipFile]::Open($OutputZip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($item in $selectedFiles) {
        $null = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, 
            $item.File.FullName, 
            $item.RelPath, 
            [System.IO.Compression.CompressionLevel]::Optimal
        )
    }
} finally {
    $zip.Dispose()
}

$zipSize = (Get-Item $OutputZip).Length
$zipSizeMB = [math]::Round($zipSize / 1MB, 2)
$uncompressedMB = [math]::Round($totalUncompressedBytes / 1MB, 2)

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " ZIP gerado com sucesso para LLM!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Ficheiro:        $OutputZip" -ForegroundColor White
Write-Host " Total Ficheiros: $($selectedFiles.Count)" -ForegroundColor White
Write-Host " Tamanho Bruto:   $uncompressedMB MB" -ForegroundColor White
Write-Host " Tamanho ZIP:     $zipSizeMB MB" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
