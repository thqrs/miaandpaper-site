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

The deployment file is `.cpanel.yml` and currently copies:

`site/.` → `/home/currwkdi/miaandpaper.com/`

Do not change the deployment path unless Tiago explicitly asks.

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
