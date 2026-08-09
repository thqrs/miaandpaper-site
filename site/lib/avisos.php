<?php
/**
 * lib/avisos.php — AVISOS_ADMIN_V1
 *
 * Avisos por email para a Mia, em momentos que de outra forma só apareciam no
 * `error_log` — onde ninguém os vê a tempo.
 *
 * ── Para onde vão ───────────────────────────────────────────────────────────
 *
 * Para os endereços em `to` do ficheiro privado de configuração
 * (`private/miaandpaper-mail-config.php`, ou `private/mail.php` quando
 * MIAANDPAPER_PRIVATE_DIR está definido). O mesmo `to` que recebe as
 * encomendas, e aceita vários endereços separados por vírgula ou ponto e
 * vírgula. Se o ficheiro faltar, os avisos são silenciosamente ignorados —
 * nunca podem partir o fluxo do cliente.
 *
 * ── Quando ──────────────────────────────────────────────────────────────────
 *
 *   upload            um cliente enviou ficheiros
 *   guardrail         um travão entrou em acção (espaço, ritmo, tamanho)
 *   encomenda_falhou  a encomenda não conseguiu ser gravada
 *   email_falhou      o mail() da encomenda devolveu false
 *   config            falta configuração no servidor
 *
 * ── Anti-inundação ──────────────────────────────────────────────────────────
 *
 * Um aviso que dispara mil vezes deixa de ser um aviso. Cada tipo tem uma
 * janela de silêncio própria: dentro dela, as repetições são contadas e não
 * enviadas, e o aviso seguinte diz quantas houve. O estado vive num ficheiro
 * JSON em `private/`, não na base de dados — assim os avisos continuam a
 * funcionar mesmo que seja a base de dados a falhar.
 */

require_once __DIR__ . '/private-paths.php';

/** Janela de silêncio por tipo, em segundos. */
function mp_aviso_janela($tipo)
{
    $janelas = array(
        'upload' => 900,             // 15 min: agrupa os ficheiros de uma sessão
        'guardrail' => 3600,         // 1 h
        'encomenda_falhou' => 300,   // 5 min: é grave, mas não vale inundar
        'email_falhou' => 300,
        'config' => 21600,           // 6 h
    );
    return isset($janelas[$tipo]) ? $janelas[$tipo] : 1800;
}

function mp_aviso_estado_path()
{
    return mp_private_path('avisos-estado.json');
}

/**
 * Decide se este aviso deve sair agora. Devolve o número de ocorrências
 * suprimidas desde o último envio, ou `null` se ainda estamos em silêncio.
 */
function mp_aviso_deve_enviar($tipo, $chave)
{
    $path = mp_aviso_estado_path();
    if ($path === null) {
        return 0;
    }

    $id = $tipo . '|' . $chave;
    $agora = time();
    $janela = mp_aviso_janela($tipo);

    $handle = @fopen($path, 'c+b');
    if ($handle === false) {
        return 0;   // sem ficheiro de estado, é preferível avisar a mais
    }
    @flock($handle, LOCK_EX);
    $bruto = stream_get_contents($handle);
    $estado = json_decode((string)$bruto, true);
    if (!is_array($estado)) {
        $estado = array();
    }

    $ultimo = isset($estado[$id]['ultimo']) ? (int)$estado[$id]['ultimo'] : 0;
    $suprimidos = isset($estado[$id]['suprimidos']) ? (int)$estado[$id]['suprimidos'] : 0;
    $enviar = ($agora - $ultimo) >= $janela;

    if ($enviar) {
        $estado[$id] = array('ultimo' => $agora, 'suprimidos' => 0);
    } else {
        $estado[$id] = array('ultimo' => $ultimo, 'suprimidos' => $suprimidos + 1);
    }

    // Limpeza: entradas com mais de 30 dias não interessam a ninguém.
    foreach ($estado as $k => $v) {
        if (isset($v['ultimo']) && ($agora - (int)$v['ultimo']) > 2592000) {
            unset($estado[$k]);
        }
    }

    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($estado));
    @flock($handle, LOCK_UN);
    fclose($handle);
    @chmod($path, 0600);

    return $enviar ? $suprimidos : null;
}

/** Os destinatários configurados. Array vazio quando não há configuração. */
function mp_aviso_destinatarios()
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    $cache = array();
    $path = mp_private_mail_config_path();
    if (!$path || !is_file($path)) {
        return $cache;
    }

    $config = @require $path;
    if (!is_array($config) || empty($config['to'])) {
        return $cache;
    }

    foreach (preg_split('/[,;]+/', (string)$config['to']) as $email) {
        $email = trim(str_replace(array("\r", "\n"), '', $email));
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $cache[] = $email;
        }
    }
    return $cache;
}

