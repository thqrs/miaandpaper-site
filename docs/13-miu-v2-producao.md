# 13 · Míu V2 em produção — plano, execução e reversão

> Estado: **implementado e activado localmente em 2026-08-29**. Não houve
> `push` nem deploy. O interruptor público está em `engine: v2`, mas o Míu V1
> continua inteiro e é o fallback automático.

## Resultado e princípio de segurança

O Míu V2 não substitui o chatbot nem apaga o launcher anterior. Acrescenta um
actor visual 8×8 por cima da mesma casca de `site/js/24-miu.js`:

```text
bot-api.php
  ├─ configuração/chat V1 existente
  └─ directorV2 + engine v1|v2
           ↓
24-miu.js cria o launcher V1 normal
           ↓
engine=v2? carrega miu-v2-runtime.js
           ↓
manifesto + primeiro PNG prontos?
  ├─ não / erro → V1 nunca foi escondido
  └─ sim        → canvas V2 visível; V1 pára os timers e fica no DOM
```

Há três formas independentes de voltar atrás:

1. **Rollback lógico, imediato:** `site/miu-v2.php` → **Voltar ao V1**.
2. **Fallback automático:** se runtime, manifesto, canvas ou PNG falharem, a
   classe `is-miu-v2-ready` nunca é aplicada e o V1 permanece visível.
3. **Rollback de código:** usar `git revert miu-v2-production` depois de criada
   a tag local final. O ponto anterior está marcado por
   `miu-v2-before-production` e pelo commit `469d9f2`.

Nenhum destes caminhos exige converter, reconstruir ou recuperar imagens.

## Sequência executada

### 1. Checkpoint antes de mexer

Foi criado primeiro o commit local:

```text
469d9f2 checkpoint: estado antes da integração do Míu V2
```

Este commit inclui deliberadamente todo o estado que já existia no directório,
incluindo trabalho não relacionado com o Míu. É um retrato exacto e não uma
selecção parcial. Não foi enviado para remoto.

Depois do commit é criada a tag local `miu-v2-before-production` a apontar para
esse hash.

### 2. Arquivo protegido do V1

O script executável `tools/promote-miu-v2.ps1` cria:

```text
protected/
├─ miu-v1-checkpoint-469d9f2/
   ├─ README.md
   ├─ MANIFEST.sha256
   ├─ site/                         cópia dos ficheiros V1 activos
   └─ retired-public-copies/        ficheiros .old sem referências
└─ miu-v1-post-checkpoint-files-469d9f2/
   └─ cópias redundantes preservadas durante a reparação
```

A pasta `protected/` fica fora de `site/`, portanto o deploy normal não a
publica. Contém ainda um `.htaccess` de negação para o caso de a raiz do
repositório ser copiada por engano. Não contém `private/`, SQLite, chaves de API,
sessões ou dados de clientes.

O retrato exacto tem 173 ficheiros (incluindo o manifesto), cerca de 7,7 MiB e
172 entradas SHA-256. `MANIFEST.sha256` é a fonte de verificação. Os ficheiros
necessários ao V1 ficam também no caminho original porque são o fallback
operacional. Apenas as 23 cópias `*.webp.old`, sem qualquer referência no
código, foram movidas para `retired-public-copies/`. Não foram apagadas.

O script extrai os ficheiros V1 directamente do objecto Git `469d9f2`, e não
da working tree. Se encontrar no destino uma cópia que não pertence a esse
commit, move-a para `miu-v1-post-checkpoint-files-469d9f2/`; essa zona não é
usada no rollback e existe para evitar eliminação de dados durante a reparação.

Para repetir a promoção de forma idempotente:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass \
  -File tools/promote-miu-v2.ps1 -Checkpoint 469d9f2
```

O script resolve e valida os caminhos absolutos antes de copiar/mover; não toca
fora do repositório e nunca lê `private/`.

### 3. Promoção dos sprites nucleares

O arranque público precisa apenas de duas folhas:

```text
site/content/brand/miu/v2/
├─ core-manifest.json
└─ core/
   ├─ miu-v5-idle-attention-8x8.png
   └─ miu-v5-gesture-reactions-8x8.png
