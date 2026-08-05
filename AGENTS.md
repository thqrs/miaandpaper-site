# AGENTS.md — Mia&Paper website

## Goal

Build and maintain a small, fast, elegant static website for Mia&Paper.

The website is for a Portuguese handmade/personalized paper goods brand: cadernos, agendas, pins, molduras, lembranças, produtos personalizados and seasonal collections.

## Language and tone

Use Portuguese from Portugal.

Tone:
- warm but not sugary
- handmade and personal
- not generic marketing fluff
- no repetitive AI-style phrases
- avoid excessive emojis
- avoid cliché phrases like "feito com carinho e atenção ao detalhe"

Prefer simple, direct Portuguese.

## Technical constraints

This is a static site for Namecheap/cPanel shared hosting.

Use:
- HTML
- CSS
- optional vanilla JavaScript

Avoid unless explicitly requested:
- Node build systems
- React
- Vite
- Next.js
- server-side code
- databases
- npm dependencies

Reason: cPanel deployment should be simple and robust.

## Deployment structure

Only files inside `site/` are deployed to the live website.

Deployment is **not** `.cpanel.yml` — that file does not exist and never did.
The real mechanism is `[2]upload-or-download.bat` in the repo root, which over
SSH runs, on the server:

```
cd /home/currwkdi/repositories/miaandpaper-site
git pull --ff-only origin main
/bin/cp -R site/. /home/currwkdi/miaandpaper.com/
```

So **the commit is the unit of publication** — anything not committed and
pushed is not deployed.

Two consequences worth knowing:

- **`cp -R` never deletes.** Files removed from the repo stay alive on the
  server forever. Removing something is a two-step job: delete it from the repo
  *and* delete it on the server. (This is why three folders of duplicated PDFs
  survived in `site/ofertas/` long after they stopped being referenced.)
- The script also mirrors the other way (`cpanel` → PC), which overwrites the
  local `site/`. It makes a backup first, but check which direction you are
  running before you run it.

Do not change the deployment path unless Tiago explicitly asks.

## Congresso 2026 is a time capsule — do not touch

`site/congressos/2026/` is a **frozen snapshot** of the wizards as they were for
the 2026 convention. It has its own copies of everything:

- `site/congressos/2026/content/products/*.json` (slugs `crachas`, `imanes`,
  `caderninhos`, `cadernos`)
- `site/congressos/2026/content/pricing.json`
- its own `*.html` shells

Rules:

- **Never edit anything under `site/congressos/2026/`.** Not to "keep it in
  sync", not to fix a bug you spotted, not to apply a global refactor. If it
  looks wrong, it is wrong *on purpose* — it records what was sold in 2026.
- The capsule is **fully independent** of the homepage catalogue. The homepage
  products (`crachas-loja`, `imanes-loja`, `mini-cadernos`, `bloquinhos`,
  `cadernos-anuais`, `stickers`, `marcadores` — `catalogContext: "main-v2"`) and the capsule
  products (`catalogContext: "congress-2026"`) share only the rendering code in
  `app.js`. Changing one must never change the other.
- Because they share `app.js`, gate any behaviour change by **data**, not by
  family/slug lists: add a flag to the product JSON of the products that want
  the new behaviour (e.g. `adjustPerDesign` on the `pack` step) instead of
  editing a shared code path unconditionally. Then verify both a main-v2
  product and a capsule product still render as before.
- The capsule products are the reference for what the pricing ladders used to
  be. Read them; do not write them.

## Main catalogue pricing: three modes, validated at checkout

`send-order.php` accepts exactly three pricing modes for `main-v2` products, and
`allowUnitDiscounts` must agree with the mode — in **both** the product JSON and
`content/pricing.json`, and the two files must declare the *same* mode
(`main_v2_pricing_is_valid` / `main_v2_pricing_modes_agree`). Anything else fails
validation at checkout, silently to the customer.

| mode | `allowUnitDiscounts` | used by |
| --- | --- | --- |
| `flat-unit` | `false` | stickers, marcadores, cadernos anuais |
| `pack-combination` | `true` | crachás, mini-cadernos, bloquinhos, ímanes 3 mm |
| `tier-unit` | `true` | ímanes Achatados (finos), ímanes recortados |
| `linear-discount-interpolation` | `true` | nothing — kept so old configs still validate |

The mode can also be set **per price table** with `pricingModeByPriceKey`, for
products whose variants price differently — ímanes declare
`"pricingMode": "pack-combination"` plus
`"pricingModeByPriceKey": {"Achatados": "tier-unit"}`. The map must match in both
files (`main_v2_pricing_modes_agree` compares it), and the resolution pair is
`effectivePricingMode()` in `app.js` / `main_v2_effective_pricing_mode()` in
`send-order.php`.

