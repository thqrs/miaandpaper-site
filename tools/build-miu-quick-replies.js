#!/usr/bin/env node
/*
 * Gera o catálogo inicial de respostas rápidas exactas do Míu a partir dos
 * JSON de produto. O ficheiro gerado continua a ser a fonte canónica e pode
 * ser revisto/editado em massa sem voltar a executar este script.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "site", "content", "miu-quick-replies.json");
const previous = JSON.parse(fs.readFileSync(outputPath, "utf8"));
const sources = [
  { scope: "main", directory: path.join(root, "site", "content", "products") },
  { scope: "congress-2026", directory: path.join(root, "site", "congressos", "2026", "content", "products") }
];

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function joinPt(values) {
  const list = values.map(clean).filter(Boolean);
  if (list.length < 2) return list[0] || "";
  return list.slice(0, -1).join(", ") + " e " + list[list.length - 1];
}

function optionNames(items) {
  return (Array.isArray(items) ? items : []).map(item => clean(item.title || item.value)).filter(Boolean);
}

function optionsAnswer(items, noun) {
  const names = optionNames(items);
  if (!names.length) return "Este passo não apresenta opções de escolha.";
  if (names.length <= 10) return "Tens " + names.length + " " + noun + ": " + joinPt(names) + ".";
  return "Tens " + names.length + " " + noun + " visíveis neste passo.";
}

function optionDetails(items) {
  const parts = (Array.isArray(items) ? items : []).map(item => {
    const title = clean(item.title || item.value);
    const detail = clean(item.subtitle || item.note || item.drawerText).replace(/[.;:,]+$/, "");
    return title && detail ? title + " — " + detail : title;
  }).filter(Boolean);
  return parts.length ? joinPt(parts) + "." : "As opções estão identificadas directamente na página.";
}

function effectiveItems(product, step) {
  if (Array.isArray(step.items) && step.items.length) return step.items;
  if (step.colorSourceStep) {
    const source = (product.steps || []).find(candidate => candidate.id === step.colorSourceStep);
    if (source && Array.isArray(source.items)) return source.items;
  }
  return [];
}

function contextPrefix(scope, product, step) {
  const shortScope = scope === "congress-2026" ? "c26" : "main";
  return [shortScope, product.slug, step.id].join("-").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function reply(prefix, suffix, question, answer) {
  return {
    id: (prefix + "-" + suffix).slice(0, 80),
    question: clean(question),
    answer: clean(answer)
  };
}

function selectionReply(prefix, step, count, noun) {
  const multiple = step.selection === "multi";
  return reply(
    prefix,
    "multiple",
    "Posso escolher mais do que uma opção?",
    multiple
      ? "Sim. Neste passo podes escolher várias " + noun + " entre as " + count + " disponíveis."
      : "Não. Neste passo escolhes apenas uma das " + count + " opções; uma nova escolha substitui a anterior."
  );
}

function whenReply(prefix, step) {
  if (!step.when || !step.when.field) return null;
  const values = step.when.in || (step.when.equals != null ? [step.when.equals] : []);
  if (!values.length) return null;
  return reply(
    prefix,
    "why-visible",
    "Porque apareceu este passo?",
    values.length === 1
      ? "Este passo aparece porque escolheste “" + values[0] + "”."
      : "Este passo aparece porque escolheste uma destas opções: " + joinPt(values.map(value => "“" + value + "”")) + "."
  );
}

function fieldName(field) {
  return clean(field.label || field.placeholder || field.name);
}

function fieldsRequiredAnswer(fields) {
  const valid = (Array.isArray(fields) ? fields : []).filter(field => fieldName(field));
  const required = valid.filter(field => field.required).map(fieldName);
  const optional = valid.filter(field => !field.required).map(fieldName);
  if (!required.length) {
    return "Não. " + joinPt(optional) + (optional.length === 1 ? " é opcional" : " são opcionais") + "; podes deixar " + (optional.length === 1 ? "esse campo" : "esses campos") + " em branco.";
  }
  if (!optional.length) {
    return "Sim. " + joinPt(required) + (required.length === 1 ? " é obrigatório." : " são obrigatórios.");
  }
  return joinPt(required) + (required.length === 1 ? " é obrigatório; " : " são obrigatórios; ")
    + joinPt(optional) + (optional.length === 1 ? " é opcional." : " são opcionais.");
}

function designReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const items = effectiveItems(product, step);
  const noun = step.template === "palette-grid" ? "cores" : (step.template === "design-grid" ? "opções" : "opções");
  const replies = [
    reply(prefix, "options", "Que opções tenho neste passo?", optionsAnswer(items, noun)),
    selectionReply(prefix, step, items.length, noun)
  ];
  const visible = whenReply(prefix, step);
  if (visible) {
    replies.push(visible);
  } else if (step.template === "design-grid") {
    if (step.customPromo && step.customPromo.enabled) {
      replies.push(reply(
        prefix,
        "own-design",
        "Posso usar uma imagem minha?",
        "Sim. Carrega em “" + clean(step.customPromo.actionLabel || "Personalizar") + "” para abrires [Personalização](" + clean(step.customPromo.href || "personalizacao.html") + ")."
      ));
    } else if (product.slug === "quadros") {
      replies.push(reply(
        prefix,
        "own-photo",
        "Posso usar uma fotografia minha?",
        "Sim. Escolhe “Foto e Frase”; o passo seguinte permite enviar uma fotografia."
      ));
    } else {
      replies.push(reply(
        prefix,
        "own-design",
        "Posso usar um design meu neste passo?",
        "Não. Aqui escolhes apenas designs do catálogo. Para criares o produto com uma imagem tua, abre [Personalização](personalizacao.html)."
      ));
    }
  } else {
    replies.push(reply(
      prefix,
      "advance",
      "O passo avança sozinho depois da escolha?",
      step.autoAdvance
        ? "Sim. Depois de escolheres uma opção, o formulário avança automaticamente."
        : "Não. Depois de escolheres uma opção, usa o botão para continuar."
    ));
  }
  return replies;
}

function drawerReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const drawers = Array.isArray(step.drawers) ? step.drawers : [];
  const optionParts = drawers.map(drawer => clean(drawer.title || drawer.label) + ": " + joinPt(optionNames(drawer.items))).filter(Boolean);
  const required = drawers.filter(drawer => drawer.required).map(drawer => clean(drawer.title || drawer.label));
  const optional = drawers.filter(drawer => !drawer.required).map(drawer => clean(drawer.title || drawer.label));
  const includedOptions = [];
  const paidOptions = [];
  drawers.forEach(drawer => (drawer.items || []).forEach(item => {
    const cents = item.extraPriceCentsPerUnit != null ? item.extraPriceCentsPerUnit : item.extraPriceCents;
    if (cents != null) (Number(cents) === 0 ? includedOptions : paidOptions).push(clean(item.title));
  }));
  let requiredAnswer = "Não existem escolhas obrigatórias neste passo.";
  if (required.length && !optional.length) requiredAnswer = "Sim. Tens de escolher uma opção em " + joinPt(required) + ".";
  else if (required.length) requiredAnswer = joinPt(required) + " é obrigatório; " + joinPt(optional) + " é opcional.";
  return [
    reply(prefix, "options", "Que opções tenho neste passo?", optionParts.join(". ") + "."),
    reply(prefix, "required", "É obrigatório escolher?", requiredAnswer),
    reply(
      prefix,
      "price",
      "Estas opções alteram o preço?",
      paidOptions.length
        ? "Sim. " + joinPt(paidOptions) + (paidOptions.length === 1 ? " acrescenta" : " acrescentam") + " um valor por unidade; " + joinPt(includedOptions) + (includedOptions.length === 1 ? " não acrescenta valor." : " não acrescentam valor.")
        : "Não. " + joinPt(includedOptions) + (includedOptions.length === 1 ? " não acrescenta valor." : " não acrescentam valor.")
    )
  ];
}

function laminationReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const items = effectiveItems(product, step);
  return [
    reply(prefix, "options", "Que acabamentos posso escolher?", optionsAnswer(items, "acabamentos")),
    selectionReply(prefix, step, items.length, "acabamentos"),
    reply(prefix, "difference", "Qual é a diferença entre os acabamentos?", optionDetails(items))
  ];
}

function addOnReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const items = effectiveItems(product, step);
  return [
    reply(prefix, "options", "Que add-ons posso acrescentar?", optionsAnswer(items, "add-ons")),
    reply(prefix, "multiple", "Posso escolher vários add-ons?", "Sim. Podes escolher vários dos " + items.length + " add-ons e os valores acumulam-se."),
    reply(prefix, "optional", "Tenho de escolher algum add-on?", "Não. Os quatro add-ons são opcionais; podes avançar sem escolher nenhum.")
  ];
}

function purchaseReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const items = effectiveItems(product, step);
  const choices = items.map(item => clean(item.title));
  const quantity = step.orderQuantity || {};
  const minimum = Number(quantity.minimum || step.minimumOrderQuantity || 1);
  return [
    reply(prefix, "options", "Que opções de compra existem?", joinPt(choices) + "."),
    reply(
      prefix,
      "more-than-one",
      "Posso encomendar mais do que uma unidade?",
      step.allowOrderQuantity
        ? "Sim. Podes encomendar de " + minimum + " a " + Number(quantity.maximum || 9999) + " unidades da opção escolhida, todas com a mesma configuração."
        : "Não. Este passo permite apenas uma unidade da opção escolhida."
    ),
    reply(prefix, "minimum", "Qual é a quantidade mínima?", "A quantidade mínima é " + minimum + " unidade da opção de compra escolhida.")
  ];
}

function quantityReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const items = effectiveItems(product, step);
  const quantities = items.map(item => Number(item.quantity)).filter(Number.isFinite);
  const minimum = Number(step.minimumQuantity || (quantities.length ? Math.min.apply(null, quantities) : 1));
  if (step.hidden) {
    return [
      reply(prefix, "fixed", "Quantas molduras inclui este pedido?", "Este pedido inclui 1 moldura."),
      reply(prefix, "change", "Posso alterar a quantidade aqui?", "Não. A quantidade está fixa em 1 moldura neste passo."),
      reply(prefix, "visible", "Tenho de preencher este passo?", "Não. Este passo está oculto e a quantidade 1 é aplicada automaticamente.")
    ];
  }
  const quantityAnswer = step.freeQuantity
    ? "Podes escrever qualquer quantidade a partir de " + minimum + ". Os botões de atalho mostram " + joinPt(quantities.map(String)) + "."
    : "Podes escolher uma destas quantidades: " + joinPt(quantities.map(String)) + ".";
  const splitAnswer = step.adjustPerDesign
    ? "Sim. Podes repartir a quantidade total entre os designs escolhidos e indicar quantidades diferentes para cada um."
    : "Não. A quantidade escolhida aplica-se à única configuração deste pedido.";
  const discountAnswer = step.allowUnitDiscounts
    ? "Sim. O preço por unidade desce nos escalões de quantidade mostrados na tabela deste passo."
    : "Não. O preço por unidade mantém-se igual em todas as quantidades deste passo.";
  return [
    reply(prefix, "quantity", "Que quantidade posso escolher?", quantityAnswer),
    reply(prefix, "split", "Posso repartir a quantidade por vários designs?", splitAnswer),
    reply(prefix, "unit-price", "O preço por unidade muda com a quantidade?", discountAnswer)
  ];
}

function detailReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const fields = Array.isArray(step.fields) ? step.fields : [];
  const names = fields.map(fieldName).filter(Boolean);
  const isCard = /cart[aã]o de apresenta/i.test(clean(step.title));
  const replies = [];
  if (isCard) {
    replies.push(reply(
      prefix,
      "what-card",
      "O que é o cartão de apresentação?",
      "É o cartão impresso que acompanha os artigos da encomenda. Neste produto pode levar " + joinPt(names) + "."
    ));
    replies.push(reply(prefix, "fields", "Que dados posso colocar no cartão?", "Podes colocar " + joinPt(names) + "."));
  } else {
    replies.push(reply(prefix, "fields", "O que devo escrever neste passo?", "Este passo pede " + joinPt(names) + "."));
    const visible = whenReply(prefix, step);
    if (visible) replies.push(visible);
    else replies.push(reply(prefix, "purpose", "Para que servem estes dados?", clean(step.text) || "Estes dados são usados na personalização deste produto."));
  }
  replies.push(reply(prefix, "required", "É obrigatório preencher estes dados?", fieldsRequiredAnswer(fields)));
  return replies.slice(0, 3);
}

function deliveryReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const delivery = (product.deliveryOptions || []).map(option => clean(option.label));
  const fields = step.contact && Array.isArray(step.contact.fields) ? step.contact.fields : [];
  const required = fields.filter(field => field.required).map(fieldName);
  return [
    reply(prefix, "delivery", "Que opções de entrega tenho?", joinPt(delivery) + "."),
    reply(prefix, "contact", "Que dados de contacto são obrigatórios?", "Tens de preencher " + joinPt(required) + "."),
    reply(prefix, "nif", "O NIF é obrigatório?", "Não. O NIF é opcional. Sem NIF, a fatura é emitida como consumidor final depois da confirmação do pagamento.")
  ];
}

function confirmReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  return [
    reply(prefix, "confirmed", "O pedido fica logo confirmado?", "Não. O envio regista o pedido para a Mia o rever; ainda não confirma a produção, o pagamento nem a data."),
    reply(prefix, "change", "Posso corrigir alguma coisa antes de enviar?", "Sim. Volta ao passo que queres corrigir, altera a escolha e regressa a este resumo."),
    reply(prefix, "after", "O que acontece depois de enviar?", "A Mia revê o pedido e entra em contacto para confirmar os detalhes necessários, o pagamento e a data.")
  ];
}

function coverReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  return [
    reply(prefix, "optional", "A personalização da capa é obrigatória?", "Não. Podes escolher “Não” e receber a capa sem nome."),
    reply(prefix, "without-name", "Posso encomendar a capa sem nome?", "Sim. Escolhe “Não”; a capa segue sem personalização."),
    reply(prefix, "length", "Qual é o tamanho máximo do nome?", "O nome pode ter até " + Number(step.maxLength || 25) + " caracteres, incluindo espaços.")
  ];
}

function uploadReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const upload = step.upload || {};
  if (step.template === "original-artwork-upload") {
    return [
      reply(prefix, "formats", "Que formatos posso enviar?", "Podes enviar " + joinPt((upload.acceptedExtensions || []).map(value => value.replace(/^\./, "").toUpperCase())) + "."),
      reply(prefix, "files", "Quantas imagens posso enviar?", "Podes enviar entre " + Number(upload.minimumFiles || 1) + " e " + Number(upload.maxFiles || 1) + " ficheiros."),
      reply(prefix, "required", "Tenho de enviar pelo menos uma imagem?", "Sim. Este passo exige pelo menos " + Number(upload.minimumFiles || 1) + " imagem para continuar.")
    ];
  }
  const visible = whenReply(prefix, step);
  return [
    reply(prefix, "files", "Posso enviar mais do que uma fotografia?", "Não. Este passo aceita apenas 1 fotografia."),
    reply(prefix, "required", "É obrigatório enviar a fotografia?", "Sim. Tens de enviar uma fotografia ou escolher “" + clean(upload.helpLabel || "Preciso de ajuda") + "”."),
    visible || reply(prefix, "help", "Posso pedir ajuda com a fotografia?", "Sim. Escolhe “" + clean(upload.helpLabel || "Preciso de ajuda") + "” para continuares sem enviar o ficheiro agora.")
  ];
}

function customProductReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const products = Array.isArray(step.products) ? step.products : [];
  const grouped = {};
  products.forEach(item => {
    const group = clean(item.group || "Outros");
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(clean(item.title));
  });
  const groupText = Object.keys(grouped).map(group => group + ": " + joinPt(grouped[group])).join(". ") + ".";
  const finishes = (step.finishes || []).map(item => clean(item.title)).filter(Boolean);
  return [
    reply(prefix, "products", "Que produtos posso criar com a minha imagem?", groupText),
    reply(prefix, "multiple", "Posso escolher vários produtos para a mesma imagem?", "Sim. Podes escolher vários dos " + products.length + " produtos e configurar cada um separadamente."),
    reply(prefix, "finishes", "Que acabamentos e extras existem?", "Podes escolher " + joinPt(finishes) + ".")
  ];
}

function customQuantityReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  return [
    reply(prefix, "different", "Posso usar quantidades diferentes em cada produto?", "Sim. Cada produto escolhido tem a sua própria quantidade."),
    reply(prefix, "required", "Tenho de indicar uma quantidade para cada produto?", "Sim. Todos os produtos seleccionados precisam de uma quantidade antes de continuares."),
    reply(prefix, "calculation", "Como é calculado o preço neste passo?", "O preço é calculado separadamente para cada produto, quantidade, tamanho e acabamento que escolheste.")
  ];
}

function mediaReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const items = effectiveItems(product, step);
  const visible = whenReply(prefix, step);
  return [
    reply(prefix, "options", "Que opções tenho neste passo?", optionsAnswer(items, "opções")),
    selectionReply(prefix, step, items.length, "opções"),
    visible || reply(prefix, "difference", "Qual é a diferença entre as opções?", optionDetails(items))
  ];
}

function repliesForStep(scope, product, step) {
  switch (step.template) {
    case "design-grid":
    case "text-grid":
    case "palette-grid": return designReplies(scope, product, step);
    case "option-drawers": return drawerReplies(scope, product, step);
    case "lamination-choice": return laminationReplies(scope, product, step);
    case "add-ons": return addOnReplies(scope, product, step);
    case "purchase-option": return purchaseReplies(scope, product, step);
    case "quantity-builder": return quantityReplies(scope, product, step);
    case "details-form": return detailReplies(scope, product, step);
    case "delivery-contact": return deliveryReplies(scope, product, step);
    case "confirm": return confirmReplies(scope, product, step);
    case "cover-personalization": return coverReplies(scope, product, step);
    case "photo-upload":
    case "original-artwork-upload": return uploadReplies(scope, product, step);
    case "custom-product-builder": return customProductReplies(scope, product, step);
    case "custom-quantity-builder": return customQuantityReplies(scope, product, step);
    case "media-list": return mediaReplies(scope, product, step);
    default: throw new Error("Template do Míu sem respostas: " + step.template);
  }
}

const contexts = {};
for (const source of sources) {
  const files = fs.readdirSync(source.directory).filter(file => file.endsWith(".json")).sort();
  for (const file of files) {
    const product = JSON.parse(fs.readFileSync(path.join(source.directory, file), "utf8"));
    (product.steps || []).forEach((step, index) => {
      const key = [source.scope, product.slug, step.id].join(":");
      contexts[key] = {
        scope: source.scope,
        productSlug: product.slug,
        productName: clean(product.name || product.title || product.slug),
        stepId: step.id,
        stepName: clean(step.title || step.label || step.id),
        stepOrder: index,
        items: repliesForStep(source.scope, product, step)
      };
    });
  }
}

const catalog = {
  schemaVersion: 2,
  global: {
    label: "Perguntas gerais",
    description: "Mostradas fora de um passo de produto.",
    items: [
      { id: "global-encomenda", question: "Como faço uma encomenda?", answer: "Escolhe um produto, completa os passos e confirma o resumo. O envio regista o pedido para a Mia rever os detalhes, o pagamento e a data." },
      { id: "global-personalizar", question: "Onde posso usar uma imagem minha?", answer: "Abre [Personalização](personalizacao.html), envia a imagem e escolhe os produtos que queres criar com ela." },
      { id: "global-entrega", question: "Que formas de entrega existem?", answer: "Podes recolher na casa da Mia, receber por CTT ou juntar o pedido a outra encomenda que ainda não foi enviada." },
      { id: "global-precos", question: "Onde vejo o preço?", answer: "O preço é calculado na página do produto com a quantidade, o tamanho, os acabamentos e a entrega que escolheste. O total aparece no resumo." },
      { id: "global-contacto", question: "Como falo com a Mia?", answer: "Usa o [formulário de contacto](contacto.html) para falares directamente com a Mia." }
    ]
  },
  contexts,
  intents: previous.intents
};

const allItems = [catalog.global].concat(Object.values(contexts)).flatMap(group => group.items || []);
const ids = new Set();
for (const item of allItems) {
  if (!item.id || !item.question || !item.answer) throw new Error("Resposta incompleta: " + JSON.stringify(item));
  if (item.id.length > 80) throw new Error("ID demasiado longo: " + item.id);
  if (ids.has(item.id)) throw new Error("ID repetido: " + item.id);
  ids.add(item.id);
}

fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(Object.keys(contexts).length + " contextos e " + allItems.length + " respostas escritas em " + outputPath);
