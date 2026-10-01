<?php
/**
 * lib/orcamentos.php — ORCAMENTOS_V1
 *
 * O modelo dos orçamentos: forma, validação, contas e gravação. Partilhado
 * pela API (orcamentos-api.php) e pelo PDF (lib/orcamento-pdf.php), para que o
 * total que se vê no editor, o que fica gravado e o que sai no PDF sejam o
 * mesmo número calculado no mesmo sítio.
 *
 * ── Porque é que os descontos são linhas ────────────────────────────────────
 *
 * O cliente tem de ver o preço real e o que lhe foi descontado. Por isso um
 * orçamento tem dois tipos de linha:
 *
 *   item      quantidade × preço unitário = total       (100 crachás × 1,75 €)
 *   desconto  percentagem de um item, ou de todos os itens, ou valor fixo
 *             (desconto de quantidade 20 % sobre os crachás; oferta de 3 €)
 *
 * Um desconto percentual aponta para o `id` do item, não para a posição:
 * reordenar ou apagar linhas não pode mudar em silêncio o que é descontado.
 * Se o item apontado deixar de existir, o desconto passa a valer sobre todos.
 *
 * ── Arredondamentos ─────────────────────────────────────────────────────────
 *
 * Tudo em cêntimos inteiros. O editor repete estas contas em JavaScript só
 * para mostrar o total enquanto se escreve; ao gravar e no PDF manda o PHP.
 * `orc_arredondar()` arredonda metade para cima, como o Math.round do browser,
 * para os dois lados darem o mesmo número também nos valores negativos.
 *
 * Os dados vivem na base SQLite privada (tabelas `quotes` e `quote_settings`),
 * fora do repositório: têm nomes, contactos e NIF de clientes.
 */

require_once __DIR__ . '/db.php';

const ORC_ESTADOS = array('rascunho', 'enviado', 'aceite', 'recusado');
const ORC_IVA_MODOS = array('nenhum', 'isento', 'incluido', 'acrescido');
const ORC_MAX_LINHAS = 200;

function orc_texto($valor, $max)
{
    $valor = str_replace("\r\n", "\n", trim((string)$valor));
    $valor = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $valor);
    if (!is_string($valor)) {
        return '';
    }
    return function_exists('mb_substr') ? mb_substr($valor, 0, $max, 'UTF-8') : substr($valor, 0, $max);
}

function orc_numero($valor, $min, $max, $casas)
{
    if (is_string($valor)) {
        $valor = str_replace(array(' ', ','), array('', '.'), $valor);
    }
    $n = is_numeric($valor) ? (float)$valor : 0.0;
    if (!is_finite($n)) {
        $n = 0.0;
    }
    return round(max($min, min($max, $n)), $casas);
}

function orc_arredondar($valor)
{
    return (int)floor($valor + 0.5);
}

function orc_data($valor)
{
    $valor = (string)$valor;
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $valor, $m) && checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
        return $valor;
    }
    return date('Y-m-d');
}

function orc_definicoes_omissao()
{
    return array(
        'empresa' => array(
            'nome' => 'Mia & Paper',
            'titular' => '',
            'nif' => '',
            'morada' => '',
            'email' => '',
            'telefone' => '',
            'site' => 'miaandpaper.com',
            'iban' => '',
        ),
        'ivaModo' => 'isento',
        'ivaTaxa' => 23,
        'mencaoIsencao' => 'IVA isento ao abrigo do artigo 53.º do CIVA.',
        'validadeDias' => 30,
        'notasPadrao' => '',
        'rodape' => '',
    );
}

