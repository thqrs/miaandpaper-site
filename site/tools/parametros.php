<?php
/**
 * tools/parametros.php — PARAMETROS_V1
 *
 * O inventário de tudo o que se pode pedir ao site por URL, com um link por
 * valor possível. É daqui que se conduz o site sem escrever query strings à
 * mão.
 *
 * `?formato=json` devolve o mesmo conteúdo como manifesto — a forma de um
 * `tools/list` do MCP, com `esquemaEntrada` em JSON Schema por recurso. Ver
 * `lib/parametros.php` para o registo e `docs/11-parametros-de-url.md` para o
 * texto.
 */

require_once __DIR__ . '/../admin-open.php';   // ADMIN_OPEN_DEV_V1: sem password até ao deploy
require_once __DIR__ . '/../lib/parametros.php';
require_once __DIR__ . '/../lib/comandos.php';

$PAGINA = 'tools/parametros.php';
$formato = mp_parametros_actual($PAGINA, 'formato');
$tipoFiltro = mp_parametros_actual($PAGINA, 'tipo');
$recursoFiltro = mp_parametros_actual($PAGINA, 'recurso');
$mostrarVazios = mp_parametros_actual($PAGINA, 'vazios') === '1';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    if ($formato === 'json') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => false, 'message' => 'Acesso restrito.'), JSON_UNESCAPED_UNICODE);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Parâmetros</title>'
        . '<style>body{font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px;color:#3b2f1f;}h1{font-size:1.4rem;}a{color:#4f7a3a;font-weight:700;}</style>'
        . '<h1>Acesso restrito.</h1>'
        . '<p>Inicia sessão como administradora a partir de <a href="../index.html">index.html</a> e regressa a esta página.</p>';
    exit;
}

// ── Manifesto ───────────────────────────────────────────────────────────────

