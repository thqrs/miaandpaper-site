param()

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

$libraryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\site\content\brand\miu\experimental\library-v1'))
$manifestPath = Join-Path $libraryRoot 'library-manifest.json'
$episodeManifestPath = Join-Path $libraryRoot 'episodes\episode-manifest.json'
$failures = [Collections.Generic.List[string]]::new()

if (-not (Get-Command magick -ErrorAction SilentlyContinue)) {
    throw 'ImageMagick (magick) não está disponível para validar alpha e células.'
}

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$sheetProperties = @($manifest.sheets.PSObject.Properties)
$declaredPngs = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

foreach ($property in $sheetProperties) {
    $id = $property.Name
    $sheet = $property.Value
    $pngPath = [IO.Path]::GetFullPath((Join-Path $libraryRoot $sheet.file))
    $metadataPath = [IO.Path]::GetFullPath((Join-Path $libraryRoot $sheet.metadata))
    [void]$declaredPngs.Add($pngPath)

    if ([IO.Path]::GetExtension($pngPath) -ne '.png') {
        $failures.Add("$id não aponta para PNG: $($sheet.file)")
        continue
    }
    if (-not (Test-Path -LiteralPath $pngPath)) {
        $failures.Add("${id}: PNG em falta: $pngPath")
        continue
    }
    if (-not (Test-Path -LiteralPath $metadataPath)) {
        $failures.Add("${id}: JSON adjacente em falta: $metadataPath")
        continue
    }

    $identity = ((& magick identify -format '%w %h %[opaque]' $pngPath) -join '').Trim().Split(' ')
    if ($identity.Count -ne 3 -or $identity[0] -ne '1254' -or $identity[1] -ne '1254') {
        $failures.Add("${id}: dimensões inesperadas: $($identity -join ' ')")
    }
    if ($identity.Count -eq 3 -and $identity[2].ToLowerInvariant() -ne 'false') {
        $failures.Add("${id}: a imagem é opaca; falta alpha verdadeiro")
    }

    $alphaText = ((& magick $pngPath -crop '8x8@' +repage -format '%[fx:maxima.a] ' info:) -join '')
    $alphaValues = @($alphaText.Trim() -split '\s+' | Where-Object { $_ })
    $nonEmpty = @($alphaValues | Where-Object {
        [double]::Parse($_, [Globalization.CultureInfo]::InvariantCulture) -gt 0
    }).Count
    if ($alphaValues.Count -ne 64 -or $nonEmpty -ne 64) {
        $failures.Add("${id}: ocupação lógica $nonEmpty/64 (leituras: $($alphaValues.Count))")
    }

    $metadata = Get-Content -Raw -LiteralPath $metadataPath | ConvertFrom-Json
    $rows = if ($metadata.beats) { @($metadata.beats) } else { @($metadata.variants) }
    if ($metadata.id -ne $id -or $metadata.columns -ne 8 -or $metadata.rows -ne 8 -or $metadata.frameCount -ne 64 -or $rows.Count -ne 8) {
        $failures.Add("${id}: contrato inválido no JSON adjacente")
    }
}

$allPngs = @(Get-ChildItem -LiteralPath $libraryRoot -Recurse -File -Filter '*.png')
foreach ($png in $allPngs) {
    if (-not $declaredPngs.Contains($png.FullName)) {
        $failures.Add("PNG não declarado no manifesto: $($png.FullName)")
    }
}

$webps = @(Get-ChildItem -LiteralPath $libraryRoot -Recurse -File -Filter '*.webp')
if ($webps.Count) {
    $failures.Add("Existem $($webps.Count) ficheiros WebP dentro da biblioteca PNG.")
}

$episodeManifest = Get-Content -Raw -LiteralPath $episodeManifestPath | ConvertFrom-Json
$episodeCount = 0
foreach ($summary in @($episodeManifest.episodes)) {
    $episodePath = Join-Path (Split-Path $episodeManifestPath) $summary.file
    if (-not (Test-Path -LiteralPath $episodePath)) {
        $failures.Add("Episódio em falta: $($summary.file)")
        continue
    }
    $episode = Get-Content -Raw -LiteralPath $episodePath | ConvertFrom-Json
    foreach ($step in @($episode.timeline)) {
        if (-not $manifest.sheets.PSObject.Properties[$step.sheet]) {
            $failures.Add("$($episode.id): folha desconhecida $($step.sheet)")
        }
    }
    $episodeCount += 1
}

if ($failures.Count) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "A validação falhou com $($failures.Count) erro(s)."
}

Write-Output "Míu V1 validado: $($sheetProperties.Count) folhas, $($sheetProperties.Count * 64) células, $episodeCount episódios, alpha real, zero WebP."
