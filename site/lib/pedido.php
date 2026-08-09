<?php
/**
 * lib/pedido.php — COMANDOS_V1
 *
 * O que permite chamar uma API de dentro do próprio PHP, em vez de por HTTP.
 *
 * ── Porquê ──────────────────────────────────────────────────────────────────
 *
 * O `comando.php` transforma links em alterações. Podia reimplementar a
 * escrita de cada ficheiro — e dois meses depois teria a sua própria ideia do
 * que é um desconto válido, diferente da do `precos-api.php`. Em vez disso,
 * inclui a API e chama as funções que já lá estão.
 *
 * Falta uma coisa para isso funcionar: uma API pensada para HTTP escreve
 * cabeçalhos, lê o corpo do `php://input` e termina o pedido com `exit`. As
 * três coisas estragam uma página que está a ser construída por outro
 * ficheiro. Este módulo dá a volta às três, sem que a API deixe de ser uma API
 * normal quando é chamada por HTTP:
 *
 *   `mp_modo_embutido()`  — a API foi incluída, não pedida
 *   `mp_corpo_pedido()`   — o corpo vem de quem incluiu, ou do php://input
 *   `mp_responder_embutido()` — em vez de terminar, devolve por excepção
 *
 * A API não muda de comportamento: em HTTP tudo se passa como antes.
 */

/** A API está a ser incluída por outro ficheiro em vez de servida por HTTP? */
function mp_modo_embutido()
{
    return defined('MP_API_EMBUTIDA') && MP_API_EMBUTIDA;
}

/**
 * O corpo do pedido, decodificado.
 *
 * Em modo embutido vem de `mp_definir_corpo()`; caso contrário do `php://input`
 * como sempre.
 */
function mp_corpo_pedido()
{
    if (mp_modo_embutido() && isset($GLOBALS['mp_corpo_embutido'])) {
        return $GLOBALS['mp_corpo_embutido'];
    }
    return json_decode((string)file_get_contents('php://input'), true);
}

function mp_definir_corpo($corpo)
{
    $GLOBALS['mp_corpo_embutido'] = $corpo;
}

function mp_limpar_corpo()
{
    unset($GLOBALS['mp_corpo_embutido']);
}

/**
 * A resposta de uma API chamada de dentro.
 *
 * As APIs terminam o pedido com `exit` — o que é correcto em HTTP e fatal aqui,
 * porque mataria a página a meio. Em modo embutido a resposta sobe como
 * excepção e quem chamou decide o que fazer com ela.
 */
class MpRespostaEmbutida extends Exception
{
    public $payload;
    public $estado;

    public function __construct($payload, $estado)
    {
        $this->payload = $payload;
        $this->estado = (int)$estado;
        $mensagem = is_array($payload) && isset($payload['message'])
            ? (string)$payload['message']
            : (is_array($payload) && isset($payload['erro']) ? (string)$payload['erro'] : 'Resposta da API.');
        parent::__construct($mensagem, (int)$estado);
    }

    public function correu_bem()
    {
        return $this->estado >= 200 && $this->estado < 300
            && (!is_array($this->payload) || !isset($this->payload['ok']) || $this->payload['ok']);
    }
}

function mp_responder_embutido($payload, $estado = 200)
{
    throw new MpRespostaEmbutida($payload, $estado);
}

/**
 * Corre uma função de uma API e devolve `array($ok, $payload, $estado)`, em vez
 * de deixar o pedido terminar.
 */
function mp_correr_api(callable $funcao, $corpo = null)
{
    if ($corpo !== null) {
        mp_definir_corpo($corpo);
    }
    try {
        $funcao();
        // Uma API que devolve o controlo sem responder não gravou nada.
        return array(false, array('message' => 'A API não respondeu.'), 500);
    } catch (MpRespostaEmbutida $r) {
        return array($r->correu_bem(), $r->payload, $r->estado);
    } catch (Throwable $erro) {
        // Uma excepção inesperada não pode deixar o comando.php a meio de uma
        // resposta HTML. O chamador inicia então o rollback do batch.
        return array(false, array('message' => 'A API falhou: ' . $erro->getMessage()), 500);
    } finally {
        mp_limpar_corpo();
    }
}
