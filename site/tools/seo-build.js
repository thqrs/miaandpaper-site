#!/usr/bin/env node
"use strict";

/*
  Gerador de SEO do site Mia & Paper.

  O site e um conjunto de shells HTML: o app.js le os JSON de content/ e escreve
  tudo dentro de #app. Isso significa que o HTML que o Googlebot descarrega nao
  tem texto nenhum — nem sequer links para as outras paginas. Este script resolve
  isso em dois sitios:

    1. <head> — titulo, description, Open Graph, canonical e JSON-LD.
    2. dentro de #app — um bloco estatico com h1, texto, lista de designs e links.

  O bloco dentro de #app e substituido pelo app.js assim que os JSON chegam
  (app.innerHTML = ...), por isso nao ha conteudo duplicado no ecra. Ate la serve
  de fallback real para quem nao tem JavaScript.

  Os textos vivem em tools/seo-content.json — este ficheiro so tem a mecanica.

  Correr sempre que os JSON de conteudo ou os textos mudarem:

      node tools/seo-build.js

  E idempotente: escreve entre marcadores e reescreve o que ja la esta.
*/

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, "seo-content.json"), "utf8")
);

const SITE = CONFIG.site;
const BRAND = CONFIG.brand;
const PAGES = CONFIG.pages;
const STATE_PATH = path.join(__dirname, "seo-state.json");

const HEAD_START = "<!-- seo:head:start -->";
const HEAD_END = "<!-- seo:head:end -->";
const BODY_START = "<!-- seo:prerender:start -->";
const BODY_END = "<!-- seo:prerender:end -->";

// Quantos nomes de design listar por pagina. Sao termos que as pessoas procuram,
// mas uma lista de centenas de itens so dilui a pagina.
const MAX_DESIGNS = 40;

// ---------------------------------------------------------------------------
// Utilitarios
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readJson(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (error) {
    console.warn(`  ! ${relPath}: JSON invalido (${error.message})`);
    return null;
  }
}

function absolute(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return SITE + "/" + String(url).replace(/^\/+/, "");
}

// Os designs vivem espalhados pelos passos do formulario, nos passos com
// template "design-grid".
function collectDesignNames(product) {
  const names = [];
  const seen = Object.create(null);
  const steps = Array.isArray(product && product.steps) ? product.steps : [];

  steps.forEach(function (step) {
    if (step.template !== "design-grid") return;
    const items = Array.isArray(step.items) ? step.items : [];
    items.forEach(function (item) {
      // Hidden designs stay available to the editor but are not advertised publicly.
      if (item && item.hidden === true) return;
      const label = String(item.title || item.value || "").trim();
      if (!label || seen[label.toLowerCase()]) return;
      seen[label.toLowerCase()] = true;
      names.push(label);
    });
  });

  return names.slice(0, MAX_DESIGNS);
}

function firstProductImage(product) {
  const steps = Array.isArray(product && product.steps) ? product.steps : [];
  for (let i = 0; i < steps.length; i += 1) {
    const items = Array.isArray(steps[i].items) ? steps[i].items : [];
    for (let j = 0; j < items.length; j += 1) {
      if (items[j].image) return items[j].image;
    }
  }
  return "content/brand/logo.webp";
}

// ---------------------------------------------------------------------------
// <head>
// ---------------------------------------------------------------------------

function buildHead(page, jsonLd) {
  const canonical = SITE + page.url;
  const social = page.ogDescription || page.description;
  const image = absolute(page.ogImage || "content/brand/logo.webp");

  const lines = [
    HEAD_START,
    `  <title>${escapeHtml(page.title)}</title>`,
    `  <meta name="description" content="${escapeHtml(page.description)}">`,
    `  <link rel="canonical" href="${canonical}">`,
    `  <meta name="robots" content="index, follow, max-image-preview:large">`,
    `  <meta property="og:site_name" content="${escapeHtml(BRAND)}">`,
    `  <meta property="og:locale" content="pt_PT">`,
    `  <meta property="og:type" content="website">`,
    `  <meta property="og:url" content="${canonical}">`,
    `  <meta property="og:title" content="${escapeHtml(page.title)}">`,
    `  <meta property="og:description" content="${escapeHtml(social)}">`,
    `  <meta property="og:image" content="${image}">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${escapeHtml(page.title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(social)}">`
  ];

  // O bloco estatico esta escondido por CSS (ver .seo-prerender em styles.css),
  // senao piscava no ecra ate os JSON chegarem. Sem JavaScript nao ha app.js
  // para o substituir, por isso aqui repomo-lo — senao a pagina ficava vazia.
  // Tem de vir depois do <link> do styles.css para ganhar por ordem de origem.
  if (!page.headOnly) {
    lines.push(
      `  <noscript><style>.seo-prerender{display:block}</style></noscript>`
    );
  }

  if (jsonLd) {
    // </ dentro de uma string JSON fecharia o <script> mais cedo.
    const payload = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
    lines.push(`  <script type="application/ld+json">${payload}</script>`);
  }

  lines.push(HEAD_END);
  return lines.join("\n");
}

