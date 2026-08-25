[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidatePattern('^$|^(?:\d{1,3}\.){3}\d{1,3}$')]
    [string]$TvIp = '',
    [switch]$SkipFirewall
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot '.venv\Scripts\python.exe'
$apk = Join-Path $projectRoot 'android-tv\app\build\outputs\apk\debug\app-debug.apk'
$logRoot = Join-Path $projectRoot 'server\data\logs'
$stdoutLog = Join-Path $logRoot 'server.out.log'
$stderrLog = Join-Path $logRoot 'server.err.log'
$pidFile = Join-Path $projectRoot 'server\data\meujw-server.pid'
$packageName = 'pt.tiagohenriques.meujw.diagnostic'
$firewallRuleName = 'MeuJW-Server-8765'
$port = 8765

function Write-Step([string]$Message) {
    Write-Host "[Meu JW] $Message" -ForegroundColor Cyan
}

function Find-Adb {
    $command = Get-Command adb.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidates = @(
        (Join-Path $projectRoot '.android-sdk\platform-tools\adb.exe'),
        (Join-Path $env:USERPROFILE 'platform-tools\adb.exe')
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    throw 'adb.exe não foi encontrado. Execute tools\bootstrap_android.ps1 ou instale platform-tools.'
}

function Invoke-Adb {
    param([string[]]$Arguments)
    $result = & $script:adb @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "ADB falhou: adb $($Arguments -join ' ')`n$($result -join "`n")"
    }
    return $result
}

function Get-PrimaryAddress {
    $routes = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
        Where-Object { $_.NextHop -ne '0.0.0.0' } | Sort-Object RouteMetric, InterfaceMetric
    foreach ($route in $routes) {
        $address = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1
        if ($address) { return $address }
    }
    throw 'Não foi encontrado um endereço IPv4 ativo no PC.'
}

function Test-SameSubnet([string]$First, [string]$Second, [int]$PrefixLength) {
    $a = [Net.IPAddress]::Parse($First).GetAddressBytes()
    $b = [Net.IPAddress]::Parse($Second).GetAddressBytes()
    $wholeBytes = [Math]::Floor($PrefixLength / 8)
    $remaining = $PrefixLength % 8
    for ($index = 0; $index -lt $wholeBytes; $index++) {
        if ($a[$index] -ne $b[$index]) { return $false }
    }
    if ($remaining -gt 0) {
        $mask = (0xFF -shl (8 - $remaining)) -band 0xFF
        if (($a[$wholeBytes] -band $mask) -ne ($b[$wholeBytes] -band $mask)) { return $false }
    }
    return $true
}

function Get-PcAddressForTv([string]$Address) {
    $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }
    foreach ($candidate in $addresses) {
        if (Test-SameSubnet $candidate.IPAddress $Address $candidate.PrefixLength) {
            return $candidate.IPAddress
        }
    }
    return (Get-PrimaryAddress).IPAddress
}

function Get-ConnectedTv {
    $lines = & $script:adb devices 2>$null
    foreach ($line in $lines) {
        if ($line -match '^(\S+)\s+device$') {
            $serial = $Matches[1]
            $model = ((& $script:adb -s $serial shell getprop ro.product.model 2>$null) -join '').Trim()
            if ($model -match 'MiTV-MSSP3' -or $lines.Count -le 2) {
                $address = if ($serial -match '^(\d+\.\d+\.\d+\.\d+):') { $Matches[1] } else { '' }
                if (-not $address) {
                    $route = ((& $script:adb -s $serial shell ip route 2>$null) -join ' ')
                    if ($route -match '\bsrc\s+(\d+\.\d+\.\d+\.\d+)') { $address = $Matches[1] }
                }
                return [pscustomobject]@{ Serial = $serial; Ip = $address; Model = $model }
            }
        }
    }
    return $null
}

function Find-TvOnLocalSubnet {
    $primary = Get-PrimaryAddress
    if ($primary.PrefixLength -ne 24) {
        throw "A descoberta automática requer uma rede /24. Execute Iniciar_MeuJW.bat IP_DA_TV. Rede atual: $($primary.IPAddress)/$($primary.PrefixLength)"
    }
    $prefix = $primary.IPAddress.Substring(0, $primary.IPAddress.LastIndexOf('.') + 1)
    Write-Step "A procurar a Xiaomi na rede ${prefix}0/24..."
    $probes = foreach ($number in 1..254) {
        $address = "$prefix$number"
        if ($address -eq $primary.IPAddress) { continue }
        $client = [Net.Sockets.TcpClient]::new()
        [pscustomobject]@{ Address = $address; Client = $client; Async = $client.BeginConnect($address, 5555, $null, $null) }
    }
    Start-Sleep -Milliseconds 1200
    $open = @($probes | Where-Object { $_.Client.Connected } | ForEach-Object { $_.Address })
    foreach ($probe in $probes) { $probe.Client.Dispose() }
    foreach ($address in $open) {
        & $script:adb connect "${address}:5555" | Out-Null
        Start-Sleep -Milliseconds 300
        $model = ((& $script:adb -s "${address}:5555" shell getprop ro.product.model 2>$null) -join '').Trim()
        if ($model -match 'MiTV-MSSP3') {
            return [pscustomobject]@{ Serial = "${address}:5555"; Ip = $address; Model = $model }
        }
    }
    throw 'A Xiaomi MiTV-MSSP3 não foi encontrada. Confirme que ADB por rede está ativo ou indique o IP: Iniciar_MeuJW.bat 192.168.1.X'
}

function Ensure-Firewall {
    $rule = Get-NetFirewallRule -Name $firewallRuleName -ErrorAction SilentlyContinue
    if (-not $rule) {
        New-NetFirewallRule -Name $firewallRuleName -DisplayName 'Meu JW - servidor local 8765' `
            -Enabled True -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port `
            -RemoteAddress LocalSubnet -Profile Any | Out-Null
    } else {
        $rule | Set-NetFirewallRule -Enabled True -Direction Inbound -Action Allow -Profile Any | Out-Null
        $rule | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -RemoteAddress LocalSubnet | Out-Null
    }
}

function Stop-PreviousServer {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    foreach ($listener in $listeners) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        $commandLine = [string]$process.CommandLine
        if ($commandLine -notmatch 'server\.app\.cli\s+serve') {
            throw "A porta $port já pertence a outro programa (PID $($listener.OwningProcess)). Não foi terminado."
        }
        Write-Step "A terminar o servidor Meu JW anterior (PID $($listener.OwningProcess))..."
        Stop-Process -Id $listener.OwningProcess -Force
    }
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (-not (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) { return }
        Start-Sleep -Milliseconds 250
    }
    throw "A porta $port não ficou livre."
}

function Start-Server {
    if (-not (Test-Path -LiteralPath $python)) { throw "Ambiente Python ausente: $python" }
    New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
    Remove-Item -LiteralPath $stdoutLog, $stderrLog -Force -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath $python -ArgumentList @('-u', '-m', 'server.app.cli', 'serve') `
        -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog -PassThru
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if ($process.HasExited) {
            $errorText = if (Test-Path $stderrLog) { Get-Content -Raw $stderrLog } else { '' }
            throw "O servidor terminou durante o arranque.`n$errorText"
        }
        try {
            $response = Invoke-RestMethod -TimeoutSec 2 "http://127.0.0.1:$port/health"
            if ($response.status -eq 'ok') {
                $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop |
                    Select-Object -First 1
                Set-Content -LiteralPath $pidFile -Value $listener.OwningProcess -Encoding ASCII
                return (Get-Process -Id $listener.OwningProcess)
            }
        } catch { }
        Start-Sleep -Milliseconds 250
    }
    throw 'O servidor não respondeu a /health dentro do tempo esperado.'
}

