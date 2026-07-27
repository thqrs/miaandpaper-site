# Mia & Paper — Code Review Report

**Date:** 2026-06-11 · **Scope:** full repository review (read-only; no changes made)

---

## 1. What the codebase is today

The repo contains roughly 35,000 lines of code. The public site is a single-page application: every HTML page (`index.html`, `checkout.html`, `cadernos.html`, etc.) is a 17-line empty shell that loads `styles.css` (7,062 lines) and `app.js` (11,188 lines, ~447 KB, 947 functions in one IIFE), which renders everything client-side from JSON files in `site/content/`. The backend is PHP on cPanel shared hosting: `send-order.php` (2,369 lines) handles orders, `admin-api.php` (1,193 lines) is the admin content API, `admin-orders.php`, `admin-funnel.php` (2,802 lines) and `admin-live-dashboard.php` are admin panels, and `lib/db.php` (1,564 lines) wraps a private SQLite database. A funnel-tracking endpoint (`track-order-event.php`) records visitor events.

The overall quality is better than typical for a project of this kind: prepared statements everywhere, a CSRF system, a honeypot on the order form, rate limiting on the tracking endpoint, hashed admin password kept outside the document root, `.htaccess` hardening for sensitive file types, and consistent output escaping (`escapeHtml` is used 366 times in `app.js`; `htmlspecialchars` wrappers in PHP). The findings below are about hardening, performance, and maintainability — not about a fundamentally broken design.

---

## 2. Security findings

### 2.1 High — failed admin passwords are stored in plaintext

`admin_log_login_attempt()` in `admin-api.php` (lines ~271–330) writes the exact text of every failed login attempt (`input_text`) to both SQLite and `private/admin-login-attempts.txt`. Failed attempts are very often near-misses or typos of the real password, so anyone who obtains these logs (backup leak, hosting compromise, a stray copy of the `private/` folder — which currently exists in the repo working tree) effectively gets the password. The comment says "never logs the correct password," but a one-character typo is nearly as good. Recommendation: log only attempt metadata (time, IP, user agent, length, EMPTY/WRONG), or at most a truncated hash.

### 2.2 High — no brute-force protection on admin login

The login handler (`admin-api.php` ~1017–1040) verifies with `password_verify()` but applies no throttling, lockout, or delay. Attempts are logged but nothing acts on the log. On shared hosting an attacker can hammer the endpoint indefinitely. Recommendation: count recent failures per IP in the existing `admin_login_attempts` table and refuse (or `sleep()` progressively) after N failures in M minutes — the data is already being collected, it just isn't used.

### 2.3 Medium — session hardening is missing

All admin entry points call bare `session_start()` with no cookie configuration. There is no `session_set_cookie_params(['httponly' => true, 'secure' => true, 'samesite' => 'Lax'])` and no `session_regenerate_id(true)` after successful login (the CSRF token is rotated, the session ID is not). This leaves the session cookie readable by JS if an XSS slips through, sent over plain HTTP if HTTPS redirect ever fails, and vulnerable to session fixation. A few lines before each `session_start()` fix all three.

### 2.4 Medium — two parallel CSRF tokens

