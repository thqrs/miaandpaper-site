/* Gera um inventário de prompts apenas para os slots ainda não finalizados.
   Não chama qualquer modelo nem gera imagens. */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const SITE = path.join(ROOT, "site");
const OUTPUT = path.join(ROOT, "prompts-geracao-imagens.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function productEntries(directory, context, contextLabel) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => /^[a-z0-9-]+\.json$/.test(name))
    .sort()
    .map((name) => {
      const slug = name.replace(/\.json$/, "");
      return {
        key: context === "principal" ? slug : context + "|" + slug,
        slug,
        kind: "product",
        context,
        contextLabel,
        product: readJson(path.join(directory, name))
      };
    });
}

function loadCollector() {
  const sandbox = { window: {} };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(SITE, "galeria-slots.js"), "utf8"), sandbox, {
    filename: "galeria-slots.js"
  });
  return sandbox.window.MiaGaleriaSlots;
}

function resolveImage(api, entry, slot) {
  const value = api.resolveTrail(entry.product, slot.trail);
  if (typeof value === "string" && value) return value;
  if (slot.gaveta) return slot.gaveta.siblings[slot.gaveta.index] || null;
  return null;
}

function familyName(entry) {
  const names = {
    home: "Homepage",
    caderninhos: "Mini-Cadernos",
    cadernos: "Cadernos",
    crachas: "Crachás",
    imanes: "Ímanes",
    quadros: "Molduras",
    lembrancas: "Lembranças",
    postais: "Postais"
  };
  return names[entry.slug] || entry.product.name || entry.slug;
}

function filenameHint(image) {
  if (!image) return "";
  let value = path.basename(image, path.extname(image))
    .replace(/_reduced(?:_q\d+)?$/i, "")
    .replace(/(?:^|[_-])q\d+(?:$|[_-])/gi, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value || /^\d+$/.test(value) || /^img(?:\s*\(\d+\)|\s+\d+)?$/i.test(value)) return "";
  return value;
}

function visualPurpose(entry, slot) {
  const detail = String(slot.detail || "").toLocaleLowerCase("pt-PT");
  if (entry.kind === "home" && slot.slotName === "home-hero-carousel") return "hero-homepage";
  if (entry.kind === "home" && slot.slotName === "home-feature") return "destaque-homepage";
  if (entry.kind === "home") return "carrossel-homepage";
  if (slot.summaryKey) return "placeholder-resumo-encomenda";
  if (slot.gaveta || slot.prop === "interiorImages") return "interior-caderno";
  if (slot.prop === "sideImage") return "comparacao-produto";
  if (slot.prop === "drawerImages") return "detalhe-produto";
  if (/lamina/.test(detail)) return "acabamento-laminacao";
  if (/opção de compra/.test(detail)) return "composicao-opcao-compra";
  if (/exemplo/.test(detail) || slot.prop === "exampleImage" || slot.prop === "exampleImages") return "exemplo-instrucional";
  return "escolha-produto";
}

function referenceSentence(image) {
  return image
    ? "Usa como referência visual a imagem indicada em `imagem_atual`: preserva o produto, o motivo gráfico, as cores e qualquer texto intencional, criando uma imagem nova e não uma cópia pixel a pixel."
    : "Cria a imagem de raiz, sem depender de uma referência existente, respeitando rigorosamente a função e o produto descritos neste registo.";
}

function valueAt(root, trail) {
  let value = root;
  for (const part of trail || []) value = value == null ? null : value[part];
  return value;
}

function contextualFacts(entry, slot) {
  const item = slot.itemTrail ? valueAt(entry.product, slot.itemTrail) : null;
  if (!item || typeof item !== "object") return "";
  const values = [item.alt, item.exampleAlt, item.subtitle, item.note, item.description, item.includes]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value || "").trim())
    .filter((value) => value && !/^\d+(?:[,.]\d+)?\s*€$/.test(value));
  const unique = values.filter((value, index) => values.indexOf(value) === index);
  return unique.length ? "Informação factual a respeitar: " + unique.join("; ") + "." : "";
}

