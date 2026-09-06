<?php
// Prependido apenas pelo teste de integração. Simula a sessão já autenticada
// pelo fluxo de login normal, mantendo MIA_ADMIN_OPEN=false.
define('MIA_ADMIN_OPEN', false);
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
$_SESSION['miaandpaper_admin'] = true;