### `tier-unit`

The lowest tier is the baseline unit price (0% discount) and every tier above it
fixes its own discount. **Above the minimum any whole quantity is orderable**,
and each extra unit is sold at the discount of the tier in force: 16 ímanes finos
are `16 × (10,00 € / 15) = 10,67 €`, 31 are `31 × (18,00 € / 30) = 18,60 €`.
`tierPriceCents()` in `app.js` and `product_tier_price_cents()` in
`send-order.php` must agree to the cent. Below the first tier there is no price:
the client clamps the minimum and the server rejects it — including the
own-artwork flow, which is validated on the upload step. Tier products keep the
same savings nudge as `pack-combination` (`renderTierUpgradeSummary`), because a
quantity just below a tier can cost more than the tier itself (35 recortados =
35,00 €, 36 = 34,00 €).

### `pack-combination`

There are **no intermediate discounts**. The price of N units is the cheapest
combination of configured packs that sums to **exactly** N — 47 crachás are
`1 pack de 24 + 4 packs de 5 + 1 pack de 3 = 57,20 €`. It is an unbounded
coin-change DP, implemented twice:

- `product_pack_combination_plan()` in `send-order.php` (the authority)
- `packCombinationPlan()` in `app.js` (what the customer sees)

**Both must return the same cents for every quantity.** Same algorithm, same
tie-break: packs ascending, strict `<`, so the smallest pack wins ties. If you
touch one, re-run the cross-check over every quantity of every price table
before shipping — a divergence here charges the customer a different price from
what the page showed.

Two consequences worth knowing:

- **Not every quantity is orderable.** A quantity only exists if the packs can
  sum to it. Crachás, mini-cadernos and ímanes 3 mm have a 1-unit price, so
  everything from 1 works. A table without a unit price (packs 15/30/60/105)
  only reaches multiples of 15 — the quantity control snaps
  (`snapQuantityToPacks`) and the server rejects anything else. To get finer
  granularity, add a small pack to the table or move that table to `tier-unit`
  (which is what ímanes *Achatados* did); do not special-case the code.
- **N can cost more than N+1.** 47 crachás (57,20 €) cost more than 48
  (50,00 €). This is intended: `renderPackCombinationSummary` shows the
  breakdown and the line "*se comprares 1 pack de 48, consegues 48 crachás por
  50,00 € — poupas 7,20 €*". Do not "fix" the inversion by capping the price;
  it is the whole point of the nudge.

Pack quantity buttons are separate from pricing. A pack tile is only rendered
when its quantity also exists in the active `prices` table, so a `flat-unit`
product needs proportional entries (`5: 250` for a 0,50 € sticker) to show
buttons without inventing a discount.

## Snapshots — refresh them when you change structure

`admin-funnel.php`, `admin-live-dashboard.php` and `modulos.php` are served
from **frozen HTML snapshots** stored in `private/snapshots/`. Without them,
those pages recompute from tens of thousands of rows on every request and take
3–5 seconds each; with them, milliseconds.

**After any structural change, regenerate the snapshots** — otherwise the
panels keep showing the old structure. Structural means: a new product, a new
wizard step, a new CSS class, a new metro line, a new funnel event name.

Where: `admin-snapshots.php` → **Criar todos os snapshots**. Also reachable
from `tools/index.php`.

Also regenerate **before every deploy**, so the live server starts with them
already built. And add a target to `mp_snapshot_alvos()` in
`site/lib/snapshot.php` whenever a page gains a snapshot.

Any page with a snapshot accepts `?snapshot=off` (see it live once) and
`?snapshot=refazer` (rebuild it). The banner at the top of each page shows the
snapshot's age.

The trade-off is real and deliberate: a snapshot of an analytics page shows the
numbers from when it was taken. That's fine for `modulos.php` (depends only on
the CSS) and a judgement call for the funnel.

## Admin notification emails

`site/lib/avisos.php` sends email to the `to` addresses of the private mail
config when something happens that would otherwise only reach `error_log`:
client uploads, guardrails firing, an order failing to save, the order email
failing.

Each notification type has a silence window, so a problem that repeats a
thousand times sends one email that says it happened a thousand times. Add new
notifications with `mp_aviso($tipo, $chave, $assunto, $linhas)` — it never
throws and never blocks the customer's flow.

## Image management tools

