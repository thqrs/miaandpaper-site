<?php
// ENCOMENDAS_EXCEL_V1 — reimplementação web do livro Excel de encomendas.
//
// Origem: mia-and-paper-encomendas-final-corrigido_v2_reimplementar.xlsm
// (folhas Encomendas + Dados (não mexer)), extraído em 2026-09-23.
//
// Âmbito: ferramenta interna de balcão — Passo 0 (nova/carregar), Passo 1
// (cliente + data), Passos 2–5 (até 3 produtos com 18 campos cada), Passo 6
// (pagamento, entrega e total) e GUARDAR. Independente do resto do site: os
// catálogos, escalões, designs e fórmulas vêm embutidos em $EXCEL_DATA
// (não lê content/*.json nem pricing.json). As folhas Clientes, Registos e
// Pendentes do Excel não são replicadas aqui: os registos guardados vivem
// em private/encomendas-excel-registos.json e a lista de clientes é uma
// ajuda ao preenchimento, não uma base de dados.
//
// Divergências assumidas face ao VBA original:
//   - GUARDAR é um botão (o Excel usa duplo clique na célula B92);
//   - guardar uma encomenda carregada actualiza o registo em vez de
//     acrescentar sempre linhas novas no fim;
//   - começa com zero registos (o Excel traz o histórico preservado);
//   - sem folha Pendentes automática (fica para uma v2 se for precisa).
//
// Protecção: mesmo guard de sessão das páginas de admin (admin-open.php).
// Escritas (guardar) exigem CSRF da sessão.

require_once __DIR__ . '/admin-open.php';   // ADMIN_OPEN_DEV_V1: sem password até ao deploy

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Encomendas Excel</title>'
        . '<style>body{font-family:Georgia,serif;max-width:560px;margin:60px auto;padding:0 20px;color:#3b2f1f;}h1{font-size:1.4rem;}a{color:#4f7a3a;font-weight:700;}</style>'
        . '<h1>Acesso restrito.</h1>'
        . '<p>Inicia sessão como administradora a partir de <a href="index.html">index.html</a> e regressa a esta página.</p>';
    exit;
}

require_once __DIR__ . '/lib/private-paths.php';
require_once __DIR__ . '/lib/parametros.php';   // PARAMETROS_V1: ?action= e ?encomenda= declarados uma vez
require_once __DIR__ . '/lib/precos-core.php';   // motor de preços partilhado (só leitura: tabelas flat/tier)

$csrf = mp_admin_csrf_token();

// Leitura dos parâmetros declarados em lib/parametros.php.
$ex_action = isset($_GET['action']) ? (string)$_GET['action'] : '';
$ex_encomenda_param = isset($_GET['encomenda']) ? trim((string)$_GET['encomenda']) : '';
if (strlen($ex_encomenda_param) > 16) { $ex_encomenda_param = substr($ex_encomenda_param, 0, 16); }

