<?php
/**
 * SPRITES_UI_V1 — editor visual das spritesheets do Míu.
 *
 * Mostra todas as animações activas em loop, a sequência frame a frame e a
 * duração de cada passo. A configuração da cara vive em face-animations.json;
 * o corpo inteiro continua em animations.json, que permanece compatível com
 * o editor antigo do bot.php.
 */

require_once __DIR__ . '/admin-open.php';
if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8"><title>Acesso negado · Sprites</title>'
        . '<h1>Acesso restrito.</h1><p>Inicia sessão como administradora e regressa a esta página.</p>';
    exit;
}

require_once __DIR__ . '/lib/miu-animations.php';

function sprites_h($value)
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function sprites_json($value)
{
    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
}

function sprites_redirect($notice)
{
    header('Location: sprites.php?notice=' . rawurlencode((string)$notice));
    exit;
}

function sprites_body_payload($raw, $fallback)
{
    $raw = is_array($raw) ? $raw : array();
    return array(
        'schemaVersion' => 2,
        'updatedAt' => isset($fallback['updatedAt']) ? $fallback['updatedAt'] : '',
        'baseAnimationId' => isset($raw['baseAnimationId']) ? $raw['baseAnimationId'] : $fallback['baseAnimationId'],
        'display' => $fallback['display'],
        'animations' => isset($raw['animations']) && is_array($raw['animations']) ? $raw['animations'] : $fallback['animations'],
    );
}

function sprites_face_payload($raw, $fallback)
{
    $raw = is_array($raw) ? $raw : array();
    return array(
        'schemaVersion' => 1,
        'updatedAt' => isset($fallback['updatedAt']) ? $fallback['updatedAt'] : '',
        'baseAnimationId' => isset($raw['baseAnimationId']) ? $raw['baseAnimationId'] : $fallback['baseAnimationId'],
        'animations' => isset($raw['animations']) && is_array($raw['animations']) ? $raw['animations'] : $fallback['animations'],
    );
}

function sprites_add_face_animation($post, $files)
{
    $config = miu_face_animation_config();
    $name = trim((string)(isset($post['animation_name']) ? $post['animation_name'] : ''));
    if ($name === '') {
        throw new RuntimeException('Dá um nome à nova sprite.');
    }
    $id = miu_animation_slug(isset($post['animation_id']) && trim((string)$post['animation_id']) !== '' ? $post['animation_id'] : $name);
    foreach ($config['animations'] as $animation) {
        if ($animation['id'] === $id) {
            throw new RuntimeException('Já existe uma animação com esse identificador.');
        }
    }
    $columns = miu_animation_int(isset($post['columns']) ? $post['columns'] : 4, 1, 16, 4);
    $rows = miu_animation_int(isset($post['rows']) ? $post['rows'] : 2, 1, 16, 2);
    $frameMs = miu_animation_int(isset($post['frame_ms']) ? $post['frame_ms'] : 180, 40, 10000, 180);
    $upload = miu_animation_store_upload(isset($files['sheet']) ? $files['sheet'] : null, $id, $columns, $rows);
    $frameCount = $columns * $rows;
    $sequence = range(0, max(0, $frameCount - 1));
    $contexts = isset($post['contexts']) && is_array($post['contexts']) ? $post['contexts'] : array('launcher');
    $triggers = isset($post['triggers']) && is_array($post['triggers']) ? $post['triggers'] : array();
    $item = array(
        'id' => $id,
        'name' => $name,
        'file' => $upload['file'],
        'smallFile' => '',
        'columns' => $columns,
        'rows' => $rows,
        'sequence' => $sequence,
        'frameDurationsMs' => array_fill(0, count($sequence), $frameMs),
        'repeat' => 1,
        'enabled' => !empty($post['enabled']),
        'triggers' => $triggers,
        'products' => array(),
        'probability' => 1,
        'weight' => 1,
        'cooldownMs' => 0,
        'flipX' => false,
        'staticFrame' => 0,
        'motion' => array('type' => 'none', 'distancePx' => 0),
        'transform' => array('xPx' => 0, 'yPx' => 0, 'rotationDeg' => 0),
        'contexts' => $contexts,
    );
    try {
        $clean = miu_face_animation_sanitize_item($item);
        if (!$clean) {
            throw new RuntimeException('A nova animação não é válida.');
        }
        $config['animations'][] = $clean;
        miu_face_animation_write_config($config);
    } catch (Exception $e) {
        miu_animation_remove_uploaded_file($upload['file']);
        throw $e;
    }
}

$csrf = mp_admin_csrf_token();
$notice = isset($_GET['notice']) ? (string)$_GET['notice'] : '';
$error = isset($_SESSION['sprites_error']) ? (string)$_SESSION['sprites_error'] : '';
unset($_SESSION['sprites_error']);

