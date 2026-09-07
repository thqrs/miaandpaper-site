<?php
/**
 * MIU_RIG_EXPERIMENTAL_V3
 *
 * Laboratório isolado: keyframes artísticos reais + movimento secundário de mesh.
 * Regra central: a mesh não inventa nem morpha expressões. Boca, olhos e pose
 * facial vêm sempre dos WebP desenhados. A mesh só acrescenta movimento subtil
 * entre/por cima dos keyframes (bob, squash/stretch, tilt e settle).
 *
 * Não lê nem grava a configuração do Míu público.
 */

require_once __DIR__ . '/admin-open.php';

if (empty($_SESSION['miaandpaper_admin'])) {
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt-PT"><meta charset="utf-8">'
        . '<title>Acesso negado · Míu Rig V3</title><h1>Acesso restrito.</h1>'
        . '<p>Inicia sessão como administradora e regressa a esta página.</p>';
    exit;
}
?>
<!doctype html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Míu Rig V3 · Frames + movimento secundário</title>
  <link rel="stylesheet" href="css/01-tokens-agua.css?v=20260908005511">
  <link rel="stylesheet" href="admin-nav.css?v=20260908005511">
  <script src="admin-nav.js?v=20260908005511" defer></script>
  <style>
    .rig3-page{min-height:100vh;margin:0;background:var(--surface-page,Canvas);color:var(--ink,CanvasText);font-family:system-ui,sans-serif}
    .rig3-shell{width:min(100% - 28px,1180px);margin:auto;padding:32px 0 70px}
    .rig3-hero{display:grid;gap:10px;max-width:900px;margin-bottom:20px}
    .rig3-kicker,.rig3-badge{display:inline-flex;width:max-content;align-items:center;padding:6px 9px;border:1px solid var(--border-soft-gold,currentColor);border-radius:999px;background:var(--surface-gold-soft,Canvas);color:var(--moss,CanvasText);font-size:.68rem;font-weight:850;letter-spacing:.05em;text-transform:uppercase}
    .rig3-hero h1{margin:0;color:var(--moss,CanvasText);font:750 clamp(2rem,6vw,4rem)/1 Georgia,"Times New Roman",serif;letter-spacing:-.035em}
    .rig3-hero p{margin:0;color:var(--muted,CanvasText);line-height:1.6}
    .rig3-rule{padding:13px 15px;border:1px solid var(--line,currentColor);border-left:4px solid var(--gold,goldenrod);border-radius:14px;background:var(--surface-panel,Canvas);color:var(--muted,CanvasText);line-height:1.55;margin-bottom:18px}
    .rig3-rule strong{color:var(--moss,CanvasText)}
    .rig3-compare{display:grid;gap:16px}
    .rig3-card{min-width:0;border:1px solid var(--line,currentColor);border-radius:22px;background:var(--surface-panel,Canvas);box-shadow:var(--shadow-editorial,none)}
    .rig3-stage-card{display:grid;gap:12px;padding:16px}
    .rig3-stage-card header{display:flex;gap:10px;justify-content:space-between;align-items:start}
    .rig3-stage-card h2,.rig3-controls h2,.rig3-info h2{margin:0;color:var(--moss,CanvasText);font:750 1.12rem/1.2 Georgia,"Times New Roman",serif}
    .rig3-stage{position:relative;display:grid;place-items:center;min-height:300px;overflow:hidden;border:1px solid var(--line,currentColor);border-radius:16px;background-color:var(--surface-raised,Canvas);background-image:linear-gradient(45deg,color-mix(in srgb,var(--linen,CanvasText) 22%,transparent) 25%,transparent 25%),linear-gradient(-45deg,color-mix(in srgb,var(--linen,CanvasText) 22%,transparent) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,color-mix(in srgb,var(--linen,CanvasText) 22%,transparent) 75%),linear-gradient(-45deg,transparent 75%,color-mix(in srgb,var(--linen,CanvasText) 22%,transparent) 75%);background-position:0 0,0 12px,12px -12px,-12px 0;background-size:24px 24px}
    .rig3-stage canvas{display:block;width:min(74vw,280px);height:auto}
    .rig3-stage-card footer{min-height:38px;color:var(--muted,CanvasText);font-size:.8rem;line-height:1.45}
    .rig3-stage-card footer p{margin:0}
    .rig3-workbench{display:grid;gap:16px;margin-top:16px}
    .rig3-controls,.rig3-info{display:grid;gap:16px;padding:18px}
    .rig3-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
    .rig3-button,.rig3-select{min-height:38px;padding:8px 11px;border:1px solid var(--line,currentColor);border-radius:11px;background:var(--surface-cream,Canvas);color:var(--moss,CanvasText);font:inherit;font-size:.8rem;font-weight:750}
    .rig3-button{cursor:pointer}
    .rig3-button:hover,.rig3-button:focus-visible,.rig3-button[aria-pressed="true"]{border-color:var(--border-soft-gold,currentColor);background:var(--surface-gold-soft,Canvas);outline:none}
    .rig3-button--primary{background:var(--moss,CanvasText);color:var(--card,Canvas)}
    .rig3-button--frame{padding:6px 9px;font-size:.72rem}
    .rig3-button--frame[aria-current="true"]{background:var(--surface-gold-soft,Canvas);border-color:var(--gold,currentColor)}
    .rig3-slider{display:grid;grid-template-columns:minmax(90px,150px) 1fr 54px;gap:10px;align-items:center}
    .rig3-slider label{font-size:.78rem;font-weight:800;color:var(--moss,CanvasText)}
    .rig3-slider input{width:100%;accent-color:var(--moss,CanvasText)}
    .rig3-slider output{font-size:.76rem;color:var(--muted,CanvasText);font-variant-numeric:tabular-nums;text-align:right}
    .rig3-toggles{display:flex;flex-wrap:wrap;gap:10px 18px;color:var(--muted,CanvasText);font-size:.8rem}
    .rig3-toggles label{display:inline-flex;gap:7px;align-items:center}.rig3-toggles input{accent-color:var(--moss,CanvasText)}
    .rig3-timeline{display:grid;gap:8px;padding:12px;border:1px solid var(--line,currentColor);border-radius:14px;background:var(--surface-raised,Canvas)}
    .rig3-timeline input{width:100%;accent-color:var(--moss,CanvasText)}
    .rig3-track{display:flex;gap:2px;height:9px;border-radius:999px;overflow:hidden;background:var(--surface-cream,Canvas)}
    .rig3-track span{display:block;min-width:2px;background:color-mix(in srgb,var(--moss,CanvasText) 44%,transparent)}
    .rig3-track span:nth-child(even){background:color-mix(in srgb,var(--gold,goldenrod) 60%,transparent)}
    .rig3-frame-list{display:flex;flex-wrap:wrap;gap:6px}
    .rig3-code{margin:0;padding:12px 14px;border-radius:12px;background:var(--surface-raised,Canvas);color:var(--muted,CanvasText);font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap}
    .rig3-principles{display:grid;gap:8px;color:var(--muted,CanvasText);font-size:.86rem;line-height:1.5}
    .rig3-principles p{margin:0}.rig3-principles strong{color:var(--moss,CanvasText)}
    .rig3-error{padding:10px 12px;border:1px solid currentColor;border-radius:12px;color:crimson;background:Canvas;margin-bottom:16px}
    @media(min-width:780px){.rig3-compare{grid-template-columns:1fr 1fr}.rig3-workbench{grid-template-columns:minmax(0,1.45fr) minmax(300px,.55fr)}}
    @media(max-width:560px){.rig3-slider{grid-template-columns:1fr 50px}.rig3-slider label{grid-column:1/-1}}
  </style>
