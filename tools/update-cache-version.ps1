# Actualiza o ?v= (cache-busting) das referencias a css/*.css e js/*.js
# nas cascas HTML públicas, incluindo subpastas (+ send-message.php e
# send-order.php).
# Chamado pelo [2]upload-or-download.bat no passo 1/5 do deploy.
# Interface: le as variaveis de ambiente CACHE_VERSION e SITE.

$ErrorActionPreference = 'Stop'
$v = $env:CACHE_VERSION
$site = $env:SITE

if ([string]::IsNullOrWhiteSpace($v)) {
    throw 'CACHE_VERSION environment variable is empty.'
}

if ([string]::IsNullOrWhiteSpace($site) -or -not (Test-Path -LiteralPath $site)) {
    throw 'SITE environment variable is invalid or the path does not exist.'
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$files = @(Get-ChildItem -LiteralPath $site -Filter '*.html' -File -Recurse)
foreach ($php in @('send-message.php', 'send-order.php')) {
    $p = Join-Path $site $php
    if (Test-Path -LiteralPath $p) { $files += Get-Item -LiteralPath $p }
}

foreach ($f in $files) {
    $t = [System.IO.File]::ReadAllText($f.FullName)
    $old = $t

    # Modulos JS: aceita a raiz e subpastas (../js ou ../../js).
    $t = [regex]::Replace(
        $t,
        'src="((?:\.\./)*js/[^"?]+\.js)(?:\?v=[^"]*)?"',
        ('src="$1?v=' + $v + '"')
    )

    # Modulos CSS: aceita a raiz e subpastas (../css ou ../../css).
    $t = [regex]::Replace(
        $t,
        'href="((?:\.\./)*css/[^"?]+\.css)(?:\?v=[^"]*)?"',
        ('href="$1?v=' + $v + '"')
    )

    # A pesquisa é recursiva, mas só as cascas com referências alteradas devem
    # ser regravadas. Assim, HTML alheio aos módulos fica rigorosamente intacto.
    if ($t -eq $old) { continue }

    # Remove linhas em branco no fim criadas por versoes anteriores do BAT.
    # Depois escreve o ficheiro sem acrescentar newline automatica.
    $t = $t.TrimEnd("`r", "`n")

    if ($t -ne $old) {
        [System.IO.File]::WriteAllText($f.FullName, $t, $utf8NoBom)
    }
}

Write-Host ("Cache version: " + $v)
