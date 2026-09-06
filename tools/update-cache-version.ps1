# Actualiza o ?v= (cache-busting) das referencias a css/*.css, js/*.js,
# admin-nav.js e admin-nav.css nas cascas HTML públicas e páginas PHP de administração,
# incluindo subpastas.
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
$files = @(Get-ChildItem -LiteralPath $site -Filter '*.html' -File -Recurse) + @(Get-ChildItem -LiteralPath $site -Filter '*.php' -File -Recurse)

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

    # Barra admin (admin-nav.js e admin-nav.css): aceita a raiz e subpastas.
    $t = [regex]::Replace(
        $t,
        'src="((?:\.\./)*admin-nav\.js)(?:\?v=[^"]*)?"',
        ('src="$1?v=' + $v + '"')
    )
    $t = [regex]::Replace(
        $t,
        'href="((?:\.\./)*admin-nav\.css)(?:\?v=[^"]*)?"',
        ('href="$1?v=' + $v + '"')
    )

    # A pesquisa é recursiva, mas só as cascas com referências alteradas devem
    # ser regravadas. Assim, HTML alheio aos módulos fica rigorosamente intacto.
    if ($t -eq $old) { continue }

    # Remove linhas em branco no fim criadas por versoes anteriores do BAT.
    # Depois escreve o ficheiro sem acrescentar newline automatica.
    $t = $t.TrimEnd("`r", "`n")

    if ($t -ne $old) {
        try {
            $stream = [System.IO.File]::Open($f.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::ReadWrite)
            $bytes = $utf8NoBom.GetBytes($t)
            $stream.Position = 0
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.SetLength($bytes.Length)
            $stream.Close()
        } catch {
            [System.IO.File]::WriteAllText($f.FullName, $t, $utf8NoBom)
        }
    }
}

Write-Host ("Cache version: " + $v)
