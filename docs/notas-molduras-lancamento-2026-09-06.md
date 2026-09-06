# Molduras — pausa temporária de três flows

Para o lançamento de 6 de setembro de 2026 ficaram temporariamente ocultas estas opções:

- Moldura para Bebé (`id`: `quadro-bebe`)
- Jardim de Flores (`id`: `jardim-frase`)
- Super Personalizado (`id`: `super-personalizado`)

## Como reabrir

1. Em `site/content/products/quadros.json`, no passo `steps[id="designs"]`, remover apenas a linha `"hidden": true` de cada um dos três itens acima.
2. Não remover os itens, imagens, passos dependentes ou validações PHP: os flows continuam completos para desenvolvimento e encomendas directas.
3. Correr `node site/tools/seo-build.js` para actualizar a lista SEO de `site/molduras.html`.
4. Repor no `site/catalogo/molduras/index.html` as três linhas de preço e os três cartões (a versão anterior aos câmbios fica no histórico Git).
5. Abrir `molduras.html` e `catalogo/molduras/` e confirmar os três nomes antes de publicar.

O filtro do passo 1 mantém estas opções visíveis no modo de administração, para ser possível continuar a trabalhar nos flows sem os expor aos visitantes.
