<?php
/**
 * Sessao administrativa unica e endurecida.
 *
 * Todas as paginas e APIs de administracao passam por este modulo antes de
 * ler ou escrever $_SESSION. O modo aberto de desenvolvimento continua a ser
 * decidido em admin-open.php; aqui so vive a mecanica da sessao.
 */

if (!defined('MP_ADMIN_SESSION_IDLE_SECONDS')) {
    define('MP_ADMIN_SESSION_IDLE_SECONDS', 30 * 60);
}
if (!defined('MP_ADMIN_SESSION_ROTATE_SECONDS')) {
    define('MP_ADMIN_SESSION_ROTATE_SECONDS', 15 * 60);
}

function mp_admin_request_is_https()
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    return isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443;
}

function mp_admin_session_start()
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        mp_admin_session_enforce_lifetime();
        return;
    }

    @ini_set('session.use_only_cookies', '1');
    @ini_set('session.use_strict_mode', '1');
    @ini_set('session.cookie_httponly', '1');
    @ini_set('session.cookie_samesite', 'Lax');
    @ini_set('session.cookie_secure', mp_admin_request_is_https() ? '1' : '0');

    if (PHP_SAPI !== 'cli' && session_id() === '') {
        session_name('miaandpaper_admin_session');
        session_set_cookie_params(array(
            'lifetime' => 0,
            'path' => '/',
            'secure' => mp_admin_request_is_https(),
            'httponly' => true,
            'samesite' => 'Lax',
        ));
    }

    session_start();
    mp_admin_session_enforce_lifetime();
}

function mp_admin_session_enforce_lifetime()
{
    if (empty($_SESSION['miaandpaper_admin'])) {
        return;
    }

    $now = time();
    $lastActivity = isset($_SESSION['miaandpaper_admin_last_activity'])
        ? (int)$_SESSION['miaandpaper_admin_last_activity']
        : $now;

    if ($lastActivity > 0 && ($now - $lastActivity) > MP_ADMIN_SESSION_IDLE_SECONDS) {
        unset(
            $_SESSION['miaandpaper_admin'],
            $_SESSION['miaandpaper_admin_csrf'],
            $_SESSION['miaandpaper_admin_authenticated_at'],
            $_SESSION['miaandpaper_admin_last_activity'],
            $_SESSION['miaandpaper_admin_rotated_at']
        );
        return;
    }

    $rotatedAt = isset($_SESSION['miaandpaper_admin_rotated_at'])
        ? (int)$_SESSION['miaandpaper_admin_rotated_at']
        : $now;
    if (PHP_SAPI !== 'cli' && ($now - $rotatedAt) >= MP_ADMIN_SESSION_ROTATE_SECONDS) {
        session_regenerate_id(true);
        $_SESSION['miaandpaper_admin_rotated_at'] = $now;
    }
    $_SESSION['miaandpaper_admin_last_activity'] = $now;
}

function mp_admin_authenticate_session()
{
    mp_admin_session_start();
    if (PHP_SAPI !== 'cli') {
        session_regenerate_id(true);
    }
    $now = time();
    $_SESSION['miaandpaper_admin'] = true;
    $_SESSION['miaandpaper_admin_authenticated_at'] = $now;
    $_SESSION['miaandpaper_admin_last_activity'] = $now;
    $_SESSION['miaandpaper_admin_rotated_at'] = $now;
    $_SESSION['miaandpaper_admin_csrf'] = bin2hex(random_bytes(32));
}

function mp_admin_logout_session()
{
    mp_admin_session_start();
    $_SESSION = array();
    if (PHP_SAPI !== 'cli' && ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', array(
            'expires' => time() - 42000,
            'path' => isset($params['path']) ? $params['path'] : '/',
            'domain' => isset($params['domain']) ? $params['domain'] : '',
            'secure' => !empty($params['secure']),
            'httponly' => true,
            'samesite' => 'Lax',
        ));
    }
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

function mp_admin_csrf_token()
{
    mp_admin_session_start();
    if (empty($_SESSION['miaandpaper_admin_csrf'])) {
        $_SESSION['miaandpaper_admin_csrf'] = bin2hex(random_bytes(32));
    }
    return (string)$_SESSION['miaandpaper_admin_csrf'];
}

function mp_admin_csrf_is_valid($sent)
{
    $sent = (string)$sent;
    return $sent !== '' && hash_equals(mp_admin_csrf_token(), $sent);
}

