/*
 * Rebuilds the metadata for the isolated Míu 8x8 experimental library.
 * No production page imports this file or the generated library.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const libraryRoot = path.resolve(
    __dirname,
    '../site/content/brand/miu/experimental/library-v1'
);

const rowFrames = (row) => Array.from({ length: 8 }, (_, column) => [column, row]);
const slug = (value) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const emotions = [
    {
        id: 'ekman-happiness', file: 'emotions/miu-ekman-happiness-8x8.png', name: 'Alegria',
        rows: ['contentment', 'soft-smile', 'bright-eyes', 'playful-grin', 'delighted-smile', 'paw-wave', 'joyful-bounce', 'warm-recovery']
    },
    {
        id: 'ekman-sadness', file: 'emotions/miu-ekman-sadness-8x8.png', name: 'Tristeza suave',
        rows: ['quiet-neutral', 'soft-droop', 'lowered-gaze', 'small-sigh', 'watery-eyes', 'gentle-paw-comfort', 'softest-sadness', 'calm-recovery']
    },
    {
        id: 'ekman-anger', file: 'emotions/miu-ekman-anger-8x8.png', name: 'Zanga brincalhona',
        rows: ['tiny-annoyance', 'focused-frown', 'ear-turn', 'small-huff', 'firm-stare', 'paw-stamp', 'comic-indignation', 'release']
    },
    {
        id: 'ekman-fear', file: 'emotions/miu-ekman-fear-8x8.png', name: 'Medo seguro',
        rows: ['notice', 'uncertain-gaze', 'ears-back', 'small-recoil', 'wide-eyed-worry', 'paws-close', 'cute-startle', 'safe-recovery']
    },
    {
        id: 'ekman-surprise', file: 'emotions/miu-ekman-surprise-8x8.png', name: 'Surpresa',
        rows: ['subtle-noticing', 'eyes-widening', 'curious-double-take', 'open-mouth-surprise', 'upward-head-lift', 'paws-near-cheeks', 'delighted-amazement', 'attentive-recovery']
    },
    {
        id: 'ekman-disgust', file: 'emotions/miu-ekman-disgust-8x8.png', name: 'Desagrado cómico',
        rows: ['tiny-nose-wrinkle', 'one-eye-squint', 'subtle-recoil', 'turn-away', 'tiny-blep', 'paw-waft', 'comic-disgust', 'neutral-recovery']
    },
    {
        id: 'ekman-contempt', file: 'emotions/miu-ekman-contempt-8x8.png', name: 'Desdém suave',
        rows: ['half-lidded-glance', 'asymmetric-smirk', 'dismissive-tilt', 'knowing-blink', 'look-away', 'small-paw-flick', 'cute-really', 'soft-recovery']
    }
];

const stories = [
    {
        id: 'butterfly-and-miu', file: 'stories/miu-story-butterfly-sneeze-8x8.png', name: 'Borboleta e Míu',
        rows: ['notice-butterfly', 'track-flight', 'mesmerised-circle', 'gentle-paw-reach', 'nose-approach', 'butterfly-on-nose', 'sneeze', 'amused-recovery']
    },
    {
        id: 'yarn-ball', file: 'stories/miu-story-yarn-ball-8x8.png', name: 'Novelo',
        rows: ['notice-yarn', 'paw-tap', 'track-roll', 'two-paw-pounce', 'tug-thread', 'light-tangle', 'comic-tumble', 'proud-settle']
    },
    {
        id: 'scratch-behind-ear', file: 'stories/miu-story-scratch-behind-ear-8x8.png', name: 'Coçar atrás da orelha',
        rows: ['itch-begins', 'ear-twitch', 'rear-paw-lift', 'gentle-scratch', 'faster-scratch', 'blissful-hold', 'paw-lower', 'groom-and-settle']
    },
    {
        id: 'paper-scissors', file: 'stories/miu-story-paper-scissors-8x8.png', name: 'Tesouras de papel',
        rows: ['discover-safe-scissors', 'test-handles', 'first-snip', 'cut-short-line', 'focused-cutting', 'offcut-on-paw', 'reveal-shape', 'safe-set-down']
    },
    {
        id: 'cricut-helper', file: 'stories/miu-story-cricut-helper-8x8.png', name: 'Ajudante da Cricut',
        rows: ['approach-machine', 'tap-safe-button', 'machine-wakes', 'track-feed-mat', 'alert-lean', 'paper-emerges', 'lift-paper-flower', 'proud-presentation']
    },
    {
        id: 'origami-flowers', file: 'stories/miu-story-origami-flowers-8x8.png', name: 'Flores de origami',
        rows: ['inspect-paper', 'hold-corners', 'first-fold', 'press-crease', 'petal-folds', 'puzzled-mistake', 'flower-opens', 'bouquet-reveal'],
        backgroundProcessing: 'imagegen extraction attempted twice; connected-edge alpha mask applied without redrawing'
    },
    {
        id: 'push-and-break', file: 'stories/miu-story-push-break-paper-build-8x8.png', name: 'Empurrar e desmontar',
        rows: ['study-paper-build', 'cautious-reach', 'tiny-push', 'wobble', 'wide-eyed-freeze', 'harmless-collapse', 'guilty-paw', 'try-to-rebuild']
    },
    {
        id: 'zoomies', file: 'stories/miu-story-zoomies-8x8.png', name: 'Zoomies',
        rows: ['calm-crouch', 'rear-wiggle', 'launch-right', 'fast-run', 'skid-turn', 'dash-left', 'joyful-bound', 'happy-loaf']
    },
    {
        id: 'yawn', file: 'stories/miu-story-yawn-8x8.png', name: 'Bocejo',
        rows: ['sleepy-blink', 'mouth-opens', 'head-back', 'wide-yawn', 'paw-stretch', 'peak-yawn', 'mouth-closes', 'drowsy-idle']
    },
    {
        id: 'sneeze', file: 'stories/miu-story-sneeze-8x8.png', name: 'Espirro',
        rows: ['nose-tickle', 'nose-scrunch', 'eyes-close', 'inhale', 'cute-sneeze', 'follow-through', 'dazed-blink', 'embarrassed-recovery']
    },
    {
        id: 'ribbon-tangle', file: 'stories/miu-story-ribbon-tangle-8x8.png', name: 'Embrulhado em fita',
        rows: ['notice-ribbon', 'paw-tap', 'pull-ribbon', 'paw-loop', 'playful-tangle', 'wear-loop', 'wriggle-free', 'bow-pose']
    },
    {
        id: 'paper-box-hide', file: 'stories/miu-story-paper-box-hide-8x8.png', name: 'Esconder-se numa caixa',
        rows: ['inspect-box', 'paw-inside', 'squeeze-in', 'ears-disappear', 'eyes-peek', 'surprise-pop', 'box-tips', 'flattened-box-settle']
    },
    {
        id: 'tape-roll-chase', file: 'stories/miu-story-tape-roll-chase-8x8.png', name: 'Perseguir fita-cola',
        rows: ['spot-roll', 'paw-nudge', 'track-and-trot', 'two-paw-chase', 'direction-change', 'pounce', 'capture-roll', 'proud-pose']
    },
    {
        id: 'sticker-on-paw', file: 'stories/miu-story-sticker-on-paw-8x8.png', name: 'Autocolante na patinha',
        rows: ['touch-sticker', 'sticker-clings', 'gentle-shake', 'confused-look', 'try-other-paw', 'close-inspection', 'sticker-floats-off', 'paw-grooming']
    },
    {
        id: 'paper-plane', file: 'stories/miu-story-paper-plane-8x8.png', name: 'Avião de papel',
        rows: ['inspect-paper', 'align-fold', 'press-crease', 'shape-plane', 'hold-plane', 'gentle-throw', 'track-flight', 'proud-recovery']
    },
    {
        id: 'craft-stamp', file: 'stories/miu-story-craft-stamp-8x8.png', name: 'Carimbo artesanal',
        rows: ['discover-stamp', 'inspect-and-roll', 'align-on-paper', 'two-paw-press', 'gentle-strain', 'lift-and-reveal', 'inspect-inked-paw', 'present-print']
    },
    {
        id: 'paper-boat', file: 'stories/miu-story-paper-boat-8x8.png', name: 'Barco de papel',
        rows: ['discover-paper', 'first-folds', 'press-creases', 'open-boat', 'place-by-water', 'paw-nudge', 'watch-glide', 'mesmerised-settle']
    },
    {
        id: 'gift-wrap', file: 'stories/miu-story-gift-wrap-8x8.png', name: 'Embrulhar uma caixa',
        rows: ['discover-box', 'pull-paper-corners', 'fold-paper', 'pin-and-smooth', 'thread-ribbon', 'brief-tangle', 'pat-finished-bow', 'present-gift']
    },
    {
        id: 'hole-punch-confetti', file: 'stories/miu-story-hole-punch-confetti-8x8.png', name: 'Furador e confettis',
        rows: ['discover-punch', 'feed-paper', 'begin-press', 'gentle-strain', 'confetti-pop', 'paws-up-surprise', 'bat-confetti', 'delighted-settle'],
        generationDate: '2026-08-28'
    },
    {
        id: 'paper-pinwheel', file: 'stories/miu-story-paper-pinwheel-8x8.png', name: 'Catavento de papel',
        rows: ['discover-paper', 'hold-and-fold', 'press-centre', 'finish-pinwheel', 'lift-pinwheel', 'tentative-paw-tap', 'mesmerised-spin', 'delighted-settle'],
        generationDate: '2026-08-28'
    },
    {
        id: 'paper-flower-crown', file: 'stories/miu-story-paper-flower-crown-8x8.png', name: 'Coroa de flores de papel',
        rows: ['pink-crown-sequence', 'sunny-crown-sequence', 'blue-crown-sequence', 'purple-crown-sequence', 'rose-crown-sequence', 'teal-crown-sequence', 'rainbow-crown-sequence', 'festival-crown-sequence'],
        generationDate: '2026-08-28',
        backgroundProcessing: 'imagegen alpha extraction produced artefacts; exterior flood-fill alpha applied to the untouched generated sheet'
    },
    {
        id: 'wool-pompom', file: 'stories/miu-story-wool-pompom-8x8.png', name: 'Pompom de lã',
        rows: ['notice-wool', 'inspect-cardboard-rings', 'begin-wrapping', 'two-paw-wrapping', 'paw-tangle', 'pompom-appears', 'bat-pompom', 'proud-pompom'],
        generationDate: '2026-08-28',
        backgroundProcessing: 'transparent request produced checkerboard; exterior flood-fill alpha applied without redrawing'
    },
    {
        id: 'paper-envelope', file: 'stories/miu-story-paper-envelope-8x8.png', name: 'Envelope de papel',
        rows: ['inspect-square-paper', 'align-corners', 'first-fold', 'press-crease', 'fold-side-flaps', 'close-envelope', 'blank-card-surprise', 'proud-envelope-reveal'],
        generationDate: '2026-08-28',
        backgroundProcessing: 'imagegen semantic extraction separated black fur from black background; exterior checkerboard flood-fill completed alpha'
    }
];

const props = [
    {
        id: 'butterfly-prop', file: 'props/butterfly-flight-8x8.png', name: 'Borboleta independente',
        rows: ['wing-flap-a', 'wing-flap-b', 'hover', 'flight-arc', 'landing', 'perched-wings', 'sneeze-escape', 'gentle-idle-flight']
    }
];

const transitions = [
    {
        id: 'transition-idle-to-attention', file: 'transitions/miu-transition-idle-to-attention-8x8.png', name: 'Transição · Idle para atenção',
        rows: ['blink-interrupted', 'ears-perk-forward', 'gaze-left-to-attention', 'gaze-right-to-attention', 'curious-head-tilt', 'quick-soft-surprise', 'paw-pause-and-focus', 'micro-grimace-interrupted'],
        generationDate: '2026-08-28',
        backgroundProcessing: 'imagegen alpha extraction attempted twice; exterior flood-fill alpha applied without redrawing'
    },
    {
        id: 'transition-soft-recovery', file: 'transitions/miu-transition-soft-recovery-8x8.png', name: 'Transição · Recovery suave',
        rows: ['surprise-to-idle', 'delighted-to-idle', 'worried-to-idle', 'sad-soft-to-idle', 'awkward-to-idle', 'tired-to-idle', 'sneeze-to-idle', 'generic-one-shot-to-idle'],
        generationDate: '2026-08-28',
        backgroundProcessing: 'imagegen alpha extraction attempted twice; exterior flood-fill alpha applied without redrawing'
    }
];

const products = [
    {
        id: 'product-badges-grimace', file: 'products/miu-product-badges-grimace-8x8.png', name: 'Crachás · careta do Míu',
        rows: ['notice-blank-badge', 'draw-grimace', 'inspect-print', 'assemble-badge', 'front-reveal', 'badge-angles', 'wear-and-present', 'happy-recovery']
    },
    {
        id: 'product-stickers-grimaces', file: 'products/miu-product-stickers-grimaces-8x8.png', name: 'Autocolantes · caretas do Míu',
        rows: ['playful-bleps', 'mischievous-squints', 'surprised-oh', 'delighted-smiles', 'comic-grumpy', 'sleepy-yawns', 'curious-tilts', 'limited-edition-mix'],
        generationDate: '2026-08-28',
        backgroundProcessing: 'imagegen alpha extraction attempted twice; exterior flood-fill alpha applied without redrawing'
    }
];

const effects = [
    {
        id: 'anime-attention-fx', file: 'fx/anime-attention-fx-8x8.png', name: 'FX · Atenção e surpresa',
        rows: ['curiosity-dots', 'question-pop', 'attention-tick', 'ear-perk-lines', 'exclamation-pop', 'radial-surprise', 'delighted-sparkles', 'settle-fragments'],
        generationDate: '2026-08-28'
    },
    {
        id: 'anime-sparkles-fx', file: 'fx/anime-sparkles-fx-8x8.png', name: 'FX · Sparkles de alegria',
        rows: ['single-glint', 'paired-glints', 'star-twinkle', 'three-star-arc', 'orbiting-sparkles', 'bright-amazement', 'drifting-particles', 'fade-fragments'],
        generationDate: '2026-08-28'
    },
    {
        id: 'anime-watery-eyes-fx', file: 'fx/anime-watery-eyes-fx-8x8.png', name: 'FX · Olhos húmidos anime',
        rows: ['tiny-shine', 'glassy-reflection', 'waterline', 'wavy-shimmer', 'tear-sparkle', 'almost-crying-gloss', 'easing-waterline', 'clear-recovery'],
        componentBundle: 'paired-eye-overlay',
        generationDate: '2026-08-28'
    },
    {
        id: 'anime-sweat-drop-fx', file: 'fx/anime-sweat-drop-fx-8x8.png', name: 'FX · Gota anime',
        rows: ['nervous-glint', 'small-bead', 'growing-bead', 'classic-sweat-drop', 'sliding-drop', 'awkward-motion-ticks', 'relieved-shrink', 'fade-out'],
        generationDate: '2026-08-28'
    },
    {
        id: 'anime-blush-fx', file: 'fx/anime-blush-fx-8x8.png', name: 'FX · Rubor anime',
        rows: ['classic-soft-blush', 'warm-dots-blush', 'shy-lines-blush', 'flower-blush', 'heart-blush', 'squint-blush', 'spiral-blush', 'tear-blush'],
        componentBundle: 'paired-cheek-overlay',
        generationDate: '2026-08-28',
        backgroundProcessing: 'imagegen alpha extraction produced artefacts; exterior flood-fill alpha applied to the untouched generated sheet'
    },
    {
        id: 'anime-impact-lines-fx', file: 'fx/anime-impact-lines-fx-8x8.png', name: 'FX · Impacto e velocidade',
        rows: ['attention-ticks', 'upward-speed-lines', 'downward-drop-lines', 'curved-chase-lines', 'radial-surprise-burst', 'comic-impact-cloud', 'zoomies-streaks', 'settling-fragments'],
        generationDate: '2026-08-28',
        backgroundProcessing: 'transparent request produced checkerboard; exterior flood-fill alpha applied without redrawing'
    }
];

const entries = [
    ...emotions.map((entry) => ({ ...entry, category: 'emotion', defaultFrameDurationMs: 110 })),
    ...stories.map((entry) => ({ ...entry, category: 'story', defaultFrameDurationMs: 95 })),
    ...props.map((entry) => ({ ...entry, category: 'prop', defaultFrameDurationMs: 80 })),
    ...transitions.map((entry) => ({ ...entry, category: 'transition', defaultFrameDurationMs: 90 })),
    ...products.map((entry) => ({ ...entry, category: 'product', defaultFrameDurationMs: 100 })),
    ...effects.map((entry) => ({ ...entry, category: 'fx', defaultFrameDurationMs: 75 }))
];

const detector = {
    id: 'MiuSpriteGrid.detectConnectedGrid',
    anchorStrategy: 'median-anatomical-centres',
    isolatedComponents: true,
    expectedCellOccupancy: '64-of-64'
};

for (const entry of entries) {
    const pngPath = path.join(libraryRoot, entry.file);
    if (!fs.existsSync(pngPath)) {
        throw new Error(`PNG em falta para ${entry.id}: ${pngPath}`);
    }

    const rowItems = entry.rows.map((id, row) => ({
        row,
        id,
        ...(entry.category === 'emotion' ? { intensity: Number(((row + 1) / 8).toFixed(3)) } : {}),
        frames: rowFrames(row)
    }));
    const metadata = {
        version: 1,
        id: entry.id,
        name: `Míu · ${entry.name}`,
        category: entry.category,
        file: path.basename(entry.file),
        canonicalReference: '../../../miu-sprite.webp',
        format: 'png-rgba',
        background: 'transparent-alpha',
        columns: 8,
        rows: 8,
        frameCount: 64,
        readingOrder: 'row-major',
        detector: entry.category === 'fx' ? {
            ...detector,
            anchorStrategy: 'logical-cell-centre',
            logicalCellBundle: true,
            componentBundle: entry.componentBundle || 'single-effect'
        } : detector,
        defaultFrameDurationMs: entry.defaultFrameDurationMs,
        [entry.category === 'emotion' ? 'variants' : 'beats']: rowItems,
        generation: {
            mode: 'built-in-imagegen-derived',
            date: entry.generationDate || '2026-08-27',
            canonicalIdentityLocked: true,
            promptProfile: entry.category === 'emotion'
                ? 'ekman-varied-degrees-v1'
                : `miu-${entry.category}-8x8-v1`,
            backgroundProcessing: entry.backgroundProcessing || 'built-in-imagegen-alpha-extraction'
        }
    };
    const metadataPath = pngPath.replace(/\.png$/i, '.json');
    fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

const sheets = Object.fromEntries(entries.map((entry) => [entry.id, {
    file: entry.file.replace(/\\/g, '/'),
    metadata: entry.file.replace(/\.png$/i, '.json').replace(/\\/g, '/'),
    name: entry.name,
    category: entry.category,
    status: 'generated-validated'
}]));

const manifest = {
    version: 1,
    kind: 'miu-generated-sprite-library',
    name: 'Míu · Biblioteca experimental 8×8 · V1',
    canonicalReference: '../../miu-sprite.webp',
    productionIntegrated: false,
    contract: {
        columns: 8,
        rows: 8,
        frameCount: 64,
        format: 'png-rgba',
        background: 'transparent-alpha',
        detector: 'MiuSpriteGrid.detectConnectedGrid',
        anchorStrategy: 'median-anatomical-centres',
        neverConvertToWebp: true
    },
    totals: {
        sheets: entries.length,
        frames: entries.length * 64,
        emotions: emotions.length,
        stories: stories.length,
        props: props.length,
        transitions: transitions.length,
        products: products.length,
        fx: effects.length
    },
    sheets,
    validation: {
        date: '2026-08-28',
        method: 'alpha-channel plus 8x8 non-empty logical-cell scan',
        result: `${entries.length} sheets, ${entries.length * 64} non-empty cells, genuine alpha, zero WebP`
    }
};
fs.writeFileSync(
    path.join(libraryRoot, 'library-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
);

const queue = {
    version: 1,
    status: {
        state: 'episodes-expansion-in-progress',
        updatedAt: '2026-08-28',
        generatedSheets: entries.length,
        generatedFrames: entries.length * 64
    },
    references: {
        canonicalIdentity: '../../miu-sprite.webp',
        validatedGridLayout: '../quantity-rig-v4/miu-v5-idle-attention-8x8.png'
    },
    commonPrompt: 'Derive every image from the canonical Míu identity reference. Preserve markings, eyes, proportions, ears, whiskers, paws and handmade illustration. Create exactly 8 columns by 8 rows, 64 separate stickers with transparent gutters and genuine PNG alpha. Read left-to-right and top-to-bottom. No text, borders, backgrounds, face morphing or redesign.',
    pending: [
        {
            id: 'paper-lantern',
            category: 'story',
            target: 'stories/miu-story-paper-lantern-8x8.png',
            reason: 'first generation returned seven columns; needs a new exact 8x8 composition'
        },
        {
            id: 'rolling-pencil',
            category: 'story',
            target: 'stories/miu-story-rolling-pencil-8x8.png',
            reason: 'first generation returned seven columns and six rows; needs a new exact 8x8 composition'
        },
        {
            id: 'washi-tape',
            category: 'story',
            target: 'stories/miu-story-washi-tape-8x8.png',
            reason: 'first generation returned six columns and seven rows; needs a new exact 8x8 composition'
        },
        {
            id: 'paper-card-tower',
            category: 'story',
            target: 'stories/miu-story-paper-card-tower-8x8.png',
            reason: 'first generation returned six columns and seven rows; needs a new exact 8x8 composition'
        },
        {
            id: 'paper-scrap-nest',
            category: 'story',
            target: 'stories/miu-story-paper-scrap-nest-8x8.png',
            reason: 'first generation returned seven columns; needs a new exact 8x8 composition'
        },
        {
            id: 'ribbon-bow',
            category: 'story',
            target: 'stories/miu-story-ribbon-bow-8x8.png',
            reason: 'first generation returned seven columns and seven rows; needs a new exact 8x8 composition'
        },
        {
            id: 'paw-print-stamp',
            category: 'story',
            target: 'stories/miu-story-paw-print-stamp-8x8.png',
            reason: 'first generation returned seven columns; needs a new exact 8x8 composition'
        },
        {
            id: 'product-gift-tags-miu-faces',
            category: 'product',
            target: 'products/miu-product-gift-tags-faces-8x8.png',
            reason: 'first generation returned eight columns but only seven rows; needs a new exact 8x8 composition'
        }
    ],
    completed: entries.map(({ id, category, file }) => ({ id, category, target: file })),
    rejectedCandidates: [
        {
            id: 'paper-garland',
            reason: 'Both generations returned seven columns; excluded because the library contract requires exact 8x8.',
            includedInManifest: false
        },
        {
            id: 'wool-pompom',
            reason: 'First two generations returned seven columns; a later layout-guided 8x8 generation replaced them.',
            includedInManifest: false,
            supersededBy: 'stories/miu-story-wool-pompom-8x8.png'
        },
        {
            id: 'paper-flower-crown',
            reason: 'First two candidates returned seven columns; a third clean 8x8 generation replaced them.',
            includedInManifest: false,
            supersededBy: 'stories/miu-story-paper-flower-crown-8x8.png'
        },
        {
            id: 'paper-lantern',
            reason: 'Initial generation returned seven columns; excluded because the library contract requires exact 8x8.',
            includedInManifest: false
        },
        {
            id: 'rolling-pencil',
            reason: 'Initial generation returned seven columns and six rows; excluded because the library contract requires exact 8x8.',
            includedInManifest: false
        },
        {
            id: 'washi-tape',
            reason: 'Initial generation returned six columns and seven rows; excluded because the library contract requires exact 8x8.',
            includedInManifest: false
        },
        {
            id: 'paper-card-tower',
            reason: 'Initial generation returned six columns and seven rows; excluded because the library contract requires exact 8x8.',
            includedInManifest: false
        },
        {
            id: 'paper-scrap-nest',
            reason: 'Initial generation returned seven columns; excluded because the library contract requires exact 8x8.',
            includedInManifest: false
        },
        {
            id: 'ribbon-bow',
            reason: 'Initial generation returned seven columns and seven rows; excluded because the library contract requires exact 8x8.',
            includedInManifest: false
        },
        {
            id: 'paw-print-stamp',
            reason: 'Initial generation returned seven columns; excluded because the library contract requires exact 8x8.',
            includedInManifest: false
        },
        {
            id: 'product-gift-tags-miu-faces',
            reason: 'Initial generation returned eight columns but only seven rows; excluded because the library contract requires exact 8x8.',
            includedInManifest: false
        }
    ]
};
fs.writeFileSync(
    path.join(libraryRoot, 'generation-queue.json'),
    `${JSON.stringify(queue, null, 2)}\n`,
    'utf8'
);

console.log(`Míu library metadata: ${entries.length} sheets / ${entries.length * 64} frames.`);
