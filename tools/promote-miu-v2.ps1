param(
    [string]$Checkpoint = '469d9f2'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$siteRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'site'))
$archiveRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot ("protected\miu-v1-checkpoint-" + $Checkpoint)))
$v2Root = [IO.Path]::GetFullPath((Join-Path $siteRoot 'content\brand\miu\v2'))
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $siteRoot 'content\brand\miu\experimental'))
$sourceManifestPath = Join-Path $sourceRoot 'experimental-full-spritesheet-animations_002.json'

function Assert-ChildPath([string]$Path, [string]$Parent, [string]$Label) {
    $resolvedPath = [IO.Path]::GetFullPath($Path)
    $resolvedParent = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    if (-not $resolvedPath.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label fica fora da pasta autorizada: $resolvedPath"
    }
    return $resolvedPath
}

function Get-Median([double[]]$Values) {
    $ordered = @($Values | Sort-Object)
    if (-not $ordered.Count) { return 0 }
    $middle = [math]::Floor($ordered.Count / 2)
    if ($ordered.Count % 2) { return [double]$ordered[$middle] }
    return ([double]$ordered[$middle - 1] + [double]$ordered[$middle]) / 2
}

function Get-MiuPrecomputedGrid([string]$PngPath, [int]$Columns = 8, [int]$Rows = 8) {
    if (-not (Get-Command magick -ErrorAction SilentlyContinue)) {
        throw 'ImageMagick (magick) é necessário para pré-calcular as âncoras anatómicas.'
    }

    $dimensions = ((& magick identify -format '%w,%h' $PngPath) -join '').Trim().Split(',')
    if ($dimensions.Count -ne 2) { throw "Não foi possível ler as dimensões de $PngPath" }
    $width = [int]$dimensions[0]
    $height = [int]$dimensions[1]
    $geometryLines = @(& magick $PngPath -crop ("{0}x{1}@" -f $Columns, $Rows) +repage -trim -format "%X,%Y,%w,%h`n" info:)
    $geometryLines = @($geometryLines | ForEach-Object { $_ -split "`n" } | Where-Object { $_ -and $_.Trim() })
    if ($geometryLines.Count -ne ($Columns * $Rows)) {
        throw "A grelha de $PngPath devolveu $($geometryLines.Count) células; eram esperadas $($Columns * $Rows)."
    }

    $rawCells = @()
    for ($index = 0; $index -lt $geometryLines.Count; $index += 1) {
        if ($geometryLines[$index] -notmatch '^([+-]\d+),([+-]\d+),(\d+),(\d+)$') {
            throw "Geometria inesperada na célula ${index}: $($geometryLines[$index])"
        }
        $row = [math]::Floor($index / $Columns)
        $column = $index % $Columns
        $sourceX = [math]::Floor(($column * $width) / $Columns)
        $sourceY = [math]::Floor(($row * $height) / $Rows)
        $nextX = [math]::Floor((($column + 1) * $width) / $Columns)
        $nextY = [math]::Floor((($row + 1) * $height) / $Rows)
        $trimX = [int]$Matches[1]
        $trimY = [int]$Matches[2]
        $trimWidth = [int]$Matches[3]
        $trimHeight = [int]$Matches[4]
        $rawCells += [pscustomobject]@{
            row = $row
            column = $column
            sourceX = $sourceX
            sourceY = $sourceY
            sourceWidth = $nextX - $sourceX
            sourceHeight = $nextY - $sourceY
            bodyCenterX = $sourceX + $trimX + ($trimWidth / 2)
            bodyCenterY = $sourceY + $trimY + ($trimHeight / 2)
            bodyWidth = $trimWidth
            bodyHeight = $trimHeight
        }
    }

    $rowCenters = for ($row = 0; $row -lt $Rows; $row += 1) {
        Get-Median ([double[]]@($rawCells | Where-Object row -eq $row | ForEach-Object bodyCenterY))
    }
    $columnCenters = for ($column = 0; $column -lt $Columns; $column += 1) {
        Get-Median ([double[]]@($rawCells | Where-Object column -eq $column | ForEach-Object bodyCenterX))
    }
    $cells = @()
    for ($row = 0; $row -lt $Rows; $row += 1) {
        $cellRow = @()
        for ($column = 0; $column -lt $Columns; $column += 1) {
            $cell = $rawCells | Where-Object { $_.row -eq $row -and $_.column -eq $column } | Select-Object -First 1
            $cellRow += [ordered]@{
                sourceX = $cell.sourceX
                sourceY = $cell.sourceY
                sourceWidth = $cell.sourceWidth
                sourceHeight = $cell.sourceHeight
                anchorX = [math]::Round($columnCenters[$column] - $cell.sourceX, 3)
                anchorY = [math]::Round($rowCenters[$row] - $cell.sourceY, 3)
            }
        }
        $cells += ,$cellRow
    }

    return [ordered]@{
        width = $width
        height = $height
        columns = $Columns
        rows = $Rows
        anchorStrategy = 'precomputed-median-anatomical-centres'
        bodySpanWidth = [math]::Round((Get-Median ([double[]]@($rawCells | ForEach-Object bodyWidth))), 3)
        bodySpanHeight = [math]::Round((Get-Median ([double[]]@($rawCells | ForEach-Object bodyHeight))), 3)
        rowCenters = @($rowCenters | ForEach-Object { [math]::Round($_, 3) })
        columnCenters = @($columnCenters | ForEach-Object { [math]::Round($_, 3) })
        cells = $cells
    }
}