function orc_normalizar_definicoes($bruto)
{
    $omissao = orc_definicoes_omissao();
    $bruto = is_array($bruto) ? $bruto : array();
    $empresa = isset($bruto['empresa']) && is_array($bruto['empresa']) ? $bruto['empresa'] : array();
    $limpa = array();
    foreach ($omissao['empresa'] as $campo => $valor) {
        $limpa[$campo] = array_key_exists($campo, $empresa)
            ? orc_texto($empresa[$campo], $campo === 'morada' ? 400 : 160)
            : $valor;
    }
    $modo = isset($bruto['ivaModo']) ? (string)$bruto['ivaModo'] : $omissao['ivaModo'];
    return array(
        'empresa' => $limpa,
        'ivaModo' => in_array($modo, ORC_IVA_MODOS, true) ? $modo : $omissao['ivaModo'],
        'ivaTaxa' => orc_numero(isset($bruto['ivaTaxa']) ? $bruto['ivaTaxa'] : $omissao['ivaTaxa'], 0, 100, 2),
        'mencaoIsencao' => orc_texto(isset($bruto['mencaoIsencao']) ? $bruto['mencaoIsencao'] : $omissao['mencaoIsencao'], 300),
        'validadeDias' => (int)orc_numero(isset($bruto['validadeDias']) ? $bruto['validadeDias'] : $omissao['validadeDias'], 0, 365, 0),
        'notasPadrao' => orc_texto(isset($bruto['notasPadrao']) ? $bruto['notasPadrao'] : '', 3000),
        'rodape' => orc_texto(isset($bruto['rodape']) ? $bruto['rodape'] : '', 300),
    );
}

function orc_id_linha($valor)
{
    $id = preg_replace('/[^a-z0-9]/i', '', (string)$valor);
    return $id !== '' ? substr($id, 0, 24) : bin2hex(random_bytes(5));
}

function orc_normalizar($bruto, $definicoes)
{
    $bruto = is_array($bruto) ? $bruto : array();
    $cliente = isset($bruto['cliente']) && is_array($bruto['cliente']) ? $bruto['cliente'] : array();
    $limpoCliente = array();
    foreach (array('nome', 'empresa', 'nif', 'email', 'telefone', 'morada') as $campo) {
        $limpoCliente[$campo] = orc_texto(isset($cliente[$campo]) ? $cliente[$campo] : '', $campo === 'morada' ? 400 : 160);
    }

    $linhas = array();
    $ids = array();
    foreach (array_slice(isset($bruto['linhas']) && is_array($bruto['linhas']) ? $bruto['linhas'] : array(), 0, ORC_MAX_LINHAS) as $linha) {
        if (!is_array($linha)) {
            continue;
        }
        $id = orc_id_linha(isset($linha['id']) ? $linha['id'] : '');
        while (isset($ids[$id])) {
            $id = orc_id_linha('');
        }
        $ids[$id] = true;
        $tipo = isset($linha['tipo']) && $linha['tipo'] === 'desconto' ? 'desconto' : 'item';
        $base = array(
            'id' => $id,
            'tipo' => $tipo,
            'descricao' => orc_texto(isset($linha['descricao']) ? $linha['descricao'] : '', 300),
            'detalhe' => orc_texto(isset($linha['detalhe']) ? $linha['detalhe'] : '', 600),
        );
        if ($tipo === 'item') {
            $base['quantidade'] = orc_numero(isset($linha['quantidade']) ? $linha['quantidade'] : 1, 0, 1000000, 2);
            $base['precoUnitCents'] = (int)orc_numero(isset($linha['precoUnitCents']) ? $linha['precoUnitCents'] : 0, -100000000, 100000000, 0);
        } else {
            $modo = isset($linha['modo']) && $linha['modo'] === 'valor' ? 'valor' : 'percent';
            $base['modo'] = $modo;
            $base['percentagem'] = orc_numero(isset($linha['percentagem']) ? $linha['percentagem'] : 0, 0, 100, 2);
            $base['valorCents'] = (int)orc_numero(isset($linha['valorCents']) ? $linha['valorCents'] : 0, 0, 100000000, 0);
            $base['alvo'] = isset($linha['alvo']) && $linha['alvo'] !== 'todos' ? orc_id_linha($linha['alvo']) : 'todos';
        }
        $linhas[] = $base;
    }

    $estado = isset($bruto['estado']) ? (string)$bruto['estado'] : 'rascunho';
    return array(
        'titulo' => orc_texto(isset($bruto['titulo']) ? $bruto['titulo'] : '', 200),
        'cliente' => $limpoCliente,
        'data' => orc_data(isset($bruto['data']) ? $bruto['data'] : ''),
        'validadeDias' => (int)orc_numero(isset($bruto['validadeDias']) ? $bruto['validadeDias'] : $definicoes['validadeDias'], 0, 365, 0),
        'estado' => in_array($estado, ORC_ESTADOS, true) ? $estado : 'rascunho',
        'linhas' => $linhas,
        'portesDescricao' => orc_texto(isset($bruto['portesDescricao']) ? $bruto['portesDescricao'] : '', 160),
        'portesCents' => (int)orc_numero(isset($bruto['portesCents']) ? $bruto['portesCents'] : 0, 0, 100000000, 0),
        'notas' => orc_texto(isset($bruto['notas']) ? $bruto['notas'] : '', 4000),
    );
}

