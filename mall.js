// Shopping-agent mall for the home page: a bright multi-level mall with escalators and shoppers,
// an ice rink in the atrium with the bio printed under the ice, skaters gliding over it,
// and a cart-riding shopping agent that searches random stores in exactly five seconds.
(() => {
    const page = document.querySelector('.single-page');
    const card = document.querySelector('.card');
    const spacer = document.getElementById('mall-spacer');
    const bgCanvas = document.getElementById('mall-bg');
    const fgCanvas = document.getElementById('mall-fg');
    if (!page || !card || !spacer || !bgCanvas || !fgCanvas) return;
    const bg = bgCanvas.getContext('2d');
    const fg = fgCanvas.getContext('2d');
    const scene = document.createElement('canvas');     // static mall, drawn once per layout
    const frost = document.createElement('canvas');     // ice surface drawn over the bio

    const bubble = document.getElementById('agent-bubble');
    const askBox = bubble.querySelector('.bubble-ask');
    const answerBox = bubble.querySelector('.bubble-answer');
    const answerSub = bubble.querySelector('.bubble-sub');
    const form = document.getElementById('agent-form');
    const input = document.getElementById('agent-input');
    const againBtn = document.getElementById('agent-again');
    const chip = document.getElementById('agent-chip');
    const status = document.getElementById('agent-status');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Every store is a section of a (hypothetical) paper.
    const STORES = [
        ['ABSTRACT', '#be185d'], ['INTRODUCTION', '#1d4ed8'], ['LITERATURE REVIEW', '#b45309'],
        ['THEORY', '#047857'], ['HYPOTHESES', '#c2410c'], ['DATA', '#6d28d9'],
        ['METHODS', '#0e7490'], ['MODEL', '#b91c1c'], ['IDENTIFICATION', '#15803d'],
        ['RESULTS', '#a21caf'], ['ROBUSTNESS', '#a16207'], ['MECHANISMS', '#0369a1'],
        ['HETEROGENEITY', '#9d174d'], ['DISCUSSION', '#4338ca'], ['LIMITATIONS', '#92400e'],
        ['CONCLUSION', '#065f46'], ['REFERENCES', '#7c2d12'], ['APPENDIX', '#5b21b6'],
        ['TABLES', '#155e75'], ['FIGURES', '#991b1b'], ['FOOTNOTES', '#166534'],
        ['ACKNOWLEDGMENTS', '#86198f'], ['EXTENSIONS', '#1e40af'], ['ONLINE APPENDIX', '#854d0e']
    ];
    const POPS = ['only text', 'just equations', 'a footnote', 'Table 3', 'p < 0.05',
        'more papers', 'citations', 'nope', 'a lit review', 'Figure 2'];
    const FLOOR_PAD = 40, SLAB = 14, BOT_H = 130;
    const SEARCH_MS = 5000, INSIDE_MS = 320, RETURN_MS = 900;

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    let vw = 0, vh = 0, W = 0, H = 0, dpr = 1, mobile = false, s1 = 1;
    let rink = null, track = null, atrium = null, stores = [], escalators = [], walkers = [], personScale = 1;
    let time = 0, started = false, busy = false;
    const A = { x: 0, y: 0, s: 1, alpha: 0, face: 1, dist: 0, speed: 0, lift: 0, prop: 0, mood: 'happy', paper: false };
    const queue = [], trail = [], pops = [];

    function rr(c, x, y, w, h, r) {
        r = Math.max(0, Math.min(r, w / 2, h / 2));
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }

    function line(c, x1, y1, x2, y2) {
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
    }

    function circle(c, x, y, r) {
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
    }

    function fitText(c, text, maxW, size, weight) {
        let fs = size;
        c.font = `${weight} ${fs}px Inter, sans-serif`;
        while (c.measureText(text).width > maxW && fs > 6) {
            fs -= 0.5;
            c.font = `${weight} ${fs}px Inter, sans-serif`;
        }
    }

    // ---------- people (skaters, shoppers, escalator riders) ----------
    const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
    const JACKET = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    const PANTS = ['#1e3a8a', '#111827', '#4b5563', '#7c2d12', '#065f46', '#be185d'];
    const HATS = ['beanie', 'earmuffs', 'hair', 'beanie', 'cap', 'hair'];
    function makePerson(rnd, i) {
        const pick = arr => arr[Math.floor(rnd() * arr.length)];
        return {
            skin: pick(SKIN), jacket: JACKET[i % JACKET.length], pants: pick(PANTS),
            hat: HATS[i % HATS.length], hatColor: pick(JACKET), scarf: pick(JACKET),
            bag: pick(JACKET), kid: i % 4 === 3
        };
    }

    // mode: 'skate' (gliding, leaning), 'walk' (scissor legs, shopping bag) or 'stand'
    function drawPerson(c, p, x, y, scale, face, phase, mode, tilt = 0) {
        c.save();
        c.translate(x, y);
        c.scale(scale * face * (p.kid ? 0.78 : 1), scale * (p.kid ? 0.78 : 1));
        c.fillStyle = 'rgba(15,23,42,0.16)';
        c.beginPath();
        c.ellipse(0, 1, 10, 2.5, 0, 0, Math.PI * 2);
        c.fill();
        c.rotate(tilt);

        const str = Math.sin(phase);
        const feet = mode === 'skate'
            ? [{ x: 5 * str, y: -Math.max(0, -str) * 3 }, { x: -5 * str, y: -Math.max(0, str) * 3 }]
            : mode === 'walk' ? [{ x: 4 * str, y: 0 }, { x: -4 * str, y: 0 }] : [{ x: 2.5, y: 0 }, { x: -2.5, y: 0 }];
        c.lineCap = 'round';
        c.strokeStyle = p.pants;
        c.lineWidth = 3.5;
        feet.forEach(f => line(c, 0, -15, f.x, f.y - 3));
        feet.forEach(f => {
            if (mode === 'skate') {
                c.fillStyle = '#f8fafc';
                c.fillRect(f.x - 2, f.y - 5, 5, 3.5);
                c.strokeStyle = '#64748b';
                c.lineWidth = 1;
                line(c, f.x - 3, f.y - 0.5, f.x + 4, f.y - 0.5);
            } else {
                c.fillStyle = '#292524';
                c.fillRect(f.x - 2, f.y - 3, 5.5, 3);
            }
        });

        c.translate(0, -15);
        c.rotate(mode === 'skate' ? 0.18 : 0.03);
        const arm = mode === 'stand' ? 0 : Math.sin(phase) * 0.4;
        c.strokeStyle = p.jacket;
        c.lineWidth = 3;
        if (mode === 'skate') line(c, 0, -10, -8 * Math.cos(arm), -6 - 3 * Math.sin(arm));
        else line(c, 0, -10, -2 - 3 * Math.sin(arm), 0);
        c.fillStyle = p.jacket;
        rr(c, -4.5, -13, 9, 14, 3.5);
        c.fill();
        if (mode === 'skate') {
            line(c, 0, -10, 9 * Math.cos(arm), -6 + 3 * Math.sin(arm));
        } else {
            const hx = 2 + 3 * Math.sin(arm);
            line(c, 0, -10, hx, 0);
            if (mode === 'walk') {
                c.fillStyle = p.bag;
                c.fillRect(hx - 3, 0, 7, 8);
                c.strokeStyle = 'rgba(0,0,0,0.35)';
                c.lineWidth = 0.8;
                line(c, hx - 1, 0, hx + 2, -2);
            }
        }
        c.fillStyle = p.scarf;
        c.fillRect(-4.5, -13, 9, 3);
        if (mode === 'skate') {
            c.beginPath();
            c.moveTo(-3, -12.5);
            c.lineTo(-11, -12 + Math.sin(time * 8 + phase) * 2);
            c.lineTo(-10, -9);
            c.closePath();
            c.fill();
        }

        c.fillStyle = p.skin;
        circle(c, 0.5, -18, 4.5);
        c.fillStyle = p.hatColor;
        if (p.hat === 'beanie') {
            c.beginPath();
            c.arc(0.5, -18.5, 4.9, Math.PI, Math.PI * 2);
            c.fill();
            c.fillStyle = '#fff';
            circle(c, 0.5, -24.2, 1.9);
        } else if (p.hat === 'cap') {
            c.beginPath();
            c.arc(0.5, -18.5, 4.8, Math.PI, Math.PI * 2);
            c.fill();
            c.fillRect(1, -19.5, 6.5, 1.6);
        } else {
            c.fillStyle = '#3f2a1d';
            c.beginPath();
            c.arc(0.5, -18.6, 4.8, Math.PI * 0.95, Math.PI * 2.05);
            c.fill();
            c.fillRect(-4.2, -19, 2.5, 6);
            if (p.hat === 'earmuffs') {
                c.strokeStyle = p.hatColor;
                c.lineWidth = 1.4;
                c.beginPath();
                c.arc(0.5, -18, 5.4, Math.PI * 1.05, Math.PI * 1.95);
                c.stroke();
                c.fillStyle = p.hatColor;
                circle(c, -3.8, -17.5, 2);
            }
        }
        c.restore();
    }

    // ---------- layout ----------
    function layout() {
        mobile = getComputedStyle(page).position !== 'fixed';
        vw = document.documentElement.clientWidth;
        vh = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        [bgCanvas, fgCanvas].forEach(cv => {
            cv.width = Math.round(vw * dpr);
            cv.height = Math.round(vh * dpr);
        });

        const padX = mobile ? 20 : 70, padY = mobile ? 36 : 50;
        const Lh = mobile ? 160 : clamp((vh - FLOOR_PAD - 60) / 4, 120, 190);
        const storeH = Lh - SLAB;
        spacer.style.height = mobile ? FLOOR_PAD + Lh + storeH + padY + 20 + 'px' : '';

        const sy = window.scrollY;
        const cr = card.getBoundingClientRect();
        const cardBox = { x: cr.left, y: cr.top + sy, w: cr.width, h: cr.height };
        rink = { x: cardBox.x - padX, y: cardBox.y - padY, w: cardBox.w + 2 * padX, h: cardBox.h + 2 * padY, r: mobile ? 28 : 60 };
        track = {
            x: cardBox.x - padX * 0.5, y: cardBox.y - padY * 0.2,
            w: cardBox.w + padX, h: cardBox.h + padY * 0.8, r: clamp(Math.min(padX, padY) * 0.6, 10, 36)
        };
        W = vw;
        H = mobile ? spacer.getBoundingClientRect().bottom + sy : vh;
        s1 = mobile ? 0.8 : clamp(vh / 860, 0.75, 1.05);

        // Levels stack from the ground up. Where a level crosses the atrium it only has side wings.
        const m = mobile ? 10 : 20;
        atrium = { x0: rink.x - m, x1: rink.x + rink.w + m, top: 0, bottom: H };
        const levels = [];
        for (let k = 0; ; k++) {
            const fy = H - FLOOR_PAD - k * Lh, top = fy - storeH;
            if (top < 8) break;
            const crosses = fy + SLAB > rink.y - m && top < rink.y + rink.h + m;
            if (!crosses && fy < rink.y) atrium.top = Math.max(atrium.top, fy + SLAB);
            if (!crosses && fy > rink.y) atrium.bottom = Math.min(atrium.bottom, top);
            levels.push({ k, fy, top, crosses });
        }

        // Escalators zigzag up one column: beside the atrium on desktop, at the left edge on phones.
        const escW = clamp(Lh * 0.8, 110, 160);
        const escX = mobile ? 8 : atrium.x0 - escW;
        escalators = [];
        if (escX >= 0) {
            levels.forEach((lv, i) => {
                const up = levels[i + 1];
                if (!up || (mobile && up.crosses)) return;
                const left = lv.k % 2 === 0;
                escalators.push({
                    k: lv.k, x0: escX, x1: escX + escW,
                    bx: left ? escX + 10 : escX + escW - 10, by: lv.fy,
                    tx: left ? escX + escW - 10 : escX + 10, ty: up.fy
                });
            });
        }

        stores = [];
        levels.forEach(lv => {
            let segs = lv.crosses ? [[0, atrium.x0], [atrium.x1, W]] : [[0, W]];
            if (escalators.some(e => e.k === lv.k)) {
                segs = segs.flatMap(([a, b]) => [[a, Math.min(b, escX)], [Math.max(a, escX + escW), b]]).filter(([a, b]) => b > a);
            }
            segs.forEach(([a, b]) => {
                if (b - a < 100) return;
                const n = Math.max(1, Math.round((b - a) / 150)), w = (b - a) / n;
                for (let i = 0; i < n; i++) {
                    const [name, color] = STORES[stores.length % STORES.length];
                    stores.push({ x: a + i * w, w, top: lv.top, fy: lv.fy, h: storeH, level: lv.k, name, color, glow: 0, seed: stores.length * 7919 + 13 });
                }
            });
        });
        renderScene();
        personScale = (stores[0] ? stores[0].doorH : 80) * 0.68 / 38;

        // shoppers strolling along each level
        const rnd = seeded(77);
        walkers = [];
        let run = null;
        const runs = [];
        stores.forEach(st => {
            if (run && run.level === st.level && Math.abs(run.b - st.x) < 1) run.b = st.x + st.w;
            else runs.push(run = { level: st.level, a: st.x, b: st.x + st.w, fy: st.fy });
        });
        runs.forEach((r, i) => {
            const n = Math.min(3, Math.floor((r.b - r.a) / 220) + 1);
            for (let j = 0; j < n; j++) {
                walkers.push({
                    a: r.a + 12, b: r.b - 12, fy: r.fy - 2, x: r.a + (r.b - r.a) * rnd(),
                    dir: rnd() < 0.5 ? -1 : 1, speed: 22 + rnd() * 18, pause: 0, phase: rnd() * 6,
                    p: makePerson(rnd, i * 3 + j + 1)
                });
            }
        });

        if (started && !busy && queue.length === 0) Object.assign(A, chip.hidden ? front() : side());
    }

    // centre stage (where the agent asks) and the side spot it retreats to
    const front = () => ({ x: W / 2, y: H - 10, s: s1 });
    const side = () => {
        if (mobile) return front();
        return { x: W - atrium.x1 >= 130 ? (atrium.x1 + W) / 2 : W - 60, y: H - 10, s: s1 };
    };
    const doorOf = i => () => {
        const st = stores[i] || stores[0];
        return { x: st.x + st.w / 2, y: st.fy - 1, s: st.doorH * 0.9 / BOT_H };
    };

    // ---------- static scene ----------
    function renderScene() {
        scene.width = Math.round(W * dpr);
        scene.height = Math.round(H * dpr);
        const c = scene.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.fillStyle = '#ece6dc';
        c.fillRect(0, 0, W, H);

        // daylight skylight above the top level
        const skyBottom = stores.length ? Math.min(...stores.map(s => s.top)) - 4 : 0;
        if (skyBottom > 20) {
            const sky = c.createLinearGradient(0, 0, 0, skyBottom);
            sky.addColorStop(0, '#93c5fd');
            sky.addColorStop(1, '#dbeafe');
            c.fillStyle = sky;
            c.fillRect(0, 0, W, skyBottom);
            c.fillStyle = 'rgba(255,255,255,0.85)';
            const rnd = seeded(5);
            for (let i = 0; i < W / 260; i++) {
                const cx = rnd() * W, cy = skyBottom * (0.25 + rnd() * 0.4);
                [[0, 0, 16], [14, 4, 12], [-14, 5, 11], [26, 8, 9]].forEach(([dx, dy, r]) => circle(c, cx + dx, cy + dy, r));
            }
            c.strokeStyle = '#f8fafc';
            c.lineWidth = 3;
            for (let x = 0; x < W; x += 80) line(c, x, 0, x, skyBottom);
            line(c, 0, skyBottom * 0.5, W, skyBottom * 0.5);
            c.fillStyle = '#d6cfc4';
            c.fillRect(0, skyBottom - 5, W, 5);
        }

        // atrium: tiled floor around the rink
        c.fillStyle = '#e2dbd0';
        c.fillRect(atrium.x0, atrium.top, atrium.x1 - atrium.x0, atrium.bottom - atrium.top);
        c.strokeStyle = 'rgba(0,0,0,0.05)';
        c.lineWidth = 1;
        for (let x = atrium.x0; x < atrium.x1; x += 40) line(c, x, atrium.top, x, atrium.bottom);
        for (let y = atrium.top; y < atrium.bottom; y += 40) line(c, atrium.x0, y, atrium.x1, y);

        // banner hanging over the rink
        const gap = rink.y - atrium.top;
        if (gap > 80) {
            const text = 'THE PAPER MALL', bh = 40, by = atrium.top + Math.min(36, (gap - bh) / 2);
            c.font = '800 18px Inter, sans-serif';
            const bw = c.measureText(text).width + 56, bx = W / 2 - bw / 2;
            c.strokeStyle = '#78716c';
            c.lineWidth = 1.5;
            line(c, bx + 22, atrium.top, bx + 22, by);
            line(c, bx + bw - 22, atrium.top, bx + bw - 22, by);
            c.fillStyle = '#1d4ed8';
            rr(c, bx, by, bw, bh, 6);
            c.fill();
            c.fillStyle = '#fff';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(text, W / 2, by + bh / 2 + 1);
        }

        stores.forEach(st => drawStore(c, st));

        // floor slabs with downlights, glass balcony railings, planters
        stores.forEach(st => {
            if (st.level > 0) {
                c.fillStyle = '#f5f2ed';
                c.fillRect(st.x, st.fy, st.w + 0.5, SLAB);
                c.fillStyle = '#ffffff';
                c.fillRect(st.x, st.fy, st.w + 0.5, 2);
                c.fillStyle = '#d6cfc4';
                c.fillRect(st.x, st.fy + SLAB - 2, st.w + 0.5, 2);
                c.save();
                c.shadowColor = '#fde68a';
                c.shadowBlur = 6;
                c.fillStyle = '#fef3c7';
                for (let x = st.x + st.w / 4; x < st.x + st.w; x += st.w / 2) circle(c, x, st.fy + SLAB - 3, 2.2);
                c.restore();
                c.fillStyle = 'rgba(191,219,254,0.35)';
                c.fillRect(st.x, st.fy - 18, st.w + 0.5, 18);
                c.strokeStyle = '#a8a29e';
                c.lineWidth = 1;
                for (let x = st.x + 12; x < st.x + st.w; x += 40) line(c, x, st.fy - 18, x, st.fy);
                c.strokeStyle = '#94a3b8';
                c.lineWidth = 2.5;
                line(c, st.x, st.fy - 18, st.x + st.w, st.fy - 18);
            }
            if (seeded(st.seed + 5)() < 0.4) drawPlanter(c, st.x + 2, st.fy);
        });
        c.fillStyle = '#d6cfc4';
        if (atrium.x0 > 0) c.fillRect(atrium.x0 - 6, atrium.top, 6, atrium.bottom - atrium.top);
        if (atrium.x1 < W) c.fillRect(atrium.x1, atrium.top, 6, atrium.bottom - atrium.top);

        // escalator truss and glass sides (the moving steps are drawn every frame)
        escalators.forEach(e => {
            c.fillStyle = '#a8a29e';
            c.beginPath();
            c.moveTo(e.bx, e.by);
            c.lineTo(e.tx, e.ty);
            c.lineTo(e.tx, e.ty + 16);
            c.lineTo(e.bx, e.by + 4);
            c.closePath();
            c.fill();
            // landing plates
            c.fillStyle = '#78716c';
            c.fillRect(e.bx - 10, e.by - 3, 20, 4);
            c.fillRect(e.tx - 10, e.ty - 3, 20, 4);
        });

        // ground-floor walkway
        const fy = H - FLOOR_PAD;
        const fl = c.createLinearGradient(0, fy, 0, H);
        fl.addColorStop(0, '#e9e4dc');
        fl.addColorStop(1, '#d4ccc0');
        c.fillStyle = fl;
        c.fillRect(0, fy, W, FLOOR_PAD);
        c.strokeStyle = 'rgba(0,0,0,0.06)';
        for (let x = 0; x < W; x += 60) line(c, x, fy, x - 20, H);
        line(c, 0, fy + FLOOR_PAD / 2, W, fy + FLOOR_PAD / 2);

        drawRink(c);
        renderFrost();
    }

    function drawPlanter(c, x, fy) {
        c.fillStyle = '#78716c';
        c.beginPath();
        c.moveTo(x, fy - 13);
        c.lineTo(x + 14, fy - 13);
        c.lineTo(x + 12, fy);
        c.lineTo(x + 2, fy);
        c.closePath();
        c.fill();
        c.fillStyle = '#15803d';
        circle(c, x + 7, fy - 20, 8);
        c.fillStyle = '#22c55e';
        circle(c, x + 3, fy - 17, 5.5);
        circle(c, x + 11, fy - 23, 5);
    }

    function drawStore(c, st) {
        const { x, w, top, h, fy } = st;
        const rnd = seeded(st.seed);
        c.fillStyle = '#ece6dc';
        c.fillRect(x, top, w + 0.5, h);

        // fascia with the store name
        const fh = clamp(h * 0.17, 20, 30);
        st.sign = [x + 5, top + 5, w - 10, fh];
        c.fillStyle = '#fdfcfa';
        c.fillRect(x + 5, top + 5, w - 10, fh);
        c.fillStyle = st.color;
        c.fillRect(x + 5, top + 5 + fh - 3, w - 10, 3);
        fitText(c, st.name, w - 22, Math.min(fh * 0.5, 14), 800);
        c.fillStyle = st.color;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(st.name, x + w / 2, top + 5 + fh / 2 - 1);

        // bright shop interior behind glass
        const gx = x + 9, gw = w - 18, gy = top + fh + 11, gh = fy - gy;
        const g = c.createLinearGradient(0, gy, 0, fy);
        g.addColorStop(0, '#fffdf7');
        g.addColorStop(1, '#efe3cc');
        c.fillStyle = g;
        c.fillRect(gx, gy, gw, gh);
        c.globalAlpha = 0.08;
        c.fillStyle = st.color;
        c.fillRect(gx, gy, gw, gh);
        c.globalAlpha = 1;

        const dw = clamp(gw * 0.3, 24, 48), dh = Math.min(gh * 0.86, h * 0.6);
        const dx = x + w / 2 - dw / 2, dy = fy - dh;
        st.door = [dx, dy, dw, dh];
        st.doorH = dh;

        // shelves of papers either side of the door
        [[gx + 4, dx - 4], [dx + dw + 4, gx + gw - 4]].forEach(([a, b]) => {
            if (b - a < 14) return;
            [0.38, 0.68].forEach(f => {
                const sy = gy + gh * f;
                c.fillStyle = '#a16207';
                c.fillRect(a, sy, b - a, 3);
                const pw = clamp((b - a) / 3 - 4, 6, 14);
                for (let j = 0; j < 3; j++) {
                    const cx = a + (b - a) * (j + 0.5) / 3;
                    if ((j + Math.floor(rnd() * 2)) % 2) {
                        const count = 2 + Math.floor(rnd() * 4);
                        for (let k = 0; k < count; k++) {
                            c.fillStyle = k % 2 ? '#e2e8f0' : '#ffffff';
                            c.fillRect(cx - pw * 0.6, sy - (k + 1) * 2.4, pw * 1.2, 2.2);
                        }
                    } else {
                        c.save();
                        c.translate(cx, sy);
                        c.rotate((rnd() - 0.5) * 0.3);
                        c.fillStyle = '#ffffff';
                        c.fillRect(-pw / 2, -pw * 1.3, pw, pw * 1.3);
                        c.strokeStyle = '#cbd5e1';
                        c.lineWidth = 0.8;
                        c.strokeRect(-pw / 2, -pw * 1.3, pw, pw * 1.3);
                        c.fillStyle = '#94a3b8';
                        for (let l = 1; l < 4; l++) c.fillRect(-pw / 2 + 2, -pw * 1.3 + l * pw * 0.3, pw - 4, 0.8);
                        c.restore();
                    }
                }
            });
        });

        // glass doors and storefront frame
        c.fillStyle = 'rgba(186,230,253,0.5)';
        c.fillRect(dx, dy, dw, dh);
        c.strokeStyle = '#57534e';
        c.lineWidth = 2;
        c.strokeRect(dx, dy, dw, dh);
        line(c, x + w / 2, dy, x + w / 2, fy);
        c.fillStyle = '#57534e';
        c.fillRect(x + w / 2 - 5, dy + dh * 0.5, 2, 8);
        c.fillRect(x + w / 2 + 3, dy + dh * 0.5, 2, 8);
        c.strokeStyle = '#78716c';
        c.strokeRect(gx, gy, gw, gh);
        // reflections on the glass
        c.fillStyle = 'rgba(255,255,255,0.35)';
        [0.15, 0.7].forEach(f => {
            c.beginPath();
            c.moveTo(gx + gw * f, gy);
            c.lineTo(gx + gw * f + 12, gy);
            c.lineTo(gx + gw * f - 8, fy);
            c.lineTo(gx + gw * f - 20, fy);
            c.closePath();
            c.fill();
        });
        // pillars
        c.fillStyle = '#ddd5c8';
        c.fillRect(x, top, 4, h);
        c.fillRect(x + w - 4, top, 4, h);
    }

    function drawRink(c) {
        const { x, y, w, h, r } = rink;
        c.save();
        c.shadowColor = 'rgba(15,23,42,0.25)';
        c.shadowBlur = 18;
        c.shadowOffsetY = 6;
        c.fillStyle = '#ffffff';
        rr(c, x, y, w, h, r);
        c.fill();
        c.restore();
        c.strokeStyle = '#2563eb';
        c.lineWidth = 4;
        rr(c, x + 2, y + 2, w - 4, h - 4, r - 2);
        c.stroke();

        const ix = x + 9, iy = y + 9, iw = w - 18, ih = h - 18;
        const g = c.createLinearGradient(ix, iy, ix + iw, iy + ih);
        g.addColorStop(0, '#f4fbff');
        g.addColorStop(0.5, '#e3f1fb');
        g.addColorStop(1, '#eef8fe');
        c.fillStyle = g;
        rr(c, ix, iy, iw, ih, r - 9);
        c.fill();
        // faint lines painted under the ice
        c.save();
        rr(c, ix, iy, iw, ih, r - 9);
        c.clip();
        c.lineWidth = 4;
        c.strokeStyle = 'rgba(239,68,68,0.18)';
        line(c, x + w / 2, iy, x + w / 2, iy + ih);
        c.strokeStyle = 'rgba(37,99,235,0.15)';
        line(c, x + w * 0.22, iy, x + w * 0.22, iy + ih);
        line(c, x + w * 0.78, iy, x + w * 0.78, iy + ih);
        c.restore();
    }

    // The ice surface on top of the bio: a light frost, skate scratches and glare.
    function renderFrost() {
        const { w, h, r } = rink;
        frost.width = Math.round(w * dpr);
        frost.height = Math.round(h * dpr);
        const c = frost.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        rr(c, 9, 9, w - 18, h - 18, r - 9);
        c.clip();
        c.fillStyle = 'rgba(240,249,255,0.12)';
        c.fillRect(0, 0, w, h);
        const rnd = seeded(7);
        c.lineWidth = 1;
        for (let i = 0; i < (w * h) / 3500; i++) {
            c.strokeStyle = rnd() < 0.7 ? 'rgba(255,255,255,0.6)' : 'rgba(148,163,184,0.18)';
            const a = rnd() * Math.PI * 2;
            c.beginPath();
            c.arc(rnd() * w, rnd() * h, 25 + rnd() * 140, a, a + 0.3 + rnd() * 0.7);
            c.stroke();
        }
        [[0.18, 0.2], [0.8, 0.75], [0.55, 0.05]].forEach(([fx, fy]) => {
            const rg = c.createRadialGradient(w * fx, h * fy, 0, w * fx, h * fy, 170);
            rg.addColorStop(0, 'rgba(255,255,255,0.28)');
            rg.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = rg;
            c.fillRect(0, 0, w, h);
        });
    }

    function drawEscalator(c, e, dt) {
        const dx = e.tx - e.bx, dy = e.ty - e.by, len = Math.hypot(dx, dy);
        const dir = Math.sign(dx);
        // moving steps
        c.strokeStyle = '#57534e';
        c.lineWidth = 2;
        const n = Math.floor(len / 9), phase = (time * 0.6) % 1;
        for (let i = 0; i < n; i++) {
            const u = (i + phase) / n;
            const px = e.bx + dx * u, py = e.by + dy * u;
            line(c, px, py, px + dir * 7, py);
        }
        // riders
        e.riders = e.riders || [0, 0.5].map((u, j) => ({ u, p: makePerson(seeded(e.k * 31 + j + 3), e.k * 2 + j + 2) }));
        e.riders.forEach(rd => {
            rd.u = (rd.u + dt * 28 / len) % 1;
            drawPerson(c, rd.p, e.bx + dx * rd.u, e.by + dy * rd.u - 1, personScale, dir, 0, 'stand');
        });
        // glass balustrade and black handrail
        c.fillStyle = 'rgba(191,219,254,0.4)';
        c.beginPath();
        c.moveTo(e.bx, e.by);
        c.lineTo(e.tx, e.ty);
        c.lineTo(e.tx, e.ty - 28);
        c.lineTo(e.bx, e.by - 28);
        c.closePath();
        c.fill();
        c.strokeStyle = '#1f2937';
        c.lineWidth = 4;
        c.lineCap = 'round';
        line(c, e.bx - dir * 6, e.by - 28, e.tx + dir * 6, e.ty - 28);
        c.lineWidth = 1.5;
        c.strokeStyle = '#94a3b8';
        line(c, e.bx, e.by, e.tx, e.ty);
    }

    // ---------- skaters ----------
    const skaters = (() => {
        const rnd = seeded(2024);
        return Array.from({ length: 10 }, (_, i) => ({
            t: i / 10 + rnd() * 0.03, speed: 50 + rnd() * 50, lane: (rnd() - 0.5) * 12,
            p: makePerson(rnd, i), wobbly: i === 1, fallen: 0, phase: rnd() * 6, face: 1
        }));
    })();

    // point on the rounded-rect skating track, clockwise from the top-left
    function trackPoint(t, lane) {
        const x = track.x - lane, y = track.y - lane, w = track.w + 2 * lane, h = track.h + 2 * lane;
        const r = Math.max(2, track.r + lane), sw = w - 2 * r, sh = h - 2 * r, arc = Math.PI * r / 2;
        let d = (((t % 1) + 1) % 1) * (2 * sw + 2 * sh + 4 * arc);
        const corner = (cx, cy, a0) => {
            const a = a0 + d / r;
            return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), dx: -Math.sin(a) };
        };
        if (d < sw) return { x: x + r + d, y, dx: 1 };
        if ((d -= sw) < arc) return corner(x + w - r, y + r, -Math.PI / 2);
        if ((d -= arc) < sh) return { x: x + w, y: y + r + d, dx: 0 };
        if ((d -= sh) < arc) return corner(x + w - r, y + h - r, 0);
        if ((d -= arc) < sw) return { x: x + w - r - d, y: y + h, dx: -1 };
        if ((d -= sw) < arc) return corner(x + r, y + h - r, Math.PI / 2);
        if ((d -= arc) < sh) return { x, y: y + h - r - d, dx: 0 };
        d -= sh;
        return corner(x + r, y + r, Math.PI);
    }

    function updatePeople(dt) {
        const per = 2 * (track.w + track.h);
        const count = clamp(Math.round(per / 190), 4, skaters.length);
        skaters.forEach((sk, i) => {
            sk.on = i < count;
            if (sk.fallen > 0) {
                sk.fallen -= dt;
                return;
            }
            if (sk.wobbly && Math.random() < dt * 0.08) sk.fallen = 1.6;
            sk.t += sk.speed * dt / per;
            sk.phase += dt * sk.speed / (sk.wobbly ? 22 : 14);
        });
        walkers.forEach(wk => {
            if (wk.pause > 0) {
                wk.pause -= dt;
                return;
            }
            wk.x += wk.dir * wk.speed * dt;
            wk.phase += dt * wk.speed / 6;
            if (wk.x < wk.a || wk.x > wk.b) {
                wk.dir *= -1;
                wk.x = clamp(wk.x, wk.a, wk.b);
            } else if (Math.random() < dt * 0.15) {
                wk.pause = 1 + Math.random() * 2;     // window shopping
            }
        });
    }

    // ---------- the agent: a little robot riding a shopping cart ----------
    function drawBot(c, x, y, s, alpha, ghost) {
        const moving = A.speed > 0, fast = A.speed > 700;
        const bob = moving ? Math.sin(A.dist * 0.25) * 1.5 : Math.sin(time * 2.4) * 1.2;
        c.save();
        c.globalAlpha = alpha;
        c.translate(x, y);
        c.scale(s * A.face, s);
        if (!ghost && A.lift < 4) {
            c.fillStyle = 'rgba(15,23,42,0.25)';
            c.beginPath();
            c.ellipse(0, 2, 38, 6, 0, 0, Math.PI * 2);
            c.fill();
        }
        c.translate(0, -A.lift / s);
        if (fast) c.rotate(0.08);
        c.lineCap = 'round';
        c.lineJoin = 'round';

        // wheels and chassis
        [-22, 22].forEach(wx => {
            c.fillStyle = '#1f2937';
            circle(c, wx, -6, 6);
            c.fillStyle = '#9ca3af';
            circle(c, wx, -6, 2);
            c.strokeStyle = '#6b7280';
            c.lineWidth = 1.5;
            const a = A.dist / 6;
            line(c, wx - 4 * Math.cos(a), -6 - 4 * Math.sin(a), wx + 4 * Math.cos(a), -6 + 4 * Math.sin(a));
        });
        c.strokeStyle = '#475569';
        c.lineWidth = 3;
        line(c, -26, -20, -22, -10);
        line(c, 28, -20, 22, -10);
        line(c, -24, -14, 24, -14);
        line(c, -36, -60, -50, -70);
        c.fillStyle = '#ef4444';
        circle(c, -50, -70, 4.5);

        c.translate(0, bob);
        // robot body (behind the basket front)
        c.fillStyle = '#5eead4';
        c.strokeStyle = '#0f766e';
        c.lineWidth = 2;
        rr(c, -17, -64, 36, 30, 12);
        c.fill();
        c.stroke();
        // a lone paper sticking out of the cart after the shopping trip
        if (A.paper) {
            c.save();
            c.translate(24, -58);
            c.rotate(0.35);
            c.fillStyle = '#ffffff';
            c.strokeStyle = '#94a3b8';
            c.lineWidth = 1;
            c.fillRect(-7, -22, 14, 22);
            c.strokeRect(-7, -22, 14, 22);
            c.fillStyle = '#94a3b8';
            for (let l = 0; l < 4; l++) c.fillRect(-5, -19 + l * 4, 10, 1);
            c.restore();
        }
        // basket
        const basket = () => {
            c.beginPath();
            c.moveTo(-36, -60);
            c.lineTo(38, -60);
            c.lineTo(30, -20);
            c.lineTo(-28, -20);
            c.closePath();
        };
        c.fillStyle = 'rgba(148,163,184,0.18)';
        basket();
        c.fill();
        c.strokeStyle = '#64748b';
        c.lineWidth = 1.5;
        for (let k = 1; k < 6; k++) {
            const f = k / 6;
            line(c, -36 + 74 * f, -60, -28 + 58 * f, -20);
        }
        line(c, -33, -46, 35, -46);
        line(c, -31, -33, 33, -33);
        c.lineWidth = 2.5;
        basket();
        c.stroke();
        c.strokeStyle = '#ef4444';
        c.lineWidth = 4;
        line(c, -37, -60, 39, -60);
        // hands on the rim
        c.fillStyle = '#2dd4bf';
        circle(c, -8, -61, 4.5);
        circle(c, 20, -61, 4.5);

        // head
        c.fillStyle = '#f8fafc';
        c.strokeStyle = '#475569';
        c.lineWidth = 2;
        rr(c, -23, -108, 48, 44, 16);
        c.fill();
        c.stroke();
        c.fillStyle = '#0f172a';
        rr(c, -16, -100, 34, 28, 10);
        c.fill();
        // face
        c.strokeStyle = c.fillStyle = '#67e8f9';
        c.lineWidth = 2.2;
        if (!ghost) {
            c.shadowColor = '#22d3ee';
            c.shadowBlur = 6;
        }
        const look = moving ? 2 : Math.sin(time * 0.8) * 1.5;
        if (A.mood === 'go') {
            line(c, -10 + look, -91, -5 + look, -87.5);
            line(c, -5 + look, -87.5, -10 + look, -84);
            line(c, 12 + look, -91, 7 + look, -87.5);
            line(c, 7 + look, -87.5, 12 + look, -84);
            circle(c, 1 + look, -78, 2.2);
        } else {
            const blink = time % 3.4 < 0.12 ? 0.15 : 1;
            [-6.5, 8.5].forEach(ex => {
                c.beginPath();
                c.ellipse(ex + look, -87, 3.6, 4.6 * blink, 0, 0, Math.PI * 2);
                c.fill();
            });
            if (A.mood === 'sad') {
                line(c, -11, -93, -4, -95.5);
                line(c, 13, -93, 6, -95.5);
                c.beginPath();
                c.arc(1, -74, 4, Math.PI * 1.15, Math.PI * 1.85);
            } else {
                c.beginPath();
                c.arc(1, -80, 4, Math.PI * 0.15, Math.PI * 0.85);
            }
            c.stroke();
        }
        c.shadowBlur = 0;
        c.fillStyle = 'rgba(244,114,182,0.55)';
        c.beginPath();
        c.ellipse(-11, -78, 3, 2, 0, 0, Math.PI * 2);
        c.ellipse(13, -78, 3, 2, 0, 0, Math.PI * 2);
        c.fill();
        if (A.mood === 'sad') {
            c.fillStyle = '#38bdf8';
            c.beginPath();
            c.moveTo(29, -104);
            c.quadraticCurveTo(34, -96, 29, -94);
            c.quadraticCurveTo(24, -96, 29, -104);
            c.fill();
        }

        // propeller beanie
        ['#ef4444', '#facc15', '#3b82f6', '#22c55e'].forEach((col, k) => {
            c.fillStyle = col;
            c.beginPath();
            c.moveTo(1, -106);
            c.ellipse(1, -106, 20, 15, 0, Math.PI + k * Math.PI / 4, Math.PI + (k + 1) * Math.PI / 4);
            c.closePath();
            c.fill();
        });
        c.fillStyle = '#facc15';
        rr(c, -20, -108, 42, 5, 2.5);
        c.fill();
        c.strokeStyle = '#64748b';
        c.lineWidth = 2;
        line(c, 1, -121, 1, -127);
        const spin = Math.cos(A.prop);
        [['#ef4444', -1], ['#3b82f6', 1]].forEach(([col, sgn]) => {
            c.fillStyle = col;
            c.beginPath();
            c.ellipse(1 + sgn * 8 * spin, -128, Math.max(1, 8 * Math.abs(spin)), 2.6, 0, 0, Math.PI * 2);
            c.fill();
        });
        c.fillStyle = '#facc15';
        circle(c, 1, -128, 2.2);
        c.restore();
    }

    // ---------- tasks (each returns true when finished) ----------
    const move = (target, speed) => {
        let start = null;
        return dt => {
            const p = target();
            if (!start) start = { s: A.s, d: Math.hypot(p.x - A.x, p.y - A.y) || 1 };
            const dx = p.x - A.x, dy = p.y - A.y, d = Math.hypot(dx, dy);
            const step = reduce ? Infinity : speed * dt;
            if (Math.abs(dx) > 1) A.face = dx < 0 ? -1 : 1;
            if (d <= step) {
                Object.assign(A, p);
                return true;
            }
            A.x += dx / d * step;
            A.y += dy / d * step;
            A.speed = speed;
            A.dist += step / A.s;
            A.s = p.s + (start.s - p.s) * clamp((d - step) / start.d, 0, 1);
            return false;
        };
    };
    const wait = ms => {
        let t = 0;
        return dt => (t += dt * 1000) >= ms * (reduce ? 0.2 : 1);
    };
    const fade = (to, ms) => dt => {
        const k = reduce ? 1 : dt * 1000 / ms;
        A.alpha = Math.abs(to - A.alpha) <= k ? to : A.alpha + Math.sign(to - A.alpha) * k;
        return A.alpha === to;
    };
    const call = fn => () => (fn(), true);
    const glow = i => call(() => { if (stores[i]) stores[i].glow = 1; });

    // A fixed-length timeline of moves and store visits, driven by the wall clock (not frame
    // steps) so it always takes exactly its total duration.
    const timeline = (segs, onDone) => {
        const t0 = performance.now();
        let fired = -1;
        return () => {
            const t = performance.now() - t0;
            let acc = 0, j = 0;
            while (j < segs.length && t >= acc + segs[j].dur) acc += segs[j++].dur;
            while (fired < Math.min(j, segs.length - 1)) {
                const sg = segs[++fired];
                if (sg.start) sg.start();
            }
            if (j >= segs.length) {
                const endPt = segs[segs.length - 1].to;
                Object.assign(A, endPt, { alpha: 1, lift: 0 });
                onDone();
                return true;
            }
            const sg = segs[j], f = (t - acc) / sg.dur;
            if (sg.type === 'move') {
                const e = reduce ? 1 : f;
                const { from, to } = sg;
                const nx = from.x + (to.x - from.x) * e, ny = from.y + (to.y - from.y) * e;
                if (Math.abs(to.x - from.x) > 1) A.face = to.x < from.x ? -1 : 1;
                A.dist += Math.hypot(nx - A.x, ny - A.y) / A.s;
                A.x = nx;
                A.y = ny;
                A.s = from.s + (to.s - from.s) * e;
                A.speed = Math.hypot(to.x - from.x, to.y - from.y) / sg.dur * 1000;
                A.lift = Math.abs(to.y - from.y) > 30 ? Math.sin(e * Math.PI) * Math.min(70, Math.abs(to.y - from.y) * 0.4) : 0;
                A.alpha = 1;
            } else {
                A.speed = 0;
                A.lift = 0;
                A.alpha = f < 0.25 ? 1 - f / 0.25 : f > 0.75 ? (f - 0.75) / 0.25 : 0;
            }
            return false;
        };
    };

    // ---------- story ----------
    function intro() {
        if (started || !stores.length) return;
        started = true;
        const f = front();
        const ground = stores.filter(s => s.level === stores[0].level);
        const st = ground.reduce((a, b) => Math.abs(b.x + b.w / 2 - f.x) < Math.abs(a.x + a.w / 2 - f.x) ? b : a);
        const i = stores.indexOf(st);
        Object.assign(A, doorOf(i)(), { alpha: 0 });
        queue.push(wait(600), glow(i), fade(1, 350), move(front, 160), call(showAsk));
    }

    function shop(q) {
        busy = true;
        hideBubble();
        A.mood = 'go';
        A.paper = false;
        // a handful of random stores, all visited within exactly SEARCH_MS
        const k = Math.min(stores.length, 4 + Math.floor(Math.random() * 3));
        const order = [...stores.keys()].sort(() => Math.random() - 0.5).slice(0, k);
        const stops = order.map(i => doorOf(i)());
        const home = front();
        let prev = { x: A.x, y: A.y, s: A.s };
        const dists = stops.map(p => {
            const d = Math.hypot(p.x - prev.x, p.y - prev.y);
            prev = p;
            return d;
        });
        const sum = dists.reduce((a, b) => a + b, 0) || 1;
        const travel = SEARCH_MS - RETURN_MS - k * INSIDE_MS;
        const setStatus = n => {
            status.textContent = `Searching for “${q}” · store ${n} of ${k}`;
        };

        const segs = [];
        prev = { x: A.x, y: A.y, s: A.s };
        stops.forEach((p, n) => {
            segs.push({ type: 'move', from: prev, to: p, dur: travel * dists[n] / sum });
            segs.push({
                type: 'in', dur: INSIDE_MS, start: () => {
                    const st = stores[order[n]];
                    if (st) {
                        st.glow = 1;
                        pops.push({ x: st.x + st.w / 2, y: st.top + st.h * 0.45, text: POPS[Math.floor(Math.random() * POPS.length)], t0: time });
                    }
                    setStatus(n + 1);
                }
            });
            prev = p;
        });
        segs.push({
            type: 'move', from: prev, to: home, dur: RETURN_MS, start: () => {
                status.hidden = true;
                A.mood = 'sad';
                A.paper = true;
            }
        });
        setStatus(0);
        status.hidden = false;
        queue.push(timeline(segs, () => showAnswer(q, k)));
    }

    // ---------- speech bubble ----------
    function popIn() {
        chip.hidden = true;
        bubble.hidden = false;
        bubble.classList.remove('pop');
        void bubble.offsetWidth;
        bubble.classList.add('pop');
    }

    function showAsk() {
        busy = false;
        A.mood = 'happy';
        A.paper = false;
        answerBox.hidden = true;
        askBox.hidden = false;
        input.value = '';
        popIn();
        if (!mobile) input.focus({ preventScroll: true });
    }

    function showAnswer(q, n) {
        busy = false;
        askBox.hidden = true;
        answerBox.hidden = false;
        answerSub.textContent = `I checked ${n} stores for “${q}” in 5 seconds. Every one of them only sells sections of a paper.`;
        popIn();
    }

    function hideBubble() {
        bubble.hidden = true;
    }

    // "Just browsing": the agent steps aside and waits with a small prompt
    function dismiss() {
        if (busy) return;
        busy = true;
        hideBubble();
        queue.push(move(side, 420), call(() => {
            busy = false;
            A.mood = 'happy';
            chip.hidden = false;
        }));
    }

    function summon() {
        if (busy) return;
        busy = true;
        chip.hidden = true;
        queue.push(move(front, 420), call(showAsk));
    }

    function place(el, large) {
        if (el.hidden) return;
        const headY = A.y - A.lift - (BOT_H + 4) * A.s;
        const bw = el.offsetWidth, bh = el.offsetHeight;
        const left = large ? (vw - bw) / 2 : clamp(A.x - bw / 2, 12, vw - bw - 12);
        let top = headY - bh - 16;
        if (large && !mobile) top = Math.max(12, Math.min((vh - bh) / 2, top));   // middle of the screen
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.setProperty('--tail-x', clamp(A.x - left, 24, bw - 24) + 'px');
    }

    form.addEventListener('submit', e => {
        e.preventDefault();
        if (busy) return;
        shop(input.value.trim().slice(0, 60) || 'something nice');
    });
    againBtn.addEventListener('click', showAsk);
    bubble.querySelectorAll('.bubble-dismiss').forEach(b => b.addEventListener('click', dismiss));
    chip.addEventListener('click', summon);

    // ---------- loop ----------
    let last = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        time += dt;

        A.speed = 0;
        if (queue.length && queue[0](dt)) queue.shift();
        A.prop += dt * (A.lift > 0 || A.speed > 700 ? 40 : 5);
        if (A.speed > 700) {
            trail.push({ x: A.x, y: A.y, s: A.s, lift: A.lift });
            if (trail.length > 5) trail.shift();
        } else if (trail.length) {
            trail.shift();
        }
        stores.forEach(st => { st.glow = Math.max(0, st.glow - dt * 1.6); });
        updatePeople(dt);

        const sy = clamp(window.scrollY, 0, Math.max(0, H - vh));
        bg.setTransform(dpr, 0, 0, dpr, 0, 0);
        bg.clearRect(0, 0, vw, vh);
        const ch = Math.min(vh, H);
        bg.drawImage(scene, 0, sy * dpr, W * dpr, ch * dpr, 0, 0, W, ch);
        bg.save();
        bg.translate(0, -sy);
        stores.forEach(st => {
            if (st.glow > 0) {
                bg.globalAlpha = st.glow * 0.55;
                bg.fillStyle = st.color;
                bg.fillRect(...st.door);
                bg.globalAlpha = 1;
            }
        });
        walkers.forEach(wk => drawPerson(bg, wk.p, wk.x, wk.fy, personScale, wk.dir, wk.pause > 0 ? 0 : wk.phase, wk.pause > 0 ? 'stand' : 'walk'));
        escalators.forEach(e => drawEscalator(bg, e, dt));
        bg.restore();

        // foreground: ice surface over the bio, skaters, pops and the agent
        fg.setTransform(dpr, 0, 0, dpr, 0, 0);
        fg.clearRect(0, 0, vw, vh);
        fg.save();
        fg.translate(0, -sy);
        fg.drawImage(frost, rink.x, rink.y, rink.w, rink.h);
        skaters.forEach(sk => {
            if (!sk.on) return;
            const p = trackPoint(sk.t, sk.lane);
            if (Math.abs(p.dx) > 0.2) sk.face = p.dx < 0 ? -1 : 1;
            const tilt = sk.fallen > 0 ? -1.25 : sk.wobbly ? Math.sin(time * 9) * 0.12 : 0;
            drawPerson(fg, sk.p, p.x, p.y, mobile ? 0.8 : 1.25, sk.face, sk.phase, 'skate', tilt);
        });
        for (let k = pops.length - 1; k >= 0; k--) {
            const p = pops[k], t = time - p.t0;
            if (t > 1.1) {
                pops.splice(k, 1);
                continue;
            }
            fg.globalAlpha = 1 - t / 1.1;
            fg.font = '600 12px Inter, sans-serif';
            fg.textAlign = 'center';
            fg.textBaseline = 'middle';
            const tw = fg.measureText(p.text).width + 16, y = p.y - t * 30;
            fg.fillStyle = 'rgba(15,23,42,0.88)';
            rr(fg, p.x - tw / 2, y - 11, tw, 22, 11);
            fg.fill();
            fg.fillStyle = '#f8fafc';
            fg.fillText(p.text, p.x, y + 0.5);
            fg.globalAlpha = 1;
        }
        if (started && A.alpha > 0.01) {
            const lift = A.lift;
            trail.forEach((p, k) => {
                A.lift = p.lift;
                drawBot(fg, p.x, p.y, p.s, A.alpha * 0.15 * (k + 1) / trail.length, true);
            });
            A.lift = lift;
            drawBot(fg, A.x, A.y, A.s, A.alpha, false);
        }
        fg.restore();
        place(bubble, true);
        place(chip, false);
        requestAnimationFrame(frame);
    }

    layout();
    window.addEventListener('resize', layout);
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(card);
    if (document.fonts) document.fonts.ready.then(layout);

    // On phones the agent lives below the rink, so wait until that part is on screen.
    if (mobile && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) {
                io.disconnect();
                intro();
            }
        }, { threshold: 0.3 });
        io.observe(spacer);
    } else {
        intro();
    }
    requestAnimationFrame(frame);
})();
