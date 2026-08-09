<?php
/**
 * ADMIN_OPEN_DEV_V1 — interruptor único para trabalhar sem password.
 *
 * Enquanto o site não está publicado, todas as páginas e APIs de admin ficam
 * abertas: este ficheiro marca a sessão como administradora antes de cada
 * guard `$_SESSION['miaandpaper_admin']` correr.
 *
 * ⚠️ ANTES DO DEPLOY: pôr MIA_ADMIN_OPEN a false (basta esta linha). Os guards
 * originais — incluindo materiais, preços, homepage, carrosséis, galeria,
 * reviews e comando.php — voltam todos a exigir login.
 *
 * Incluir antes do guard; se estiver aberto, este ficheiro inicia a sessão. As
 * constantes específicas das APIs são apenas reflexos deste interruptor; não
 * se alteram individualmente.
 */

require_once __DIR__ . '/lib/admin-session.php';
mp_admin_session_start();

if (!defined('MIA_ADMIN_OPEN')) {
    define('MIA_ADMIN_OPEN', true);
}

if (MIA_ADMIN_OPEN && empty($_SESSION['miaandpaper_admin'])) {
    mp_admin_authenticate_session();
}