/**
 * As contas. Devolve o total de cada linha (por id) e os totais do orçamento.
 * O IVA segue as definições: 'acrescido' soma por cima, 'incluido' mostra a
 * parte que já está dentro do total, 'isento' e 'nenhum' não mexem no total.
 */
function orc_totais($orcamento, $definicoes)
{
    $porLinha = array();
    $itens = 0;
    foreach ($orcamento['linhas'] as $linha) {
        if ($linha['tipo'] === 'item') {
            $porLinha[$linha['id']] = orc_arredondar($linha['quantidade'] * $linha['precoUnitCents']);
            $itens += $porLinha[$linha['id']];
        }
    }

    $descontos = 0;
    $bases = array();
    foreach ($orcamento['linhas'] as $linha) {
        if ($linha['tipo'] !== 'desconto') {
            continue;
        }
        if ($linha['modo'] === 'valor') {
            $valor = -$linha['valorCents'];
            $base = null;
        } else {
            $alvoExiste = $linha['alvo'] !== 'todos' && isset($porLinha[$linha['alvo']]);
            $base = $alvoExiste ? $porLinha[$linha['alvo']] : $itens;
            $valor = -orc_arredondar($base * $linha['percentagem'] / 100);
        }
        $porLinha[$linha['id']] = $valor;
        $bases[$linha['id']] = $base;
        $descontos += $valor;
    }

    $subtotal = $itens + $descontos;
    $comPortes = $subtotal + $orcamento['portesCents'];
    $taxa = (float)$definicoes['ivaTaxa'];
    $iva = 0;
    $total = $comPortes;
    if ($definicoes['ivaModo'] === 'acrescido') {
        $iva = orc_arredondar($comPortes * $taxa / 100);
        $total = $comPortes + $iva;
    } elseif ($definicoes['ivaModo'] === 'incluido') {
        $iva = $comPortes - orc_arredondar($comPortes / (1 + $taxa / 100));
    }

    return array(
        'porLinha' => $porLinha,
        'basePorDesconto' => $bases,
        'itensCents' => $itens,
        'descontosCents' => $descontos,
        'subtotalCents' => $subtotal,
        'portesCents' => $orcamento['portesCents'],
        'ivaCents' => $iva,
        'totalCents' => $total,
    );
}

function orc_euros($cents)
{
    $negativo = $cents < 0;
    $texto = number_format(abs($cents) / 100, 2, ',', ' ') . ' €';
    return $negativo ? '– ' . $texto : $texto;
}

function orc_quantidade($valor)
{
    $valor = (float)$valor;
    return floor($valor) == $valor ? number_format($valor, 0, ',', ' ') : rtrim(rtrim(number_format($valor, 2, ',', ' '), '0'), ',');
}

function orc_data_pt($ymd)
{
    $partes = explode('-', (string)$ymd);
    return count($partes) === 3 ? $partes[2] . '/' . $partes[1] . '/' . $partes[0] : (string)$ymd;
}

function orc_validade($orcamento)
{
    return date('Y-m-d', strtotime($orcamento['data'] . ' +' . (int)$orcamento['validadeDias'] . ' days'));
}

// ── Base de dados ────────────────────────────────────────────────────────────

