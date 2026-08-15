<?php
/** Smoke/integration tests for comando.php. Run: php site/tools/test-comandos.php */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Só pode correr na linha de comandos.\n");
}

chdir(dirname(__DIR__));
if (session_status() === PHP_SESSION_NONE) session_start();
$_SESSION['miaandpaper_admin'] = true;

require_once __DIR__ . '/../lib/comandos.php';

$falhas = array();
$backupCarrossel = __DIR__ . '/../content/home.json.carrousel-bak';
$backupCarrosselExistia = is_file($backupCarrossel);
$backupCarrosselBytes = $backupCarrosselExistia ? (string)file_get_contents($backupCarrossel) : '';
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

function analisar_teste($args)
{
    return cmd_analisar($args);
}

// 1. Parsing e manifesto.
$lidos = cmd_ler_pedido(array('c' => array(
    '1' => array('op' => 'custo-hora', 'euros' => '0'),
    '0' => array('op' => 'material', 'nome' => 'Teste', 'euros' => '1'),
)));
teste(count($lidos) === 2 && $lidos[0]['op'] === 'material' && $lidos[1]['op'] === 'custo-hora', 'parser ordena batches por índice');
$manifesto = cmd_manifesto();
$nomes = array_map(function ($op) { return $op['nome']; }, $manifesto['operacoes']);
$porNome = array();
foreach ($manifesto['operacoes'] as $operacaoManifesto) $porNome[$operacaoManifesto['nome']] = $operacaoManifesto;
$slideManifesto = isset($porNome['carrossel-slide']) ? $porNome['carrossel-slide']['esquemaEntrada'] : array();
$cartaoManifesto = isset($porNome['carrossel-cartao']) ? $porNome['carrossel-cartao']['esquemaEntrada'] : array();
$caminhoSlide = isset($slideManifesto['properties']->caminho) ? $slideManifesto['properties']->caminho : array();
teste(count($nomes) === 39 && isset($porNome['ordem-tabs']) && isset($manifesto['execucao']['batch']['transaccional']) && in_array('carrossel-slide', $nomes, true)
    && !in_array('caminho', $slideManifesto['required'], true)
    && isset($caminhoSlide['x-requiredWhen']) && !empty($cartaoManifesto['x-peloMenosUm'])
    && strpos($porNome['preco']['exemplo'], 'chave=3%20mm') !== false, 'manifesto deriva operações, URL encoding e regras condicionais do registry');

// 2. Erros que nunca podem aplicar.
$falta = analisar_teste(array(array('op' => 'material', 'nome' => 'Sem preço')));
teste(!$falta['ok'] && !empty($falta['erros']), 'recusa parâmetro obrigatório em falta');
$invalido = analisar_teste(array(array('op' => 'custo-hora', 'euros' => 'doze')));
teste(!$invalido['ok'] && !empty($invalido['erros']), 'recusa número inválido');
$desconhecido = analisar_teste(array(array('op' => 'não-existe')));
teste(!$desconhecido['ok'] && !empty($desconhecido['erros']), 'recusa operação desconhecida');
$inesperado = analisar_teste(array(array('op' => 'custo-hora', 'euros' => '0', 'intruso' => '1')));
teste(!$inesperado['ok'] && !empty($inesperado['erros']), 'recusa parâmetro inesperado');

// Um erro depois de se iniciar o preview nunca pode deixar mudanças parciais
// na resposta que um LLM poderia interpretar como uma proposta válida.
$invalidosSemPreview = array(
    array('op' => 'review', 'nome' => 'Teste', 'texto' => 'x', 'estrelas' => '6'),
    array('op' => 'custo-hora', 'euros' => '-1'),
    array('op' => 'custo-hora', 'euros' => '1e309'),
);
$semPreviewParcial = true;
foreach ($invalidosSemPreview as $comandoInvalido) {
    $resultadoInvalido = analisar_teste(array($comandoInvalido));
    $linhaInvalida = isset($resultadoInvalido['comandos'][0]) ? $resultadoInvalido['comandos'][0] : array();
    $semPreviewParcial = $semPreviewParcial && !$resultadoInvalido['ok']
        && !empty($resultadoInvalido['erros']) && empty($linhaInvalida['mudancas']);
}
teste($semPreviewParcial, 'comandos inválidos não devolvem mudanças parciais');