`admin-api.php` uses `$_SESSION['miaandpaper_admin_csrf']` while `admin-orders.php` mints its own `$_SESSION['mp_admin_csrf']`. Both work, but duplicated security logic drifts apart over time (the api token rotates on login; the orders one doesn't). Consolidate into one shared helper in `lib/`.

### 2.5 Medium — uploaded images trust the declared MIME type

`admin_decode_image()` validates the `data:image/...` prefix and base64, but never verifies the bytes are actually an image (`getimagesize()` / `finfo`). Risk is limited — admin-only endpoint, extension whitelist, 5 MB cap, hashed filename — but a compromised admin session could store arbitrary bytes served as `.png`. One `getimagesize()` call on the decoded data closes it.

### 2.6 Low — admin panel JS dependencies loaded from unpkg without SRI

`admin-funnel.php` loads Leaflet 1.9.4 from `unpkg.com` with `crossorigin` but no `integrity` hash. If the CDN is compromised, script runs inside an authenticated admin session. Add SRI hashes or self-host the two files.

### 2.7 Low — no security headers

`.htaccess` sets no `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, or any Content-Security-Policy. The SPA's heavy `innerHTML` usage makes even a basic CSP valuable defense-in-depth.

### 2.8 Low — `check-open-orders.php` enumeration surface

The design is thoughtful (requires IP match, returns only a boolean, minimum field lengths), but the endpoint has no rate limit, unlike the tracking endpoint. Worth adding the same 60-per-minute per-IP guard since `lib/db.php` already has the helper.

---

## 3. Privacy / GDPR

The funnel system stores the **full IP address** of every visitor event (deliberate, per the code comments) and `admin-funnel.php` enriches IPs via external lookups (`ipwho.is`, ARIN RDAP) with geolocation shown on an OpenStreetMap map. `privacy.html` does mention IPs, cookies, and the funnel, which is good. Two gaps remain: there is no documented retention/erasure policy for `funnel_events` (raw IPs appear to be kept indefinitely; an `archived` table exists but archiving is manual), and sending visitor IPs to a third party (ipwho.is) should be reflected in the privacy text. Consider time-boxed retention (e.g., truncate or hash IPs after 30–90 days) — the rate-limit check only needs recent rows anyway.

---

## 4. Performance

**JavaScript payload.** A first-time visitor downloads ~447 KB of unminified `app.js` plus ~140 KB of `styles.css` before anything renders, because the HTML shells are empty. There is no minification, and `.htaccess` enables **no compression (`mod_deflate`) and no cache headers (`mod_expires`)** — every asset is renegotiated on every visit, with cache-busting done by hand-edited `?v=20260609211526` query strings. Enabling gzip + long-lived cache headers in `.htaccess` is the single cheapest big win on this site.

**Images.** `site/content/` is 40 MB. Five PNG photos in `content/designs/Fotos_dos_Mini_Cadernos/` are ~2 MB each — photographic content stored as PNG instead of JPEG/WebP (the same photos converted would be ~150–300 KB). `AGENTS.md` itself says "keep images optimized for web." A one-off conversion pass plus `loading="lazy"` on gallery markup would cut page weight dramatically.

**Deployed files that shouldn't be.** Everything in `site/` goes live. That currently includes: two ~7.9 MB editable `.docx` catalog files in `site/catalogo/pdfs/`, a personal media folder `site/media_tiago/` (~duplicates of content images), `styleguide.html`, `log_css_mods.txt`, an empty `biscoito.txt`, a duplicate test upload (`pins-design-01-e8ea1vvvvvvv5c0fe28.png`), and backup JSONs inside `site/content/products/` (`cadernos - backup.json`, `cadernos - Correcto.json`, `backup/`) which are publicly downloadable. None are secrets, but they bloat deploys and expose internal working files.

**No-store on content JSON.** `app.js` fetches all content with `cache: "no-store"`, so product JSON is re-downloaded on every navigation. Fine for freshness, but combined with zero server caching it makes every page view heavier than needed; a short `max-age` (60s) would be invisible to users and much lighter.

---

## 5. SEO and accessibility

Because every page is an empty `<div id="app">` filled by JS, crawlers that don't execute JS see nothing, and even Google renders it on a delayed second pass. For a small shop that presumably wants to rank for "cadernos personalizados" etc., this is a real cost. There is also no `<noscript>` fallback (a JS-disabled visitor gets a blank page), no favicon, no `og:image` (link previews on WhatsApp/Instagram — likely a key channel for this audience — show no image), no canonical URLs, no structured data (`Product`/`LocalBusiness` JSON-LD), and no sitemap.xml (robots.txt exists but allows everything including the admin PHP endpoints — consider at least not advertising them, though real protection is the auth, which exists).

The practical options, in increasing effort: (a) add favicon + `og:image` + JSON-LD to the static heads — trivial, high value; (b) pre-render the key landing pages' hero/intro content as real HTML in the shells and let the SPA hydrate over it; (c) longer-term, generate static product pages from the same JSON at deploy time.

---

## 6. Maintainability

**`app.js` is the main risk.** 11,188 lines, 947 functions, one IIFE, one shared `state` object, HTML built via string concatenation. It works, but every change risks distant breakage, nothing is unit-testable, and onboarding anyone else (human or AI) requires reading the whole file. Without adopting any build system (per your constraints), you can still split it into a handful of plain `<script>` files loaded in order (e.g., `core.js`, `funnel.js`, `products.js`, `checkout.js`, `admin.js`) — same deployment model, far better navigability. The admin UI in particular (~login form, image-slot debug tooling) could be its own file so the public bundle shrinks.

**`styles.css` (7,062 lines)** shows the same pattern, with changelog comments pointing at `log_css_mods.txt`. Versioned comment markers (`STYLE_TOKENS_V1`, `CHECKMARK_CORNER_MODE_V1`) are a reasonable convention, but consider splitting admin styles from public styles.

**Duplication between PHP and JS.** Pricing tables, product step logic, honeypot markup, and form rendering exist in both `send-order.php` and `app.js` (e.g., the hidden "website" field is defined in both, default pack prices are hardcoded in PHP while products also have JSON config). Divergence here means the customer sees one price and the email says another. Where possible, make `content/products/*.json` + `pricing.json` the single source of truth and have PHP read only from there.

**Documentation is out of date and contradicts reality.** `AGENTS.md` instructs "avoid server-side code, no databases, use mailto:" — the repo now has ~10,000 lines of PHP and a SQLite database. `README.md` describes deployment via `.cpanel.yml`, but that file doesn't exist; actual deploys appear to go through `[2]upload-or-download.bat`. Anyone (or any AI agent) following these docs will make wrong decisions. Rewriting AGENTS.md to describe the real architecture is cheap and prevents future damage.

**Dead/experimental code.** `metro_live_visitors_mockup.html` (56 KB), `catalogo-tracking-corrigido.txt`, the 7 MB `.mhtml` page snapshot, `borboleta/`, `fixture.bat`, and assorted root-level backup JSONs live in the working tree untracked. They're not deployed, but they make the repo confusing.

---

## 7. Repository and deployment hygiene

Git history consists entirely of commits named "`20260609211526 direct local update`" — timestamps with no description of what changed, which makes rollback and debugging archaeology. The working tree is dirty: deleted catalog PDFs uncommitted, ~15 untracked files/folders. The `private/` folder (live SQLite DB, login-attempt log with plaintext attempts, funnel JSONL) sits inside the repo directory — it is gitignored, which is correct, but it means every full-folder copy/backup of the repo carries customer data and the password-attempt log. Moving local private data out of the repo tree, committing or discarding the pending deletions, and writing one-line meaningful commit messages would substantially improve recoverability.

`.gitignore` is well thought out (secrets, databases, server junk all covered). `.gitattributes` exists. Good.

---

## 8. What's already good (keep doing this)

Prepared statements with `ERRMODE_EXCEPTION` and no string-built SQL anywhere checked; password stored as hash outside the web root with config resolved through a single `lib/private-paths.php`; CSRF token with `hash_equals`; honeypot field on orders; tracking endpoint rate-limited (60/IP/min), size-capped, control-character-stripped, always returns 204; `check-open-orders` deliberately leaks only a boolean and requires IP match; `.htaccess` blocks direct download of databases/logs/backups and dotfiles; email headers cleaned against header injection (`clean_header`); migrations are idempotent and recorded; monetary values in integer cents; consistent UTC ISO timestamps; thorough code comments with versioned markers.

---

## 9. Prioritized action list

**Do first (small effort, high value):** stop logging failed password text (2.1); add login throttling using the existing attempts table (2.2); harden session cookies + regenerate ID on login (2.3); enable gzip and cache headers in `.htaccess` (§4); add favicon and `og:image` (§5).

**Do soon:** convert the 2 MB PNGs to JPEG/WebP and sweep `site/` of non-public files (docx, media_tiago, backups, styleguide) (§4); add `getimagesize()` validation to uploads (2.5); SRI or self-host Leaflet (2.6); basic security headers (2.7); rewrite AGENTS.md/README to match reality (§6).

**Plan for:** splitting `app.js` into ordered plain-script modules and de-duplicating pricing/form logic between PHP and JS (§6); pre-rendered or hydrated HTML for the main landing pages (§5); funnel data retention policy (§3); meaningful commit messages and a clean working tree (§7).

---

*Report produced from static review of the repository only; no live-site testing was performed. Line numbers are approximate.*
