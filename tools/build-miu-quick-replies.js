#!/usr/bin/env node
/*
 * Gera o catálogo de respostas rápidas do Míu a partir dos JSON de produto.
 * Produz perguntas e respostas naturais, acolhedoras e em Português de Portugal,
 * alinhadas com a identidade artesanal da Mia & Paper.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "site", "content", "miu-quick-replies.json");
const previous = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, "utf8")) : { intents: [] };
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

function optionDetails(items) {
  const parts = (Array.isArray(items) ? items : []).map(item => {
    const title = clean(item.title || item.value);
    const detail = clean(item.subtitle || item.note || item.drawerText).replace(/[.;:,]+$/, "");
    return title && detail ? title + " (" + detail.toLowerCase() + ")" : title;
  }).filter(Boolean);
  return parts.length ? joinPt(parts) + "." : "Podes ver os detalhes de cada opção diretamente na página.";
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
    multiple ? "Posso escolher várias opções?" : "Posso escolher mais do que uma opção?",
    multiple
      ? "Sim! Podes selecionar várias opções em conjunto para compores o teu pedido."
      : "Neste passo escolhes uma opção de cada vez. Se quiseres combinações diferentes, basta adicionares outro artigo ao carrinho no final."
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
      ? "Este passo aparece para personalizares a opção “" + values[0] + "” que escolheste anteriormente."
      : "Este passo aparece para complementares a tua escolha anterior (" + joinPt(values.map(value => "“" + value + "”")) + ")."
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
    return "Não, estes campos são totalmente opcionais. Podes avançar e deixá-los em branco se preferires.";
  }
  if (!optional.length) {
    return "Sim, o preenchimento de " + joinPt(required) + " é necessário para prepararmos a personalização da tua peça.";
  }
  return "O campo " + joinPt(required) + " é necessário para a personalização; " + joinPt(optional) + " é opcional.";
}

function designReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const items = effectiveItems(product, step);
  const replies = [];

  if (step.template === "palette-grid") {
    replies.push(reply(
      prefix,
      "how-to-choose",
      "Como escolho as cores?",
      "Basta clicares na cor ou padrão que mais gostares para veres o resultado aplicado logo em cima."
    ));
    replies.push(selectionReply(prefix, step, items.length, "cores"));
  } else {
    replies.push(reply(
      prefix,
      "different-designs",
      "Posso escolher capas diferentes no mesmo pedido?",
      "Cada artigo adicionado ao carrinho leva uma capa. Para teres capas ou ilustrações diferentes, basta adicionar cada uma individualmente ao carrinho!"
    ));
  }

  const visible = whenReply(prefix, step);
  if (visible) {
    replies.push(visible);
  } else if (step.template === "design-grid" || step.template === "text-grid") {
    if (step.customPromo && step.customPromo.enabled) {
      replies.push(reply(
        prefix,
        "own-design",
        "Posso usar um desenho ou foto minha?",
        "Sim! Carrega em “" + clean(step.customPromo.actionLabel || "Personalizar") + "” ou abre a [Personalização](" + clean(step.customPromo.href || "personalizacao.html") + ") para usares o teu próprio ficheiro."
      ));
    } else if (product.slug === "quadros") {
      replies.push(reply(
        prefix,
        "own-photo",
        "Posso usar uma fotografia minha?",
        "Sim! Escolhe a opção “Foto e Frase” e poderás enviar a tua fotografia logo no passo seguinte."
      ));
    } else {
      replies.push(reply(
        prefix,
        "own-design",
        "Posso usar um design meu neste artigo?",
        "Aqui encontras os designs do catálogo. Para criares este artigo com uma imagem tua, visita a página de [Personalização](personalizacao.html)."
      ));
    }
  }

  if (replies.length < 3) {
    replies.push(reply(
      prefix,
      "change-mind",
      "Posso mudar de ideias mais à frente?",
      "Sim! Podes sempre voltar aos passos anteriores para trocar o design antes de finalizar o pedido."
    ));
  }

  return replies.slice(0, 3);
}

function drawerReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const drawers = Array.isArray(step.drawers) ? step.drawers : [];
  const includedOptions = [];
  const paidOptions = [];
  let isCoverStep = false;
  let isInteriorStep = false;

  drawers.forEach(drawer => {
    const title = clean(drawer.title || drawer.label).toLowerCase();
    if (title.includes("capa")) isCoverStep = true;
    if (title.includes("miolo") || title.includes("folhas") || title.includes("interior")) isInteriorStep = true;
    (drawer.items || []).forEach(item => {
      const cents = item.extraPriceCentsPerUnit != null ? item.extraPriceCentsPerUnit : item.extraPriceCents;
      if (cents != null) (Number(cents) === 0 ? includedOptions : paidOptions).push(clean(item.title));
    });
  });

  const replies = [];

  if (isCoverStep) {
    replies.push(reply(
      prefix,
      "cover-diff",
      "Qual é a diferença entre capa mole e capa dura?",
      "A capa dura é mais encorpada e resistente, ótima para proteger no dia a dia; a capa mole é mais leve, maleável e prática para transportar."
    ));
  } else if (isInteriorStep) {
    replies.push(reply(
      prefix,
      "interior-diff",
      "Qual é a diferença entre os tipos de miolo?",
      "Podes escolher as folhas que melhor se adaptam ao teu uso: pautadas (com linhas), lisas, pontilhadas ou quadriculadas."
    ));
  } else {
    replies.push(reply(
      prefix,
      "options-diff",
      "Qual é a diferença entre as opções?",
      "Cada opção adapta o formato e acabamento da tua peça. Podes selecionar a que melhor se adequa ao que precisas."
    ));
  }

  replies.push(reply(
    prefix,
    "price-change",
    "Estas opções alteram o valor?",
    paidOptions.length
      ? "Algumas opções especiais (" + joinPt(paidOptions) + ") têm um pequeno ajuste de valor visível no resumo; as restantes mantêm o valor base."
      : "Não, podes escolher qualquer uma destas opções sem qualquer custo adicional."
  ));

  replies.push(reply(
    prefix,
    "change-step",
    "Posso trocar de opção antes de enviar?",
    "Sim! Podes sempre voltar atrás no formulário para ajustar qualquer escolha."
  ));

  return replies.slice(0, 3);
}

function laminationReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  return [
    reply(
      prefix,
      "difference",
      "Qual é a diferença entre os acabamentos?",
      "O Matte é aveludado e sem reflexos; o Glossy dá um brilho vivo às cores; o Holográfico e o Glitter dão um brilho cintilante especial com a luz."
    ),
    reply(
      prefix,
      "protection",
      "A laminação protege a peça?",
      "Sim! Todos os acabamentos laminados criam uma película que protege contra sujidade e humidade ligeira no dia a dia."
    ),
    reply(
      prefix,
      "glitter-holographic",
      "O acabamento com glitter ou holográfico altera a imagem?",
      "A ilustração continua perfeitamente nítida, ganhando apenas reflexos cintilantes elegantes conforme a luz bate na superfície."
    )
  ];
}

function addOnReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  return [
    reply(
      prefix,
      "what-are-addons",
      "Para que servem estes extras?",
      "São detalhes de encadernação e acabamento artesanal — como cantos metálicos de proteção, elástico de fecho ou fita marcadora — para dar um toque ainda mais especial à tua peça."
    ),
    reply(
      prefix,
      "optional",
      "É obrigatório escolher algum extra?",
      "Não, são totalmente opcionais! Podes escolher os que quiseres ou avançar sem nenhum."
    ),
    reply(
      prefix,
      "multiple",
      "Posso combinar vários extras?",
      "Sim! Podes selecionar vários extras em conjunto e o valor total atualiza-se logo no resumo."
    )
  ];
}

function purchaseReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const items = effectiveItems(product, step);
  const choices = items.map(item => clean(item.title));
  const quantity = step.orderQuantity || {};
  const minimum = Number(quantity.minimum || step.minimumOrderQuantity || 1);
  return [
    reply(
      prefix,
      "options",
      "Como funcionam as opções de compra?",
      "Podes escolher entre as opções disponíveis para este artigo (" + joinPt(choices) + ")."
    ),
    reply(
      prefix,
      "minimum",
      "Qual é o pedido mínimo?",
      "A quantidade mínima para este artigo é de " + minimum + " " + (minimum === 1 ? "unidade" : "unidades") + "."
    ),
    reply(
      prefix,
      "more-units",
      "Posso encomendar várias unidades da mesma opção?",
      step.allowOrderQuantity
        ? "Sim! Podes indicar quantas unidades queres encomendar (de " + minimum + " a " + Number(quantity.maximum || 9999) + " unidades)."
        : "Para esta opção, o pedido é feito por unidade."
    )
  ];
}

function quantityReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const items = effectiveItems(product, step);
  const quantities = items.map(item => Number(item.quantity)).filter(Number.isFinite);
  const minimum = Number(step.minimumQuantity || (quantities.length ? Math.min.apply(null, quantities) : 1));

  if (step.hidden) {
    return [
      reply(prefix, "fixed", "Quantas peças inclui o pedido?", "Este pedido inclui 1 moldura personalizada."),
      reply(prefix, "more", "Se quiser mais do que uma moldura?", "Basta adicionares esta ao carrinho e depois personalizares uma nova moldura."),
      reply(prefix, "auto", "Preciso de indicar a quantidade?", "Não, a quantidade fica automaticamente definida como 1.")
    ];
  }

  const discountAnswer = step.allowUnitDiscounts
    ? "Sim! O valor por unidade desce automaticamente nos vários escalões de quantidade. Quanto mais unidades pedires, mais vantajoso fica."
    : "O valor unitário mantém-se o mesmo em todas as quantidades deste artigo.";

  const splitAnswer = step.adjustPerDesign
    ? "Sim! Podes escolher vários designs e definir quantas unidades queres de cada um."
    : "A quantidade selecionada aplica-se à mesma configuração e design deste artigo.";

  const quantityAnswer = step.freeQuantity
    ? "Podes usar os botões de atalho ou escrever diretamente a quantidade que desejas (a partir de " + minimum + ")."
    : "Podes escolher uma das quantidades predefinidas nos botões disponíveis (" + joinPt(quantities.map(String)) + ").";

  return [
    reply(prefix, "discount", "Há desconto para quantidades maiores?", discountAnswer),
    reply(prefix, "split", "Posso repartir a quantidade por designs diferentes?", splitAnswer),
    reply(prefix, "how-much", "Como escolho a quantidade?", quantityAnswer)
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
      "É um cartão delicado e personalizado que acompanha as tuas peças, perfeito para lembranças, ofertas ou eventos especiais."
    ));
    replies.push(reply(
      prefix,
      "card-data",
      "Que informações posso colocar no cartão?",
      "Podes indicar " + joinPt(names) + " para a Mia imprimir com carinho no cartão."
    ));
  } else {
    replies.push(reply(
      prefix,
      "what-to-write",
      "O que devo escrever neste campo?",
      "Escreve aqui o texto (" + joinPt(names) + ") exatamente como queres que apareça na tua peça."
    ));
    replies.push(reply(
      prefix,
      "review-text",
      "A Mia confirma o texto antes de produzir?",
      "Sim! A Mia revê o texto com carinho antes da produção para garantir que fica harmonioso e sem erros."
    ));
  }

  replies.push(reply(
    prefix,
    "required",
    "É obrigatório preencher todos os campos?",
    fieldsRequiredAnswer(fields)
  ));

  return replies.slice(0, 3);
}

function deliveryReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  return [
    reply(
      prefix,
      "delivery-methods",
      "Como funcionam as entregas?",
      "Podes levantar a tua encomenda em mão diretamente com a Mia (gratuito) ou receber comodamente na tua morada através de correio CTT."
    ),
    reply(
      prefix,
      "contact-info",
      "Que dados são necessários para o envio?",
      "Precisamos do teu nome, contacto e morada completa para enviarmos a tua encomenda em total segurança."
    ),
    reply(
      prefix,
      "nif",
      "O NIF é obrigatório?",
      "Não, o NIF é opcional. Se precisares de fatura com número de contribuinte basta preenchê-lo; caso contrário, é emitida como consumidor final."
    )
  ];
}

function confirmReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  return [
    reply(
      prefix,
      "after-submit",
      "O que acontece depois de enviar o pedido?",
      "A Mia recebe o teu pedido, confirma todos os pormenores artesanais e entra em contacto contigo para acertar o pagamento e a data de entrega."
    ),
    reply(
      prefix,
      "payment-methods",
      "Como é feito o pagamento?",
      "Podes pagar de forma simples e segura por MB WAY ou por transferência bancária, conforme for mais prático para ti."
    ),
    reply(
      prefix,
      "change-before-send",
      "Posso alterar algum detalhe antes de submeter?",
      "Sim! Podes clicar nos passos anteriores para rever ou ajustar qualquer detalhe e voltar a este resumo."
    )
  ];
}

function coverReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  return [
    reply(
      prefix,
      "without-name",
      "Posso encomendar a capa sem nome?",
      "Sim! Se preferires a capa lisa apenas com a ilustração e sem nenhum nome, basta escolheres a opção “Não”."
    ),
    reply(
      prefix,
      "phrase-instead",
      "Posso colocar uma frase em vez de um nome?",
      "Sim! Podes escrever uma frase curta, desde que caiba no limite de " + Number(step.maxLength || 25) + " caracteres."
    ),
    reply(
      prefix,
      "length",
      "Como sei se o texto cabe bem na capa?",
      "Podes escrever até " + Number(step.maxLength || 25) + " caracteres; a Mia ajusta o tamanho da letra para ficar harmonioso com a ilustração."
    )
  ];
}

function uploadReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const upload = step.upload || {};

  if (step.template === "original-artwork-upload") {
    return [
      reply(
        prefix,
        "formats",
        "Que tipo de ficheiro posso enviar?",
        "Podes enviar ficheiros em " + joinPt((upload.acceptedExtensions || []).map(value => value.replace(/^\./, "").toUpperCase())) + ", de preferência com boa resolução para a impressão ficar nítida."
      ),
      reply(
        prefix,
        "files-count",
        "Quantos ficheiros posso anexar?",
        "Podes enviar entre " + Number(upload.minimumFiles || 1) + " e " + Number(upload.maxFiles || 1) + " " + (Number(upload.maxFiles || 1) === 1 ? "ficheiro" : "ficheiros") + "."
      ),
      reply(
        prefix,
        "quality-check",
        "E se tiver dúvidas com a qualidade da minha imagem?",
        "Podes enviar o ficheiro que tiveres! A Mia analisa sempre a qualidade da imagem antes da impressão para garantir um resultado bonito."
      )
    ];
  }

  return [
    reply(
      prefix,
      "photo-tips",
      "Que tipo de fotografia devo escolher?",
      "Escolhe uma fotografia nítida, com boa iluminação e onde o rosto ou elemento principal não esteja colado às margens para podermos enquadrar bem."
    ),
    reply(
      prefix,
      "need-help",
      "E se precisar de ajuda com a fotografia?",
      "Podes selecionar “" + clean(upload.helpLabel || "Preciso de ajuda") + "” e a Mia ajuda-te a avaliar e enquadrar a foto depois de receber o pedido."
    ),
    reply(
      prefix,
      "more-photos",
      "Posso enviar mais do que uma foto?",
      "Para este artigo envia-se 1 fotografia principal. Se quiseres mostrar opções à Mia, podes falar com ela após o envio do pedido."
    )
  ];
}

function customProductReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const finishes = (step.finishes || []).map(item => clean(item.title)).filter(Boolean);
  return [
    reply(
      prefix,
      "available-products",
      "Que artigos posso criar com a minha imagem?",
      "Podes criar vários artigos personalizados (cadernos, blocos, ímanes, crachás, marcadores e muito mais) usando a tua imagem!"
    ),
    reply(
      prefix,
      "multiple-products",
      "Posso escolher vários produtos para a mesma imagem?",
      "Sim! Podes selecionar vários tipos de artigos em simultâneo e personalizar as opções de cada um."
    ),
    reply(
      prefix,
      "finishes",
      "Que acabamentos posso escolher?",
      finishes.length
        ? "Podes escolher acabamentos como " + joinPt(finishes) + " para valorizar as tuas peças."
        : "Podes escolher vários acabamentos especiais diretamente neste passo."
    )
  ];
}

function customQuantityReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  return [
    reply(
      prefix,
      "different-quantities",
      "Posso definir quantidades diferentes para cada artigo?",
      "Sim! Cada produto que selecionaste tem o seu próprio seletor de quantidade independente."
    ),
    reply(
      prefix,
      "price-calculation",
      "Como é calculado o valor final?",
      "O valor é somado automaticamente no resumo tendo em conta o tamanho, acabamento e quantidade de cada artigo escolhido."
    ),
    reply(
      prefix,
      "all-quantities",
      "Tenho de indicar quantidade em todos os artigos?",
      "Sim, basta confirmares a quantidade pretendida em cada artigo que escolheste para avançares."
    )
  ];
}

function mediaReplies(scope, product, step) {
  const prefix = contextPrefix(scope, product, step);
  const items = effectiveItems(product, step);
  return [
    reply(
      prefix,
      "difference",
      "Qual é a diferença entre estas opções?",
      optionDetails(items)
    ),
    selectionReply(prefix, step, items.length, "opções"),
    reply(
      prefix,
      "preview",
      "Como vejo o resultado da minha escolha?",
      "Ao clicares numa das opções, a pré-visualização em cima atualiza logo para veres o resultado."
    )
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
      {
        id: "global-encomenda",
        question: "Como faço uma encomenda?",
        answer: "Basta escolheres o teu artigo, personalizar os detalhes ao teu gosto e avançar até ao resumo. Depois de enviares o pedido, a Mia confirma todos os pormenores contigo!"
      },
      {
        id: "global-personalizar",
        question: "Posso usar uma fotografia ou desenho meu?",
        answer: "Sim! Na página de [Personalização](personalizacao.html) podes enviar a tua imagem e escolher em que artigos a queres aplicar."
      },
      {
        id: "global-entrega",
        question: "Como funcionam as entregas?",
        answer: "Podes levantar a tua encomenda em mão diretamente com a Mia (sem custos) ou receber comodamente na tua morada por correio CTT."
      },
      {
        id: "global-precos",
        question: "Como são calculados os preços?",
        answer: "O valor é calculado em tempo real na página do artigo conforme o tamanho, acabamento e quantidade que escolheres. Quanto maior for a quantidade, mais económico fica o valor unitário!"
      },
      {
        id: "global-contacto",
        question: "Como posso falar com a Mia?",
        answer: "Podes deixar uma mensagem no [formulário de contacto](contacto.html) ou tirar dúvidas aqui comigo a qualquer momento."
      }
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