// ── Dados de referência embutidos (extração do XLSM; ver nota no topo). ──
$EXCEL_DATA = json_decode(<<<'EXCELJSON'
{"produtos":[["Pasta A4",34.9,"pasta","pastas"],["Pasta A6",19.9,"pasta","pastas"],["Pack Pastas A4+A6",49.9,"pack_pastas","pastas"],["Crachás — 25 mm",1.5,"tier","crachas"],["Crachás — 32 mm",1.75,"tier","crachas"],["Crachás — 58 mm",2,"tier","crachas"],["Porta-chaves — 32 mm",2.25,"tier","porta_chaves"],["Porta-chaves — 58 mm",2.5,"tier","porta_chaves"],["Ímanes — Achatados",10,"tier","imanes"],["Ímanes — 3 mm",2.5,"tier","imanes"],["Ímanes recortados",13,"tier","imanes_rec"],["Mini-cadernos",4.5,"tier","mini_cadernos"],["Bloco Argolas A6",9,"tier","blocos_a6"],["Bloquinhos",4.5,"tier","bloquinhos"],["Stickers",0.5,"unit","stickers"],["Marcadores",1.5,"tier","marcadores"],["Marcadores magnéticos",1.5,"unit","marcadores_mag"],["Agendas — Agenda Normal",29.9,"agenda","agendas"],["Agendas — Agenda Pioneiro",34.9,"agenda","agendas"],["Agendas — Pack Normal",37.9,"agenda","agendas"],["Agendas — Pack Pioneiro",42.9,"agenda","agendas"],["Cadernos anuais — Caderno Normal",29.9,"agenda","cadernos"],["Cadernos anuais — Caderno Pioneiro",34.9,"agenda","cadernos"],["Cadernos anuais — Pack Normal",37.9,"agenda","cadernos"],["Cadernos anuais — Pack Pioneiro",42.9,"agenda","cadernos"],["Molduras personalizadas — Foto e Flores 3D",45,"moldura","molduras"],["Molduras personalizadas — Moldura para Bebé",45,"moldura","molduras"],["Molduras personalizadas — Coração de Flores",45,"moldura","molduras"],["Molduras personalizadas — O Amor Nunca Acaba",45,"moldura","molduras"],["Molduras personalizadas — Jardim de Flores",45,"moldura","molduras"],["Molduras personalizadas — Silhueta Personalizada",45,"moldura","molduras"]],"acabamentos":["Matte","Glossy","Holográfico Estrelinhas","Holográfico Pontinhos","Holográfico Triângulos"],"simnao":["Não","Sim"],"estados":["Por fazer","Em produção","Terminado"],"entrega":[["Envio CTT - até 2 Kg",5.4],["Entrega em mão",0],["Vou recolher na casa da Mia",0],["Entregamos-te pessoalmente - Apenas Quinta do Conde, Azeitão e Fernão Ferro",0],["Junta as minhas encomendas",0],["Outro",0]],"tiers":[["Crachás — 25 mm",1,1.5],["Crachás — 25 mm",3,4.36],["Crachás — 25 mm",5,7.12],["Crachás — 25 mm",10,13.5],["Crachás — 25 mm",24,30.6],["Crachás — 25 mm",48,57.6],["Crachás — 25 mm",96,115.2],["Crachás — 32 mm",1,1.75],["Crachás — 32 mm",3,5.09],["Crachás — 32 mm",5,8.31],["Crachás — 32 mm",10,15.75],["Crachás — 32 mm",24,35.7],["Crachás — 32 mm",48,67.2],["Crachás — 32 mm",96,134.4],["Crachás — 58 mm",1,2],["Crachás — 58 mm",3,5.82],["Crachás — 58 mm",5,9.5],["Crachás — 58 mm",10,18],["Crachás — 58 mm",24,40.8],["Crachás — 58 mm",48,76.8],["Crachás — 58 mm",96,153.6],["Porta-chaves — 32 mm",1,2.25],["Porta-chaves — 32 mm",3,6.59],["Porta-chaves — 32 mm",5,10.81],["Porta-chaves — 32 mm",10,20.75],["Porta-chaves — 32 mm",24,47.7],["Porta-chaves — 32 mm",48,91.2],["Porta-chaves — 32 mm",96,182.4],["Porta-chaves — 58 mm",1,2.5],["Porta-chaves — 58 mm",3,7.32],["Porta-chaves — 58 mm",5,12],["Porta-chaves — 58 mm",10,23],["Porta-chaves — 58 mm",24,52.8],["Porta-chaves — 58 mm",48,100.8],["Porta-chaves — 58 mm",96,201.6],["Ímanes — Achatados",15,10],["Ímanes — Achatados",30,19],["Ímanes — Achatados",60,36],["Ímanes — Achatados",105,59.5],["Ímanes — 3 mm",1,2.5],["Ímanes — 3 mm",3,7.28],["Ímanes — 3 mm",5,11.88],["Ímanes — 3 mm",10,23],["Ímanes — 3 mm",24,54],["Ímanes — 3 mm",30,67.5],["Ímanes — 3 mm",48,102],["Ímanes — 3 mm",60,127.5],["Ímanes recortados",12,13],["Ímanes recortados",24,24.7],["Ímanes recortados",36,35.1],["Ímanes recortados",48,46.8],["Ímanes recortados",60,55.25],["Ímanes recortados",96,83.2],["Mini-cadernos",1,4.5],["Mini-cadernos",3,13.1],["Mini-cadernos",5,21.38],["Mini-cadernos",10,41.4],["Mini-cadernos",24,95.04],["Mini-cadernos",48,183.6],["Mini-cadernos",96,367.2],["Bloco Argolas A6",1,9],["Bloco Argolas A6",3,26.19],["Bloco Argolas A6",5,42.75],["Bloco Argolas A6",10,82.8],["Bloco Argolas A6",24,190.08],["Bloco Argolas A6",48,367.2],["Bloco Argolas A6",96,734.4],["Bloquinhos",1,4.5],["Bloquinhos",3,13.1],["Bloquinhos",5,21.38],["Bloquinhos",10,40.5],["Bloquinhos",24,91.8],["Bloquinhos",48,172.8],["Bloquinhos",96,345.6],["Marcadores",1,1.5],["Marcadores",5,7.28],["Marcadores",10,14.25],["Marcadores",20,28.5],["Marcadores",25,33.75],["Marcadores",40,51],["Marcadores",75,90]],"produtos_cfg":[["Pasta A4","flat",1,"Pasta A4","pasta","Pastas","DG_A4","Nome / capa",2],["Pasta A6","flat",1,"Pasta A6","pasta","Pastas","DG_A6","Cantos / pasta",2],["Pack Pastas A4+A6","flat",1,"Pasta A4","pack_pastas","Pastas","DG_A4","Arte / ficheiro",3],["Crachás — 25 mm","tier",1,"crachas-loja","tier","Confirmar configuração","DG_Crachas","Capa dura",4],["Crachás — 32 mm","tier",1,"crachas-loja","tier","Confirmar configuração","DG_Crachas","Holográfico marcador",0.15],["Crachás — 58 mm","tier",1,"crachas-loja","tier","Confirmar configuração","DG_Crachas","Frente/verso marcador",0.15],["Porta-chaves — 32 mm","tier",1,"porta-chaves","tier","Confirmar configuração","DG_Chaves","Furo no marcador",0.25],["Porta-chaves — 58 mm","tier",1,"porta-chaves","tier","Confirmar configuração","DG_Chaves","Margem marcador",0.2],["Ímanes — Achatados","tier",15,"imanes-loja","tier","Confirmar configuração","DG_Imanes",null,null],["Ímanes — 3 mm","tier",1,"imanes-loja","tier","Confirmar configuração","DG_Imanes","Capa mole","Fita dourada"],["Ímanes recortados","tier",12,"imanes-recortados","tier","Confirmar configuração","DG_Recortados","Capa dura","Fita rosa"],["Mini-cadernos","tier",1,"mini-cadernos","tier","Confirmar configuração","DG_Mini",null,"Fita castanha"],["Bloco Argolas A6","tier",1,"blocos-a6","tier","Confirmar configuração","DG_Blocos",null,null],["Bloquinhos","tier",1,"bloquinhos","tier","Confirmar configuração","DG_Bloquinhos",null,null],["Stickers","flat",1,"stickers","unit","Confirmar configuração","DG_Stickers",null,null],["Marcadores","tier",1,"marcadores","tier","Confirmar configuração","DG_Marcadores",null,null],["Marcadores magnéticos","flat",1,"marcadores-magneticos","tier","Confirmar configuração","DG_Magneticos",null,null],["Agendas — Agenda Normal","flat",1,"agendas","agenda","Confirmar configuração","DG_Agendas",null,null],["Agendas — Agenda Pioneiro","flat",1,"agendas","agenda","Confirmar configuração","DG_Agendas",null,null],["Agendas — Pack Normal","flat",1,"agendas","agenda","Confirmar configuração","DG_Agendas",null,null],["Agendas — Pack Pioneiro","flat",1,"agendas","agenda","Confirmar configuração","DG_Agendas",null,null],["Cadernos anuais — Caderno Normal","flat",1,"cadernos-anuais","agenda","Confirmar configuração","DG_Cadernos",null,null],["Cadernos anuais — Caderno Pioneiro","flat",1,"cadernos-anuais","agenda","Confirmar configuração","DG_Cadernos",null,null],["Cadernos anuais — Pack Normal","flat",1,"cadernos-anuais","agenda","Confirmar configuração","DG_Cadernos",null,null],["Cadernos anuais — Pack Pioneiro","flat",1,"cadernos-anuais","agenda","Confirmar configuração","DG_Cadernos",null,null],["Molduras personalizadas — Foto e Flores 3D","flat",1,"quadros","moldura","Confirmar configuração","DG_Molduras",null,null],["Molduras personalizadas — Moldura para Bebé","flat",1,"quadros","moldura","Confirmar configuração","DG_Molduras",null,null],["Molduras personalizadas — Coração de Flores","flat",1,"quadros","moldura","Confirmar configuração","DG_Molduras",null,null],["Molduras personalizadas — O Amor Nunca Acaba","flat",1,"quadros","moldura","Confirmar configuração","DG_Molduras",null,null],["Molduras personalizadas — Jardim de Flores","flat",1,"quadros","moldura","Confirmar configuração","DG_Molduras",null,null],["Molduras personalizadas — Silhueta Personalizada","flat",1,"quadros","moldura","Confirmar configuração","DG_Molduras",null,null]],"dg":{"DG_A4":["Design 01 [A4]","Design 02 [A4]","Design 03 [A4]","Design 04 [A4]","Design 05 [A4]","Design 06 [A4]","Design 07 [A4]","Design 08 [A4]","Design 09 [A4]","Design 10 [A4]","Design 11 [A4]","Design 12 [A4]","Design 13 [A4]"],"DG_A6":["Design 01 [A6]","Design 02 [A6]","Design 03 [A6]","Design 04 [A6]","Design 05 [A6]","Design 06 [A6]","Design 07 [A6]","Design 08 [A6]","Design 09 [A6]","Design 10 [A6]","Design 11 [A6]","Design 12 [A6]","Design 13 [A6]"],"DG_Agendas":["Agenda 01","Agenda 02","Agenda 03","Agenda 04","Agenda 05","Agenda 06","Agenda 07","Agenda 08","Agenda 09","Agenda 10","Agenda 11","Agenda 12","Agenda 13","Agenda 14","Agenda 15","Agenda 16","Sortido"],"DG_Blocos":["Mini-Caderno 06","Mini-Caderno 07","Mini-Caderno 08","Mini-Caderno 09","Mini-Caderno 10","Mini-Caderno 11","Mini-Caderno 01","Mini-Caderno 02","Mini-Caderno 03","Mini-Caderno 04","Mini-Caderno 05","Sortido"],"DG_Bloquinhos":["Bloquinho 01","Bloquinho 02","Bloquinho 03","Bloquinho 04","Bloquinho 05","Bloquinho 06","Sortido"],"DG_Cadernos":["Caderno 10","Caderno 11","Caderno 12","Caderno 13","Caderno 14","Caderno 15","Caderno 16","Caderno 01","Caderno 02","Caderno 03","Caderno 04","Caderno 05","Caderno 06","Caderno 07","Caderno 08","Caderno 09","Sortido"],"DG_Crachas":["Braille Com Relevo","Esperança 01","Esperança 02","Esperança 03","Esperança 04","Língua Gestual 01","Língua Gestual 02","Felicidade 01","Crachá 02","Felicidade 02","Felicidade 03","Felicidade 04","Crachá 06","Crachá 07","Crachá 08","Crachá 09","Felicidade 05","Crachá 11","Crachá 12","Felicidade 06","Felicidade 07","Crachá 15","Felicidade 08","Crachá 17","Felicidade 09","Felicidade 10","Felicidade 11","Crachá 21","Crachá 22","Crachá 23","Crachá 24","Crachá 25","Sortido"],"DG_Imanes":["Esperança 01","Esperança 02","Esperança 03","Esperança 04","Esperança 05","Esperança 06","Íman 01","Íman 02","Íman 03","Íman 04","Íman 05","Íman 06","Sortido"],"DG_Recortados":["Recortado 01","Recortado 02","Recortado 03","Recortado 04","Recortado 05","Recortado 06","Sortido"],"DG_Magneticos":["Marcador magnético 01","Marcador magnético 02","Marcador magnético 03","Marcador magnético 04","Marcador magnético 05","Marcador magnético 06","Sortido"],"DG_Marcadores":["Marcador 01","Marcador 02","Marcador 03","Marcador 04","Marcador 05","Marcador 06","Sortido"],"DG_Mini":["Mini-Caderno 06","Mini-Caderno 07","Mini-Caderno 08","Mini-Caderno 09","Mini-Caderno 10","Mini-Caderno 11","Mini-Caderno 01","Mini-Caderno 02","Mini-Caderno 03","Mini-Caderno 04","Mini-Caderno 05","Sortido"],"DG_Chaves":["Braille Com Relevo","Esperança 01","Esperança 02","Esperança 03","Esperança 04","Língua Gestual 01","Língua Gestual 02","Felicidade 01","Crachá 02","Felicidade 02","Felicidade 03","Felicidade 04","Crachá 06","Crachá 07","Crachá 08","Crachá 09","Felicidade 05","Crachá 11","Crachá 12","Felicidade 06","Felicidade 07","Crachá 15","Felicidade 08","Crachá 17","Felicidade 09","Felicidade 10","Felicidade 11","Crachá 21","Crachá 22","Crachá 23","Crachá 24","Crachá 25","Sortido"],"DG_Molduras":["Foto e Flores 3D","Moldura para Bebé","Coração de Flores","O Amor Nunca Acaba","Jardim de Flores","Silhueta Personalizada em Vinil","Super Personalizado","Sortido"],"DG_Stickers":["Sticker 01","Sticker 02","Sticker 03","Sticker 04","Sticker 05","Sticker 06","Sortido"]},"fita_base":["Fita dourada","Fita rosa","Fita castanha"],"tipos_capa":["Capa mole","Capa dura"],"extras_labels":{"AG3":2,"AG4":2,"AG5":3,"AG6":4,"AG7":0.15,"AG8":0.15,"AG9":0.25,"AG10":0.2},"AF":[null,"Extra","Nome / capa","Cantos / pasta","Arte / ficheiro","Capa dura","Holográfico marcador","Frente/verso marcador","Furo no marcador","Margem marcador",null,"Capa mole","Capa dura",null,null],"clientes":["Albertina Oliveira","Ana nogueira","Ana Sousa","Bernicia Fernandes (Aymenes)","Bárbara Santos","Carolina Carneiro","Céu Dias","Daiane Matos","Dionisia","Dionisia Fialho","Déborah Acácio","Déborah Tarcha","Elisabete Gomes","Fernanda Caixeirinho","Fernanda Malveiro","Fátima Campos","Herémita Rúpio","Irmã da Congregação albertina","Isabel Roberto","Ivone ferreira","Josué da Madeira","Josué Pinto Madeira","Jéssica Oliveira","Júrcica Issenguel","Leonor","Leonor Amaro","Luz","Lígia Neves","Lígia Rodrigues","Manuel Nascimento","Manuela Roberto","Marcelo Ribeiro","Marco Roberto","Marcos Teixeira","Maria José","Marinela Martins","Mia Henriques","Milena","Milena Velinova","Nadine","Nazaré","Noemi Martins","Prima Carla","Prima Carla Silva","Prima Mafalda","Raquel Cameira","Ricardo pais","rolanda Aurélio","Rosa Machado","Rute Cascalho","Rute Martins","Samuel Rocha","Sofia Rocha","Susana Gonçalves","Sérgio Vieira","Sílvia Carvalho","Sílvia Mendes","Tia Vânia","Tiago Graça Henriques","Vanda Ferreira","Vania Sousa","Violante","Zeza B."],"design_lookup":[["Pasta A4|Design 01 [A4]","Design 01 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/quao-lindos-sao-os-pes-original.webp"],["Pasta A4|Design 02 [A4]","Design 02 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/biblia-cinzenta-original.webp"],["Pasta A4|Design 03 [A4]","Design 03 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/bicicleta-rosa-original.webp"],["Pasta A4|Design 04 [A4]","Design 04 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/declara-boas-novas-original.webp"],["Pasta A4|Design 05 [A4]","Design 05 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/caminho-original.webp"],["Pasta A4|Design 06 [A4]","Design 06 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/mala-sapatos-chapeu-original.webp"],["Pasta A4|Design 07 [A4]","Design 07 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/quao-lindos-sao-os-pes-declarar-boas-novas-original.webp"],["Pasta A4|Design 08 [A4]","Design 08 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/bicicleta-verde-original.webp"],["Pasta A4|Design 09 [A4]","Design 09 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/flores-roxas-original.webp"],["Pasta A4|Design 10 [A4]","Design 10 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/flores-original.webp"],["Pasta A4|Design 11 [A4]","Design 11 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/papoilas-original.webp"],["Pasta A4|Design 12 [A4]","Design 12 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/mala-rosa-original.webp"],["Pasta A4|Design 13 [A4]","Design 13 [A4]","Pasta A4","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a4/campo-flores-original.webp"],["Pasta A6|Design 01 [A6]","Design 01 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/quao-lindos-sao-os-pes-original.webp"],["Pasta A6|Design 02 [A6]","Design 02 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/biblia-cinzenta-original.webp"],["Pasta A6|Design 03 [A6]","Design 03 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/bicicleta-rosa-original.webp"],["Pasta A6|Design 04 [A6]","Design 04 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/declara-boas-novas-original.webp"],["Pasta A6|Design 05 [A6]","Design 05 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/caminho-original.webp"],["Pasta A6|Design 06 [A6]","Design 06 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/mala-sapatos-chapeu-original.webp"],["Pasta A6|Design 07 [A6]","Design 07 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/quao-lindos-sao-os-pes-declarar-boas-novas-original.webp"],["Pasta A6|Design 08 [A6]","Design 08 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/bicicleta-verde-original.webp"],["Pasta A6|Design 09 [A6]","Design 09 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/flores-roxas-original.webp"],["Pasta A6|Design 10 [A6]","Design 10 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/flores-original.webp"],["Pasta A6|Design 11 [A6]","Design 11 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/papoilas-original.webp"],["Pasta A6|Design 12 [A6]","Design 12 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/mala-rosa-original.webp"],["Pasta A6|Design 13 [A6]","Design 13 [A6]","Pasta A6","https://miaandpaper.com/content/designs/loja/pasta-de-folhetos/oficiais/finais/a6/campo-flores-original.webp"],["agendas|Agenda 01","Agenda 01","agendas","https://miaandpaper.com/"],["agendas|Agenda 02","Agenda 02","agendas","https://miaandpaper.com/"],["agendas|Agenda 03","Agenda 03","agendas","https://miaandpaper.com/"],["agendas|Agenda 04","Agenda 04","agendas","https://miaandpaper.com/"],["agendas|Agenda 05","Agenda 05","agendas","https://miaandpaper.com/"],["agendas|Agenda 06","Agenda 06","agendas","https://miaandpaper.com/"],["agendas|Agenda 07","Agenda 07","agendas","https://miaandpaper.com/"],["agendas|Agenda 08","Agenda 08","agendas","https://miaandpaper.com/"],["agendas|Agenda 09","Agenda 09","agendas","https://miaandpaper.com/"],["agendas|Agenda 10","Agenda 10","agendas","https://miaandpaper.com/"],["agendas|Agenda 11","Agenda 11","agendas","https://miaandpaper.com/"],["agendas|Agenda 12","Agenda 12","agendas","https://miaandpaper.com/"],["agendas|Agenda 13","Agenda 13","agendas","https://miaandpaper.com/"],["agendas|Agenda 14","Agenda 14","agendas","https://miaandpaper.com/"],["agendas|Agenda 15","Agenda 15","agendas","https://miaandpaper.com/"],["agendas|Agenda 16","Agenda 16","agendas","https://miaandpaper.com/"],["agendas|Sortido","Sortido","agendas","https://miaandpaper.com/catalogo/"],["blocos-a6|Mini-Caderno 06","Mini-Caderno 06","blocos-a6","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/a_jovem_cadeira_minicaderno.webp"],["blocos-a6|Mini-Caderno 07","Mini-Caderno 07","blocos-a6","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/o_jovem_cadeira_minicaderno.webp"],["blocos-a6|Mini-Caderno 08","Mini-Caderno 08","blocos-a6","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/idosa_jovem_minicaderno.webp"],["blocos-a6|Mini-Caderno 09","Mini-Caderno 09","blocos-a6","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/idoso_jovem_minicaderno.webp"],["blocos-a6|Mini-Caderno 10","Mini-Caderno 10","blocos-a6","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/reencontro_minicaderno.webp"],["blocos-a6|Mini-Caderno 11","Mini-Caderno 11","blocos-a6","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/vestido_verde_minicaderno.webp"],["blocos-a6|Mini-Caderno 01","Mini-Caderno 01","blocos-a6","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/1000133037.webp"],["blocos-a6|Mini-Caderno 02","Mini-Caderno 02","blocos-a6","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/1000133040.webp"],["blocos-a6|Mini-Caderno 03","Mini-Caderno 03","blocos-a6","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/1000133041.webp"],["blocos-a6|Mini-Caderno 04","Mini-Caderno 04","blocos-a6","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/1000133042.webp"],["blocos-a6|Mini-Caderno 05","Mini-Caderno 05","blocos-a6","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/1000133043.webp"],["blocos-a6|Sortido","Sortido","blocos-a6","https://miaandpaper.com/catalogo/"],["bloquinhos|Bloquinho 01","Bloquinho 01","bloquinhos","https://miaandpaper.com/"],["bloquinhos|Bloquinho 02","Bloquinho 02","bloquinhos","https://miaandpaper.com/"],["bloquinhos|Bloquinho 03","Bloquinho 03","bloquinhos","https://miaandpaper.com/"],["bloquinhos|Bloquinho 04","Bloquinho 04","bloquinhos","https://miaandpaper.com/"],["bloquinhos|Bloquinho 05","Bloquinho 05","bloquinhos","https://miaandpaper.com/"],["bloquinhos|Bloquinho 06","Bloquinho 06","bloquinhos","https://miaandpaper.com/"],["bloquinhos|Sortido","Sortido","bloquinhos","https://miaandpaper.com/catalogo/"],["cadernos-anuais|Caderno 10","Caderno 10","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/novos/a_jovem_cadeira/a_jovem_cadeira_matte.webp"],["cadernos-anuais|Caderno 11","Caderno 11","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/novos/o_jovem_cadeira/o_jovem_cadeira_matte.webp"],["cadernos-anuais|Caderno 12","Caderno 12","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/novos/idosa_jovem/idosa_jovem_matte.webp"],["cadernos-anuais|Caderno 13","Caderno 13","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/novos/idoso_jovem/idoso_jovem_matte.webp"],["cadernos-anuais|Caderno 14","Caderno 14","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/novos/reencontro/reencontro_matte.webp"],["cadernos-anuais|Caderno 15","Caderno 15","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/novos/vestido_verde/vestido_verde_matte.webp"],["cadernos-anuais|Caderno 16","Caderno 16","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/novos/cornfield/cornfield_matte.webp"],["cadernos-anuais|Caderno 01","Caderno 01","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/process/cadernos (1)/img (27).webp"],["cadernos-anuais|Caderno 02","Caderno 02","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/process/cadernos (2)/img (21).webp"],["cadernos-anuais|Caderno 03","Caderno 03","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/process/cadernos (3)/img (22).webp"],["cadernos-anuais|Caderno 04","Caderno 04","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/process/cadernos (4)/img (28).webp"],["cadernos-anuais|Caderno 05","Caderno 05","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/process/cadernos (5)/img (26).webp"],["cadernos-anuais|Caderno 06","Caderno 06","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/process/cadernos (6)/1778703273549_reduced_q95.webp"],["cadernos-anuais|Caderno 07","Caderno 07","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/process/cadernos (7)/img (12).webp"],["cadernos-anuais|Caderno 08","Caderno 08","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/process/cadernos (8)/img (19).webp"],["cadernos-anuais|Caderno 09","Caderno 09","cadernos-anuais","https://miaandpaper.com/content/designs/loja/cadernos-anuais/catalog/cadernos/process/cadernos (9)/img (16).webp"],["cadernos-anuais|Sortido","Sortido","cadernos-anuais","https://miaandpaper.com/catalogo/"],["crachas-loja|Braille Com Relevo","Braille Com Relevo","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/braille-01.webp"],["crachas-loja|Esperança 01","Esperança 01","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/esperanca-01.webp"],["crachas-loja|Esperança 02","Esperança 02","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/esperanca-02.webp"],["crachas-loja|Esperança 03","Esperança 03","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/esperanca-03.webp"],["crachas-loja|Esperança 04","Esperança 04","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/esperanca-04.webp"],["crachas-loja|Língua Gestual 01","Língua Gestual 01","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/lingua-gestual-01.webp"],["crachas-loja|Língua Gestual 02","Língua Gestual 02","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/lingua-gestual-02.webp"],["crachas-loja|Felicidade 01","Felicidade 01","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-01.webp"],["crachas-loja|Crachá 02","Crachá 02","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-02.webp"],["crachas-loja|Felicidade 02","Felicidade 02","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-03.webp"],["crachas-loja|Felicidade 03","Felicidade 03","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-04.webp"],["crachas-loja|Felicidade 04","Felicidade 04","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-05.webp"],["crachas-loja|Crachá 06","Crachá 06","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-06.webp"],["crachas-loja|Crachá 07","Crachá 07","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-07.webp"],["crachas-loja|Crachá 08","Crachá 08","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-08.webp"],["crachas-loja|Crachá 09","Crachá 09","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-09.webp"],["crachas-loja|Felicidade 05","Felicidade 05","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-10.webp"],["crachas-loja|Crachá 11","Crachá 11","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-11.webp"],["crachas-loja|Crachá 12","Crachá 12","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-12.webp"],["crachas-loja|Felicidade 06","Felicidade 06","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-13.webp"],["crachas-loja|Felicidade 07","Felicidade 07","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-14.webp"],["crachas-loja|Crachá 15","Crachá 15","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-15.webp"],["crachas-loja|Felicidade 08","Felicidade 08","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-16.webp"],["crachas-loja|Crachá 17","Crachá 17","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-17.webp"],["crachas-loja|Felicidade 09","Felicidade 09","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-18.webp"],["crachas-loja|Felicidade 10","Felicidade 10","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-19.webp"],["crachas-loja|Felicidade 11","Felicidade 11","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-20.webp"],["crachas-loja|Crachá 21","Crachá 21","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-21.webp"],["crachas-loja|Crachá 22","Crachá 22","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-22.webp"],["crachas-loja|Crachá 23","Crachá 23","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-23.webp"],["crachas-loja|Crachá 24","Crachá 24","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-24.webp"],["crachas-loja|Crachá 25","Crachá 25","crachas-loja","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-25.webp"],["crachas-loja|Sortido","Sortido","crachas-loja","https://miaandpaper.com/catalogo/"],["imanes-loja|Esperança 01","Esperança 01","imanes-loja","https://miaandpaper.com/content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/esperanca/esperanca-01.webp"],["imanes-loja|Esperança 02","Esperança 02","imanes-loja","https://miaandpaper.com/content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/esperanca/esperanca-02.webp"],["imanes-loja|Esperança 03","Esperança 03","imanes-loja","https://miaandpaper.com/content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/esperanca/esperanca-03.webp"],["imanes-loja|Esperança 04","Esperança 04","imanes-loja","https://miaandpaper.com/content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/esperanca/esperanca-04.webp"],["imanes-loja|Esperança 05","Esperança 05","imanes-loja","https://miaandpaper.com/content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/esperanca/esperanca-05.webp"],["imanes-loja|Esperança 06","Esperança 06","imanes-loja","https://miaandpaper.com/content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/cornfield/cornfield-01.webp"],["imanes-loja|Íman 01","Íman 01","imanes-loja","https://miaandpaper.com/content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/1000132974.webp"],["imanes-loja|Íman 02","Íman 02","imanes-loja","https://miaandpaper.com/content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/1000132976.webp"],["imanes-loja|Íman 03","Íman 03","imanes-loja","https://miaandpaper.com/content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/1000132978.webp"],["imanes-loja|Íman 04","Íman 04","imanes-loja","https://miaandpaper.com/content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/1000132980.webp"],["imanes-loja|Íman 05","Íman 05","imanes-loja","https://miaandpaper.com/content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/1000132982.webp"],["imanes-loja|Íman 06","Íman 06","imanes-loja","https://miaandpaper.com/content/designs/loja/imanes-loja/catalog/Fotos_dos_Imans/1000132984.webp"],["imanes-loja|Sortido","Sortido","imanes-loja","https://miaandpaper.com/catalogo/"],["imanes-recortados|Recortado 01","Recortado 01","imanes-recortados","https://miaandpaper.com/content/designs/Fotos_dos_Imans/tipo/iman-flexivel.webp"],["imanes-recortados|Recortado 02","Recortado 02","imanes-recortados","https://miaandpaper.com/"],["imanes-recortados|Recortado 03","Recortado 03","imanes-recortados","https://miaandpaper.com/"],["imanes-recortados|Recortado 04","Recortado 04","imanes-recortados","https://miaandpaper.com/"],["imanes-recortados|Recortado 05","Recortado 05","imanes-recortados","https://miaandpaper.com/"],["imanes-recortados|Recortado 06","Recortado 06","imanes-recortados","https://miaandpaper.com/"],["imanes-recortados|Sortido","Sortido","imanes-recortados","https://miaandpaper.com/catalogo/"],["marcadores-magneticos|Marcador magnético 01","Marcador magnético 01","marcadores-magneticos","https://miaandpaper.com/"],["marcadores-magneticos|Marcador magnético 02","Marcador magnético 02","marcadores-magneticos","https://miaandpaper.com/"],["marcadores-magneticos|Marcador magnético 03","Marcador magnético 03","marcadores-magneticos","https://miaandpaper.com/"],["marcadores-magneticos|Marcador magnético 04","Marcador magnético 04","marcadores-magneticos","https://miaandpaper.com/"],["marcadores-magneticos|Marcador magnético 05","Marcador magnético 05","marcadores-magneticos","https://miaandpaper.com/"],["marcadores-magneticos|Marcador magnético 06","Marcador magnético 06","marcadores-magneticos","https://miaandpaper.com/"],["marcadores-magneticos|Sortido","Sortido","marcadores-magneticos","https://miaandpaper.com/catalogo/"],["marcadores|Marcador 01","Marcador 01","marcadores","https://miaandpaper.com/"],["marcadores|Marcador 02","Marcador 02","marcadores","https://miaandpaper.com/"],["marcadores|Marcador 03","Marcador 03","marcadores","https://miaandpaper.com/"],["marcadores|Marcador 04","Marcador 04","marcadores","https://miaandpaper.com/"],["marcadores|Marcador 05","Marcador 05","marcadores","https://miaandpaper.com/"],["marcadores|Marcador 06","Marcador 06","marcadores","https://miaandpaper.com/"],["marcadores|Sortido","Sortido","marcadores","https://miaandpaper.com/catalogo/"],["mini-cadernos|Mini-Caderno 06","Mini-Caderno 06","mini-cadernos","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/a_jovem_cadeira_minicaderno.webp"],["mini-cadernos|Mini-Caderno 07","Mini-Caderno 07","mini-cadernos","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/o_jovem_cadeira_minicaderno.webp"],["mini-cadernos|Mini-Caderno 08","Mini-Caderno 08","mini-cadernos","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/idosa_jovem_minicaderno.webp"],["mini-cadernos|Mini-Caderno 09","Mini-Caderno 09","mini-cadernos","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/idoso_jovem_minicaderno.webp"],["mini-cadernos|Mini-Caderno 10","Mini-Caderno 10","mini-cadernos","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/reencontro_minicaderno.webp"],["mini-cadernos|Mini-Caderno 11","Mini-Caderno 11","mini-cadernos","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/novos/vestido_verde_minicaderno.webp"],["mini-cadernos|Mini-Caderno 01","Mini-Caderno 01","mini-cadernos","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/1000133037.webp"],["mini-cadernos|Mini-Caderno 02","Mini-Caderno 02","mini-cadernos","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/1000133040.webp"],["mini-cadernos|Mini-Caderno 03","Mini-Caderno 03","mini-cadernos","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/1000133041.webp"],["mini-cadernos|Mini-Caderno 04","Mini-Caderno 04","mini-cadernos","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/1000133042.webp"],["mini-cadernos|Mini-Caderno 05","Mini-Caderno 05","mini-cadernos","https://miaandpaper.com/content/designs/loja/mini-cadernos/catalog/Fotos_dos_Mini_Cadernos/1000133043.webp"],["mini-cadernos|Sortido","Sortido","mini-cadernos","https://miaandpaper.com/catalogo/"],["porta-chaves|Braille Com Relevo","Braille Com Relevo","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/braille-01.webp"],["porta-chaves|Esperança 01","Esperança 01","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/esperanca-01.webp"],["porta-chaves|Esperança 02","Esperança 02","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/esperanca-02.webp"],["porta-chaves|Esperança 03","Esperança 03","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/esperanca-03.webp"],["porta-chaves|Esperança 04","Esperança 04","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/esperanca-04.webp"],["porta-chaves|Língua Gestual 01","Língua Gestual 01","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/lingua-gestual-01.webp"],["porta-chaves|Língua Gestual 02","Língua Gestual 02","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/crachas/novidades/lingua-gestual-02.webp"],["porta-chaves|Felicidade 01","Felicidade 01","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-01.webp"],["porta-chaves|Crachá 02","Crachá 02","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-02.webp"],["porta-chaves|Felicidade 02","Felicidade 02","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-03.webp"],["porta-chaves|Felicidade 03","Felicidade 03","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-04.webp"],["porta-chaves|Felicidade 04","Felicidade 04","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-05.webp"],["porta-chaves|Crachá 06","Crachá 06","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-06.webp"],["porta-chaves|Crachá 07","Crachá 07","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-07.webp"],["porta-chaves|Crachá 08","Crachá 08","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-08.webp"],["porta-chaves|Crachá 09","Crachá 09","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-09.webp"],["porta-chaves|Felicidade 05","Felicidade 05","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-10.webp"],["porta-chaves|Crachá 11","Crachá 11","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-11.webp"],["porta-chaves|Crachá 12","Crachá 12","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-12.webp"],["porta-chaves|Felicidade 06","Felicidade 06","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-13.webp"],["porta-chaves|Felicidade 07","Felicidade 07","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-14.webp"],["porta-chaves|Crachá 15","Crachá 15","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-15.webp"],["porta-chaves|Felicidade 08","Felicidade 08","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-16.webp"],["porta-chaves|Crachá 17","Crachá 17","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-17.webp"],["porta-chaves|Felicidade 09","Felicidade 09","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-18.webp"],["porta-chaves|Felicidade 10","Felicidade 10","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-19.webp"],["porta-chaves|Felicidade 11","Felicidade 11","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-20.webp"],["porta-chaves|Crachá 21","Crachá 21","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-21.webp"],["porta-chaves|Crachá 22","Crachá 22","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-22.webp"],["porta-chaves|Crachá 23","Crachá 23","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-23.webp"],["porta-chaves|Crachá 24","Crachá 24","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-24.webp"],["porta-chaves|Crachá 25","Crachá 25","porta-chaves","https://miaandpaper.com/content/designs/loja/crachas-loja/catalog/pins/pin-25.webp"],["porta-chaves|Sortido","Sortido","porta-chaves","https://miaandpaper.com/catalogo/"],["quadros|Foto e Flores 3D","Foto e Flores 3D","quadros","https://miaandpaper.com/content/designs/quadros/fotos-reais/foto-flores-azul-amarelo-frontal.webp"],["quadros|Moldura para Bebé","Moldura para Bebé","quadros","https://miaandpaper.com/content/designs/quadros/fotos-reais/bebe-elefante-dados.webp"],["quadros|Coração de Flores","Coração de Flores","quadros","https://miaandpaper.com/content/designs/quadros/fotos-reais/coracao-flores-frontal.webp"],["quadros|O Amor Nunca Acaba","O Amor Nunca Acaba","quadros","https://miaandpaper.com/content/designs/quadros/fotos-reais/amor-frontal.webp"],["quadros|Jardim de Flores","Jardim de Flores","quadros","https://miaandpaper.com/content/designs/quadros/fotos-reais/jardim-flores-pasteis.webp"],["quadros|Silhueta Personalizada em Vinil","Silhueta Personalizada em Vinil","quadros","https://miaandpaper.com/content/designs/quadros/fotos-reais/silhueta-bodas-frontal.webp"],["quadros|Super Personalizado","Super Personalizado","quadros","https://miaandpaper.com/content/designs/quadros/fotos-reais/silhueta-pessoa.webp"],["quadros|Sortido","Sortido","quadros","https://miaandpaper.com/catalogo/"],["stickers|Sticker 01","Sticker 01","stickers","https://miaandpaper.com/"],["stickers|Sticker 02","Sticker 02","stickers","https://miaandpaper.com/"],["stickers|Sticker 03","Sticker 03","stickers","https://miaandpaper.com/"],["stickers|Sticker 04","Sticker 04","stickers","https://miaandpaper.com/"],["stickers|Sticker 05","Sticker 05","stickers","https://miaandpaper.com/"],["stickers|Sticker 06","Sticker 06","stickers","https://miaandpaper.com/"],["stickers|Sortido","Sortido","stickers","https://miaandpaper.com/catalogo/"]]}
EXCELJSON
, true);
if (!is_array($EXCEL_DATA)) { $EXCEL_DATA = array(); }

// ── Preços: espelho PHP das fórmulas J16/B34/B89 do Excel. ──