if ($formato === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');

    $manifesto = mp_parametros_manifesto();
    // O registry dos comandos é a única fonte de verdade das operações. Fica
    // pendurado neste manifesto já existente, em vez de haver outro endpoint
    // parecido mas potencialmente divergente.
    $manifesto['comandos'] = cmd_manifesto();
    if ($recursoFiltro !== '' || $tipoFiltro !== '') {
        $manifesto['recursos'] = array_values(array_filter(
            $manifesto['recursos'],
            function ($r) use ($recursoFiltro, $tipoFiltro) {
                if ($recursoFiltro !== '' && $r['nome'] !== $recursoFiltro) {
                    return false;
                }
                return $tipoFiltro === '' || $r['tipo'] === $tipoFiltro;
            }
        ));
    }

    echo json_encode($manifesto, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

// ── Página ──────────────────────────────────────────────────────────────────

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

function par_h($v)
{
    return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}

/**
 * O link que experimenta um valor. Os recursos estão todos registados com o
 * caminho a partir de `site/`, e esta página vive em `site/tools/` — daí o
 * `../`, que o browser normaliza (`../tools/x.php` → `tools/x.php`).
 */
function par_url($id, array $query = array())
{
    $url = '../' . $id;
    return $query ? $url . '?' . http_build_query($query) : $url;
}

$rotulosTipo = array(
    'pagina' => 'página',
    'api' => 'API',
    'ficheiro' => 'ficheiro',
    'ferramenta' => 'ferramenta',
);
$rotulosGuarda = array(
    'admin' => 'sessão admin',
    'publico' => 'público',
    'token' => 'token no URL',
    'condicional' => 'depende da acção',
);

$recursos = mp_parametros_registo();
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Parâmetros | Mia &amp; Paper</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="../admin-nav.css?v=20260908010816">
  <script src="../admin-nav.js?v=20260908010816" data-prefix="../" defer></script>
  <style>
    :root {
      --ink: #3b2f1f;
      --muted: #7a6a52;
      --line: rgba(0,0,0,0.14);
      --moss: #4f7a3a;
      --paper: #f6f2e8;
      --card: #fffdf8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font: 400 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    main { max-width: 1080px; margin: 0 auto; padding: 26px 20px 80px; }
    h1 { font-size: 1.5rem; margin: 0 0 4px; }
    h2 { font-size: 1.05rem; margin: 0; }
    a { color: var(--moss); }
    code { font: 600 0.86em/1.4 ui-monospace, "SFMono-Regular", Consolas, monospace; }

    .sumario { color: var(--muted); font-size: 0.9rem; margin: 0 0 18px; }
    .recurso {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px 18px;
      margin: 0 0 14px;
    }
    .recurso-topo { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: baseline; }
    .recurso-topo h2 a { text-decoration: none; }
    .etiqueta {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 1px 9px;
    }
    .recurso p { margin: 6px 0 0; color: var(--muted); font-size: 0.9rem; }

    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.88rem; }
    th, td { text-align: left; vertical-align: top; padding: 7px 10px 7px 0; border-bottom: 1px solid rgba(0,0,0,0.07); }
    th { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 700; }
    td.valores { width: 46%; }
    .chip {
      display: inline-block;
      margin: 2px 4px 2px 0;
      padding: 2px 10px;
      border: 1px solid rgba(79,122,58,0.4);
      border-radius: 999px;
      background: rgba(79,122,58,0.08);
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .chip small { display: block; font-weight: 400; color: var(--muted); font-size: 0.72rem; }
    .livre { color: var(--muted); font-size: 0.84rem; }
    .fonte { color: var(--muted); font-size: 0.78rem; white-space: nowrap; }
    .vazio { color: var(--muted); font-size: 0.86rem; margin-top: 8px; }
    .depende { color: var(--muted); font-size: 0.76rem; }
    @media (max-width: 720px) {
      td.valores { width: auto; }
      table, tbody, tr, td, th { display: block; }
      th { display: none; }
      td { border: 0; padding: 2px 0; }
      tr { border-bottom: 1px solid rgba(0,0,0,0.07); padding: 8px 0; }
    }
  </style>
</head>
<body>
<?= mp_parametros_barra($PAGINA) ?>
<main>
  <h1>Parâmetros</h1>
  <p class="sumario">
    <?= count($recursos) ?> ficheiros registados ·
    <a href="<?= par_h(mp_parametros_url($PAGINA, array('formato' => 'json'))) ?>">manifesto JSON</a> ·
    <code>docs/11-parametros-de-url.md</code>
  </p>

<?php
$mostrados = 0;
foreach ($recursos as $id => $recurso):
    if ($recursoFiltro !== '' && $id !== $recursoFiltro) continue;
    if ($tipoFiltro !== '' && $recurso['tipo'] !== $tipoFiltro) continue;
    if (!$mostrarVazios && empty($recurso['parametros'])) continue;
    $mostrados++;
    $ladoCliente = isset($recurso['lado']) && $recurso['lado'] === 'cliente';
?>
  <section class="recurso" id="<?= par_h(str_replace(array('/', '.'), '-', $id)) ?>">
    <div class="recurso-topo">
      <h2><a href="<?= par_h(par_url($id)) ?>"><?= par_h($recurso['titulo']) ?></a></h2>
      <code><?= par_h($id) ?></code>
      <span class="etiqueta"><?= par_h(isset($rotulosTipo[$recurso['tipo']]) ? $rotulosTipo[$recurso['tipo']] : $recurso['tipo']) ?></span>
      <span class="etiqueta"><?= par_h(isset($rotulosGuarda[$recurso['guarda']]) ? $rotulosGuarda[$recurso['guarda']] : $recurso['guarda']) ?></span>
      <span class="etiqueta"><?= par_h(implode(' · ', $recurso['metodos'])) ?></span>
      <?php if ($ladoCliente): ?><span class="etiqueta">lido no browser</span><?php endif; ?>
    </div>
    <p><?= par_h($recurso['descricao']) ?><?php if (!empty($recurso['documento'])): ?>
      · <code><?= par_h($recurso['documento']) ?></code>
    <?php endif; ?></p>

<?php if (empty($recurso['parametros'])): ?>
    <p class="vazio">Sem parâmetros de URL.</p>
<?php else: ?>
    <table>
      <thead><tr><th>parâmetro</th><th>tipo</th><th class="valores">valores</th><th>lido em</th></tr></thead>
      <tbody>
      <?php foreach ($recurso['parametros'] as $nome => $d):
          $tipo = isset($d['tipo']) ? $d['tipo'] : 'texto';
          $omissao = isset($d['omissao']) ? (string)$d['omissao'] : '';
      ?>
        <tr>
          <td>
            <code><?= par_h($nome) ?></code>
            <?php if (!empty($d['repetivel'])): ?><span class="depende">repetível</span><?php endif; ?>
            <?php if (!empty($d['depende'])): ?>
              <div class="depende">só com
                <?php $ds = array(); foreach ($d['depende'] as $k => $v) { $ds[] = $k . '=' . ($v === '*' ? '…' : $v); } ?>
                <code><?= par_h(implode(' e ', $ds)) ?></code>
              </div>
            <?php endif; ?>
            <div class="depende"><?= par_h($d['descricao']) ?></div>
          </td>
          <td>
            <?= par_h($tipo) ?>
            <?php if ($omissao !== ''): ?><div class="depende">omissão: <code><?= par_h($omissao) ?></code></div><?php endif; ?>
            <?php if (isset($d['invalido']) && $d['invalido'] === 'erro'): ?><div class="depende">inválido: erro</div><?php endif; ?>
          </td>
          <td class="valores">
            <?php if (($tipo === 'enum' || $tipo === 'accao') && !empty($d['valores'])): ?>
              <?php foreach ($d['valores'] as $valor => $etiqueta): ?>
                <a class="chip" href="<?= par_h(par_url($id, mp_parametros_dependencias($id, $nome) + array($nome => $valor))) ?>">
                  <?= par_h($valor) ?><small><?= par_h($etiqueta) ?></small>
                </a>
              <?php endforeach; ?>
            <?php elseif ($tipo === 'flag'): ?>
              <a class="chip" href="<?= par_h(par_url($id, mp_parametros_dependencias($id, $nome) + array($nome => '1'))) ?>">1<small>ligar</small></a>
              <a class="chip" href="<?= par_h(par_url($id, mp_parametros_dependencias($id, $nome) + array($nome => '0'))) ?>">0<small>desligar</small></a>
            <?php else: ?>
              <form method="get" action="<?= par_h(par_url($id)) ?>" style="display:inline-flex;gap:6px;align-items:center;">
                <?php foreach (mp_parametros_dependencias($id, $nome) as $dk => $dv): ?>
                  <input type="hidden" name="<?= par_h($dk) ?>" value="<?= par_h($dv) ?>">
                <?php endforeach; ?>
                <input
                  type="<?= $tipo === 'data' ? 'date' : ($tipo === 'inteiro' ? 'number' : 'text') ?>"
                  name="<?= par_h($nome) ?>"
                  <?= isset($d['maximo']) ? 'maxlength="' . (int)$d['maximo'] . '"' : '' ?>
                  <?= isset($d['minimo']) ? 'min="' . (int)$d['minimo'] . '"' : '' ?>
                  placeholder="<?= par_h(isset($d['exemplo']) ? $d['exemplo'] : $nome) ?>"
                  style="padding:3px 10px;border:1px solid var(--line);border-radius:999px;background:#fff;font:inherit;font-size:0.84rem;color:inherit;width:16ch;">
                <button type="submit" class="chip" style="cursor:pointer;background:rgba(79,122,58,0.14);">abrir</button>
              </form>
              <?php if (!empty($d['padrao'])): ?><div class="livre"><code><?= par_h($d['padrao']) ?></code></div><?php endif; ?>
            <?php endif; ?>
          </td>
          <td class="fonte"><?= par_h(isset($d['lido']) ? $d['lido'] : '—') ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
<?php endif; ?>
  </section>
<?php endforeach; ?>

<?php if ($mostrados === 0): ?>
  <section class="recurso"><p>Nada com este filtro.</p></section>
<?php endif; ?>
</main>
</body>
</html>