$nomeInvalidoBatch = '__cmd-invalido-' . substr(sha1(uniqid('', true)), 0, 8);
cmd_api('materiais');
$pathMateriaisTeste = mat_path();
$materiaisAntesInvalido = $pathMateriaisTeste !== '' && is_file($pathMateriaisTeste)
    ? (string)file_get_contents($pathMateriaisTeste) : null;
$batchComInvalido = analisar_teste(array(
    array('op' => 'material', 'nome' => $nomeInvalidoBatch, 'euros' => '1.00'),
    array('op' => 'review', 'nome' => 'Teste', 'texto' => 'x', 'estrelas' => '6'),
));
$relatorioInvalido = $batchComInvalido['ok'] ? cmd_aplicar($batchComInvalido['nativas']) : array();
$materiaisDepoisInvalido = $pathMateriaisTeste !== '' && is_file($pathMateriaisTeste)
    ? (string)file_get_contents($pathMateriaisTeste) : null;
$linhaInvalidaBatch = isset($batchComInvalido['comandos'][1]) ? $batchComInvalido['comandos'][1] : array();
teste(!$batchComInvalido['ok'] && empty($linhaInvalidaBatch['mudancas']) && empty($relatorioInvalido)
    && $materiaisAntesInvalido === $materiaisDepoisInvalido,
    'batch com linha inválida não mostra preview parcial nem escreve');

// Regressão numérica: o preview não pode aceitar valores que a API truncaria,
// converteria para zero ou limitaria silenciosamente ao gravar.
$numerosInvalidos = array('-1', '1e309', '-1e309', 'INF', '-INF', 'NAN', '', '   ');
$todosInvalidos = true;
foreach ($numerosInvalidos as $valor) {
    $r = analisar_teste(array(array('op' => 'custo-hora', 'euros' => $valor)));
    $todosInvalidos = $todosInvalidos && !$r['ok'];
}
teste($todosInvalidos, 'recusa negativos, expoentes, INF, NAN e valores vazios em dinheiro');
$decimalVirgula = analisar_teste(array(array('op' => 'custo-hora', 'euros' => '12,50')));
$maximoDinheiro = analisar_teste(array(array('op' => 'custo-hora', 'euros' => '1000000')));
$zeroDinheiro = analisar_teste(array(array('op' => 'custo-hora', 'euros' => '0')));
teste($decimalVirgula['ok'] && $maximoDinheiro['ok'] && $zeroDinheiro['ok'], 'aceita vírgula decimal, zero e máximo monetário finito');

