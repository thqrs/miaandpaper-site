<?php
/**
 * ADMIN_OPEN_DEV_V1 — interruptor único para trabalhar sem password.
 *
 * Enquanto o site não está publicado, todas as páginas e APIs de admin ficam
 * abertas: este ficheiro marca a sessão como administradora antes de cada
 * guard `$_SESSION['miaandpaper_admin']` correr.
 *
 * ⚠️ ANTES DO DEPLOY: pôr MIA_ADMIN_OPEN a false (basta esta linha). Os guards
 * originais continuam todos no sítio e voltam a exigir login.
 *
 * Incluir SEMPRE depois de session_start() e antes do guard. Ficheiros que já
 * têm o próprio interruptor (GALERIA_REQUIRE_ADMIN, PRODUTOS_REQUIRE_ADMIN,
 * REVIEWS_REQUIRE_ADMIN) não precisam deste include.
 */

if (!defined('MIA_ADMIN_OPEN')) {
    define('MIA_ADMIN_OPEN', true);
}

if (MIA_ADMIN_OPEN) {
    if (function_exists('session_status')) {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
    } elseif (session_id() === '') {
        session_start();
    }
    $_SESSION['miaandpaper_admin'] = true;
}