</head>
<body class="rig3-page">
<main class="rig3-shell">
  <header class="rig3-hero">
    <span class="rig3-kicker">Experimental · V3</span>
    <h1>Frames reais + secondary motion</h1>
    <p>O desenho continua a mandar. A mesh só dá vida aos intervalos — sem morph facial, sem crossfade e sem inventar bocas ou olhos.</p>
  </header>

  <div class="rig3-rule"><strong>Regra do V3:</strong> nos keyframes vemos sempre um WebP real do Míu. Entre eles, a mesh pode fazer movimentos pequenos de corpo/cabeça — bob, squash/stretch, micro-tilt e settle — mas nunca transformar uma expressão noutra.</div>
  <p class="rig3-error" id="rig3-error" hidden></p>

  <section class="rig3-compare" aria-label="Comparação V3">
    <article class="rig3-card rig3-stage-card">
      <header><h2>Frames puros</h2><span class="rig3-badge">Referência</span></header>
      <div class="rig3-stage"><canvas id="rig3-raw" width="576" height="576" aria-label="Míu usando apenas os keyframes reais"></canvas></div>
      <footer><p id="rig3-raw-status">A carregar…</p></footer>
    </article>

    <article class="rig3-card rig3-stage-card">
      <header><h2>V3 · mesmo frame + mesh</h2><span class="rig3-badge">60 fps</span></header>
      <div class="rig3-stage"><canvas id="rig3-mesh" width="576" height="576" aria-label="Míu com os mesmos keyframes e movimento secundário de mesh"></canvas></div>
      <footer><p id="rig3-mesh-status">A carregar…</p></footer>
    </article>
  </section>

  <section class="rig3-workbench">
    <article class="rig3-card rig3-controls">
      <h2>Testar</h2>
      <div class="rig3-row">
        <select id="rig3-sequence" class="rig3-select" aria-label="Sequência de animação">
          <option value="blink">Piscar · 4 poses reais</option>
          <option value="smile">Sorriso</option>
          <option value="tilt">Inclinação E → D</option>
          <option value="ear">Orelha / alerta</option>
          <option value="combo">Combo lento</option>
        </select>
        <button type="button" class="rig3-button rig3-button--primary" id="rig3-play" aria-pressed="false">Reproduzir</button>
        <button type="button" class="rig3-button" id="rig3-step">Próximo keyframe</button>
        <button type="button" class="rig3-button" id="rig3-reset">Início</button>
      </div>

      <div class="rig3-timeline">
        <input id="rig3-time" type="range" min="0" max="1000" value="0" aria-label="Timeline">
        <div class="rig3-track" id="rig3-track" aria-hidden="true"></div>
        <div class="rig3-frame-list" id="rig3-frame-list"></div>
      </div>

      <div class="rig3-slider">
        <label for="rig3-intensity">Mesh secundária</label>
        <input id="rig3-intensity" type="range" min="0" max="100" value="42">
        <output id="rig3-intensity-out">42%</output>
      </div>
      <div class="rig3-slider">
        <label for="rig3-speed">Velocidade</label>
        <input id="rig3-speed" type="range" min="50" max="180" value="100">
        <output id="rig3-speed-out">1.00×</output>
      </div>
      <div class="rig3-slider">
        <label for="rig3-settle">Settle</label>
        <input id="rig3-settle" type="range" min="0" max="100" value="55">
        <output id="rig3-settle-out">55%</output>
      </div>

      <div class="rig3-toggles">
        <label><input id="rig3-show-mesh" type="checkbox"> Mostrar malha</label>
        <label><input id="rig3-idle" type="checkbox" checked> Micro-movimento contínuo</label>
        <label><input id="rig3-exact" type="checkbox" checked> Keyframes exactos</label>
      </div>
    </article>

    <aside class="rig3-card rig3-info">
      <h2>O que estás a ver</h2>
      <div class="rig3-principles">
        <p><strong>Frame artístico:</strong> troca instantaneamente para outro WebP real.</p>
        <p><strong>Mesh:</strong> só desloca a mesma textura alguns pixels entre keyframes.</p>
        <p><strong>Keyframe exacto:</strong> com a opção ligada, a deformação cai a zero quando aterramos num frame.</p>
        <p><strong>Sem crossfade:</strong> nunca há dois pares de olhos ou duas bocas sobrepostos.</p>
      </div>
      <pre class="rig3-code" id="rig3-debug">—</pre>
    </aside>
  </section>
