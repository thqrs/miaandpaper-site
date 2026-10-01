<?php
/**
 * lib/orcamento-pdf.php — ORCAMENTOS_V1
 *
 * O PDF de um orçamento, escrito à mão. Não há biblioteca: o alojamento é
 * partilhado, o deploy é copiar ficheiros, e um orçamento precisa só de texto,
 * linhas, rectângulos e uma imagem JPEG — tudo coisas que o formato PDF faz
 * nativamente.
 *
 * ── Letras ──────────────────────────────────────────────────────────────────
 *
 * Usa as fontes de base que todos os leitores de PDF trazem (Helvetica e
 * Times), por isso nada é embebido e o ficheiro fica com poucos KB além do
 * logótipo. O texto vai em WinAnsi (Windows-1252), que cobre o português todo,
 * o € e os travessões. As larguras abaixo são as métricas AFM oficiais dessas
 * fontes e servem para alinhar à direita e partir linhas.
 *
 * Os títulos vão em Times, o mais próximo do Georgia que o site usa nos
 * títulos; o corpo vai em Helvetica. As cores vêm do `theme` do
 * content/home.json — as mesmas que alimentam css/01-tokens-agua.css.
 */

require_once __DIR__ . '/orcamentos.php';
require_once __DIR__ . '/home-core.php';

function mp_pdf_1252($texto)
{
    $texto = (string)$texto;
    $convertido = function_exists('iconv') ? @iconv('UTF-8', 'Windows-1252//TRANSLIT', $texto) : false;
    if ($convertido === false && function_exists('mb_convert_encoding')) {
        $convertido = mb_convert_encoding($texto, 'Windows-1252', 'UTF-8');
    }
    return $convertido === false ? preg_replace('/[^\x20-\x7E]/', '?', $texto) : $convertido;
}

function mp_pdf_larguras($lista)
{
    $larguras = array_fill(0, 32, 278);
    foreach (explode(',', $lista) as $valor) {
        $larguras[] = (int)$valor;
    }
    return $larguras;
}

final class MpPdf
{
    public $w = 595.28;
    public $h = 841.89;

    private $paginas = array();
    private $pagina = -1;
    private $imagens = array();
    private $fonte = 'helvetica';
    private $tamanho = 10;
    private static $metricas = null;

    // nome => [recurso, BaseFont, métricas]
    private static $fontes = array(
        'helvetica' => array('F1', 'Helvetica', 'helvetica'),
        'helvetica-negrito' => array('F2', 'Helvetica-Bold', 'helvetica-negrito'),
        'helvetica-italico' => array('F3', 'Helvetica-Oblique', 'helvetica'),
        'times-negrito' => array('F4', 'Times-Bold', 'times-negrito'),
        'times-italico' => array('F5', 'Times-Italic', 'times-italico'),
    );

    private static function metricas($nome)
    {
        if (self::$metricas === null) {
            // Caracteres 32 a 255 de cada fonte, em milésimos do corpo.
            self::$metricas = array(
                'helvetica' => mp_pdf_larguras(
                    '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,'
                    . '556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,'
                    . '1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,'
                    . '667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,'
                    . '333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,'
                    . '556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,'
                    . '556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,'
                    . '350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,'
                    . '278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,'
                    . '400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,'
                    . '667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,'
                    . '722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,'
                    . '556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,'
                    . '556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500'
                ),
                'helvetica-negrito' => mp_pdf_larguras(
                    '278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,'
                    . '556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,'
                    . '975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,'
                    . '667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,'
                    . '333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,'
                    . '611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,'
                    . '556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,'
                    . '350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,'
                    . '278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,'
                    . '400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,'
                    . '722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,'
                    . '722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,'
                    . '556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,'
                    . '611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556'
                ),
                'times-negrito' => mp_pdf_larguras(
                    '250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,'
                    . '500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,'
                    . '930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,'
                    . '611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,'
                    . '333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,'
                    . '556,556,444,389,333,556,500,722,500,500,444,394,220,394,520,350,'
                    . '500,350,333,500,500,1000,500,500,333,1000,556,333,1000,350,667,350,'
                    . '350,333,333,500,500,350,500,1000,333,1000,389,333,722,350,444,722,'
                    . '250,333,500,500,500,500,220,500,333,747,300,500,570,333,747,333,'
                    . '400,570,300,300,333,556,540,250,333,300,330,500,750,750,750,500,'
                    . '722,722,722,722,722,722,1000,722,667,667,667,667,389,389,389,389,'
                    . '722,722,778,778,778,778,778,570,778,722,722,722,722,722,611,556,'
                    . '500,500,500,500,500,500,722,444,444,444,444,444,278,278,278,278,'
                    . '500,556,500,500,500,500,500,570,500,556,556,556,556,500,556,500'
                ),
                'times-italico' => mp_pdf_larguras(
                    '250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,'
                    . '500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,'
                    . '920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,'
                    . '611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,'
                    . '333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,'
                    . '500,500,389,389,278,500,444,667,444,444,389,400,275,400,541,350,'
                    . '500,350,333,500,556,889,500,500,333,1000,500,333,944,350,556,350,'
                    . '350,333,333,556,556,350,500,889,333,980,389,333,667,350,389,556,'
                    . '250,389,500,500,500,500,275,500,333,760,276,500,675,333,760,333,'
                    . '400,675,300,300,333,500,523,250,333,300,310,500,750,750,750,500,'
                    . '611,611,611,611,611,611,889,667,611,611,611,611,333,333,333,333,'
                    . '722,667,722,722,722,722,722,675,722,722,722,722,722,556,611,500,'
                    . '500,500,500,500,500,500,667,444,444,444,444,444,278,278,278,278,'
                    . '500,500,500,500,500,500,500,675,500,500,500,500,500,444,500,444'
                ),
            );
        }
        return self::$metricas[self::$fontes[$nome][2]];
    }