```

As folhas são cópias PNG dos assets derivados do Míu canónico. A origem não foi
alterada nem substituída. Continuam 8×8, RGBA e com 64 células. **Nunca são
convertidas para WebP.**

O script de promoção calcula uma vez as âncoras que o browser precisa. Para cada
célula mede a caixa alpha, calcula os centros e usa a mediana por linha/coluna:

```text
anchorX = median(column body centres) - logicalCell.sourceX
anchorY = median(row body centres)    - logicalCell.sourceY
```

O resultado fica em `core-manifest.json` com
`anchorStrategy: precomputed-median-anatomical-centres`. Em produção, o canvas
desenha directamente o recorte lógico com estas âncoras. Isto preserva o método
de auto-centragem e evita fazer Connected-Component Labelling sobre milhões de
píxeis em cada visita mobile.

Para folhas emocionais ou histórias carregadas apenas a pedido, o runtime usa o
detector exacto `MiuSpriteGrid.detectConnectedGrid`; esse custo só existe quando
`setMood()` ou `playEpisode()` é chamado.

## O modelo de actor

A implementação segue a correcção conceptual do V5:

```text
idle vivo
   ↓ pessoa começa a alterar
atenção contínua («Oi?»)
   ↓ eventos input agregados; não reinicia a animação
tracking da direcção
   ↓ janela silenciosa de 190 ms
uma reacção pela magnitude + velocidade do gesto total
   ↓
recovery
   ↓
idle vivo
```

O valor absoluto não percorre uma escala de expressões. Uma quantidade alta não
deixa o Míu permanentemente surpreendido e uma quantidade baixa não o deixa
permanentemente triste. O motor guarda o valor apenas para normalizar o gesto:

```text
relativeDelta = abs(current - gestureStart) / (max - min)
score = max(relativeDelta, importance) + velocityBoost
```

Os limites iniciais são `< 0,28` pequeno, `< 0,62` médio e o restante grande.
Tudo é editável em `miu-v2.php`.

As frames artísticas continuam soberanas. O runtime não abre bocas, redesenha
olhos ou faz morph. Quando o actor chega a uma frame final, a imagem de partida
é sempre a frame PNG real.

### Rig e mesh: duas camadas secundárias

O renderer tem duas camadas distintas, ambas reguladas pela intensidade do rig:

1. **Rig global:** desloca o Míu inteiro, inclina-o e aplica squash/stretch
   muito ligeiro. Faz respiração, anticipation, salto, overshoot e settle.
2. **Mesh local:** divide o recorte 8×8 já centrado em 2–12 bandas horizontais
   rígidas. As bandas recebem apenas offsets de poucos píxeis e follow-through;
   o squash local só tem influência na base/corpo.

A mesh não possui landmarks faciais, não move olhos ou boca separadamente e
não interpola uma cara para outra. Os píxeis dentro de cada banda permanecem
iguais. O envelope local é zero no primeiro e no último instante de cada take,
garantindo que o keyframe artístico final é atingido sem deformação da mesh.
Durante o idle existe apenas um follow-through muito pequeno.

Valores iniciais:

```json
"mesh": {
  "enabled": true,
  "rows": 6,
  "maxOffsetPx": 2.4,
  "followThrough": 0.18,
  "squashInfluence": 0.012
}
```

Todos estão limitados e editáveis no painel. `rigIntensity: 0` desliga o rig e
a mesh; `mesh.enabled: false` desliga só a articulação local. Em
`prefers-reduced-motion`, a mesh é sempre ignorada, mesmo que esteja activa na
configuração.

## Prioridades

```text
rejoice / one-shot importante
        ↓
emoção manual ou episódio
        ↓
reacção de quantidade/pack
        ↓
atenção e tracking
        ↓