function ex_h($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

// slug ASCII para casar nomes sem escrever acentos no código.
function ex_slug($s) {
    $s = (string)$s;
    $s = str_replace(
        array("\xC3\xA1","\xC3\xA0","\xC3\xA2","\xC3\xA3","\xC3\xA9","\xC3\xAA","\xC3\xAD","\xC3\xB3","\xC3\xB4","\xC3\xB5","\xC3\xBA","\xC3\xA7","\xC3\x81","\xC3\x80","\xC3\x82","\xC3\x83","\xC3\x89","\xC3\x8A","\xC3\x8D","\xC3\x93","\xC3\x94","\xC3\x95","\xC3\x9A","\xC3\x87"),
        array('a','a','a','a','e','e','i','o','o','o','u','c','a','a','a','a','e','e','i','o','o','o','u','c'),
        $s);
    $s = strtolower($s);
    return trim(preg_replace('/[^a-z0-9]+/', '_', $s), '_');
}

function ex_site_base() {
    global $EX_SITE_ROOT;
    return (isset($EX_SITE_ROOT) && is_string($EX_SITE_ROOT) && $EX_SITE_ROOT !== '') ? $EX_SITE_ROOT : __DIR__;
}

function ex_site_mtime($rel) {
    $t = @filemtime(ex_site_base() . '/' . $rel);
    return $t === false ? '' : date('Y-m-d', (int)$t);
}

function ex_site_json($rel) {
    $p = ex_site_base() . '/' . $rel;
    if (!is_file($p)) return null;
    $raw = @file_get_contents($p);
    if ($raw === false) return null;
    $d = json_decode($raw, true);
    return is_array($d) ? $d : null;
}

function ex_design_nome($it) {
    if (!is_array($it)) return '';
    $t = trim((string)(isset($it['title']) ? $it['title'] : ''));
    if ($t !== '') return $t;
    return trim((string)(isset($it['value']) ? $it['value'] : ''));
}

// Resolve uma variante Excel (nome exacto da era Excel) para o site actual.
// Sem literais acentuados: tudo por slugs e leitura dos JSON.
function ex_variante_site($excel, $pricing, $produtos) {
    $s = ex_slug($excel);
    $v = array('site' => null, 'key' => null, 'flatOption' => null, 'designPrefix' => null,
        'tipo' => 'tier', 'fam' => '', 'covers' => null, 'acabDe' => null);
    if ($s === 'pasta_a4' || $s === 'pasta_a6' || $s === 'pack_pastas_a4_a6') {
        $v['site'] = 'pasta-de-folhetos';
        $v['key'] = $s === 'pasta_a4' ? 'A4' : ($s === 'pasta_a6' ? 'A6' : 'A4 + A6');
        $v['tipo'] = $s === 'pack_pastas_a4_a6' ? 'pack_pastas' : 'pasta';
        $v['fam'] = 'pastas';
        $v['covers'] = $s === 'pasta_a6' ? 'A6' : 'A4';
        $v['acabDe'] = 'finish';
        return $v;
    }
    if (preg_match('/^(crachas|porta_chaves)_(\d+)_mm$/', $s, $m)) {
        $v['site'] = $m[1] === 'crachas' ? 'crachas-loja' : 'porta-chaves';
        $v['key'] = $m[2] . ' mm';
        $v['fam'] = $m[1] === 'crachas' ? 'crachas' : 'porta_chaves';
        return $v;
    }
    if ($s === 'imanes_achatados') { $v['site'] = 'imanes-loja'; $v['key'] = 'Achatados'; $v['fam'] = 'imanes'; return $v; }
    if ($s === 'imanes_3_mm') { $v['site'] = 'imanes-loja'; $v['key'] = '3 mm'; $v['fam'] = 'imanes'; return $v; }
    if ($s === 'imanes_recortados') { $v['site'] = 'imanes-recortados'; $v['key'] = 'Recortados'; $v['fam'] = 'imanes_rec'; return $v; }
    foreach (array('mini_cadernos' => 'mini-cadernos', 'bloco_argolas_a6' => 'blocos-a6',
        'bloquinhos' => 'bloquinhos', 'stickers' => 'stickers', 'marcadores' => 'marcadores',
        'marcadores_magneticos' => 'marcadores-magneticos') as $slug => $site) {
        if ($s === $slug) {
            $v['site'] = $site;
            $v['fam'] = $site === 'blocos-a6' ? 'blocos_a6' : ($site === 'marcadores-magneticos' ? 'marcadores_mag' : str_replace('-', '_', $site));
            if ($site === 'marcadores-magneticos') $v['fam'] = 'marcadores_mag';
            return $v;
        }
    }
    if (preg_match('/^agendas_(agenda_normal|agenda_pioneiro|pack_normal|pack_pioneiro)$/', $s, $m)) {
        $v['site'] = 'agendas'; $v['flatOption'] = $m[1]; $v['tipo'] = 'agenda'; $v['fam'] = 'agendas'; $v['acabDe'] = 'lamination';
        return $v;
    }
    if (preg_match('/^cadernos_anuais_(caderno_normal|caderno_pioneiro|pack_normal|pack_pioneiro)$/', $s, $m)) {
        $v['site'] = 'cadernos-anuais'; $v['flatOption'] = $m[1]; $v['tipo'] = 'agenda'; $v['fam'] = 'cadernos'; $v['acabDe'] = 'lamination';
        return $v;
    }
    if (strpos($s, 'molduras_personalizadas_') === 0) {
        $v['site'] = 'quadros';
        $v['designPrefix'] = substr($s, strlen('molduras_personalizadas_'));
        $v['tipo'] = 'moldura'; $v['fam'] = 'molduras';
        return $v;
    }
    return $v;
}

// Catálogo canónico em cêntimos, lido dos ficheiros vivos do site.
// Fallback: fotografia Excel embutida convertida para o mesmo formato.
function ex_catalogo($snap) {
    static $cat = null;
    if ($cat !== null) return $cat;

    $pricing = ex_site_json('content/pricing.json');
    if (!is_array($pricing) || !isset($pricing['products']) || !is_array($pricing['products'])) {
        $cat = ex_catalogo_foto($snap);
        return $cat;
    }
    $prods = array();
    foreach (array('pasta-de-folhetos','crachas-loja','porta-chaves','imanes-loja','imanes-recortados',
        'mini-cadernos','blocos-a6','bloquinhos','stickers','marcadores','marcadores-magneticos',
        'agendas','cadernos-anuais','quadros') as $slug) {
        $pj = ex_site_json('content/products/' . $slug . '.json');
        if (is_array($pj)) $prods[$slug] = $pj;
    }

    $legacyCfg = array();
    if (isset($snap['produtos_cfg']) && is_array($snap['produtos_cfg'])) {
        foreach ($snap['produtos_cfg'] as $c) {
            if (isset($c[0])) $legacyCfg[(string)$c[0]] = $c;
        }
    }
    $legacyFam = array();
    if (isset($snap['produtos']) && is_array($snap['produtos'])) {
        foreach ($snap['produtos'] as $p) {
            if (isset($p[0])) $legacyFam[(string)$p[0]] = isset($p[3]) ? (string)$p[3] : '';
        }
    }

    $cat = array(
        'fonte' => 'site',
        'pricingData' => ex_site_mtime('content/pricing.json'),
        'ordem' => array(), 'cfg' => array(), 'flat' => array(), 'tiers' => array(),
        'designPrice' => array(), 'designs' => array(), 'designsA6' => array(), 'acab' => array(),
        'fitas' => array(), 'tiposCapa' => array(),
        'extras' => array('nome' => 200, 'cantos' => 200, 'capaDura' => 400, 'artes' => 300,
            'm1' => 15, 'm2' => 15, 'm3' => 25, 'm4' => 20),
        'artesFee' => array(), 'holoUn' => array(),
        'entrega' => array(), 'lookup' => array(),
    );

    $oe = isset($pricing['optionExtras']) && is_array($pricing['optionExtras']) ? $pricing['optionExtras'] : array();
    $int = function ($v, $def = 0) { return is_numeric($v) ? (int)$v : (int)$def; };
    $cat['extras']['nome'] = $int(isset($oe['cover_personalization']) ? $oe['cover_personalization'] : 200, 200);
    $cat['extras']['capaDura'] = $int(isset($oe['capa-dura']) ? $oe['capa-dura'] : 400, 400);
    $cat['extras']['m1'] = $int(isset($oe['holografica-marcador']) ? $oe['holografica-marcador'] : 15, 15);
    $cat['extras']['m2'] = $int(isset($oe['dois-lados-marcador']) ? $oe['dois-lados-marcador'] : 15, 15);
    $cat['extras']['m3'] = $int(isset($oe['buraquinho-marcador']) ? $oe['buraquinho-marcador'] : 25, 25);
    $cat['extras']['m4'] = $int(isset($oe['margem-plastico-marcador']) ? $oe['margem-plastico-marcador'] : 20, 20);
    $ship = isset($pricing['delivery']['shipping']) ? (float)$pricing['delivery']['shipping'] / 100 : 5.4;
    $cat['entrega'] = array(
        array("Envio CTT - at\u{00e9} 2 Kg", $ship),
        array("Entrega em m\u{00e3}o", 0), array('Vou recolher na casa da Mia', 0),
        array("Entregamos-te pessoalmente - Apenas Quinta do Conde, Azeit\u{00e3}o e Fern\u{00e3}o Ferro", 0),
        array('Junta as minhas encomendas', 0), array('Outro', 0),
    );

    $names = array();
    if (isset($snap['produtos']) && is_array($snap['produtos'])) {
        foreach ($snap['produtos'] as $p) {
            if (isset($p[0]) && trim((string)$p[0]) !== '') $names[] = (string)$p[0];
        }
    }
    foreach ($names as $excel) {
        $v = ex_variante_site($excel, $pricing['products'], $prods);
        if (empty($v['site']) || !isset($pricing['products'][$v['site']])) continue;
        $pp = $pricing['products'][$v['site']];
        $pj = isset($prods[$v['site']]) ? $prods[$v['site']] : null;
        $steps = array();
        if (is_array($pj) && isset($pj['steps']) && is_array($pj['steps'])) {
            foreach ($pj['steps'] as $st) {
                if (is_array($st) && isset($st['id'])) $steps[(string)$st['id']] = $st;
            }
        }
        // modo + mínimo (mínimo por chave quando o passo size o declara)
        $mode = isset($pp['pricingMode']) ? (string)$pp['pricingMode'] : '';
        $modo = $mode === 'tier-unit' ? 'tier' : 'flat';
        $min = isset($pp['minimumQuantity']) ? max(1, (int)$pp['minimumQuantity']) : 1;
        $key = $v['key'];
        if ($key === null) {
            $keys = isset($pp['prices']) && is_array($pp['prices']) ? array_keys($pp['prices']) : array();
            $key = count($keys) === 1 ? (string)$keys[0] : (isset($pp['defaultPriceKey']) ? (string)$pp['defaultPriceKey'] : '');
        }
        if (isset($steps['size']['items']) && is_array($steps['size']['items'])) {
            foreach ($steps['size']['items'] as $it) {
                if (!is_array($it)) continue;
                $pk = isset($it['priceKey']) ? (string)$it['priceKey'] : '';
                if ($pk !== '' && $pk === $key && isset($it['minQuantity'])) {
                    $min = max(1, (int)$it['minQuantity']);
                }
            }
        }
        // preço base
        $table = isset($pp['prices'][$key]) && is_array($pp['prices'][$key]) ? $pp['prices'][$key] : array();
        $flat = null; $tiers = null; $designPrice = null;
        if ($v['site'] === 'quadros') {
            $designPrice = array();
            if (isset($steps['designs']['items']) && is_array($steps['designs']['items'])) {
                foreach ($steps['designs']['items'] as $it) {
                    if (!is_array($it)) continue;
                    $nm = ex_design_nome($it);
                    if ($nm !== '' && isset($it['priceCents'])) $designPrice[$nm] = max(0, (int)$it['priceCents']);
                }
            }
        } elseif ($v['flatOption'] !== null) {
            $cand = null;
            if (isset($pp['flatUnitPricesCents'][$v['flatOption']])) $cand = $pp['flatUnitPricesCents'][$v['flatOption']];
            elseif (is_array($pj) && isset($pj['flatUnitPricesCents'][$v['flatOption']])) $cand = $pj['flatUnitPricesCents'][$v['flatOption']];
            if ($cand !== null) $flat = max(0, (int)$cand);
        } elseif ($modo === 'tier') {
            $tiers = array();
            foreach ($table as $q => $c) {
                if ((int)$q > 0 && is_numeric($c)) $tiers[(int)$q] = max(0, (int)$c);
            }
            if (empty($tiers)) continue;
            ksort($tiers, SORT_NUMERIC);
        } else {
            $t = array();
            foreach ($table as $q => $c) {
                if ((int)$q > 0 && is_numeric($c)) $t[(int)$q] = max(0, (int)$c);
            }
            if (empty($t)) continue;
            ksort($t, SORT_NUMERIC);
            $prim = array_keys($t);
            $flat = (int)round(((float)$t[$prim[0]] / $prim[0]));
            $flat = max(0, $flat);
        }
        // designs
        $designs = array(); $designsA6 = array();
        $pushDesigns = function ($items) {
            $out = array();
            foreach ((array)$items as $it) {
                if (!is_array($it)) continue;
                $nm = ex_design_nome($it);
                if ($nm === '') continue;
                $out[] = array($nm, isset($it['image']) ? (string)$it['image'] : '');
            }
            return $out;
        };
        if ($v['covers'] !== null && isset($steps['covers']['items'])) {
            foreach ((array)$steps['covers']['items'] as $it) {
                if (!is_array($it) || !isset($it['sizeGroup'])) continue;
                $nm = ex_design_nome($it);
                if ($nm === '') continue;
                $row = array($nm, isset($it['image']) ? (string)$it['image'] : '');
                if ((string)$it['sizeGroup'] === 'A4') $designs[] = $row;
                if ((string)$it['sizeGroup'] === 'A6') $designsA6[] = $row;
            }
            if ($v['covers'] === 'A6') { $tmp = $designs; $designs = $designsA6; $designsA6 = $tmp; }
        } elseif (isset($steps['designs']['items'])) {
            $designs = $pushDesigns($steps['designs']['items']);
        }
        // acabamentos
        $acab = array();
        if ($v['acabDe'] === 'finish') {
            if (isset($steps['extras']['drawers']) && is_array($steps['extras']['drawers'])) {
                foreach ($steps['extras']['drawers'] as $d) {
                    if (!is_array($d) || (isset($d['field']) && $d['field'] === 'metal_corners')) {
                        if (isset($d['field']) && $d['field'] === 'metal_corners') {
                            if (isset($d['items'][0]['extraPriceCentsPerUnit'])) {
                                $cat['extras']['cantos'] = max(0, (int)$d['items'][0]['extraPriceCentsPerUnit']);
                            }
                            continue;
                        }
                    }
                    foreach ((array)(isset($d['items']) ? $d['items'] : array()) as $it) {
                        if (!is_array($it)) continue;
                        $t = trim((string)(isset($it['title']) ? $it['title'] : ''));
                        if ($t !== '' && !in_array($t, $acab, true)) $acab[] = $t;
                    }
                }
            }
        } elseif ($v['acabDe'] === 'lamination') {
            if (isset($steps['lamination']['items'])) {
                foreach ((array)$steps['lamination']['items'] as $it) {
                    if (!is_array($it)) continue;
                    $t = trim((string)(isset($it['title']) ? $it['title'] : ''));
                    if ($t !== '' && !in_array($t, $acab, true)) $acab[] = $t;
                }
            }
        }
        // fitas (distintas, ordem do site)
        if ($v['site'] === 'pasta-de-folhetos' && empty($cat['fitas']) && isset($steps['designs']['items'])) {
            foreach ((array)$steps['designs']['items'] as $it) {
                if (!is_array($it)) continue;
                $t = trim((string)(isset($it['title']) ? $it['title'] : ''));
                if ($t !== '' && !in_array($t, $cat['fitas'], true)) $cat['fitas'][] = $t;
            }
        }
        // tipos de capa (união agendas + cadernos)
        if (in_array($v['site'], array('agendas', 'cadernos-anuais'), true) && is_array($pj) && isset($pj['finishOptions'])) {
            foreach ((array)$pj['finishOptions'] as $fo) {
                if (!is_array($fo) || !isset($fo['value'])) continue;
                if (strpos((string)$fo['value'], 'capa-') === 0) {
                    $t = trim((string)(isset($fo['title']) ? $fo['title'] : ''));
                    if ($t !== '' && !in_array($t, $cat['tiposCapa'], true)) $cat['tiposCapa'][] = $t;
                }
            }
        }
        // holo unitário genérico (onde o site o vende por unidade)
        if (is_array($pj) && isset($pj['finishOptions']) && $v['tipo'] === 'tier' && ex_slug($excel) !== 'marcadores') {
            foreach ((array)$pj['finishOptions'] as $fo) {
                if (!is_array($fo) || !isset($fo['value'])) continue;
                if (strpos((string)$fo['value'], 'holografica') === 0 && isset($fo['extraPriceCentsPerUnit']) && (int)$fo['extraPriceCentsPerUnit'] > 0) {
                    $cat['holoUn'][$excel] = (int)$fo['extraPriceCentsPerUnit'];
                }
            }
        }
        // taxa de artes por produto
        $fee = 300;
        if (isset($pp['customArtworkFeePerFileCents']) && is_numeric($pp['customArtworkFeePerFileCents'])) {
            $fee = max(0, (int)$pp['customArtworkFeePerFileCents']);
        }
        $cat['artesFee'][$excel] = $fee;

        $leg = isset($legacyCfg[$excel]) ? $legacyCfg[$excel] : array();
        $cat['ordem'][] = $excel;
        $cat['cfg'][$excel] = array(
            'modo' => $modo, 'min' => $min, 'grupo' => $v['site'], 'tipo' => $v['tipo'],
            'fam' => isset($legacyFam[$excel]) ? $legacyFam[$excel] : '',
            'validacao' => isset($leg[5]) ? (string)$leg[5] : '', 'lista' => isset($leg[6]) ? (string)$leg[6] : '',
        );
        if ($flat !== null) $cat['flat'][$excel] = $flat;
        if ($tiers !== null) $cat['tiers'][$excel] = $tiers;
        if ($designPrice !== null) $cat['designPrice'][$excel] = $designPrice;
        $cat['designs'][$excel] = $designs;
        if ($v['tipo'] === 'pack_pastas') $cat['designsA6'][$excel] = $designsA6;
        $cat['acab'][$excel] = $acab;
    }
    if (empty($cat['fitas']) && isset($snap['fita_base']) && is_array($snap['fita_base'])) {
        $cat['fitas'] = array_values(array_filter(array_map('strval', $snap['fita_base'])));
    }
    if (empty($cat['tiposCapa']) && isset($snap['tipos_capa']) && is_array($snap['tipos_capa'])) {
        $cat['tiposCapa'] = array_values(array_filter(array_map('strval', $snap['tipos_capa'])));
    }
    if (isset($snap['design_lookup'])) $cat['lookup'] = $snap['design_lookup'];
    return $cat;
}

// Fotografia Excel embutida convertida para o formato canónico (cêntimos).
// Só serve se os ficheiros vivos do site estiverem ilegíveis.
function ex_catalogo_foto($snap) {
    $e2c = function ($v) { return (int)round((float)$v * 100); };
    $cat = array(
        'fonte' => 'excel', 'pricingData' => '2026-09',
        'ordem' => array(), 'cfg' => array(), 'flat' => array(), 'tiers' => array(),
        'designPrice' => array(), 'designs' => array(), 'designsA6' => array(), 'acab' => array(),
        'fitas' => array(), 'tiposCapa' => array(),
        'extras' => array('nome' => 200, 'cantos' => 200, 'capaDura' => 400, 'artes' => 300,
            'm1' => 15, 'm2' => 15, 'm3' => 25, 'm4' => 20),
        'artesFee' => array(), 'holoUn' => array(),
        'entrega' => array(), 'lookup' => array(),
    );
    if (isset($snap['extras_labels']) && is_array($snap['extras_labels'])) {
        $ag = $snap['extras_labels'];
        if (isset($ag['AG3'])) $cat['extras']['nome'] = $e2c($ag['AG3']);
        if (isset($ag['AG4'])) $cat['extras']['cantos'] = $e2c($ag['AG4']);
        if (isset($ag['AG6'])) $cat['extras']['capaDura'] = $e2c($ag['AG6']);
        if (isset($ag['AG5'])) $cat['extras']['artes'] = $e2c($ag['AG5']);
        if (isset($ag['AG7'])) $cat['extras']['m1'] = $e2c($ag['AG7']);
        if (isset($ag['AG8'])) $cat['extras']['m2'] = $e2c($ag['AG8']);
        if (isset($ag['AG9'])) $cat['extras']['m3'] = $e2c($ag['AG9']);
        if (isset($ag['AG10'])) $cat['extras']['m4'] = $e2c($ag['AG10']);
    }
    $dg = isset($snap['dg']) && is_array($snap['dg']) ? $snap['dg'] : array();
    $lookup = isset($snap['design_lookup']) && is_array($snap['design_lookup']) ? $snap['design_lookup'] : array();
    $cat['lookup'] = $lookup;
    $urlPorChave = array();
    foreach ($lookup as $row) {
        if (isset($row[0], $row[3])) $urlPorChave[(string)$row[0]] = (string)$row[3];
    }
    $lamin = array();
    if (isset($snap['acabamentos']) && is_array($snap['acabamentos'])) {
        foreach ($snap['acabamentos'] as $a) {
            $a = trim((string)$a);
            if ($a !== '') $lamin[] = $a;
        }
    }
    if (isset($snap['produtos']) && is_array($snap['produtos'])) {
        foreach ($snap['produtos'] as $p) {
            if (!isset($p[0]) || trim((string)$p[0]) === '') continue;
            $excel = (string)$p[0];
            $cat['ordem'][] = $excel;
            $cat['artesFee'][$excel] = $cat['extras']['artes'];
        }
    }
    if (isset($snap['produtos_cfg']) && is_array($snap['produtos_cfg'])) {
        foreach ($snap['produtos_cfg'] as $c) {
            if (!isset($c[0])) continue;
            $excel = (string)$c[0];
            $cat['cfg'][$excel] = array(
                'modo' => isset($c[1]) ? (string)$c[1] : 'flat',
                'min' => isset($c[2]) ? max(1, (int)$c[2]) : 1,
                'grupo' => isset($c[3]) ? (string)$c[3] : '',
                'tipo' => isset($c[4]) ? (string)$c[4] : 'tier',
                'fam' => '',
                'validacao' => isset($c[5]) ? (string)$c[5] : '',
                'lista' => isset($c[6]) ? (string)$c[6] : '',
            );
            $tipo = $cat['cfg'][$excel]['tipo'];
            if (in_array($tipo, array('pasta', 'pack_pastas', 'agenda'), true)) {
                $cat['acab'][$excel] = $lamin;
            }
            $lista = $cat['cfg'][$excel]['lista'];
            $ds = array();
            if ($lista !== '' && isset($dg[$lista]) && is_array($dg[$lista])) {
                foreach ($dg[$lista] as $dn) {
                    $dn = (string)$dn;
                    $img = '';
                    foreach (array($cat['cfg'][$excel]['grupo'] . '|' . $dn, 'Pasta A4|' . $dn, 'Pasta A6|' . $dn) as $chave) {
                        if (isset($urlPorChave[$chave])) { $img = $urlPorChave[$chave]; break; }
                    }
                    $ds[] = array($dn, $img);
                }
            }
            $cat['designs'][$excel] = $ds;
            if ($tipo === 'pack_pastas' && isset($dg['DG_A6'])) {
                $a6 = array();
                foreach ($dg['DG_A6'] as $dn) {
                    $dn = (string)$dn;
                    $a6[] = array($dn, isset($urlPorChave['Pasta A6|' . $dn]) ? $urlPorChave['Pasta A6|' . $dn] : '');
                }
                $cat['designsA6'][$excel] = $a6;
            }
        }
    }
    if (isset($snap['produtos']) && is_array($snap['produtos'])) {
        foreach ($snap['produtos'] as $p) {
            if (!isset($p[0])) continue;
            $excel = (string)$p[0];
            if (!isset($cat['cfg'][$excel])) continue;
            if ($cat['cfg'][$excel]['modo'] === 'tier') continue;
            if (isset($p[1]) && is_numeric($p[1])) $cat['flat'][$excel] = $e2c($p[1]);
        }
    }
    if (isset($snap['tiers']) && is_array($snap['tiers'])) {
        foreach ($snap['tiers'] as $t) {
            if (!isset($t[0], $t[1], $t[2])) continue;
            $excel = (string)$t[0];
            if (!isset($cat['tiers'][$excel])) $cat['tiers'][$excel] = array();
            $cat['tiers'][$excel][(int)$t[1]] = $e2c($t[2]);
        }
        foreach ($cat['tiers'] as $k => $v) ksort($cat['tiers'][$k], SORT_NUMERIC);
    }
    if (isset($snap['fita_base']) && is_array($snap['fita_base'])) {
        $cat['fitas'] = array_values(array_filter(array_map('strval', $snap['fita_base'])));
    }
    if (isset($snap['tipos_capa']) && is_array($snap['tipos_capa'])) {
        $cat['tiposCapa'] = array_values(array_filter(array_map('strval', $snap['tipos_capa'])));
    }
    if (isset($snap['entrega']) && is_array($snap['entrega'])) {
        foreach ($snap['entrega'] as $e) {
            if (isset($e[0])) $cat['entrega'][] = array((string)$e[0], isset($e[1]) && is_numeric($e[1]) ? (float)$e[1] : 0);
        }
    }
    // família da era Excel (para a regra do tipo de capa)
    if (isset($snap['produtos']) && is_array($snap['produtos'])) {
        foreach ($snap['produtos'] as $p) {
            if (isset($p[0], $p[3]) && isset($cat['cfg'][(string)$p[0]])) {
                $cat['cfg'][(string)$p[0]]['fam'] = (string)$p[3];
            }
        }
    }
    return $cat;
}

// Catálogo canónico (lido uma vez por pedido).
function ex_cat() {
    global $EXCEL_DATA, $EX_CATALOGO;
    if (!isset($EX_CATALOGO)) $EX_CATALOGO = ex_catalogo(is_array($EXCEL_DATA) ? $EXCEL_DATA : array());
    return $EX_CATALOGO;
}

function ex_cfg($name) {
    $cat = ex_cat();
    return isset($cat['cfg'][(string)$name]) ? $cat['cfg'][(string)$name] : null;
}

function ex_extra($key) {
    $cat = ex_cat();
    return isset($cat['extras'][$key]) ? (int)$cat['extras'][$key] : 0;
}

function ex_artes_fee($name) {
    $cat = ex_cat();
    return isset($cat['artesFee'][(string)$name]) ? (int)$cat['artesFee'][(string)$name] : 300;
}

// Preço base em CÊNTIMOS (inteiro) ou a string 'Rever quantidade'.
// Regra tier idêntica à do motor partilhado (escalão exacto ou interpolação).
function ex_base_price($name, $qty, $design = '') {
    $cfg = ex_cfg($name);
    if ($cfg === null) return 'Rever quantidade';
    $modo = isset($cfg['modo']) ? (string)$cfg['modo'] : '';
    $min = isset($cfg['min']) ? (int)$cfg['min'] : 1;
    if (!is_numeric($qty) || floor((float)$qty) != (float)$qty || (int)$qty < $min) {
        return 'Rever quantidade';
    }
    $qty = (int)$qty;
    $cat = ex_cat();
    if (!empty($cat['designPrice'][(string)$name])) {
        $mapa = $cat['designPrice'][(string)$name];
        if (isset($mapa[(string)$design])) return (int)$mapa[(string)$design] * $qty;
        return (int)min($mapa) * $qty;
    }
    if (isset($cat['flat'][(string)$name])) {
        return (int)$cat['flat'][(string)$name] * $qty;
    }
    if ($modo === 'tier' && isset($cat['tiers'][(string)$name])) {
        $tab = array();
        foreach ($cat['tiers'][(string)$name] as $q => $c) $tab[(int)$q] = (int)$c;
        if (empty($tab)) return 'Rever quantidade';
        $cents = product_tier_price_cents($tab, $qty);
        if ($cents <= 0) return 'Rever quantidade';
        return $cents;
    }
    return 'Rever quantidade';
}

// Preço calculado em CÊNTIMOS a partir dos campos de um produto.
function ex_product_calc($name, $f) {
    $cfg = ex_cfg($name);
    $tipo = $cfg !== null && isset($cfg['tipo']) ? (string)$cfg['tipo'] : '';
    $qty = isset($f['quantidade']) ? (int)$f['quantidade'] : 0;
    $base = ex_base_price($name, isset($f['quantidade']) ? $f['quantidade'] : 0, isset($f['design']) ? $f['design'] : '');
    if (!is_int($base)) return $base;
    $cat = ex_cat();
    $sim = function ($v) { return $v === 'Sim'; };
    $porUn = 0;
    if (in_array($tipo, array('pasta', 'pack_pastas', 'agenda'), true) && $sim(isset($f['comNome']) ? $f['comNome'] : '')) {
        $porUn += ex_extra('nome');
    }
    if (in_array($tipo, array('pasta', 'pack_pastas'), true) && $sim(isset($f['cantos']) ? $f['cantos'] : '')) {
        $porUn += ex_extra('cantos');
    }
    if ($tipo === 'pack_pastas') {
        if ($sim(isset($f['comNomeA6']) ? $f['comNomeA6'] : '')) $porUn += ex_extra('nome');
        if ($sim(isset($f['cantosA6']) ? $f['cantosA6'] : '')) $porUn += ex_extra('cantos');
    }
    if (ex_slug($name) === 'marcadores' && (int)(isset($f['nArtes']) ? $f['nArtes'] : 0) === 0) {
        if ($sim(isset($f['holo']) ? $f['holo'] : '')) $porUn += ex_extra('m1');
        if ($sim(isset($f['frenteVerso']) ? $f['frenteVerso'] : '')) $porUn += ex_extra('m2');
        if ($sim(isset($f['furo']) ? $f['furo'] : '')) $porUn += ex_extra('m3');
        if ($sim(isset($f['margem']) ? $f['margem'] : '')) $porUn += ex_extra('m4');
    }
    if ($sim(isset($f['holoUn']) ? $f['holoUn'] : '') && isset($cat['holoUn'][(string)$name])) {
        $porUn += (int)$cat['holoUn'][(string)$name];
    }
    $fixo = 0;
    if ((isset($f['tipoCapa']) ? $f['tipoCapa'] : '') === 'Capa dura') $fixo += ex_extra('capaDura');
    $fixo += (int)(isset($f['nArtes']) ? $f['nArtes'] : 0) * ex_artes_fee($name);
    return $base + $qty * $porUn + $fixo;
}

function ex_entrega_portes($metodo) {
    $cat = ex_cat();
    if (!isset($cat['entrega']) || !is_array($cat['entrega'])) return null;
    foreach ($cat['entrega'] as $e) {
        if (isset($e[0]) && (string)$e[0] === (string)$metodo) {
            return is_numeric($e[1]) ? (float)$e[1] : null;
        }
    }
    return null;
}

function ex_design_base($design) {
    $design = (string)$design;
    $sem = preg_replace("/[\s\xC2\xB7-]+Fita\s+\S+\s*$/i", '', $design);
    $sem = $sem === null ? '' : rtrim($sem);
    return $sem === '' ? $design : $sem;
}

function ex_design_url($name, $design, $a6 = false) {
    $cat = ex_cat();
    $design = (string)$design;
    if ($design === '') return '';
    $candidatos = array($design);
    $base = ex_design_base($design);
    if ($base !== $design) $candidatos[] = $base;
    $listas = array();
    if ($a6 && isset($cat['designsA6'][(string)$name])) $listas[] = $cat['designsA6'][(string)$name];
    if (isset($cat['designs'][(string)$name])) $listas[] = $cat['designs'][(string)$name];
    foreach ($candidatos as $cand) {
        foreach ($listas as $lista) {
            foreach ((array)$lista as $row) {
                if (isset($row[0]) && (string)$row[0] === $cand) {
                    return isset($row[1]) ? (string)$row[1] : '';
                }
            }
        }
    }
    $cfg = ex_cfg($name);
    $grupo = ($cfg !== null && isset($cfg['grupo'])) ? (string)$cfg['grupo'] : '';
    if (isset($cat['lookup']) && is_array($cat['lookup'])) {
        foreach ($candidatos as $cand) {
            foreach (array($grupo . '|' . $cand, 'Pasta A4|' . $cand, 'Pasta A6|' . $cand) as $chave) {
                foreach ($cat['lookup'] as $row) {
                    if (isset($row[0], $row[3]) && (string)$row[0] === $chave) return (string)$row[3];
                }
            }
        }
    }
    return '';
}

function ex_familia_of($name) {
    $cfg = ex_cfg($name);
    return ($cfg !== null && isset($cfg['fam'])) ? (string)$cfg['fam'] : '';
}

// ── Validação (espelho das mensagens do VBA). Devolve array de erros. ──
function ex_validate($d, &$computed) {
    $errors = array();
    $computed = array('produtos' => array(), 'totalCalc' => null, 'totalGuardar' => null);

    $cliente = trim((string)(isset($d['cliente']) ? $d['cliente'] : ''));
    if ($cliente === '') $errors[] = 'Escolhe um cliente.';

    $prods = isset($d['produtos']) && is_array($d['produtos']) ? array_values($d['produtos']) : array();
    $usados = array();
    foreach ($prods as $p) {
        if (is_array($p) && trim((string)(isset($p['produto']) ? $p['produto'] : '')) !== '') $usados[] = $p;
    }
    if (count($usados) === 0) $errors[] = 'Escolhe pelo menos um produto.';

    $i = 0;
    foreach ($usados as $p) {
        $i++;
        $nome = trim((string)(isset($p['produto']) ? $p['produto'] : ''));
        $rot = 'Produto ' . $i;
        $cfg = ex_cfg($nome);
        if ($cfg === null) { $errors[] = $rot . ': produto desconhecido.'; continue; }
        $tipo = isset($cfg['tipo']) ? (string)$cfg['tipo'] : '';
        $min = isset($cfg['min']) ? (int)$cfg['min'] : 1;
        $q = isset($p['quantidade']) ? $p['quantidade'] : '';
        if (!is_numeric($q) || floor((float)$q) != (float)$q) {
            $errors[] = 'A quantidade do ' . $rot . ' não é válida.';
        } elseif ((float)$q < $min) {
            $errors[] = 'A quantidade mínima do ' . $rot . ' é ' . ((int)$min) . '.';
        }
        if (trim((string)(isset($p['design']) ? $p['design'] : '')) === '') {
            $errors[] = 'Escolhe o design do ' . $rot . '.';
        }
        if (in_array($tipo, array('pasta', 'pack_pastas'), true)) {
            if (trim((string)(isset($p['acabamento']) ? $p['acabamento'] : '')) === '') {
                $errors[] = 'Escolhe o acabamento do ' . $rot . '.';
            }
            if (trim((string)(isset($p['fita']) ? $p['fita'] : '')) === '') {
                $errors[] = 'Escolhe a fita do ' . $rot . '.';
            }
        }
        if ((isset($p['comNome']) ? $p['comNome'] : '') === 'Sim' && trim((string)(isset($p['nome']) ? $p['nome'] : '')) === '') {
            $errors[] = 'Indica o nome principal do ' . $rot . '.';
        }
        if ($tipo === 'pack_pastas') {
            if (trim((string)(isset($p['designA6']) ? $p['designA6'] : '')) === ''
                || trim((string)(isset($p['acabamentoA6']) ? $p['acabamentoA6'] : '')) === '') {
                $errors[] = 'Completa a configuração A6 do Pack do ' . $rot . '.';
            }
            if ((isset($p['comNomeA6']) ? $p['comNomeA6'] : '') === 'Sim' && trim((string)(isset($p['nomeA6']) ? $p['nomeA6'] : '')) === '') {
                $errors[] = 'Indica o nome A6 do Pack do ' . $rot . '.';
            }
        }
        $fam = ex_familia_of($nome);
        if (in_array($fam, array('agendas', 'cadernos'), true) && trim((string)(isset($p['tipoCapa']) ? $p['tipoCapa'] : '')) === '') {
            $errors[] = 'Escolhe o tipo de capa do ' . $rot . '.';
        }
        $na = isset($p['nArtes']) ? $p['nArtes'] : 0;
        if ($na === '' || $na === null) $na = 0;
        if (!is_numeric($na) || floor((float)$na) != (float)$na || (float)$na < 0) {
            $errors[] = 'O número de artes próprias do ' . $rot . ' não é válido.';
        }
        $calc = ex_product_calc($nome, array(
            'quantidade' => $q, 'design' => trim((string)(isset($p['design']) ? $p['design'] : '')),
            'comNome' => isset($p['comNome']) ? $p['comNome'] : 'Não',
            'cantos' => isset($p['cantos']) ? $p['cantos'] : 'Não',
            'comNomeA6' => isset($p['comNomeA6']) ? $p['comNomeA6'] : 'Não',
            'cantosA6' => isset($p['cantosA6']) ? $p['cantosA6'] : 'Não',
            'holo' => isset($p['holo']) ? $p['holo'] : 'Não',
            'frenteVerso' => isset($p['frenteVerso']) ? $p['frenteVerso'] : 'Não',
            'furo' => isset($p['furo']) ? $p['furo'] : 'Não',
            'margem' => isset($p['margem']) ? $p['margem'] : 'Não',
            'holoUn' => isset($p['holoUn']) ? $p['holoUn'] : 'Não',
            'tipoCapa' => isset($p['tipoCapa']) ? $p['tipoCapa'] : '',
            'nArtes' => $na,
        ));
        $manual = trim((string)(isset($p['precoManual']) ? $p['precoManual'] : ''));
        $manualCents = null;
        if ($manual !== '') {
            if (!is_numeric(str_replace(',', '.', $manual)) || (float)str_replace(',', '.', $manual) < 0) {
                $errors[] = 'O preço manual do ' . $rot . ' não é válido.';
            } else {
                $manualCents = (int)round((float)str_replace(',', '.', $manual) * 100);
            }
        }
        $final = $manualCents !== null ? $manualCents : $calc;
        if (!is_int($final)) {
            $errors[] = 'O preço do ' . $rot . ' precisa de revisão.';
            $final = null;
        }
        $computed['produtos'][] = array('nome' => $nome, 'base' => ex_base_price($nome, $q, trim((string)(isset($p['design']) ? $p['design'] : ''))), 'calc' => $calc, 'final' => $final);
    }

    $metodo = trim((string)(isset($d['entrega']) ? $d['entrega'] : ''));
    if ($metodo === '') {
        $errors[] = 'Escolhe o método de entrega.';
    } elseif ($metodo === 'Outro') {
        $pm = trim((string)(isset($d['portesManuais']) ? $d['portesManuais'] : ''));
        if ($pm === '' || !is_numeric(str_replace(',', '.', $pm)) || (float)str_replace(',', '.', $pm) < 0) {
            $errors[] = 'Indica os portes manuais para o método Outro.';
        }
    }
    $aj = trim((string)(isset($d['ajuste']) ? $d['ajuste'] : ''));
    if ($aj !== '' && !is_numeric(str_replace(',', '.', $aj))) {
        $errors[] = 'O ajuste não é válido (usa números, com menos para desconto).';
    }
    $ta = trim((string)(isset($d['totalAcordado']) ? $d['totalAcordado'] : ''));
    if ($ta !== '' && (!is_numeric(str_replace(',', '.', $ta)) || (float)str_replace(',', '.', $ta) < 0)) {
        $errors[] = 'O total acordado não é válido.';
    }

    // Total calculado B89 (em cêntimos; guardado em euros).
    $finais = array();
    foreach ($computed['produtos'] as $cp) { if ($cp['final'] !== null) $finais[] = $cp['final']; }
    if (count($usados) > 0 && count($finais) !== count($usados)) {
        $computed['totalCalc'] = 'Rever quantidades/preços';
        $errors[] = 'Rever quantidades/preços.';
    } else {
        $portes = 0;
        $pm = trim((string)(isset($d['portesManuais']) ? $d['portesManuais'] : ''));
        if ($pm !== '') {
            $portes = (int)round((float)str_replace(',', '.', $pm) * 100);
        } elseif ($metodo !== '') {
            $tab = ex_entrega_portes($metodo);
            if ($tab === null) {
                $computed['totalCalc'] = 'Indicar entrega/portes';
                $errors[] = 'Indicar entrega/portes.';
            } else {
                $portes = (int)round((float)$tab * 100);
            }
        } else {
            $computed['totalCalc'] = 'Indicar entrega/portes';
        }
        if (is_string($computed['totalCalc'])) {
            // já marcado acima
        } elseif (count($usados) === 0) {
            $computed['totalCalc'] = null;
        } else {
            $ajCents = $aj !== '' ? (int)round((float)str_replace(',', '.', $aj) * 100) : 0;
            $computed['totalCalc'] = (array_sum($finais) + $portes + $ajCents) / 100;
        }
    }
    if ($computed['totalCalc'] !== null && !is_numeric($computed['totalCalc'])) {
        // erro já registado
    } elseif ($computed['totalCalc'] === null && count($usados) > 0) {
        $errors[] = 'O total ainda não está calculado.';
    }
    $computed['totalGuardar'] = ($ta !== '' && is_numeric(str_replace(',', '.', $ta)))
        ? round((float)str_replace(',', '.', $ta), 2)
        : $computed['totalCalc'];

    return $errors;
}

// Texto de configuração de um artigo (equivale à coluna de configuração dos Registos).
function ex_config_resumo($p) {
    $t = 'Acab.: ' . trim((string)(isset($p['acabamento']) ? $p['acabamento'] : ''));
    if (trim((string)(isset($p['nome']) ? $p['nome'] : '')) !== '') $t .= ' | Nome: ' . trim((string)$p['nome']);
    if ((isset($p['cantos']) ? $p['cantos'] : '') === 'Sim') $t .= ' | Cantos';
    if (trim((string)(isset($p['designA6']) ? $p['designA6'] : '')) !== '') {
        $t .= ' | A6: ' . trim((string)$p['designA6']) . ' / ' . trim((string)(isset($p['acabamentoA6']) ? $p['acabamentoA6'] : ''));
    }
    if (trim((string)(isset($p['nomeA6']) ? $p['nomeA6'] : '')) !== '') $t .= ' | Nome A6: ' . trim((string)$p['nomeA6']);
    if ((isset($p['cantosA6']) ? $p['cantosA6'] : '') === 'Sim') $t .= ' | Cantos A6';
    if (trim((string)(isset($p['fita']) ? $p['fita'] : '')) !== '') $t .= ' | Fita: ' . trim((string)$p['fita']);
    if (trim((string)(isset($p['fitaA6']) ? $p['fitaA6'] : '')) !== '') $t .= ' | Fita A6: ' . trim((string)$p['fitaA6']);
    if (trim((string)(isset($p['tipoCapa']) ? $p['tipoCapa'] : '')) !== '') $t .= ' | Capa: ' . trim((string)$p['tipoCapa']);
    foreach (array('holo' => 'Holográfico', 'frenteVerso' => 'Frente e verso', 'furo' => 'Furo', 'margem' => 'Margem plástica', 'holoUn' => 'Holográfico') as $k => $rot) {
        if ((isset($p[$k]) ? $p[$k] : '') === 'Sim') $t .= ' | ' . $rot;
    }
    if ((int)(isset($p['nArtes']) ? $p['nArtes'] : 0) > 0) $t .= ' | Artes próprias: ' . (int)$p['nArtes'];
    if (trim((string)(isset($p['detalhes']) ? $p['detalhes'] : '')) !== '') $t .= ' | ' . trim((string)$p['detalhes']);
    return $t;
}

// ── Pendentes: lista diária de produção, calculada do arquivo. ──
//
// Tudo o que ainda não foi entregue (Entregue diferente de Sim):
//   - artigos Por fazer / Em produção → "por fazer";
//   - artigos Terminado → "prontos a entregar".
// Marcar Entregue=Sim remove daqui sem apagar o histórico.
function ex_pendentes($rows) {
    $fazer = array();
    $prontos = array();
    $detalhe = array();
    foreach ($rows as $r) {
        if (!is_array($r)) continue;
        if ((isset($r['entregue']) ? (string)$r['entregue'] : 'Não') === 'Sim') continue;
        $arts = isset($r['artigos']) && is_array($r['artigos']) ? array_values($r['artigos']) : array();
        foreach ($arts as $idx => $a) {
            if (!is_array($a)) continue;
            $prod = trim((string)(isset($a['produto']) ? $a['produto'] : ''));
            if ($prod === '') continue;
            $estado = trim((string)(isset($a['estado']) ? $a['estado'] : 'Por fazer'));
            if ($estado === '') $estado = 'Por fazer';
            $q = isset($a['quantidade']) ? (int)$a['quantidade'] : 0;
            if ($q < 0) $q = 0;
            $grupo = ($estado === 'Terminado') ? 'pronto' : 'fazer';
            if ($grupo === 'pronto') {
                if (!isset($prontos[$prod])) $prontos[$prod] = array('unidades' => 0, 'linhas' => 0);
                $prontos[$prod]['unidades'] += $q;
                $prontos[$prod]['linhas']++;
            } else {
                if (!isset($fazer[$prod])) $fazer[$prod] = array('unidades' => 0, 'linhas' => 0);
                $fazer[$prod]['unidades'] += $q;
                $fazer[$prod]['linhas']++;
            }
            $cfg = trim((string)(isset($a['configResumo']) ? $a['configResumo'] : ''));
            if ($cfg === '') {
                $cfg = trim((string)(isset($a['design']) ? $a['design'] : ''));
                $det = trim((string)(isset($a['detalhes']) ? $a['detalhes'] : ''));
                if ($det !== '') $cfg .= ($cfg !== '' ? ' · ' : '') . $det;
            }
            $img = trim((string)(isset($a['imagem']) ? $a['imagem'] : ''));
            if ($img === '') $img = ex_design_url($prod, trim((string)(isset($a['design']) ? $a['design'] : '')), false);
            $detalhe[] = array(
                'id' => isset($r['id']) ? (string)$r['id'] : '',
                'idx' => $idx,
                'cliente' => isset($r['cliente']) ? (string)$r['cliente'] : '',
                'data' => isset($r['data']) ? (string)$r['data'] : '',
                'produto' => $prod,
                'quantidade' => $q,
                'config' => $cfg,
                'imagem' => $img,
                'estado' => $estado,
                'grupo' => $grupo,
            );
        }
    }
    $ordena = function ($map) {
        $lista = array();
        foreach ($map as $prod => $v) {
            $lista[] = array('produto' => $prod, 'unidades' => $v['unidades'], 'linhas' => $v['linhas']);
        }
        usort($lista, function ($a, $b) {
            if ($a['unidades'] !== $b['unidades']) return $b['unidades'] - $a['unidades'];
            return strcmp($a['produto'], $b['produto']);
        });
        return $lista;
    };
    usort($detalhe, function ($a, $b) {
        if ($a['grupo'] !== $b['grupo']) return $a['grupo'] === 'fazer' ? -1 : 1;
        if ($a['data'] !== $b['data']) return strcmp($a['data'], $b['data']);
        return strcmp($a['id'], $b['id']);
    });
    return array('porFazer' => $ordena($fazer), 'prontos' => $ordena($prontos), 'detalhe' => $detalhe);
}

// ── Clientes: fichas separadas, totais calculados do arquivo. ──
//
// A ficha guarda dados pessoais e o histórico anterior ao arquivo
// (histórico nunca inventado: NIF só com 9 dígitos, TJ só explícito).
// totalGasto / numEncomendas saem sempre do arquivo + histórico.
function ex_clientes_path() { return mp_private_path('encomendas-excel-clientes.json'); }

function ex_read_clientes() {
    $path = ex_clientes_path();
    if ($path === null || !is_file($path)) return array();
    $raw = @file_get_contents($path);
    if ($raw === false || trim($raw) === '') return array();
    $d = json_decode($raw, true);
    return is_array($d) ? array_values($d) : array();
}

function ex_write_clientes($rows) {
    $path = ex_clientes_path();
    if ($path === null) return false;
    $tmp = $path . '.tmp';
    $ok = @file_put_contents($tmp, json_encode(array_values($rows), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    if ($ok === false) return false;
    @chmod($tmp, 0600);
    return @rename($tmp, $path);
}

function ex_next_client_id($rows) {
    $max = 0;
    foreach ($rows as $r) {
        if (isset($r['id']) && preg_match('/^CLI-(\d+)$/', (string)$r['id'], $m)) {
            $max = max($max, (int)$m[1]);
        }
    }
    return sprintf('CLI-%04d', $max + 1);
}

function ex_norm_nome($s) {
    $s = preg_replace('/\s+/u', ' ', trim((string)$s));
    if (function_exists('mb_strtolower')) $s = mb_strtolower($s, 'UTF-8');
    else $s = strtolower($s);
    return $s;
}

function ex_clientes_totais($clientes, $orders) {
    $tot = array();
    foreach ($clientes as $c) {
        if (!is_array($c) || empty($c['id'])) continue;
        $tot[(string)$c['id']] = array(
            'totalGasto' => isset($c['historicoGasto']) ? round((float)$c['historicoGasto'], 2) : 0.0,
            'numEncomendas' => isset($c['historicoEncomendas']) ? max(0, (int)$c['historicoEncomendas']) : 0,
            '_nome' => ex_norm_nome(isset($c['nome']) ? $c['nome'] : ''),
        );
    }
    foreach ($orders as $o) {
        if (!is_array($o)) continue;
        $t = isset($o['totalGuardar']) && is_numeric($o['totalGuardar']) ? (float)$o['totalGuardar'] : null;
        $cid = isset($o['clienteId']) ? (string)$o['clienteId'] : '';
        $key = null;
        if ($cid !== '' && isset($tot[$cid])) {
            $key = $cid;
        } else {
            $nm = ex_norm_nome(isset($o['cliente']) ? $o['cliente'] : '');
            if ($nm !== '') {
                foreach ($tot as $id => $v) {
                    if ($v['_nome'] !== '' && $v['_nome'] === $nm) { $key = $id; break; }
                }
            }
        }
        if ($key === null) continue;
        if ($t !== null) $tot[$key]['totalGasto'] = round($tot[$key]['totalGasto'] + $t, 2);
        $tot[$key]['numEncomendas']++;
    }
    $out = array();
    foreach ($tot as $id => $v) { unset($v['_nome']); $out[$id] = $v; }
    return $out;
}

function ex_validate_cliente($d) {
    $errors = array();
    $nome = trim((string)(isset($d['nome']) ? $d['nome'] : ''));
    if ($nome === '') $errors[] = 'O nome do cliente é obrigatório.';
    elseif (strlen($nome) > 120) $errors[] = 'O nome do cliente é demasiado longo.';
    $nif = trim((string)(isset($d['nif']) ? $d['nif'] : ''));
    if ($nif !== '' && !preg_match('/^\d{9}$/', $nif)) $errors[] = 'O NIF tem de ter 9 dígitos (ou ficar vazio).';
    $tj = isset($d['tj']) ? (string)$d['tj'] : '';
    if (!in_array($tj, array('', 'Sim', 'Não'), true)) $errors[] = 'TJ inválido.';
    foreach (array('morada' => 500, 'codPostal' => 32, 'localidade' => 120, 'congregacao' => 120, 'telemovel' => 32, 'email' => 254, 'cartao' => 32) as $k => $max) {
        if (strlen(trim((string)(isset($d[$k]) ? $d[$k] : ''))) > $max) $errors[] = 'Campo "' . $k . '" demasiado longo.';
    }
    if (strlen(trim((string)(isset($d['observacoes']) ? $d['observacoes'] : ''))) > 2000) $errors[] = 'Observações demasiado longas.';
    return $errors;
}

// ── Arquivo independente (JSON privado). ──
function ex_store_path() { return mp_private_path('encomendas-excel-registos.json'); }

function ex_read_store() {
    $path = ex_store_path();
    if ($path === null || !is_file($path)) return array();
    $raw = @file_get_contents($path);
    if ($raw === false || trim($raw) === '') return array();
    $d = json_decode($raw, true);
    return is_array($d) ? $d : array();
}

function ex_write_store($rows) {
    $path = ex_store_path();
    if ($path === null) return false;
    $tmp = $path . '.tmp';
    $ok = @file_put_contents($tmp, json_encode(array_values($rows), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    if ($ok === false) return false;
    @chmod($tmp, 0600);
    return @rename($tmp, $path);
}

function ex_next_id($rows) {
    $max = 0;
    foreach ($rows as $r) {
        if (isset($r['id']) && preg_match('/^ENC-(\d+)$/', (string)$r['id'], $m)) {
            $max = max($max, (int)$m[1]);
        }
    }
    return sprintf('ENC-%04d', $max + 1);
}

function ex_find($rows, $id) {
    foreach ($rows as $i => $r) {
        if (isset($r['id']) && (string)$r['id'] === (string)$id) return $i;
    }
    return null;
}

// ── API JSON (mesmo ficheiro). ──
if ($ex_action === 'pendentes') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('ok' => true, 'pendentes' => ex_pendentes(ex_read_store())), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($ex_action === 'clientes') {
    $fichas = ex_read_clientes();
    $totais = ex_clientes_totais($fichas, ex_read_store());
    $out = array();
    foreach ($fichas as $c) {
        if (!is_array($c) || empty($c['id'])) continue;
        $id = (string)$c['id'];
        $c['totalGasto'] = isset($totais[$id]) ? $totais[$id]['totalGasto'] : 0.0;
        $c['numEncomendas'] = isset($totais[$id]) ? $totais[$id]['numEncomendas'] : 0;
        $out[] = $c;
    }
    usort($out, function ($a, $b) { return strcasecmp((string)$a['nome'], (string)$b['nome']); });
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('ok' => true, 'clientes' => $out), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($ex_action === 'listar' || $ex_action === 'carregar' || $ex_action === 'exportar') {
    $rows = ex_read_store();
    if ($ex_action === 'listar') {
        $out = array();
        foreach ($rows as $r) {
            $out[] = array(
                'id' => isset($r['id']) ? $r['id'] : '',
                'data' => isset($r['data']) ? $r['data'] : '',
                'cliente' => isset($r['cliente']) ? $r['cliente'] : '',
                'total' => isset($r['totalGuardar']) ? $r['totalGuardar'] : null,
            );
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => true, 'encomendas' => $out), JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($ex_action === 'carregar') {
        $i = ex_find($rows, $ex_encomenda_param);
        if ($i === null) {
            http_response_code(404);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('ok' => false, 'error' => 'Encomenda não encontrada.'), JSON_UNESCAPED_UNICODE);
            exit;
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => true, 'encomenda' => $rows[$i]), JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($ex_action === 'exportar') {
        while (ob_get_level() > 0) { ob_end_clean(); }
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="encomendas-excel-' . gmdate('Ymd-His') . '.json"');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        echo json_encode(array_values($rows), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
}

$ex_api_error = null;
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);
    if (!is_array($payload)) $payload = array();
    $sent = isset($payload['csrf']) ? (string)$payload['csrf'] : '';
    if (!mp_admin_csrf_is_valid($sent)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => false, 'error' => 'CSRF inválido. Recarrega a página e tenta novamente.'), JSON_UNESCAPED_UNICODE);
        exit;
    }
    $op = isset($payload['op']) ? (string)$payload['op'] : 'guardar';
    if ($op === 'guardar_cliente') {
        $errors = ex_validate_cliente($payload);
        if (!empty($errors)) {
            http_response_code(422);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('ok' => false, 'errors' => $errors), JSON_UNESCAPED_UNICODE);
            exit;
        }
        $fichas = ex_read_clientes();
        $cid = trim((string)(isset($payload['id']) ? $payload['id'] : ''));
        $cidx = null;
        foreach ($fichas as $i => $c) {
            if (is_array($c) && isset($c['id']) && (string)$c['id'] === $cid && $cid !== '') { $cidx = $i; break; }
        }
        $base = ($cidx !== null && is_array($fichas[$cidx])) ? $fichas[$cidx] : array();
        $ficha = array(
            'id' => ($cidx !== null) ? (string)$base['id'] : ex_next_client_id($fichas),
            'nome' => trim((string)$payload['nome']),
            'nif' => trim((string)(isset($payload['nif']) ? $payload['nif'] : '')),
            'morada' => trim((string)(isset($payload['morada']) ? $payload['morada'] : '')),
            'codPostal' => trim((string)(isset($payload['codPostal']) ? $payload['codPostal'] : '')),
            'localidade' => trim((string)(isset($payload['localidade']) ? $payload['localidade'] : '')),
            'congregacao' => trim((string)(isset($payload['congregacao']) ? $payload['congregacao'] : '')),
            'tj' => isset($payload['tj']) ? (string)$payload['tj'] : '',
            'telemovel' => trim((string)(isset($payload['telemovel']) ? $payload['telemovel'] : '')),
            'email' => trim((string)(isset($payload['email']) ? $payload['email'] : '')),
            'cartao' => trim((string)(isset($payload['cartao']) ? $payload['cartao'] : '')),
            'observacoes' => trim((string)(isset($payload['observacoes']) ? $payload['observacoes'] : '')),
            'historicoGasto' => isset($base['historicoGasto']) ? (float)$base['historicoGasto'] : 0.0,
            'historicoEncomendas' => isset($base['historicoEncomendas']) ? (int)$base['historicoEncomendas'] : 0,
            'origem' => isset($base['origem']) ? (string)$base['origem'] : '',
        );
        if ($cidx !== null) { $fichas[$cidx] = $ficha; } else { $fichas[] = $ficha; }
        if (!ex_write_clientes($fichas)) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(array('ok' => false, 'error' => 'Não foi possível escrever a ficha.'), JSON_UNESCAPED_UNICODE);
            exit;
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => true, 'id' => $ficha['id']), JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($op !== 'guardar') {
        http_response_code(400);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => false, 'error' => 'Operação desconhecida.'), JSON_UNESCAPED_UNICODE);
        exit;
    }
    $computed = null;
    $errors = ex_validate($payload, $computed);
    if (!empty($errors)) {
        http_response_code(422);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => false, 'errors' => $errors), JSON_UNESCAPED_UNICODE);
        exit;
    }
    $rows = ex_read_store();
    $wantId = trim((string)(isset($payload['encomenda']) ? $payload['encomenda'] : ''));
    if ($wantId === '' || strtolower($wantId) === 'nova') {
        $id = ex_next_id($rows);
        $idx = null;
    } else {
        $idx = ex_find($rows, $wantId);
        $id = ($idx === null) ? ex_next_id($rows) : $wantId;
        if ($idx === null) $idx = null;
    }
    $artigos = array();
    $slot = 0;
    $usados = array();
    foreach ((isset($payload['produtos']) && is_array($payload['produtos']) ? $payload['produtos'] : array()) as $p) {
        if (is_array($p) && trim((string)(isset($p['produto']) ? $p['produto'] : '')) !== '') $usados[] = $p;
    }
    foreach ($usados as $k => $p) {
        $slot++;
        $nomeProd = trim((string)$p['produto']);
        $fin = isset($computed['produtos'][$k]['final']) ? $computed['produtos'][$k]['final'] : null;
        $artigos[] = array(
            'slot' => $slot,
            'produto' => $nomeProd,
            'quantidade' => (int)$p['quantidade'],
            'design' => trim((string)(isset($p['design']) ? $p['design'] : '')),
            'imagem' => ex_design_url($nomeProd, trim((string)(isset($p['design']) ? $p['design'] : ''))),
            'acabamento' => trim((string)(isset($p['acabamento']) ? $p['acabamento'] : '')),
            'comNome' => isset($p['comNome']) ? $p['comNome'] : 'Não',
            'nome' => trim((string)(isset($p['nome']) ? $p['nome'] : '')),
            'cantos' => isset($p['cantos']) ? $p['cantos'] : 'Não',
            'fita' => trim((string)(isset($p['fita']) ? $p['fita'] : '')),
            'designA6' => trim((string)(isset($p['designA6']) ? $p['designA6'] : '')),
            'imagemA6' => ex_design_url($nomeProd, trim((string)(isset($p['designA6']) ? $p['designA6'] : '')), true),
            'acabamentoA6' => trim((string)(isset($p['acabamentoA6']) ? $p['acabamentoA6'] : '')),
            'comNomeA6' => isset($p['comNomeA6']) ? $p['comNomeA6'] : 'Não',
            'nomeA6' => trim((string)(isset($p['nomeA6']) ? $p['nomeA6'] : '')),
            'cantosA6' => isset($p['cantosA6']) ? $p['cantosA6'] : 'Não',
            'fitaA6' => trim((string)(isset($p['fitaA6']) ? $p['fitaA6'] : '')),
            'tipoCapa' => trim((string)(isset($p['tipoCapa']) ? $p['tipoCapa'] : '')),
            'holo' => isset($p['holo']) ? $p['holo'] : 'Não',
            'frenteVerso' => isset($p['frenteVerso']) ? $p['frenteVerso'] : 'Não',
            'furo' => isset($p['furo']) ? $p['furo'] : 'Não',
            'margem' => isset($p['margem']) ? $p['margem'] : 'Não',
            'holoUn' => isset($p['holoUn']) ? $p['holoUn'] : 'Não',
            'nArtes' => (int)(isset($p['nArtes']) ? $p['nArtes'] : 0),
            'detalhes' => trim((string)(isset($p['detalhes']) ? $p['detalhes'] : '')),
            'estado' => isset($p['estado']) ? $p['estado'] : 'Por fazer',
            'precoManual' => trim((string)(isset($p['precoManual']) ? $p['precoManual'] : '')),
            'configResumo' => ex_config_resumo($p),
            'preco' => is_int($fin) ? round($fin / 100, 2) : null,
        );
    }
    $rec = array(
        'id' => $id,
        'clienteId' => substr(trim((string)(isset($payload['clienteId']) ? $payload['clienteId'] : '')), 0, 16),
        'data' => trim((string)(isset($payload['data']) ? $payload['data'] : '')),
        'cliente' => trim((string)(isset($payload['cliente']) ? $payload['cliente'] : '')),
        'pago' => isset($payload['pago']) ? $payload['pago'] : 'Não',
        'dataPago' => trim((string)(isset($payload['dataPago']) ? $payload['dataPago'] : '')),
        'entregue' => isset($payload['entregue']) ? $payload['entregue'] : 'Não',
        'dataEntrega' => trim((string)(isset($payload['dataEntrega']) ? $payload['dataEntrega'] : '')),
        'fatura' => isset($payload['fatura']) ? $payload['fatura'] : 'Não',
        'referencia' => trim((string)(isset($payload['referencia']) ? $payload['referencia'] : '')),
        'entrega' => trim((string)(isset($payload['entrega']) ? $payload['entrega'] : '')),
        'portesManuais' => trim((string)(isset($payload['portesManuais']) ? $payload['portesManuais'] : '')),
        'ajuste' => trim((string)(isset($payload['ajuste']) ? $payload['ajuste'] : '0')),
        'motivoAjuste' => trim((string)(isset($payload['motivoAjuste']) ? $payload['motivoAjuste'] : '')),
        'observacoes' => trim((string)(isset($payload['observacoes']) ? $payload['observacoes'] : '')),
        'totalCalculado' => $computed['totalCalc'],
        'totalAcordado' => trim((string)(isset($payload['totalAcordado']) ? $payload['totalAcordado'] : '')),
        'totalGuardar' => $computed['totalGuardar'],
        'artigos' => $artigos,
        'origem' => substr(trim((string)(isset($payload['origem']) ? $payload['origem'] : '')), 0, 32),
        'actualizadoEm' => gmdate('Y-m-d\TH:i:s\Z'),
    );
    if ($idx === null) { $rows[] = $rec; } else { $rows[$idx] = $rec; }
    if (!ex_write_store($rows)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => false, 'error' => 'Não foi possível escrever o arquivo. Verifica as permissões da pasta privada.'), JSON_UNESCAPED_UNICODE);
        exit;
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('ok' => true, 'id' => $id, 'total' => $computed['totalGuardar']), JSON_UNESCAPED_UNICODE);
    exit;
}

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Encomendas Excel · Mia &amp; Paper</title>
<link rel="stylesheet" href="admin-nav.css?v=20260924003922">
<script src="admin-nav.js?v=20260924003922" defer></script>
<style>
:root {
  --ex-fundo: #fffbe9; --ex-cartao: #fff8df; --ex-linha: rgba(118,85,28,.22);
  --ex-tinta: #3b2f1f; --ex-suave: #76551c; --ex-ouro: #b88616; --ex-musgo: #4f7a3a;
  --ex-erro: #b6463a; --ex-branco: #fff;
}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; background: var(--ex-fundo); color: var(--ex-tinta);
  font-family: Georgia, "Times New Roman", serif; line-height: 1.5; }
