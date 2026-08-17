<?php
/**
 * Testes da persistência JSON das definições globais do Míu.
 * Execução: php site/tools/test-miu-settings-json.php
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Só pode correr na linha de comandos.\n");
}

$falhas = array();

function teste($condicao, $mensagem)
{
    global $falhas;
    if ($condicao) {
        echo "OK   $mensagem\n";
    } else {
        $falhas[] = $mensagem;
        echo "FALHA $mensagem\n";
    }
}

function teste_excepcao($callback, $classe, $mensagem)
{
    $apanhada = null;
    try {
        $callback();
    } catch (Exception $e) {
        $apanhada = $e;
    }
    teste($apanhada instanceof $classe, $mensagem);
    return $apanhada;
}

function escrever_fixture($ficheiro, $data)
{
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($ficheiro, $json . PHP_EOL) === false) {
        throw new RuntimeException('Não foi possível escrever o fixture de teste.');
    }
}

function fixture_valido()
{
    return array(
        'schemaVersion' => 1,
        'enabled' => true,
        'name' => 'Míu Teste',
        'greeting' => 'Olá teste!',
        'launcherPrompt' => 'Fala aqui!',
        'provider' => 'gemini',
        'fallbackEnabled' => false,
        'openrouterModel' => 'openrouter/free',
        'geminiModel' => 'gemini-2.5-flash-lite',
        'maxMessageChars' => 812,
        'maxConversationTurns' => 18,
        'ratePerMinute' => 7,
        'ratePerHour' => 45,
        'maxOutputTokens' => 250,
        'systemPrompt' => 'Prompt de teste',
        'knowledgeBase' => 'Base de teste',
    );
}

$tempDir = sys_get_temp_dir() . '/miu_test_' . bin2hex(random_bytes(6));
if (!mkdir($tempDir, 0700, true)) {
    exit("Não foi possível criar pasta temporária para testes.\n");
}

$tempJsonFile = $tempDir . '/miu-defaults.json';
define('MIU_DEFAULTS_FILE', $tempJsonFile);

require_once dirname(__DIR__) . '/lib/miu-bot.php';

try {
    // A — leitura e mapeamento para o formato interno
    $fixture = fixture_valido();
    escrever_fixture($tempJsonFile, $fixture);
    $loaded = miu_settings();
    teste($loaded['enabled'] === '1', 'A: enabled mapeado para "1"');
    teste($loaded['name'] === 'Míu Teste', 'A: name correcto');
    teste($loaded['launcher_prompt'] === 'Fala aqui!', 'A: launcher_prompt correcto');
    teste($loaded['fallback_enabled'] === '0', 'A: fallback_enabled mapeado para "0"');
    teste($loaded['max_message_chars'] === '812', 'A: max_message_chars mapeado para string "812"');
    teste($loaded['system_prompt'] === 'Prompt de teste', 'A: system_prompt correcto');

    // B — tipos corretos na escrita
    miu_save_settings(array(
        'enabled' => '0',
        'fallback_enabled' => '1',
        'max_message_chars' => '950',
        'max_output_tokens' => '300',
    ));
    $rawB = json_decode(file_get_contents($tempJsonFile), true);
    teste($rawB['enabled'] === false, 'B: enabled gravado como boolean false');
    teste($rawB['fallbackEnabled'] === true, 'B: fallbackEnabled gravado como boolean true');
    teste(is_int($rawB['maxMessageChars']) && $rawB['maxMessageChars'] === 950, 'B: maxMessageChars gravado como integer 950');
    teste(is_int($rawB['maxOutputTokens']) && $rawB['maxOutputTokens'] === 300, 'B: maxOutputTokens gravado como integer 300');

    // C — propriedades futuras e schemaVersion são preservados
    $rawC = json_decode(file_get_contents($tempJsonFile), true);
    $rawC['futureOption'] = array('meta' => 123, 'descricao' => 'custom');
    $rawC['experimentalFeature'] = true;
    escrever_fixture($tempJsonFile, $rawC);
    miu_save_settings(array('name' => 'Míu Futurista'));
    $afterC = json_decode(file_get_contents($tempJsonFile), true);
    teste(isset($afterC['futureOption']) && $afterC['futureOption']['meta'] === 123, 'C: futureOption preservada');
    teste(isset($afterC['experimentalFeature']) && $afterC['experimentalFeature'] === true, 'C: experimentalFeature preservada');
    teste(isset($afterC['schemaVersion']) && $afterC['schemaVersion'] === 1, 'C: schemaVersion preservada');

    // D — Unicode, JSON válido e newline final
    miu_save_settings(array('system_prompt' => 'Míu & Paper — personalização, atenção e informação.'));
    $rawTextD = file_get_contents($tempJsonFile);
    teste(strpos($rawTextD, 'Míu & Paper — personalização, atenção e informação.') !== false, 'D: Unicode gravado em UTF-8 legível');
    $decodeD = json_decode($rawTextD, true);
    teste(is_array($decodeD) && json_last_error() === JSON_ERROR_NONE, 'D: JSON final válido');
    teste(substr($rawTextD, -1) === "\n", 'D: ficheiro termina com newline');

    // E — leitura estrita: JSON sintaticamente inválido
    $beforeE = '{ invalid json';
    file_put_contents($tempJsonFile, $beforeE);
    teste_excepcao(function () {
        miu_settings();
    }, 'RuntimeException', 'E: leitura recusa JSON sintaticamente inválido');
    teste_excepcao(function () {
        miu_save_settings(array('greeting' => 'Não deve gravar'));
    }, 'RuntimeException', 'E: gravação recusa JSON original inválido');
    teste(file_get_contents($tempJsonFile) === $beforeE, 'E: JSON inválido original não é substituído silenciosamente');

    // F — leitura estrita: definição obrigatória em falta
    $fixtureF = fixture_valido();
    unset($fixtureF['systemPrompt']);
    escrever_fixture($tempJsonFile, $fixtureF);
    teste_excepcao(function () {
        miu_settings();
    }, 'RuntimeException', 'F: leitura recusa documento com systemPrompt em falta');

    // G — leitura estrita: tipos errados não são convertidos silenciosamente
    $fixtureG = fixture_valido();
    $fixtureG['enabled'] = 'false';
    escrever_fixture($tempJsonFile, $fixtureG);
    teste_excepcao(function () {
        miu_settings();
    }, 'RuntimeException', 'G: string "false" não é aceite como boolean');

    $fixtureG = fixture_valido();
    $fixtureG['maxMessageChars'] = 'abc';
    escrever_fixture($tempJsonFile, $fixtureG);
    teste_excepcao(function () {
        miu_settings();
    }, 'RuntimeException', 'G: texto não é aceite como integer');

    // H — schemaVersion tem de existir e ser inteiro positivo
    $fixtureH = fixture_valido();
    unset($fixtureH['schemaVersion']);
    escrever_fixture($tempJsonFile, $fixtureH);
    teste_excepcao(function () {
        miu_settings();
    }, 'RuntimeException', 'H: schemaVersion ausente é recusada');

    $fixtureH = fixture_valido();
    $fixtureH['schemaVersion'] = '1';
    escrever_fixture($tempJsonFile, $fixtureH);
    teste_excepcao(function () {
        miu_settings();
    }, 'RuntimeException', 'H: schemaVersion string é recusada');

    // I — miu_save_settings não cria configuração parcial quando o alvo não existe
    escrever_fixture($tempJsonFile, fixture_valido());
    $missingPath = $tempJsonFile . '.away';
    rename($tempJsonFile, $missingPath);
    teste_excepcao(function () {
        miu_save_settings(array('greeting' => 'Não deve nascer do zero'));
    }, 'RuntimeException', 'I: gravação recusa ficheiro de configuração ausente');
    teste(!is_file($tempJsonFile), 'I: ficheiro ausente não é recriado parcialmente');
    rename($missingPath, $tempJsonFile);

    // J — valores internos inválidos são recusados antes da escrita
    $beforeJ = file_get_contents($tempJsonFile);
    teste_excepcao(function () {
        miu_save_settings(array('max_message_chars' => 'abc'));
    }, 'InvalidArgumentException', 'J: integer interno inválido é recusado');
    teste_excepcao(function () {
        miu_save_settings(array('enabled' => 'false'));
    }, 'InvalidArgumentException', 'J: boolean interno ambíguo é recusado');
    teste(file_get_contents($tempJsonFile) === $beforeJ, 'J: ficheiro original permanece intacto após valores inválidos');

    // K — escrita normal usa substituição completa e não deixa temporários
    miu_save_settings(array('greeting' => 'Saudação Nova Imediata'));
    $readK = miu_settings();
    teste($readK['greeting'] === 'Saudação Nova Imediata', 'K: leitura imediata reflecte a gravação sem cache obsoleto');
    teste(count(glob($tempJsonFile . '.tmp.*')) === 0, 'K: não ficam ficheiros .tmp após sucesso');
    teste(count(glob($tempJsonFile . '.swap.*')) === 0, 'K: não ficam backups .swap após sucesso normal');

    // L — produção não contém qualquer dependência activa de bot_settings
    $miuBotSource = file_get_contents(dirname(__DIR__) . '/lib/miu-bot.php');
    teste(strpos($miuBotSource, 'bot_settings') === false, 'L: miu-bot.php não contém referências a bot_settings');

    // M — base nova não cria bot_settings, quando PDO SQLite está disponível
    if (class_exists('PDO') && in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        $dbNewPath = $tempDir . '/new.sqlite';
        $pdoNew = new PDO('sqlite:' . $dbNewPath);
        $pdoNew->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdoNew->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        miu_db_migrate($pdoNew);
        $tables = $pdoNew->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
        teste(in_array('bot_conversations', $tables, true), 'M: bot_conversations criada em base nova');
        teste(in_array('bot_messages', $tables, true), 'M: bot_messages criada em base nova');
        teste(in_array('bot_step_contexts', $tables, true), 'M: bot_step_contexts criada em base nova');
        teste(!in_array('bot_settings', $tables, true), 'M: bot_settings NÃO é criada em base nova');
        $pdoNew = null;
    } else {
        echo "SKIP M: PDO SQLite não está disponível neste ambiente.\n";
    }
} finally {
    if (is_dir($tempDir)) {
        foreach (glob($tempDir . '/*') as $f) {
            if (is_file($f)) {
                @unlink($f);
            }
        }
        @rmdir($tempDir);
    }
}

echo "\n-------------------------------------------------------------\n";
if (empty($falhas)) {
    echo "TODOS OS TESTES DISPONÍVEIS PASSARAM COM SUCESSO!\n";
    exit(0);
}

echo "FALHARAM " . count($falhas) . " TESTE(S):\n";
foreach ($falhas as $f) {
    echo " - $f\n";
}
exit(1);
