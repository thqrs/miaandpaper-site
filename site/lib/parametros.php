<?php
/**
 * lib/parametros.php — PARAMETROS_V1
 *
 * O registo de todos os parâmetros de URL que o site aceita, e a barra que os
 * torna clicáveis.
 *
 * ── Porquê ──────────────────────────────────────────────────────────────────
 *
 * Metade das funções das páginas de admin só existia se soubesses escrever o
 * parâmetro à mão. O intervalo personalizado do dashboard (`?period=custom`)
 * aparecia na lista de períodos mas não tinha onde pôr as datas; o
 * `?enrich=1` do funil estava escondido num botão a meio do mapa; o
 * `?snapshot=refazer` só se descobria a ler `lib/snapshot.php`. Uma função
 * que não tem link não existe.
 *
 * Aqui cada página declara o que aceita — nome, tipo, valores possíveis, valor
 * por omissão — e a partir dessa declaração sai tudo:
 *
 *   - a barra de links no topo da página (`mp_parametros_barra`);
 *   - as etiquetas dos controlos que já existiam nas páginas
 *     (`mp_parametros_valores`), para não haver duas listas a divergir;
 *   - o manifesto legível por máquinas (`mp_parametros_manifesto`), servido
 *     por `tools/parametros.php?formato=json`;
 *   - a documentação em `docs/11-parametros-de-url.md`.
 *
 * ── Estilo MCP ──────────────────────────────────────────────────────────────
 *
 * O manifesto segue a forma de um `tools/list` do Model Context Protocol: cada
 * página é um recurso com `nome`, `descricao` e `esquemaEntrada` em JSON
 * Schema. Quem quiser conduzir o site por URL — um agente, um GPT, um script —
 * lê o manifesto e sabe exactamente que parâmetros existem, que valores
 * aceitam e o que acontece a um valor inválido, sem abrir um único .php.
 *
 * ── Como acrescentar ────────────────────────────────────────────────────────
 *
 * Parâmetro novo: acrescenta-o em `mp_parametros_registo()` **e** lê-o na
 * página. A barra, o manifesto e a página de ferramentas actualizam-se
 * sozinhos. Se o registo e o código divergirem, o registo está a mentir — e
 * `tools/parametros.php` mostra-o na coluna "lido em".
 */