.ex-concha { max-width: 1080px; margin: 0 auto; padding: 20px 18px 90px; }
.ex-cabeca { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; flex-wrap: wrap;
  border-bottom: 1px solid var(--ex-linha); padding-bottom: 10px; margin-bottom: 18px; }
.ex-cabeca h1 { margin: 0; font-size: 1.45rem; }
.ex-cabeca p { margin: 2px 0 0; color: var(--ex-suave); font-size: .9rem; }
.ex-passo { background: var(--ex-cartao); border: 1px solid var(--ex-linha); border-radius: 12px;
  padding: 16px 18px; margin: 0 0 16px; }
.ex-passo > h2 { margin: 0 0 4px; font-size: 1.08rem; }
.ex-passo > p.ex-ajuda { margin: 0 0 12px; color: var(--ex-suave); font-size: .88rem; }
.ex-grelha { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px 14px; }
label.ex-campo { display: grid; gap: 4px; font-size: .88rem; }
label.ex-campo > span { color: var(--ex-suave); font-weight: 700; }
label.ex-campo input, label.ex-campo select, label.ex-campo textarea {
  padding: 8px 10px; border: 1px solid var(--ex-linha); border-radius: 8px;
  background: rgba(255,255,255,.65); font: inherit; color: var(--ex-tinta); width: 100%; }