function mp_aviso_remetente()
{
    $path = mp_private_mail_config_path();
    $config = ($path && is_file($path)) ? @require $path : null;
    $from = is_array($config) && !empty($config['from']) ? (string)$config['from'] : 'no-reply@miaandpaper.com';
    $from = trim(str_replace(array("\r", "\n"), '', $from));
    return filter_var($from, FILTER_VALIDATE_EMAIL) ? $from : 'no-reply@miaandpaper.com';
}

/**
 * Envia um aviso.
 *
 * @param string $tipo    um dos tipos acima (define a janela de silêncio)
 * @param string $chave   distingue avisos do mesmo tipo (ex.: o nome do travão)
 * @param string $assunto linha de assunto, sem prefixo
 * @param array  $linhas  corpo, uma entrada por linha
 *
 * Nunca lança excepções e nunca devolve erro ao chamador: um aviso que falha
 * não pode estragar uma encomenda.
 */
function mp_aviso($tipo, $chave, $assunto, array $linhas)
{
    try {
        $destinos = mp_aviso_destinatarios();
        if (empty($destinos)) {
            @error_log('[miaandpaper] aviso "' . $tipo . '/' . $chave . '" sem destinatários: ' . $assunto);
            return false;
        }

        $suprimidos = mp_aviso_deve_enviar($tipo, $chave);
        if ($suprimidos === null) {
            return false;   // ainda dentro da janela de silêncio
        }

        if ($suprimidos > 0) {
            $linhas[] = '';
            $linhas[] = 'Aconteceu mais ' . $suprimidos . ' vez(es) desde o último aviso, sem email.';
        }

        $linhas[] = '';
        $linhas[] = '---';
        $linhas[] = 'Aviso automático do site. Próximo aviso deste tipo daqui a, no mínimo, '
            . round(mp_aviso_janela($tipo) / 60) . ' minutos.';
        $linhas[] = gmdate('Y-m-d H:i:s') . ' UTC';

        $from = mp_aviso_remetente();
        $headers = implode("\r\n", array(
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'From: "Mia & Paper (avisos)" <' . $from . '>',
            'Reply-To: "Mia & Paper" <' . $from . '>',
            'X-Mailer: PHP/' . phpversion(),
            'Auto-Submitted: auto-generated',
        ));

        $assuntoLimpo = trim(str_replace(array("\r", "\n"), '', '[Mia & Paper] ' . $assunto));
        $corpo = implode("\n", $linhas);

        $ok = @mail(implode(', ', $destinos), $assuntoLimpo, $corpo, $headers, '-f' . $from);
        if (!$ok) {
            @error_log('[miaandpaper] aviso "' . $tipo . '" nao saiu: ' . $assuntoLimpo);
        }
        return (bool)$ok;
    } catch (Exception $e) {
        @error_log('[miaandpaper] mp_aviso rebentou: ' . $e->getMessage());
        return false;
    }
}

/** Contexto comum a todos os avisos: quem, de onde, em que página. */
function mp_aviso_contexto()
{
    require_once __DIR__ . '/client-ip.php';
    $ip = mp_client_ip();
    if ($ip === '') $ip = '(desconhecido)';
    $ref = isset($_SERVER['HTTP_REFERER']) ? (string)$_SERVER['HTTP_REFERER'] : '';
    $ua = isset($_SERVER['HTTP_USER_AGENT']) ? substr((string)$_SERVER['HTTP_USER_AGENT'], 0, 120) : '';
    $linhas = array('IP: ' . $ip);
    if ($ref !== '') {
        $linhas[] = 'Página: ' . substr($ref, 0, 160);
    }
    if ($ua !== '') {
        $linhas[] = 'Dispositivo: ' . $ua;
    }
    return $linhas;
}

function mp_aviso_tamanho($bytes)
{
    $bytes = max(0, (int)$bytes);
    if ($bytes < 1048576) {
        return number_format($bytes / 1024, 0, ',', ' ') . ' KB';
    }
    if ($bytes < 1073741824) {
        return number_format($bytes / 1048576, 1, ',', ' ') . ' MB';
    }
    return number_format($bytes / 1073741824, 2, ',', ' ') . ' GB';
}