function compactSummarySentence(slot, requiredByGroup) {
  return requiredByGroup || /resumo/i.test(String(slot.detail || "")) || /-RESUMO$/.test(String(slot.id || ""))
    ? "A mesma imagem também é usada numa miniatura compacta do resumo da encomenda; compõe-na para continuar legível nos dois contextos."
    : "";
}

function purchaseDescription(detail) {
  const value = String(detail || "").toLocaleLowerCase("pt-PT");
  if (value.includes("pack_pioneiro") || value.includes("pack pioneiro")) {
    return "um Caderno Pioneiro, um marcador laminado e cinco crachás coordenados, incluindo um com o design da capa";
  }
  if (value.includes("pack_normal") || value.includes("pack normal")) {
    return "um Caderno Normal, um marcador laminado e cinco crachás coordenados, incluindo um com o design da capa";
  }
  if (value.includes("caderno_pioneiro") || value.includes("caderno pioneiro")) {
    return "um Caderno Pioneiro e a oferta associada, apresentados como um conjunto coerente";
  }
  return "um Caderno Normal e a oferta associada, apresentados como um conjunto coerente";
}

function summaryFieldName(key, fallback) {
  const names = {
    phrase: "frase em vinil",
    baby_details: "dados do bebé",
    baby_custom_animal: "animal personalizado",
    super_description: "descrição da ideia personalizada",
    photo_help: "ajuda para escolher a fotografia",
    audio: "mensagem de áudio"
  };
  return names[key] || fallback;
}

