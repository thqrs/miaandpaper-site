<?php
/**
 * Editor de agendas — API local, sem dependências.
 *
 * Guarda tudo em dados/<projecto>/:
 *   projecto.json          o projecto actual
 *   versoes/<data>.json    cópias antigas (no máximo uma a cada 10 minutos)
 *   fontes/<hash>.<ext>    fontes importadas
 *   imagens/<hash>.<ext>   imagens importadas, no original
 *
 * Os pedidos de escrita exigem o cabeçalho X-Agendas: 1. Um formulário de
 * outro site não o consegue enviar sem pedido CORS, o que serve de CSRF para
 * uma ferramenta de rede local.
 */
declare(strict_types=1);

const DADOS = __DIR__ . '/dados';
const INTERVALO_VERSOES = 600;
const MAX_VERSOES = 300;
const MAX_FICHEIRO = 40 * 1024 * 1024;
const EXTENSOES = [
    'fonte' => ['ttf', 'otf', 'woff', 'woff2'],
    'imagem' => ['png', 'jpg', 'jpeg', 'webp', 'svg'],
];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function responder(array $dados, int $codigo = 200): never
{
    http_response_code($codigo);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function idValido(mixed $id): string
{
    if (!is_string($id) || !preg_match('/^[a-z0-9][a-z0-9-]{0,59}$/', $id)) {
        responder(['erro' => 'Identificador inválido.'], 400);
    }
    return $id;
}

function pasta(string $id, string $sub = ''): string
{
    $p = DADOS . '/' . $id . ($sub !== '' ? '/' . $sub : '');
    if (!is_dir($p) && !mkdir($p, 0775, true) && !is_dir($p)) {
        responder(['erro' => 'Não foi possível criar a pasta.'], 500);
    }
    return $p;
}

function escreverAtomico(string $ficheiro, string $conteudo): void
{
    $tmp = $ficheiro . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (file_put_contents($tmp, $conteudo, LOCK_EX) === false || !rename($tmp, $ficheiro)) {
        @unlink($tmp);
        responder(['erro' => 'Não foi possível gravar.'], 500);
    }
}

function guardarVersao(string $id, string $actual): void
{
    $dir = pasta($id, 'versoes');
    $versoes = glob($dir . '/*.json') ?: [];
    sort($versoes);
    $ultima = end($versoes);
    if ($ultima !== false && time() - filemtime($ultima) < INTERVALO_VERSOES) {
        return;
    }
    copy($actual, $dir . '/' . date('Ymd-His') . '.json');
    $versoes = glob($dir . '/*.json') ?: [];
    sort($versoes);
    foreach (array_slice($versoes, 0, max(0, count($versoes) - MAX_VERSOES)) as $velha) {
        @unlink($velha);
    }
}

$accao = $_GET['accao'] ?? '';
$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($metodo === 'POST' && ($_SERVER['HTTP_X_AGENDAS'] ?? '') !== '1') {
    responder(['erro' => 'Pedido recusado.'], 403);
}

switch ($accao) {
    case 'listar':
        $lista = [];
        foreach (glob(DADOS . '/*/projecto.json') ?: [] as $f) {
            $p = json_decode((string) file_get_contents($f), true);
            if (!is_array($p)) {
                continue;
            }
            $lista[] = ['id' => basename(dirname($f)), 'nome' => (string) ($p['nome'] ?? ''), 'alterado' => filemtime($f)];
        }
        usort($lista, fn($a, $b) => $b['alterado'] <=> $a['alterado']);
        responder(['projectos' => $lista]);

    case 'abrir':
        $id = idValido($_GET['id'] ?? '');
        $f = DADOS . "/$id/projecto.json";
        if (!is_file($f)) {
            responder(['erro' => 'Projecto não encontrado.'], 404);
        }
        // Sem "true": os objectos vazios ({}) continuam objectos e não viram listas.
        responder(['projecto' => json_decode((string) file_get_contents($f))]);

    case 'gravar':
        if ($metodo !== 'POST') {
            responder(['erro' => 'Use POST.'], 405);
        }
        $corpo = json_decode((string) file_get_contents('php://input'));
        $id = idValido($corpo->id ?? '');
        $projecto = $corpo->projecto ?? null;
        if (!is_object($projecto) || ($projecto->id ?? '') !== $id || !isset($projecto->moldes, $projecto->sequencia, $projecto->edicoes)) {
            responder(['erro' => 'Projecto inválido.'], 400);
        }
        $f = pasta($id) . '/projecto.json';
        if (is_file($f)) {
            guardarVersao($id, $f);
        }
        escreverAtomico($f, json_encode($projecto, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        responder(['ok' => true, 'gravado' => time()]);

    case 'versoes':
        $id = idValido($_GET['id'] ?? '');
        $versoes = array_map('basename', glob(DADOS . "/$id/versoes/*.json") ?: []);
        rsort($versoes);
        responder(['versoes' => array_map(fn($v) => substr($v, 0, -5), $versoes)]);

    case 'abrir-versao':
        $id = idValido($_GET['id'] ?? '');
        $v = (string) ($_GET['versao'] ?? '');
        if (!preg_match('/^\d{8}-\d{6}$/', $v) || !is_file(DADOS . "/$id/versoes/$v.json")) {
            responder(['erro' => 'Versão não encontrada.'], 404);
        }
        responder(['projecto' => json_decode((string) file_get_contents(DADOS . "/$id/versoes/$v.json"))]);

    case 'carregar':
        if ($metodo !== 'POST') {
            responder(['erro' => 'Use POST.'], 405);
        }
        $id = idValido($_POST['id'] ?? '');
        $tipo = (string) ($_POST['tipo'] ?? '');
        $ficheiro = $_FILES['ficheiro'] ?? null;
        if (!isset(EXTENSOES[$tipo]) || !is_array($ficheiro) || ($ficheiro['error'] ?? 1) !== UPLOAD_ERR_OK) {
            responder(['erro' => 'Ficheiro em falta.'], 400);
        }
        if ($ficheiro['size'] > MAX_FICHEIRO) {
            responder(['erro' => 'Ficheiro demasiado grande.'], 413);
        }
        $ext = strtolower(pathinfo((string) $ficheiro['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, EXTENSOES[$tipo], true)) {
            responder(['erro' => 'Tipo de ficheiro não aceite.'], 415);
        }
        $nome = substr(sha1_file($ficheiro['tmp_name']), 0, 16) . '.' . ($ext === 'jpeg' ? 'jpg' : $ext);
        $sub = $tipo === 'fonte' ? 'fontes' : 'imagens';
        $destino = pasta($id, $sub) . '/' . $nome;
        if (!is_file($destino) && !move_uploaded_file($ficheiro['tmp_name'], $destino)) {
            responder(['erro' => 'Não foi possível guardar o ficheiro.'], 500);
        }
        responder([
            'ficheiro' => "dados/$id/$sub/$nome",
            'original' => (string) $ficheiro['name'],
            'tamanho' => (int) $ficheiro['size'],
        ]);

    default:
        responder(['erro' => 'Acção desconhecida.'], 404);
}