    public function novaPagina()
    {
        $this->paginas[] = '';
        $this->pagina = count($this->paginas) - 1;
    }

    public function irPara($indice)
    {
        $this->pagina = (int)$indice;
    }

    public function numeroPaginas()
    {
        return count($this->paginas);
    }

    private function escrever($operacoes)
    {
        $this->paginas[$this->pagina] .= $operacoes . "\n";
    }

    public static function n($valor)
    {
        return rtrim(rtrim(sprintf('%.2F', $valor), '0'), '.');
    }

    private static function rgb($cor)
    {
        return self::n($cor[0] / 255) . ' ' . self::n($cor[1] / 255) . ' ' . self::n($cor[2] / 255);
    }

    public function fonte($nome, $tamanho)
    {
        $this->fonte = $nome;
        $this->tamanho = $tamanho;
    }

    public function cor($cor)
    {
        $this->escrever(self::rgb($cor) . ' rg');
    }

    public function traco($cor, $espessura)
    {
        $this->escrever(self::rgb($cor) . ' RG ' . self::n($espessura) . ' w');
    }

    /** Largura em pontos, com a fonte actual e um espaçamento extra entre letras. */
    public function largura($texto, $espaco = 0)
    {
        $bytes = mp_pdf_1252($texto);
        $metricas = self::metricas($this->fonte);
        $soma = 0;
        $n = strlen($bytes);
        for ($i = 0; $i < $n; $i++) {
            $soma += $metricas[ord($bytes[$i])];
        }
        return $soma * $this->tamanho / 1000 + max(0, $n - 1) * $espaco;
    }

    /** `y` é a linha de base, medida a partir do topo da página. */
    public function texto($x, $y, $texto, $alinhar = 'esquerda', $espaco = 0)
    {
        if ($alinhar === 'direita') {
            $x -= $this->largura($texto, $espaco);
        } elseif ($alinhar === 'centro') {
            $x -= $this->largura($texto, $espaco) / 2;
        }
        $bytes = str_replace(array('\\', '(', ')', "\r", "\n"), array('\\\\', '\\(', '\\)', '', ' '), mp_pdf_1252($texto));
        $this->escrever('BT /' . self::$fontes[$this->fonte][0] . ' ' . self::n($this->tamanho) . ' Tf '
            . self::n($espaco) . ' Tc ' . self::n($x) . ' ' . self::n($this->h - $y) . ' Td (' . $bytes . ') Tj ET');
    }

