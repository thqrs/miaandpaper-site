# 08 · Deploy, SEO e ambiente local

---

## Correr o site localmente

Já configurado em `.claude/launch.json`, com os limites de upload certos:

```bash
php -S 0.0.0.0:8082 -t site
```

Liga em `0.0.0.0` **de propósito**: o Tiago acede pela LAN
(`http://192.168.1.16:8082`), além de `http://localhost:8082`. **Não voltar a
limitar a `127.0.0.1`.** Enquanto o admin estiver aberto sem password (ver
abaixo), isto é uma escolha consciente — não expor a máquina fora da rede local.

O `[1]abrir_miaandpaper_local.bat` faz o mesmo. O servidor é single-threaded, por
isso as previews da galeria enchem devagar em local — em produção é bem mais
rápido.

### Verificações que valem sempre a pena

```bash
# sintaxe
for f in site/*.php site/lib/*.php; do php -l "$f"; done
for f in site/js/*.js; do node --check "$f"; done

# todos os JSON de conteúdo
python -c "import json,glob; [json.load(open(p,encoding='utf-8')) for p in glob.glob('site/content/**/*.json',recursive=True)]"

# todas as páginas respondem
for f in site/*.html; do curl -s -o /dev/null -w "%{http_code} $f\n" "http://127.0.0.1:8082/$(basename $f)"; done

# os painéis de admin não rebentam a memória
curl -s "http://127.0.0.1:8082/admin-live-dashboard.php?period=90d" | grep -ci "fatal error"
```

E, para qualquer coisa que se veja no browser: abrir a página, deixar o JS
correr, e ler o DOM. **Não basta olhar para o HTML servido.**

---

## Admin local

O repositório corre o admin sem a pasta privada de produção.
`run-local-admin.bat` define `MIAANDPAPER_PRIVATE_DIR` para `private-local/`, e é
lá que ficam SQLite, logs de admin, JSONL do funil, flags de sincronização e
backups. Sem essa variável, o site usa o layout de produção do cPanel.
`MIAANDPAPER_MAIL_CONFIG` continua a sobrepor-se ao caminho da configuração de
email.

```bat
run-local-admin.bat
```
```text
http://127.0.0.1:8000
```

### ⚠️ Admin sem password, até ao deploy

`site/admin-open.php` tem `MIA_ADMIN_OPEN = true`: **todas** as páginas e APIs de
admin estão abertas a quem alcançar o servidor, sem login. É deliberado enquanto
o site não está publicado. Enquanto assim for, **evitar expor o servidor na LAN**
(`start-lan.bat`).

### Password local

Gerar o hash:

```bat
php -r "echo password_hash('local-password-here', PASSWORD_DEFAULT), PHP_EOL;"
```

Criar `private-local/admin.php` (a pasta está no `.gitignore`):

```php
<?php
return ['admin_password_hash' => 'PUT_LOCAL_HASH_HERE'];
```

Configuração de email opcional, para testar formulários — `private-local/mail.php`:

```php
<?php
return ['to' => 'you@example.test', 'from' => 'no-reply@miaandpaper.com'];
```

---

## Deploy

**Não existe `.cpanel.yml`** — nunca existiu. O deploy é o
`[2]upload-or-download.bat` na raiz, que por SSH corre no servidor:

```
cd /home/currwkdi/repositories/miaandpaper-site
git pull --ff-only origin main
/bin/cp -R site/. /home/currwkdi/miaandpaper.com/
```

Só o que está dentro de `site/` é publicado. **O commit é a unidade de
publicação** — o que não está commitado e enviado não é publicado.

Duas consequências que já morderam:

- **`cp -R` nunca apaga.** Ficheiros removidos do repositório continuam vivos no
  servidor para sempre. Apagar é um trabalho de dois passos: no repositório *e*
  no servidor. Foi assim que três pastas de PDFs duplicados (131 MB, nomes
  corrompidos por camadas de encoding) sobreviveram meses depois de deixarem de
  ser referenciadas.
- **O mesmo `.bat` sincroniza ao contrário** (servidor → PC), o que sobrescreve o
  `site/` local. Faz cópia de segurança antes, mas **confirmar a direcção antes
  de correr**.

Não mudar o caminho de destino sem o Tiago pedir.

### O que o script faz por ti (`MODO LOCAL`)

| passo | o quê |
|---|---|
| 1/5 | `tools/update-cache-version.ps1` — regenera o `?v=` de todos os `css/*.css` e `js/*.js` nas cascas, em `send-message.php` e em `send-order.php` |
| 2/5 | valida `node --check` nos módulos JS e todos os JSON, e corre `node site/tools/seo-build.js` |
| 3/5 | commit e push, se houver alterações |
| 4/5 | deploy no cPanel por SSH |
| 5/5 | confirmação |

O passo 1 **só reescreve tags que já existam** — um módulo novo continua a ter de
ser declarado à mão em todas as cascas ([02](02-modulos-js.md),
[03](03-modulos-css.md)).

O `MODO CPANEL` faz o contrário: backup do `site/` local, arquiva o site live,
copia-o para o PC e espelha por cima do `site/` local. É este que é preciso
confirmar antes de correr.

### ⚠️ Antes de publicar

