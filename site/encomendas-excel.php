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

function ex_cfg($name) {
    global $EXCEL_DATA;
    if (!isset($EXCEL_DATA['produtos_cfg']) || !is_array($EXCEL_DATA['produtos_cfg'])) return null;
    foreach ($EXCEL_DATA['produtos_cfg'] as $c) {
        if (isset($c[0]) && (string)$c[0] === (string)$name) return $c;
    }
    return null;
}

function ex_base_of($name) {
    global $EXCEL_DATA;
    if (!isset($EXCEL_DATA['produtos']) || !is_array($EXCEL_DATA['produtos'])) return null;
    foreach ($EXCEL_DATA['produtos'] as $p) {
        if (isset($p[0]) && (string)$p[0] === (string)$name) {
            return is_numeric($p[1]) ? (float)$p[1] : null;
        }
    }
    return null;
}

function ex_tier_unit($name, $qty) {
    global $EXCEL_DATA;
    $best = null;
    if (!isset($EXCEL_DATA['tiers']) || !is_array($EXCEL_DATA['tiers'])) return null;
    foreach ($EXCEL_DATA['tiers'] as $t) {
        if (!isset($t[0], $t[1], $t[2])) continue;
        if ((string)$t[0] !== (string)$name) continue;
        $q = (float)$t[1]; $total = (float)$t[2];
        if ($q > 0 && $q <= $qty + 1e-9) {
            if ($best === null || $q > $best[0]) $best = array($q, $total);
        }
    }
    if ($best === null) return null;
    return $best[1] / $best[0];
}

function ex_extra($key, $default = 0.0) {
    global $EXCEL_DATA;
    if (isset($EXCEL_DATA['extras_labels'][$key]) && is_numeric($EXCEL_DATA['extras_labels'][$key])) {
        return (float)$EXCEL_DATA['extras_labels'][$key];
    }
    return (float)$default;
}

// Preço base J16: número ou a string 'Rever quantidade'.
function ex_base_price($name, $qty) {
    $cfg = ex_cfg($name);
    if ($cfg === null) return 'Rever quantidade';
    $modo = isset($cfg[1]) ? (string)$cfg[1] : '';
    $min = isset($cfg[2]) ? (float)$cfg[2] : 1;
    if (!is_numeric($qty) || floor((float)$qty) != (float)$qty || (float)$qty < $min) {
        return 'Rever quantidade';
    }
    $qty = (float)$qty;
    if ($modo === 'tier') {
        $unit = ex_tier_unit($name, $qty);
        if ($unit === null) return 'Rever quantidade';
        return round($qty * $unit + 1e-9, 2);
    }
    $base = ex_base_of($name);
    if ($base === null) return 'Rever quantidade';
    return round($base * $qty + 1e-9, 2);
}

// Preço calculado B34 a partir dos campos de um produto.
function ex_product_calc($name, $f) {
    $cfg = ex_cfg($name);
    $tipo = $cfg !== null && isset($cfg[4]) ? (string)$cfg[4] : '';
    $qty = isset($f['quantidade']) ? (float)$f['quantidade'] : 0;
    $base = ex_base_price($name, isset($f['quantidade']) ? $f['quantidade'] : 0);
    if (!is_numeric($base)) return $base;
    $sim = function ($v) { return $v === 'Sim'; };
    $porUn = 0.0;
    if (in_array($tipo, array('pasta', 'pack_pastas', 'agenda'), true) && $sim(isset($f['comNome']) ? $f['comNome'] : '')) {
        $porUn += ex_extra('AG3', 2);
    }
    if (in_array($tipo, array('pasta', 'pack_pastas'), true) && $sim(isset($f['cantos']) ? $f['cantos'] : '')) {
        $porUn += ex_extra('AG4', 2);
    }
    if ($tipo === 'pack_pastas') {
        if ($sim(isset($f['comNomeA6']) ? $f['comNomeA6'] : '')) $porUn += ex_extra('AG3', 2);
        if ($sim(isset($f['cantosA6']) ? $f['cantosA6'] : '')) $porUn += ex_extra('AG4', 2);
    }
    if ($name === 'Marcadores' && (int)(isset($f['nArtes']) ? $f['nArtes'] : 0) === 0) {
        if ($sim(isset($f['holo']) ? $f['holo'] : '')) $porUn += ex_extra('AG7', 0.15);
        if ($sim(isset($f['frenteVerso']) ? $f['frenteVerso'] : '')) $porUn += ex_extra('AG8', 0.15);
        if ($sim(isset($f['furo']) ? $f['furo'] : '')) $porUn += ex_extra('AG9', 0.25);
        if ($sim(isset($f['margem']) ? $f['margem'] : '')) $porUn += ex_extra('AG10', 0.2);
    }
    $fixo = 0.0;
    if ((isset($f['tipoCapa']) ? $f['tipoCapa'] : '') === 'Capa dura') $fixo += ex_extra('AG6', 4);
    $fixo += (int)(isset($f['nArtes']) ? $f['nArtes'] : 0) * ex_extra('AG5', 3);
    return round((float)$base + $qty * $porUn + $fixo + 1e-9, 2);
}