The site has internal tools for managing every image used across the product
pages: `site/galeria.html` (fix framing/zoom, replace images) and
`site/multimedia.html` (inventory of all image files).

**Read `GALERIA.md` before touching them, or before adding new product steps,
new products, or new image fields.** It explains what is picked up
automatically, what needs a small edit, and what is not covered at all.

When creating a new product category, complete the mandatory checklist in
`GALERIA.md` section 7 as part of the same change. In particular, match the
product JSON slug to the page's `data-product`, register any new visual
context, and verify the result in both `galeria.html` and `multimedia.html`.
Do not leave gallery integration as a later follow-up and do not build a
separate manual image registry.

Two things to know up front:

- `site/galeria-api.php` is currently **open to the public** on purpose. Close
  it with `GALERIA_REQUIRE_ADMIN` when the photo upload work is finished.
- Image adjustments live in `item.imageEdits[editKey]`, which wins over the
  flat `imageZoom`/`imagePositionX`/... properties on the item. Never compute
  those defaults independently — read what the site actually applies.

## SEO — re-run the generator after content changes

Every page is a shell: `app.js` reads the JSON in `site/content/` and writes
everything into `#app`. The HTML that Googlebot downloads therefore has no text
and — worse — not a single `<a>`, so a crawler cannot even discover the other
pages. `site/tools/seo-build.js` fixes that by writing, into each page:

- the `<head>` block between `<!-- seo:head:start -->` / `<!-- seo:head:end -->`
  (title, description, canonical, Open Graph, JSON-LD);
- a static block inside `#app`, between `<!-- seo:prerender:start -->` /
  `<!-- seo:prerender:end -->`, with an `h1`, the copy, the design names and
  links to the other pages.

`app.js` does `app.innerHTML = ...`, so that block is replaced as soon as the
JSON arrives. `.seo-prerender` in `styles.css` keeps it `display: none`: the gap
before the JSON lands is around a second, which was long enough to see the text
appear and vanish, and that reads as a bug.

Hidden is still enough for what it is for. Googlebot reads the raw HTML without
applying CSS, so it gets the text and — more importantly — the links it needs to
discover the other pages. When it later renders the page with JavaScript it finds
the real `app.js` output, which says the same or more. Nothing is hidden from
Google that visitors see, and nothing is shown to Google that visitors do not.

Each generated page carries `<noscript><style>.seo-prerender{display:block}`,
which restores it when there is no JavaScript to replace it — otherwise those
visitors would get a blank page. It has to sit after the `styles.css` link to win
on source order, which is where the generated head block already goes.

```bash
node site/tools/seo-build.js
```

The generator reads the JSON at the moment it runs, so its output goes stale the
instant anyone edits a product — including edits made through the admin panel on
cPanel. `[2]upload-or-download.bat` therefore runs it in step 2 of `MODO LOCAL`,
after the JSON validation and before the commit, so every deploy ships HTML that
matches the JSON. That also self-heals a `MODO CPANEL` round trip, which mirrors
the live site back to the PC with the older prerendered HTML inside it.

The script is idempotent — run it again after any change to product JSON,
`site/content/home.json`, `site/content/congressos.json`, or to the copy itself.
**Never hand-edit anything between the markers**: the next run overwrites it.

Adding a new page is the one case the generator cannot infer: add an entry to
`site/tools/seo-content.json` or the page gets no metadata and stays out of the
sitemap.

The copy lives in `site/tools/seo-content.json`, not in the JS. That is the file
to edit for titles, descriptions and page headings. It also regenerates
`site/sitemap.xml`, which is declared in `site/robots.txt`.

Two things the generator deliberately does not do:

- It emits no `offers` in the `Product` JSON-LD. Prices here are per pack and
  vary by option, and advertising a unit price the customer never sees on the
  page is worse than advertising nothing.
- It skips `site/congressos/2026/`, which is a time capsule and already carries
  `noindex`. Do not add those pages to the sitemap.

## Safety rules

Do not put secrets, passwords, API keys, or private customer data in the repo.

Keep images optimized for web.

Keep the site lightweight and mobile-first.

If adding forms, do not invent backend handling. Use a simple `mailto:` link or ask Tiago which form service to use.

## Suggested first real website sections

- Hero: Mia&Paper identity and made-to-order positioning
- Product categories: agendas, cadernos, pins, molduras, lembranças
- Personalized orders: how the process works
- Gallery/portfolio
- Contact/order CTA
- FAQ: timing, customization, local pickup/shipping, payment method placeholder

## Style direction

Natural paper tones, soft greens/yellows, clean layout, enough whitespace.

Avoid looking like a generic corporate template.