1. **Fechar os endpoints de escrita.** Pôr a `true`:

   ```php
   site/admin-open.php:18    define('MIA_ADMIN_OPEN', true);
   site/galeria-api.php:10   define('GALERIA_REQUIRE_ADMIN', false);
   site/precos-api.php:23    define('PRECOS_REQUIRE_ADMIN', false);
   site/produtos-api.php:5   define('PRODUTOS_REQUIRE_ADMIN', false);
   site/reviews-api.php:6    define('REVIEWS_REQUIRE_ADMIN', false);
   ```

   O `galeria-api.php`, o `precos-api.php` e o `reviews-api.php` **escrevem
   ficheiros** — com eles a `false`, qualquer pessoa pode reescrever
   `content/products/*.json` e o `pricing.json`, incluindo os preços e os
   ficheiros da cápsula. O `produtos-api.php` é só de leitura.

2. Confirmar que `galeria.html`, `precos.php`, `produtos.html` e `reviews.html`
   continuam a funcionar com sessão iniciada. O CSRF e o `session_start()` já lá
   estão — só estão a ser saltados pelo `if (!X_REQUIRE_ADMIN) return;`.

3. **Regenerar os snapshots** ([07 · Backend](07-backend.md)) — este não é
   automático, e sem ele os painéis mostram a estrutura antiga sem dar erro.

4. Se criaste um módulo novo em `site/js/` ou `site/css/`, confirmar que a tag
   está em **todas** as cascas. O `?v=` trata-se sozinho no passo 1/5; a tag não.

5. Confirmar a compressão no servidor — o `.htaccess` não a configura:

   ```bash
   curl -sI -H "Accept-Encoding: gzip" https://miaandpaper.com/js/01-nucleo.js | grep -i content-encoding
   ```

   São ~1,3 MB de JS + CSS sem gzip.

---

## SEO — correr o gerador depois de mudar conteúdo

Todas as páginas são cascas: o HTML que o Googlebot descarrega não tem texto e —
pior — não tem um único `<a>`, por isso um crawler nem consegue descobrir as
outras páginas. O `site/tools/seo-build.js` resolve isso escrevendo em cada
página:

- o bloco `<head>` entre `<!-- seo:head:start -->` / `<!-- seo:head:end -->`
  (title, description, canonical, Open Graph, JSON-LD);
- um bloco estático dentro de `#app`, entre `<!-- seo:prerender:start -->` /
  `<!-- seo:prerender:end -->`, com um `h1`, a copy, os nomes dos designs e links
  para as outras páginas.

```bash
node site/tools/seo-build.js
```

O JS faz `app.innerHTML = …`, por isso esse bloco é substituído assim que o JSON
chega. O `.seo-prerender` mantém-no `display: none`: o intervalo até o JSON
chegar é de cerca de um segundo, que chegava para se ver o texto aparecer e
desaparecer — e isso lê-se como um bug.

Escondido continua a servir para o que é. O Googlebot lê o HTML cru sem aplicar
CSS, por isso recebe o texto e sobretudo os links de que precisa; quando mais
tarde renderiza com JavaScript encontra o output real, que diz o mesmo ou mais.
Nada é escondido do Google que os visitantes vejam, e nada é mostrado ao Google
que os visitantes não vejam. Cada página gerada leva
`<noscript><style>.seo-prerender{display:block}`, que a restaura quando não há
JavaScript — tem de vir depois dos `<link>` do CSS para ganhar por ordem.

**Nunca editar à mão o que está entre os marcadores**: a corrida seguinte
sobrescreve. A copy vive em `site/tools/seo-content.json`, que é o ficheiro a
editar para títulos, descrições e headings; é também de lá que sai o
`site/sitemap.xml`, declarado no `robots.txt`.

O gerador é idempotente e lê os JSON no momento em que corre, por isso o output
fica velho assim que alguém edita um produto — **incluindo edições feitas pelo
painel de admin no cPanel**. O `[2]upload-or-download.bat` corre-o no passo 2 do
`MODO LOCAL`, depois da validação de JSON e antes do commit, para cada deploy
enviar HTML que corresponde ao JSON. Isso também repara sozinho uma ida e volta
em `MODO CPANEL`, que traz de volta o HTML pré-renderizado antigo.

Duas coisas que o gerador deliberadamente **não** faz:

- não emite `offers` no JSON-LD de `Product` — os preços aqui são por pack e
  variam por opção, e anunciar um preço unitário que o cliente nunca vê é pior do
  que não anunciar nada;
- salta o `site/congressos/2026/`, que é cápsula e já leva `noindex`. **Não
  acrescentar essas páginas ao sitemap.**

Uma página nova é o único caso que o gerador não infere: acrescentar a entrada a
`seo-content.json`, senão fica sem metadados e fora do sitemap.

---

## Segurança na raiz web

Nunca pôr segredos, passwords, chaves de API ou dados de clientes no
repositório.

O `.htaccess` bloqueia download directo de arquivos, bases de dados e ficheiros
de log/backup (`SECURITY_HARDENING_V1`), incluindo as cópias `*.galeria-bak` da
galeria, que precisam de regra própria por terem hífen antes de `bak`. Bloqueia
também ficheiros dot e os nomes da pasta privada, caso alguma vez sejam expostos
por engano.

O `robots.txt` já mantém fora de indexação as páginas e endpoints de
administração. Os redirects antigos não são bloqueados de propósito: uma página
bloqueada no `robots.txt` nunca chega a ser lida, por isso o Google nunca veria
o `noindex` que elas trazem e podia manter o URL na pesquisa na mesma.