$limitesInvalidos = array(
    array('op' => 'preco', 'produto' => 'imanes-loja', 'chave' => '3 mm', 'qtd' => '1e309', 'euros' => '1'),
    array('op' => 'pack-adicionar', 'produto' => 'imanes-recortados', 'chave' => 'Recortados', 'qtd' => '-1', 'euros' => '1'),
    array('op' => 'material', 'nome' => 'Teste limite', 'euros' => '1', 'quantidade' => '-1'),
    array('op' => 'material', 'nome' => 'Teste limite', 'euros' => '1', 'quantidade' => '1e309'),
    array('op' => 'produto-minutos', 'produto' => 'imanes-loja', 'minutos' => '-1'),
    array('op' => 'desconto', 'produto' => 'imanes-loja', 'chave' => '3 mm', 'qtd' => '3', 'percent' => '-0.1'),
    array('op' => 'desconto', 'produto' => 'imanes-loja', 'chave' => '3 mm', 'qtd' => '3', 'percent' => '100'),
    array('op' => 'review', 'nome' => 'Teste', 'texto' => 'x', 'estrelas' => '0'),
    array('op' => 'review', 'nome' => 'Teste', 'texto' => 'x', 'estrelas' => '6'),
    array('op' => 'homepage-campo', 'indice' => '0', 'campo' => 'menuOrder', 'valor' => '-1'),
    array('op' => 'homepage-campo', 'indice' => '0', 'campo' => 'menuOrder', 'valor' => '1e309'),
    array('op' => 'seccao-campo', 'seccao' => 'novidades', 'campo' => 'maxCards', 'valor' => '13'),
    array('op' => 'carrossel-global', 'campo' => 'speedSeconds', 'valor' => '2'),
    array('op' => 'carrossel-global', 'campo' => 'speedSeconds', 'valor' => '1e309'),
    array('op' => 'carrossel-slide', 'cartao' => 'cadernos-geral', 'accao' => 'alterar', 'indice' => '-1', 'visivel' => '1'),
);
$limitesRecusados = true;
foreach ($limitesInvalidos as $comandoInvalido) {
    $r = analisar_teste(array($comandoInvalido));
    $limitesRecusados = $limitesRecusados && !$r['ok'];
}
$rendimentoInfinito = analisar_teste(array(
    array('op' => 'material', 'nome' => '__cmd-rendimento-limite', 'euros' => '1'),
    array('op' => 'produto-material', 'produto' => 'imanes-loja', 'material' => '__cmd-rendimento-limite', 'rendimento' => '1e309'),
));
$limitesRecusados = $limitesRecusados && !$rendimentoInfinito['ok'];
$estrelasValidas = analisar_teste(array(array('op' => 'review', 'nome' => 'Teste', 'texto' => 'x', 'estrelas' => '1')));
$estrelasCinco = analisar_teste(array(array('op' => 'review', 'nome' => 'Teste', 'texto' => 'x', 'estrelas' => '5')));
cmd_reiniciar_estado();
$reviewsParaOrdem = cmd_estado('reviews');
$reviewOrdemId = isset($reviewsParaOrdem['reviews'][0]['id']) ? $reviewsParaOrdem['reviews'][0]['id'] : '';
$reviewOrdem = analisar_teste(array(array('op' => 'review-campo', 'id' => $reviewOrdemId, 'campo' => 'order', 'valor' => '1')));
$estadoOrdemEsperado = $reviewsParaOrdem;
if ($reviewOrdemId !== '') {
    foreach ($estadoOrdemEsperado['reviews'] as $i => $review) {
        if ($review['id'] === $reviewOrdemId) $estadoOrdemEsperado['reviews'][$i]['order'] = 1;
    }
}
$estadoOrdemEsperado = reviews_normalize($estadoOrdemEsperado);
$ordemEsperada = null;
foreach ($estadoOrdemEsperado['reviews'] as $review) if ($review['id'] === $reviewOrdemId) $ordemEsperada = $review['order'];
$ordemPrevista = isset($reviewOrdem['comandos'][0]['mudancas'][0]['depois']) ? $reviewOrdem['comandos'][0]['mudancas'][0]['depois'] : null;
$maximosValidos = array(
    analisar_teste(array(array('op' => 'material', 'nome' => 'Teste máximo', 'euros' => '1', 'quantidade' => '10000000'))),
    analisar_teste(array(array('op' => 'produto-minutos', 'produto' => 'imanes-loja', 'minutos' => '10000'))),
    analisar_teste(array(array('op' => 'desconto', 'produto' => 'imanes-loja', 'chave' => '3 mm', 'qtd' => '3', 'percent' => '99'))),
    analisar_teste(array(array('op' => 'carrossel-global', 'campo' => 'speedSeconds', 'valor' => '30'))),
);
$maximosAceites = true;
foreach ($maximosValidos as $maximo) $maximosAceites = $maximosAceites && $maximo['ok'];
teste($limitesRecusados && $estrelasValidas['ok'] && $estrelasCinco['ok'] && $maximosAceites
    && $reviewOrdem['ok'] && (string)$ordemPrevista === (string)$ordemEsperada,
    'aplica limites e normalizações de quantidades, minutos, percentagens, reviews, homepage e carrossel');