if (isset($_SERVER['REQUEST_METHOD']) && strtoupper((string)$_SERVER['REQUEST_METHOD']) === 'POST') {
    if (!mp_admin_csrf_is_valid(isset($_POST['csrf']) ? $_POST['csrf'] : '')) {
        http_response_code(403);
        exit('Pedido recusado: token CSRF inválido.');
    }
    $action = isset($_POST['action']) ? (string)$_POST['action'] : '';
    try {
        if ($action === 'save_all') {
            $decoded = json_decode(isset($_POST['payload']) ? (string)$_POST['payload'] : '', true, 64);
            if (!is_array($decoded)) {
                throw new RuntimeException('Não foi possível ler as alterações das sprites.');
            }
            $currentBody = miu_animation_config();
            $currentFace = miu_face_animation_config();
            $body = miu_animation_config_from_array(sprites_body_payload(isset($decoded['body']) ? $decoded['body'] : array(), $currentBody));
            $face = miu_face_animation_config_from_array(sprites_face_payload(isset($decoded['face']) ? $decoded['face'] : array(), $currentFace));
            // Valida primeiro os dois documentos; só depois escreve.
            miu_animation_write_config($body);
            miu_face_animation_write_config($face);
            sprites_redirect('saved');
        }
        if ($action === 'add_sprite') {
            $kind = isset($_POST['sprite_kind']) && $_POST['sprite_kind'] === 'face' ? 'face' : 'body';
            if ($kind === 'face') {
                sprites_add_face_animation($_POST, $_FILES);
            } else {
                miu_animation_create_from_request($_POST, $_FILES);
            }
            sprites_redirect('added');
        }
    } catch (Exception $e) {
        $_SESSION['sprites_error'] = $e->getMessage();
        sprites_redirect('error');
    }
}

$bodyConfig = miu_animation_config();
$faceConfig = miu_face_animation_config();
$triggerOptions = miu_animation_trigger_options();
$motionOptions = miu_animation_motion_options();
$contextOptions = miu_face_animation_context_options();

function sprites_enrich_animation($anim, $root)
{
    if (!is_array($anim) || empty($anim['file'])) {
        return $anim;
    }
    if (!empty($anim['frameWidth']) && !empty($anim['frameHeight'])) {
        if (empty($anim['aspectRatio'])) {
            $anim['aspectRatio'] = round((float)$anim['frameWidth'] / (float)$anim['frameHeight'], 4);
        }
        return $anim;
    }
    $file = (string)$anim['file'];
    $baseName = preg_replace('/\.(?:webp|png|jpg|jpeg)$/i', '', $file);
    $companionJson = $root . $baseName . '.json';
    if (is_file($companionJson)) {
        $raw = @file_get_contents($companionJson);
        $data = is_string($raw) ? json_decode($raw, true) : null;
        if (is_array($data)) {
            if (!empty($data['frameWidth']) && !empty($data['frameHeight'])) {
                $anim['frameWidth'] = (int)$data['frameWidth'];
                $anim['frameHeight'] = (int)$data['frameHeight'];
                $anim['aspectRatio'] = round((float)$anim['frameWidth'] / (float)$anim['frameHeight'], 4);
                return $anim;
            }
            if (!empty($data['sheetWidth']) && !empty($data['sheetHeight']) && !empty($anim['columns']) && !empty($anim['rows'])) {
                $anim['sheetWidth'] = (int)$data['sheetWidth'];
                $anim['sheetHeight'] = (int)$data['sheetHeight'];
                $anim['frameWidth'] = round((int)$data['sheetWidth'] / (int)$anim['columns']);
                $anim['frameHeight'] = round((int)$data['sheetHeight'] / (int)$anim['rows']);
                $anim['aspectRatio'] = round((float)$anim['frameWidth'] / (float)$anim['frameHeight'], 4);
                return $anim;
            }
        }
    }
    $imgPath = $root . $file;
    if (is_file($imgPath)) {
        $size = @getimagesize($imgPath);
        if ($size && !empty($size[0]) && !empty($size[1]) && !empty($anim['columns']) && !empty($anim['rows'])) {
            $anim['sheetWidth'] = (int)$size[0];
            $anim['sheetHeight'] = (int)$size[1];
            $anim['frameWidth'] = round((int)$size[0] / (int)$anim['columns']);
            $anim['frameHeight'] = round((int)$size[1] / (int)$anim['rows']);
            $anim['aspectRatio'] = round((float)$anim['frameWidth'] / (float)$anim['frameHeight'], 4);
            return $anim;
        }
    }
    return $anim;
}

$imageFiles = array();
$root = __DIR__ . '/content/brand/miu/';
foreach (array_merge($bodyConfig['animations'], $faceConfig['animations']) as $animation) {
    foreach (array('file', 'smallFile') as $key) {
        if (!empty($animation[$key])) {
            $file = (string)$animation[$key];
            $imageFiles[$file] = is_file($root . $file);
        }
    }
}