idle vivo
```

Uma alteração recebida durante `rejoice`, emoção ou episódio é guardada como a
última alteração pendente. Não interrompe o one-shot e é reavaliada depois do
recovery. O episódio reproduz a folha principal da personagem; props e FX
complexos continuam disponíveis no laboratório e podem ser promovidos numa
fase posterior sem mudar a API.

## Eventos de integração com os produtos

Os configuradores não conhecem frames. Publicam dados sem listas de slugs:

```js
document.dispatchEvent(new CustomEvent('mia:miu-quantity-change', {
  detail: {
    previousValue: 2,
    currentValue: 8,
    min: 1,
    max: 10,
    source: 'quantity', // ou 'pack'
    importance: 0.67   // opcional: distância relativa entre opções de pack
  }
}));
```

`setFreeQuantity()` cobre o slider, botões +/− e packs livres. Os packs fixos e
as quantidades de cadernos publicam o mesmo contrato. Num pack, `importance`
é a distância entre a opção anterior e a nova na lista ordenada; isto impede
que um limite técnico alto, como 9999, torne um salto visualmente grande quase
nulo. O catálogo e o Congresso implementam este contrato sem listas de slugs.
A função `goNext()` só publica `mia:step-completed` depois de a validação ter
passado. O rejoice ocorre apenas para IDs de passo configurados em
`continueStepIds`; não depende do slug do produto.

## Carregamento e peso

O arranque faz:

1. HTML/CSS e Míu V1 habituais;
2. GET `bot-api.php`, que inclui `directorV2`;
3. runtime V2 pequeno;
4. manifesto core;
5. PNG de idle/atenção;
6. mostra o canvas e agenda o PNG de reacções para `requestIdleCallback`.

A biblioteca de 41 folhas/2624 frames **não** é descarregada no arranque.
Emoções e episódios são lazy-load e ficam na cache HTTP do browser. Episódios
ambientais começam desligados para proteger dados móveis; podem ser ligados no
painel, com intervalo e probabilidade.

## API pública

Depois de a V2 ficar pronta:

```js
miu.quantity.begin({ previousValue: 2, source: 'slider' });
miu.quantity.set({ value: 8, min: 0, max: 10 });
miu.quantity.end();

miu.updateQuantityReaction({
  previousValue: 2,
  value: 8,
  min: 0,
  max: 10,
  source: 'pack'
});