function orc_ler_definicoes()
{
    $linha = mp_db()->query('SELECT data_json FROM quote_settings WHERE id = 1')->fetch();
    return orc_normalizar_definicoes($linha ? json_decode((string)$linha['data_json'], true) : array());
}

function orc_gravar_definicoes($definicoes)
{
    $stmt = mp_db()->prepare('INSERT INTO quote_settings (id, data_json, updated_at) VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at');
    $stmt->execute(array(json_encode($definicoes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), mp_db_now()));
}

function orc_lista()
{
    $linhas = mp_db()->query('SELECT id, number, status, client_name, title, total_cents, data_json, updated_at
        FROM quotes ORDER BY year DESC, seq DESC')->fetchAll();
    $lista = array();
    foreach ($linhas as $linha) {
        $dados = json_decode((string)$linha['data_json'], true);
        $lista[] = array(
            'id' => (int)$linha['id'],
            'numero' => (string)$linha['number'],
            'estado' => (string)$linha['status'],
            'cliente' => (string)$linha['client_name'],
            'titulo' => (string)$linha['title'],
            'totalCents' => (int)$linha['total_cents'],
            'data' => is_array($dados) && isset($dados['data']) ? (string)$dados['data'] : '',
        );
    }
    return $lista;
}

function orc_obter($id)
{
    $stmt = mp_db()->prepare('SELECT id, number, data_json FROM quotes WHERE id = ?');
    $stmt->execute(array((int)$id));
    $linha = $stmt->fetch();
    if (!$linha) {
        return null;
    }
    $orcamento = orc_normalizar(json_decode((string)$linha['data_json'], true), orc_ler_definicoes());
    $orcamento['id'] = (int)$linha['id'];
    $orcamento['numero'] = (string)$linha['number'];
    return $orcamento;
}

/**
 * Grava um orçamento. Sem id cria um novo e dá-lhe o número seguinte do ano da
 * sua data (2026-001, 2026-002…). O número nunca muda depois de atribuído:
 * pode já estar num PDF enviado ao cliente.
 */
function orc_gravar($id, $orcamento, $definicoes)
{
    $pdo = mp_db();
    $id = (int)$id;
    $totais = orc_totais($orcamento, $definicoes);
    $nome = $orcamento['cliente']['nome'] !== '' ? $orcamento['cliente']['nome'] : $orcamento['cliente']['empresa'];
    $json = json_encode($orcamento, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $agora = mp_db_now();

    if ($id > 0) {
        $stmt = $pdo->prepare('UPDATE quotes SET status = ?, client_name = ?, title = ?, total_cents = ?, data_json = ?, updated_at = ? WHERE id = ?');
        $stmt->execute(array($orcamento['estado'], $nome, $orcamento['titulo'], $totais['totalCents'], $json, $agora, $id));
        return $stmt->rowCount() > 0 ? $id : 0;
    }

    $ano = (int)substr($orcamento['data'], 0, 4);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT MAX(
                COALESCE((SELECT last_seq FROM quote_counters WHERE year = ?), 0),
                COALESCE((SELECT MAX(seq) FROM quotes WHERE year = ?), 0)
            ) + 1');
        $stmt->execute(array($ano, $ano));
        $seq = (int)$stmt->fetchColumn();
        $pdo->prepare('INSERT INTO quote_counters (year, last_seq) VALUES (?, ?)
            ON CONFLICT(year) DO UPDATE SET last_seq = excluded.last_seq')->execute(array($ano, $seq));
        $stmt = $pdo->prepare('INSERT INTO quotes (number, year, seq, status, client_name, title, total_cents, data_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute(array(sprintf('%d-%03d', $ano, $seq), $ano, $seq, $orcamento['estado'], $nome,
            $orcamento['titulo'], $totais['totalCents'], $json, $agora, $agora));
        $novo = (int)$pdo->lastInsertId();
        $pdo->commit();
        return $novo;
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function orc_apagar($id)
{
    $stmt = mp_db()->prepare('DELETE FROM quotes WHERE id = ?');
    $stmt->execute(array((int)$id));
    return $stmt->rowCount() > 0;
}