// 3. Preview válido de cada adaptador do registry. Estes casos não gravam;
// usam valores reais, ou ids únicos quando a própria operação é uma criação.
$previews = array(
    array('op' => 'preco', 'produto' => 'imanes-loja', 'chave' => '3 mm', 'qtd' => '30', 'euros' => '60'),
    array('op' => 'preco', 'produto' => 'congresso-2026-crachas', 'chave' => '25 mm', 'qtd' => '24', 'euros' => '27'),
    array('op' => 'ordem-tabs', 'ordem' => 'imanes-loja,agendas,congresso-2026-imanes'),
    array('op' => 'pack-adicionar', 'produto' => 'imanes-recortados', 'chave' => 'Recortados', 'qtd' => '8', 'euros' => '18'),
    array('op' => 'pack-remover', 'produto' => 'imanes-recortados', 'chave' => 'Recortados', 'qtd' => '12'),
    array('op' => 'desconto', 'produto' => 'imanes-loja', 'chave' => '3 mm', 'qtd' => '3', 'percent' => '6'),
    array('op' => 'desconto-activo', 'produto' => 'imanes-loja', 'chave' => '3 mm', 'escada' => 'D2'),
    array('op' => 'custo', 'produto' => 'imanes-loja', 'chave' => '3 mm', 'euros' => '0.42'),
    array('op' => 'valor', 'ficheiro' => 'pricing', 'trail' => 'products.imanes-loja.prices.3 mm.30', 'euros' => '60'),
    array('op' => 'pack-renomear', 'produto' => 'imanes-recortados', 'chave' => 'Recortados', 'de' => '12', 'para' => '10'),
    array('op' => 'texto', 'produto' => 'imanes-loja', 'trail' => 'steps.1.items.0.title', 'texto' => 'Íman redondo'),
    array('op' => 'linha-adicionar', 'produto' => 'agendas', 'trail' => 'steps.4.items'),
    array('op' => 'linha-remover', 'produto' => 'agendas', 'trail' => 'steps.4.items.3'),
    array('op' => 'modo', 'produto' => 'imanes-loja', 'modo' => 'tier-unit'),
    array('op' => 'variante', 'produto' => 'agendas', 'variante' => 'agenda_normal', 'euros' => '29.90'),
    array('op' => 'custo-hora', 'euros' => '0'),
    array('op' => 'imagem', 'entrada' => 'imanes-loja', 'trail' => 'steps.0.items.0.image', 'caminho' => 'content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/esperanca/esperanca-01.webp'),
    array('op' => 'imagem-concluida', 'chave' => 'caderninhos|caderninho-01|image', 'concluida' => '1'),
    array('op' => 'homepage-campo', 'indice' => '0', 'campo' => 'subtitle', 'valor' => 'Feitos à mão, um a um'),
    array('op' => 'seccao-campo', 'seccao' => 'novidades', 'campo' => 'title', 'valor' => 'Novidades'),
    array('op' => 'seccao-adicionar', 'seccao' => 'cmd-preview-section', 'titulo' => 'Secção de preview'),
    array('op' => 'seccao-remover', 'seccao' => 'novidades'),
    array('op' => 'ordem-homepage', 'ids' => 'personalizacao,cadernos-geral,mini-cadernos-geral,blocos-a6,bloquinhos,quadros,crachas-geral,postais,agendas,imanes-geral,imanes-recortados,stickers,marcadores,marcadores-magneticos,congressos,ofertas'),
    array('op' => 'ordem-menu', 'cartao' => 'agendas', 'grupo' => 'Cadernos e papelaria', 'antes' => 'cadernos-geral'),
    array('op' => 'menu-accordion', 'activo' => '1'),
    array('op' => 'menu-icones', 'activo' => '1'),
    array('op' => 'carrossel-global', 'campo' => 'enabled', 'valor' => '1'),
    array('op' => 'carrossel-repor-globais'),
    array('op' => 'carrossel-cartao', 'cartao' => 'agendas', 'aleatorio' => '0'),
    array('op' => 'carrossel-slide', 'cartao' => 'cadernos-geral', 'accao' => 'alterar', 'indice' => '0', 'visivel' => '0'),
    array('op' => 'review', 'nome' => 'Teste', 'texto' => 'Preview sem gravação', 'estrelas' => '5'),
    array('op' => 'review-campo', 'id' => 'review-wa-01', 'campo' => 'enabled', 'valor' => '1'),
    array('op' => 'reviews-definicoes', 'campo' => 'position', 'valor' => 'right'),
    array('op' => 'review-apagar', 'id' => 'review-wa-01'),
);
$vistos = array();
$previewsOk = true;
$errosCobertura = array();
foreach ($previews as $preview) {
    $resultadoPreview = analisar_teste(array($preview));
    if (!$resultadoPreview['ok']) {
        $previewsOk = false;
        $errosCobertura[] = $preview['op'] . ': ' . implode(' | ', $resultadoPreview['erros']);
    }
    $vistos[$preview['op']] = true;
}
$nomeCobertura = '__cmd-cobertura-' . substr(sha1(uniqid('', true)), 0, 8);
$materiaisPreview = analisar_teste(array(
    array('op' => 'material', 'nome' => $nomeCobertura, 'quantidade' => '10', 'unidade' => 'un', 'euros' => '4.20'),
    array('op' => 'produto-material', 'produto' => 'imanes-loja', 'material' => $nomeCobertura, 'rendimento' => '10'),
    array('op' => 'produto-minutos', 'produto' => 'imanes-loja', 'minutos' => '0.5'),
    array('op' => 'enviar-para-precos', 'produto' => 'imanes-loja', 'chave' => '3 mm'),
    array('op' => 'produto-material-apagar', 'produto' => 'imanes-loja', 'material' => $nomeCobertura),
    array('op' => 'material-apagar', 'nome' => $nomeCobertura),
));
foreach (array('material', 'produto-material', 'produto-minutos', 'enviar-para-precos', 'produto-material-apagar', 'material-apagar') as $op) $vistos[$op] = true;
$faltamCobertura = array_diff(array_keys(cmd_registo()), array_keys($vistos));
if (!$materiaisPreview['ok']) $errosCobertura[] = 'materiais: ' . implode(' | ', $materiaisPreview['erros']);
if ($faltamCobertura) $errosCobertura[] = 'sem caso: ' . implode(', ', $faltamCobertura);
teste($previewsOk && $materiaisPreview['ok'] && empty($faltamCobertura), 'todos os comandos têm um preview válido e sem escrita'
    . ($errosCobertura ? ' — ' . implode(' / ', $errosCobertura) : ''));