$archiveRoot = Assert-ChildPath $archiveRoot (Join-Path $repoRoot 'protected') 'O arquivo V1'
$v2Root = Assert-ChildPath $v2Root (Join-Path $siteRoot 'content\brand\miu') 'A promoção V2'

New-Item -ItemType Directory -Force -Path $archiveRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $v2Root 'core') | Out-Null

$archiveEntries = @(
    'site\js\24-miu.js',
    'site\css\13-miu.css',
    'site\bot.php',
    'site\bot-api.php',
    'site\lib\miu-bot.php',
    'site\lib\miu-animations.php',
    'site\lib\miu-face-animations.php',
    'site\content\miu-defaults.json',
    'site\content\miu-quick-replies.json',
    'site\content\brand\miu\animations.json',
    'site\content\brand\miu\face-animations.json',
    'site\content\brand\miu\faces',
    'site\content\brand\miu\miu-banana',
    'site\content\brand\miu\sprites'
)
$checkpointMiuFiles = @(& git -C $repoRoot ls-tree -r --name-only $Checkpoint -- 'site/content/brand/miu')
if ($LASTEXITCODE -ne 0) { throw "Não foi possível listar o checkpoint Git $Checkpoint." }
$archiveEntries += @($checkpointMiuFiles | Where-Object {
    ([IO.Path]::GetDirectoryName($_).Replace('\', '/')) -eq 'site/content/brand/miu'
} | ForEach-Object { $_.Replace('/', '\') })
$archiveEntries = @($archiveEntries | Sort-Object -Unique)

if (-not (& git -C $repoRoot rev-parse --verify "$Checkpoint^{commit}" 2>$null)) {
    throw "O checkpoint Git $Checkpoint não existe."
}

# O arquivo nasce sempre do objecto Git imutável, nunca da working tree. Isto
# torna o script idempotente mesmo depois de 24-miu.js e o CSS serem alterados.
$temporaryParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$temporaryRoot = Assert-ChildPath (Join-Path $temporaryParent ('mia-miu-v1-' + [guid]::NewGuid().ToString('N'))) $temporaryParent 'A pasta temporária'
$temporaryTar = Assert-ChildPath ($temporaryRoot + '.tar') $temporaryParent 'O TAR temporário'
New-Item -ItemType Directory -Force -Path $temporaryRoot | Out-Null
try {
    $gitPaths = @($archiveEntries | ForEach-Object { $_.Replace('\', '/') })
    $gitArguments = @('archive', '--format=tar', "--output=$temporaryTar", $Checkpoint, '--') + $gitPaths
    & git -C $repoRoot @gitArguments
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $temporaryTar)) {
        throw "Não foi possível extrair o arquivo V1 do checkpoint $Checkpoint."
    }
    & tar -xf $temporaryTar -C $temporaryRoot
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível abrir o TAR temporário do Míu V1.' }

    foreach ($source in @(Get-ChildItem -LiteralPath $temporaryRoot -File -Recurse)) {
        $relative = $source.FullName.Substring($temporaryRoot.Length + 1)
        $destination = Assert-ChildPath (Join-Path $archiveRoot $relative) $archiveRoot 'O destino V1'
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        Copy-Item -LiteralPath $source.FullName -Destination $destination -Force
    }

    # Se uma execução antiga tiver copiado um ficheiro posterior ao
    # checkpoint, preserva-o fora do retrato exacto em vez de o apagar.
    $postCheckpointRoot = Assert-ChildPath (Join-Path $repoRoot ("protected\miu-v1-post-checkpoint-files-" + $Checkpoint)) (Join-Path $repoRoot 'protected') 'O arquivo de reparação'
    foreach ($existing in @(Get-ChildItem -LiteralPath (Join-Path $archiveRoot 'site') -File -Recurse)) {
        $relative = $existing.FullName.Substring($archiveRoot.Length + 1)
        if (Test-Path -LiteralPath (Join-Path $temporaryRoot $relative)) { continue }
        $repairDestination = Assert-ChildPath (Join-Path $postCheckpointRoot $relative) $postCheckpointRoot 'O ficheiro posterior ao checkpoint'
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $repairDestination) | Out-Null
        Move-Item -LiteralPath $existing.FullName -Destination $repairDestination -Force
    }
} finally {
    if ($temporaryRoot.StartsWith($temporaryParent, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $temporaryRoot) -like 'mia-miu-v1-*') {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    if ($temporaryTar.StartsWith($temporaryParent, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $temporaryTar) -like 'mia-miu-v1-*.tar') {
        Remove-Item -LiteralPath $temporaryTar -Force -ErrorAction SilentlyContinue
    }
}

# Só as cópias com extensão `.old` são inequivocamente inactivas. Saem da
# raiz pública, mas são movidas (não apagadas) para uma segunda zona do arquivo.
$retiredRoot = Assert-ChildPath (Join-Path $archiveRoot 'retired-public-copies\site\content\brand\miu') $archiveRoot 'O destino dos .old'
New-Item -ItemType Directory -Force -Path $retiredRoot | Out-Null
$retiredCount = 0
foreach ($oldFile in @(Get-ChildItem -LiteralPath (Join-Path $siteRoot 'content\brand\miu') -File -Filter '*.old')) {
    Move-Item -LiteralPath $oldFile.FullName -Destination (Join-Path $retiredRoot $oldFile.Name) -Force
    $retiredCount += 1
}

$sourceManifest = Get-Content -Raw -LiteralPath $sourceManifestPath | ConvertFrom-Json
$sheetMap = [ordered]@{
    '5' = [ordered]@{
        source = 'quantity-rig-v4\miu-v5-idle-attention-8x8.png'
        file = 'core/miu-v5-idle-attention-8x8.png'
        name = 'V2 · Idle vivo e atenção'
        preload = $true
    }
    '6' = [ordered]@{
        source = 'quantity-rig-v4\miu-v5-gesture-reactions-8x8.png'
        file = 'core/miu-v5-gesture-reactions-8x8.png'
        name = 'V2 · Reacções por gesto e rejoice'
        preload = $false
    }
}
$productionSheets = [ordered]@{}
foreach ($property in $sheetMap.GetEnumerator()) {
    $sourcePng = Assert-ChildPath (Join-Path $sourceRoot $property.Value.source) $sourceRoot 'A spritesheet fonte'
    $destinationPng = Assert-ChildPath (Join-Path $v2Root $property.Value.file) $v2Root 'A spritesheet promovida'
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destinationPng) | Out-Null
    Copy-Item -LiteralPath $sourcePng -Destination $destinationPng -Force
    $grid = Get-MiuPrecomputedGrid $destinationPng 8 8
    $productionSheets[$property.Key] = [ordered]@{
        file = $property.Value.file
        name = $property.Value.name
        columns = 8
        rows = 8
        preload = $property.Value.preload
        grid = $grid
    }
}

$legacyFacePath = Assert-ChildPath (Join-Path $siteRoot 'content\brand\miu\miu-sprite.webp') $siteRoot 'A folha facial histórica'
$productionSheets.Insert(0, 'legacy-face', [ordered]@{
    file = '../miu-sprite.webp'
    name = 'V1 histórico · Cara calma completa'
    columns = 4
    rows = 2
    preload = $true
    historicalAsset = $true
    grid = Get-MiuPrecomputedGrid $legacyFacePath 4 2
})

$legacyIdle = [ordered]@{
    id = 'v1_idle_calm_complete'
    name = 'V1 histórico · Cara calma completa'
    group = 'Animation Director V2 · Idle canónico'
    loop = $false
    frames = @(
        [ordered]@{ sheet = 'legacy-face'; cell = @(0, 0); durationMs = 1300 }
        [ordered]@{ sheet = 'legacy-face'; cell = @(0, 0); durationMs = 1100 }
        [ordered]@{ sheet = 'legacy-face'; cell = @(0, 0); durationMs = 900 }
        [ordered]@{ sheet = 'legacy-face'; cell = @(1, 0); durationMs = 110 }
        [ordered]@{ sheet = 'legacy-face'; cell = @(2, 0); durationMs = 100 }
        [ordered]@{ sheet = 'legacy-face'; cell = @(3, 0); durationMs = 150 }
        [ordered]@{ sheet = 'legacy-face'; cell = @(0, 0); durationMs = 1200 }
        [ordered]@{ sheet = 'legacy-face'; cell = @(0, 0); durationMs = 950 }
        [ordered]@{ sheet = 'legacy-face'; cell = @(0, 0); durationMs = 1200 }
        [ordered]@{ sheet = 'legacy-face'; cell = @(3, 1); durationMs = 700 }
        [ordered]@{ sheet = 'legacy-face'; cell = @(0, 0); durationMs = 1000 }
        [ordered]@{ sheet = 'legacy-face'; cell = @(0, 0); durationMs = 900 }
        [ordered]@{ sheet = 'legacy-face'; cell = @(0, 0); durationMs = 1200 }
    )
}
$animations = @($legacyIdle) + @($sourceManifest.animations | Where-Object { $_.id -like 'v5_*' })
$coreManifest = [ordered]@{
    schemaVersion = 2
    kind = 'miu-production-director-core'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    sourceCheckpoint = $Checkpoint
    canonicalReference = '../miu-sprite.webp'
    contract = [ordered]@{
        format = 'png-rgba'
        columns = 8
        rows = 8
        frameCountPerSheet = 64
        neverConvertToWebp = $true
        anchorStrategy = 'precomputed-median-anatomical-centres'
        runtimeFallbackDetector = 'MiuSpriteGrid.detectConnectedGrid'
    }
    sheets = $productionSheets
    animations = $animations
}
$coreManifestPath = Join-Path $v2Root 'core-manifest.json'
$utf8NoBom = [Text.UTF8Encoding]::new($false)
$coreManifestJson = $coreManifest | ConvertTo-Json -Depth 30
[IO.File]::WriteAllText($coreManifestPath, $coreManifestJson + [Environment]::NewLine, $utf8NoBom)

$hashRows = Get-ChildItem -LiteralPath $archiveRoot -File -Recurse | Where-Object Name -ne 'MANIFEST.sha256' | Sort-Object FullName | ForEach-Object {
    $relative = $_.FullName.Substring($archiveRoot.Length + 1).Replace('\', '/')
    $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $relative"
}
[IO.File]::WriteAllLines((Join-Path $archiveRoot 'MANIFEST.sha256'), [string[]]$hashRows, $utf8NoBom)

Write-Output "Arquivo V1: $archiveRoot"
Write-Output "Manifesto V2: $coreManifestPath"
Write-Output "Animações V2 promovidas: $($animations.Count)"
Write-Output "Cópias .old retiradas da raiz pública nesta execução: $retiredCount"
Write-Output 'Nenhum asset foi apagado; os activos permaneceram no lugar e os .old foram apenas movidos.'