$bodyAnimations = array_map(function($a) use ($root) { return sprites_enrich_animation($a, $root); }, $bodyConfig['animations']);
$faceAnimations = array_map(function($a) use ($root) { return sprites_enrich_animation($a, $root); }, $faceConfig['animations']);

$state = array(
    'body' => array(
        'baseAnimationId' => $bodyConfig['baseAnimationId'],
        'animations' => $bodyAnimations,
    ),
    'face' => array(
        'baseAnimationId' => $faceConfig['baseAnimationId'],
        'animations' => $faceAnimations,
    ),
    'triggers' => $triggerOptions,
    'motionOptions' => $motionOptions,
    'contexts' => $contextOptions,
    'imageFiles' => $imageFiles,
);
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Sprites do Míu · Mia &amp; Paper</title>
<link rel="stylesheet" href="admin-nav.css?v=20260907013932">
<script src="admin-nav.js?v=20260907013932" defer></script>
<style>
:root {
  --bg:#111326; --bg2:#0b0d1a; --card:#1a1d36; --card2:#202542; --line:#303655;
  --text:#f8f8fb; --muted:#a9aec8; --dim:#777d9b; --blue:#6d9cff; --cyan:#4dd7ec;
  --green:#43d39e; --amber:#f2be55; --red:#ff6b83; --black:#08090f; --radius:15px;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
button,input,select{font:inherit}.sprites-top{position:sticky;top:46px;z-index:40;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:13px 20px;background:rgba(17,19,38,.94);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.sprites-top h1{margin:0 auto 0 0;font-size:1.1rem}.btn{border:1px solid var(--line);background:var(--card2);color:var(--text);padding:7px 12px;border-radius:9px;cursor:pointer;text-decoration:none}.btn:hover{border-color:var(--blue)}.btn.primary{background:var(--blue);border-color:var(--blue);font-weight:700}.btn.add{font-size:1.08rem;padding-inline:14px}.btn.ghost{background:transparent;color:var(--muted)}
.shell{max-width:1500px;margin:0 auto;padding:22px 22px 120px}.intro{display:flex;gap:14px;align-items:end;justify-content:space-between;flex-wrap:wrap;margin-bottom:20px}.intro h2{margin:0 0 4px;font-size:1.35rem}.intro p{margin:0;color:var(--muted);max-width:760px}.stats{display:flex;gap:8px;flex-wrap:wrap}.pill{border:1px solid var(--line);background:var(--card);padding:5px 9px;border-radius:999px;color:var(--muted);font-size:.78rem}.pill strong{color:var(--text)}
.flash{padding:10px 13px;border-radius:10px;margin-bottom:14px;border:1px solid rgba(67,211,158,.35);background:rgba(67,211,158,.1);color:#bff5df}.flash.error{border-color:rgba(255,107,131,.4);background:rgba(255,107,131,.1);color:#ffc4ce}
.group{margin-top:26px}.group-head{display:flex;align-items:end;gap:10px;margin-bottom:10px}.group-head h2{margin:0;font-size:1.03rem}.group-head p{margin:0;color:var(--dim);font-size:.8rem}
.sprite-card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;margin-bottom:16px;box-shadow:0 10px 30px rgba(0,0,0,.18)}.sprite-card.is-off{opacity:.66}.sprite-card>header{display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.02)}.sprite-card>header strong{font-size:.96rem}.sprite-card>header code{font:12px var(--mono);color:var(--dim)}.enabled{margin-left:auto;display:flex;align-items:center;gap:7px;color:var(--muted)}.enabled input{accent-color:var(--green);width:17px;height:17px}
.sprite-layout{display:grid;grid-template-columns:minmax(430px,1.25fr) minmax(390px,.95fr);min-height:300px}.visual{padding:18px;display:grid;grid-template-columns:190px minmax(0,1fr);gap:18px;align-items:start}.preview-box{width:190px;height:190px;border:1px solid #454b69;background:linear-gradient(45deg,#292d43 25%,transparent 25%),linear-gradient(-45deg,#292d43 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#292d43 75%),linear-gradient(-45deg,transparent 75%,#292d43 75%);background-size:18px 18px;background-position:0 0,0 9px,9px -9px,-9px 0;position:relative;overflow:hidden;border-radius:8px}.preview-stage{position:absolute;inset:10px;display:flex;align-items:center;justify-content:center}.sprite-crop{width:100%;height:100%;background-repeat:no-repeat;will-change:background-position,transform}.missing{position:absolute;inset:0;display:none;place-items:center;padding:15px;text-align:center;background:rgba(8,9,15,.82);color:var(--muted);font-size:.78rem}.missing.show{display:grid}
.timeline-column{min-width:0}.timeline-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.timeline-title span{color:var(--muted);font-size:.8rem}.timeline-wrap{display:grid;grid-template-columns:30px minmax(0,1fr) 30px;gap:7px;align-items:center}.arrow{height:92px;padding:0;border:0;background:transparent;color:var(--text);font-size:2rem;cursor:pointer}.frames{display:flex;gap:7px;overflow-x:auto;padding:2px 2px 10px;scrollbar-width:thin;scroll-snap-type:x proximity}.frame-step{flex:0 0 70px;scroll-snap-align:start}.frame-thumb{width:70px;height:70px;border:1px solid #4a506d;background:#0f1120;border-radius:5px;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center}.frame-thumb .sprite-crop{width:100%;height:100%}.frame-index{position:absolute;top:3px;left:3px;background:rgba(0,0,0,.65);border-radius:4px;padding:1px 4px;font:10px var(--mono);color:#fff}.frame-step input{width:100%;margin-top:4px;background:var(--bg2);color:var(--text);border:1px solid var(--line);border-radius:5px;padding:3px 4px;text-align:center;font:11px var(--mono)}.frame-step small{display:block;text-align:center;color:var(--dim);font-size:9px;margin-top:1px}
.details{background:var(--black);padding:16px;border-left:1px solid var(--line)}.details-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.field{display:flex;flex-direction:column;gap:4px;min-width:0}.field.full{grid-column:1/-1}.field>span,.subhead{font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;color:#8d93aa}.field input,.field select{width:100%;min-width:0;border:1px solid #2e3348;background:#11131d;color:var(--text);border-radius:7px;padding:6px 7px}.field input:focus,.field select:focus{outline:none;border-color:var(--blue)}.field code{font:11px var(--mono);color:var(--cyan);word-break:break-all}.checkrow{display:flex;gap:10px;flex-wrap:wrap}.checkrow label{display:flex;gap:5px;align-items:center;color:var(--muted);font-size:.76rem}.checkrow input{accent-color:var(--blue)}.subhead{grid-column:1/-1;margin-top:7px;padding-top:9px;border-top:1px solid #252938}.circumstances{grid-column:1/-1;color:#c7cbda;font-size:.76rem;background:#10121b;border:1px solid #262a39;padding:8px;border-radius:7px}.base-label{display:flex;gap:7px;align-items:center;color:var(--amber);font-size:.76rem}.base-label input{accent-color:var(--amber)}
.add-panel{display:none;margin-bottom:20px;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:16px}.add-panel.open{display:block}.add-panel h2{margin:0 0 12px;font-size:1rem}.add-grid{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px}.add-grid .field input,.add-grid .field select{background:var(--bg2)}.add-actions{display:flex;gap:8px;align-items:center;margin-top:13px}.add-note{margin-left:auto;color:var(--dim);font-size:.75rem}
.dirty-dot{display:none;color:var(--amber);font-weight:700}.dirty .dirty-dot{display:inline}
@media(max-width:1050px){.sprite-layout{grid-template-columns:1fr}.details{border-left:0;border-top:1px solid var(--line)}}
@media(max-width:700px){.shell{padding-inline:12px}.sprites-top{top:46px;padding-inline:12px}.visual{grid-template-columns:1fr}.preview-box{width:min(190px,100%);aspect-ratio:1;height:auto}.add-grid{grid-template-columns:1fr 1fr}.details-grid{grid-template-columns:1fr}.field.full,.subhead,.circumstances{grid-column:1}.sprite-card>header code{display:none}}
</style>
</head>
<body>
<header class="sprites-top">
  <h1>Sprites do Míu <span class="dirty-dot">● por guardar</span></h1>
  <a class="btn ghost" href="bot.php?tab=animations">Painel do Míu</a>
  <button class="btn add" type="button" id="toggle-add" aria-expanded="false">＋</button>
  <button class="btn primary" type="button" id="save-all">Guardar alterações</button>
</header>
<main class="shell">
  <?php if ($notice === 'saved'): ?><div class="flash">Sprites guardadas. A configuração pública do Míu já usa estes valores.</div><?php endif; ?>
  <?php if ($notice === 'added'): ?><div class="flash">Nova sprite adicionada à biblioteca.</div><?php endif; ?>
  <?php if ($error !== ''): ?><div class="flash error"><?= sprites_h($error) ?></div><?php endif; ?>

  <section class="intro">
    <div><h2>Biblioteca visual</h2><p>Cada cartão mostra a animação em loop, todos os passos da sequência e o tempo de cada frame. À direita ficam localização, gatilhos, grelha, proporção, repetição, movimento e transformações X/Y/rotação.</p></div>
    <div class="stats"><span class="pill"><strong><?= count($faceConfig['animations']) ?></strong> cara</span><span class="pill"><strong><?= count($bodyConfig['animations']) ?></strong> corpo inteiro</span><span class="pill"><strong><?= count(array_filter($imageFiles)) ?></strong> imagens encontradas neste ZIP/site</span></div>
  </section>

  <form class="add-panel" id="add-panel" method="post" enctype="multipart/form-data" action="sprites.php">
    <input type="hidden" name="csrf" value="<?= sprites_h($csrf) ?>"><input type="hidden" name="action" value="add_sprite">
    <h2>Adicionar spritesheet</h2>
    <div class="add-grid">
      <label class="field"><span>Tipo</span><select name="sprite_kind"><option value="face">Cara / dentro da bolha</option><option value="body">Corpo inteiro</option></select></label>
      <label class="field"><span>Nome</span><input name="animation_name" required placeholder="Míu — surpreendido"></label>
      <label class="field"><span>ID opcional</span><input name="animation_id" placeholder="miu-cara-surpreendido"></label>
      <label class="field"><span>Imagem</span><input type="file" name="sheet" accept="image/webp,image/png" required></label>
      <label class="field"><span>Colunas</span><input type="number" name="columns" min="1" max="16" value="4"></label>
      <label class="field"><span>Linhas</span><input type="number" name="rows" min="1" max="16" value="2"></label>
      <label class="field"><span>Tempo inicial / frame</span><input type="number" name="frame_ms" min="40" max="10000" value="180"></label>
      <label class="field"><span>Estado</span><select name="enabled"><option value="1">Activa</option><option value="">Desactivada</option></select></label>
    </div>
    <div class="add-actions"><button class="btn primary" type="submit">Adicionar</button><button class="btn ghost" type="button" id="cancel-add">Cancelar</button><span class="add-note">WebP ou PNG · máximo 8 MB · células aproximadamente quadradas.</span></div>
  </form>

  <section class="group"><div class="group-head"><h2>Cara dentro da bolha</h2><p>Inclui a folha normal, a variante pequena e a folha de dormir.</p></div><div id="face-list"></div></section>
  <section class="group"><div class="group-head"><h2>Corpo inteiro / interacções</h2><p>As animações que podem andar, saltar ou aparecer em contextos do produto.</p></div><div id="body-list"></div></section>
</main>

<form id="save-form" method="post" action="sprites.php" hidden>
  <input type="hidden" name="csrf" value="<?= sprites_h($csrf) ?>"><input type="hidden" name="action" value="save_all"><input type="hidden" name="payload" id="save-payload">
</form>
<script type="application/json" id="sprites-state"><?= sprites_json($state) ?></script>
<script>
(function(){
  "use strict";
  var state = JSON.parse(document.getElementById("sprites-state").textContent || "{}");
  var timers = new Map();
  var dirty = false;
  var miuPrefix = "content/brand/miu/";

  function esc(value){ return String(value == null ? "" : value).replace(/[&<>\"]/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch];}); }
  function num(value,min,max,fallback){ value=Number(value); if(!Number.isFinite(value)) value=fallback; return Math.max(min,Math.min(max,value)); }
  function markDirty(){ dirty=true; document.body.classList.add("dirty"); }
  function imageUrl(file){ return file ? miuPrefix + String(file).replace(/^\/+/,"") : ""; }
  function framePos(index,cols,rows){ var c=index%cols,r=Math.floor(index/cols); return {x:cols<=1?0:(c/(cols-1))*100,y:rows<=1?0:(r/(rows-1))*100}; }
  function getAspectRatio(a){
    var fw = Number(a.frameWidth||0), fh = Number(a.frameHeight||0);
    if (fw > 0 && fh > 0) return fw / fh;
    var ar = Number(a.aspectRatio||0);
    if (ar > 0) return ar;
    var sw = Number(a.sheetWidth||0), sh = Number(a.sheetHeight||0), cols = Number(a.columns||1), rows = Number(a.rows||1);
    if (sw > 0 && sh > 0 && cols > 0 && rows > 0) return (sw / cols) / (sh / rows);
    return 1;
  }
  function transformCss(a){ var t=a.transform||{}, parts=[]; var x=num(t.xPx,-600,600,0),y=num(t.yPx,-600,600,0),rot=num(t.rotationDeg,-360,360,0); if(x||y) parts.push("translate3d("+x+"px,"+y+"px,0)"); if(rot) parts.push("rotate("+rot+"deg)"); if(a.flipX) parts.push("scaleX(-1)"); return parts.length?parts.join(" "):"none"; }
  function applyFrame(el,a,index,file){
    if(!el)return;
    var cols=Math.max(1,Number(a.columns||1)),rows=Math.max(1,Number(a.rows||1)),max=cols*rows-1;
    index=Math.max(0,Math.min(max,Number(index||0)));
    var p=framePos(index,cols,rows);
    var ratio=getAspectRatio(a);
    el.style.backgroundImage='url("'+imageUrl(file||a.file).replace(/"/g,"%22")+'")';
    el.style.backgroundSize=(cols*100)+"% "+(rows*100)+"%";
    el.style.backgroundPosition=p.x+"% "+p.y+"%";
    el.style.transform=transformCss(a);
    if(ratio!==1 && Number.isFinite(ratio) && ratio>0){
      el.style.aspectRatio=String(ratio);
      if(ratio<1){
        el.style.height="100%";
        el.style.width="auto";
        el.style.maxWidth=(ratio*100)+"%";
        el.style.maxHeight="100%";
      }else{
        el.style.width="100%";
        el.style.height="auto";
        el.style.maxWidth="100%";
        el.style.maxHeight=((1/ratio)*100)+"%";
      }
    }else{
      el.style.aspectRatio="1 / 1";
      el.style.width="100%";
      el.style.height="100%";
      el.style.maxWidth="100%";
      el.style.maxHeight="100%";
    }
  }
  function animationCycle(a){ return (a.frameDurationsMs||[]).reduce(function(sum,v){return sum+Math.max(40,Number(v||180));},0)||180; }
  function stopPreview(card){ var old=timers.get(card); if(old) window.clearTimeout(old); timers.delete(card); var stage=card.querySelector(".preview-stage"); if(stage&&stage.getAnimations) stage.getAnimations().forEach(function(x){try{x.cancel();}catch(e){}}); }
  function animateMotion(card,a){ var stage=card.querySelector(".preview-stage"); if(!stage||!stage.animate||!a.motion)return; var type=String(a.motion.type||"none"),d=Math.max(0,Number(a.motion.distancePx||0)); if(!d||type==="none")return; var duration=Math.max(450,animationCycle(a)); var frames=type==="jump"?[{transform:"translate3d(0,0,0)"},{transform:"translate3d(0,"+(-d)+"px,0)",offset:.5},{transform:"translate3d(0,0,0)"}]:[{transform:"translate3d(0,0,0)"},{transform:"translate3d("+(type==="left"?-d:d)+"px,0,0)"},{transform:"translate3d(0,0,0)"}]; stage.animate(frames,{duration:duration,iterations:Infinity,easing:"ease-in-out"}); }
  function startPreview(card,a){ stopPreview(card); var sprite=card.querySelector(".preview-box .sprite-crop"),seq=Array.isArray(a.sequence)&&a.sequence.length?a.sequence:[0],dur=Array.isArray(a.frameDurationsMs)?a.frameDurationsMs:[],i=0; function draw(){ applyFrame(sprite,a,seq[i],a.file); var delay=Math.max(40,Number(dur[i]||180)); i=(i+1)%seq.length; timers.set(card,window.setTimeout(draw,delay)); } draw(); animateMotion(card,a); }
  function triggerText(a){ var labels=(a.triggers||[]).map(function(t){return state.triggers[t]||t;}); if(!labels.length) labels.push("Sem gatilho: usada como animação base ou apenas por chamada directa"); if(a.products&&a.products.length) labels.push("Produtos: "+a.products.join(", ")); return labels.join(" · "); }
  function contextsHtml(a){ return Object.keys(state.contexts||{}).map(function(key){return '<label><input type="checkbox" data-field="context" value="'+esc(key)+'" '+((a.contexts||[]).indexOf(key)!==-1?'checked':'')+'> '+esc(state.contexts[key])+'</label>';}).join(""); }
  function triggersHtml(a){ return Object.keys(state.triggers||{}).map(function(key){return '<label><input type="checkbox" data-field="trigger" value="'+esc(key)+'" '+((a.triggers||[]).indexOf(key)!==-1?'checked':'')+'> '+esc(state.triggers[key])+'</label>';}).join(""); }
  function motionOptionsHtml(a){ return Object.keys(state.motionOptions||{}).map(function(key){return '<option value="'+esc(key)+'" '+(String((a.motion||{}).type||"none")===key?'selected':'')+'>'+esc(state.motionOptions[key])+'</option>';}).join(""); }
  function frameRail(card,a){ var host=card.querySelector(".frames"); host.innerHTML=""; (a.sequence||[]).forEach(function(frame,step){ var item=document.createElement("div"); item.className="frame-step"; item.innerHTML='<div class="frame-thumb"><div class="sprite-crop"></div><span class="frame-index">'+esc(frame)+'</span></div><input type="number" min="40" max="10000" value="'+esc((a.frameDurationsMs||[])[step]||180)+'" data-step="'+step+'"><small>ms</small>'; applyFrame(item.querySelector(".sprite-crop"),a,frame,a.file); host.appendChild(item); }); }
  function renderCard(a,kind,section){
    a.transform=a.transform||{xPx:0,yPx:0,rotationDeg:0}; a.motion=a.motion||{type:"none",distancePx:0}; a.products=a.products||[]; a.triggers=a.triggers||[];
    var card=document.createElement("article"); card.className="sprite-card"+(a.enabled===false?" is-off":""); card.dataset.id=a.id; card.dataset.kind=kind;
    var baseChecked=section.baseAnimationId===a.id?"checked":""; var imageFound=state.imageFiles&&state.imageFiles[a.file]===true;
    card.innerHTML='<header><strong>'+esc(a.name)+'</strong><code>'+esc(a.id)+'</code><label class="base-label"><input type="radio" name="base-'+kind+'" data-field="base" '+baseChecked+'> base</label><label class="enabled"><input type="checkbox" data-field="enabled" '+(a.enabled!==false?'checked':'')+'> activa</label></header>'+
      '<div class="sprite-layout"><div class="visual"><div class="preview-box"><div class="preview-stage"><div class="sprite-crop"></div></div><div class="missing '+(imageFound?'':'show')+'">Imagem não encontrada neste ZIP/site:<br><code>'+esc(a.file)+'</code></div></div><div class="timeline-column"><div class="timeline-title"><strong>Sequência</strong><span>'+(a.sequence||[]).length+' passos</span></div><div class="timeline-wrap"><button class="arrow" type="button" data-scroll="-1">‹</button><div class="frames"></div><button class="arrow" type="button" data-scroll="1">›</button></div></div></div>'+
      '<aside class="details"><div class="details-grid">'+
      '<label class="field full"><span>Nome</span><input data-field="name" value="'+esc(a.name)+'"></label>'+
      '<label class="field full"><span>Localização da imagem</span><input data-field="file" value="'+esc(a.file)+'"><code>'+esc(miuPrefix+a.file)+'</code></label>'+
      (kind==="face"?'<label class="field full"><span>Variante pequena (barra / mensagens)</span><input data-field="smallFile" value="'+esc(a.smallFile||'')+'"></label>':'')+
      '<label class="field"><span>Colunas</span><input type="number" data-field="columns" min="1" max="16" value="'+esc(a.columns)+'"></label><label class="field"><span>Linhas</span><input type="number" data-field="rows" min="1" max="16" value="'+esc(a.rows)+'"></label>'+
      '<label class="field"><span>Largura da frame (px)</span><input type="number" data-field="frameWidth" min="0" max="4000" placeholder="1:1 (padrão)" value="'+esc(a.frameWidth||'')+'"></label><label class="field"><span>Altura da frame (px)</span><input type="number" data-field="frameHeight" min="0" max="4000" placeholder="1:1 (padrão)" value="'+esc(a.frameHeight||'')+'"></label>'+
      '<label class="field full"><span>Sequência de frames</span><input data-field="sequence" value="'+esc((a.sequence||[]).join(', '))+'"></label>'+
      '<div class="subhead">Quando aparece</div><div class="field full"><div class="checkrow">'+triggersHtml(a)+'</div></div>'+
      (kind==="face"?'<div class="field full"><span>Contextos</span><div class="checkrow">'+contextsHtml(a)+'</div></div>':'')+
      '<label class="field full"><span>Produtos (* = todos)</span><input data-field="products" value="'+esc((a.products||[]).join(', '))+'" placeholder="*, molduras, cadernos"></label><div class="circumstances">'+esc(triggerText(a))+'</div>'+
      '<div class="subhead">Comportamento</div><label class="field"><span>Repetições (0 = contínua/base)</span><input type="number" data-field="repeat" min="0" max="20" value="'+esc(a.repeat)+'"></label><label class="field"><span>Frame estático</span><input type="number" data-field="staticFrame" min="0" value="'+esc(a.staticFrame)+'"></label><label class="field"><span>Probabilidade %</span><input type="number" data-field="probability" min="0" max="100" step="1" value="'+esc(Math.round(Number(a.probability==null?1:a.probability)*100))+'"></label><label class="field"><span>Peso</span><input type="number" data-field="weight" min="1" max="100" value="'+esc(a.weight||1)+'"></label><label class="field"><span>Cooldown (s)</span><input type="number" data-field="cooldown" min="0" max="3600" value="'+esc(Math.round(Number(a.cooldownMs||0)/1000))+'"></label><label class="field"><span>Espelhar X</span><select data-field="flipX"><option value="0" '+(!a.flipX?'selected':'')+'>Não</option><option value="1" '+(a.flipX?'selected':'')+'>Sim</option></select></label>'+
      (kind==="body"?'<label class="field"><span>Movimento</span><select data-field="motionType">'+motionOptionsHtml(a)+'</select></label><label class="field"><span>Distância (px)</span><input type="number" data-field="motionDistance" min="0" max="600" value="'+esc(a.motion.distancePx||0)+'"></label>':'')+
      '<div class="subhead">Transformação visual</div><label class="field"><span>X (px)</span><input type="number" data-field="x" min="-600" max="600" value="'+esc(a.transform.xPx||0)+'"></label><label class="field"><span>Y (px)</span><input type="number" data-field="y" min="-600" max="600" value="'+esc(a.transform.yPx||0)+'"></label><label class="field"><span>Rotação (°)</span><input type="number" data-field="rotation" min="-360" max="360" step="1" value="'+esc(a.transform.rotationDeg||0)+'"></label>'+
      '</div></aside></div>';
    function sync(){
      a=readCardSpecial(card,a,kind); card.classList.toggle("is-off",a.enabled===false); card.querySelector("header strong").textContent=a.name; card.querySelector(".circumstances").textContent=triggerText(a); frameRail(card,a); startPreview(card,a); var code=card.querySelector('.field.full code'); if(code)code.textContent=miuPrefix+a.file; markDirty();
    }
    card.addEventListener("input",function(e){ if(e.target.matches('[data-step]')){ var step=Number(e.target.dataset.step); a.frameDurationsMs[step]=num(e.target.value,40,10000,180); startPreview(card,a); markDirty(); return;} if(e.target.matches('[data-field="x"],[data-field="y"],[data-field="rotation"]')){a=readCardSpecial(card,a,kind);startPreview(card,a);markDirty();}});
    card.addEventListener("change",function(e){ if(e.target.matches('[data-field="base"]')){section.baseAnimationId=a.id;markDirty();return;} sync(); });
    card.querySelectorAll('[data-scroll]').forEach(function(btn){btn.addEventListener('click',function(){card.querySelector('.frames').scrollBy({left:Number(btn.dataset.scroll)*250,behavior:'smooth'});});});
    frameRail(card,a); startPreview(card,a); return card;
  }
  function readCardSpecial(card,a,kind){
    var flip=card.querySelector('[data-field="flipX"]'); var checked=flip&&flip.value==="1";
    function val(name){var el=card.querySelector('[data-field="'+name+'"]');return el?el.value:"";}
    a.name=val("name").trim()||a.name; a.file=val("file").trim(); a.columns=num(val("columns"),1,16,a.columns||1); a.rows=num(val("rows"),1,16,a.rows||1); a.sequence=val("sequence").split(/[\s,;]+/).map(Number).filter(function(v){return Number.isInteger(v)&&v>=0&&v<a.columns*a.rows;}).slice(0,128); if(!a.sequence.length)a.sequence=[0];
    var fw=num(val("frameWidth"),0,4000,0);
    var fh=num(val("frameHeight"),0,4000,0);
    if(fw>0 && fh>0){
      a.frameWidth=fw;
      a.frameHeight=fh;
      a.aspectRatio=Math.round((fw/fh)*10000)/10000;
    }else{
      delete a.frameWidth;
      delete a.frameHeight;
      delete a.aspectRatio;
    }
    var oldDur=Array.isArray(a.frameDurationsMs)?a.frameDurationsMs:[]; a.frameDurationsMs=a.sequence.map(function(_,i){var step=card.querySelector('[data-step="'+i+'"]');return num(step?step.value:oldDur[i],40,10000,180);}); a.repeat=num(val("repeat"),0,20,1); a.probability=num(val("probability"),0,100,100)/100; a.weight=num(val("weight"),1,100,1); a.cooldownMs=num(val("cooldown"),0,3600,0)*1000; a.staticFrame=num(val("staticFrame"),0,Math.max(0,a.columns*a.rows-1),0); a.flipX=checked; a.enabled=!!card.querySelector('[data-field="enabled"]:checked'); a.products=val("products").split(/[\s,;]+/).map(function(x){return x.trim().toLowerCase();}).filter(Boolean); a.triggers=Array.prototype.map.call(card.querySelectorAll('[data-field="trigger"]:checked'),function(el){return el.value;}); a.transform={xPx:num(val("x"),-600,600,0),yPx:num(val("y"),-600,600,0),rotationDeg:num(val("rotation"),-360,360,0)}; if(kind==="face"){a.smallFile=val("smallFile").trim();a.contexts=Array.prototype.map.call(card.querySelectorAll('[data-field="context"]:checked'),function(el){return el.value;});a.motion={type:"none",distancePx:0};}else{a.motion={type:val("motionType")||"none",distancePx:num(val("motionDistance"),0,600,0)};} return a;
  }
  function renderSection(kind){ var section=state[kind],host=document.getElementById(kind+"-list"); host.innerHTML=""; section.animations.forEach(function(a){host.appendChild(renderCard(a,kind,section));}); }
  renderSection("face"); renderSection("body");

  document.getElementById("save-all").addEventListener("click",function(){
    ["face","body"].forEach(function(kind){ var section=state[kind]; document.querySelectorAll('.sprite-card[data-kind="'+kind+'"]').forEach(function(card){ var idx=section.animations.findIndex(function(a){return a.id===card.dataset.id;}); if(idx>=0)section.animations[idx]=readCardSpecial(card,section.animations[idx],kind); }); });
    document.getElementById("save-payload").value=JSON.stringify({face:state.face,body:state.body}); document.getElementById("save-form").submit();
  });
  var add=document.getElementById("add-panel"),toggle=document.getElementById("toggle-add"); function setAdd(open){add.classList.toggle("open",open);toggle.setAttribute("aria-expanded",open?"true":"false");if(open){var first=add.querySelector('input[name="animation_name"]');if(first)first.focus();}} toggle.addEventListener("click",function(){setAdd(!add.classList.contains("open"));}); document.getElementById("cancel-add").addEventListener("click",function(){setAdd(false);});
  window.addEventListener("beforeunload",function(e){if(!dirty)return;e.preventDefault();e.returnValue="";});
})();
</script>
</body>
</html>