function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND,
    url: SITE + "/",
    logo: absolute("content/brand/logo.webp"),
    description: CONFIG.organization.description,
    sameAs: CONFIG.organization.sameAs,
    areaServed: "PT"
  };
}

// Sem `offers`: os precos do site sao por pack e variam por opcao, e anunciar um
// valor unitario que o cliente nao ve na pagina e pior do que nao anunciar nada.
function productSchema(page, product) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: (product && product.name) || page.h1,
    description: page.description,
    image: absolute(firstProductImage(product)),
    url: SITE + page.url,
    brand: { "@type": "Brand", name: BRAND }
  };
}

// ---------------------------------------------------------------------------
// Bloco estatico dentro de #app
//
// Os links entre paginas sao a parte mais importante: hoje o HTML servido nao
// tem um unico <a>, por isso o crawler nao consegue descobrir as outras paginas.
// ---------------------------------------------------------------------------

function renderNav(currentFile) {
  const links = PAGES.filter(function (page) {
    return page.file !== currentFile && !page.excludeFromSitemap;
  }).map(function (page) {
    return `<li><a href="${escapeHtml(page.file)}">${escapeHtml(page.h1)}</a></li>`;
  });

  return (
    '<nav class="seo-prerender-nav" aria-label="Páginas do site"><ul>' +
    links.join("") +
    "</ul></nav>"
  );
}

function renderHomePrerender(page) {
  const content = readJson(page.homeContent) || {};
  const categories = Array.isArray(content.categories) ? content.categories : [];

  const items = categories
    .filter(function (category) {
      return category.available !== false && category.href;
    })
    .map(function (category) {
      const title = escapeHtml(category.title || "");
      const subtitle = escapeHtml(category.subtitle || "");
      return (
        `<li><a href="${escapeHtml(category.href)}">${title}</a>` +
        (subtitle ? ` — ${subtitle}` : "") +
        "</li>"
      );
    });

  return [
    '<div class="seo-prerender">',
    `<h1>${escapeHtml(page.h1)}</h1>`,
    `<p>${escapeHtml(page.lead)}</p>`,
    items.length ? "<h2>Produtos</h2><ul>" + items.join("") + "</ul>" : "",
    // Sem renderNav aqui: a lista de categorias ja liga a todas as paginas e
    // repetir os mesmos links por baixo so duplicava o bloco.
    "</div>"
  ].join("");
}

function renderProductPrerender(page, product) {
  const intro = (product && product.intro) || {};
  const designs = collectDesignNames(product);

  const introText =
    intro.text && intro.text !== page.lead
      ? `<p>${escapeHtml(intro.text)}</p>`
      : "";

  const designList = designs.length
    ? "<h2>Designs disponíveis</h2><ul>" +
      designs
        .map(function (name) {
          return `<li>${escapeHtml(name)}</li>`;
        })
        .join("") +
      "</ul>"
    : "";

  return [
    '<div class="seo-prerender">',
    `<h1>${escapeHtml(page.h1)}</h1>`,
    `<p>${escapeHtml(page.lead)}</p>`,
    introText,
    designList,
    renderNav(page.file),
    "</div>"
  ].join("");
}

// ---------------------------------------------------------------------------
// Escrita nos ficheiros
// ---------------------------------------------------------------------------

// Tags que o bloco gerado passa a controlar. Sao removidas do <head> antigo para
// nao ficarem duas de cada.
const MANAGED_HEAD_TAGS = [
  /^\s*<title>[\s\S]*?<\/title>\s*$/i,
  /^\s*<meta\s+name="description"[^>]*>\s*$/i,
  /^\s*<meta\s+name="robots"[^>]*>\s*$/i,
  /^\s*<meta\s+name="twitter:[^"]*"[^>]*>\s*$/i,
  /^\s*<meta\s+property="og:[^"]*"[^>]*>\s*$/i,
  /^\s*<link\s+rel="canonical"[^>]*>\s*$/i
];

function stripManagedTags(head) {
  return head
    .split("\n")
    .filter(function (line) {
      return !MANAGED_HEAD_TAGS.some(function (pattern) {
        return pattern.test(line);
      });
    })
    .join("\n");
}

function replaceBetween(html, startMarker, endMarker, replacement) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1) return null;
  return html.slice(0, start) + replacement + html.slice(end + endMarker.length);
}

function withoutGeneratedBlock(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) return html;
  return html.slice(0, start) + startMarker + endMarker + html.slice(end + endMarker.length);
}

function pageFingerprint(page, html) {
  let source = withoutGeneratedBlock(html, HEAD_START, HEAD_END);
  source = withoutGeneratedBlock(source, BODY_START, BODY_END);
  let content = "";
  if (page.product) {
    const productPath = path.join(ROOT, "content", "products", page.product + ".json");
    if (fs.existsSync(productPath)) content = fs.readFileSync(productPath, "utf8");
  } else if (page.homeContent) {
    const homePath = path.join(ROOT, page.homeContent);
    if (fs.existsSync(homePath)) content = fs.readFileSync(homePath, "utf8");
  }
  return crypto.createHash("sha256")
    .update(JSON.stringify(page)).update("\n").update(source).update("\n").update(content)
    .digest("hex");
}

