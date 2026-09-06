param(
    [string]$OutputFile = (Join-Path $PSScriptRoot '..\site\catalogo\pdfs\catalogo-completo-editavel.docx')
)

$ErrorActionPreference = 'Stop'

$siteDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\site'))
$outputFile = [System.IO.Path]::GetFullPath($OutputFile)
$catalogPages = @(
    (Join-Path $siteDirectory 'catalogo\molduras\index.html'),
    (Join-Path $siteDirectory 'catalogo\pasta-de-folhetos\index.html'),
    (Join-Path $siteDirectory 'catalogo\crachas\index.html'),
    (Join-Path $siteDirectory 'catalogo\imanes\index.html'),
    (Join-Path $siteDirectory 'catalogo\caderninhos\index.html'),
    (Join-Path $siteDirectory 'catalogo\cadernos\index.html')
)

$word = $null
$document = $null
$selection = $null

function ConvertFrom-HtmlText {
    param([string]$Text)

    $withoutTags = [regex]::Replace($Text, '<[^>]+>', ' ')
    $decoded = [System.Net.WebUtility]::HtmlDecode($withoutTags)
    return [regex]::Replace($decoded, '\s+', ' ').Trim()
}

function Resolve-HtmlImage {
    param(
        [string]$HtmlFile,
        [string]$ImageSource
    )

    $decodedSource = [System.Net.WebUtility]::HtmlDecode($ImageSource)
    return [System.IO.Path]::GetFullPath((Join-Path (Split-Path $HtmlFile) $decodedSource))
}

function Add-Paragraph {
    param(
        [string]$Text,
        [single]$Size = 12,
        [bool]$Bold = $false,
        [int]$Alignment = 0,
        [single]$SpaceBefore = 0,
        [single]$SpaceAfter = 6,
        [bool]$KeepWithNext = $false
    )

    $script:selection.Font.Name = 'Arial'
    $script:selection.Font.Size = $Size
    $script:selection.Font.Bold = [int]$Bold
    $script:selection.ParagraphFormat.Alignment = $Alignment
    $script:selection.ParagraphFormat.SpaceBefore = $SpaceBefore
    $script:selection.ParagraphFormat.SpaceAfter = $SpaceAfter
    $script:selection.ParagraphFormat.KeepWithNext = if ($KeepWithNext) { -1 } else { 0 }
    $script:selection.TypeText($Text)
    $script:selection.TypeParagraph()
}

function Add-PageBreak {
    $script:selection.InsertBreak(7)
}

function Move-SelectionAfterTable {
    param($Table)

    $end = $Table.Range.End
    $script:selection.SetRange($end, $end)
    $script:selection.TypeParagraph()
}

function Format-Table {
    param(
        $Table,
        [single]$FontSize = 11
    )

    $Table.AllowAutoFit = $true
    $Table.AutoFitBehavior(2)
    $Table.Borders.Enable = 0
    $Table.Range.Font.Name = 'Arial'
    $Table.Range.Font.Size = $FontSize
    $Table.Range.ParagraphFormat.SpaceAfter = 2
    $Table.Rows.AllowBreakAcrossPages = $false
}

function Add-TextTable {
    param(
        [object[]]$Rows,
        [int]$Columns,
        [bool]$Header = $false
    )

    if ($Rows.Count -eq 0) {
        return
    }

    $range = $script:selection.Range
    $table = $script:document.Tables.Add($range, $Rows.Count, $Columns)
    Format-Table -Table $table

    for ($rowIndex = 0; $rowIndex -lt $Rows.Count; $rowIndex++) {
        for ($columnIndex = 0; $columnIndex -lt $Columns; $columnIndex++) {
            $value = if ($columnIndex -lt $Rows[$rowIndex].Count) { $Rows[$rowIndex][$columnIndex] } else { '' }
            $table.Cell($rowIndex + 1, $columnIndex + 1).Range.Text = [string]$value
        }
    }

    if ($Header) {
        $table.Rows.Item(1).Range.Font.Bold = 1
        $table.Rows.Item(1).HeadingFormat = -1
    }

    Move-SelectionAfterTable -Table $table
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($table)
}