label.ex-campo textarea { min-height: 56px; resize: vertical; }
label.ex-campo input:disabled, label.ex-campo select:disabled { opacity: .45; }
.ex-leitura { padding: 8px 10px; border: 1px dashed var(--ex-linha); border-radius: 8px;
  background: rgba(255,255,255,.4); font-weight: 700; min-height: 38px; }
.ex-leitura small { display: block; font-weight: 400; color: var(--ex-suave); }
.ex-linha-btns { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
button.ex-btn { padding: 9px 18px; border-radius: 9px; border: 1px solid var(--ex-ouro);
  background: var(--ex-ouro); color: #fff; font-weight: 800; font-family: inherit;
  cursor: pointer; font-size: .92rem; }
button.ex-btn.secundario { background: transparent; color: var(--ex-ouro); }
button.ex-btn.perigo { background: var(--ex-erro); border-color: var(--ex-erro); }
button.ex-btn:disabled { opacity: .5; cursor: wait; }
.ex-msg { padding: 10px 14px; border-radius: 10px; margin: 0 0 12px; font-weight: 700; display: none; }
.ex-msg.ok { display: block; background: rgba(79,122,58,.12); border: 1px solid rgba(79,122,58,.35); color: var(--ex-musgo); }
.ex-msg.erro { display: block; background: rgba(182,70,58,.10); border: 1px solid rgba(182,70,58,.32); color: var(--ex-erro); }
.ex-msg ul { margin: 6px 0 0; padding-left: 20px; font-weight: 400; }
.ex-img { font-size: .82rem; }
.ex-img a { color: var(--ex-musgo); font-weight: 700; }
table.ex-lista { width: 100%; border-collapse: collapse; background: var(--ex-branco);
  border: 1px solid var(--ex-linha); border-radius: 10px; overflow: hidden; font-size: .9rem; }
table.ex-lista th, table.ex-lista td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--ex-linha); }
table.ex-lista th { background: rgba(184,134,22,.08); color: var(--ex-suave); font-size: .78rem;
  text-transform: uppercase; letter-spacing: .04em; }