function applyHead(html, headBlock) {
  const replaced = replaceBetween(html, HEAD_START, HEAD_END, headBlock);
  if (replaced) return replaced;

  const headEnd = html.search(/<\/head>/i);
  if (headEnd === -1) throw new Error("sem </head>");

  const before = stripManagedTags(html.slice(0, headEnd));
  return before + headBlock + "\n" + html.slice(headEnd);
}

function applyPrerender(html, block) {
  const wrapped = BODY_START + block + BODY_END;

  const replaced = replaceBetween(html, BODY_START, BODY_END, wrapped);
  if (replaced) return replaced;

  const appDiv = /(<div id="app"[^>]*>)([\s\S]*?)(<\/div>)/i;
  if (!appDiv.test(html)) return null;

  return html.replace(appDiv, function (match, open, inner, close) {
    return open + wrapped + close;
  });
}

function buildSitemap(lastmods) {
  // As paginas de congressos/2026 e as ofertas nao passam por este gerador (a
  // capsula de 2026 nao se toca), mas queremos que o Google as descubra.
  const extras = Array.isArray(CONFIG.extraSitemapUrls)
    ? CONFIG.extraSitemapUrls
    : [];

  const entries = PAGES.filter(function (page) {
    return !page.excludeFromSitemap;
  })
    .concat(extras)
    .map(function (page) {
      return [
        "  <url>",
        `    <loc>${SITE}${page.url}</loc>`,
        `    <lastmod>${lastmods[page.url]}</lastmod>`,
        `    <changefreq>${page.changefreq}</changefreq>`,
        `    <priority>${page.priority}</priority>`,
        "  </url>"
      ].join("\n");
    });

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.join("\n") +
    "\n</urlset>\n"
  );
}

function safeWriteFileSync(filePath, content) {
  try {
    const fd = fs.openSync(filePath, "r+");
    fs.writeSync(fd, content, 0, "utf8");
    fs.ftruncateSync(fd, Buffer.byteLength(content, "utf8"));
    fs.closeSync(fd);
  } catch (e) {
    fs.writeFileSync(filePath, content, "utf8");
  }
}

function main() {
  let touched = 0;
  const today = new Date().toISOString().slice(0, 10);
  let previousState = { version: 1, pages: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    if (parsed && parsed.pages) previousState = parsed;
  } catch (error) {
    // Primeira execucao com estado: as paginas entram com a data de hoje.
  }
  const nextState = { version: 1, pages: {} };
  const lastmods = Object.create(null);

  PAGES.forEach(function (page) {
    const full = path.join(ROOT, page.file);
    if (!fs.existsSync(full)) {
      console.warn(`  ! ${page.file}: nao existe, ignorado`);
      return;
    }

    let html = fs.readFileSync(full, "utf8");
    const originalHtml = html;
    const fingerprint = pageFingerprint(page, originalHtml);
    const previous = previousState.pages[page.url];
    const lastmod = previous && previous.fingerprint === fingerprint
      ? previous.lastmod
      : today;
    nextState.pages[page.url] = { fingerprint: fingerprint, lastmod: lastmod };
    lastmods[page.url] = lastmod;
    let jsonLd = null;
    let product = null;

    if (page.product) {
      product = readJson("content/products/" + page.product + ".json");
      jsonLd = productSchema(page, product);
    } else if (page.schema === "organization") {
      jsonLd = organizationSchema();
    }

    html = applyHead(html, buildHead(page, jsonLd));

    if (!page.headOnly) {
      const block = page.homeContent
        ? renderHomePrerender(page)
        : renderProductPrerender(page, product);

      const withBody = applyPrerender(html, block);
      if (withBody) {
        html = withBody;
      } else {
        console.warn(`  ! ${page.file}: sem <div id="app">, so o <head> foi escrito`);
      }
    }

    if (html !== originalHtml) {
      safeWriteFileSync(full, html);
      touched += 1;
      console.log(`  + ${page.file}`);
    } else {
      console.log(`  = ${page.file}`);
    }
  });

  const extras = Array.isArray(CONFIG.extraSitemapUrls) ? CONFIG.extraSitemapUrls : [];
  extras.forEach(function (page) {
    const fingerprint = crypto.createHash("sha256").update(JSON.stringify(page)).digest("hex");
    const previous = previousState.pages[page.url];
    const lastmod = previous && previous.fingerprint === fingerprint ? previous.lastmod : today;
    nextState.pages[page.url] = { fingerprint: fingerprint, lastmod: lastmod };
    lastmods[page.url] = lastmod;
  });

  safeWriteFileSync(path.join(ROOT, "sitemap.xml"), buildSitemap(lastmods));
  safeWriteFileSync(STATE_PATH, JSON.stringify(nextState, null, 2) + "\n");
  console.log("  + sitemap.xml");
  console.log(`\n${touched} paginas alteradas.`);
}

main();