function ex_entrega_portes($metodo) {
    global $EXCEL_DATA;
    if (!isset($EXCEL_DATA['entrega']) || !is_array($EXCEL_DATA['entrega'])) return null;
    foreach ($EXCEL_DATA['entrega'] as $e) {
        if (isset($e[0]) && (string)$e[0] === (string)$metodo) {
            return is_numeric($e[1]) ? (float)$e[1] : null;
        }
    }
    return null;
}

function ex_design_url($grupo, $design) {
    global $EXCEL_DATA;
    if (!isset($EXCEL_DATA['design_lookup']) || !is_array($EXCEL_DATA['design_lookup'])) return '';
    $key = (string)$grupo . '|' . (string)$design;
    foreach ($EXCEL_DATA['design_lookup'] as $row) {
        if (isset($row[0]) && (string)$row[0] === $key) {
            return isset($row[3]) ? (string)$row[3] : '';
        }
    }
    return '';
}

function ex_familia_of($name) {
    global $EXCEL_DATA;
    if (!isset($EXCEL_DATA['produtos']) || !is_array($EXCEL_DATA['produtos'])) return '';
    foreach ($EXCEL_DATA['produtos'] as $p) {
        if (isset($p[0]) && (string)$p[0] === (string)$name) return isset($p[3]) ? (string)$p[3] : '';
    }
    return '';
}