    /** Parte o texto em linhas que caibam na largura, respeitando as quebras que já tem. */
    public function partir($texto, $largura)
    {
        $linhas = array();
        foreach (explode("\n", str_replace("\r", '', (string)$texto)) as $paragrafo) {
            $actual = '';
            foreach (preg_split('/ +/', trim($paragrafo)) as $palavra) {
                $tentativa = $actual === '' ? $palavra : $actual . ' ' . $palavra;
                if ($this->largura($tentativa) <= $largura) {
                    $actual = $tentativa;
                    continue;
                }
                if ($actual !== '') {
                    $linhas[] = $actual;
                }
                // Uma palavra maior do que a coluna (um email, um IBAN) parte-se à letra.
                $actual = '';
                foreach (preg_split('//u', $palavra, -1, PREG_SPLIT_NO_EMPTY) as $letra) {
                    if ($actual !== '' && $this->largura($actual . $letra) > $largura) {
                        $linhas[] = $actual;
                        $actual = '';
                    }
                    $actual .= $letra;
                }
            }
            $linhas[] = $actual;
        }
        return $linhas;
    }

    /** Rectângulo; `operacao` f = preencher, S = contorno, B = os dois. */
    public function rect($x, $y, $w, $h, $operacao = 'f', $raio = 0)
    {
        $yb = $this->h - $y - $h;
        if ($raio <= 0) {
            $this->escrever(self::n($x) . ' ' . self::n($yb) . ' ' . self::n($w) . ' ' . self::n($h) . ' re ' . $operacao);
            return;
        }
        $r = min($raio, $w / 2, $h / 2);
        $k = 0.5523 * $r;
        $yt = $yb + $h;
        $p = function () {
            return implode(' ', array_map(array('MpPdf', 'n'), func_get_args()));
        };
        $this->escrever($p($x + $r, $yb) . ' m '
            . $p($x + $w - $r, $yb) . ' l '
            . $p($x + $w - $r + $k, $yb, $x + $w, $yb + $r - $k, $x + $w, $yb + $r) . ' c '
            . $p($x + $w, $yt - $r) . ' l '
            . $p($x + $w, $yt - $r + $k, $x + $w - $r + $k, $yt, $x + $w - $r, $yt) . ' c '
            . $p($x + $r, $yt) . ' l '
            . $p($x + $r - $k, $yt, $x, $yt - $r + $k, $x, $yt - $r) . ' c '
            . $p($x, $yb + $r) . ' l '
            . $p($x, $yb + $r - $k, $x + $r - $k, $yb, $x + $r, $yb) . ' c h ' . $operacao);
    }

    public function linha($x1, $y1, $x2, $y2)
    {
        $this->escrever(self::n($x1) . ' ' . self::n($this->h - $y1) . ' m ' . self::n($x2) . ' ' . self::n($this->h - $y2) . ' l S');
    }

    /** Desenha um JPEG. O mesmo `chave` reutiliza a imagem em todas as páginas. */
    public function jpeg($chave, $bytes, $x, $y, $w, $h)
    {
        $info = @getimagesizefromstring($bytes);
        if (!$info || $info[2] !== IMAGETYPE_JPEG) {
            return;
        }
        if (!isset($this->imagens[$chave])) {
            $this->imagens[$chave] = array(
                'nome' => 'Im' . (count($this->imagens) + 1),
                'w' => $info[0],
                'h' => $info[1],
                'cor' => isset($info['channels']) && $info['channels'] === 1 ? '/DeviceGray'
                    : (isset($info['channels']) && $info['channels'] === 4 ? '/DeviceCMYK' : '/DeviceRGB'),
                'dados' => $bytes,
            );
        }
        $this->escrever('q ' . self::n($w) . ' 0 0 ' . self::n($h) . ' ' . self::n($x) . ' ' . self::n($this->h - $y - $h)
            . ' cm /' . $this->imagens[$chave]['nome'] . ' Do Q');
    }

    private static function textoUtf16($texto)
    {
        $utf16 = function_exists('mb_convert_encoding') ? mb_convert_encoding((string)$texto, 'UTF-16BE', 'UTF-8') : (string)$texto;
        return '<FEFF' . strtoupper(bin2hex($utf16)) . '>';
    }

