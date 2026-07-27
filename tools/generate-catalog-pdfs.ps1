param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\site\catalogo\pdfs')
)

$ErrorActionPreference = 'Stop'

$catalogDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\site\catalogo'))
$outputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)

$browserCandidates = @(
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)

$browser = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browser) {
    throw 'Não foi encontrado Google Chrome ou Microsoft Edge para gerar os PDFs.'
}

$pages = [ordered]@{
    'catalogo'     = (Join-Path $catalogDirectory 'index.html')
    'crachas'      = (Join-Path $catalogDirectory 'crachas\index.html')
    'imanes'       = (Join-Path $catalogDirectory 'imanes\index.html')
    'caderninhos'  = (Join-Path $catalogDirectory 'caderninhos\index.html')
    'cadernos'     = (Join-Path $catalogDirectory 'cadernos\index.html')
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$profileDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("miaandpaper-pdf-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $profileDirectory | Out-Null

try {
    foreach ($page in $pages.GetEnumerator()) {
        $source = [System.IO.Path]::GetFullPath($page.Value)
        $destination = Join-Path $outputDirectory ($page.Key + '.pdf')
        $url = ([System.Uri]$source).AbsoluteUri
        $pageProfileDirectory = Join-Path $profileDirectory $page.Key

        New-Item -ItemType Directory -Path $pageProfileDirectory | Out-Null
        Remove-Item -LiteralPath $destination -Force -ErrorAction SilentlyContinue

        Write-Host "A gerar $($page.Key).pdf..."
        $arguments = @(
            '--headless=new',
            '--disable-gpu',
            '--allow-file-access-from-files',
            '--run-all-compositor-stages-before-draw',
            '--virtual-time-budget=3000',
            '--no-pdf-header-footer',
            "--user-data-dir=$pageProfileDirectory",
            "--print-to-pdf=$destination",
            $url
        )

        & $browser @arguments | Out-Null
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $destination)) {
            throw "Não foi possível gerar $destination."
        }
    }

    $ghostscriptCandidates = @(
        (Get-Command 'gswin64c.exe' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
        (Get-ChildItem 'C:\Program Files\gs\gs*\bin\gswin64c.exe' -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending |
            Select-Object -ExpandProperty FullName)
    ) | Where-Object { $_ }
    $ghostscript = $ghostscriptCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

    if ($ghostscript) {
        $completeCatalog = Join-Path $outputDirectory 'catalogo-completo.pdf'
        $pdfs = $pages.Keys | ForEach-Object { Join-Path $outputDirectory ($_ + '.pdf') }
        Remove-Item -LiteralPath $completeCatalog -Force -ErrorAction SilentlyContinue
        $arguments = @(
            '-dBATCH',
            '-dNOPAUSE',
            '-dSAFER',
            '-q',
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.7',
            "-sOutputFile=$completeCatalog"
        ) + $pdfs

        Write-Host 'A gerar catalogo-completo.pdf...'
        & $ghostscript @arguments
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $completeCatalog)) {
            throw "Não foi possível gerar $completeCatalog."
        }
    }
    else {
        Write-Warning 'Ghostscript não foi encontrado. Os PDFs individuais foram criados, mas não foi possível criar catalogo-completo.pdf.'
    }
}
finally {
    $resolvedProfile = [System.IO.Path]::GetFullPath($profileDirectory)
    $resolvedTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if ($resolvedProfile.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedProfile -Recurse -Force -ErrorAction SilentlyContinue
    }
}