// ── Validação (espelho das mensagens do VBA). Devolve array de erros. ──
function ex_validate($d, &$computed) {
    $errors = array();
    $computed = array('produtos' => array(), 'totalCalc' => null, 'totalGuardar' => null);

    $cliente = trim((string)(isset($d['cliente']) ? $d['cliente'] : ''));
    if ($cliente === '') $errors[] = 'Escolhe um cliente.';

    $prods = isset($d['produtos']) && is_array($d['produtos']) ? array_slice($d['produtos'], 0, 3) : array();
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
        $tipo = isset($cfg[4]) ? (string)$cfg[4] : '';
        $min = isset($cfg[2]) ? (float)$cfg[2] : 1;
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
            'quantidade' => $q, 'comNome' => isset($p['comNome']) ? $p['comNome'] : 'Não',
            'cantos' => isset($p['cantos']) ? $p['cantos'] : 'Não',
            'comNomeA6' => isset($p['comNomeA6']) ? $p['comNomeA6'] : 'Não',
            'cantosA6' => isset($p['cantosA6']) ? $p['cantosA6'] : 'Não',
            'holo' => isset($p['holo']) ? $p['holo'] : 'Não',
            'frenteVerso' => isset($p['frenteVerso']) ? $p['frenteVerso'] : 'Não',
            'furo' => isset($p['furo']) ? $p['furo'] : 'Não',
            'margem' => isset($p['margem']) ? $p['margem'] : 'Não',
            'tipoCapa' => isset($p['tipoCapa']) ? $p['tipoCapa'] : '',
            'nArtes' => $na,
        ));
        $manual = trim((string)(isset($p['precoManual']) ? $p['precoManual'] : ''));
        if ($manual !== '' && (!is_numeric(str_replace(',', '.', $manual)) || (float)str_replace(',', '.', $manual) < 0)) {
            $errors[] = 'O preço manual do ' . $rot . ' não é válido.';
        }
        $final = $manual !== '' ? (float)str_replace(',', '.', $manual) : $calc;
        if (!is_numeric($final)) {
            $errors[] = 'O preço do ' . $rot . ' precisa de revisão.';
            $final = null;
        } else {
            $final = round((float)$final + 1e-9, 2);
        }
        $computed['produtos'][] = array('nome' => $nome, 'base' => ex_base_price($nome, $q), 'calc' => $calc, 'final' => $final);
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

    // Total calculado B89.
    $finais = array();
    foreach ($computed['produtos'] as $cp) { if ($cp['final'] !== null) $finais[] = $cp['final']; }
    if (count($usados) > 0 && count($finais) !== count($usados)) {
        $computed['totalCalc'] = 'Rever quantidades/preços';
        $errors[] = 'Rever quantidades/preços.';
    } else {
        $portes = 0.0;
        $pm = trim((string)(isset($d['portesManuais']) ? $d['portesManuais'] : ''));
        if ($pm !== '') {
            $portes = (float)str_replace(',', '.', $pm);
        } elseif ($metodo !== '') {
            $tab = ex_entrega_portes($metodo);
            if ($tab === null) {
                $computed['totalCalc'] = 'Indicar entrega/portes';
                $errors[] = 'Indicar entrega/portes.';
            } else {
                $portes = $tab;
            }
        } else {
            $computed['totalCalc'] = 'Indicar entrega/portes';
        }
        if (is_string($computed['totalCalc'])) {
            // já marcado acima
        } elseif (count($usados) === 0) {
            $computed['totalCalc'] = null;
        } else {
            $computed['totalCalc'] = round(array_sum($finais) + $portes + (float)($aj !== '' ? str_replace(',', '.', $aj) : 0) + 1e-9, 2);
        }
    }
    if ($computed['totalCalc'] !== null && !is_numeric($computed['totalCalc'])) {
        // erro já registado
    } elseif ($computed['totalCalc'] === null && count($usados) > 0) {
        $errors[] = 'O total ainda não está calculado.';
    }
    $computed['totalGuardar'] = ($ta !== '' && is_numeric(str_replace(',', '.', $ta)))
        ? round((float)str_replace(',', '.', $ta) + 1e-9, 2)
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
    foreach (array('holo' => 'Holográfico', 'frenteVerso' => 'Frente e verso', 'furo' => 'Furo', 'margem' => 'Margem plástica') as $k => $rot) {
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
        $arts = isset($r['artigos']) && is_array($r['artigos']) ? $r['artigos'] : array();
        foreach ($arts as $a) {
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
            $detalhe[] = array(
                'id' => isset($r['id']) ? (string)$r['id'] : '',
                'cliente' => isset($r['cliente']) ? (string)$r['cliente'] : '',
                'data' => isset($r['data']) ? (string)$r['data'] : '',
                'produto' => $prod,
                'quantidade' => $q,
                'config' => $cfg,
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
        if (count($usados) >= 3) break;
    }
    foreach ($usados as $k => $p) {
        $slot++;
        $cfg = ex_cfg(trim((string)$p['produto']));
        $grupo = ($cfg !== null && isset($cfg[3])) ? (string)$cfg[3] : '';
        $fin = isset($computed['produtos'][$k]['final']) ? $computed['produtos'][$k]['final'] : null;
        $artigos[] = array(
            'slot' => $slot,
            'produto' => trim((string)$p['produto']),
            'quantidade' => (int)$p['quantidade'],
            'design' => trim((string)(isset($p['design']) ? $p['design'] : '')),
            'imagem' => ex_design_url($grupo, trim((string)(isset($p['design']) ? $p['design'] : ''))),
            'acabamento' => trim((string)(isset($p['acabamento']) ? $p['acabamento'] : '')),
            'comNome' => isset($p['comNome']) ? $p['comNome'] : 'Não',
            'nome' => trim((string)(isset($p['nome']) ? $p['nome'] : '')),
            'cantos' => isset($p['cantos']) ? $p['cantos'] : 'Não',
            'fita' => trim((string)(isset($p['fita']) ? $p['fita'] : '')),
            'designA6' => trim((string)(isset($p['designA6']) ? $p['designA6'] : '')),
            'imagemA6' => ex_design_url('Pasta A6', trim((string)(isset($p['designA6']) ? $p['designA6'] : ''))),
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
            'nArtes' => (int)(isset($p['nArtes']) ? $p['nArtes'] : 0),
            'detalhes' => trim((string)(isset($p['detalhes']) ? $p['detalhes'] : '')),
            'estado' => isset($p['estado']) ? $p['estado'] : 'Por fazer',
            'precoManual' => trim((string)(isset($p['precoManual']) ? $p['precoManual'] : '')),
            'configResumo' => ex_config_resumo($p),
            'preco' => $fin,
        );
    }
    $rec = array(
        'id' => $id,
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

  <div class="ex-msg" id="exMsg" role="status"></div>

  <section class="ex-passo" aria-labelledby="t-p0">
    <h2 id="t-p0">Passo 0 · Carregar encomenda antiga</h2>
    <p class="ex-ajuda">Escolhe uma encomenda guardada para continuar, ou começa uma nova.</p>
    <div class="ex-grelha">
      <label class="ex-campo"><span>Encomenda</span>
        <select id="selEncomenda"><option value="Nova">Nova</option></select>
      </label>
    </div>
    <div class="ex-linha-btns">
      <button class="ex-btn" id="btnCarregar" type="button">Carregar</button>
      <button class="ex-btn secundario" id="btnNova" type="button">Nova</button>
    </div>
  </section>

  <section class="ex-passo" aria-labelledby="t-p1">
    <h2 id="t-p1">Passo 1 · Identificação</h2>
    <div class="ex-grelha">
      <label class="ex-campo"><span>Cliente *</span>
        <input id="fCliente" list="dlClientes" autocomplete="off" placeholder="Nome do cliente">
        <datalist id="dlClientes"></datalist>
      </label>
      <label class="ex-campo"><span>Data</span><input id="fData" type="date"></label>
    </div>
  </section>

  <section class="ex-passo" aria-labelledby="t-p2">
    <h2 id="t-p2">Passo 2 · Escolher os produtos</h2>
    <div class="ex-grelha">
      <label class="ex-campo"><span>Produto 1</span><select id="prod1"></select></label>
      <label class="ex-campo"><span>Produto 2</span><select id="prod2"></select></label>
      <label class="ex-campo"><span>Produto 3</span><select id="prod3"></select></label>
    </div>
  </section>

  <div id="cardsProdutos"></div>

  <section class="ex-passo" aria-labelledby="t-p6">
    <h2 id="t-p6">Passo 6 · Pagamento, entrega e total</h2>
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
      <button class="ex-btn" id="btnGuardar" type="button">Guardar</button>
    </div>
    <p class="ex-miudo">Guardar valida tudo como o Excel: cliente, quantidades mínimas, designs,
    acabamentos das pastas, nomes, configuração A6 dos packs, entrega e totais.</p>
  </section>

  <section class="ex-passo" aria-labelledby="t-pend">
    <h2 id="t-pend">Passo 7 · Pendentes — o que falta fazer e entregar</h2>
    <p class="ex-ajuda">Automático: tudo o que ainda não foi entregue. Marcar um produto como
    Terminado passa-o para “pronto a entregar”; marcar a encomenda como Entregue tira-a daqui sem apagar o histórico.</p>
    <div class="ex-linha-btns" role="group" aria-label="Filtrar pendentes">
      <button class="ex-btn secundario ex-filtro" data-f="todos" type="button">Todos</button>
      <button class="ex-btn secundario ex-filtro" data-f="fazer" type="button">Por fazer / em produção</button>
      <button class="ex-btn secundario ex-filtro" data-f="pronto" type="button">Prontos a entregar</button>
    </div>
    <h3 class="ex-sub">Por fazer / em produção</h3>
    <div id="pendResumoFazer"><p class="ex-miudo">A carregar…</p></div>
    <h3 class="ex-sub">Prontos a entregar</h3>
    <div id="pendResumoProntos"><p class="ex-miudo">A carregar…</p></div>
    <h3 class="ex-sub">Detalhe</h3>
    <div id="pendDetalhe"><p class="ex-miudo">A carregar…</p></div>
  </section>

  <section class="ex-passo" aria-labelledby="t-lista">
    <h2 id="t-lista">Encomendas guardadas</h2>
    <p class="ex-ajuda">Arquivo desta ferramenta (ficheiro privado, fora do resto do site).</p>
    <div id="wrapLista"><p class="ex-miudo">A carregar…</p></div>
  </section>
</div>

<script id="excel-data" type="application/json"><?= json_encode($EXCEL_DATA, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
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
  function cfgOf(name) {
    var list = DATA.produtos_cfg || [];
    for (var i = 0; i < list.length; i++) if (String(list[i][0]) === String(name)) return list[i];
    return null;
  }
  function baseOf(name) {
    var list = DATA.produtos || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i][0]) === String(name)) {
        var b = Number(list[i][1]);
        return isFinite(b) ? b : null;
      }
    }
    return null;
  }
  function extra(key, def) {
    var v = DATA.extras_labels ? DATA.extras_labels[key] : undefined;
    v = Number(v);
    return isFinite(v) ? v : def;
  }
  function tierUnit(name, qty) {
    var best = null, i, t, q, total;
    var tiers = DATA.tiers || [];
    for (i = 0; i < tiers.length; i++) {
      t = tiers[i];
      if (String(t[0]) !== String(name)) continue;
      q = Number(t[1]); total = Number(t[2]);
      if (q > 0 && q <= qty + 1e-9 && (best === null || q > best[0])) best = [q, total];
    }
    return best ? best[1] / best[0] : null;
  }
  // Espelho JS de J16.
  function basePrice(name, qtyRaw) {
    var cfg = cfgOf(name);
    if (!cfg) return "Rever quantidade";
    var modo = String(cfg[1] || ""), min = Number(cfg[2] || 1);
    var qty = Number(qtyRaw);
    if (!isFinite(qty) || Math.floor(qty) !== qty || qty < min) return "Rever quantidade";
    if (modo === "tier") {
      var u = tierUnit(name, qty);
      if (u === null) return "Rever quantidade";
      return Math.round(qty * u * 100 + 1e-6) / 100;
    }
    var b = baseOf(name);
    if (b === null) return "Rever quantidade";
    return Math.round(b * qty * 100 + 1e-6) / 100;
  }
  // Espelho JS de B34.
  function productCalc(name, f) {
    var cfg = cfgOf(name);
    var tipo = cfg ? String(cfg[4] || "") : "";
    var qty = Number(f.quantidade) || 0;
    var base = basePrice(name, f.quantidade);
    if (typeof base !== "number") return base;
    var porUn = 0;
    if ((tipo === "pasta" || tipo === "pack_pastas" || tipo === "agenda") && f.comNome === "Sim") porUn += extra("AG3", 2);
    if ((tipo === "pasta" || tipo === "pack_pastas") && f.cantos === "Sim") porUn += extra("AG4", 2);
    if (tipo === "pack_pastas") {
      if (f.comNomeA6 === "Sim") porUn += extra("AG3", 2);
      if (f.cantosA6 === "Sim") porUn += extra("AG4", 2);
    }
    if (name === "Marcadores" && Number(f.nArtes || 0) === 0) {
      if (f.holo === "Sim") porUn += extra("AG7", 0.15);
      if (f.frenteVerso === "Sim") porUn += extra("AG8", 0.15);
      if (f.furo === "Sim") porUn += extra("AG9", 0.25);
      if (f.margem === "Sim") porUn += extra("AG10", 0.2);
    }
    var fixo = 0;
    if (f.tipoCapa === "Capa dura") fixo += extra("AG6", 4);
    fixo += (Number(f.nArtes) || 0) * extra("AG5", 3);
    return Math.round((base + qty * porUn + fixo) * 100 + 1e-6) / 100;
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
  function designUrl(grupo, design) {
    var key = String(grupo) + "|" + String(design);
    var tbl = DATA.design_lookup || [];
    for (var i = 0; i < tbl.length; i++) if (String(tbl[i][0]) === key) return String(tbl[i][3] || "");
    return "";
  }
  function familiaOf(name) {
    var list = DATA.produtos || [];
    for (var i = 0; i < list.length; i++) if (String(list[i][0]) === String(name)) return String(list[i][3] || "");
    return "";
  }

  var FIELDS = [
    ["quantidade", "1. Quantidade *", "number", "1"],
    ["design", "2. Design principal", "design", ""],
    ["acabamento", "3. Acabamento", "laminacao", ""],
    ["comNome", "4. Com nome?", "simnao", "Não"],
    ["nome", "Nome escolhido", "text", ""],
    ["cantos", "5. Cantos metálicos?", "simnao", "Não"],
    ["fita", "6. Fita", "fita", ""],
    ["designA6", "7. Design A6 (pack)", "designA6", ""],
    ["acabamentoA6", "8. Acabamento A6", "laminacao", ""],
    ["comNomeA6", "9. Com nome A6?", "simnao", "Não"],
    ["nomeA6", "Nome A6", "text", ""],
    ["cantosA6", "10. Cantos A6?", "simnao", "Não"],
    ["fitaA6", "11. Fita A6", "fita", ""],
    ["tipoCapa", "12. Tipo de capa", "capa", ""],
    ["holo", "13. Holográfico?", "simnao", "Não"],
    ["frenteVerso", "14. Frente e verso?", "simnao", "Não"],
    ["furo", "15. Buraquinho?", "simnao", "Não"],
    ["margem", "16. Margem plástica?", "simnao", "Não"],
    ["nArtes", "17. N.º artes próprias", "number", "0"],
    ["detalhes", "18. Detalhes / texto livre", "text", ""],
    ["estado", "Estado de produção", "estado", "Por fazer"]
  ];

  function optionList(kind, cfg) {
    if (kind === "simnao") return DATA.simnao || ["Sim", "Não"];
    if (kind === "laminacao") return (DATA.acabamentos || []).filter(Boolean);
    if (kind === "estado") return DATA.estados || ["Por fazer"];
    if (kind === "fita") return (DATA.fita_base || []).filter(Boolean);
    if (kind === "capa") return (DATA.tipos_capa || []).filter(Boolean);
    if (kind === "design") {
      var lista = cfg ? String(cfg[6] || "") : "";
      return (DATA.dg && DATA.dg[lista]) ? DATA.dg[lista] : [];
    }
    if (kind === "designA6") return (DATA.dg && DATA.dg.DG_A6) ? DATA.dg.DG_A6 : [];
    return [];
  }

  function buildCards() {
    var wrap = $("cardsProdutos");
    wrap.innerHTML = "";
    for (var n = 1; n <= 3; n++) {
      (function (n) {
        var sec = document.createElement("section");
        sec.className = "ex-passo";
        sec.id = "card" + n;
        var h = document.createElement("h2");
        h.textContent = n === 1 ? "Passo 3 · Configurar o Produto 1"
          : n === 2 ? "Passo 4 · Configurar o Produto 2" : "Passo 5 · Configurar o Produto 3";
        sec.appendChild(h);
        var help = document.createElement("p");
        help.className = "ex-ajuda";
        help.textContent = "Preencher da esquerda para baixo.";
        sec.appendChild(help);
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
            var opts = kind === "design" || kind === "designA6" ? [""] .concat(optionList(kind, null))
              : (kind === "laminacao" || kind === "fita" || kind === "capa") ? [""] .concat(optionList(kind))
              : optionList(kind);
            opts.forEach(function (o) {
              var op = document.createElement("option");
              op.value = o; op.textContent = o === "" ? "—" : o;
              if (o === def) op.selected = true;
              el.appendChild(op);
            });
          }
          el.id = "p" + n + "_" + key;
          lab.appendChild(el);
          if (key === "design" || key === "designA6") {
            var div = document.createElement("div");
            div.className = "ex-img";
            div.id = "p" + n + "_" + key + "_img";
            lab.appendChild(div);
          }
          grid.appendChild(lab);
        });
        sec.appendChild(grid);
        var comp = document.createElement("div");
        comp.className = "ex-grelha";
        comp.style.marginTop = "10px";
        [["base", "Preço base"], ["calc", "Preço calculado"], ["manual", "Preço manual (opcional)", true], ["final", "Preço do produto"]].forEach(function (c) {
          var lab = document.createElement("label");
          lab.className = "ex-campo";
          var sp = document.createElement("span");
          sp.textContent = c[1];
          lab.appendChild(sp);
          if (c[2]) {
            var inp = document.createElement("input");
            inp.id = "p" + n + "_" + c[0];
            inp.setAttribute("inputmode", "decimal");
            lab.appendChild(inp);
          } else {
            var dv = document.createElement("div");
            dv.className = "ex-leitura";
            dv.id = "p" + n + "_" + c[0];
            dv.textContent = "—";
            lab.appendChild(dv);
          }
          comp.appendChild(lab);
        });
        sec.appendChild(comp);
        wrap.appendChild(sec);
      })(n);
    }
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
      margem: v("margem"), nArtes: v("nArtes"), detalhes: v("detalhes"),
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
    s("margem", a.margem || "Não"); s("nArtes", (a.nArtes === undefined ? 0 : a.nArtes));
    s("detalhes", a.detalhes || ""); s("estado", a.estado || "Por fazer");
    s("manual", a.precoManual || "");
  }

  function refreshDesignOptions(n) {
    var prod = $("prod" + n).value;
    var cfg = cfgOf(prod);
    var sel = $("p" + n + "_design");
    var cur = sel.value;
    sel.innerHTML = "";
    [["", "—"]].concat(optionList("design", cfg).map(function (o) { return [o, o]; })).forEach(function (pair) {
      var op = document.createElement("option");
      op.value = pair[0]; op.textContent = pair[1];
      sel.appendChild(op);
    });
    sel.value = cur;
  }

  function recalc() {
    var finais = [], usados = 0;
    for (var n = 1; n <= 3; n++) {
      (function (n) {
        var prod = $("prod" + n).value;
        var card = $("card" + n);
        var f = readCard(n);
        var vazio = prod === "";
        card.querySelectorAll("input, select, textarea").forEach(function (el) {
          if (el.id === "prod" + n) return;
          if (vazio && el.tagName === "SELECT" && el.id.indexOf("_design") === -1) { el.disabled = true; }
          else if (vazio && el.tagName === "INPUT" && (el.id.endsWith("_quantidade") || el.id.endsWith("_manual"))) { el.disabled = false; }
          else { el.disabled = vazio && el.id !== "p" + n + "_manual"; }
        });
        if (vazio) {
          ["base", "calc", "final"].forEach(function (k) { $("p" + n + "_" + k).textContent = "—"; });
          $("p" + n + "_design_img").innerHTML = "";
          $("p" + n + "_designA6_img").innerHTML = "";
          card.querySelectorAll("[data-wrap]").forEach(function (w) { w.style.display = ""; });
          return;
        }
        usados++;
        var cfg = cfgOf(prod);
        var tipo = cfg ? String(cfg[4] || "") : "";
        var grupo = cfg ? String(cfg[3] || "") : "";
        // Mostrar/ocultar blocos condicionais (equivale às linhas ocultas do VBA).
        var showA6 = tipo === "pack_pastas";
        var showMarc = prod === "Marcadores";
        card.querySelectorAll("[data-wrap]").forEach(function (w) {
          var k = w.dataset.wrap;
          if (["designA6", "acabamentoA6", "comNomeA6", "nomeA6", "cantosA6", "fitaA6"].indexOf(k) !== -1) {
            w.style.display = showA6 ? "" : "none";
          } else if (["holo", "frenteVerso", "furo", "margem"].indexOf(k) !== -1) {
            w.style.display = showMarc ? "" : "none";
          } else {
            w.style.display = "";
          }
        });
        var base = basePrice(prod, f.quantidade);
        var calc = productCalc(prod, f);
        var man = num(f.precoManual);
        var fin = isFinite(man) ? Math.round(man * 100) / 100 : calc;
        $("p" + n + "_base").textContent = eur(base);
        $("p" + n + "_calc").textContent = eur(calc);
        $("p" + n + "_final").textContent = eur(fin);
        if (typeof fin === "number") finais.push(fin);
        var u = f.design ? designUrl(grupo, f.design) : "";
        $("p" + n + "_design_img").innerHTML = u
          ? '<a href="' + u.replace(/"/g, "") + '" target="_blank" rel="noopener">Ver imagem</a>' : "Sem imagem";
        var u6 = f.designA6 ? designUrl("Pasta A6", f.designA6) : "";
        $("p" + n + "_designA6_img").innerHTML = showA6
          ? (u6 ? '<a href="' + u6.replace(/"/g, "") + '" target="_blank" rel="noopener">Ver imagem A6</a>' : "Sem imagem") : "";
      })(n);
    }
    var metodo = $("fEntrega").value;
    var portesRaw = $("fPortes").value.trim();
    var ajusteRaw = ($("fAjuste").value || "0").trim();
    var total = null, aviso = "";
    if (usados === 0) {
      total = null;
    } else if (finais.length !== usados) {
      aviso = "Rever quantidades/preços";
    } else if ((metodo === "" || metodo === "Outro") && portesRaw === "") {
      aviso = "Indicar entrega/portes";
    } else {
      var portes = portesRaw !== "" ? num(portesRaw) : entregaPortes(metodo);
      var aj = ajusteRaw === "" ? 0 : num(ajusteRaw);
      if (!isFinite(portes) || !isFinite(aj)) {
        aviso = "Rever quantidades/preços";
      } else {
        var soma = 0;
        finais.forEach(function (x) { soma += x; });
        total = Math.round((soma + portes + aj) * 100 + 1e-6) / 100;
      }
    }
    $("vTotalCalc").textContent = aviso !== "" ? aviso : eur(total);
    var acord = num($("fTotalAcordado").value.trim());
    $("vTotalGuardar").textContent = isFinite(acord) ? eur(Math.round(acord * 100) / 100) : (aviso !== "" ? aviso : eur(total));
  }

  function msg(ok, html) {
    var m = $("exMsg");
    m.className = "ex-msg " + (ok ? "ok" : "erro");
    m.innerHTML = html;
    m.scrollIntoView({ block: "nearest" });
  }
  function msgClear() { var m = $("exMsg"); m.className = "ex-msg"; m.innerHTML = ""; }

  var currentOrigem = "";

  function payload() {
    var prods = [];
    for (var n = 1; n <= 3; n++) prods.push(readCard(n));
    return {
      csrf: CSRF, op: "guardar",
      encomenda: $("selEncomenda").value, origem: currentOrigem,
      cliente: $("fCliente").value, data: $("fData").value,
      produtos: prods,
      pago: $("fPago").value, dataPago: $("fDataPago").value,
      entregue: $("fEntregue").value, dataEntrega: $("fDataEntrega").value,
      fatura: $("fFatura").value, referencia: $("fReferencia").value,
      entrega: $("fEntrega").value, portesManuais: $("fPortes").value,
      ajuste: $("fAjuste").value, motivoAjuste: $("fMotivo").value,
      observacoes: $("fObs").value, totalAcordado: $("fTotalAcordado").value
    };
  }

  function nova() {
    currentOrigem = "";
    $("selEncomenda").value = "Nova";
    $("fCliente").value = "";
    $("fData").value = new Date().toISOString().slice(0, 10);
    ["prod1", "prod2", "prod3"].forEach(function (id) { $(id).value = ""; });
    for (var n = 1; n <= 3; n++) {
      refreshDesignOptions(n);
      fillCard(n, { quantidade: 1, comNome: "Não", cantos: "Não", comNomeA6: "Não", cantosA6: "Não",
        holo: "Não", frenteVerso: "Não", furo: "Não", margem: "Não", nArtes: 0, estado: "Por fazer" });
    }
    ["fPago", "fEntregue", "fFatura"].forEach(function (id) { $(id).value = "Não"; });
    ["fDataPago", "fDataEntrega", "fReferencia", "fPortes", "fMotivo", "fObs", "fTotalAcordado"].forEach(function (id) { $(id).value = ""; });
    $("fAjuste").value = "0";
    $("fEntrega").value = "";
    msgClear();
    recalc();
  }

  function aplicarRegisto(r) {
    currentOrigem = r.origem || "";
    $("fCliente").value = r.cliente || "";
    $("fData").value = r.data || "";
    $("fPago").value = r.pago || "Não";
    $("fDataPago").value = r.dataPago || "";
    $("fEntregue").value = r.entregue || "Não";
    $("fDataEntrega").value = r.dataEntrega || "";
    $("fFatura").value = r.fatura || "Não";
    $("fReferencia").value = r.referencia || "";
    $("fEntrega").value = r.entrega || "";
    $("fPortes").value = r.portesManuais || "";
    $("fAjuste").value = (r.ajuste === undefined || r.ajuste === "") ? "0" : r.ajuste;
    $("fMotivo").value = r.motivoAjuste || "";
    $("fObs").value = r.observacoes || "";
    $("fTotalAcordado").value = r.totalAcordado || "";
    var arts = r.artigos || [];
    for (var n = 1; n <= 3; n++) {
      var a = arts[n - 1];
      if (a) {
        ensureOption($("prod" + n), a.produto || "");
        $("prod" + n).value = a.produto || "";
        refreshDesignOptions(n);
        fillCard(n, a);
      } else {
        $("prod" + n).value = "";
        refreshDesignOptions(n);
        fillCard(n, { quantidade: 1, comNome: "Não", cantos: "Não", comNomeA6: "Não", cantosA6: "Não",
          holo: "Não", frenteVerso: "Não", furo: "Não", margem: "Não", nArtes: 0, estado: "Por fazer" });
      }
    }
    msgClear();
    recalc();
  }

  function carregarLista(selecionar) {
    return fetch("encomendas-excel.php?action=listar", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var sel = $("selEncomenda");
        var cur = selecionar || sel.value || "Nova";
        sel.innerHTML = "";
        var o0 = document.createElement("option");
        o0.value = "Nova"; o0.textContent = "Nova";
        sel.appendChild(o0);
        (j.encomendas || []).forEach(function (e) {
          var o = document.createElement("option");
          o.value = e.id;
          o.textContent = e.id + " · " + (e.cliente || "—") + " · " + (e.data || "");
          sel.appendChild(o);
        });
        sel.value = cur;
        if (sel.value !== cur) sel.value = "Nova";
        var w = $("wrapLista");
        if (!j.encomendas || !j.encomendas.length) {
          w.innerHTML = '<p class="ex-miudo">Ainda sem encomendas guardadas nesta ferramenta.</p>';
        } else {
          var t = '<table class="ex-lista"><thead><tr><th>Código</th><th>Data</th><th>Cliente</th><th style="text-align:right">Total</th></tr></thead><tbody>';
          j.encomendas.slice().reverse().forEach(function (e) {
            t += "<tr><td><a href=\"#\" data-load=\"" + String(e.id).replace(/\"/g, "") + "\">" + String(e.id).replace(/</g, "&lt;") + "</a></td>"
              + "<td>" + String(e.data || "").replace(/</g, "&lt;") + "</td>"
              + "<td>" + String(e.cliente || "").replace(/</g, "&lt;") + "</td>"
              + "<td class=\"num\">" + (e.total === null || e.total === undefined ? "—" : Number(e.total).toFixed(2).replace(".", ",")) + "</td></tr>";
          });
          w.innerHTML = t + "</tbody></table>";
          w.querySelectorAll("[data-load]").forEach(function (a) {
            a.addEventListener("click", function (ev) {
              ev.preventDefault();
              $("selEncomenda").value = a.getAttribute("data-load");
              carregar();
            });
          });
        }
      });
  }

  function carregar() {
    var id = $("selEncomenda").value;
    if (!id || id === "Nova") { nova(); return; }
    fetch("encomendas-excel.php?action=carregar&encomenda=" + encodeURIComponent(id), { credentials: "same-origin" })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (x) {
        if (!x.j.ok) { msg(false, "A encomenda não foi encontrada."); return; }
        aplicarRegisto(x.j.encomenda);
        msg(true, "Encomenda <strong>" + String(id).replace(/</g, "&lt;") + "</strong> carregada.");
      });
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
        $("pendDetalhe").innerHTML = "";
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
    if (!det.length) {
      $("pendDetalhe").innerHTML = '<p class="ex-miudo">Nada pendente.</p>';
      return;
    }
    var t = '<table class="ex-lista"><thead><tr><th>Encomenda</th><th>Cliente</th><th>Produto</th>'
      + '<th style="text-align:right">Qtd</th><th>Configuração</th><th>Estado</th></tr></thead><tbody>';
    det.forEach(function (d) {
      t += "<tr><td><a href=\"#\" data-pend=\"" + esc(d.id) + "\">" + esc(d.id) + "</a></td>"
        + "<td>" + esc(d.cliente) + "</td>"
        + "<td>" + esc(d.produto) + "</td>"
        + "<td class=\"num\">" + d.quantidade + "</td>"
        + "<td>" + esc(d.config) + "</td>"
        + "<td>" + esc(d.estado) + "</td></tr>";
    });
    $("pendDetalhe").innerHTML = t + "</tbody></table>";
    $("pendDetalhe").querySelectorAll("[data-pend]").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        $("selEncomenda").value = a.getAttribute("data-pend");
        carregar();
        window.scrollTo(0, 0);
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
        carregarLista(x.j.id).then(function () {
          $("selEncomenda").value = x.j.id;
          msg(true, "Encomenda <strong>" + String(x.j.id).replace(/</g, "&lt;") + "</strong> guardada.");
          carregarPendentes();
        });
      } else if (x.j.errors) {
        msg(false, "Não foi possível guardar:<ul><li>" + x.j.errors.map(function (e) {
          return String(e).replace(/</g, "&lt;");
        }).join("</li><li>") + "</li></ul>");
      } else {
        msg(false, String(x.j.error || "Falha ao guardar."));
      }
    }).catch(function () {
      btn.disabled = false;
      msg(false, "Falha de rede ao guardar.");
    });
  }

  function init() {
    // Listas fixas.
    var prods = [""].concat((DATA.produtos || []).map(function (p) { return String(p[0]); }));
    ["prod1", "prod2", "prod3"].forEach(function (id) {
      var sel = $(id);
      prods.forEach(function (p) {
        var o = document.createElement("option");
        o.value = p; o.textContent = p === "" ? "—" : p;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () {
        refreshDesignOptions(Number(id.slice(-1)));
        recalc();
      });
    });
    var ent = $("fEntrega");
    [["", "—"]].concat((DATA.entrega || []).map(function (e) { return [String(e[0]), String(e[0])]; })).forEach(function (pair) {
      var o = document.createElement("option");
      o.value = pair[0]; o.textContent = pair[1];
      ent.appendChild(o);
    });
    var dl = $("dlClientes");
    (DATA.clientes || []).forEach(function (c) {
      var o = document.createElement("option");
      o.value = String(c);
      dl.appendChild(o);
    });
    buildCards();
    document.querySelector(".ex-concha").addEventListener("input", recalc);
    document.querySelector(".ex-concha").addEventListener("change", recalc);
    $("btnCarregar").addEventListener("click", carregar);
    $("btnNova").addEventListener("click", nova);
    $("btnGuardar").addEventListener("click", guardar);
    document.querySelectorAll(".ex-filtro").forEach(function (b) {
      b.addEventListener("click", function () {
        pendFiltro = b.getAttribute("data-f");
        document.querySelectorAll(".ex-filtro").forEach(function (x) {
          x.classList.toggle("is-on", x === b);
        });
        renderPendentes();
      });
    });
    nova();
    carregarPendentes();
    carregarLista(PRELOAD && PRELOAD !== "" ? PRELOAD : undefined).then(function () {
      if (PRELOAD && PRELOAD !== "" && PRELOAD !== "Nova") {
        $("selEncomenda").value = PRELOAD;
        carregar();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}());
</script>
</body>
</html>