miu.playOneShot('rejoice');
miu.setMood('happiness', 0.72);
miu.playEpisode('s01e01-borboleta-no-nariz');
miu.rig.setIntensity(0.55);
miu.mesh.enable(true);
miu.mesh.set({ rows: 6, maxOffsetPx: 2.4, followThrough: 0.18 });
miu.reset();
miu.debug();
```

`setMood()` aceita as sete folhas base Ekman e escolhe o grau pedido dentro da
folha. `playEpisode()` carrega só a folha principal da história. Ambos regressam
ao idle através de recovery.

## Painel `miu-v2.php`

É uma página interna normal:

- inclui `admin-open.php` e exige `miaandpaper_admin`;
- usa o CSRF central em todos os POST;
- carrega `admin-nav.css` e `admin-nav.js`;
- está na lista única de `admin-nav.js`;
- grava apenas `site/content/brand/miu/miu-v2-config.json`;
- não recebe uploads nem aceita caminhos fora de `content/brand/miu/`;
- não lê parâmetros GET novos;
- tem o Míu público real no canto e botões de ensaio;
- tem formulários guiados e um editor JSON integral;
- sanitiza tipos, IDs, caminhos e limites no servidor.

Aspectos ajustáveis:

- motor V1/V2;
- tamanho desktop/mobile, resolução, offsets, escala e intensidade do rig;
- mesh ligada/desligada, número de bandas, offset máximo, follow-through e
  squash local da base;
- FX anime;
- velocidade, idle, atenção, quiet window, hold e recovery;
- thresholds e peso da velocidade;
- animação usada em cada papel e pesos dos micro-idles;
- quantidade, packs, continuar, launcher e chat;
- passos onde `Continuar` celebra;
- emoções, episódios manuais e episódios ambientais;
- intervalo, probabilidade e lista de episódios;
- `prefers-reduced-motion` e logging;
- paths/versionamento no JSON avançado.

## Reduced motion

Com `prefers-reduced-motion: reduce`:

- a expressão e a história continuam legíveis;
- cada clip usa primeira, central e última pose;
- tracking não fica em loop rápido;
- movimento secundário usa o valor reduzido, inicialmente zero;
- a mesh local é retirada por completo;
- o rejoice mantém as key poses, sem salto grande;
- FX ficam estáticos e mais leves.

## Ficheiros introduzidos ou alterados

| Ficheiro | Papel | Rollback |
|---|---|---|
| `site/miu-v2.php` | painel e interruptor | remover pelo revert; não é dependência do V1 |
| `site/lib/miu-v2.php` | defaults, validação e persistência | retirar o require/GET do `bot-api.php` |
| `site/miu-v2-runtime.js` | actor canvas, director e lazy library | fica sem ser carregado em `engine:v1` |
| `site/miu-v2-admin.css` | estilo exclusivo do painel | sem efeito fora do painel |
| `site/content/brand/miu/miu-v2-config.json` | fonte única do switch/afinação | mudar `engine` para `v1` |
| `site/content/brand/miu/v2/` | manifesto e dois PNG core | V1 não lhes toca |
| `site/bot-api.php` | expõe `directorV2` | V1 ignora o campo adicional |
| `site/js/24-miu.js` | adapter de boot/delegação | arquivo contém a versão exacta anterior |
| `site/css/13-miu.css` | canvas V2 só sob classe ready | regras inertes em V1/falha |
| `site/js/01-nucleo.js` | helper de eventos sem frames | inerte sem listener V2 |
| `site/js/14-upload-quantidade.js` | publica alterações livres | não altera cálculo/preço |
| `site/js/18-wizard-navegacao.js` | publica passo validado | não altera navegação |
| `site/js/20-quadros-anim-bind.js` | publica packs/cadernos | não altera selecção/preço |
| `site/congressos/2026/app-congressos.js` | publica o mesmo contrato no Congresso | não altera selecção/preço |
| `site/congressos/2026/*.html` | actualiza o `?v=` do app do Congresso | apenas cache-busting |
| `tools/promote-miu-v2.ps1` | arquivo + promoção reproduzível | só copia/move `.old` |
| `protected/…` | arquivo fora da web | manter mesmo depois de rollback |

## Procedimentos de rollback

### A. Voltar ao V1 sem mexer no Git

1. Abrir `site/miu-v2.php`.
2. Carregar **Voltar ao V1**.
3. Abrir uma página pública numa janela privada.
4. Confirmar que `.miu-root` não recebe `is-miu-v2-ready`.
5. Confirmar chat, mensagens, launcher, mobile e `prefers-reduced-motion`.

Equivalente no JSON:

```json
"engine": "v1"
```

### B. Voltar a activar a V2

1. Painel → **Activar V2**.
2. Confirmar que o canvas aparece só depois do primeiro frame.
3. Testar alteração pequena, alteração grande, descida e Continuar.

### C. Reverter toda a implementação em Git

Depois de o commit final/tag `miu-v2-production` existir:

```bash
git revert miu-v2-production
```

Isto cria um novo commit inverso e preserva o histórico. Não usar
`git reset --hard`. O arquivo protegido pode ficar no repositório; se o revert o
retirar, continua recuperável no commit/tag da implementação.

Para consultar o estado anterior sem alterar a árvore:

```bash
git show miu-v2-before-production:site/js/24-miu.js
git diff miu-v2-before-production..miu-v2-production -- site/
```

### D. Recuperar manualmente um ficheiro V1

1. Confirmar o hash no `MANIFEST.sha256`.
2. Copiar o caminho equivalente de
   `protected/miu-v1-checkpoint-469d9f2/site/...`.
3. Nunca copiar `private/` nem inventar configuração.
4. Validar sintaxe e browser antes de publicar.

## Validação obrigatória antes de deploy

```bash
php -l site/miu-v2.php
php -l site/lib/miu-v2.php
php -l site/bot-api.php
node --check site/miu-v2-runtime.js
node --check site/js/24-miu.js
node --check site/js/01-nucleo.js
node --check site/js/14-upload-quantidade.js
node --check site/js/18-wizard-navegacao.js
node --check site/js/20-quadros-anim-bind.js
node --check site/congressos/2026/app-congressos.js
powershell -NoProfile -ExecutionPolicy Bypass -File tools/validate-miu-library-v1.ps1
```

No browser, testar pelo menos:

1. página sem configurador: idle, hover, abrir/fechar chat;
2. produto de catálogo com slider: arrasto rápido e oscilação;
3. produto de catálogo com packs: salto pequeno e grande;
4. produto do Congresso com pack/quantidade;
5. Continuar com validação falhada: não festeja;
6. Continuar depois de validação válida no passo configurado: rejoice;
7. reduced motion;
8. mesh ligada/desligada: confirmar centragem, ausência de costuras e frame
   final idêntica;
9. simular erro do manifesto: V1 visível;
10. painel em `engine:v1` e depois `engine:v2`;
11. DevTools: nenhum pedido WebP novo para sprites V2 e nenhuma folha de
    episódio antes de ser chamada.

Antes de publicar, continua também a aplicar-se a checklist geral de
`docs/08-deploy-e-ambiente.md`, incluindo fechar `MIA_ADMIN_OPEN`.

### Validação executada localmente em 2026-08-29

- 64 ficheiros PHP e 27 ficheiros JavaScript passaram a verificação de
  sintaxe; 135 JSON abriram como UTF-8 sem BOM.
- As 41 folhas da biblioteca, 2624 células e 14 episódios passaram o validador;
  o core tem duas folhas PNG RGBA 1254×1254 e zero WebP.
- O manifesto protegido tem 172 hashes válidos; `site/js/24-miu.js` no arquivo
  tem o mesmo object ID Git que o ficheiro do checkpoint `469d9f2`.
- As 37 cascas HTML da raiz responderam HTTP 200 no servidor PHP local.
- Catálogo (`crachas.html`): `1 → 24` produziu uma única reacção
  `v5_quantity_up_large`; `24 → 1`, `v5_quantity_down_large`.
- Uma rajada de oito eventos ficou em `tracking`, reagiu uma vez depois da
  quiet window e regressou ao idle. `5 → 6 → 5 → 6 → 5` fez recovery sem
  reacção direccional.
- `Continuar` registou a sequência `one-shot → recovery → idle`, sem ser
  interrompido pela quantidade.
- O produto de Congresso `congressos/2026/crachas.html` produziu o mesmo
  `v5_quantity_up_large` para `1 → 24`.
- O painel carregou uma emoção Ekman e o episódio da borboleta por lazy-load,
  ambos com regresso a idle e sem erros de consola.
- Rollback pelo painel mostrou o V1 sem canvas; reactivar mostrou um canvas V2
  e ocultou o visual V1 apenas depois de `is-miu-v2-ready`.
- Em 390×844 o canvas mediu 98×98 CSS px. Com reduced motion usou três poses,
  manteve a informação emocional e reportou `meshEnabled: false`.
- A API ao vivo confirmou `engine: v2`, rig `0.62`, mesh activa com seis bandas;
  os métodos de ligar/desligar e afinar rig/mesh foram ensaiados e repostos.

## Critérios de aceitação

- Míu está quietinho, pisca, olha e faz micro-caretas sem intervenção.
- Um gesto contínuo produz uma atenção e uma reacção, não uma animação por
  unidade.
- Aumentar pouco é simpático; aumentar muito pode ser «Uau!».
- Diminuir é subtil e não culpabiliza.
- Rejoice tem prioridade e regressa ao idle.
- Não há morph facial nem crossfade de caras.
- Rig e mesh acrescentam apenas movimento secundário; desligá-los não muda a
  animação escolhida.
- O PNG canónico/derivado chega intacto a cada keyframe.
- Oscilar não deixa o Míu tremelicante.
- O V1 está disponível em um clique e numa falha de rede.
- Nenhum asset do Míu foi convertido para WebP.
- Nenhum ficheiro V1 foi apagado.