function Configure-Tv([pscustomobject]$Tv, [string]$PcIp) {
    $installed = (& $script:adb -s $Tv.Serial shell pm path $packageName 2>$null) -join ''
    if (-not $installed.Trim()) {
        if (-not (Test-Path -LiteralPath $apk)) { throw "APK não encontrado: $apk" }
        Write-Step 'A instalar a app na TV...'
        Invoke-Adb @('-s', $Tv.Serial, 'install', '-r', $apk) | Out-Host
    }
    & $script:adb -s $Tv.Serial shell pm grant $packageName android.permission.WRITE_SECURE_SETTINGS 2>$null
    $url = "http://${PcIp}:$port"
    Write-Step "A configurar a TV para $url..."
    Invoke-Adb @('-s', $Tv.Serial, 'shell', 'cmd', 'activity', 'start-activity', '-n',
        "$packageName/.MainActivity", '--es', 'server_url', $url) | Out-Host
    return $url
}

try {
    Set-Location $projectRoot
    $script:adb = Find-Adb
    Write-Step "ADB: $script:adb"
    & $script:adb start-server | Out-Null

    $tv = $null
    if ($TvIp) {
        Write-Step "A ligar à TV indicada em ${TvIp}:5555..."
        & $script:adb connect "${TvIp}:5555" | Out-Host
        Start-Sleep -Milliseconds 500
        $model = ((& $script:adb -s "${TvIp}:5555" shell getprop ro.product.model 2>$null) -join '').Trim()
        if (-not $model) { throw "Não foi possível comunicar com a TV em $TvIp." }
        $tv = [pscustomobject]@{ Serial = "${TvIp}:5555"; Ip = $TvIp; Model = $model }
    } else {
        $tv = Get-ConnectedTv
        if (-not $tv) { $tv = Find-TvOnLocalSubnet }
    }
    if (-not $tv.Ip) { throw 'Foi encontrada uma TV por ADB, mas não foi possível determinar o respetivo IP.' }
    Write-Step "TV encontrada: $($tv.Model) em $($tv.Ip)"

    $pcIp = Get-PcAddressForTv $tv.Ip
    Write-Step "IP atual do PC na mesma rede: $pcIp"
    if (-not $SkipFirewall) {
        Ensure-Firewall
        Write-Step 'Firewall local confirmada para TCP 8765 / LocalSubnet.'
    }
    Stop-PreviousServer
    # Pass the already-discovered device to the Python voice service. Start-Process
    # inherits these values, so the server never needs a second subnet discovery.
    $env:MEUJW_ADB_PATH = $script:adb
    $env:MEUJW_TV_SERIAL = $tv.Serial
    $env:MEUJW_TV_IP = $tv.Ip
    $serverProcess = Start-Server
    Write-Step "Servidor iniciado em segundo plano (PID $($serverProcess.Id))."
    $configuredUrl = Configure-Tv $tv $pcIp

    $connected = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $logs = @()
        if (Test-Path $stdoutLog) { $logs += Get-Content $stdoutLog -Tail 100 -ErrorAction SilentlyContinue }
        if (Test-Path $stderrLog) { $logs += Get-Content $stderrLog -Tail 100 -ErrorAction SilentlyContinue }
        if (($logs -join "`n") -match ([regex]::Escape($tv.Ip) + '.*GET /health.*200')) {
            $connected = $true
            break
        }
        Start-Sleep -Milliseconds 500
    }
    if (-not $connected) {
        throw "O servidor está ativo em $configuredUrl, mas não recebeu /health da TV. Consulte $stderrLog"
    }
    Write-Host ''
    Write-Host 'Meu JW está pronto.' -ForegroundColor Green
    Write-Host "PC: $configuredUrl"
    Write-Host "TV: $($tv.Ip)"
    Write-Host "Admin: http://127.0.0.1:$port/admin"
    Write-Host "Logs: $logRoot"
    exit 0
} catch {
    Write-Host ''
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