function Add-ImageToCell {
    param(
        $Cell,
        [string]$ImagePath,
        [single]$MaxWidthCm = 5.1,
        [single]$MaxHeightCm = 6.1
    )

    if (-not (Test-Path -LiteralPath $ImagePath)) {
        return
    }

    $range = $Cell.Range.Duplicate
    $range.End = $range.End - 1
    $range.Collapse(1)
    $shape = $script:document.InlineShapes.AddPicture($ImagePath, $false, $true, $range)
    $shape.LockAspectRatio = -1

    $maxWidth = $script:word.CentimetersToPoints($MaxWidthCm)
    $maxHeight = $script:word.CentimetersToPoints($MaxHeightCm)
    if ($shape.Width -gt $maxWidth) {
        $shape.Width = $maxWidth
    }
    if ($shape.Height -gt $maxHeight) {
        $shape.Height = $maxHeight
    }

    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($shape)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($range)
}

function Add-ImageGrid {
    param(
        [object[]]$Items,
        [int]$Columns = 3,
        [single]$MaxWidthCm = 5.1,
        [single]$MaxHeightCm = 6.1
    )

    if ($Items.Count -eq 0) {
        return
    }

    $rowCount = [math]::Ceiling($Items.Count / $Columns)
    $range = $script:selection.Range
    $table = $script:document.Tables.Add($range, $rowCount, $Columns)
    Format-Table -Table $table -FontSize 11

    for ($index = 0; $index -lt $Items.Count; $index++) {
        $row = [math]::Floor($index / $Columns) + 1
        $column = ($index % $Columns) + 1
        $cell = $table.Cell($row, $column)
        $cell.Range.Text = "`r$($Items[$index].Name)"
        $cell.Range.Font.Bold = 1
        $cell.Range.ParagraphFormat.Alignment = 1
        $cell.VerticalAlignment = 1
        Add-ImageToCell -Cell $cell -ImagePath $Items[$index].Image -MaxWidthCm $MaxWidthCm -MaxHeightCm $MaxHeightCm
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($cell)
    }

    Move-SelectionAfterTable -Table $table
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($table)
}