    public function documento($titulo)
    {
        $objectos = array();
        $novo = function ($conteudo) use (&$objectos) {
            $objectos[] = $conteudo;
            return count($objectos);
        };
        $comprimir = function ($dados) {
            if (function_exists('gzcompress')) {
                return array('/Filter /FlateDecode ', gzcompress($dados, 6));
            }
            return array('', $dados);
        };

        $catalogo = $novo(null);
        $arvore = $novo(null);

        $recursosFontes = '';
        foreach (self::$fontes as $fonte) {
            $id = $novo('<< /Type /Font /Subtype /Type1 /BaseFont /' . $fonte[1] . ' /Encoding /WinAnsiEncoding >>');
            $recursosFontes .= '/' . $fonte[0] . ' ' . $id . ' 0 R ';
        }
        $recursosImagens = '';
        foreach ($this->imagens as $imagem) {
            $id = $novo('<< /Type /XObject /Subtype /Image /Width ' . $imagem['w'] . ' /Height ' . $imagem['h']
                . ' /ColorSpace ' . $imagem['cor'] . ' /BitsPerComponent 8 /Filter /DCTDecode /Length '
                . strlen($imagem['dados']) . " >>\nstream\n" . $imagem['dados'] . "\nendstream");
            $recursosImagens .= '/' . $imagem['nome'] . ' ' . $id . ' 0 R ';
        }
        $recursos = '<< /Font << ' . $recursosFontes . '>>'
            . ($recursosImagens !== '' ? ' /XObject << ' . $recursosImagens . '>>' : '') . ' >>';

        $filhos = array();
        foreach ($this->paginas as $conteudo) {
            list($filtro, $dados) = $comprimir($conteudo);
            $stream = $novo('<< ' . $filtro . '/Length ' . strlen($dados) . " >>\nstream\n" . $dados . "\nendstream");
            $filhos[] = $novo('<< /Type /Page /Parent ' . $arvore . ' 0 R /MediaBox [0 0 ' . self::n($this->w) . ' '
                . self::n($this->h) . '] /Resources ' . $recursos . ' /Contents ' . $stream . ' 0 R >>') . ' 0 R';
        }
        $objectos[$catalogo - 1] = '<< /Type /Catalog /Pages ' . $arvore . ' 0 R >>';
        $objectos[$arvore - 1] = '<< /Type /Pages /Kids [' . implode(' ', $filhos) . '] /Count ' . count($filhos) . ' >>';
        $info = $novo('<< /Title ' . self::textoUtf16($titulo) . ' /Producer (Mia & Paper) /CreationDate (D:' . date('YmdHis') . ') >>');

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $posicoes = array();
        foreach ($objectos as $i => $conteudo) {
            $posicoes[] = strlen($pdf);
            $pdf .= ($i + 1) . " 0 obj\n" . $conteudo . "\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objectos) + 1) . "\n0000000000 65535 f \n";
        foreach ($posicoes as $posicao) {
            $pdf .= sprintf('%010d', $posicao) . " 00000 n \n";
        }
        $pdf .= 'trailer << /Size ' . (count($objectos) + 1) . ' /Root ' . $catalogo . ' 0 R /Info ' . $info
            . " 0 R >>\nstartxref\n" . $xref . "\n%%EOF\n";
        return $pdf;
    }
}

// ── O orçamento ──────────────────────────────────────────────────────────────

function orc_pdf_cor($hex, $omissao)
{
    $hex = ltrim((string)$hex, '#');
    if (!preg_match('/^[0-9a-f]{6}$/i', $hex)) {
        $hex = ltrim($omissao, '#');
    }
    return array(hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2)));
}

function orc_pdf_misturar($a, $b, $t)
{
    return array(
        (int)round($a[0] + ($b[0] - $a[0]) * $t),
        (int)round($a[1] + ($b[1] - $a[1]) * $t),
        (int)round($a[2] + ($b[2] - $a[2]) * $t),
    );
}

function orc_pdf_tema()
{
    list($home) = home_ler();
    $tema = is_array($home) && isset($home['theme']) && is_array($home['theme']) ? $home['theme'] : array();
    $ler = function ($chave, $omissao) use ($tema) {
        return orc_pdf_cor(isset($tema[$chave]) ? $tema[$chave] : '', $omissao);
    };
    $cores = array(
        'papel' => $ler('paper', '#fff8df'),
        'cartao' => $ler('card', '#fffdf5'),
        'linho' => $ler('linen', '#f6e7bf'),
        'musgo' => $ler('moss', '#72551e'),
        'tinta' => $ler('ink', '#2e2413'),
        'suave' => $ler('muted', '#7f6b42'),
        'ouro' => $ler('gold', '#d7aa36'),
        'ouroSuave' => $ler('goldSoft', '#f4dd91'),
        'branco' => array(255, 255, 255),
    );
    // O --line do site é o musgo a 22 % sobre o papel; aqui sobre branco.
    $cores['linha'] = orc_pdf_misturar($cores['branco'], array(142, 103, 31), 0.22);
    return $cores;
}

