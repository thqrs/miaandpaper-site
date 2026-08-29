/*
 * Builds declarative mini-episodes for the isolated Míu sprite library.
 * The configurator does not load these files.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const libraryRoot = path.resolve(
    __dirname,
    '../site/content/brand/miu/experimental/library-v1'
);
const episodesRoot = path.join(libraryRoot, 'episodes');
const manifest = JSON.parse(fs.readFileSync(
    path.join(libraryRoot, 'library-manifest.json'),
    'utf8'
));
const availableSheets = new Set(Object.keys(manifest.sheets));
const availableBeats = new Map(Object.entries(manifest.sheets).map(([id, sheet]) => {
    const metadata = JSON.parse(fs.readFileSync(
        path.join(libraryRoot, sheet.metadata),
        'utf8'
    ));
    const rows = metadata.beats || metadata.variants || [];
    return [id, new Set(rows.map((row) => row.id))];
}));

const clip = (sheet, beat, durationMs, options = {}) => ({
    type: 'clip',
    layer: 'character',
    sheet,
    beat,
    durationMs,
    priority: 'story',
    interruptible: false,
    ...options
});
const fx = (sheet, beat, durationMs, options = {}) => ({
    type: 'overlay',
    layer: 'fx',
    sheet,
    beat,
    durationMs,
    blend: 'source-over',
    anchor: 'logical-cell-centre',
    ...options
});
const prop = (sheet, beat, durationMs, options = {}) => ({
    type: 'overlay',
    layer: 'prop',
    sheet,
    beat,
    durationMs,
    blend: 'source-over',
    ...options
});

const transitionVariants = {
    's01e01-borboleta-no-nariz': ['gaze-left-to-attention', 'sneeze-to-idle'],
    's01e02-o-novelo-rebelde': ['paw-pause-and-focus', 'awkward-to-idle'],
    's01e03-a-flor-teimosa': ['curious-head-tilt', 'delighted-to-idle'],
    's01e04-o-cracha-careta': ['ears-perk-forward', 'delighted-to-idle'],
    's01e05-a-caixa-e-minha': ['gaze-right-to-attention', 'surprise-to-idle'],
    's01e06-a-grande-corrida': ['quick-soft-surprise', 'tired-to-idle'],
    's01e07-chuva-de-confettis': ['paw-pause-and-focus', 'delighted-to-idle'],
    's01e08-o-catavento-hipnotico': ['curious-head-tilt', 'delighted-to-idle'],
    's01e09-a-encomenda-perfeita': ['blink-interrupted', 'awkward-to-idle'],
    's01e10-um-dia-na-oficina': ['ears-perk-forward', 'generic-one-shot-to-idle'],
    's01e11-a-coleccao-de-caretas': ['paw-pause-and-focus', 'delighted-to-idle'],
    's01e12-a-coroa-da-oficina': ['curious-head-tilt', 'delighted-to-idle'],
    's01e13-o-pompom-impossivel': ['gaze-left-to-attention', 'delighted-to-idle'],
    's01e14-a-carta-sem-palavras': ['paw-pause-and-focus', 'delighted-to-idle']
};

const episodes = [
    {
        id: 's01e01-borboleta-no-nariz',
        season: 1,
        episode: 1,
        title: 'A borboleta no nariz',
        logline: 'Míu segue uma borboleta, fica completamente hipnotizado e acaba por espirrar.',
        trigger: 'ambient-special',
        timeline: [
            clip('butterfly-and-miu', 'notice-butterfly', 420),
            fx('anime-attention-fx', 'attention-tick', 260, { startOffsetMs: 80 }),
            prop('butterfly-prop', 'flight-arc', 520),
            clip('butterfly-and-miu', 'track-flight', 460),
            clip('butterfly-and-miu', 'mesmerised-circle', 520),
            clip('butterfly-and-miu', 'nose-approach', 420),
            prop('butterfly-prop', 'landing', 340, { anchor: 'nose' }),
            clip('butterfly-and-miu', 'butterfly-on-nose', 360),
            clip('butterfly-and-miu', 'sneeze', 420, { priority: 'reaction' }),
            prop('butterfly-prop', 'sneeze-escape', 380),
            clip('butterfly-and-miu', 'amused-recovery', 440),
            fx('anime-sparkles-fx', 'paired-glints', 280, { anchor: 'head' })
        ]
    },
    {
        id: 's01e02-o-novelo-rebelde',
        season: 1,
        episode: 2,
        title: 'O novelo rebelde',
        logline: 'Um toque de pata transforma um novelo quieto numa pequena confusão.',
        trigger: 'ambient-special',
        timeline: [
            clip('yarn-ball', 'notice-yarn', 360),
            fx('anime-attention-fx', 'curiosity-dots', 240, { anchor: 'head' }),
            clip('yarn-ball', 'paw-tap', 380),
            clip('yarn-ball', 'track-roll', 430),
            clip('yarn-ball', 'two-paw-pounce', 420),
            clip('yarn-ball', 'tug-thread', 440),
            clip('yarn-ball', 'light-tangle', 480),
            fx('anime-sweat-drop-fx', 'classic-sweat-drop', 300, { anchor: 'head-right' }),
            clip('yarn-ball', 'comic-tumble', 520),
            clip('yarn-ball', 'proud-settle', 460),
            fx('anime-sparkles-fx', 'single-glint', 220, { anchor: 'paw' })
        ]
    },
    {
        id: 's01e03-a-flor-teimosa',
        season: 1,
        episode: 3,
        title: 'A flor teimosa',
        logline: 'Míu dobra uma flor de origami, engana-se, pensa e consegue abri-la.',
        trigger: 'craft-special',
        timeline: [
            clip('origami-flowers', 'inspect-paper', 380),
            clip('origami-flowers', 'hold-corners', 380),
            clip('origami-flowers', 'first-fold', 420),
            clip('origami-flowers', 'press-crease', 420),
            clip('origami-flowers', 'petal-folds', 480),
            clip('origami-flowers', 'puzzled-mistake', 440),
            fx('anime-attention-fx', 'question-pop', 300, { anchor: 'head' }),
            clip('origami-flowers', 'flower-opens', 480),
            fx('anime-sparkles-fx', 'three-star-arc', 380, { anchor: 'paper' }),
            clip('origami-flowers', 'bouquet-reveal', 520)
        ]
    },
    {
        id: 's01e04-o-cracha-careta',
        season: 1,
        episode: 4,
        title: 'O crachá da careta',
        logline: 'Míu ajuda a montar um crachá e reconhece a própria careta no resultado.',
        trigger: 'product-badges',
        timeline: [
            clip('product-badges-grimace', 'notice-blank-badge', 380),
            clip('product-badges-grimace', 'draw-grimace', 460),
            clip('product-badges-grimace', 'inspect-print', 420),
            fx('anime-attention-fx', 'question-pop', 240, { anchor: 'head' }),
            clip('product-badges-grimace', 'assemble-badge', 520),
            clip('product-badges-grimace', 'front-reveal', 420),
            clip('product-badges-grimace', 'badge-angles', 480),
            fx('anime-sparkles-fx', 'bright-amazement', 360, { anchor: 'badge' }),
            clip('product-badges-grimace', 'wear-and-present', 460),
            clip('product-badges-grimace', 'happy-recovery', 420)
        ]
    },
    {
        id: 's01e05-a-caixa-e-minha',
        season: 1,
        episode: 5,
        title: 'A caixa é minha',
        logline: 'Míu investiga uma caixa pequena, desaparece e reaparece onde menos se espera.',
        trigger: 'ambient-special',
        timeline: [
            clip('paper-box-hide', 'inspect-box', 360),
            clip('paper-box-hide', 'paw-inside', 360),
            clip('paper-box-hide', 'squeeze-in', 460),
            clip('paper-box-hide', 'ears-disappear', 420),
            clip('paper-box-hide', 'eyes-peek', 520),
            fx('anime-attention-fx', 'attention-tick', 240, { anchor: 'box' }),
            clip('paper-box-hide', 'surprise-pop', 400),
            fx('anime-attention-fx', 'radial-surprise', 260, { anchor: 'head' }),
            clip('paper-box-hide', 'box-tips', 420),
            clip('paper-box-hide', 'flattened-box-settle', 480)
        ]
    },
    {
        id: 's01e06-a-grande-corrida',
        season: 1,
        episode: 6,
        title: 'A grande corrida',
        logline: 'Um rolo de fita foge, Míu persegue-o e gasta toda a energia numa volta relâmpago.',
        trigger: 'ambient-special',
        timeline: [
            clip('tape-roll-chase', 'spot-roll', 320),
            clip('tape-roll-chase', 'paw-nudge', 340),
            clip('tape-roll-chase', 'track-and-trot', 380),
            clip('tape-roll-chase', 'two-paw-chase', 420),
            clip('zoomies', 'rear-wiggle', 260),
            clip('zoomies', 'launch-right', 300),
            clip('zoomies', 'fast-run', 520),
            fx('anime-impact-lines-fx', 'zoomies-streaks', 300, { anchor: 'body' }),
            clip('zoomies', 'skid-turn', 340),
            fx('anime-impact-lines-fx', 'curved-chase-lines', 260, { anchor: 'body' }),
            clip('zoomies', 'dash-left', 420),
            clip('zoomies', 'joyful-bound', 360),
            fx('anime-sweat-drop-fx', 'relieved-shrink', 260, { anchor: 'head' }),
            clip('yawn', 'mouth-opens', 320),
            clip('zoomies', 'happy-loaf', 500)
        ]
    },
    {
        id: 's01e07-chuva-de-confettis',
        season: 1,
        episode: 7,
        title: 'Chuva de confettis',
        logline: 'Míu descobre o furador, faz força e cria uma chuva de papel sem querer.',
        trigger: 'craft-special',
        timeline: [
            clip('hole-punch-confetti', 'discover-punch', 380),
            clip('hole-punch-confetti', 'feed-paper', 420),
            clip('hole-punch-confetti', 'begin-press', 420),
            clip('hole-punch-confetti', 'gentle-strain', 460),
            clip('hole-punch-confetti', 'confetti-pop', 360),
            fx('anime-attention-fx', 'exclamation-pop', 240, { anchor: 'head' }),
            clip('hole-punch-confetti', 'paws-up-surprise', 420),
            fx('anime-sparkles-fx', 'drifting-particles', 420, { anchor: 'body' }),
            clip('hole-punch-confetti', 'bat-confetti', 500),
            clip('hole-punch-confetti', 'delighted-settle', 500)
        ]
    },
    {
        id: 's01e08-o-catavento-hipnotico',
        season: 1,
        episode: 8,
        title: 'O catavento hipnótico',
        logline: 'Míu dobra um catavento, dá-lhe um toque e fica preso a seguir as voltas.',
        trigger: 'craft-special',
        timeline: [
            clip('paper-pinwheel', 'discover-paper', 360),
            clip('paper-pinwheel', 'hold-and-fold', 420),
            clip('paper-pinwheel', 'press-centre', 420),
            clip('paper-pinwheel', 'finish-pinwheel', 460),
            clip('paper-pinwheel', 'lift-pinwheel', 380),
            clip('paper-pinwheel', 'tentative-paw-tap', 360),
            clip('paper-pinwheel', 'mesmerised-spin', 620),
            fx('anime-sparkles-fx', 'orbiting-sparkles', 360, { anchor: 'pinwheel' }),
            clip('paper-pinwheel', 'delighted-settle', 480)
        ]
    },
    {
        id: 's01e09-a-encomenda-perfeita',
        season: 1,
        episode: 9,
        title: 'A encomenda perfeita',
        logline: 'Míu embrulha uma caixa, fica preso na fita e tenta manter a dignidade.',
        trigger: 'checkout-soft-special',
        timeline: [
            clip('gift-wrap', 'discover-box', 340),
            clip('gift-wrap', 'pull-paper-corners', 420),
            clip('gift-wrap', 'fold-paper', 460),
            clip('gift-wrap', 'pin-and-smooth', 440),
            clip('gift-wrap', 'thread-ribbon', 460),
            clip('gift-wrap', 'brief-tangle', 480),
            fx('anime-sweat-drop-fx', 'awkward-motion-ticks', 300, { anchor: 'head' }),
            fx('anime-blush-fx', 'shy-lines-blush', 300, { anchor: 'cheeks' }),
            clip('gift-wrap', 'pat-finished-bow', 420),
            fx('anime-sparkles-fx', 'single-glint', 240, { anchor: 'bow' }),
            clip('gift-wrap', 'present-gift', 500)
        ]
    },
    {
        id: 's01e10-um-dia-na-oficina',
        season: 1,
        episode: 10,
        title: 'Um dia na oficina',
        logline: 'Míu acompanha a máquina, carimba o papel e apresenta o pequeno resultado.',
        trigger: 'long-form-demo-only',
        timeline: [
            clip('cricut-helper', 'approach-machine', 360),
            clip('cricut-helper', 'tap-safe-button', 360),
            clip('cricut-helper', 'machine-wakes', 400),
            clip('cricut-helper', 'track-feed-mat', 520),
            clip('cricut-helper', 'paper-emerges', 460),
            clip('cricut-helper', 'lift-paper-flower', 420),
            clip('craft-stamp', 'discover-stamp', 340),
            clip('craft-stamp', 'align-on-paper', 380),
            clip('craft-stamp', 'two-paw-press', 460),
            clip('craft-stamp', 'lift-and-reveal', 420),
            clip('craft-stamp', 'present-print', 480),
            fx('anime-sparkles-fx', 'three-star-arc', 320, { anchor: 'paper' })
        ]
    },
    {
        id: 's01e11-a-coleccao-de-caretas',
        season: 1,
        episode: 11,
        title: 'A colecção de caretas',
        logline: 'Um autocolante cola-se à patinha do Míu e transforma-se numa pequena apresentação de caretas.',
        trigger: 'product-stickers',
        timeline: [
            clip('sticker-on-paw', 'touch-sticker', 340),
            prop('product-stickers-grimaces', 'playful-bleps', 360, { anchor: 'paw' }),
            clip('sticker-on-paw', 'sticker-clings', 380),
            clip('sticker-on-paw', 'gentle-shake', 420),
            fx('anime-attention-fx', 'question-pop', 240, { anchor: 'head' }),
            prop('product-stickers-grimaces', 'mischievous-squints', 360, { anchor: 'paw' }),
            clip('sticker-on-paw', 'try-other-paw', 420),
            prop('product-stickers-grimaces', 'limited-edition-mix', 520, { anchor: 'head-right' }),
            clip('sticker-on-paw', 'sticker-floats-off', 420),
            fx('anime-sparkles-fx', 'three-star-arc', 300, { anchor: 'head' }),
            clip('sticker-on-paw', 'paw-grooming', 440)
        ]
    },
    {
        id: 's01e12-a-coroa-da-oficina',
        season: 1,
        episode: 12,
        title: 'A coroa da oficina',
        logline: 'Míu escolhe flores de papel, monta uma coroa com as patinhas e tenta fingir que não está muito orgulhoso.',
        trigger: 'craft-special',
        timeline: [
            clip('paper-flower-crown', 'rainbow-crown-sequence', 1880),
            fx('anime-sparkles-fx', 'orbiting-sparkles', 360, { anchor: 'head' }),
            fx('anime-blush-fx', 'heart-blush', 360, { anchor: 'cheeks' })
        ]
    },
    {
        id: 's01e13-o-pompom-impossivel',
        season: 1,
        episode: 13,
        title: 'O pompom impossível',
        logline: 'Míu enrola a lã com muita concentração, perde uma patinha no fio e encontra um pompom perfeito.',
        trigger: 'craft-special',
        timeline: [
            clip('wool-pompom', 'notice-wool', 340),
            clip('wool-pompom', 'inspect-cardboard-rings', 380),
            clip('wool-pompom', 'begin-wrapping', 420),
            clip('wool-pompom', 'two-paw-wrapping', 460),
            clip('wool-pompom', 'paw-tangle', 440),
            fx('anime-sweat-drop-fx', 'classic-sweat-drop', 280, { anchor: 'head-right' }),
            clip('wool-pompom', 'pompom-appears', 440),
            clip('wool-pompom', 'bat-pompom', 500),
            clip('wool-pompom', 'proud-pompom', 480),
            fx('anime-sparkles-fx', 'paired-glints', 260, { anchor: 'paw' })
        ]
    },
    {
        id: 's01e14-a-carta-sem-palavras',
        season: 1,
        episode: 14,
        title: 'A carta sem palavras',
        logline: 'Míu dobra um envelope com as patinhas e descobre que um cartão em branco também pode ser uma surpresa.',
        trigger: 'craft-special',
        timeline: [
            clip('paper-envelope', 'inspect-square-paper', 340),
            clip('paper-envelope', 'align-corners', 360),
            clip('paper-envelope', 'first-fold', 400),
            clip('paper-envelope', 'press-crease', 420),
            clip('paper-envelope', 'fold-side-flaps', 440),
            clip('paper-envelope', 'close-envelope', 420),
            clip('paper-envelope', 'blank-card-surprise', 420),
            fx('anime-attention-fx', 'exclamation-pop', 240, { anchor: 'head' }),
            clip('paper-envelope', 'proud-envelope-reveal', 500),
            fx('anime-blush-fx', 'warm-dots-blush', 300, { anchor: 'cheeks' })
        ]
    }
];

fs.mkdirSync(episodesRoot, { recursive: true });

const summaries = [];
for (const episode of episodes) {
    const transitions = transitionVariants[episode.id] || [
        'blink-interrupted',
        'generic-one-shot-to-idle'
    ];
    const episodeTimeline = [
        clip('transition-idle-to-attention', transitions[0], 320, { priority: 'attention' }),
        ...episode.timeline,
        clip('transition-soft-recovery', transitions[1], 380, { priority: 'recovery' })
    ];
    const referencedSheets = [...new Set(episodeTimeline.map((step) => step.sheet))];
    const unknownSheets = referencedSheets.filter((sheet) => !availableSheets.has(sheet));
    if (unknownSheets.length) {
        throw new Error(`${episode.id}: folhas desconhecidas: ${unknownSheets.join(', ')}`);
    }
    const unknownBeats = episodeTimeline.filter((step) => (
        !availableBeats.get(step.sheet).has(step.beat)
    ));
    if (unknownBeats.length) {
        throw new Error(`${episode.id}: beats desconhecidos: ${unknownBeats.map(
            (step) => `${step.sheet}/${step.beat}`
        ).join(', ')}`);
    }

    const durationMs = episodeTimeline.reduce(
        (total, step) => total + Math.max(0, step.durationMs - (step.overlapMs || 0)),
        0
    );
    const missingSheets = episode.missingSheets || [];
    const document = {
        version: 1,
        kind: 'miu-mini-episode',
        id: episode.id,
        season: episode.season,
        episode: episode.episode,
        title: episode.title,
        logline: episode.logline,
        trigger: episode.trigger,
        productionIntegrated: false,
        durationMs,
        director: {
            priority: 'one-shot-story',
            interruptPolicy: 'finish-current-beat-then-yield',
            suppressQuantityReactions: true,
            returnTo: 'live-idle-for-current-context'
        },
        sheets: referencedSheets,
        timeline: episodeTimeline.map((step, index) => ({ order: index, ...step })),
        reducedMotion: {
            strategy: 'key-pose-sequence',
            framePolicy: 'first-middle-last-per-beat',
            keepEmotionAndProps: true,
            remove: ['bounce', 'overshoot', 'rapid-looping-fx']
        },
        optionalEnhancements: episode.optionalEnhancements || [],
        missingSheets,
        status: missingSheets.length ? 'playable-without-optional-bridges' : 'complete'
    };
    const filename = `${episode.id}.json`;
    fs.writeFileSync(
        path.join(episodesRoot, filename),
        `${JSON.stringify(document, null, 2)}\n`,
        'utf8'
    );
    summaries.push({
        id: episode.id,
        title: episode.title,
        file: filename,
        durationMs,
        status: document.status,
        missingSheets
    });
}

const episodeManifest = {
    version: 1,
    kind: 'miu-mini-series',
    name: 'Míu · Pequenos episódios da oficina · Temporada 1',
    productionIntegrated: false,
    playbackModel: 'idle -> attention -> episode beats + overlays -> organic recovery -> live idle',
    rules: {
        valueDefinesMood: true,
        changeDefinesReaction: true,
        episodesAreOneShots: true,
        quantityReactionPriorityDuringEpisode: 'queued-or-suppressed',
        neverMorphFaces: true,
        canonicalIdentityRequired: true,
        neverConvertToWebp: true
    },
    episodes: summaries
};
fs.writeFileSync(
    path.join(episodesRoot, 'episode-manifest.json'),
    `${JSON.stringify(episodeManifest, null, 2)}\n`,
    'utf8'
);

console.log(`Míu episodes: ${episodes.length} ficheiros.`);