function promptFor(entry, slot, image, options) {
  const family = familyName(entry);
  const item = String(slot.itemLabel || slot.detail || family).trim();
  const detail = String(slot.detail || "imagem").trim();
  const hint = filenameHint(image);
  const purpose = visualPurpose(entry, slot);
  const reference = referenceSentence(image);
  const summary = compactSummarySentence(slot, options && options.needsCompactSummary);
  const facts = contextualFacts(entry, slot);
  let brief;

  if (purpose === "hero-homepage") {
    brief = `Cria uma fotografia editorial horizontal 16:9 para o hero da homepage da Mia & Paper, slide ${Number(slot.slideIndex || 0) + 1}. Dá protagonismo ao produto associado a “${hint || item}”, com composição ampla, movimento visual suave e espaço negativo suficiente para texto da interface sem o inserir na própria imagem.`;
  } else if (purpose === "destaque-homepage") {
    brief = `Cria uma fotografia de destaque para a homepage da categoria “${item}”. Mostra uma peça Mia & Paper terminada, imediatamente reconhecível, num enquadramento editorial 4:3 que funcione tanto em desktop como em telemóvel.`;
  } else if (purpose === "carrossel-homepage") {
    brief = `Cria uma fotografia para o carrossel da homepage da categoria “${item}”, variação ${Number(slot.slideIndex || 0) + 1}. Mostra o produto artesanal completo, com composição 4:3, leitura imediata em miniatura e variedade visual em relação aos restantes slides.`;
  } else if (purpose === "interior-caderno") {
    const slide = slot.gaveta ? Number(slot.gaveta.index) + 1 : Number(slot.slideIndex || 0);
    const subject = /sticker/i.test(image || "")
      ? "a folha de autocolantes incluída no interior"
      : `a página ou detalhe interior ${slide || "pedido"}`;
    brief = `Cria uma fotografia documental nítida de ${subject} do “${item}”. O papel, a impressão, a encadernação e as margens devem parecer reais; mostra o conteúdo inteiro sem cortar elementos importantes e mantém a perspetiva consistente com uma apresentação de catálogo.`;
  } else if (purpose === "acabamento-laminacao") {
    const finish = detail.replace(/^laminação\s*/i, "").replace(/\s*·\s*resumo$/i, "") || detail;
    brief = `Cria uma fotografia de produto do “${item}” que demonstre claramente o acabamento “${finish}”. Mantém a capa reconhecível e usa luz rasante controlada para revelar brilho, textura ou efeito holográfico sem reflexos queimados.`;
  } else if (purpose === "composicao-opcao-compra") {
    brief = `Cria uma composição de e-commerce para “${item}” mostrando ${purchaseDescription(detail)}. Todos os elementos devem estar totalmente visíveis, à escala correta e organizados de forma clara para a pessoa perceber de imediato o que está incluído.`;
  } else if (purpose === "comparacao-produto") {
    brief = `Cria uma fotografia complementar de comparação para “${item}”, correspondente a “${detail}”. Mostra espessura, perfil, escala ou acabamento num ângulo que acrescente informação à imagem principal, com o produto inteiro e proporções realistas.`;
  } else if (purpose === "detalhe-produto") {
    brief = `Cria uma fotografia de detalhe para “${item}”, vista “${detail}”. Evidencia materiais, relevo, camadas e acabamento artesanal através de um ângulo próximo, mantendo contexto suficiente para reconhecer o produto.`;
  } else if (purpose === "placeholder-resumo-encomenda") {
    brief = `Cria uma pequena imagem ilustrativa para o campo “${summaryFieldName(slot.summaryKey, detail)}” na caixa “O que vais encomendar” de uma moldura personalizada. Deve explicar visualmente o tipo de personalização sem usar dados reais de clientes; usa conteúdo fictício neutro e claramente demonstrativo.`;
  } else if (purpose === "exemplo-instrucional") {
    brief = `Cria uma imagem de exemplo clara para o passo “${slot.section}”, opção “${item}” e função “${detail}”. A imagem deve ensinar o que a pessoa está a escolher, com um único exemplo inequívoco e sem elementos decorativos que confundam a decisão.`;
  } else if (entry.slug === "cadernos") {
    brief = `Cria uma fotografia de e-commerce do “${item}”. Mostra a capa completa e direita, com cantos, lombada e textura do papel credíveis; usa um ângulo frontal ou ligeiramente elevado e garante que o design${hint ? ` associado a “${hint}”` : ""} fica legível em miniatura.`;
  } else if (entry.slug === "caderninhos") {
    brief = `Cria uma fotografia de e-commerce do “${item}”, um mini-caderno artesanal. Comunica claramente a escala pequena, mostra a capa completa e a encadernação, e mantém o design${hint ? ` associado a “${hint}”` : ""} nítido e reconhecível.`;
  } else if (entry.slug === "crachas") {
    brief = `Cria uma fotografia macro frontal do crachá “${item}”. O círculo, o rebordo metálico, a impressão e qualquer relevo devem parecer fisicamente reais; centra o produto, evita perspetiva deformada e mantém o design perfeitamente legível.`;
  } else if (entry.slug === "imanes") {
    brief = `Cria uma fotografia de e-commerce do íman “${item}”. Mostra com clareza o formato, o recorte, a espessura e a superfície impressa, com proporções realistas e o design frontal nítido.`;
  } else if (entry.slug === "quadros") {
    brief = `Cria uma fotografia de produto da moldura personalizada “${item}”, correspondente à vista “${detail}”. Mostra a moldura completa, o vidro ou frente sem reflexos excessivos, materiais reais e o trabalho de papel/personalização com detalhe suficiente para catálogo.`;
  } else {
    brief = `Cria uma fotografia de produto para “${item}”, da família “${family}”, correspondente à função “${detail}”. O produto deve ficar completo, reconhecível e imediatamente compreensível numa grelha de escolhas.`;
  }

  return [
    brief,
    facts,
    reference,
    summary,
    "Estética Mia & Paper: artesanal portuguesa, elegante e acolhedora, tons naturais de papel com verdes e amarelos suaves, luz natural difusa, fundo simples e textura realista.",
    "Sem marcas de água, sem logótipos inventados, sem texto adicional e sem objetos que não façam parte do produto. Se a referência contiver texto, preserva exatamente a ortografia e não inventes letras."
  ].filter(Boolean).join(" ");
}