table.ex-lista td.num { text-align: right; font-weight: 800; }
.ex-miudo { color: var(--ex-suave); font-size: .84rem; }
.ex-sub { margin: 14px 0 6px; font-size: .95rem; color: var(--ex-suave);
  text-transform: uppercase; letter-spacing: .04em; }
.ex-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.ex-chip { display: inline-block; padding: 6px 12px; border-radius: 999px;
  border: 1px solid var(--ex-linha); background: rgba(255,255,255,.55);
  font-size: .86rem; }
.ex-chip strong { font-weight: 800; }
.ex-chip small { color: var(--ex-suave); }
.ex-filtro.is-on { background: var(--ex-ouro); color: #fff; border-color: var(--ex-ouro); }
.ex-tabs { display: flex; gap: 6px; margin: 0 0 14px; }
.ex-tabs button { flex: 1 1 auto; padding: 10px 8px; border-radius: 10px; border: 1px solid var(--ex-linha);
  background: rgba(255,255,255,.5); color: var(--ex-suave); font-weight: 800; font-family: inherit;
  cursor: pointer; font-size: .92rem; }
.ex-tabs button.is-on { background: var(--ex-ouro); border-color: var(--ex-ouro); color: #fff; }
#fabAdd { position: fixed; right: 18px; bottom: 18px; z-index: 1200; width: 60px; height: 60px;
  border-radius: 50%; border: none; background: var(--ex-ouro); color: #fff; font-size: 2rem;
  line-height: 1; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.25); font-family: inherit; }
#fabAdd:hover { filter: brightness(1.06); }
#modal[hidden] { display: none; }
#modal { position: fixed; inset: 0; z-index: 1100; background: rgba(59,47,31,.45);
  overflow-y: auto; padding: 18px 12px 60px; }
.ex-modal-box { max-width: 860px; margin: 0 auto; background: var(--ex-fundo);
  border-radius: 14px; padding: 16px 18px 26px; box-shadow: 0 14px 44px rgba(0,0,0,.3); }
.ex-modal-topo { display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid var(--ex-linha); padding-bottom: 8px; margin-bottom: 12px; }
.ex-modal-topo strong { font-size: 1.15rem; }
#btnFecharModal { border: 1px solid var(--ex-linha); background: transparent; color: var(--ex-tinta);
  border-radius: 50%; width: 34px; height: 34px; font-size: 1.2rem; cursor: pointer; font-family: inherit; }
