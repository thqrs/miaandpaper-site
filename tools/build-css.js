#!/usr/bin/env node
/**
 * tools/build-css.js
 *
 * Concatena os 13 ficheiros CSS do site num único ficheiro `site/css/app.css`.
 * Mantém os módulos 01 a 13 para desenvolvimento contínuo e gera o bundle
 * unificado para produção sem dependências externas.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSS_DIR = path.join(ROOT, 'site', 'css');
const OUTPUT_FILE = path.join(CSS_DIR, 'app.css');

const MODULE_FILES = [
  '01-tokens-agua.css',
  '02-base-chrome.css',
  '03-grelha-designs-tons.css',
  '04-reviews-passos-acoes.css',
  '05-cookies-packs-entrega.css',
  '06-admin.css',
  '07-cards-crachas-molduras.css',
  '08-dark-mode.css',
  '09-seccoes-produtos.css',
  '10-entrega-uniformizacao.css',
  '11-home-marca.css',
  '12-composer-glitter-chart.css',
  '13-miu.css'
];

function minifyCss(css) {
  return css
    // Remove multi-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Normalize newlines and spaces
    .replace(/[ \t]+/g, ' ')
    // Remove spaces around braces and semicolons safely (preserving spaces around + and - for calc)
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/;\s*}/g, '}')
    .replace(/\s*,\s*/g, ', ')
    .replace(/:\s+/g, ': ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

function build() {
  const parts = [];
  let totalRawSize = 0;

  for (const filename of MODULE_FILES) {
    const fullPath = path.join(CSS_DIR, filename);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Ficheiro CSS em falta: ${fullPath}`);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    totalRawSize += Buffer.byteLength(content, 'utf8');
    parts.push(`/* --- ${filename} --- */\n` + content);
  }

  const combined = parts.join('\n\n');
  const minified = minifyCss(combined);
  const minifiedWithHeader = `/* Mia & Paper · app.css bundle unificado */\n` + minified;

  fs.writeFileSync(OUTPUT_FILE, minifiedWithHeader, 'utf8');
  const outputSize = Buffer.byteLength(minifiedWithHeader, 'utf8');

  console.log(`[build-css] 13 ficheiros concatenados em ${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log(`[build-css] Tamanho original: ${(totalRawSize / 1024).toFixed(1)} KB -> Bundled/Minified: ${(outputSize / 1024).toFixed(1)} KB (poupança de ${(((totalRawSize - outputSize) / totalRawSize) * 100).toFixed(1)}%)`);
}

if (require.main === module) {
  try {
    build();
  } catch (err) {
    console.error('[build-css] ERRO:', err.message);
    process.exit(1);
  }
}

module.exports = { build };