/** O logótipo reduzido para o PDF (o original tem 1080 px; 320 chegam e sobram). */
function orc_pdf_logo()
{
    $caminho = __DIR__ . '/../content/brand/logo.jpg';
    if (!is_file($caminho)) {
        return '';
    }
    $original = (string)file_get_contents($caminho);
    if (!function_exists('imagecreatefromstring') || !function_exists('imagejpeg')) {
        return $original;
    }
    $imagem = @imagecreatefromstring($original);
    if (!$imagem) {
        return $original;
    }
    $lado = 320;
    $reduzida = imagecreatetruecolor($lado, (int)round(imagesy($imagem) * $lado / imagesx($imagem)));
    imagecopyresampled($reduzida, $imagem, 0, 0, 0, 0, imagesx($reduzida), imagesy($reduzida), imagesx($imagem), imagesy($imagem));
    ob_start();
    imagejpeg($reduzida, null, 88);
    $bytes = (string)ob_get_clean();
    imagedestroy($imagem);
    imagedestroy($reduzida);
    return $bytes !== '' ? $bytes : $original;
}

function orc_pdf($orcamento, $definicoes)
{
    $c = orc_pdf_tema();
    $pdf = new MpPdf();
    $totais = orc_totais($orcamento, $definicoes);
    $empresa = $definicoes['empresa'];
    $cliente = $orcamento['cliente'];
    $numero = isset($orcamento['numero']) && $orcamento['numero'] !== '' ? $orcamento['numero'] : 'por atribuir';

    $margem = 50;
    $direita = $pdf->w - $margem;
    $largura = $direita - $margem;
    $fundo = $pdf->h - 60;
    $logo = orc_pdf_logo();

    // Colunas da tabela: descrição | quantidade | preço unitário | total.
    $colQtd = $margem + 300;
    $colUnit = $margem + 385;
    $larguraDescricao = 268;

    $kicker = function ($x, $y, $texto, $alinhar = 'esquerda') use ($pdf, $c) {
        $pdf->fonte('helvetica-negrito', 7);
        $pdf->cor($c['musgo']);
        $pdf->texto($x, $y, function_exists('mb_strtoupper') ? mb_strtoupper($texto, 'UTF-8') : strtoupper($texto), $alinhar, 1.4);
    };

    $cabecalhoTabela = function ($y) use ($pdf, $c, $margem, $largura, $direita, $colQtd, $colUnit, $kicker) {
        $pdf->cor($c['linho']);
        $pdf->rect($margem, $y, $largura, 24, 'f', 5);
        $kicker($margem + 12, $y + 15.5, 'Descrição');
        $kicker($colQtd, $y + 15.5, 'Qtd.', 'direita');
        $kicker($colUnit, $y + 15.5, 'Preço un.', 'direita');
        $kicker($direita - 12, $y + 15.5, 'Total', 'direita');
        return $y + 24;
    };

    // Página nova a meio do documento: um cabeçalho curto, para quem tem a
    // folha 2 na mão saber de que orçamento é.
    $continuar = function ($comTabela) use ($pdf, $c, $margem, $direita, $numero, $cabecalhoTabela) {
        $pdf->novaPagina();
        $pdf->fonte('times-negrito', 12);
        $pdf->cor($c['tinta']);
        $pdf->texto($margem, 52, 'Orçamento n.º ' . $numero);
        $pdf->fonte('helvetica-italico', 8.5);
        $pdf->cor($c['suave']);
        $pdf->texto($direita, 52, 'continuação', 'direita');
        $pdf->traco($c['ouro'], 1);
        $pdf->linha($margem, 62, $direita, 62);
        return $comTabela ? $cabecalhoTabela(78) : 82;
    };

    // ── Cabeçalho ──────────────────────────────────────────────────────────
    $pdf->novaPagina();
    $pdf->cor($c['papel']);
    $pdf->rect(0, 0, $pdf->w, 160);
    $pdf->traco($c['ouro'], 2);
    $pdf->linha(0, 160, $pdf->w, 160);

    if ($logo !== '') {
        $pdf->cor($c['branco']);
        $pdf->traco($c['ouroSuave'], 1);
        $pdf->rect($margem, 30, 104, 104, 'B', 10);
        $pdf->jpeg('logo', $logo, $margem + 5, 35, 94, 94);
    }

    $kicker($direita, 50, 'Orçamento', 'direita');
    $pdf->fonte('times-negrito', 28);
    $pdf->cor($c['tinta']);
    $pdf->texto($direita, 84, 'N.º ' . $numero, 'direita');
    $pdf->fonte('helvetica', 9);
    $pdf->cor($c['suave']);
    $pdf->texto($direita, 108, 'Data  ' . orc_data_pt($orcamento['data']), 'direita');
    if ($orcamento['validadeDias'] > 0) {
        $pdf->texto($direita, 122, 'Válido até  ' . orc_data_pt(orc_validade($orcamento)), 'direita');
    }

    // ── De / Para ──────────────────────────────────────────────────────────
    $bloco = function ($x, $y, $titulo, $nome, $linhas) use ($pdf, $c, $kicker) {
        $kicker($x, $y, $titulo);
        $y += 19;
        if ($nome !== '') {
            $pdf->fonte('times-negrito', 13.5);
            $pdf->cor($c['tinta']);
            foreach ($pdf->partir($nome, 225) as $parte) {
                $pdf->texto($x, $y, $parte);
                $y += 16;
            }
            $y += 1;
        }
        $pdf->fonte('helvetica', 8.8);
        $pdf->cor($c['suave']);
        foreach ($linhas as $linha) {
            if (trim($linha) === '') {
                continue;
            }
            foreach ($pdf->partir($linha, 225) as $parte) {
                $pdf->texto($x, $y, $parte);
                $y += 12.5;
            }
        }
        return $y;
    };

    $fimDe = $bloco($margem, 194, 'De', $empresa['nome'], array(
        $empresa['titular'],
        $empresa['morada'],
        $empresa['nif'] !== '' ? 'NIF ' . $empresa['nif'] : '',
        $empresa['email'],
        $empresa['telefone'],
        $empresa['site'],
    ));
    $nomeCliente = $cliente['nome'] !== '' ? $cliente['nome'] : $cliente['empresa'];
    $fimPara = $bloco($margem + 270, 194, 'Para', $nomeCliente, array(
        $cliente['nome'] !== '' ? $cliente['empresa'] : '',
        $cliente['morada'],
        $cliente['nif'] !== '' ? 'NIF ' . $cliente['nif'] : '',
        $cliente['email'],
        $cliente['telefone'],
    ));
    $y = max($fimDe, $fimPara) + 14;

    if ($orcamento['titulo'] !== '') {
        $pdf->fonte('times-italico', 16);
        $pdf->cor($c['tinta']);
        foreach ($pdf->partir($orcamento['titulo'], $largura) as $parte) {
            $y += 18;
            $pdf->texto($margem, $y, $parte);
        }
        $y += 16;
    }

    // ── Linhas ─────────────────────────────────────────────────────────────
    $y = $cabecalhoTabela($y);
    $nomesItens = array();
    foreach ($orcamento['linhas'] as $linha) {
        if ($linha['tipo'] === 'item') {
            $nomesItens[$linha['id']] = $linha['descricao'];
        }
    }

    foreach ($orcamento['linhas'] as $linha) {
        $desconto = $linha['tipo'] === 'desconto';
        $detalhe = $linha['detalhe'];
        if ($desconto && $detalhe === '' && $linha['modo'] === 'percent') {
            $alvo = $linha['alvo'] !== 'todos' && isset($nomesItens[$linha['alvo']]) ? $nomesItens[$linha['alvo']] : '';
            $base = $totais['basePorDesconto'][$linha['id']];
            $detalhe = rtrim(rtrim(number_format($linha['percentagem'], 2, ',', ''), '0'), ',') . ' % sobre '
                . ($alvo !== '' ? $alvo . ' (' . orc_euros($base) . ')' : orc_euros($base));
        }

        $pdf->fonte($desconto ? 'helvetica-italico' : 'helvetica-negrito', 9.5);
        $partesDescricao = $pdf->partir($linha['descricao'] !== '' ? $linha['descricao'] : ($desconto ? 'Desconto' : '—'), $larguraDescricao);
        $pdf->fonte('helvetica', 8.3);
        $partesDetalhe = $detalhe !== '' ? $pdf->partir($detalhe, $larguraDescricao) : array();
        $altura = 20 + count($partesDescricao) * 12.5 + count($partesDetalhe) * 11;

        if ($y + $altura > $fundo) {
            $y = $continuar(true);
        }
        if ($desconto) {
            $pdf->cor($c['cartao']);
            $pdf->rect($margem, $y + 0.4, $largura, $altura - 0.8);
        }

        $base = $y + 18;
        $pdf->fonte($desconto ? 'helvetica-italico' : 'helvetica-negrito', 9.5);
        $pdf->cor($desconto ? $c['musgo'] : $c['tinta']);
        $yy = $base;
        foreach ($partesDescricao as $parte) {
            $pdf->texto($margem + 12, $yy, $parte);
            $yy += 12.5;
        }
        $pdf->fonte('helvetica', 8.3);
        $pdf->cor($c['suave']);
        foreach ($partesDetalhe as $parte) {
            $pdf->texto($margem + 12, $yy - 1, $parte);
            $yy += 11;
        }

        $pdf->fonte('helvetica', 9.5);
        if ($desconto) {
            $pdf->cor($c['musgo']);
            if ($linha['modo'] === 'percent') {
                $pdf->texto($colUnit, $base, '– ' . rtrim(rtrim(number_format($linha['percentagem'], 2, ',', ''), '0'), ',') . ' %', 'direita');
            }
        } else {
            $pdf->cor($c['tinta']);
            $pdf->texto($colQtd, $base, orc_quantidade($linha['quantidade']), 'direita');
            $pdf->texto($colUnit, $base, orc_euros($linha['precoUnitCents']), 'direita');
        }
        $pdf->fonte($desconto ? 'helvetica' : 'helvetica-negrito', 9.5);
        $pdf->texto($direita - 12, $base, orc_euros($totais['porLinha'][$linha['id']]), 'direita');

        $y += $altura;
        $pdf->traco($c['linha'], 0.6);
        $pdf->linha($margem, $y, $direita, $y);
    }

    // ── Totais ─────────────────────────────────────────────────────────────
    $linhasTotais = array();
    if ($totais['descontosCents'] < 0) {
        $linhasTotais[] = array('Preço sem descontos', orc_euros($totais['itensCents']), false);
        $linhasTotais[] = array('Descontos', orc_euros($totais['descontosCents']), true);
    }
    if ($orcamento['portesCents'] > 0) {
        if ($totais['descontosCents'] < 0) {
            $linhasTotais[] = array('Subtotal', orc_euros($totais['subtotalCents']), false);
        }
        $linhasTotais[] = array($orcamento['portesDescricao'] !== '' ? $orcamento['portesDescricao'] : 'Portes', orc_euros($orcamento['portesCents']), false);
    }
    if ($definicoes['ivaModo'] === 'acrescido') {
        $linhasTotais[] = array('Base tributável', orc_euros($totais['subtotalCents'] + $totais['portesCents']), false);
        $linhasTotais[] = array('IVA ' . rtrim(rtrim(number_format($definicoes['ivaTaxa'], 2, ',', ''), '0'), ',') . ' %', orc_euros($totais['ivaCents']), false);
    }

    $alturaTotais = 16 + count($linhasTotais) * 17 + 46 + ($totais['descontosCents'] < 0 ? 20 : 0) + ($definicoes['ivaModo'] === 'incluido' || $definicoes['ivaModo'] === 'isento' ? 14 : 0);
    if ($y + $alturaTotais > $fundo) {
        $y = $continuar(false);
    }
    $xRotulo = $margem + 250;
    $y += 22;
    foreach ($linhasTotais as $linha) {
        $pdf->fonte('helvetica', 9.5);
        $pdf->cor($linha[2] ? $c['musgo'] : $c['suave']);
        $pdf->texto($xRotulo, $y, $linha[0]);
        $pdf->cor($linha[2] ? $c['musgo'] : $c['tinta']);
        $pdf->texto($direita - 12, $y, $linha[1], 'direita');
        $y += 17;
    }

    $pdf->cor($c['ouroSuave']);
    $pdf->rect($xRotulo - 12, $y - 6, $direita - $xRotulo + 12, 38, 'f', 6);
    $pdf->fonte('times-negrito', 14);
    $pdf->cor($c['tinta']);
    $pdf->texto($xRotulo, $y + 18, 'Total');
    $pdf->fonte('times-negrito', 18);
    $pdf->texto($direita - 12, $y + 19, orc_euros($totais['totalCents']), 'direita');
    $y += 46;

    $pdf->fonte('helvetica-italico', 8.5);
    if ($definicoes['ivaModo'] === 'incluido') {
        $pdf->cor($c['suave']);
        $pdf->texto($direita - 12, $y, 'Inclui IVA à taxa de ' . rtrim(rtrim(number_format($definicoes['ivaTaxa'], 2, ',', ''), '0'), ',')
            . ' %: ' . orc_euros($totais['ivaCents']), 'direita');
        $y += 14;
    }
    if ($totais['descontosCents'] < 0 && $totais['itensCents'] > 0) {
        $percentagem = (int)round(-$totais['descontosCents'] * 100 / $totais['itensCents']);
        $pdf->cor($c['musgo']);
        $pdf->texto($direita - 12, $y, 'Poupa ' . orc_euros(-$totais['descontosCents']) . ' (' . $percentagem . ' %) face ao preço sem descontos.', 'direita');
        $y += 14;
    }
    if ($definicoes['ivaModo'] === 'isento' && $definicoes['mencaoIsencao'] !== '') {
        $pdf->cor($c['suave']);
        $pdf->texto($direita - 12, $y, $definicoes['mencaoIsencao'], 'direita');
        $y += 14;
    }
    $y += 6;

    // ── Notas e pagamento ──────────────────────────────────────────────────
    $seccoes = array();
    $notas = $orcamento['notas'] !== '' ? $orcamento['notas'] : $definicoes['notasPadrao'];
    if ($notas !== '') {
        $seccoes[] = array('Notas', $notas);
    }
    if ($empresa['iban'] !== '') {
        $seccoes[] = array('Pagamento', 'Transferência bancária para o IBAN ' . $empresa['iban']
            . ($empresa['titular'] !== '' ? ' (' . $empresa['titular'] . ')' : '') . '.');
    }

    $y += 8;
    foreach ($seccoes as $seccao) {
        $pdf->fonte('helvetica', 8.8);
        $partes = $pdf->partir($seccao[1], $largura);
        if ($y + 30 > $fundo) {
            $y = $continuar(false);
        }
        $kicker($margem, $y + 8, $seccao[0]);
        $y += 23;
        foreach ($partes as $parte) {
            if ($y > $fundo) {
                $y = $continuar(false);
            }
            $pdf->fonte('helvetica', 8.8);
            $pdf->cor($c['tinta']);
            $pdf->texto($margem, $y, $parte);
            $y += 12.5;
        }
        $y += 6;
    }

    // ── Rodapé em todas as páginas ─────────────────────────────────────────
    $rodape = $definicoes['rodape'] !== '' ? $definicoes['rodape']
        : implode('  ·  ', array_filter(array($empresa['nome'], $empresa['site'], $empresa['email'], $empresa['telefone'])));
    $total = $pdf->numeroPaginas();
    for ($i = 0; $i < $total; $i++) {
        $pdf->irPara($i);
        $pdf->traco($c['linha'], 0.6);
        $pdf->linha($margem, $pdf->h - 46, $direita, $pdf->h - 46);
        $pdf->fonte('helvetica', 7.5);
        $pdf->cor($c['suave']);
        $pdf->texto($margem, $pdf->h - 32, $rodape);
        $pdf->texto($direita, $pdf->h - 32, 'Página ' . ($i + 1) . ' de ' . $total, 'direita');
    }

    return $pdf->documento('Orçamento ' . $numero . ($nomeCliente !== '' ? ' · ' . $nomeCliente : ''));
}

/** Nome de ficheiro só com ASCII: Orcamento-2026-001-Ana-Silva.pdf */
function orc_pdf_nome($orcamento)
{
    $cliente = $orcamento['cliente']['nome'] !== '' ? $orcamento['cliente']['nome'] : $orcamento['cliente']['empresa'];
    $ascii = function_exists('iconv') ? (string)@iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $cliente) : $cliente;
    $ascii = trim((string)preg_replace('/[^A-Za-z0-9]+/', '-', $ascii), '-');
    $numero = isset($orcamento['numero']) && $orcamento['numero'] !== '' ? $orcamento['numero'] : 'rascunho';
    return 'Orcamento-' . $numero . ($ascii !== '' ? '-' . substr($ascii, 0, 40) : '') . '.pdf';
}