// 4. Batch: a segunda linha tem de ver a primeira, sem gravar nada no preview.
$sufixo = substr(sha1(uniqid('', true)), 0, 8);
$nomeA = 'Teste comando A ' . $sufixo;
$nomeB = 'Teste comando B ' . $sufixo;
$batch = analisar_teste(array(
    array('op' => 'material', 'nome' => $nomeA, 'euros' => '1.20'),
    array('op' => 'material', 'nome' => $nomeB, 'euros' => '2.30', 'quantidade' => '2'),
));
$listaFinal = isset($batch['nativas']['materiais'][1]['materiais']) ? $batch['nativas']['materiais'][1]['materiais'] : array();
$encontrouA = false;
$encontrouB = false;
foreach ($listaFinal as $material) {
    if (isset($material['nome']) && $material['nome'] === $nomeA) $encontrouA = true;
    if (isset($material['nome']) && $material['nome'] === $nomeB) $encontrouB = true;
}
teste($batch['ok'] && $encontrouA && $encontrouB, 'batch acumula duas alterações ao mesmo catálogo em preview');

// 5. Apply de valor igual: atravessa a API real sem deixar dado de teste.
cmd_reiniciar_estado();
$estadoAntes = cmd_estado('materiais');
$horaActual = isset($estadoAntes['custoHoraCents']) ? (int)$estadoAntes['custoHoraCents'] : 0;
$noOp = analisar_teste(array(array('op' => 'custo-hora', 'cents' => (string)$horaActual)));
$relatorioNoOp = $noOp['ok'] ? cmd_aplicar($noOp['nativas']) : array();
$okNoOp = !empty($relatorioNoOp);
foreach ($relatorioNoOp as $linha) if (empty($linha['ok'])) $okNoOp = false;
cmd_reiniciar_estado();
$estadoDepois = cmd_estado('materiais');
$previewHora = isset($noOp['comandos'][0]['mudancas'][0]['depois']) ? $noOp['comandos'][0]['mudancas'][0]['depois'] : '';
teste($okNoOp && (int)$estadoDepois['custoHoraCents'] === $horaActual && $previewHora === cmd_euros($estadoDepois['custoHoraCents']), 'preview e apply coincidem no custo por hora');

