<?php
/** Percurso vertical, directamente dos JSONL privados. Sem snapshots nem escrita. */
require_once __DIR__ . '/admin-open.php';
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    exit('<!doctype html><html lang="pt-PT"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><h1>Acesso restrito</h1><p><a href="index.html">Inicia sessão na administração</a> e regressa ao funil.</p></html>');
}
session_write_close();
require_once __DIR__ . '/lib/private-paths.php';
require_once __DIR__ . '/lib/funilv2-presenter.php';
function fv_arg($key, $default = '') { return isset($_GET[$key]) && is_string($_GET[$key]) ? $_GET[$key] : $default; }
$action = fv_arg('action');
$date = fv_arg('date', gmdate('Y-m-d'));
$sid = substr(fv_arg('sid'), 0, 64);
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date) || !checkdate((int)substr($date,5,2), (int)substr($date,8,2), (int)substr($date,0,4))) {
    http_response_code(400); exit('Data inválida.');
}
if ($action === 'data') {
    header('Content-Type: application/json; charset=utf-8');
    $path = mp_private_path('funnel-jsonl/' . $date . '.jsonl');
    $legacy = false;
    if (!$path || !is_file($path)) { $path = mp_private_path('order-funnel-events.jsonl'); $legacy = true; }
    $sessions = array(); $events = array(); $limited = false; $invalid = 0; $eventBytes = 0;
    if ($path && is_file($path)) {
        $fp = @fopen($path, 'rb');
        if (!$fp) { http_response_code(503); echo json_encode(array('error'=>'Não foi possível ler o tracking.')); exit; }
        // Limite de I/O e memória explícito: os 16 MiB mais recentes, nunca os primeiros.
        $size = fstat($fp)['size']; $start = max(0, $size - 16 * 1024 * 1024);
        if ($start) { fseek($fp, $start); fgets($fp); $limited = true; }
        while (ftell($fp) < $size && ($line = fgets($fp, 262145)) !== false) {
            // Uma escrita incompleta fica para a próxima actualização.
            if (substr($line, -1) !== "\n") { if (strlen($line) === 262144) { while (($rest = fgets($fp,262145)) !== false && substr($rest,-1) !== "\n") {} $invalid++; } continue; }
            $e = json_decode($line, true);
            if (!is_array($e)) { $invalid++; continue; }
            $id = $e['session_id'] ?? '';
            if (!is_string($id) || $id === '' || !empty($e['skip_reason'])) continue;
            $iso = $e['timestamp_iso'] ?? $e['created_at'] ?? '';
            if (!is_string($iso)) { $invalid++; continue; }
            if (substr($iso,0,10) !== $date) continue;
            $ms = is_numeric($e['timestamp_ms'] ?? null) ? (float)$e['timestamp_ms'] : (strtotime($iso) ?: 0) * 1000;
            if (!isset($sessions[$id])) $sessions[$id] = array('id'=>$id,'count'=>0,'last'=>0,'first'=>$ms,'device'=>$e['device_type'] ?? '', 'ip'=>$e['ip'] ?? '', 'products'=>array());
            $s =& $sessions[$id]; $s['count']++; $s['first'] = min($s['first'],$ms);
            $age=$e['seconds_since_session_start'] ?? null;
            if (is_numeric($age) && $age>=0 && $age<=604800) $s['first']=min($s['first'],$ms-(float)$age*1000);
            if ($ms >= $s['last']) { $s['last']=$ms; $s['event']=$e['event_name'] ?? ''; }
            $slug = is_string($e['product_slug'] ?? null) ? $e['product_slug'] : '';
            if ($slug !== '') $s['products'][$slug] = true;
            unset($s);
            if ($sid !== '' && $id === $sid) {
                $e['_time']=$ms; $e['_key']=$date . ':' . ftell($fp); $e['_bytes']=strlen($line);
                $events[]=$e; $eventBytes+=strlen($line);
            }
            while (count($events) > 2000 || $eventBytes > 2 * 1024 * 1024) {
                $removed=array_shift($events); $eventBytes-=$removed['_bytes']; $limited=true;
            }
            if (count($sessions) > 3000) { unset($sessions[array_key_first($sessions)]); $limited=true; }
        }
        fclose($fp);
    }
    usort($events, function($a,$b) { return ($a['_time'] <=> $b['_time']) ?: (($a['client_event_index'] ?? 0) <=> ($b['client_event_index'] ?? 0)) ?: strnatcmp($a['_key'],$b['_key']); });
    $sessions = array_values($sessions);
    usort($sessions, function($a,$b) { return ($b['first'] <=> $a['first']) ?: strcmp($a['id'],$b['id']); });
    foreach ($sessions as &$s) $s['products']=array_keys($s['products']); unset($s);
    $events=array_map('fv_present_event',$events);
    echo json_encode(array('sessions'=>$sessions,'events'=>$events,'limited'=>$limited,'invalid'=>$invalid,'source'=>$legacy?'JSONL legado':'JSONL diário','date'=>$date), JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
$names=array();
foreach (fv_catalogue() as $key=>$entry) {
    $slug=substr($key,strpos($key,'|')+1);
    $names[$slug]=$entry['name'];
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Funil ao vivo · Mia &amp; Paper</title>
<link rel="stylesheet" href="css/01-tokens-agua.css?v=20260907014824">
<link rel="stylesheet" href="admin-nav.css?v=20260907014824">
<link rel="stylesheet" href="funilv2.css?v=<?= filemtime(__DIR__.'/funilv2.css') ?>">
</head>
<body>
<main>
  <header class="page-heading">
    <div><p class="eyebrow">Mia &amp; Paper · funil ao vivo</p><h1>Cada visita conta uma história.</h1><p class="muted">Escolhe uma hora de entrada. Segue as escolhas, os passos e as pequenas pausas.</p></div>
    <div class="live-controls"><button id="live" aria-pressed="true"><span class="live-dot"></span><span id="liveLabel">Live ligado</span></button><button id="refresh" aria-label="Actualizar agora">Actualizar</button></div>
  </header>
  <section class="visitors panel" aria-labelledby="visitorsTitle">
    <div class="section-heading"><div><p class="eyebrow">01 · Escolher uma visita</p><h2 id="visitorsTitle">Quem passou por aqui</h2></div><label>Dia do tracking (UTC)<input id="date" type="date" value="<?= htmlspecialchars($date,ENT_QUOTES,'UTF-8') ?>"></label></div>
    <div class="filter-row"><label class="search-label"><span class="sr-only">Procurar sessão, IP ou produto</span><input id="search" type="search" placeholder="Procurar visitante ou produto…"></label><p id="visitorCount" class="muted"></p></div>
    <div id="visitorGrid" class="visitor-grid" role="group" aria-label="Visitantes, por hora de entrada"></div>
    <p id="noVisitors" class="empty" hidden>Não há visitas para esta pesquisa.</p>
    <button id="moreVisitors" class="quiet-button" hidden>Mostrar mais visitantes</button>
    <div class="section-foot"><p>Mais recentes primeiro · horas de Lisboa</p><p id="status" role="status">A ler as visitas…</p></div>
  </section>
  <p id="warning" class="notice" hidden></p>
  <section id="journey" class="journey panel" aria-labelledby="journeyTitle" tabindex="-1">
    <p class="eyebrow">02 · Seguir o percurso</p><h2 id="journeyTitle">Uma linha do tempo, só desta pessoa.</h2>
    <p id="journeyMeta" class="muted">Toca num quadrado acima para abrir a visita.</p>
    <div id="sessionInfo" class="session-info"></div>
    <div id="route" class="route"></div>
    <button id="newEvents" class="new-events" hidden></button>
    <p id="timingNote" class="timing-note" hidden>Os tempos mostram intervalos entre registos, não atenção contínua. Sem mudança de passo, mostramos apenas o tempo mínimo observado.</p>
    <button id="older" class="quiet-button" hidden>Mostrar 200 acções anteriores</button>
    <ol id="timeline" class="timeline"></ol>
    <div id="empty" class="empty"><span class="empty-track" aria-hidden="true">●<br>│<br>●</span><p>A próxima história começa num dos quadrados acima.</p></div>
  </section>
  <p class="page-note">Cada quadrado corresponde a uma sessão de navegação. Só aparecem acções que o tracking guardou.</p>
</main>
<script id="productNames" type="application/json"><?= json_encode($names,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?></script>
<script src="admin-nav.js?v=20260907014824"></script>
<script src="funilv2.js?v=<?= filemtime(__DIR__.'/funilv2.js') ?>"></script>
</body></html>