</main>

<script>
(() => {
  'use strict';

  const BASE = 'content/brand/miu/';
  const FRAMES = [
    ['calmo', 'miu-01-calmo.webp'],
    ['piscar início', 'miu-02-piscar-inicio.webp'],
    ['piscar fechado', 'miu-03-piscar-fechado.webp'],
    ['piscar fim', 'miu-04-piscar-fim.webp'],
    ['inclina esquerda', 'miu-05-inclina-esquerda.webp'],
    ['inclina direita', 'miu-06-inclina-direita.webp'],
    ['sorriso', 'miu-07-sorriso.webp'],
    ['orelha', 'miu-08-orelha.webp']
  ];

  // Cada passo é um keyframe artístico. A duração é o tempo até ao passo seguinte.
  // motion não muda a expressão: apenas descreve o "gesto" secundário nesse intervalo.
  const SEQUENCES = {
    blink: [
      {f:0, d:220, m:'anticipate'},
      {f:1, d:82,  m:'soft'},
      {f:2, d:72,  m:'compress'},
      {f:3, d:92,  m:'release'},
      {f:0, d:520, m:'settle'}
    ],
    smile: [
      {f:0, d:360, m:'anticipate'},
      {f:6, d:780, m:'happy'},
      {f:0, d:520, m:'settle'}
    ],
    tilt: [
      {f:0, d:260, m:'anticipate'},
      {f:4, d:620, m:'left'},
      {f:0, d:240, m:'through'},
      {f:5, d:620, m:'right'},
      {f:0, d:520, m:'settle'}
    ],
    ear: [
      {f:0, d:420, m:'anticipate'},
      {f:7, d:720, m:'alert'},
      {f:0, d:540, m:'settle'}
    ],
    combo: [
      {f:0, d:600, m:'idle'},
      {f:1, d:100, m:'soft'},
      {f:2, d:90,  m:'compress'},
      {f:3, d:110, m:'release'},
      {f:0, d:420, m:'settle'},
      {f:4, d:620, m:'left'},
      {f:0, d:300, m:'through'},
      {f:6, d:850, m:'happy'},
      {f:7, d:680, m:'alert'},
      {f:0, d:700, m:'settle'}
    ]
  };

  const $ = id => document.getElementById(id);
  const rawCanvas = $('rig3-raw');
  const meshCanvas = $('rig3-mesh');
  const rawCtx = rawCanvas.getContext('2d');
  const meshCtx = meshCanvas.getContext('2d');
  const errorBox = $('rig3-error');
  const rawStatus = $('rig3-raw-status');
  const meshStatus = $('rig3-mesh-status');
  const debug = $('rig3-debug');
  const sequenceSelect = $('rig3-sequence');
  const playBtn = $('rig3-play');
  const timeRange = $('rig3-time');
  const intensityRange = $('rig3-intensity');
  const speedRange = $('rig3-speed');
  const settleRange = $('rig3-settle');
  const showMesh = $('rig3-show-mesh');
  const idleToggle = $('rig3-idle');
  const exactToggle = $('rig3-exact');
  const track = $('rig3-track');
  const frameList = $('rig3-frame-list');

  const images = [];
  let playing = false;
  let animationClock = 0;
  let lastTs = 0;
  let manualScrub = false;
  let currentSequenceName = sequenceSelect.value;

  const GRID = 8;
  const verts = [];
  for (let gy = 0; gy <= GRID; gy++) {
    for (let gx = 0; gx <= GRID; gx++) {
      verts.push({x: gx / GRID, y: gy / GRID});
    }
  }

  function smoothstep(t){ return t*t*(3-2*t); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function easeOutBack(t){
    const c1=1.70158, c3=c1+1;
    return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);
  }

  function totalDuration(seq){ return seq.reduce((sum,s)=>sum+s.d,0); }

  function locate(seq, ms){
    const total = totalDuration(seq);
    const wrapped = ((ms % total) + total) % total;
    let acc = 0;
    for(let i=0;i<seq.length;i++){
      const end = acc + seq[i].d;
      if(wrapped < end || i === seq.length-1){
        return {index:i, step:seq[i], local:(wrapped-acc)/seq[i].d, start:acc, total, wrapped};
      }
      acc = end;
    }
    return {index:0,step:seq[0],local:0,start:0,total,wrapped:0};
  }

  function motionFor(kind, phase, tSec){
    // Todos os gestos regressam a zero nos limites do intervalo.
    // Logo: o frame artístico nunca é "morphado" para outro frame.
    const arch = Math.sin(Math.PI * clamp(phase,0,1));
    const p = smoothstep(clamp(phase,0,1));
    let tilt=0, bob=0, squash=0, side=0, ear=0;

    switch(kind){
      case 'anticipate':
        bob = 0.85 * arch;
        squash = -0.006 * arch;
        tilt = -0.35 * arch;
        break;
      case 'compress':
        bob = 0.55 * arch;
        squash = 0.014 * arch;
        break;
      case 'release':
        bob = -0.45 * arch;
        squash = -0.008 * arch;
        break;
      case 'happy':
        bob = -0.75 * arch;
        squash = -0.007 * arch;
        tilt = 0.45 * Math.sin(Math.PI*2*p);
        break;
      case 'left':
        bob = 0.45 * arch;
        side = -0.65 * arch;
        tilt = -0.42 * arch;
        break;
      case 'right':
        bob = 0.45 * arch;
        side = 0.65 * arch;
        tilt = 0.42 * arch;
        break;
      case 'through':
        bob = -0.4 * arch;
        squash = -0.005 * arch;
        break;
      case 'alert':
        bob = -0.7 * arch;
        squash = -0.006 * arch;
        ear = 0.95 * arch;
        break;
      case 'settle': {
        const decay = Math.exp(-4.2 * phase);
        const ring = Math.sin(phase * Math.PI * 4.2) * decay;
        bob = -0.7 * ring;
        squash = 0.006 * ring;
        tilt = 0.28 * ring;
        break;
      }
      case 'soft':
        bob = 0.25 * arch;
        break;
      case 'idle':
      default:
        break;
    }

    if(idleToggle.checked){
      // Muito pequeno e contínuo: mantém a imagem viva quando há hold.
      bob += Math.sin(tSec * 2.55) * 0.12;
      tilt += Math.sin(tSec * 1.35 + 0.7) * 0.08;
      squash += Math.sin(tSec * 2.0 + 1.3) * 0.0008;
    }
    return {tilt,bob,squash,side,ear};
  }

  function transformedVertices(motion, intensity, exactFactor){
    const out=[];
    const k = intensity * exactFactor;
    const rad = motion.tilt * Math.PI/180 * k;
    const cs=Math.cos(rad), sn=Math.sin(rad);

    for(const v of verts){
      let x=v.x-0.5;
      let y=v.y-0.5;

      // Global secondary movement (subtil). Os valores estão em unidades normalizadas.
      const sx = 1 - motion.squash*k*0.55;
      const sy = 1 + motion.squash*k;
      x *= sx;
      y *= sy;

      // Local softness: bochechas/parte inferior acompanham ligeiramente o bob.
      const lower = smoothstep(clamp((v.y-0.38)/0.5,0,1));
      const center = Math.exp(-Math.pow((v.x-0.5)/0.34,2));
      y += (motion.bob/192) * k * (0.55 + 0.45*lower);
      x += (motion.side/192) * k * (0.7 + 0.3*center);

      // Orelhas podem ter um micro-perk durante o frame "alerta".
      if(v.y < 0.30){
        const earZone = Math.max(
          Math.exp(-Math.pow((v.x-0.22)/0.15,2)),
          Math.exp(-Math.pow((v.x-0.78)/0.15,2))
        );
        y -= (motion.ear/192) * k * earZone * 0.85;
      }

      const rx=x*cs-y*sn;
      const ry=x*sn+y*cs;
      out.push({x:rx+0.5,y:ry+0.5});
    }
    return out;
  }

  function drawPlain(ctx,img){
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
    const s=Math.min(ctx.canvas.width,ctx.canvas.height)*0.82;
    const x=(ctx.canvas.width-s)/2;
    const y=(ctx.canvas.height-s)/2;
    ctx.drawImage(img,x,y,s,s);
  }

  function affineTriangle(ctx,img,s,d){
    const x0=s[0].x, y0=s[0].y, x1=s[1].x, y1=s[1].y, x2=s[2].x, y2=s[2].y;
    const u0=d[0].x, v0=d[0].y, u1=d[1].x, v1=d[1].y, u2=d[2].x, v2=d[2].y;
    const den = x0*(y1-y2)+x1*(y2-y0)+x2*(y0-y1);
    if(Math.abs(den)<1e-8) return;
    const a=(u0*(y1-y2)+u1*(y2-y0)+u2*(y0-y1))/den;
    const c=(u0*(x2-x1)+u1*(x0-x2)+u2*(x1-x0))/den;
    const e=(u0*(x1*y2-x2*y1)+u1*(x2*y0-x0*y2)+u2*(x0*y1-x1*y0))/den;
    const b=(v0*(y1-y2)+v1*(y2-y0)+v2*(y0-y1))/den;
    const dd=(v0*(x2-x1)+v1*(x0-x2)+v2*(x1-x0))/den;
    const f=(v0*(x1*y2-x2*y1)+v1*(x2*y0-x0*y2)+v2*(x0*y1-x1*y0))/den;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(u0,v0); ctx.lineTo(u1,v1); ctx.lineTo(u2,v2); ctx.closePath();
    ctx.clip();
    ctx.transform(a,b,c,dd,e,f);
    ctx.drawImage(img,0,0);
    ctx.restore();
  }

  function drawMesh(ctx,img,points){
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
    const s=Math.min(ctx.canvas.width,ctx.canvas.height)*0.82;
    const ox=(ctx.canvas.width-s)/2;
    const oy=(ctx.canvas.height-s)/2;
    const srcW=img.naturalWidth || 192;
    const srcH=img.naturalHeight || 192;

    const src=(gx,gy)=>({x:(gx/GRID)*srcW,y:(gy/GRID)*srcH});
    const dst=(gx,gy)=>{
      const p=points[gy*(GRID+1)+gx];
      return {x:ox+p.x*s,y:oy+p.y*s};
    };

    for(let gy=0;gy<GRID;gy++){
      for(let gx=0;gx<GRID;gx++){
        const s00=src(gx,gy), s10=src(gx+1,gy), s01=src(gx,gy+1), s11=src(gx+1,gy+1);
        const d00=dst(gx,gy), d10=dst(gx+1,gy), d01=dst(gx,gy+1), d11=dst(gx+1,gy+1);
        affineTriangle(ctx,img,[s00,s10,s11],[d00,d10,d11]);
        affineTriangle(ctx,img,[s00,s11,s01],[d00,d11,d01]);
      }
    }

    if(showMesh.checked){
      ctx.save();
      ctx.strokeStyle='rgba(72,82,56,.42)';
      ctx.lineWidth=1;
      for(let gy=0;gy<=GRID;gy++){
        ctx.beginPath();
        for(let gx=0;gx<=GRID;gx++){
          const p=dst(gx,gy);
          gx===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);
        }
        ctx.stroke();
      }
      for(let gx=0;gx<=GRID;gx++){
        ctx.beginPath();
        for(let gy=0;gy<=GRID;gy++){
          const p=dst(gx,gy);
          gy===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function exactFactorFor(local){
    if(!exactToggle.checked) return 1;
    // Aproxima-se de 0 nos extremos de cada intervalo: keyframe = arte exacta.
    // O miolo do intervalo recebe 100% da deformação secundária.
    const edge = Math.min(local,1-local);
    return smoothstep(clamp(edge/0.13,0,1));
  }

  function render(){
    if(images.length !== FRAMES.length) return;
    const seq=SEQUENCES[currentSequenceName];
    const loc=locate(seq,animationClock);
    const frameIndex=loc.step.f;
    const img=images[frameIndex];
    const intensity=Number(intensityRange.value)/100;
    const settle=Number(settleRange.value)/100;
    const motion=motionFor(loc.step.m,loc.local,loc.wrapped/1000);
    motion.bob*=0.55+settle*0.75;
    motion.squash*=0.55+settle*0.75;
    motion.tilt*=0.55+settle*0.75;
    const exactFactor=exactFactorFor(loc.local);

    drawPlain(rawCtx,img);
    const points=transformedVertices(motion,intensity,exactFactor);
    drawMesh(meshCtx,img,points);

    const frameName=FRAMES[frameIndex][0];
    rawStatus.textContent=`Frame ${frameIndex+1}/8 · ${frameName} · sem qualquer interpolação`;
    meshStatus.textContent=`Mesmo frame · gesto “${loc.step.m}” · mesh ${(intensity*exactFactor*100).toFixed(0)}% efectiva`;
    debug.textContent=JSON.stringify({
      sequence:currentSequenceName,
      keyframe:`${frameIndex+1} · ${frameName}`,
      interval:`${loc.index+1}/${seq.length}`,
      progress:Number(loc.local.toFixed(3)),
      secondary:{
        tilt:Number((motion.tilt*intensity*exactFactor).toFixed(3)),
        bob:Number((motion.bob*intensity*exactFactor).toFixed(3)),
        squash:Number((motion.squash*intensity*exactFactor).toFixed(4)),
        side:Number((motion.side*intensity*exactFactor).toFixed(3)),
        ear:Number((motion.ear*intensity*exactFactor).toFixed(3))
      },
      crossfade:false,
      facialMorph:false
    },null,2);

    timeRange.value=Math.round((loc.wrapped/loc.total)*1000);
    [...frameList.children].forEach((b,i)=>b.setAttribute('aria-current',String(i===loc.index)));
  }

  function rebuildTimeline(){
    const seq=SEQUENCES[currentSequenceName];
    const total=totalDuration(seq);
    track.innerHTML='';
    frameList.innerHTML='';
    seq.forEach((step,i)=>{
      const bar=document.createElement('span');
      bar.style.flex=String(step.d/total);
      track.appendChild(bar);

      const btn=document.createElement('button');
      btn.type='button';
      btn.className='rig3-button rig3-button--frame';
      btn.textContent=`${i+1}: ${FRAMES[step.f][0]}`;
      btn.addEventListener('click',()=>{
        let t=0; for(let n=0;n<i;n++) t+=seq[n].d;
        animationClock=t+0.01;
        playing=false; updatePlayButton(); render();
      });
      frameList.appendChild(btn);
    });
  }

  function updatePlayButton(){
    playBtn.textContent=playing?'Pausar':'Reproduzir';
    playBtn.setAttribute('aria-pressed',String(playing));
  }

  function tick(ts){
    if(!lastTs) lastTs=ts;
    const dt=Math.min(50,ts-lastTs);
    lastTs=ts;
    if(playing && !manualScrub){
      animationClock += dt * (Number(speedRange.value)/100);
    }
    render();
    requestAnimationFrame(tick);
  }

  sequenceSelect.addEventListener('change',()=>{
    currentSequenceName=sequenceSelect.value;
    animationClock=0;
    rebuildTimeline(); render();
  });
  playBtn.addEventListener('click',()=>{playing=!playing;updatePlayButton();});
  $('rig3-reset').addEventListener('click',()=>{animationClock=0;playing=false;updatePlayButton();render();});
  $('rig3-step').addEventListener('click',()=>{
    const seq=SEQUENCES[currentSequenceName];
    const loc=locate(seq,animationClock);
    let t=0;
    const next=(loc.index+1)%seq.length;
    for(let i=0;i<next;i++) t+=seq[i].d;
    animationClock=t+0.01;
    playing=false;updatePlayButton();render();
  });

  timeRange.addEventListener('pointerdown',()=>{manualScrub=true;});
  window.addEventListener('pointerup',()=>{manualScrub=false;});
  timeRange.addEventListener('input',()=>{
    const total=totalDuration(SEQUENCES[currentSequenceName]);
    animationClock=(Number(timeRange.value)/1000)*total;
    render();
  });

  for(const el of [intensityRange,speedRange,settleRange,showMesh,idleToggle,exactToggle]){
    el.addEventListener('input',()=>{
      $('rig3-intensity-out').textContent=`${intensityRange.value}%`;
      $('rig3-speed-out').textContent=`${(Number(speedRange.value)/100).toFixed(2)}×`;
      $('rig3-settle-out').textContent=`${settleRange.value}%`;
      render();
    });
  }

  Promise.all(FRAMES.map(([name,file])=>new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error(`Não foi possível carregar ${file}`));
    img.src=BASE+file;
  }))).then(loaded=>{
    images.push(...loaded);
    rebuildTimeline();
    render();
    requestAnimationFrame(tick);
  }).catch(err=>{
    errorBox.hidden=false;
    errorBox.textContent=err.message;
    rawStatus.textContent='Erro ao carregar os frames.';
    meshStatus.textContent='Erro ao carregar os frames.';
  });
})();
</script>
</body>
</html>