// A mesma propriedade em dois formatos diferentes: o valor mostrado no preview
// tem de ser precisamente o que a API normalizada deixa no estado final.
$homeAntes = cmd_estado('home');
$intervaloActual = (int)$homeAntes['carousel']['intervalMs'];
$consistenciaCarrossel = analisar_teste(array(array('op' => 'carrossel-global', 'campo' => 'intervalMs', 'valor' => (string)$intervaloActual)));
$relatorioCarrossel = $consistenciaCarrossel['ok'] ? cmd_aplicar($consistenciaCarrossel['nativas']) : array();
$okCarrossel = !empty($relatorioCarrossel);
foreach ($relatorioCarrossel as $linha) if (empty($linha['ok'])) $okCarrossel = false;
cmd_reiniciar_estado();
$homeDepois = cmd_estado('home');
$previewIntervalo = isset($consistenciaCarrossel['comandos'][0]['mudancas'][0]['depois']) ? $consistenciaCarrossel['comandos'][0]['mudancas'][0]['depois'] : null;
teste($okCarrossel && abs((float)$previewIntervalo - (float)$homeDepois['carousel']['intervalMs']) < 0.000001, 'preview e apply coincidem num campo numérico do carrossel');

// ordem-tabs: preview, apply, batch acumulado e rollback. A preferência original
// é restaurada byte a byte, inclusive quando antes nem existia ficheiro.
$prefsPath = precos_prefs_path();
$prefsAntesExiste = $prefsPath !== '' && is_file($prefsPath);
$prefsAntes = $prefsAntesExiste ? (string)file_get_contents($prefsPath) : '';
$ordemTeste = array('imanes-loja', 'agendas', 'congresso-2026-imanes');
$ordemAnalise = analisar_teste(array(array('op' => 'ordem-tabs', 'ordem' => implode(',', $ordemTeste))));
$ordemRelatorio = $ordemAnalise['ok'] ? cmd_aplicar($ordemAnalise['nativas']) : array();
$ordemAplicada = !empty($ordemRelatorio);
foreach ($ordemRelatorio as $linha) if (empty($linha['ok'])) $ordemAplicada = false;
cmd_reiniciar_estado();
$ordemDepois = cmd_estado('precos-tabs');
$previewOrdem = isset($ordemAnalise['comandos'][0]['mudancas'][0]['depois']) ? $ordemAnalise['comandos'][0]['mudancas'][0]['depois'] : '';
$batchTabs = analisar_teste(array(
    array('op' => 'ordem-tabs', 'ordem' => 'agendas,imanes-loja'),
    array('op' => 'ordem-tabs', 'ordem' => implode(',', $ordemTeste)),
));
$tabsAcumuladas = $batchTabs['ok'] && cmd_estado('precos-tabs') === $ordemTeste;
$prefsRepostos = $prefsAntesExiste
    ? cmd_restaurar_bytes($prefsPath, $prefsAntes)
    : (!is_file($prefsPath) || @unlink($prefsPath));
teste($ordemAplicada && $ordemDepois === $ordemTeste && $previewOrdem === implode(', ', $ordemTeste)
    && $tabsAcumuladas && $prefsRepostos, 'ordem-tabs tem preview, apply e estado acumulado em batch sem deixar dados de teste');

