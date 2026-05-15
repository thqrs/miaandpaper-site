# Mia&Paper website

Static website source for `miaandpaper.com`.

## Folder structure

- `site/` contains the files that should go live on the website.
- `.cpanel.yml` tells cPanel Git deployment to copy `site/` into `/home/currwkdi/miaandpaper.com/`.
- `AGENTS.md` gives Codex instructions for editing the site safely.

## Deploy through cPanel

In cPanel:

1. Open **Git Version Control**.
2. Clone this GitHub repository into a safe repo folder, for example:
   `/home/currwkdi/repositories/miaandpaper-site`
3. Open **Manage** for the repo.
4. Click **Update from Remote**.
5. Click **Deploy HEAD Commit**.

The live website folder should remain:

`/home/currwkdi/miaandpaper.com/`

Do not make the Git repository itself live inside the public website folder.
