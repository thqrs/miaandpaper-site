<?php
/**
 * Resolve o IP do cliente sem confiar em cabecalhos de proxy enviados
 * directamente para a origem.
 *
 * Os proxies autorizados sao configurados por MIA_TRUSTED_PROXY_CIDRS, como
 * constante ou variavel de ambiente, separados por virgulas. Sem essa lista,
 * REMOTE_ADDR e sempre a autoridade.
 */

function mp_client_ip_normalize($value)
{
    $value = trim((string)$value);
    return filter_var($value, FILTER_VALIDATE_IP) ? $value : '';
}

function mp_client_ip_binary_in_cidr($ip, $cidr)
{
    $parts = explode('/', trim((string)$cidr), 2);
    $network = mp_client_ip_normalize(isset($parts[0]) ? $parts[0] : '');
    if ($network === '') {
        return false;
    }
    $ipBinary = @inet_pton($ip);
    $networkBinary = @inet_pton($network);
    if ($ipBinary === false || $networkBinary === false || strlen($ipBinary) !== strlen($networkBinary)) {
        return false;
    }
    $maxBits = strlen($ipBinary) * 8;
    $prefix = isset($parts[1]) && $parts[1] !== '' ? (int)$parts[1] : $maxBits;
    if ($prefix < 0 || $prefix > $maxBits) {
        return false;
    }
    $wholeBytes = intdiv($prefix, 8);
    $remainingBits = $prefix % 8;
    if ($wholeBytes > 0 && substr($ipBinary, 0, $wholeBytes) !== substr($networkBinary, 0, $wholeBytes)) {
        return false;
    }
    if ($remainingBits === 0) {
        return true;
    }
    $mask = (0xFF << (8 - $remainingBits)) & 0xFF;
    return (ord($ipBinary[$wholeBytes]) & $mask) === (ord($networkBinary[$wholeBytes]) & $mask);
}

function mp_client_ip_trusted_proxy_ranges()
{
    $raw = defined('MIA_TRUSTED_PROXY_CIDRS')
        ? (string)MIA_TRUSTED_PROXY_CIDRS
        : (string)getenv('MIA_TRUSTED_PROXY_CIDRS');
    return array_values(array_filter(array_map('trim', preg_split('/[\s,;]+/', $raw))));
}

function mp_client_ip_remote_is_trusted($remote)
{
    foreach (mp_client_ip_trusted_proxy_ranges() as $cidr) {
        if (mp_client_ip_binary_in_cidr($remote, $cidr)) {
            return true;
        }
    }
    return false;
}

function mp_client_ip_headers()
{
    return array(
        'REMOTE_ADDR' => isset($_SERVER['REMOTE_ADDR']) ? trim((string)$_SERVER['REMOTE_ADDR']) : '',
        'HTTP_CF_CONNECTING_IP' => isset($_SERVER['HTTP_CF_CONNECTING_IP']) ? trim((string)$_SERVER['HTTP_CF_CONNECTING_IP']) : '',
        'HTTP_X_REAL_IP' => isset($_SERVER['HTTP_X_REAL_IP']) ? trim((string)$_SERVER['HTTP_X_REAL_IP']) : '',
        'HTTP_X_FORWARDED_FOR' => isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? trim((string)$_SERVER['HTTP_X_FORWARDED_FOR']) : '',
    );
}

function mp_client_ip()
{
    $headers = mp_client_ip_headers();
    $remote = mp_client_ip_normalize($headers['REMOTE_ADDR']);
    if ($remote === '' || !mp_client_ip_remote_is_trusted($remote)) {
        return $remote;
    }

    $cf = mp_client_ip_normalize($headers['HTTP_CF_CONNECTING_IP']);
    if ($cf !== '') {
        return $cf;
    }
    $real = mp_client_ip_normalize($headers['HTTP_X_REAL_IP']);
    if ($real !== '') {
        return $real;
    }
    foreach (explode(',', $headers['HTTP_X_FORWARDED_FOR']) as $candidate) {
        $candidate = mp_client_ip_normalize($candidate);
        if ($candidate !== '') {
            return $candidate;
        }
    }
    return $remote;
}

function mp_client_ip_diagnostics()
{
    $headers = mp_client_ip_headers();
    $remote = mp_client_ip_normalize($headers['REMOTE_ADDR']);
    $trusted = $remote !== '' && mp_client_ip_remote_is_trusted($remote);
    $hasProxyHeaders = $headers['HTTP_CF_CONNECTING_IP'] !== ''
        || $headers['HTTP_X_REAL_IP'] !== ''
        || $headers['HTTP_X_FORWARDED_FOR'] !== '';
    $reasons = array();
    if ($hasProxyHeaders && !$trusted) {
        $reasons[] = 'Os cabecalhos de proxy foram ignorados porque REMOTE_ADDR nao esta na lista de proxies autorizados.';
    }
    if ($trusted) {
        $reasons[] = 'REMOTE_ADDR pertence a um proxy autorizado.';
    }
    return array(
        'effective' => mp_client_ip(),
        'remote_addr' => $headers['REMOTE_ADDR'],
        'cf_connecting_ip' => $headers['HTTP_CF_CONNECTING_IP'],
        'x_real_ip' => $headers['HTTP_X_REAL_IP'],
        'x_forwarded_for' => $headers['HTTP_X_FORWARDED_FOR'],
        'proxy_suspected' => $hasProxyHeaders,
        'remote_trusted' => $trusted,
        'reasons' => $reasons,
    );
}