$nomeRollbackTabs = '__cmd-tabs-' . $sufixo;
$prefsRollbackAntesExiste = $prefsPath !== '' && is_file($prefsPath);
$prefsRollbackAntes = $prefsRollbackAntesExiste ? (string)file_get_contents($prefsPath) : '';
$rollbackTabs = analisar_teste(array(
    array('op' => 'ordem-tabs', 'ordem' => implode(',', $ordemTeste)),
    array('op' => 'material', 'nome' => $nomeRollbackTabs, 'euros' => '1.00'),
    array('op' => 'enviar-para-precos', 'produto' => '__cmd-tabs-inexistente-' . $sufixo, 'chave' => 'Teste'),
));
$relatorioRollbackTabs = $rollbackTabs['ok'] ? cmd_aplicar($rollbackTabs['nativas']) : array();
$tabsFalhou = false;
foreach ($relatorioRollbackTabs as $linha) if (empty($linha['ok'])) $tabsFalhou = true;
$prefsRollbackDepoisExiste = $prefsPath !== '' && is_file($prefsPath);
$prefsRollbackDepois = $prefsRollbackDepoisExiste ? (string)file_get_contents($prefsPath) : '';
cmd_reiniciar_estado();
$materiaisDepoisTabs = cmd_estado('materiais');
list($indiceRollbackTabs) = cmd_material($materiaisDepoisTabs, $nomeRollbackTabs);
teste($rollbackTabs['ok'] && $tabsFalhou && $indiceRollbackTabs < 0
    && $prefsRollbackAntesExiste === $prefsRollbackDepoisExiste && $prefsRollbackAntes === $prefsRollbackDepois,
    'rollback de batch repõe também a ordem das tabs');

// 6. Galeria: os dois comandos passam pela API real sem deixar uma alteração.
$imagem = analisar_teste(array(array(
    'op' => 'imagem', 'entrada' => 'imanes-loja', 'trail' => 'steps.0.items.0.image',
    'caminho' => 'content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/esperanca/esperanca-01.webp',
)));
$relatorioImagem = $imagem['ok'] ? cmd_aplicar($imagem['nativas']) : array();
$okImagem = !empty($relatorioImagem);
foreach ($relatorioImagem as $linha) if (empty($linha['ok'])) $okImagem = false;
teste($imagem['ok'] && $okImagem, 'imagem existente passa pelo preview e pela API da galeria');

$estadoImagem = analisar_teste(array(array(
    'op' => 'imagem-concluida', 'chave' => 'caderninhos|caderninho-01|image', 'concluida' => '1',
)));
$relatorioEstadoImagem = $estadoImagem['ok'] ? cmd_aplicar($estadoImagem['nativas']) : array();
$okEstadoImagem = !empty($relatorioEstadoImagem);
foreach ($relatorioEstadoImagem as $linha) if (empty($linha['ok'])) $okEstadoImagem = false;
teste($estadoImagem['ok'] && $okEstadoImagem, 'estado de revisão da imagem passa pela API da galeria');

// 7. Rollback: materiais grava primeiro; enviar custo zero falha depois.
$nomeRollback = '__cmd-rollback-' . $sufixo;
$rollback = analisar_teste(array(
    array('op' => 'material', 'nome' => $nomeRollback, 'euros' => '1.00'),
    array('op' => 'enviar-para-precos', 'produto' => '__cmd-inexistente-' . $sufixo, 'chave' => 'Teste'),
));
$relatorioRollback = $rollback['ok'] ? cmd_aplicar($rollback['nativas']) : array();
$teveFalha = false;
foreach ($relatorioRollback as $linha) if (empty($linha['ok'])) $teveFalha = true;
cmd_reiniciar_estado();
$materiaisFinais = cmd_estado('materiais');
list($indiceRollback) = cmd_material($materiaisFinais, $nomeRollback);
teste($rollback['ok'] && $teveFalha && $indiceRollback < 0, 'falha tardia de batch repõe o estado anterior');

// O editor de carrosséis cria esta cópia de segurança. O teste nunca a pode
// deixar no projecto nem substituir uma cópia que já existisse antes da suite.
if ($backupCarrosselExistia) {
    $backupCarrosselReposto = cmd_restaurar_bytes($backupCarrossel, $backupCarrosselBytes);
} else {
    $backupCarrosselReposto = !is_file($backupCarrossel) || @unlink($backupCarrossel);
}
teste($backupCarrosselReposto, 'suite não deixa cópias de segurança de teste');

if ($falhas) {
    fwrite(STDERR, "\n" . count($falhas) . " teste(s) falharam.\n");
    exit(1);
}
echo "\nTodos os testes de comandos passaram.\n";
