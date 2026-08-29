Patch experimental iPad/WebKit — apenas a teoria do ChatGPT

Alterações:
1) site/css/03-grelha-designs-tons.css
   - .quadros-color-composition passa a display:grid + justify-items:center.
   - Objetivo: não depender de justify-self em block layout no WebKit.

2) site/css/09-seccoes-produtos.css
   - apenas nos cards de capas dos porta-folhetos, .uploaded-image passa a preencher
     .cadernos-cover-media com position:absolute + inset:0.
   - remove nesse override width/height 100% e aspect-ratio do filho.
   - Objetivo: não depender de height:100% dentro de pai cuja altura vem de aspect-ratio.

Não alterado:
- --uploaded-image / &quot;
- renderização para <img>
- grelha repeat(6, minmax(...))
- homepage/categorias/banners

Aplicação por patch (a partir da raiz do projeto):
  patch -p1 < ipad-webkit-theory.patch

Ou substituir apenas os dois CSS incluídos, preservando os caminhos.