if (!defined('MP_PARAMETROS_VERSAO')) {
    define('MP_PARAMETROS_VERSAO', '1');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. O registo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipos de parâmetro:
 *
 *   enum     lista fechada de valores; a barra desenha um link por valor
 *   accao    como enum, mas o valor não persiste — é um gesto (ex.: snapshot)
 *   flag     presente/ausente; a barra desenha um interruptor
 *   inteiro  número; caixa de texto + limpar
 *   texto    texto livre; caixa de texto + limpar
 *   data     AAAA-MM-DD; caixa de data
 *   opaco    identificador que só a página conhece (id de sessão, hash)
 *
 * Chaves opcionais: `maximo`, `minimo`, `padrao` (regex), `depende`
 * (só faz sentido com outro parâmetro num dado valor), `repetivel`,
 * `exemplo`, `invalido` (`omissao` = cai no valor por omissão, `erro` = 4xx).
 */
function mp_parametros_registo()
{
    static $registo = null;
    if ($registo !== null) {
        return $registo;
    }

    $snapshot = array(
        'tipo' => 'accao',
        'omissao' => '',
        'descricao' => 'Ignora ou refaz o HTML congelado desta página.',
        'valores' => array(
            'off' => 'ver ao vivo',
            'refazer' => 'refazer',
        ),
        'invalido' => 'omissao',
        'lido' => 'lib/snapshot.php:173',
    );

    $registo = array(

        // ── Páginas de admin ────────────────────────────────────────────────

        'view-uploads.php' => array(
            'titulo' => 'Ficheiros enviados por clientes',
            'tipo' => 'pagina', 'guarda' => 'admin', 'metodos' => array('GET', 'POST'),
            'descricao' => 'Visualizador de gravações de áudio, fotos e anexos de clientes em tmp e encomendas.',
            'parametros' => array(
                'token' => array('tipo'=>'texto', 'omissao'=>'', 'maximo'=>40, 'descricao'=>'Token do ficheiro para destaque ou streaming.', 'lido'=>'view-uploads.php:28,349'),
                'action' => array('tipo'=>'enum', 'omissao'=>'', 'valores'=>array('stream'=>'streaming de media'), 'descricao'=>'Stream seguro com suporte de HTTP range.', 'lido'=>'view-uploads.php:26'),
                'scope' => array('tipo'=>'enum', 'omissao'=>'tmp', 'valores'=>array('tmp'=>'temporários','orders'=>'encomendas','assisted'=>'assistidos'), 'descricao'=>'Pasta de origem do ficheiro.', 'lido'=>'view-uploads.php:33'),
                'order' => array('tipo'=>'texto', 'omissao'=>'', 'maximo'=>32, 'descricao'=>'Código de encomenda para ficheiros em orders.', 'lido'=>'view-uploads.php:69'),
                'ref' => array('tipo'=>'texto', 'omissao'=>'', 'maximo'=>32, 'descricao'=>'Referência de upload assistido.', 'lido'=>'view-uploads.php:90'),
                'download' => array('tipo'=>'flag', 'omissao'=>'', 'descricao'=>'Força o descarregamento em vez de reprodução inline.', 'lido'=>'view-uploads.php:132'),
            ),
        ),
        'funilv2.php' => array(
            'titulo' => 'Funil live · Percurso',
            'tipo' => 'pagina', 'guarda' => 'admin', 'metodos' => array('GET'),
            'descricao' => 'Linha do tempo por sessão, directamente dos JSONL privados, sem snapshots.',
            'parametros' => array(
                'date' => array('tipo'=>'data', 'omissao'=>'', 'descricao'=>'Dia UTC; por omissão, hoje.', 'invalido'=>'erro', 'lido'=>'funilv2.php:16'),
                'sid' => array('tipo'=>'texto', 'omissao'=>'', 'maximo'=>64, 'descricao'=>'Sessão de navegação seleccionada.', 'lido'=>'funilv2.php:17'),
                'action' => array('tipo'=>'enum', 'omissao'=>'', 'valores'=>array('data'=>'dados live'), 'descricao'=>'Devolve visitantes e eventos em JSON autenticado.', 'lido'=>'funilv2.php:15'),
            ),
        ),
        'admin-funnel.php' => array(
            'titulo' => 'Funil',
            'tipo' => 'pagina',
            'guarda' => 'admin',
            'metodos' => array('GET', 'POST'),
            'descricao' => 'Funil de encomenda agregado a partir de funnel_events.',
            'parametros' => array(
                'period' => array(
                    'tipo' => 'enum',
                    'omissao' => '30d',
                    'descricao' => 'Janela de eventos agregados. Não conhece today nem yesterday.',
                    'valores' => array(
                        '7d' => 'últimos 7 dias',
                        '30d' => 'últimos 30 dias',
                        '90d' => 'últimos 90 dias',
                        'all' => 'todos os eventos',
                    ),
                    'invalido' => 'omissao',
                    'lido' => 'admin-funnel.php:108',
                ),
                'enrich' => array(
                    'tipo' => 'flag',
                    'omissao' => '',
                    'descricao' => 'Autoriza até 12 lookups novos de geolocalização de IP neste pedido.',
                    'lido' => 'admin-funnel.php:2201',
                ),
                'snapshot' => $snapshot,
            ),
        ),

        'admin-live-dashboard.php' => array(
            'titulo' => 'Live dashboard',
            'tipo' => 'pagina',
            'guarda' => 'admin',
            'metodos' => array('GET'),
            'descricao' => 'Mapa de metro do funil e teia de produtos, com visitantes.',
            'parametros' => array(
                'period' => array(
                    'tipo' => 'enum',
                    'omissao' => 'today',
                    'descricao' => 'Janela de eventos. Não conhece all.',
                    'valores' => array(
                        'today' => 'hoje',
                        'yesterday' => 'ontem',
                        '7d' => 'últimos 7 dias',
                        '30d' => 'últimos 30 dias',
                        '90d' => 'últimos 90 dias',
                        'custom' => 'intervalo personalizado',
                    ),
                    'invalido' => 'omissao',
                    'lido' => 'admin-live-dashboard.php:175',
                ),
                'view' => array(
                    'tipo' => 'enum',
                    'omissao' => 'metro',
                    'descricao' => 'Mapa de metro do funil ou teia de produtos com visitantes.',
                    'valores' => array(
                        'metro' => 'funil',
                        'teia' => 'teia + visitantes',
                    ),
                    'invalido' => 'omissao',
                    'lido' => 'admin-live-dashboard.php:176',
                ),
                'start' => array(
                    'tipo' => 'data',
                    'omissao' => '',
                    'descricao' => 'Primeiro dia do intervalo. Por omissão, hoje (UTC).',
                    'padrao' => '^\\d{4}-\\d{2}-\\d{2}$',
                    'depende' => array('period' => 'custom'),
                    'invalido' => 'omissao',
                    'lido' => 'admin-live-dashboard.php:190',
                ),
                'end' => array(
                    'tipo' => 'data',
                    'omissao' => '',
                    'descricao' => 'Último dia do intervalo. Por omissão, hoje (UTC).',
                    'padrao' => '^\\d{4}-\\d{2}-\\d{2}$',
                    'depende' => array('period' => 'custom'),
                    'invalido' => 'omissao',
                    'lido' => 'admin-live-dashboard.php:191',
                ),
                'sid' => array(
                    'tipo' => 'opaco',
                    'omissao' => '',
                    'descricao' => 'Isola uma sessão de visitante. Os ids saem da própria página.',
                    'invalido' => 'omissao',
                    'lido' => 'admin-live-dashboard.php:797',
                ),
                'snapshot' => $snapshot,
            ),
        ),

        'admin-orders.php' => array(
            'titulo' => 'Encomendas',
            'tipo' => 'pagina',
            'guarda' => 'admin',
            'metodos' => array('GET', 'POST'),
            'descricao' => 'Lista, detalhe e criação manual de encomendas.',
            'parametros' => array(
                'view' => array(
                    'tipo' => 'enum',
                    'omissao' => 'list',
                    'descricao' => 'Vista da página.',
                    'valores' => array(
                        'list' => 'lista',
                        'detail' => 'detalhe',
                        'new' => 'nova manual',
                    ),
                    'invalido' => 'erro',
                    'lido' => 'admin-orders.php:460',
                ),
                'id' => array(
                    'tipo' => 'inteiro',
                    'omissao' => '',
                    'minimo' => 1,
                    'descricao' => 'Encomenda a abrir. Sem valor, ou com um id que não existe, a página diz que não encontrou.',
                    'depende' => array('view' => 'detail'),
                    'lido' => 'admin-orders.php:759',
                ),
                'f' => array(
                    'tipo' => 'enum',
                    'omissao' => 'all',
                    'descricao' => 'Filtro de estado.',
                    'valores' => array(
                        'all' => 'todas',
                        'new' => 'novas',
                        'unpaid' => 'por pagar',
                        'paid' => 'pagas',
                        'preparing' => 'em preparação',
                        'shipped' => 'enviadas',
                        'cancelled' => 'canceladas',
                    ),
                    'invalido' => 'omissao',
                    'depende' => array('view' => 'list'),
                    'lido' => 'admin-orders.php:645',
                ),
                'p' => array(
                    'tipo' => 'texto',
                    'omissao' => '',
                    'descricao' => 'Filtra por slug de produto. Os valores saem das encomendas existentes.',
                    'depende' => array('view' => 'list'),
                    'lido' => 'admin-orders.php:646',
                ),
                'q' => array(
                    'tipo' => 'texto',
                    'omissao' => '',
                    'maximo' => 60,
                    'descricao' => 'Pesquisa em código, nome, contacto, NIF e nome do cartão. Ignorada com menos de 2 caracteres.',
                    'depende' => array('view' => 'list'),
                    'lido' => 'admin-orders.php:647',
                ),
                'page' => array(
                    'tipo' => 'inteiro',
                    'omissao' => 1,
                    'minimo' => 1,
                    'descricao' => 'Página de 50 linhas.',
                    'depende' => array('view' => 'list'),
                    'lido' => 'admin-orders.php:649',
                ),
                'saved' => array(
                    'tipo' => 'flag',
                    'omissao' => '',
                    'descricao' => 'Mensagem: encomenda actualizada.',
                    'grupo' => 'aviso',
                    'lido' => 'admin-orders.php:605',
                ),
                'paid' => array(
                    'tipo' => 'flag',
                    'omissao' => '',
                    'descricao' => 'Mensagem: pagamento confirmado.',
                    'grupo' => 'aviso',
                    'lido' => 'admin-orders.php:606',
                ),
                'shipped' => array(
                    'tipo' => 'flag',
                    'omissao' => '',
                    'descricao' => 'Mensagem: encomenda enviada.',
                    'grupo' => 'aviso',
                    'lido' => 'admin-orders.php:607',
                ),
                'cancelled' => array(
                    'tipo' => 'flag',
                    'omissao' => '',
                    'descricao' => 'Mensagem: encomenda cancelada.',
                    'grupo' => 'aviso',
                    'lido' => 'admin-orders.php:608',
                ),
                'created' => array(
                    'tipo' => 'flag',
                    'omissao' => '',
                    'descricao' => 'Mensagem: encomenda manual criada.',
                    'grupo' => 'aviso',
                    'lido' => 'admin-orders.php:609',
                ),
                'email' => array(
                    'tipo' => 'enum',
                    'omissao' => '',
                    'descricao' => 'Resultado do email automático ao cliente.',
                    'valores' => array(
                        '1' => 'enviado',
                        'resent' => 'reenviado',
                        'already' => 'estado repetido, não reenviado',
                        'noemail' => 'contacto sem email',
                        'failed' => 'envio falhou',
                    ),
                    'grupo' => 'aviso',
                    'invalido' => 'omissao',
                    'lido' => 'admin-orders.php:611',
                ),
            ),
        ),

        'modulos.php' => array(
            'titulo' => 'Módulos',
            'tipo' => 'pagina',
            'guarda' => 'publico',
            'metodos' => array('GET'),
            'descricao' => 'Inventário visual dos módulos de interface, desenhado pelo próprio app.js.',
            'parametros' => array(
                'snapshot' => $snapshot,
            ),
        ),

        'bot.php' => array(
            'titulo' => 'Míu',
            'tipo' => 'pagina',
            'guarda' => 'admin',
            'metodos' => array('GET', 'POST'),
            'descricao' => 'Conversas, system prompt, base de informação e configuração do chatbot Míu.',
            'documento' => 'docs/12-miu.md',
            'parametros' => array(
                'tab' => array(
                    'tipo' => 'enum',
                    'omissao' => 'conversations',
                    'descricao' => 'Área do painel do Míu a abrir.',
                    'valores' => array(
                        'conversations' => 'conversas',
                        'settings' => 'configuração',
                        'appearance' => 'aparência',
                        'contexts' => 'contexto por passo',
                        'replies' => 'respostas rápidas',
                        'animations' => 'animações',
                    ),
                    'invalido' => 'omissao',
                    'lido' => 'bot.php:70',
                ),
                'id' => array(
                    'tipo' => 'inteiro',
                    'omissao' => 0,
                    'minimo' => 1,
                    'descricao' => 'Conversa a abrir. Sem id, mostra apenas a lista.',
                    'invalido' => 'omissao',
                    'lido' => 'bot.php:119',
                ),
                'page' => array(
                    'tipo' => 'inteiro',
                    'omissao' => 1,
                    'minimo' => 1,
                    'descricao' => 'Página da lista, com 30 conversas por página.',
                    'invalido' => 'omissao',
                    'lido' => 'bot.php:118',
                ),
                'notice' => array(
                    'tipo' => 'enum',
                    'omissao' => '',
                    'descricao' => 'Confirmação depois de uma escrita administrativa.',
                    'valores' => array(
                        'saved' => 'configuração guardada',
                        'save-failed' => 'erro ao guardar configuração',
                        'context-saved' => 'contexto guardado',
                        'deleted' => 'conversa apagada',
                        'appearance-saved' => 'aparência guardada',
                        'appearance-error' => 'erro ao guardar aparência',
                        'animations-saved' => 'comportamento visual guardado',
                        'animation-created' => 'animação adicionada',
                        'animation-saved' => 'animação actualizada',
                        'animation-deleted' => 'animação apagada',
                        'animation-error' => 'erro numa animação',
                    ),
                    'grupo' => 'aviso',
                    'invalido' => 'omissao',
                    'lido' => 'bot.php:70',
                ),
            ),
        ),

        'erros.php' => array(
            'titulo' => 'Erros e mensagens',
            'tipo' => 'pagina',
            'guarda' => 'admin',
            'metodos' => array('GET', 'POST'),
            'descricao' => 'Editor das versões Default e Míu das mensagens públicas de validação e ajuda.',
            'parametros' => array(
                'tab' => array(
                    'tipo' => 'enum',
                    'omissao' => 'default',
                    'descricao' => 'Versão das mensagens a editar.',
                    'valores' => array(
                        'default' => 'Default',
                        'miu' => 'Míu',
                    ),
                    'invalido' => 'omissao',
                    'lido' => 'erros.php:63',
                ),
                'saved' => array(
                    'tipo' => 'flag',
                    'omissao' => '',
                    'descricao' => 'Mostra a confirmação de que as mensagens foram guardadas.',
                    'grupo' => 'aviso',
                    'lido' => 'erros.php:103',
                ),
            ),
        ),

        // ── Páginas de admin sem parâmetros ─────────────────────────────────
        //
        // Estão aqui para o inventário ficar completo: quem lê o manifesto
        // fica a saber que não há nada escondido nestas, em vez de ficar sem
        // saber se foram esquecidas.

        'precos.php' => array(
            'titulo' => 'Preços',
            'tipo' => 'pagina', 'guarda' => 'admin', 'metodos' => array('GET'),
            'descricao' => 'Editor central de preços. O estado vive em precos-api.php.',
            'parametros' => array(),
        ),
        'materiais.php' => array(
            'titulo' => 'Materiais',
            'tipo' => 'pagina', 'guarda' => 'admin', 'metodos' => array('GET'),
            'descricao' => 'Editor de materiais e custos. O estado vive em materiais-api.php.',
            'parametros' => array(),
        ),
        'carrousel.php' => array(
            'titulo' => 'Carrosséis',
            'tipo' => 'pagina', 'guarda' => 'admin', 'metodos' => array('GET'),
            'descricao' => 'Editor dos carrosséis. O estado vive em carrousel-api.php.',
            'parametros' => array(),
        ),
        'homepage-menu-design.php' => array(
            'titulo' => 'Homepage e menu',
            'tipo' => 'pagina', 'guarda' => 'admin', 'metodos' => array('GET'),
            'descricao' => 'Ordem do menu e cartões da homepage. O estado vive em homepage-menu-api.php.',
            'parametros' => array(),
        ),
        'admin-uploads.php' => array(
            'titulo' => 'Uploads',
            'tipo' => 'pagina', 'guarda' => 'admin', 'metodos' => array('GET', 'POST'),
            'descricao' => 'Uploads assistidos. Marcar como visto é POST com CSRF.',
            'parametros' => array(),
        ),
        'admin-snapshots.php' => array(
            'titulo' => 'Snapshots',
            'tipo' => 'pagina', 'guarda' => 'admin', 'metodos' => array('GET', 'POST'),
            'descricao' => 'Criar e apagar os snapshots das páginas caras. Apagar é POST com CSRF.',
            'parametros' => array(),
        ),
        'tools/index.php' => array(
            'titulo' => 'Ferramentas',
            'tipo' => 'pagina', 'guarda' => 'admin', 'metodos' => array('GET'),
            'descricao' => 'Índice das ferramentas internas.',
            'parametros' => array(),
        ),
        'tools/parametros.php' => array(
            'titulo' => 'Parâmetros',
            'tipo' => 'pagina',
            'guarda' => 'admin',
            'metodos' => array('GET'),
            'descricao' => 'Inventário de todos os parâmetros de URL do site, com um link por valor. Em JSON, é o manifesto legível por máquinas.',
            'documento' => 'docs/11-parametros-de-url.md',
            'parametros' => array(
                'formato' => array(
                    'tipo' => 'enum',
                    'omissao' => 'html',
                    'descricao' => 'Página ou manifesto.',
                    'valores' => array(
                        'html' => 'página',
                        'json' => 'manifesto',
                    ),
                    'invalido' => 'omissao',
                    'lido' => 'tools/parametros.php:22',
                ),
                'tipo' => array(
                    'tipo' => 'enum',
                    'omissao' => '',
                    'descricao' => 'Mostra só os recursos deste tipo.',
                    'valores' => array(
                        'pagina' => 'páginas',
                        'api' => 'APIs',
                        'ficheiro' => 'ficheiros',
                        'ferramenta' => 'ferramentas',
                    ),
                    'invalido' => 'omissao',
                    'lido' => 'tools/parametros.php:23',
                ),
                'recurso' => array(
                    'tipo' => 'texto',
                    'omissao' => '',
                    'descricao' => 'Mostra só este ficheiro.',
                    'exemplo' => 'admin-funnel.php',
                    'lido' => 'tools/parametros.php:24',
                ),
                'vazios' => array(
                    'tipo' => 'flag',
                    'omissao' => '',
                    'descricao' => 'Inclui os recursos que não aceitam parâmetro nenhum.',
                    'lido' => 'tools/parametros.php:25',
                ),
            ),
        ),

        'comando.php' => array(
            'titulo' => 'Comandos administrativos',
            'tipo' => 'pagina',
            'guarda' => 'admin',
            'metodos' => array('GET', 'POST'),
            'descricao' => 'Pré-visualiza e aplica operações administrativas descritas em lib/comandos.php. O catálogo completo está no manifesto deste recurso.',
            'documento' => 'tools/README-comandos.md',
            'parametros' => array(
                'op' => array('tipo' => 'opaco', 'omissao' => '', 'descricao' => 'Operação única; ver comandos.operacoes no manifesto.', 'invalido' => 'erro', 'lido' => 'comando.php:74'),
                'c' => array('tipo' => 'opaco', 'omissao' => '', 'descricao' => 'Batch: c[0][op], c[1][op], ... até 40 comandos.', 'invalido' => 'erro', 'lido' => 'lib/comandos.php:2020'),
                'override' => array('tipo' => 'flag', 'omissao' => '', 'descricao' => 'Aplica no GET. Só é aceite numa navegação directa e na sessão de administração.', 'lido' => 'comando.php:88'),
                'formato' => array('tipo' => 'enum', 'omissao' => '', 'descricao' => 'Resposta legível por máquina.', 'valores' => array('json' => 'JSON'), 'invalido' => 'omissao', 'lido' => 'comando.php:37'),
            ),
        ),

        'tools/nomes.php' => array(
            'titulo' => 'Nomes',
            'tipo' => 'pagina', 'guarda' => 'admin', 'metodos' => array('GET', 'POST'),
            'descricao' => 'Lista de nomes do gerador de cartões, guardada fora da raiz pública.',
            'parametros' => array(),
        ),

        // ── Ferramenta com parâmetros lidos no browser ──────────────────────

        'tools/gerador-cartoes.php' => array(
            'titulo' => 'Gerador de cartões',
            'tipo' => 'ferramenta',
            'guarda' => 'admin',
            'metodos' => array('GET'),
            'lado' => 'cliente',
            'descricao' => 'Cartões de botões: PDF para impressão e SVG de corte. Os parâmetros são lidos em JavaScript — o servidor devolve sempre a mesma página.',
            'documento' => 'site/tools/README-url-cartoes.md',
            'parametros' => array(
                'lote' => array(
                    'tipo' => 'texto',
                    'omissao' => '',
                    'repetivel' => true,
                    'descricao' => 'Um lote de cartões: modelo|linha1|linha2|linha3|qtd|turma|ano|textoY. Campos omissíveis pelo fim.',
                    'exemplo' => 'cracha_pr|Ana Nogueira||%7C20%7C3%7C2026',
                    'lido' => 'tools/gerador-cartoes.php:1820',
                ),
                'cartao' => array(
                    'tipo' => 'enum',
                    'omissao' => '',
                    'descricao' => 'Atalho para um lote único, com as linhas em parâmetros próprios.',
                    'valores' => array(
                        'big_blue' => 'grande · azul',
                        'big_green' => 'grande · verde',
                        'small_blue' => 'pequeno · azul',
                        'small_green' => 'pequeno · verde',
                        'gigantic_blue' => 'gigante · azul',
                        'obrigada_blue' => 'obrigada · azul',
                        'obrigada_green' => 'obrigada · verde',
                        'iman_corte_pioneiros' => 'íman corte · pioneiros',
                        'iman_grosso_pioneiros' => 'íman grosso · pioneiros',
                        'cracha_pr' => 'crachá PR · pioneiros',
                    ),
                    'invalido' => 'omissao',
                    'lido' => 'tools/gerador-cartoes.php:1825',
                ),
                'linha1' => array('tipo' => 'texto', 'omissao' => '', 'descricao' => 'Primeira linha do cartão.', 'depende' => array('cartao' => '*'), 'lido' => 'tools/gerador-cartoes.php:1828'),
                'linha2' => array('tipo' => 'texto', 'omissao' => '', 'descricao' => 'Segunda linha do cartão.', 'depende' => array('cartao' => '*'), 'lido' => 'tools/gerador-cartoes.php:1828'),
                'linha3' => array('tipo' => 'texto', 'omissao' => '', 'descricao' => 'Terceira linha do cartão.', 'depende' => array('cartao' => '*'), 'lido' => 'tools/gerador-cartoes.php:1828'),
                'qtd' => array('tipo' => 'inteiro', 'omissao' => 12, 'minimo' => 1, 'descricao' => 'Quantidade de cartões do lote.', 'depende' => array('cartao' => '*'), 'lido' => 'tools/gerador-cartoes.php:1829'),
                'turma' => array('tipo' => 'texto', 'omissao' => '', 'descricao' => 'Turma. Só usada nos modelos de pioneiros.', 'depende' => array('cartao' => '*'), 'lido' => 'tools/gerador-cartoes.php:1830'),
                'ano' => array('tipo' => 'texto', 'omissao' => '', 'descricao' => 'Ano. Só usado nos modelos de pioneiros.', 'depende' => array('cartao' => '*'), 'lido' => 'tools/gerador-cartoes.php:1830'),
                'textoy' => array('tipo' => 'texto', 'omissao' => '', 'descricao' => 'Deslocação vertical do texto, em mm.', 'depende' => array('cartao' => '*'), 'lido' => 'tools/gerador-cartoes.php:1830'),
                'margem' => array('tipo' => 'texto', 'omissao' => '3', 'descricao' => 'Margem da folha em mm. 0 = borderless.', 'lido' => 'tools/gerador-cartoes.php:1843'),
                'deitado' => array('tipo' => 'flag', 'omissao' => '0', 'descricao' => 'Cartões deitados.', 'lido' => 'tools/gerador-cartoes.php:1846'),
                'contorno' => array('tipo' => 'flag', 'omissao' => '1', 'descricao' => 'Linha à volta do cartão.', 'lido' => 'tools/gerador-cartoes.php:1847'),
                'contornoMm' => array('tipo' => 'texto', 'omissao' => '0.1', 'descricao' => 'Espessura da linha, em mm.', 'lido' => 'tools/gerador-cartoes.php:1844'),
                'contornoCor' => array('tipo' => 'texto', 'omissao' => '#dcdcdc', 'descricao' => 'Cor da linha, em #rrggbb.', 'lido' => 'tools/gerador-cartoes.php:1845'),
                'contornoSuave' => array('tipo' => 'flag', 'omissao' => '1', 'descricao' => 'Anti-alias da linha.', 'lido' => 'tools/gerador-cartoes.php:1848'),
                'solinhas' => array('tipo' => 'flag', 'omissao' => '0', 'descricao' => 'PDF só com as linhas, para folhas já impressas.', 'lido' => 'tools/gerador-cartoes.php:1849'),
                'ptc' => array('tipo' => 'flag', 'omissao' => '0', 'descricao' => 'Print Then Cut: gera SVGs e não gera PDF.', 'lido' => 'tools/gerador-cartoes.php:1850'),
                'gensvg' => array('tipo' => 'flag', 'omissao' => '0', 'descricao' => 'Gerar também os SVGs de corte.', 'lido' => 'tools/gerador-cartoes.php:1851'),
                'legado' => array('tipo' => 'flag', 'omissao' => '0', 'descricao' => 'Incluir as linhas dos cartões no corte.', 'lido' => 'tools/gerador-cartoes.php:1852'),
                'rascunho' => array('tipo' => 'flag', 'omissao' => '0', 'descricao' => 'Imprimir as linhas de corte no PDF, para calibrar.', 'lido' => 'tools/gerador-cartoes.php:1853'),
                'gx' => array('tipo' => 'texto', 'omissao' => '0', 'descricao' => 'Calibração horizontal do corte, em mm.', 'lido' => 'tools/gerador-cartoes.php:1845'),
                'gy' => array('tipo' => 'texto', 'omissao' => '0', 'descricao' => 'Calibração vertical do corte, em mm.', 'lido' => 'tools/gerador-cartoes.php:1845'),
                'sx' => array('tipo' => 'texto', 'omissao' => '0', 'descricao' => 'Calibração horizontal das fendas, em mm.', 'lido' => 'tools/gerador-cartoes.php:1845'),
                'sy' => array('tipo' => 'texto', 'omissao' => '0', 'descricao' => 'Calibração vertical das fendas, em mm.', 'lido' => 'tools/gerador-cartoes.php:1845'),
            ),
        ),

        // ── APIs JSON ───────────────────────────────────────────────────────

        'admin-api.php' => array(
            'titulo' => 'API de admin',
            'tipo' => 'api',
            'guarda' => 'condicional',
            'metodos' => array('GET', 'POST'),
            'descricao' => 'Sessão, catálogo, ofertas, cores, produtos e homepage. Só action=status responde sem sessão.',
            'parametros' => array(
                'action' => array(
                    'tipo' => 'enum',
                    'omissao' => '',
                    'descricao' => 'Função a executar.',
                    'valores' => array(
                        'status' => 'estado da sessão (GET, público)',
                        'parametros' => 'esquema desta API (GET)',
                        'login' => 'entrar (POST)',
                        'logout' => 'sair (POST)',
                        'toggle-ignore-current-ip' => 'ignorar/deixar de ignorar este IP (POST)',
                        'get-colors' => 'ler as cores (GET)',
                        'save-colors' => 'gravar as cores (POST)',
                        'save-catalog' => 'gravar o catálogo (POST)',
                        'save-offers' => 'gravar as ofertas (POST)',
                        'save-product' => 'gravar um produto (POST)',
                        'save-home' => 'gravar a homepage (POST)',
                    ),
                    'invalido' => 'erro',
                    'lido' => 'admin-api.php:1050',
                ),
            ),
        ),

        'precos-api.php' => array(
            'titulo' => 'API de preços',
            'tipo' => 'api',
            'guarda' => 'admin',
            'metodos' => array('GET', 'POST'),
            'descricao' => 'Estado e escrita do editor central de preços.',
            'parametros' => array(
                'action' => array(
                    'tipo' => 'enum',
                    'omissao' => 'data',
                    'descricao' => 'Função a executar.',
                    'valores' => array(
                        'data' => 'ler tudo (GET)',
                        'parametros' => 'esquema desta API (GET)',
                        'calcular' => 'tabelas calculadas (GET)',
                        'ordem-tabs' => 'gravar a ordem dos separadores (POST)',
                        'save' => 'gravar (POST)',
                    ),
                    'invalido' => 'erro',
                    'lido' => 'precos-api.php:1529',
                ),
                'ate' => array(
                    'tipo' => 'inteiro',
                    'omissao' => 500,
                    'minimo' => 1,
                    'descricao' => 'Quantidade máxima a calcular.',
                    'depende' => array('action' => 'calcular'),
                    'lido' => 'precos-api.php:1540',
                ),
            ),
        ),

        'produtos-api.php' => array(
            'titulo' => 'API de produtos',
            'tipo' => 'api',
            'guarda' => 'admin',
            'metodos' => array('GET'),
            'descricao' => 'Mapa de produtos, páginas e passos, para a teia e a galeria.',
            'parametros' => array(
                'action' => array(
                    'tipo' => 'enum',
                    'omissao' => 'data',
                    'descricao' => 'Função a executar.',
                    'valores' => array(
                        'data' => 'mapa completo',
                        'parametros' => 'esquema desta API',
                        'gallery-state' => 'que entradas da galeria estão dadas por concluídas',
                    ),
                    'invalido' => 'erro',
                    'lido' => 'produtos-api.php:170',
                ),
            ),
        ),

        'galeria-api.php' => array(
            'titulo' => 'API da galeria',
            'tipo' => 'api',
            'guarda' => 'admin',
            'metodos' => array('GET', 'POST'),
            'descricao' => 'Imagens dos produtos: leitura, upload e escrita.',
            'parametros' => array(
                'action' => array(
                    'tipo' => 'enum',
                    'omissao' => '',
                    'descricao' => 'Função a executar.',
                    'valores' => array(
                        'data' => 'ler os produtos e as imagens (GET)',
                        'parametros' => 'esquema desta API (GET)',
                        'done' => 'entradas dadas por concluídas (GET)',
                        'upload' => 'receber uma imagem (POST)',
                        'save' => 'gravar os produtos (POST)',
                        'save-done' => 'marcar entradas como concluídas (POST)',
                    ),
                    'invalido' => 'erro',
                    'lido' => 'galeria-api.php:645',
                ),
                'entry' => array(
                    'tipo' => 'texto',
                    'omissao' => '',
                    'descricao' => 'Limita a resposta a um produto. home ou <contexto>:<slug>. Chave inválida dá 400.',
                    'depende' => array('action' => 'data'),
                    'invalido' => 'erro',
                    'lido' => 'galeria-api.php:656',
                ),
            ),
        ),

        'carrousel-api.php' => array(
            'titulo' => 'API dos carrosséis',
            'tipo' => 'api', 'guarda' => 'admin', 'metodos' => array('GET', 'POST'),
            'descricao' => 'Estado e escrita dos carrosséis.',
            'parametros' => array(
                'action' => array(
                    'tipo' => 'enum', 'omissao' => 'data', 'descricao' => 'Função a executar.',
                    'valores' => array(
                        'data' => 'ler tudo (GET)',
                        'parametros' => 'esquema desta API (GET)',
                        'save' => 'gravar (POST)',
                    ),
                    'invalido' => 'erro',
                    'lido' => 'carrousel-api.php:343',
                ),
            ),
        ),

        'materiais-api.php' => array(
            'titulo' => 'API dos materiais',
            'tipo' => 'api', 'guarda' => 'admin', 'metodos' => array('GET', 'POST'),
            'descricao' => 'Estado e escrita dos materiais e custos.',
            'parametros' => array(
                'action' => array(
                    'tipo' => 'enum', 'omissao' => 'data', 'descricao' => 'Função a executar.',
                    'valores' => array(
                        'data' => 'ler tudo (GET)',
                        'parametros' => 'esquema desta API (GET)',
                        'save' => 'gravar (POST)',
                    ),
                    'invalido' => 'erro',
                    'lido' => 'materiais-api.php:455',
                ),
            ),
        ),

        'homepage-menu-api.php' => array(
            'titulo' => 'API da homepage e menu',
            'tipo' => 'api', 'guarda' => 'admin', 'metodos' => array('GET', 'POST'),
            'descricao' => 'Ordem do menu e cartões da homepage.',
            'parametros' => array(
                'action' => array(
                    'tipo' => 'enum', 'omissao' => 'data', 'descricao' => 'Função a executar.',
                    'valores' => array(
                        'data' => 'ler tudo (GET)',
                        'parametros' => 'esquema desta API (GET)',
                        'save' => 'gravar (POST)',
                    ),
                    'invalido' => 'erro',
                    'lido' => 'homepage-menu-api.php:444',
                ),
            ),
        ),

        'reviews-api.php' => array(
            'titulo' => 'API das reviews',
            'tipo' => 'api',
            'guarda' => 'condicional',
            'metodos' => array('GET', 'POST'),
            'descricao' => 'Reviews do site. A protecção acompanha MIA_ADMIN_OPEN em admin-open.php.',
            'parametros' => array(
                'action' => array(
                    'tipo' => 'enum', 'omissao' => 'load', 'descricao' => 'Função a executar.',
                    'valores' => array(
                        'load' => 'ler as reviews (GET)',
                        'parametros' => 'esquema desta API (GET)',
                        'save' => 'gravar (POST)',
                        'upload' => 'receber uma imagem (POST)',
                    ),
                    'invalido' => 'erro',
                    'lido' => 'reviews-api.php:185',
                ),
            ),
        ),

        // ── Endpoints que servem ficheiros ──────────────────────────────────

        'admin-order-file.php' => array(
            'titulo' => 'Anexo de encomenda',
            'tipo' => 'ficheiro',
            'guarda' => 'admin',
            'metodos' => array('GET'),
            'descricao' => 'Serve um anexo de uma encomenda a partir da pasta privada. O caminho tem de constar do JSON da encomenda.',
            'parametros' => array(
                'order_id' => array('tipo' => 'inteiro', 'omissao' => 0, 'minimo' => 1, 'descricao' => 'Encomenda dona do anexo.', 'invalido' => 'erro', 'lido' => 'admin-order-file.php:86'),
                'file' => array('tipo' => 'opaco', 'omissao' => '', 'padrao' => '^[a-f0-9]{32,40}$', 'descricao' => 'Identificador do anexo.', 'invalido' => 'erro', 'lido' => 'admin-order-file.php:87'),
                'inline' => array('tipo' => 'flag', 'omissao' => '', 'descricao' => 'Mostra no browser em vez de descarregar. Ignorado em PDF.', 'lido' => 'admin-order-file.php:184'),
            ),
        ),

        'admin-assisted-file.php' => array(
            'titulo' => 'Anexo de upload assistido',
            'tipo' => 'ficheiro',
            'guarda' => 'admin',
            'metodos' => array('GET'),
            'descricao' => 'Serve um ficheiro de um upload assistido.',
            'parametros' => array(
                'upload_id' => array('tipo' => 'inteiro', 'omissao' => 0, 'minimo' => 1, 'descricao' => 'Upload dono do ficheiro.', 'invalido' => 'erro', 'lido' => 'admin-assisted-file.php:11'),
                'file' => array('tipo' => 'opaco', 'omissao' => '', 'padrao' => '^[a-f0-9]{32,40}$', 'descricao' => 'Identificador do ficheiro.', 'invalido' => 'erro', 'lido' => 'admin-assisted-file.php:12'),
            ),
        ),

        'order-media-preview.php' => array(
            'titulo' => 'Pré-visualização de ficheiro temporário',
            'tipo' => 'ficheiro',
            'guarda' => 'token',
            'metodos' => array('GET'),
            'descricao' => 'Serve um ficheiro ainda não associado a encomenda. O token é a única credencial; o MIME guardado tem de bater certo com a extensão.',
            'parametros' => array(
                'token' => array('tipo' => 'opaco', 'omissao' => '', 'padrao' => '^[a-f0-9]{32,40}$', 'descricao' => 'Token do ficheiro temporário.', 'invalido' => 'erro', 'lido' => 'order-media-preview.php:47'),
            ),
        ),

        'list-carousel-images.php' => array(
            'titulo' => 'Imagens de carrossel',
            'tipo' => 'api',
            'guarda' => 'publico',
            'metodos' => array('GET'),
            'descricao' => 'Lista os ficheiros de um conjunto de imagens de carrossel.',
            'parametros' => array(
                'set' => array(
                    'tipo' => 'enum',
                    'omissao' => '',
                    'descricao' => 'Conjunto a listar.',
                    'valores' => array('cadernos' => 'cadernos'),
                    'invalido' => 'erro',
                    'lido' => 'list-carousel-images.php:11',
                ),
            ),
        ),

        // ── Formulários e endpoints públicos ───────────────────────────────

        'send-order.php' => array(
            'titulo' => 'Envio de encomenda',
            'tipo' => 'api', 'guarda' => 'publico', 'metodos' => array('GET', 'POST'),
            'descricao' => 'Recebe o formulário de encomenda; em GET pode mostrar a pré-visualização segura do ecrã de pagamento.',
            'parametros' => array(
                'checkout_debug' => array(
                    'tipo' => 'flag',
                    'omissao' => false,
                    'descricao' => 'Mostra o ecrã final de pagamento com produtos e valores fictícios, sem criar encomenda nem enviar email.',
                    'invalido' => 'omissao',
                    'lido' => 'send-order.php:135',
                ),
            ),
        ),
        'send-message.php' => array(
            'titulo' => 'Envio de mensagem',
            'tipo' => 'api', 'guarda' => 'publico', 'metodos' => array('POST'),
            'descricao' => 'Recebe o formulário de contacto. Não lê nada do URL.',
            'parametros' => array(),
        ),
        'bot-api.php' => array(
            'titulo' => 'API do Míu',
            'tipo' => 'api', 'guarda' => 'publico', 'metodos' => array('GET', 'POST'),
            'descricao' => 'Configuração pública e mensagens do Míu. A acção vem do método HTTP e do corpo JSON; não lê nada do URL.',
            'parametros' => array(),
        ),
        'upload-order-photo.php' => array(
            'titulo' => 'Upload de ficheiro do cliente',
            'tipo' => 'api', 'guarda' => 'publico', 'metodos' => array('POST'),
            'descricao' => 'Recebe imagens e áudio do cliente. Não lê nada do URL.',
            'parametros' => array(),
        ),
        'track-order-event.php' => array(
            'titulo' => 'Evento de funil',
            'tipo' => 'api', 'guarda' => 'publico', 'metodos' => array('POST'),
            'descricao' => 'Grava um evento em funnel_events. Não lê nada do URL.',
            'parametros' => array(),
        ),
        'check-open-orders.php' => array(
            'titulo' => 'Encomenda aberta',
            'tipo' => 'api', 'guarda' => 'publico', 'metodos' => array('POST'),
            'descricao' => 'Diz apenas se o mesmo IP já tem uma encomenda aberta. Não lê nada do URL.',
            'parametros' => array(),
        ),
        'help-upload.php' => array(
            'titulo' => 'Pedido de ajuda no upload',
            'tipo' => 'api', 'guarda' => 'publico', 'metodos' => array('POST'),
            'descricao' => 'Regista um pedido de ajuda com os ficheiros. Não lê nada do URL.',
            'parametros' => array(),
        ),
    );

    return $registo;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Leitura do registo
// ─────────────────────────────────────────────────────────────────────────────

function mp_parametros_recurso($id)
{
    $registo = mp_parametros_registo();
    return isset($registo[$id]) ? $registo[$id] : null;
}

/**
 * Os valores de um enum, na forma `valor => etiqueta`. As páginas usam isto
 * em vez de escreverem a lista outra vez.
 */
function mp_parametros_valores($id, $parametro)
{
    $recurso = mp_parametros_recurso($id);
    if ($recurso === null || !isset($recurso['parametros'][$parametro]['valores'])) {
        return array();
    }
    return $recurso['parametros'][$parametro]['valores'];
}

function mp_parametros_omissao($id, $parametro)
{
    $recurso = mp_parametros_recurso($id);
    return $recurso !== null && isset($recurso['parametros'][$parametro]['omissao'])
        ? $recurso['parametros'][$parametro]['omissao']
        : '';
}

/** O valor actual de um parâmetro, já com o valor por omissão aplicado. */
function mp_parametros_actual($id, $parametro, ?array $origem = null)
{
    $origem = $origem === null ? $_GET : $origem;
    $recurso = mp_parametros_recurso($id);
    $descritor = $recurso !== null && isset($recurso['parametros'][$parametro])
        ? $recurso['parametros'][$parametro]
        : array();

    if (!isset($origem[$parametro]) || is_array($origem[$parametro])) {
        return isset($descritor['omissao']) ? (string)$descritor['omissao'] : '';
    }

    $valor = (string)$origem[$parametro];

    // Um valor fora da lista cai no valor por omissão nos parâmetros que a
    // página trata assim — a barra tem de mostrar o mesmo que a página usa.
    if (
        isset($descritor['valores'])
        && $descritor['tipo'] === 'enum'
        && !isset($descritor['valores'][$valor])
        && (!isset($descritor['invalido']) || $descritor['invalido'] === 'omissao')
    ) {
        return isset($descritor['omissao']) ? (string)$descritor['omissao'] : '';
    }

    return $valor;
}

/** Uma dependência `depende` está satisfeita? `*` = qualquer valor não vazio. */
function mp_parametros_depende_ok($id, array $descritor, array $origem)
{
    if (empty($descritor['depende'])) {
        return true;
    }
    foreach ($descritor['depende'] as $outro => $esperado) {
        $valor = mp_parametros_actual($id, $outro, $origem);
        if ($esperado === '*') {
            if ($valor === '') {
                return false;
            }
        } elseif ($valor !== (string)$esperado) {
            return false;
        }
    }
    return true;
}

/**
 * Os parâmetros que têm de ir no mesmo URL para este fazer alguma coisa.
 *
 * Sem isto, um link para `?id=12` em `admin-orders.php` não mostrava nada:
 * o `id` só é lido com `view=detail`. Um link que não faz nada é pior do que
 * link nenhum.
 */
function mp_parametros_dependencias($id, $parametro)
{
    $recurso = mp_parametros_recurso($id);
    if ($recurso === null || empty($recurso['parametros'][$parametro]['depende'])) {
        return array();
    }

    $fora = array();
    foreach ($recurso['parametros'][$parametro]['depende'] as $nome => $valor) {
        if ($valor === '*') {
            // Serve qualquer valor: usa o primeiro que o registo conhece.
            $valores = mp_parametros_valores($id, $nome);
            $valor = $valores ? (string)key($valores) : '';
        }
        if ($valor !== '') {
            $fora[$nome] = (string)$valor;
        }
    }
    return $fora;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. URLs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * O caminho da página actual, sem query string. É o que a barra usa como base,
 * para funcionar na raiz e dentro de `tools/` sem saber onde está.
 */
function mp_parametros_base_actual()
{
    $uri = isset($_SERVER['REQUEST_URI']) ? (string)$_SERVER['REQUEST_URI'] : '';
    $base = strtok($uri, '?');
    return $base === false || $base === '' ? '' : $base;
}

/**
 * URL com `$mudancas` aplicadas por cima dos parâmetros actuais.
 *
 * Um valor igual ao valor por omissão, vazio ou nulo sai do URL: um link curto
 * é um link que se lê antes de clicar.
 */
function mp_parametros_url($id, array $mudancas, ?array $origem = null, $base = null)
{
    $origem = $origem === null ? $_GET : $origem;
    $base = $base === null ? mp_parametros_base_actual() : $base;
    $recurso = mp_parametros_recurso($id);
    $conhecidos = $recurso !== null ? $recurso['parametros'] : array();

    $query = array();
    foreach ($origem as $nome => $valor) {
        if (!is_array($valor)) {
            $query[$nome] = (string)$valor;
        }
    }
    foreach ($mudancas as $nome => $valor) {
        $query[$nome] = $valor === null ? null : (string)$valor;
    }

    foreach ($query as $nome => $valor) {
        $omissao = isset($conhecidos[$nome]['omissao']) ? (string)$conhecidos[$nome]['omissao'] : null;
        $eAccao = isset($conhecidos[$nome]['tipo']) && $conhecidos[$nome]['tipo'] === 'accao';
        if ($valor === null || $valor === '' || (!$eAccao && $omissao !== null && $valor === $omissao)) {
            unset($query[$nome]);
        }
    }

    // Uma acção nunca fica colada ao URL seguinte: `snapshot=refazer` só vale
    // para o pedido em que se clicou.
    foreach ($conhecidos as $nome => $descritor) {
        if (isset($descritor['tipo']) && $descritor['tipo'] === 'accao' && !isset($mudancas[$nome])) {
            unset($query[$nome]);
        }
    }

    return $query ? $base . '?' . http_build_query($query) : $base;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. A barra
// ─────────────────────────────────────────────────────────────────────────────

function mp_parametros_h($valor)
{
    return htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8');
}

function mp_parametros_estilo_chip($activo)
{
    return 'display:inline-block;padding:2px 9px;border-radius:999px;text-decoration:none;'
        . 'border:1px solid ' . ($activo ? 'rgba(51,82,31,0.55)' : 'rgba(0,0,0,0.18)') . ';'
        . 'background:' . ($activo ? 'rgba(51,82,31,0.16)' : 'rgba(255,255,255,0.55)') . ';'
        . 'color:inherit;' . ($activo ? 'font-weight:800;' : 'font-weight:600;');
}

/** Campos ocultos que levam os outros parâmetros no submit de um campo livre. */
function mp_parametros_ocultos($id, $excepto, array $origem)
{
    $recurso = mp_parametros_recurso($id);
    $conhecidos = $recurso !== null ? $recurso['parametros'] : array();
    $html = '';
    foreach ($origem as $nome => $valor) {
        if ($nome === $excepto || is_array($valor) || (string)$valor === '') {
            continue;
        }
        if (isset($conhecidos[$nome]['tipo']) && $conhecidos[$nome]['tipo'] === 'accao') {
            continue;
        }
        $html .= '<input type="hidden" name="' . mp_parametros_h($nome) . '" value="' . mp_parametros_h($valor) . '">';
    }
    return $html;
}

/**
 * A barra de parâmetros de uma página: um link por valor possível, e uma caixa
 * para os que são texto livre.
 *
 * Opções:
 *   `valores`  — enums que só se conhecem em execução, ex.: os slugs de
 *                produto que existem mesmo na base de dados
 *   `esconder` — parâmetros a não desenhar (os avisos de flash, por exemplo)
 *   `origem`   — de onde ler os valores actuais (por omissão `$_GET`)
 */
function mp_parametros_barra($id, array $opcoes = array())
{
    $recurso = mp_parametros_recurso($id);
    if ($recurso === null || empty($recurso['parametros'])) {
        return '';
    }

    $origem = isset($opcoes['origem']) ? $opcoes['origem'] : $_GET;
    $extra = isset($opcoes['valores']) ? $opcoes['valores'] : array();
    $esconder = isset($opcoes['esconder']) ? (array)$opcoes['esconder'] : array();

    $grupos = array();

    foreach ($recurso['parametros'] as $nome => $descritor) {
        if (in_array($nome, $esconder, true)) {
            continue;
        }
        if (!mp_parametros_depende_ok($id, $descritor, $origem)) {
            continue;
        }

        $tipo = isset($descritor['tipo']) ? $descritor['tipo'] : 'texto';
        $actual = mp_parametros_actual($id, $nome, $origem);
        $titulo = isset($descritor['descricao']) ? $descritor['descricao'] : '';
        $controlos = array();

        // Valores injectados em execução (os slugs que existem mesmo na base de
        // dados, por exemplo) tornam clicável um parâmetro que o registo só
        // consegue descrever como texto livre.
        if (isset($extra[$nome]) || $tipo === 'enum' || $tipo === 'accao') {
            $valores = isset($extra[$nome]) ? $extra[$nome] : (isset($descritor['valores']) ? $descritor['valores'] : array());
            foreach ($valores as $valor => $etiqueta) {
                $valor = (string)$valor;
                $activo = $tipo !== 'accao' && $valor === $actual;
                $controlos[] = '<a href="' . mp_parametros_h(mp_parametros_url($id, array($nome => $valor), $origem))
                    . '" style="' . mp_parametros_estilo_chip($activo) . '">' . mp_parametros_h($etiqueta) . '</a>';
            }
        } elseif ($tipo === 'flag') {
            $ligado = $actual !== '' && $actual !== '0';
            $controlos[] = '<a href="' . mp_parametros_h(mp_parametros_url($id, array($nome => $ligado ? '0' : '1'), $origem))
                . '" style="' . mp_parametros_estilo_chip($ligado) . '">' . ($ligado ? 'ligado' : 'desligado') . '</a>';
        } else {
            $campo = $tipo === 'data' ? 'date' : ($tipo === 'inteiro' ? 'number' : 'text');
            $limites = '';
            if (isset($descritor['maximo'])) {
                $limites .= ' maxlength="' . (int)$descritor['maximo'] . '"';
            }
            if (isset($descritor['minimo'])) {
                $limites .= ' min="' . (int)$descritor['minimo'] . '"';
            }
            $mostrado = $actual === (string)(isset($descritor['omissao']) ? $descritor['omissao'] : '') ? '' : $actual;
            $controlos[] = '<form method="get" action="' . mp_parametros_h(mp_parametros_base_actual())
                . '" style="display:inline-flex;gap:4px;align-items:center;margin:0;">'
                . mp_parametros_ocultos($id, $nome, $origem)
                . '<input type="' . $campo . '" name="' . mp_parametros_h($nome) . '" value="' . mp_parametros_h($mostrado) . '"' . $limites
                . ' style="padding:1px 8px;border:1px solid rgba(0,0,0,0.18);border-radius:999px;'
                . 'background:rgba(255,255,255,0.7);font:inherit;color:inherit;width:' . ($campo === 'text' ? '11ch' : '10ch') . ';">'
                . '</form>';
            if ($mostrado !== '') {
                $controlos[] = '<a href="' . mp_parametros_h(mp_parametros_url($id, array($nome => null), $origem))
                    . '" style="text-decoration:none;color:inherit;opacity:0.65;" aria-label="Limpar ' . mp_parametros_h($nome) . '">×</a>';
            }
        }

        if (!$controlos) {
            continue;
        }

        $grupos[] = '<span style="display:inline-flex;gap:5px;align-items:center;flex-wrap:wrap;" title="' . mp_parametros_h($titulo) . '">'
            . '<code style="font:inherit;opacity:0.7;">' . mp_parametros_h($nome) . '</code>'
            . implode('', $controlos)
            . '</span>';
    }

    if (!$grupos) {
        return '';
    }

    return '<div data-mp-parametros style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;'
        . 'padding:6px 14px;font:600 0.76rem/1.5 system-ui,sans-serif;'
        . 'background:#efeade;color:#4a4030;border-bottom:1px solid rgba(0,0,0,0.10);">'
        . implode('', $grupos)
        . '</div>';
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. O manifesto, em JSON Schema (estilo MCP tools/list)
// ─────────────────────────────────────────────────────────────────────────────

function mp_parametros_esquema_campo(array $descritor)
{
    $tipo = isset($descritor['tipo']) ? $descritor['tipo'] : 'texto';
    $campo = array();

    switch ($tipo) {
        case 'enum':
        case 'accao':
            $campo['type'] = 'string';
            if (!empty($descritor['valores'])) {
                $campo['enum'] = array_map('strval', array_keys($descritor['valores']));
                $campo['enumDescriptions'] = array_values(array_map('strval', $descritor['valores']));
            }
            break;
        case 'flag':
            $campo['type'] = 'string';
            $campo['enum'] = array('1', '0');
            break;
        case 'inteiro':
            $campo['type'] = 'integer';
            break;
        case 'data':
            $campo['type'] = 'string';
            $campo['format'] = 'date';
            break;
        default:
            $campo['type'] = 'string';
    }

    if (isset($descritor['omissao']) && $descritor['omissao'] !== '') {
        $campo['default'] = $tipo === 'inteiro' ? (int)$descritor['omissao'] : (string)$descritor['omissao'];
    }
    if (isset($descritor['minimo'])) {
        $campo['minimum'] = (int)$descritor['minimo'];
    }
    if (isset($descritor['maximo'])) {
        $campo['maxLength'] = (int)$descritor['maximo'];
    }
    if (isset($descritor['padrao'])) {
        $campo['pattern'] = (string)$descritor['padrao'];
    }
    if (isset($descritor['descricao'])) {
        $campo['description'] = (string)$descritor['descricao'];
    }

    // Extensões nossas, com prefixo para não colidirem com JSON Schema.
    $campo['x-tipo'] = $tipo;
    $campo['x-invalido'] = isset($descritor['invalido']) ? $descritor['invalido'] : 'omissao';
    if (!empty($descritor['depende'])) {
        $campo['x-depende'] = $descritor['depende'];
    }
    if (!empty($descritor['repetivel'])) {
        $campo['x-repetivel'] = true;
    }
    if (isset($descritor['lido'])) {
        $campo['x-lido'] = (string)$descritor['lido'];
    }
    if (isset($descritor['exemplo'])) {
        $campo['examples'] = array((string)$descritor['exemplo']);
    }

    return $campo;
}

/** Um URL de exemplo por recurso, com o primeiro valor de cada enum. */
function mp_parametros_exemplo($id, array $recurso)
{
    $query = array();
    foreach ($recurso['parametros'] as $nome => $descritor) {
        if (!empty($descritor['depende']) || (isset($descritor['grupo']) && $descritor['grupo'] === 'aviso')) {
            continue;
        }
        if (isset($descritor['tipo']) && $descritor['tipo'] === 'enum' && !empty($descritor['valores'])) {
            $chaves = array_keys($descritor['valores']);
            $query[$nome] = (string)$chaves[0];
        }
    }
    return $query ? $id . '?' . http_build_query($query) : $id;
}

/**
 * O manifesto inteiro. A forma é a de um `tools/list` do MCP: uma lista de
 * recursos, cada um com nome, descrição e `esquemaEntrada` em JSON Schema.
 */
function mp_parametros_manifesto()
{
    $recursos = array();

    foreach (mp_parametros_registo() as $id => $recurso) {
        $propriedades = array();
        foreach ($recurso['parametros'] as $nome => $descritor) {
            $propriedades[$nome] = mp_parametros_esquema_campo($descritor);
        }

        $recursos[] = array(
            'nome' => $id,
            'titulo' => $recurso['titulo'],
            'descricao' => $recurso['descricao'],
            'tipo' => $recurso['tipo'],
            'guarda' => $recurso['guarda'],
            'metodos' => $recurso['metodos'],
            'lado' => isset($recurso['lado']) ? $recurso['lado'] : 'servidor',
            'documento' => isset($recurso['documento']) ? $recurso['documento'] : null,
            'esquemaEntrada' => array(
                'type' => 'object',
                'properties' => (object)$propriedades,
                'required' => array(),
                'additionalProperties' => false,
            ),
            'exemplo' => mp_parametros_exemplo($id, $recurso),
        );
    }

    return array(
        'versao' => MP_PARAMETROS_VERSAO,
        'gerado' => gmdate('c'),
        'origem' => 'site/lib/parametros.php',
        'documento' => 'docs/11-parametros-de-url.md',
        'recursos' => $recursos,
    );
}

/** O esquema de um só recurso — o que cada API devolve em `?action=parametros`. */
function mp_parametros_manifesto_recurso($id)
{
    $manifesto = mp_parametros_manifesto();
    foreach ($manifesto['recursos'] as $recurso) {
        if ($recurso['nome'] === $id) {
            return $recurso;
        }
    }
    return null;
}