.ex-steps { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.ex-steps button { flex: 1 1 auto; padding: 7px 6px; border-radius: 999px; border: 1px solid var(--ex-linha);
  background: rgba(255,255,255,.5); color: var(--ex-suave); font-weight: 700; font-family: inherit;
  cursor: pointer; font-size: .82rem; }
.ex-steps button.is-on { background: var(--ex-musgo); border-color: var(--ex-musgo); color: #fff; }
.ex-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.ex-job { background: var(--ex-branco); border: 1px solid var(--ex-linha); border-radius: 12px;
  overflow: hidden; cursor: pointer; text-align: left; font-family: inherit; color: var(--ex-tinta);
  padding: 0; display: block; width: 100%; }
.ex-job:hover { border-color: var(--ex-ouro); }
.ex-job img { width: 100%; height: 150px; object-fit: cover; display: block; background: #f0ede6; }
.ex-job-semimg { height: 44px; display: flex; align-items: center; justify-content: center;
  color: var(--ex-suave); font-size: .8rem; background: #f0ede6; }
.ex-job-corpo { padding: 10px 12px; display: grid; gap: 2px; }
.ex-job-corpo strong { font-size: .95rem; }
.ex-job-corpo small { color: var(--ex-suave); font-size: .8rem; }
.ex-job-linha { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ex-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: .76rem; font-weight: 800; }
.ex-badge.fazer { background: rgba(184,134,22,.16); color: var(--ex-ouro); }
.ex-badge.pronto { background: rgba(79,122,58,.16); color: var(--ex-musgo); }
.ex-job-avancar { border: 1px solid var(--ex-musgo); background: transparent; color: var(--ex-musgo);
  border-radius: 8px; font-weight: 800; font-family: inherit; cursor: pointer;
  font-size: .78rem; padding: 4px 10px; }
.ex-staging { display: grid; gap: 8px; margin: 0 0 12px; }
.ex-staging-item { display: flex; justify-content: space-between; align-items: center; gap: 10px;
  border: 1px solid var(--ex-linha); border-radius: 10px; padding: 8px 12px;
  background: rgba(255,255,255,.5); font-size: .9rem; }
.ex-staging-item small { color: var(--ex-suave); display: block; }
.ex-staging-item .ex-preco { font-weight: 800; white-space: nowrap; }
.ex-linklike { border: none; background: none; color: var(--ex-musgo); font-weight: 800;
  cursor: pointer; font-family: inherit; font-size: .86rem; padding: 2px 4px; }
a.ex-voltar { color: var(--ex-musgo); font-weight: 800; text-decoration: none; }
@media (max-width: 640px) { .ex-concha { padding: 14px 12px 70px; } .ex-passo { padding: 12px; } }
</style>
</head>
<body>
<?= mp_parametros_barra('encomendas-excel.php') ?>
<div class="ex-concha">
  <div class="ex-cabeca">
    <div>
      <h1>Encomendas Excel</h1>
      <p>Balção interno — reimplementação do livro Excel, sem dependências do site.</p>
    </div>
    <div class="ex-linha-btns">
      <a class="ex-voltar" href="index.html">← Voltar ao site</a>
      <a class="ex-voltar" href="encomendas-excel.php?action=exportar">⤓ Cópia JSON</a>
    </div>
  </div>

  <div class="ex-tabs" role="tablist" aria-label="Vistas">
    <button type="button" data-tab="pendentes" class="is-on">Pendentes</button>
    <button type="button" data-tab="encomendas">Encomendas</button>
    <button type="button" data-tab="clientes">Clientes</button>
  </div>

  <section id="tab-pendentes" class="ex-passo" aria-label="Trabalhos pendentes">
    <div class="ex-linha-btns" role="group" aria-label="Filtrar pendentes">
      <button class="ex-btn secundario ex-filtro is-on" data-f="todos" type="button">Todos</button>
      <button class="ex-btn secundario ex-filtro" data-f="fazer" type="button">Por fazer / em produção</button>
      <button class="ex-btn secundario ex-filtro" data-f="pronto" type="button">Prontos a entregar</button>
    </div>
    <h3 class="ex-sub">Por fazer / em produção</h3>
    <div id="pendResumoFazer"><p class="ex-miudo">A carregar…</p></div>
    <h3 class="ex-sub">Prontos a entregar</h3>
    <div id="pendResumoProntos"><p class="ex-miudo">A carregar…</p></div>
    <h3 class="ex-sub">Trabalhos</h3>
    <div id="pendCards"><p class="ex-miudo">A carregar…</p></div>
  </section>

  <section id="tab-encomendas" class="ex-passo" aria-label="Encomendas" hidden>
    <h2>Encomendas</h2>
    <p class="ex-ajuda">Arquivo desta ferramenta. Clica para abrir no compositor.</p>
    <div id="wrapLista"><p class="ex-miudo">A carregar…</p></div>
  </section>

  <section id="tab-clientes" class="ex-passo" aria-label="Clientes" hidden>
    <h2>Clientes</h2>
    <div class="ex-linha-btns">
      <button class="ex-btn secundario" id="btnNovaFichaTab" type="button">Nova ficha</button>
    </div>
    <div id="wrapClientes"><p class="ex-miudo">A carregar…</p></div>
  </section>
</div>

<button id="fabAdd" type="button" aria-label="Adicionar encomenda">+</button>

<div id="modal" hidden>
  <div class="ex-modal-box" role="dialog" aria-modal="true" aria-label="Compor encomenda">
    <div class="ex-modal-topo">
      <strong id="modalTitulo">Nova encomenda</strong>
      <button id="btnFecharModal" type="button" aria-label="Fechar">×</button>
    </div>
    <div class="ex-steps" role="group" aria-label="Passos">
      <button type="button" data-ms="cliente" class="is-on">1 · Cliente</button>
      <button type="button" data-ms="produto">2 · Produto</button>
      <button type="button" data-ms="config">3 · Configurar</button>
      <button type="button" data-ms="rever">4 · Rever</button>
    </div>
    <div class="ex-msg" id="exMsg" role="status"></div>

    <div id="msCliente">
      <div class="ex-grelha">
        <label class="ex-campo"><span>Cliente *</span><select id="fClienteSel"></select></label>
        <label class="ex-campo" id="wrapClienteAvulso" style="display:none"><span>Nome (avulso) *</span>
          <input id="fClienteAvulso" autocomplete="off" placeholder="Nome para esta encomenda"></label>
        <label class="ex-campo"><span>Data</span><input id="fData" type="date"></label>
      </div>
      <div class="ex-grelha" id="fichaCliente" style="margin-top:10px">
        <label class="ex-campo"><span>Nome *</span><input id="cNome" autocomplete="off"></label>
        <label class="ex-campo"><span>NIF</span><input id="cNif" inputmode="numeric" autocomplete="off" placeholder="9 dígitos"></label>
        <label class="ex-campo"><span>Morada</span><input id="cMorada" autocomplete="off"></label>
        <label class="ex-campo"><span>Código postal</span><input id="cCP" autocomplete="off"></label>
        <label class="ex-campo"><span>Localidade</span><input id="cLoc" autocomplete="off"></label>
        <label class="ex-campo"><span>Congregação</span><input id="cCong" autocomplete="off"></label>
        <label class="ex-campo"><span>TJ?</span>
          <select id="cTJ"><option value="">—</option><option>Sim</option><option>Não</option></select></label>
        <label class="ex-campo"><span>Telemóvel</span><input id="cTel" autocomplete="off"></label>
        <label class="ex-campo"><span>Email</span><input id="cMail" autocomplete="off"></label>
        <label class="ex-campo"><span>N.º cartão Mia &amp; Paper</span><input id="cCartao" autocomplete="off"></label>
        <label class="ex-campo"><span>Observações</span><textarea id="cObs"></textarea></label>
        <label class="ex-campo"><span>Total já gasto / encomendas</span><div class="ex-leitura" id="cTotais">—</div></label>
      </div>
      <div class="ex-linha-btns">
        <button class="ex-btn secundario" id="btnNovoCliente" type="button">Novo cliente</button>
        <button class="ex-btn secundario" id="btnGuardarCliente" type="button">Guardar cliente</button>
        <button class="ex-btn" id="btnCliSeguinte" type="button">Seguinte →</button>
      </div>
    </div>

    <div id="msProduto" hidden>
      <p class="ex-ajuda" id="fonteCatalogo"></p>
      <div class="ex-grelha">
        <label class="ex-campo"><span>Produto *</span><select id="mProduto"></select></label>
      </div>
      <div class="ex-linha-btns">
        <button class="ex-btn secundario" id="btnVoltarCliente" type="button">← Cliente</button>
        <button class="ex-btn" id="btnIrConfigurar" type="button">Configurar →</button>
      </div>
      <h3 class="ex-sub">Produtos na encomenda</h3>
      <div id="stagingList"><p class="ex-miudo">Ainda sem produtos.</p></div>
    </div>

    <div id="msConfig" hidden>
      <div id="configCardWrap"></div>
      <div class="ex-linha-btns">
        <button class="ex-btn secundario" id="btnVoltarProduto" type="button">← Produtos</button>
        <button class="ex-btn" id="btnAddProduto" type="button">Adicionar produto</button>
      </div>
    </div>

    <div id="msRever" hidden>
      <div id="revResumo"></div>
      <div class="ex-grelha">
        <label class="ex-campo"><span>1. Pago?</span>
          <select id="fPago"><option>Não</option><option>Sim</option></select></label>
        <label class="ex-campo"><span>Data pagamento (opcional)</span><input id="fDataPago" type="date"></label>
        <label class="ex-campo"><span>2. Entregue?</span>
          <select id="fEntregue"><option>Não</option><option>Sim</option></select></label>
        <label class="ex-campo"><span>Data entrega (opcional)</span><input id="fDataEntrega" type="date"></label>
        <label class="ex-campo"><span>3. Fatura?</span>
          <select id="fFatura"><option>Não</option><option>Sim</option></select></label>
        <label class="ex-campo"><span>Referência (opcional)</span><input id="fReferencia" autocomplete="off"></label>
        <label class="ex-campo"><span>4. Método de entrega *</span><select id="fEntrega"></select></label>
        <label class="ex-campo"><span>Portes manuais (opcional)</span>
          <input id="fPortes" inputmode="decimal" placeholder="só para método Outro"></label>
        <label class="ex-campo"><span>5. Ajuste € (+/-)</span><input id="fAjuste" inputmode="decimal" value="0"></label>
        <label class="ex-campo"><span>Motivo do ajuste</span><input id="fMotivo" autocomplete="off"></label>
        <label class="ex-campo"><span>6. Observações</span><textarea id="fObs"></textarea></label>
        <label class="ex-campo"><span>Total calculado</span><div class="ex-leitura" id="vTotalCalc">—</div></label>
        <label class="ex-campo"><span>Total acordado (opcional)</span><input id="fTotalAcordado" inputmode="decimal"></label>
        <label class="ex-campo"><span>Total a guardar</span><div class="ex-leitura" id="vTotalGuardar">—</div></label>
      </div>
      <div class="ex-linha-btns">
        <button class="ex-btn secundario" id="btnVoltarConfig" type="button">← Adicionar mais</button>
        <button class="ex-btn" id="btnGuardar" type="button">Guardar encomenda</button>
      </div>
    </div>
  </div>
</div>

<script id="excel-data" type="application/json"><?= json_encode(ex_cat(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
<script>
(function () {
  "use strict";
  var DATA = JSON.parse(document.getElementById("excel-data").textContent || "{}");
  var CSRF = <?= json_encode($csrf) ?>;
  var PRELOAD = <?= json_encode($ex_encomenda_param) ?>;

  function $(id) { return document.getElementById(id); }
  function eur(v) {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "string") return v;
    return v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €";
  }
  function num(v) {
    if (v === null || v === undefined) return NaN;
    var s = String(v).trim().replace(",", ".");
    if (s === "") return NaN;
    return Number(s);
  }
  function eurC(cents) {
    if (cents === null || cents === undefined || cents === "") return "—";
    if (typeof cents === "string") return cents;
    return eur(cents / 100);
  }
  function cfgOf(name) {
    var cfg = DATA.cfg || {};
    return cfg[String(name)] || null;
  }
  function extra(key) {
    var v = DATA.extras ? DATA.extras[key] : undefined;
    v = Number(v);
    return isFinite(v) ? Math.round(v) : 0;
  }
  function artesFee(name) {
    var v = DATA.artesFee ? DATA.artesFee[String(name)] : undefined;
    v = Number(v);
    return isFinite(v) ? Math.round(v) : 300;
  }
  // Preço base em CÊNTIMOS. Regra tier igual à do servidor.
  function basePrice(name, qtyRaw, design) {
    var cfg = cfgOf(name);
    if (!cfg) return "Rever quantidade";
    var modo = String(cfg.modo || ""), min = Number(cfg.min || 1);
    var qty = Number(qtyRaw);
    if (!isFinite(qty) || Math.floor(qty) !== qty || qty < min) return "Rever quantidade";
    if (DATA.designPrice && DATA.designPrice[String(name)] && Object.keys(DATA.designPrice[String(name)]).length) {
      var mapa = DATA.designPrice[String(name)];
      if (mapa[String(design)] !== undefined) return Math.round(mapa[String(design)]) * qty;
      var vals = Object.keys(mapa).map(function (k) { return Number(mapa[k]); }).filter(isFinite);
      if (!vals.length) return "Rever quantidade";
      return Math.round(Math.min.apply(null, vals)) * qty;
    }
    if (DATA.flat && DATA.flat[String(name)] !== undefined) {
      return Math.round(Number(DATA.flat[String(name)])) * qty;
    }
    if (modo === "tier" && DATA.tiers && DATA.tiers[String(name)]) {
      var tab = DATA.tiers[String(name)];
      var tiers = Object.keys(tab).map(function (k) { return [Number(k), Number(tab[k])]; })
        .filter(function (t) { return t[0] > 0 && isFinite(t[1]); })
        .sort(function (a, b) { return a[0] - b[0]; });
      if (!tiers.length) return "Rever quantidade";
      for (var i = 0; i < tiers.length; i++) {
        if (tiers[i][0] === qty) return Math.round(tiers[i][1]);
      }
      var sq = 0, st = 0, j;
      for (j = 0; j < tiers.length; j++) {
        if (tiers[j][0] <= qty || sq === 0) { sq = tiers[j][0]; st = tiers[j][1]; }
        if (tiers[j][0] > qty) break;
      }
      if (sq <= 0) return "Rever quantidade";
      return Math.round(qty * st / sq);
    }
    return "Rever quantidade";
  }
  function productCalc(name, f) {
    var cfg = cfgOf(name);
    var tipo = cfg ? String(cfg.tipo || "") : "";
    var qty = Number(f.quantidade) || 0;
    var base = basePrice(name, f.quantidade, f.design);
    if (typeof base !== "number") return base;
    var porUn = 0;
    if ((tipo === "pasta" || tipo === "pack_pastas" || tipo === "agenda") && f.comNome === "Sim") porUn += extra("nome");
    if ((tipo === "pasta" || tipo === "pack_pastas") && f.cantos === "Sim") porUn += extra("cantos");
    if (tipo === "pack_pastas") {
      if (f.comNomeA6 === "Sim") porUn += extra("nome");
      if (f.cantosA6 === "Sim") porUn += extra("cantos");
    }
    if (isMarcadores(name) && Number(f.nArtes || 0) === 0) {
      if (f.holo === "Sim") porUn += extra("m1");
      if (f.frenteVerso === "Sim") porUn += extra("m2");
      if (f.furo === "Sim") porUn += extra("m3");
      if (f.margem === "Sim") porUn += extra("m4");
    }
    if (f.holoUn === "Sim" && DATA.holoUn && DATA.holoUn[String(name)] !== undefined) {
      porUn += Math.round(Number(DATA.holoUn[String(name)]));
    }
    var fixo = 0;
    if (f.tipoCapa === "Capa dura") fixo += extra("capaDura");
    fixo += (Number(f.nArtes) || 0) * artesFee(name);
    return base + qty * porUn + fixo;
  }
  function isMarcadores(name) {
    return String(name) === "Marcadores";
  }
  function entregaPortes(metodo) {
    var list = DATA.entrega || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i][0]) === String(metodo)) {
        var v = Number(list[i][1]);
        return isFinite(v) ? v : null;
      }
    }
    return null;
  }
  function designBase(design) {
    var sem = String(design || "").replace(/[\s\u00b7-]+Fita\s+\S+\s*$/i, "").replace(/[\s\u00b7-]+$/, "");
    return sem === "" ? String(design || "") : sem;
  }
  function designUrl(prod, design, isA6) {
    design = String(design || "");
    if (design === "") return "";
    var cands = [design];
    var base = designBase(design);
    if (base !== design) cands.push(base);
    var listas = [];
    if (isA6 && DATA.designsA6 && DATA.designsA6[String(prod)]) listas.push(DATA.designsA6[String(prod)]);
    if (DATA.designs && DATA.designs[String(prod)]) listas.push(DATA.designs[String(prod)]);
    var i, j, k;
    for (k = 0; k < cands.length; k++) {
      for (i = 0; i < listas.length; i++) {
        for (j = 0; j < listas[i].length; j++) {
          if (String(listas[i][j][0]) === cands[k]) return String(listas[i][j][1] || "");
        }
      }
    }
    var cfg = cfgOf(prod);
    var grupo = cfg ? String(cfg.grupo || "") : "";
    var tbl = DATA.lookup || [];
    for (k = 0; k < cands.length; k++) {
      var chaves = [grupo + "|" + cands[k], "Pasta A4|" + cands[k], "Pasta A6|" + cands[k]];
      for (i = 0; i < chaves.length; i++) {
        for (j = 0; j < tbl.length; j++) {
          if (String(tbl[j][0]) === chaves[i]) return String(tbl[j][3] || "");
        }
      }
    }
    return "";
  }
  function familiaOf(name) {
    var cfg = cfgOf(name);
    return cfg ? String(cfg.fam || "") : "";
  }
  function temAcab(prod) {
    return !!(DATA.acab && DATA.acab[String(prod)] && DATA.acab[String(prod)].length);
  }
  function temHoloUn(prod) {
    return !!(DATA.holoUn && DATA.holoUn[String(prod)] !== undefined);
  }

  var FIELDS = [
    ["quantidade", "1. Quantidade *", "number", "1"],
    ["design", "2. Design principal", "design", ""],
    ["acabamento", "3. Acabamento", "acab", ""],
    ["comNome", "4. Com nome?", "simnao", "Não"],
    ["nome", "Nome escolhido", "text", ""],
    ["cantos", "5. Cantos metálicos?", "simnao", "Não"],
    ["fita", "6. Fita", "fita", ""],
    ["designA6", "7. Design A6 (pack)", "designA6", ""],
    ["acabamentoA6", "8. Acabamento A6", "acabA6", ""],
    ["comNomeA6", "9. Com nome A6?", "simnao", "Não"],
    ["nomeA6", "Nome A6", "text", ""],
    ["cantosA6", "10. Cantos A6?", "simnao", "Não"],
    ["fitaA6", "11. Fita A6", "fita", ""],
    ["tipoCapa", "12. Tipo de capa", "capa", ""],
    ["holo", "13. Holográfico?", "simnao", "Não"],
    ["frenteVerso", "14. Frente e verso?", "simnao", "Não"],
    ["furo", "15. Buraquinho?", "simnao", "Não"],
    ["margem", "16. Margem plástica?", "simnao", "Não"],
    ["holoUn", "Holográfico unitário?", "simnao", "Não"],
    ["nArtes", "17. N.º artes próprias", "number", "0"],
    ["detalhes", "18. Detalhes / texto livre", "text", ""],
    ["estado", "Estado de produção", "estado", "Por fazer"]
  ];

  function optionList(kind, prod) {
    if (kind === "simnao") return ["Sim", "Não"];
    if (kind === "estado") return ["Por fazer", "Em produção", "Terminado"];
    if (kind === "fita") return (DATA.fitas || []).filter(Boolean);
    if (kind === "capa") return (DATA.tiposCapa || []).filter(Boolean);
    if (kind === "acab" || kind === "acabA6") {
      return (DATA.acab && DATA.acab[String(prod)] ? DATA.acab[String(prod)] : []).filter(Boolean);
    }
    if (kind === "design") {
      var live = DATA.designs && DATA.designs[String(prod)] ? DATA.designs[String(prod)] : [];
      return live.map(function (r) { return String(r[0]); });
    }
    if (kind === "designA6") {
      var liveA6 = DATA.designsA6 && DATA.designsA6[String(prod)] ? DATA.designsA6[String(prod)] : [];
      return liveA6.map(function (r) { return String(r[0]); });
    }
    return [];
  }

  function buildConfigCard() {
    var wrap = $("configCardWrap");
    wrap.innerHTML = "";
    var n = 0;
    var sec = document.createElement("div");
    sec.id = "card0";
    var h = document.createElement("h3");
    h.className = "ex-sub";
    h.id = "configCardTitle";
    h.textContent = "Configurar produto";
    sec.appendChild(h);
    var hprod = document.createElement("select");
    hprod.id = "prod0";
    hprod.style.display = "none";
    sec.appendChild(hprod);
    var grid = document.createElement("div");
    grid.className = "ex-grelha";
    FIELDS.forEach(function (fd) {
      var key = fd[0], rot = fd[1], kind = fd[2], def = fd[3];
      var lab = document.createElement("label");
      lab.className = "ex-campo";
      lab.dataset.wrap = key;
      var sp = document.createElement("span");
      sp.textContent = rot;
      lab.appendChild(sp);
      var el;
      if (kind === "number" || kind === "text") {
        el = document.createElement("input");
        if (kind === "number") el.setAttribute("inputmode", "numeric");
        el.value = def;
      } else {
        el = document.createElement("select");
        var opts = (kind === "design" || kind === "designA6" || kind === "acab" || kind === "acabA6") ? [""] : optionList(kind);
        if (kind !== "design" && kind !== "designA6" && kind !== "acab" && kind !== "acabA6") {
          opts = [""].concat(optionList(kind));
        }
        opts.forEach(function (o) {
          var op = document.createElement("option");
          op.value = o; op.textContent = o === "" ? "\u2014" : o;
          if (o === def) op.selected = true;
          el.appendChild(op);
        });
      }
      el.id = "p0_" + key;
      lab.appendChild(el);
      if (key === "design" || key === "designA6") {
        var div = document.createElement("div");
        div.className = "ex-img";
        div.id = "p0_" + key + "_img";
        lab.appendChild(div);
      }
      grid.appendChild(lab);
    });
    sec.appendChild(grid);
    var comp = document.createElement("div");
    comp.className = "ex-grelha";
    comp.style.marginTop = "10px";
    [["base", "Pre\u00e7o base"], ["calc", "Pre\u00e7o calculado"], ["manual", "Pre\u00e7o manual (opcional)", true], ["final", "Pre\u00e7o do produto"]].forEach(function (c) {
      var lab = document.createElement("label");
      lab.className = "ex-campo";
      var sp = document.createElement("span");
      sp.textContent = c[1];
      lab.appendChild(sp);
      if (c[2]) {
        var inp = document.createElement("input");
        inp.id = "p0_" + c[0];
        inp.setAttribute("inputmode", "decimal");
        lab.appendChild(inp);
      } else {
        var dv = document.createElement("div");
        dv.className = "ex-leitura";
        dv.id = "p0_" + c[0];
        dv.textContent = "\u2014";
        lab.appendChild(dv);
      }
      comp.appendChild(lab);
    });
    sec.appendChild(comp);
    wrap.appendChild(sec);
    var hp = $("prod0");
    ["", "—"].concat(DATA.ordem || []).forEach(function (p) {
      if (p === "—") return;
      var o = document.createElement("option");
      o.value = p; o.textContent = p === "" ? "—" : p;
      hp.appendChild(o);
    });
  }


  function readCard(n) {
    function v(k) { var el = $("p" + n + "_" + k); return el ? el.value : ""; }
    return {
      produto: $("prod" + n).value, quantidade: v("quantidade"), design: v("design"),
      acabamento: v("acabamento"), comNome: v("comNome"), nome: v("nome"),
      cantos: v("cantos"), fita: v("fita"), designA6: v("designA6"),
      acabamentoA6: v("acabamentoA6"), comNomeA6: v("comNomeA6"), nomeA6: v("nomeA6"),
      cantosA6: v("cantosA6"), fitaA6: v("fitaA6"), tipoCapa: v("tipoCapa"),
      holo: v("holo"), frenteVerso: v("frenteVerso"), furo: v("furo"),
      margem: v("margem"), holoUn: v("holoUn"), nArtes: v("nArtes"), detalhes: v("detalhes"),
      estado: v("estado"), precoManual: v("manual")
    };
  }

  // Valores vindos do arquivo Excel (ex.: designs antigos) podem não existir
  // nas listas actuais; nesse caso acrescenta-se a opção para não se perder
  // o valor guardado.
  function ensureOption(sel, val) {
    if (!sel || sel.tagName !== "SELECT") return;
    val = String(val);
    if (val === "") return;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === val) return;
    }
    var op = document.createElement("option");
    op.value = val;
    op.textContent = val + " (arquivo)";
    sel.appendChild(op);
  }

  function fillCard(n, a) {
    function s(k, val) {
      var el = $("p" + n + "_" + k);
      if (!el) return;
      var v = (val === null || val === undefined) ? "" : String(val);
      if (el.tagName === "SELECT" && v !== "") ensureOption(el, v);
      el.value = v;
    }
    s("quantidade", a.quantidade || 1); s("design", a.design || "");
    s("acabamento", a.acabamento || ""); s("comNome", a.comNome || "Não");
    s("nome", a.nome || ""); s("cantos", a.cantos || "Não"); s("fita", a.fita || "");
    s("designA6", a.designA6 || ""); s("acabamentoA6", a.acabamentoA6 || "");
    s("comNomeA6", a.comNomeA6 || "Não"); s("nomeA6", a.nomeA6 || "");
    s("cantosA6", a.cantosA6 || "Não"); s("fitaA6", a.fitaA6 || "");
    s("tipoCapa", a.tipoCapa || ""); s("holo", a.holo || "Não");
    s("frenteVerso", a.frenteVerso || "Não"); s("furo", a.furo || "Não");
    s("margem", a.margem || "Não"); s("holoUn", a.holoUn || "Não");
    s("nArtes", (a.nArtes === undefined ? 0 : a.nArtes));
    s("detalhes", a.detalhes || ""); s("estado", a.estado || "Por fazer");
    s("manual", a.precoManual || "");
  }

  function refreshOptions(n, key, kind) {
    var prod = $("prod" + n).value;
    var sel = $("p" + n + "_" + key);
    if (!sel) return;
    var cur = sel.value;
    sel.innerHTML = "";
    [["", "—"]].concat(optionList(kind, prod).map(function (o) { return [o, o]; })).forEach(function (pair) {
      var op = document.createElement("option");
      op.value = pair[0]; op.textContent = pair[1];
      sel.appendChild(op);
    });
    sel.value = cur;
  }

  function itemPrice(it) {
    var base = basePrice(it.produto, it.quantidade, it.design);
    var calc = productCalc(it.produto, it);
    var man = num(it.precoManual);
    var fin = isFinite(man) ? Math.round(man * 100) : calc;
    return { base: base, calc: calc, fin: fin };
  }

  function refreshCard0() {
    var card = $("card0");
    if (!card) return;
    var prod = $("prod0").value;
    var f = readCard(0);
    if (prod === "") {
      ["base", "calc", "final"].forEach(function (k) { $("p0_" + k).textContent = "\u2014"; });
      $("p0_design_img").innerHTML = "";
      $("p0_designA6_img").innerHTML = "";
      return;
    }
    var cfg = cfgOf(prod);
    var tipo = cfg ? String(cfg.tipo || "") : "";
    var showA6 = tipo === "pack_pastas";
    var showMarc = isMarcadores(prod);
    var comExtrasNome = (tipo === "pasta" || tipo === "pack_pastas" || tipo === "agenda");
    var comCantos = (tipo === "pasta" || tipo === "pack_pastas");
    card.querySelectorAll("[data-wrap]").forEach(function (w) {
      var k = w.dataset.wrap;
      if (["designA6", "acabamentoA6", "comNomeA6", "nomeA6", "cantosA6", "fitaA6"].indexOf(k) !== -1) {
        w.style.display = showA6 ? "" : "none";
      } else if (["holo", "frenteVerso", "furo", "margem"].indexOf(k) !== -1) {
        w.style.display = showMarc ? "" : "none";
      } else if (k === "holoUn") {
        w.style.display = (!showMarc && temHoloUn(prod)) ? "" : "none";
      } else if (k === "acabamento" || k === "acabamentoA6") {
        w.style.display = temAcab(prod) ? "" : "none";
      } else if (k === "fita" || k === "fitaA6") {
        w.style.display = (tipo === "pasta" || tipo === "pack_pastas") ? "" : "none";
      } else if (k === "comNome" || k === "nome" || k === "cantos") {
        w.style.display = comExtrasNome || comCantos ? "" : "none";
      } else if (k === "tipoCapa") {
        w.style.display = temAcab(prod) && (tipo === "agenda") ? "" : "none";
      } else {
        w.style.display = "";
      }
    });
    var p = itemPrice(f);
    $("p0_base").textContent = eurC(p.base);
    $("p0_calc").textContent = eurC(p.calc);
    $("p0_final").textContent = eurC(p.fin);
    var u = f.design ? designUrl(prod, f.design, false) : "";
    $("p0_design_img").innerHTML = u
      ? '<a href="' + u.replace(/"/g, "") + '" target="_blank" rel="noopener"><img src="' + u.replace(/"/g, "")
        + '" alt="" loading="lazy" style="max-width:100%;max-height:160px;display:block;border-radius:6px;margin-bottom:4px;">Ver imagem</a>'
      : "Sem imagem";
    var u6 = f.designA6 ? designUrl(prod, f.designA6, true) : "";
    $("p0_designA6_img").innerHTML = showA6
      ? (u6 ? '<a href="' + u6.replace(/"/g, "") + '" target="_blank" rel="noopener"><img src="' + u6.replace(/"/g, "")
        + '" alt="" loading="lazy" style="max-width:100%;max-height:160px;display:block;border-radius:6px;margin-bottom:4px;">Ver imagem A6</a>'
        : "Sem imagem") : "";
  }

  function totaisStaging() {
    var finais = [], ok = true;
    STAGE.forEach(function (it) {
      var p = itemPrice(it);
      if (typeof p.fin !== "number") ok = false;
      else finais.push(p.fin);
    });
    var metodo = $("fEntrega").value;
    var portesRaw = $("fPortes").value.trim();
    var ajusteRaw = ($("fAjuste").value || "0").trim();
    if (!STAGE.length) return { total: null, aviso: "" };
    if (!ok) return { total: null, aviso: "Rever quantidades/pre\u00e7os" };
    if ((metodo === "" || metodo === "Outro") && portesRaw === "") return { total: null, aviso: "Indicar entrega/portes" };
    var portes = portesRaw !== "" ? Math.round(num(portesRaw) * 100) : (function () {
      var p = entregaPortes(metodo);
      return p === null ? NaN : Math.round(p * 100);
    })();
    var aj = ajusteRaw === "" ? 0 : Math.round(num(ajusteRaw) * 100);
    if (!isFinite(portes) || !isFinite(aj)) return { total: null, aviso: "Rever quantidades/pre\u00e7os" };
    var soma = 0;
    finais.forEach(function (x) { soma += x; });
    return { total: soma + portes + aj, aviso: "" };
  }

  function renderStaging() {
    var w = $("stagingList");
    if (!STAGE.length) {
      w.innerHTML = '<p class="ex-miudo">Ainda sem produtos. Escolhe um produto e prime Configurar.</p>';
      return;
    }
    var h = '<div class="ex-staging">';
    STAGE.forEach(function (it, i) {
      var p = itemPrice(it);
      h += '<div class="ex-staging-item"><div><strong>' + esc(it.produto) + " \u00d7 " + it.quantidade + "</strong>"
        + "<small>" + esc(it.design || "") + "</small></div>"
        + '<span class="ex-preco">' + eurC(p.fin) + "</span>"
        + '<span><button class="ex-linklike" data-edit="' + i + '" type="button">Editar</button>'
        + ' <button class="ex-linklike" data-del="' + i + '" type="button">Tirar</button></span></div>';
    });
    w.innerHTML = h + "</div>";
    w.querySelectorAll("[data-edit]").forEach(function (b) {
      b.addEventListener("click", function () { editStaging(Number(b.getAttribute("data-edit"))); });
    });
    w.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        STAGE.splice(Number(b.getAttribute("data-del")), 1);
        renderStaging();
        refreshReview();
      });
    });
  }

  function renderRevResumo() {
    var cli = clienteSelecionado();
    var h = "<p><strong>" + esc(orderCtx.id) + "</strong> \u00b7 " + esc(cli.nome || "sem cliente")
      + " \u00b7 " + esc($("fData").value || "") + "</p>";
    if (!STAGE.length) {
      h += '<p class="ex-miudo">Sem produtos. Volta atrás para adicionar.</p>';
    } else {
      h += '<div class="ex-staging">';
      STAGE.forEach(function (it) {
        var p = itemPrice(it);
        h += '<div class="ex-staging-item"><div><strong>' + esc(it.produto) + " \u00d7 " + it.quantidade + "</strong>"
          + "<small>" + esc(it.design || "") + (it.estado ? " \u00b7 " + esc(it.estado) : "") + "</small></div>"
          + '<span class="ex-preco">' + eurC(p.fin) + "</span></div>";
      });
      h += "</div>";
    }
    $("revResumo").innerHTML = h;
  }

  function refreshReview() {
    renderRevResumo();
    var t = totaisStaging();
    $("vTotalCalc").textContent = t.aviso !== "" ? t.aviso : eurC(t.total);
    var acord = num($("fTotalAcordado").value.trim());
    $("vTotalGuardar").textContent = isFinite(acord) ? eur(Math.round(acord * 100) / 100) : (t.aviso !== "" ? t.aviso : eurC(t.total));
  }


  function msg(ok, html) {
    var m = $("exMsg");
    m.className = "ex-msg " + (ok ? "ok" : "erro");
    m.innerHTML = html;
    m.scrollIntoView({ block: "nearest" });
  }
  function msgClear() { var m = $("exMsg"); m.className = "ex-msg"; m.innerHTML = ""; }

  var CLIENTES = {};

  function etiquetaCliente(c) {
    var extra = c.localidade || c.cartao || c.email || "";
    return c.nome + (extra ? " — " + extra : "");
  }

  function clienteSelecionado() {
    var v = $("fClienteSel").value;
    if (v === "AVULSO") return { id: "", nome: $("fClienteAvulso").value.trim() };
    if (v && CLIENTES[v]) return { id: v, nome: CLIENTES[v].nome };
    return { id: "", nome: $("cNome").value.trim() };
  }

  function mostrarFicha() {
    var avulso = $("fClienteSel").value === "AVULSO";
    $("wrapClienteAvulso").style.display = avulso ? "" : "none";
    $("fichaCliente").style.display = avulso ? "none" : "";
  }

  function preencherFicha(c) {
    c = c || {};
    $("cNome").value = c.nome || "";
    $("cNif").value = c.nif || "";
    $("cMorada").value = c.morada || "";
    $("cCP").value = c.codPostal || "";
    $("cLoc").value = c.localidade || "";
    $("cCong").value = c.congregacao || "";
    $("cTJ").value = c.tj || "";
    $("cTel").value = c.telemovel || "";
    $("cMail").value = c.email || "";
    $("cCartao").value = c.cartao || "";
    $("cObs").value = c.observacoes || "";
    if (c.id) {
      var t = "Total gasto: " + eur(c.totalGasto) + " · " + c.numEncomendas + " encomenda(s)";
      if (c.historicoGasto || c.historicoEncomendas) t += " (inclui histórico)";
      $("cTotais").textContent = t;
    } else {
      $("cTotais").textContent = "Nova ficha — prime Guardar cliente.";
    }
  }

  function escolherClienteNoDropdown(id, nome) {
    var sel = $("fClienteSel");
    if (id && CLIENTES[id]) {
      sel.value = id;
    } else if (nome) {
      var achou = "";
      Object.keys(CLIENTES).forEach(function (k) {
        if (!achou && CLIENTES[k].nome === nome) achou = k;
      });
      sel.value = achou || "AVULSO";
      if (!achou) $("fClienteAvulso").value = nome;
    } else {
      sel.value = "";
    }
    sel.dispatchEvent(new Event("change"));
  }

  function carregarClientes(selecionar) {
    return fetch("encomendas-excel.php?action=clientes", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        CLIENTES = {};
        (j.clientes || []).forEach(function (c) { CLIENTES[c.id] = c; });
        var sel = $("fClienteSel");
        var cur = selecionar || sel.value || "";
        sel.innerHTML = "";
        [["", "— Escolher cliente —"], ["AVULSO", "Cliente avulso (só nome)"]].concat(
          (j.clientes || []).map(function (c) { return [c.id, etiquetaCliente(c)]; })
        ).forEach(function (pair) {
          var o = document.createElement("option");
          o.value = pair[0]; o.textContent = pair[1];
          sel.appendChild(o);
        });
        sel.value = cur;
        if (sel.value !== cur) sel.value = "";
        mostrarFicha();
        if (CLIENTES[sel.value]) preencherFicha(CLIENTES[sel.value]);
      });
  }

  function guardarCliente() {
    var sel = $("fClienteSel").value;
    if (sel === "AVULSO") {
      msg(false, "Cliente avulso não tem ficha. Escolhe uma ficha ou preenche o nome para criar.");
      return;
    }
    var btn = $("btnGuardarCliente");
    btn.disabled = true;
    fetch("encomendas-excel.php", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csrf: CSRF, op: "guardar_cliente",
        id: sel.startsWith("CLI-") ? sel : "",
        nome: $("cNome").value, nif: $("cNif").value,
        morada: $("cMorada").value, codPostal: $("cCP").value,
        localidade: $("cLoc").value, congregacao: $("cCong").value, tj: $("cTJ").value,
        telemovel: $("cTel").value, email: $("cMail").value, cartao: $("cCartao").value,
        observacoes: $("cObs").value
      })
    }).then(function (r) {
      return r.json().then(function (j) { return { s: r.status, j: j }; });
    }).then(function (x) {
      btn.disabled = false;
      if (x.j.ok) {
        carregarClientes(x.j.id).then(function () {
          $("fClienteSel").value = x.j.id;
          mostrarFicha();
          preencherFicha(CLIENTES[x.j.id]);
          msg(true, "Ficha de cliente guardada.");
        });
      } else if (x.j.errors) {
        msg(false, "Não foi possível guardar a ficha:<ul><li>" + x.j.errors.map(function (e) {
          return esc(e);
        }).join("</li><li>") + "</li></ul>");
      } else {
        msg(false, esc(x.j.error || "Falha ao guardar a ficha."));
      }
    }).catch(function () {
      btn.disabled = false;
      msg(false, "Falha de rede ao guardar a ficha.");
    });
  }

  function payload() {
    var cli = clienteSelecionado();
    return {
      csrf: CSRF, op: "guardar",
      encomenda: orderCtx.id, origem: orderCtx.origem,
      clienteId: cli.id, cliente: cli.nome, data: $("fData").value,
      produtos: STAGE,
      pago: $("fPago").value, dataPago: $("fDataPago").value,
      entregue: $("fEntregue").value, dataEntrega: $("fDataEntrega").value,
      fatura: $("fFatura").value, referencia: $("fReferencia").value,
      entrega: $("fEntrega").value, portesManuais: $("fPortes").value,
      ajuste: $("fAjuste").value, motivoAjuste: $("fMotivo").value,
      observacoes: $("fObs").value, totalAcordado: $("fTotalAcordado").value
    };
  }

  function recordToPayload(r) {
    var ps = (r.artigos || []).filter(function (a) {
      return a && String(a.produto || "") !== "";
    }).map(function (a) {
      var o = {};
      ["produto", "quantidade", "design", "acabamento", "comNome", "nome", "cantos", "fita",
        "designA6", "acabamentoA6", "comNomeA6", "nomeA6", "cantosA6", "fitaA6", "tipoCapa",
        "holo", "frenteVerso", "furo", "margem", "holoUn", "nArtes", "detalhes", "estado", "precoManual"
      ].forEach(function (k) { o[k] = a[k] === undefined || a[k] === null ? "" : a[k]; });
      return o;
    });
    return {
      csrf: CSRF, op: "guardar",
      encomenda: r.id, origem: r.origem || "",
      clienteId: r.clienteId || "", cliente: r.cliente || "", data: r.data || "",
      produtos: ps,
      pago: r.pago || "N\u00e3o", dataPago: r.dataPago || "",
      entregue: r.entregue || "N\u00e3o", dataEntrega: r.dataEntrega || "",
      fatura: r.fatura || "N\u00e3o", referencia: r.referencia || "",
      entrega: r.entrega || "", portesManuais: r.portesManuais || "",
      ajuste: (r.ajuste === undefined || r.ajuste === "") ? "0" : r.ajuste,
      motivoAjuste: r.motivoAjuste || "", observacoes: r.observacoes || "",
      totalAcordado: r.totalAcordado || ""
    };
  }


  function resetReview() {
    $("fData").value = new Date().toISOString().slice(0, 10);
    ["fPago", "fEntregue", "fFatura"].forEach(function (id) { $(id).value = "N\u00e3o"; });
    ["fDataPago", "fDataEntrega", "fReferencia", "fPortes", "fMotivo", "fObs", "fTotalAcordado"].forEach(function (id) { $(id).value = ""; });
    $("fAjuste").value = "0";
    $("fEntrega").value = "";
  }

  function abrirModal() {
    $("modal").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function fecharModal() {
    $("modal").hidden = true;
    document.body.style.overflow = "";
    msgClear();
  }

  function irPasso(qual) {
    var mapa = { cliente: "msCliente", produto: "msProduto", config: "msConfig", rever: "msRever" };
    Object.keys(mapa).forEach(function (k) { $(mapa[k]).hidden = (k !== qual); });
    document.querySelectorAll(".ex-steps button").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-ms") === qual);
    });
    if (qual === "rever") refreshReview();
    if (qual === "config") refreshCard0();
    $("modal").scrollTop = 0;
  }

  function novaEncomenda() {
    orderCtx = { id: "Nova", origem: "" };
    STAGE = [];
    editingIndex = -1;
    $("fClienteSel").value = "";
    $("fClienteAvulso").value = "";
    preencherFicha(null);
    mostrarFicha();
    $("mProduto").value = "";
    resetReview();
    renderStaging();
    $("modalTitulo").textContent = "Nova encomenda";
    msgClear();
    abrirModal();
    irPasso("cliente");
  }

  function aplicarRegistroToComposer(r) {
    orderCtx = { id: r.id, origem: r.origem || "" };
    escolherClienteNoDropdown(r.clienteId || "", r.cliente || "");
    if (CLIENTES[$("fClienteSel").value]) preencherFicha(CLIENTES[$("fClienteSel").value]);
    else preencherFicha(null);
    $("fData").value = r.data || "";
    $("fPago").value = r.pago || "N\u00e3o";
    $("fDataPago").value = r.dataPago || "";
    $("fEntregue").value = r.entregue || "N\u00e3o";
    $("fDataEntrega").value = r.dataEntrega || "";
    $("fFatura").value = r.fatura || "N\u00e3o";
    $("fReferencia").value = r.referencia || "";
    $("fEntrega").value = r.entrega || "";
    $("fPortes").value = r.portesManuais || "";
    $("fAjuste").value = (r.ajuste === undefined || r.ajuste === "") ? "0" : r.ajuste;
    $("fMotivo").value = r.motivoAjuste || "";
    $("fObs").value = r.observacoes || "";
    $("fTotalAcordado").value = r.totalAcordado || "";
    STAGE = (r.artigos || []).filter(function (a) { return a && String(a.produto || "") !== ""; });
    editingIndex = -1;
    renderStaging();
    refreshReview();
    $("modalTitulo").textContent = "Encomenda " + r.id;
    msgClear();
    abrirModal();
    irPasso("rever");
  }

  function abrirEncomenda(id) {
    fetch("encomendas-excel.php?action=carregar&encomenda=" + encodeURIComponent(id), { credentials: "same-origin" })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (x) {
        if (!x.j.ok) { msg(false, "A encomenda n\u00e3o foi encontrada."); return; }
        aplicarRegistroToComposer(x.j.encomenda);
      });
  }

  function resetCardFor(prod) {
    var hp = $("prod0");
    ensureOption(hp, prod);
    hp.value = prod;
    refreshOptions(0);
    fillCard(0, { quantidade: 1, comNome: "N\u00e3o", cantos: "N\u00e3o", comNomeA6: "N\u00e3o", cantosA6: "N\u00e3o",
      holo: "N\u00e3o", frenteVerso: "N\u00e3o", furo: "N\u00e3o", margem: "N\u00e3o", holoUn: "N\u00e3o",
      nArtes: 0, estado: "Por fazer" });
    $("configCardTitle").textContent = "Configurar: " + prod;
    refreshCard0();
  }

  function irConfigurar() {
    var prod = $("mProduto").value;
    if (!prod) {
      msg(false, "Escolhe primeiro o produto.");
      return;
    }
    msgClear();
    resetCardFor(prod);
    editingIndex = -1;
    irPasso("config");
  }

  function addProduto() {
    var f = readCard(0);
    if (!$("prod0").value) {
      msg(false, "Escolhe primeiro o produto.");
      return;
    }
    if (!f.design) {
      msg(false, "Escolhe o design antes de adicionar.");
      return;
    }
    msgClear();
    if (editingIndex >= 0 && STAGE[editingIndex]) STAGE[editingIndex] = f;
    else STAGE.push(f);
    editingIndex = -1;
    renderStaging();
    refreshReview();
    irPasso("produto");
  }

  function editStaging(i) {
    var it = STAGE[i];
    if (!it) return;
    ensureOption($("mProduto"), it.produto);
    $("mProduto").value = it.produto;
    resetCardFor(it.produto);
    fillCard(0, it);
    refreshCard0();
    editingIndex = i;
    msgClear();
    irPasso("config");
  }



  function carregarLista() {
    return fetch("encomendas-excel.php?action=listar", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var w = $("wrapLista");
        if (!j.encomendas || !j.encomendas.length) {
          w.innerHTML = '<p class="ex-miudo">Ainda sem encomendas guardadas nesta ferramenta.</p>';
        } else {
          var t = '<table class="ex-lista"><thead><tr><th>C\u00f3digo</th><th>Data</th><th>Cliente</th><th style="text-align:right">Total</th></tr></thead><tbody>';
          j.encomendas.slice().reverse().forEach(function (e) {
            t += "<tr><td><a href=\"#\" data-open=\"" + esc(e.id) + "\">" + esc(e.id) + "</a></td>"
              + "<td>" + esc(e.data || "") + "</td>"
              + "<td>" + esc(e.cliente || "") + "</td>"
              + "<td class=\"num\">" + (e.total === null || e.total === undefined ? "\u2014" : Number(e.total).toFixed(2).replace(".", ",")) + "</td></tr>";
          });
          w.innerHTML = t + "</tbody></table>";
          w.querySelectorAll("[data-open]").forEach(function (a) {
            a.addEventListener("click", function (ev) {
              ev.preventDefault();
              abrirEncomenda(a.getAttribute("data-open"));
            });
          });
        }
      });
  }

  function carregar(id) {
    if (id) abrirEncomenda(id);
  }

  var pendFiltro = "todos";
  var pendData = null;

  function esc(s) { return String((s === null || s === undefined) ? "" : s).replace(/</g, "&lt;"); }

  function carregarPendentes() {
    return fetch("encomendas-excel.php?action=pendentes", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        pendData = (j && j.ok && j.pendentes) ? j.pendentes : { porFazer: [], prontos: [], detalhe: [] };
        renderPendentes();
      })
      .catch(function () {
        $("pendResumoFazer").innerHTML = '<p class="ex-miudo">Falha a carregar os pendentes.</p>';
        $("pendResumoProntos").innerHTML = "";
        $("pendCards").innerHTML = "";
      });
  }

  function renderChips(el, lista, vazio) {
    if (!lista || !lista.length) {
      el.innerHTML = '<p class="ex-miudo">' + esc(vazio) + "</p>";
      return;
    }
    el.innerHTML = '<div class="ex-chips">' + lista.map(function (it) {
      return '<span class="ex-chip"><strong>' + esc(it.produto) + "</strong> — "
        + it.unidades + " un <small>(" + it.linhas + (it.linhas === 1 ? " linha)" : " linhas)") + "</small></span>";
    }).join("") + "</div>";
  }

  function renderPendentes() {
    if (!pendData) return;
    var fazer = pendData.porFazer || [];
    var prontos = pendData.prontos || [];
    if (pendFiltro === "fazer") prontos = [];
    if (pendFiltro === "pronto") fazer = [];
    renderChips($("pendResumoFazer"), fazer, "Nada por fazer.");
    renderChips($("pendResumoProntos"), prontos, "Nada pronto a entregar.");
    var det = (pendData.detalhe || []).filter(function (d) {
      return pendFiltro === "todos" || d.grupo === pendFiltro;
    });
    var w = $("pendCards");
    if (!det.length) {
      w.innerHTML = '<p class="ex-miudo">Nada pendente.</p>';
      return;
    }
    var h = '<div class="ex-cards">';
    det.forEach(function (d, i) {
      h += '<div class="ex-job" data-job="' + i + '" role="button" tabindex="0">'
        + (d.imagem ? '<img src="' + d.imagem.replace(/"/g, "") + '" alt="" loading="lazy">'
          : '<div class="ex-job-semimg">Sem imagem</div>')
        + '<div class="ex-job-corpo">'
        + '<div class="ex-job-linha"><strong>' + esc(d.produto) + " \u00d7 " + d.quantidade + "</strong>"
        + '<span class="ex-badge ' + (d.grupo === "pronto" ? "pronto" : "fazer") + '">' + esc(d.estado) + "</span></div>"
        + "<small>" + esc(d.cliente) + " \u00b7 " + esc(d.id) + "</small>"
        + "<small>" + esc(d.config) + "</small>"
        + '<div class="ex-job-linha"><small>' + esc(d.data || "") + "</small>"
        + (d.grupo === "fazer"
          ? '<button class="ex-job-avancar" data-av="' + i + '" type="button">Avan\u00e7ar \u203a</button>'
          : "<span></span>")
        + "</div></div></div>";
    });
    w.innerHTML = h + "</div>";
    w.querySelectorAll(".ex-job").forEach(function (card) {
      card.addEventListener("click", function () {
        var d = det[Number(card.getAttribute("data-job"))];
        if (d) abrirEncomenda(d.id);
      });
    });
    w.querySelectorAll("[data-av]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var d = det[Number(b.getAttribute("data-av"))];
        if (d) avancarEstado(d.id, d.idx);
      });
    });
  }

  function avancarEstado(id, idx) {
    fetch("encomendas-excel.php?action=carregar&encomenda=" + encodeURIComponent(id), { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok || !j.encomenda) return;
        var r = j.encomenda;
        var a = (r.artigos || [])[idx];
        if (!a) return;
        a.estado = a.estado === "Por fazer" ? "Em produ\u00e7\u00e3o" : "Terminado";
        fetch("encomendas-excel.php", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(recordToPayload(r))
        }).then(function () {
          carregarPendentes();
          carregarLista();
        });
      });
  }


  function guardar() {
    var btn = $("btnGuardar");
    btn.disabled = true;
    fetch("encomendas-excel.php", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload())
    }).then(function (r) {
      return r.json().then(function (j) { return { s: r.status, j: j }; });
    }).then(function (x) {
      btn.disabled = false;
      if (x.j.ok) {
        orderCtx.id = x.j.id;
        $("modalTitulo").textContent = "Encomenda " + x.j.id;
        carregarLista();
        carregarPendentes();
        msg(true, "Encomenda <strong>" + esc(x.j.id) + "</strong> guardada.");
        fecharModal();
      } else if (x.j.errors) {
        msg(false, "N\u00e3o foi poss\u00edvel guardar:<ul><li>" + x.j.errors.map(function (e) {
          return esc(e);
        }).join("</li><li>") + "</li></ul>");
      } else {
        msg(false, esc(x.j.error || "Falha ao guardar."));
      }
    }).catch(function () {
      btn.disabled = false;
      msg(false, "Falha de rede ao guardar.");
    });
  }


  function carregarClientesTabela() {
    return fetch("encomendas-excel.php?action=clientes", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var w = $("wrapClientes");
        var lista = (j.clientes || []);
        if (!lista.length) {
          w.innerHTML = '<p class="ex-miudo">Sem fichas. Cria a primeira no bot\u00e3o acima.</p>';
          return;
        }
        var t = '<table class="ex-lista"><thead><tr><th>Nome</th><th>Contacto</th><th>Localidade</th>'
          + '<th style="text-align:right">Gasto</th><th style="text-align:right">N.\u00ba</th><th></th></tr></thead><tbody>';
        lista.forEach(function (c) {
          var contacto = c.telemovel || c.email || "";
          t += "<tr><td><strong>" + esc(c.nome) + "</strong>"
            + (c.congregacao ? "<br><small>" + esc(c.congregacao) + "</small>" : "") + "</td>"
            + "<td>" + esc(contacto) + "</td>"
            + "<td>" + esc(c.localidade || "") + "</td>"
            + '<td class="num">' + Number(c.totalGasto || 0).toFixed(2).replace(".", ",") + "</td>"
            + '<td class="num">' + (c.numEncomendas || 0) + "</td>"
            + '<td><button class="ex-linklike" data-ficha="' + esc(c.id) + '" type="button">Editar</button></td></tr>';
        });
        w.innerHTML = t + "</tbody></table>";
        w.querySelectorAll("[data-ficha]").forEach(function (b) {
          b.addEventListener("click", function () {
            novaEncomenda();
            $("fClienteSel").value = b.getAttribute("data-ficha");
            mostrarFicha();
            if (CLIENTES[$("fClienteSel").value]) preencherFicha(CLIENTES[$("fClienteSel").value]);
          });
        });
      });
  }

  function init() {
    var fonte = $("fonteCatalogo");
    if (fonte) {
      fonte.textContent = DATA.fonte === "site"
        ? "Pre\u00e7os, designs e extras lidos do site (tabela de " + (DATA.pricingData || "") + ")."
        : "Site indispon\u00edvel: a usar a foto do Excel de 2026-09.";
    }
    var ent = $("fEntrega");
    [["", "\u2014"]].concat((DATA.entrega || []).map(function (e) { return [String(e[0]), String(e[0])]; })).forEach(function (pair) {
      var o = document.createElement("option");
      o.value = pair[0]; o.textContent = pair[1];
      ent.appendChild(o);
    });
    var mp = $("mProduto");
    [""].concat(DATA.ordem || []).forEach(function (p) {
      var o = document.createElement("option");
      o.value = p; o.textContent = p === "" ? "\u2014 Escolher produto \u2014" : p;
      mp.appendChild(o);
    });
    buildConfigCard();
    document.querySelectorAll(".ex-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll(".ex-tabs button").forEach(function (x) {
          x.classList.toggle("is-on", x === b);
        });
        ["pendentes", "encomendas", "clientes"].forEach(function (t) {
          $("tab-" + t).hidden = (t !== b.getAttribute("data-tab"));
        });
      });
    });
    $("fabAdd").addEventListener("click", function () { novaEncomenda(); });
    $("btnFecharModal").addEventListener("click", fecharModal);
    document.querySelectorAll(".ex-steps button").forEach(function (b) {
      b.addEventListener("click", function () { irPasso(b.getAttribute("data-ms")); });
    });
    $("btnCliSeguinte").addEventListener("click", function () { irPasso("produto"); });
    $("btnVoltarCliente").addEventListener("click", function () { irPasso("cliente"); });
    $("btnIrConfigurar").addEventListener("click", irConfigurar);
    $("btnVoltarProduto").addEventListener("click", function () { editingIndex = -1; irPasso("produto"); });
    $("btnAddProduto").addEventListener("click", addProduto);
    $("btnVoltarConfig").addEventListener("click", function () { editingIndex = -1; irPasso("produto"); });
    $("mProduto").addEventListener("change", function () { editingIndex = -1; });
    $("modal").addEventListener("input", function () { refreshCard0(); refreshReview(); });
    $("modal").addEventListener("change", function () { refreshCard0(); refreshReview(); });
    $("btnGuardar").addEventListener("click", guardar);
    $("btnNovoCliente").addEventListener("click", function () {
      $("fClienteSel").value = "";
      $("fClienteAvulso").value = "";
      preencherFicha(null);
      mostrarFicha();
      $("cNome").focus();
    });
    $("btnGuardarCliente").addEventListener("click", guardarCliente);
    $("fClienteSel").addEventListener("change", function () {
      mostrarFicha();
      if (CLIENTES[$("fClienteSel").value]) preencherFicha(CLIENTES[$("fClienteSel").value]);
      else preencherFicha(null);
    });
    document.querySelectorAll(".ex-filtro").forEach(function (b) {
      b.addEventListener("click", function () {
        pendFiltro = b.getAttribute("data-f");
        document.querySelectorAll(".ex-filtro").forEach(function (x) {
          x.classList.toggle("is-on", x === b);
        });
        renderPendentes();
      });
    });
    $("btnNovaFichaTab").addEventListener("click", function () {
      novaEncomenda();
      $("fClienteSel").value = "";
      preencherFicha(null);
      mostrarFicha();
    });
    carregarPendentes();
    carregarLista();
    carregarClientes();
    carregarClientesTabela();
    if (PRELOAD && PRELOAD !== "" && PRELOAD !== "Nova") {
      abrirEncomenda(PRELOAD);
    }
  }


  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}());
</script>
</body>
</html>