const collector = loadCollector();
const entries = [
  ...productEntries(path.join(SITE, "content", "products"), "principal", "Site principal"),
  ...productEntries(path.join(SITE, "congressos", "2026", "content", "products"), "congresso-2026", "Congresso 2026"),
  {
    key: "home",
    slug: "home",
    kind: "home",
    context: "principal",
    contextLabel: "Site principal",
    product: readJson(path.join(SITE, "content", "home.json"))
  }
];
const done = new Set(readJson(path.join(SITE, "content", "galeria-estado.json")).done || []);
const allSlots = entries.flatMap((entry) => collector.collect(entry).map((slot) => {
  const image = resolveImage(collector, entry, slot);
  const finalized = done.has(slot.doneKey) || (slot.doneAliases || []).some((alias) => done.has(alias));
  return { entry, slot, image, finalized };
}));
const pendingSlots = allSlots.filter(({ finalized }) => !finalized);
const finalizedImagePaths = new Set(allSlots.filter(({ finalized, image }) => finalized && image).map(({ image }) => image));
const sourceGroups = {};

pendingSlots.forEach((record) => {
  const key = record.slot.sourceKey || record.slot.key;
  if (!sourceGroups[key]) sourceGroups[key] = [];
  sourceGroups[key].push(record);
});

const promptBySource = {};
Object.keys(sourceGroups).forEach((key) => {
  const group = sourceGroups[key];
  const representative = group.find(({ slot }) => !/resumo/i.test(String(slot.detail || "")) && !/-RESUMO$/.test(String(slot.id || ""))) || group[0];
  const needsCompactSummary = group.some(({ slot }) => /resumo/i.test(String(slot.detail || "")) || /-RESUMO$/.test(String(slot.id || "")));
  promptBySource[key] = promptFor(representative.entry, representative.slot, representative.image, { needsCompactSummary });
});
const images = pendingSlots.map(({ entry, slot, image }) => {
  const sourceKey = slot.sourceKey || slot.key;
  return {
    codigo_curto: slot.shortId,
    codigo_longo: slot.id,
    contexto: entry.contextLabel,
    entrada: entry.key,
    produto: familyName(entry),
    seccao: slot.section,
    item: slot.itemLabel || null,
    papel_visual: slot.detail,
    tipo_prompt: visualPurpose(entry, slot),
    imagem_atual: image,
    chave_origem: sourceKey,
    imagem_atual_partilhada_com_finalizada: !!(image && finalizedImagePaths.has(image)),
    finalizada: false,
    prompt: promptBySource[sourceKey]
  };
}).sort((a, b) => a.codigo_curto.localeCompare(b.codigo_curto, "pt-PT"));

const output = {
  schema: "miaandpaper.image-generation-prompts.v1",
  gerado_em: new Date().toISOString(),
  idioma_prompts: "pt-PT",
  aviso: "Este ficheiro contém apenas prompts. Nenhuma imagem foi gerada.",
  criterio: "Apenas localizações não marcadas como finalizadas em site/content/galeria-estado.json.",
  regra_critica: "Quando imagem_atual_partilhada_com_finalizada for true, uma futura geração deve ser guardada num ficheiro novo e associada apenas ao slot pendente; nunca sobrescrever a imagem atual.",
  totais: {
    locais_descobertos: allSlots.length,
    locais_finalizados_excluidos: allSlots.length - pendingSlots.length,
    locais_nao_finalizados: pendingSlots.length,
    locais_pendentes_com_imagem_partilhada_com_finalizada: images.filter((image) => image.imagem_atual_partilhada_com_finalizada).length
  },
  imagens: images
};

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(`Criado ${path.relative(ROOT, OUTPUT)} com ${images.length} prompts.`);
