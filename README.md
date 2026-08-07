# Mia & Paper

Site estático de uma marca portuguesa de papelaria feita à mão e personalizada:
cadernos, agendas, crachás, molduras, ímanes, lembranças e coleções de época.

`miaandpaper.com` · alojamento partilhado Namecheap/cPanel.

## Como está feito

HTML, CSS e JavaScript sem build. As páginas são cascas vazias: os módulos de
`site/js/` lêem os JSON de `site/content/` e desenham tudo no browser. O backend
é PHP simples com SQLite, fora da raiz web.

Só o que está dentro de `site/` é publicado.

## Correr localmente

```bash
php -S 127.0.0.1:8082 -t site
```

Ou `[1]abrir_miaandpaper_local.bat`, que usa os limites de upload certos. Para o
admin com pasta privada local, `run-local-admin.bat` — ver
[08 · Deploy e ambiente](docs/08-deploy-e-ambiente.md).

## Publicar

`[2]upload-or-download.bat`. Faz `git pull` no servidor por SSH e copia `site/`
para a raiz web — **o commit é a unidade de publicação**, e o mesmo script também
sincroniza na direcção contrária, por isso confirma a direcção antes de correr.

Há uma checklist de pré-deploy em
[08 · Deploy e ambiente](docs/08-deploy-e-ambiente.md).

## Documentação

Começa pelo [`AGENTS.md`](AGENTS.md) — as regras. Depois, o índice em
[`docs/`](docs/README.md).