function Add-PriceContent {
    param(
        [string]$Html,
        [string]$HtmlFile
    )

    $priceTableMatch = [regex]::Match(
        $Html,
        '<table class="catalog-price-table">(?<table>.*?)</table>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($priceTableMatch.Success) {
        $rows = @()
        $headerMatch = [regex]::Match(
            $priceTableMatch.Groups['table'].Value,
            '<thead>.*?<tr>(?<cells>.*?)</tr>.*?</thead>',
            [System.Text.RegularExpressions.RegexOptions]::Singleline
        )
        if ($headerMatch.Success) {
            $rows += ,@(
                [regex]::Matches($headerMatch.Groups['cells'].Value, '<th>(?<value>.*?)</th>') |
                    ForEach-Object { ConvertFrom-HtmlText $_.Groups['value'].Value }
            )
        }

        $bodyMatch = [regex]::Match(
            $priceTableMatch.Groups['table'].Value,
            '<tbody>(?<body>.*?)</tbody>',
            [System.Text.RegularExpressions.RegexOptions]::Singleline
        )
        $bodyHtml = if ($bodyMatch.Success) { $bodyMatch.Groups['body'].Value } else { $priceTableMatch.Groups['table'].Value }
        $bodyMatches = [regex]::Matches(
            $bodyHtml,
            '<tr>(?<cells>.*?)</tr>',
            [System.Text.RegularExpressions.RegexOptions]::Singleline
        )
        foreach ($rowMatch in $bodyMatches) {
            $cells = @(
                [regex]::Matches($rowMatch.Groups['cells'].Value, '<td>(?<value>.*?)</td>') |
                    ForEach-Object { ConvertFrom-HtmlText $_.Groups['value'].Value }
            )
            if ($cells.Count -gt 0) {
                $rows += ,$cells
            }
        }

        Add-TextTable -Rows $rows -Columns 3 -Header $true
    }

    $priceCardMatches = [regex]::Matches(
        $Html,
        '<article class="price-card">(?<card>.*?)</article>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
    foreach ($priceCardMatch in $priceCardMatches) {
        $card = $priceCardMatch.Groups['card'].Value
        $title = ConvertFrom-HtmlText ([regex]::Match($card, '<h3>(?<value>.*?)</h3>').Groups['value'].Value)
        $description = ConvertFrom-HtmlText ([regex]::Match($card, '<p>(?<value>.*?)</p>').Groups['value'].Value)
        Add-Paragraph -Text $title -Size 15 -Bold $true -SpaceBefore 6 -SpaceAfter 2 -KeepWithNext $true
        if ($description) {
            Add-Paragraph -Text $description -Size 11 -SpaceAfter 4 -KeepWithNext $true
        }

        $rows = @()
        foreach ($itemMatch in [regex]::Matches($card, '<li><span>(?<label>.*?)</span><strong>(?<price>.*?)</strong></li>')) {
            $rows += ,@(
                (ConvertFrom-HtmlText $itemMatch.Groups['label'].Value),
                (ConvertFrom-HtmlText $itemMatch.Groups['price'].Value)
            )
        }
        Add-TextTable -Rows $rows -Columns 2
    }

    $noteMatches = [regex]::Matches($Html, '<p class="plain-note">(?<value>.*?)</p>')
    foreach ($noteMatch in $noteMatches) {
        Add-Paragraph -Text (ConvertFrom-HtmlText $noteMatch.Groups['value'].Value) -Size 12 -Bold $true -SpaceBefore 4 -SpaceAfter 6
    }
}

function Add-Options {
    param(
        [string]$Html,
        [string]$HtmlFile
    )

    $items = @()
    $optionMatches = [regex]::Matches(
        $Html,
        '<article class="catalog-option-card">.*?<img src="(?<src>[^"]+)".*?<strong>(?<name>.*?)</strong>.*?<span>(?<description>.*?)</span>.*?</article>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
    foreach ($optionMatch in $optionMatches) {
        $name = ConvertFrom-HtmlText $optionMatch.Groups['name'].Value
        $description = ConvertFrom-HtmlText $optionMatch.Groups['description'].Value
        $items += [PSCustomObject]@{
            Name = if ($description) { "$name`r$description" } else { $name }
            Image = Resolve-HtmlImage -HtmlFile $HtmlFile -ImageSource $optionMatch.Groups['src'].Value
        }
    }

    if ($items.Count -gt 0) {
        Add-Paragraph -Text 'Acabamentos' -Size 20 -Bold $true -SpaceBefore 8 -SpaceAfter 5 -KeepWithNext $true
        Add-ImageGrid -Items $items -Columns 2 -MaxWidthCm 7.4 -MaxHeightCm 6
    }
}

function Add-DesignSections {
    param(
        [string]$Html,
        [string]$HtmlFile
    )

    $sectionMatches = [regex]::Matches(
        $Html,
        '<section class="design-section"[^>]*>.*?<h3[^>]*>(?<heading>.*?)</h3><div class="design-grid">(?<grid>.*?)</div></section>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    foreach ($sectionMatch in $sectionMatches) {
        $heading = ConvertFrom-HtmlText $sectionMatch.Groups['heading'].Value
        Add-Paragraph -Text $heading -Size 16 -SpaceBefore 8 -SpaceAfter 5 -KeepWithNext $true

        $items = @()
        $figureMatches = [regex]::Matches(
            $sectionMatch.Groups['grid'].Value,
            '<figure class="design-card">.*?<img class="catalog-design-img" src="(?<src>[^"]+)".*?<strong>(?<name>.*?)</strong>.*?</figure>',
            [System.Text.RegularExpressions.RegexOptions]::Singleline
        )
        foreach ($figureMatch in $figureMatches) {
            $items += [PSCustomObject]@{
                Name = ConvertFrom-HtmlText $figureMatch.Groups['name'].Value
                Image = Resolve-HtmlImage -HtmlFile $HtmlFile -ImageSource $figureMatch.Groups['src'].Value
            }
        }
        Add-ImageGrid -Items $items
    }
}

function Add-CatalogCover {
    $indexFile = Join-Path $siteDirectory 'catalogo\index.html'
    $html = Get-Content -Raw -Encoding UTF8 -LiteralPath $indexFile
    $logo = Join-Path $siteDirectory 'content\brand\logo.jpg'

    Add-Paragraph -Text 'Mia & Paper' -Size 16 -Bold $true -Alignment 1 -SpaceAfter 8
    $logoRange = $script:selection.Range
    $logoShape = $script:document.InlineShapes.AddPicture($logo, $false, $true, $logoRange)
    $logoShape.LockAspectRatio = -1
    $logoShape.Width = $script:word.CentimetersToPoints(2.6)
    $script:selection.SetRange($logoShape.Range.End, $logoShape.Range.End)
    $script:selection.TypeParagraph()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($logoShape)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($logoRange)

    Add-Paragraph -Text 'Catálogo' -Size 30 -Bold $true -Alignment 1 -SpaceAfter 5
    Add-Paragraph -Text 'Para escolher com mais facilidade' -Size 18 -Alignment 1 -SpaceAfter 14

    $items = @()
    $productMatches = [regex]::Matches(
        $html,
        '<a class="catalog-product-card".*?<img src="(?<src>[^"]+)".*?<strong>(?<name>.*?)</strong><span>(?<description>.*?)</span>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
    foreach ($productMatch in $productMatches) {
        $items += [PSCustomObject]@{
            Name = "$(ConvertFrom-HtmlText $productMatch.Groups['name'].Value)`r$(ConvertFrom-HtmlText $productMatch.Groups['description'].Value)"
            Image = Resolve-HtmlImage -HtmlFile $indexFile -ImageSource $productMatch.Groups['src'].Value
        }
    }
    Add-ImageGrid -Items $items -Columns 2 -MaxWidthCm 5.5 -MaxHeightCm 4.5
}

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Add()
    $selection = $word.Selection

    $document.PageSetup.PaperSize = 7
    $document.PageSetup.TopMargin = $word.CentimetersToPoints(1.5)
    $document.PageSetup.BottomMargin = $word.CentimetersToPoints(1.5)
    $document.PageSetup.LeftMargin = $word.CentimetersToPoints(1.5)
    $document.PageSetup.RightMargin = $word.CentimetersToPoints(1.5)
    $document.Styles.Item(-1).Font.Name = 'Arial'
    $document.Styles.Item(-1).Font.Size = 12

    Add-CatalogCover

    foreach ($catalogPage in $catalogPages) {
        Add-PageBreak
        $html = Get-Content -Raw -Encoding UTF8 -LiteralPath $catalogPage
        $titleMatch = [regex]::Match($html, '<h1 id="produto-title">(?<title>.*?)</h1>')
        $title = ConvertFrom-HtmlText $titleMatch.Groups['title'].Value

        Add-Paragraph -Text 'Mia & Paper' -Size 12 -Bold $true -SpaceAfter 4
        Add-Paragraph -Text $title -Size 28 -Bold $true -SpaceAfter 10
        Add-Paragraph -Text 'Preços' -Size 20 -Bold $true -SpaceAfter 5 -KeepWithNext $true
        Add-PriceContent -Html $html -HtmlFile $catalogPage
        Add-Options -Html $html -HtmlFile $catalogPage
        Add-Paragraph -Text $(if ($title -eq 'Cadernos de Apontamentos' -or $title -eq 'Mini-Cadernos') { 'Capas' } else { 'Designs' }) -Size 20 -Bold $true -SpaceBefore 8 -SpaceAfter 5 -KeepWithNext $true
        Add-DesignSections -Html $html -HtmlFile $catalogPage
    }

    New-Item -ItemType Directory -Force -Path (Split-Path $outputFile) | Out-Null
    Remove-Item -LiteralPath $outputFile -Force -ErrorAction SilentlyContinue
    $document.SaveAs2($outputFile, 12)
    Write-Host "DOCX criado: $outputFile"
    Write-Host "Páginas: $($document.ComputeStatistics(2))"
}
finally {
    if ($selection) {
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($selection)
    }
    if ($document) {
        $document.Close($false)
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
    }
    if ($word) {
        $word.Quit()
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
