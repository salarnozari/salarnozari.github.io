// Shopping-agent mall for the home page: a multi-level mall whose atrium holds an ice rink,
// with the bio card sitting on the ice, NPC skaters circling it, and a cart-riding shopping agent.
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
    const sc = scene.getContext('2d');

    const bubble = document.getElementById('agent-bubble');
    const askBox = bubble.querySelector('.bubble-ask');
    const answerBox = bubble.querySelector('.bubble-answer');
    const answerSub = bubble.querySelector('.bubble-sub');
    const form = document.getElementById('agent-form');
    const input = document.getElementById('agent-input');
    const againBtn = document.getElementById('agent-again');
    const status = document.getElementById('agent-status');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const STORES = [
        ['WORKING PAPERS', '#f472b6'], ['R&R', '#60a5fa'], ['PREPRINTS', '#facc15'],
        ['APPENDIX', '#34d399'], ['UNDER REVIEW', '#fb923c'], ['FOOTNOTES', '#a78bfa'],
        ['DRAFTS', '#22d3ee'], ['ROBUSTNESS', '#f87171'], ['REFERENCES', '#4ade80'],
        ['SLIDES', '#e879f9'], ['REBUTTALS', '#fbbf24'], ['TABLES', '#38bdf8'],
        ['ABSTRACTS', '#fda4af'], ['CITATIONS', '#93c5fd'], ['COVER LETTERS', '#fde047'],
        ['DATA', '#6ee7b7'], ['POSTERS', '#fdba74'], ['REVISIONS', '#c4b5fd'],
        ['MEMOS', '#67e8f9'], ['PRE-REGS', '#fca5a5'], ['HANDOUTS', '#86efac'],
        ['PROOFS', '#f0abfc'], ['ERRATA', '#fcd34d'], ['SUPPLEMENTS', '#7dd3fc']
    ];
    const POPS = ['only papers', 'papers', 'more papers', 'just PDFs', 'an appendix',
        'footnotes', 'a draft', 'nope', 'tables', 'a rebuttal'];
    const FLOOR_PAD = 40, SLAB = 14, BOT_H = 130;

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    let vw = 0, vh = 0, W = 0, H = 0, dpr = 1, mobile = false, s1 = 1;
    let rink = null, track = null, atrium = null, stores = [];
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

        const padX = mobile ? 26 : 110, padY = mobile ? 44 : 60;
        const Lh = mobile ? 160 : clamp((vh - FLOOR_PAD - 60) / 4, 120, 190);
        const storeH = Lh - SLAB;
        spacer.style.height = mobile ? FLOOR_PAD + Lh + storeH + padY + 20 + 'px' : '';

        const sy = window.scrollY;
        const cr = card.getBoundingClientRect();
        const cardBox = { x: cr.left, y: cr.top + sy, w: cr.width, h: cr.height };
        rink = { x: cardBox.x - padX, y: cardBox.y - padY, w: cardBox.w + 2 * padX, h: cardBox.h + 2 * padY, r: mobile ? 28 : 70 };
        track = {
            x: cardBox.x - padX * 0.5, y: cardBox.y - padY * 0.25,
            w: cardBox.w + padX, h: cardBox.h + padY, r: clamp(Math.min(padX, padY) * 0.6, 10, 40)
        };
        W = vw;
        H = mobile ? spacer.getBoundingClientRect().bottom + sy : vh;
        s1 = mobile ? 0.8 : clamp(vh / 860, 0.75, 1.05);

        // Stack levels from the ground up; where a level crosses the atrium it only has side wings.
        const m = mobile ? 10 : 20;
        atrium = { x0: rink.x - m, x1: rink.x + rink.w + m, top: 0, bottom: H };
        stores = [];
        for (let k = 0; ; k++) {
            const fy = H - FLOOR_PAD - k * Lh, top = fy - storeH;
            if (top < 8) break;
            const crosses = fy + SLAB > rink.y - m && top < rink.y + rink.h + m;
            if (!crosses && fy < rink.y) atrium.top = Math.max(atrium.top, fy + SLAB);
            if (!crosses && fy > rink.y) atrium.bottom = Math.min(atrium.bottom, top);
            const segs = crosses ? [[0, atrium.x0], [atrium.x1, W]] : [[0, W]];
            segs.forEach(([a, b]) => {
                if (b - a < 100) return;
                const n = Math.max(1, Math.round((b - a) / 150)), w = (b - a) / n;
                for (let i = 0; i < n; i++) {
                    const [name, color] = STORES[stores.length % STORES.length];
                    stores.push({ x: a + i * w, w, top, fy, h: storeH, level: k, name, color, glow: 0, seed: stores.length * 7919 + 13 });
                }
            });
        }
        renderScene();

        if (started && !busy && queue.length === 0) Object.assign(A, front());
    }

    const front = () => {
        if (mobile) return { x: W / 2, y: H - 10, s: s1 };
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
        const c = sc;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);

        const sky = c.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#070814');
        sky.addColorStop(1, '#15131c');
        c.fillStyle = sky;
        c.fillRect(0, 0, W, H);

        // skylight with stars above the top level
        const skyBottom = stores.length ? Math.min(...stores.map(s => s.top)) - 6 : 0;
        if (skyBottom > 24) {
            const rnd = seeded(99);
            for (let i = 0; i < W * skyBottom / 2500; i++) {
                c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
                c.fillRect(rnd() * W, rnd() * skyBottom, 1.5, 1.5);
            }
            if (skyBottom > 50) {
                c.fillStyle = '#fef3c7';
                circle(c, W * 0.86, skyBottom * 0.42, 11);
                c.fillStyle = '#070814';
                circle(c, W * 0.86 + 5, skyBottom * 0.42 - 3, 9);
            }
            c.strokeStyle = 'rgba(148,163,184,0.16)';
            c.lineWidth = 2;
            for (let x = 0; x < W; x += 90) line(c, x, 0, x, skyBottom);
            line(c, 0, skyBottom * 0.5, W, skyBottom * 0.5);
            c.fillStyle = '#1f1c27';
            c.fillRect(0, skyBottom - 6, W, 6);
        }

        // atrium floor and the columns that frame it
        c.fillStyle = '#1a1720';
        c.fillRect(atrium.x0, atrium.top, atrium.x1 - atrium.x0, atrium.bottom - atrium.top);
        c.strokeStyle = 'rgba(255,255,255,0.03)';
        c.lineWidth = 1;
        for (let x = atrium.x0; x < atrium.x1; x += 40) line(c, x, atrium.top, x, atrium.bottom);
        for (let y = atrium.top; y < atrium.bottom; y += 40) line(c, atrium.x0, y, atrium.x1, y);

        // neon sign hanging over the rink
        const gap = rink.y - atrium.top;
        if (gap > 80) {
            const text = 'THE PAPER MALL', bh = 38, by = atrium.top + Math.min(40, (gap - bh) / 2);
            c.font = '800 18px Inter, sans-serif';
            const bw = c.measureText(text).width + 48, bx = W / 2 - bw / 2;
            c.strokeStyle = '#475569';
            c.lineWidth = 1.5;
            line(c, bx + 20, atrium.top, bx + 20, by);
            line(c, bx + bw - 20, atrium.top, bx + bw - 20, by);
            c.fillStyle = '#0d0c12';
            rr(c, bx, by, bw, bh, 8);
            c.fill();
            c.strokeStyle = '#f472b6';
            c.lineWidth = 2;
            c.save();
            c.shadowColor = '#f472b6';
            c.shadowBlur = 14;
            c.stroke();
            c.fillStyle = '#fdf2f8';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(text, W / 2, by + bh / 2 + 1);
            c.restore();
        }

        stores.forEach(st => drawStore(c, st));

        // floor slabs, string lights and glass balcony railings
        const LIGHTS = ['#fde68a', '#fca5a5', '#a5f3fc', '#bbf7d0'];
        stores.forEach(st => {
            if (st.level === 0) return;
            c.fillStyle = '#2a2733';
            c.fillRect(st.x, st.fy, st.w + 0.5, SLAB);
            c.save();
            c.shadowBlur = 5;
            for (let x = st.x + 6, k = 0; x < st.x + st.w; x += 16, k++) {
                c.fillStyle = c.shadowColor = LIGHTS[(k + st.level) % LIGHTS.length];
                circle(c, x, st.fy + SLAB / 2, 1.8);
            }
            c.restore();
            c.fillStyle = 'rgba(186,230,253,0.07)';
            c.fillRect(st.x, st.fy - 16, st.w + 0.5, 16);
            c.strokeStyle = '#64748b';
            c.lineWidth = 2;
            line(c, st.x, st.fy - 16, st.x + st.w, st.fy - 16);
            c.lineWidth = 1;
            for (let x = st.x + 10; x < st.x + st.w; x += 36) line(c, x, st.fy - 16, x, st.fy);
        });
        c.fillStyle = '#24212c';
        if (atrium.x0 > 0) c.fillRect(atrium.x0 - 6, atrium.top, 6, atrium.bottom - atrium.top);
        if (atrium.x1 < W) c.fillRect(atrium.x1, atrium.top, 6, atrium.bottom - atrium.top);

        // ground-floor walkway
        const fy = H - FLOOR_PAD;
        const fl = c.createLinearGradient(0, fy, 0, H);
        fl.addColorStop(0, '#2b2733');
        fl.addColorStop(1, '#141218');
        c.fillStyle = fl;
        c.fillRect(0, fy, W, FLOOR_PAD);
        c.strokeStyle = 'rgba(255,255,255,0.05)';
        for (let x = 0; x < W; x += 60) line(c, x, fy, x - 20, H);

        drawRink(c);
    }

    function drawStore(c, st) {
        const { x, w, top, h, fy } = st;
        const rnd = seeded(st.seed);
        c.fillStyle = '#1b1922';
        c.fillRect(x, top, w + 0.5, h);
        c.fillStyle = '#28252f';
        c.fillRect(x, top, 4, h);
        c.fillRect(x + w - 4, top, 4, h);
        const ix = x + 8, iw = w - 16;

        // neon sign
        const sh = clamp(h * 0.16, 20, 30);
        st.sign = [ix, top + 6, iw, sh];
        c.fillStyle = '#0d0c12';
        rr(c, ix, top + 6, iw, sh, 5);
        c.fill();
        let fs = Math.min(sh * 0.52, 15);
        c.font = `700 ${fs}px Inter, sans-serif`;
        while (c.measureText(st.name).width > iw - 12 && fs > 7) {
            fs -= 0.5;
            c.font = `700 ${fs}px Inter, sans-serif`;
        }
        c.save();
        c.shadowColor = st.color;
        c.shadowBlur = 10;
        c.fillStyle = st.color;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(st.name, x + w / 2, top + 6 + sh / 2 + 1);
        c.restore();

        // striped awning
        const ay = top + 10 + sh, ah = Math.max(10, h * 0.08);
        const n = Math.max(4, Math.round(iw / 14)), sw = iw / n;
        for (let k = 0; k < n; k++) {
            c.fillStyle = k % 2 ? '#d4d4d8' : st.color;
            c.fillRect(ix + k * sw, ay, sw + 0.5, ah);
            c.beginPath();
            c.arc(ix + k * sw + sw / 2, ay + ah, sw / 2, 0, Math.PI);
            c.fill();
        }

        // shop window
        const gy = ay + ah, gh = fy - gy;
        const g = c.createLinearGradient(0, gy, 0, fy);
        g.addColorStop(0, '#3b3328');
        g.addColorStop(1, '#1f1b16');
        c.fillStyle = g;
        c.fillRect(ix, gy, iw, gh);
        c.globalAlpha = 0.12;
        c.fillStyle = st.color;
        c.fillRect(ix, gy, iw, gh);
        c.globalAlpha = 1;

        const dw = clamp(iw * 0.3, 24, 50), dh = Math.min(gh * 0.85, h * 0.58);
        const dx = x + w / 2 - dw / 2, dy = fy - dh;
        st.door = [dx, dy, dw, dh];
        st.doorH = dh;
        c.fillStyle = '#0a090d';
        c.fillRect(dx, dy, dw, dh);
        c.strokeStyle = '#4a4556';
        c.lineWidth = 2;
        c.strokeRect(dx, dy, dw, dh);
        line(c, x + w / 2, dy, x + w / 2, fy);
        c.strokeStyle = '#3a3644';
        c.strokeRect(ix + 0.5, gy + 0.5, iw - 1, gh - 1);

        // shelves of papers either side of the door
        const shelfY = fy - gh * 0.32;
        [[ix + 4, dx - 4], [dx + dw + 4, ix + iw - 4]].forEach(([a, b]) => {
            if (b - a < 14) return;
            c.fillStyle = '#5b5245';
            c.fillRect(a, shelfY, b - a, 3);
            const pw = clamp((b - a) / 2 - 6, 7, 18);
            for (let j = 0; j < 2; j++) {
                const cx = a + (b - a) * (j + 0.5) / 2;
                if (j === 0) {
                    const tilt = (rnd() - 0.5) * 0.25;
                    for (let k = 0; k < 3; k++) {
                        c.save();
                        c.translate(cx, shelfY);
                        c.rotate(tilt + (k - 1) * 0.18);
                        c.fillStyle = k === 2 ? '#f8fafc' : '#cbd5e1';
                        c.fillRect(-pw / 2, -pw * 1.3, pw, pw * 1.3);
                        if (k === 2) {
                            c.fillStyle = '#94a3b8';
                            for (let l = 1; l < 5; l++) c.fillRect(-pw / 2 + 2, -pw * 1.3 + l * pw * 0.24, pw - 4, 1);
                        }
                        c.restore();
                    }
                } else {
                    const count = 3 + Math.floor(rnd() * 5);
                    for (let k = 0; k < count; k++) {
                        c.fillStyle = k % 2 ? '#e2e8f0' : '#f8fafc';
                        c.fillRect(cx - pw * 0.7, shelfY - (k + 1) * 2.2, pw * 1.4, 2);
                    }
                }
            }
        });
    }

    function drawRink(c) {
        const { x, y, w, h, r } = rink;
        c.save();
        c.shadowColor = 'rgba(0,0,0,0.55)';
        c.shadowBlur = 24;
        c.fillStyle = '#e2e8f0';
        rr(c, x, y, w, h, r);
        c.fill();
        c.restore();
        c.strokeStyle = '#3b82f6';
        c.lineWidth = 3;
        rr(c, x + 3, y + 3, w - 6, h - 6, r - 3);
        c.stroke();

        const ix = x + 8, iy = y + 8, iw = w - 16, ih = h - 16;
        const g = c.createLinearGradient(ix, iy, ix + iw, iy + ih);
        g.addColorStop(0, '#f0f9ff');
        g.addColorStop(0.5, '#d6e9fb');
        g.addColorStop(1, '#e0f2fe');
        c.fillStyle = g;
        rr(c, ix, iy, iw, ih, r - 8);
        c.fill();

        c.save();
        rr(c, ix, iy, iw, ih, r - 8);
        c.clip();
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(239,68,68,0.35)';
        line(c, x + w / 2, iy, x + w / 2, iy + ih);
        c.strokeStyle = 'rgba(59,130,246,0.3)';
        line(c, x + w * 0.3, iy, x + w * 0.3, iy + ih);
        line(c, x + w * 0.7, iy, x + w * 0.7, iy + ih);
        const rnd = seeded(7);
        c.lineWidth = 1;
        for (let i = 0; i < (w * h) / 4000; i++) {
            c.strokeStyle = rnd() < 0.6 ? 'rgba(255,255,255,0.9)' : 'rgba(148,163,184,0.3)';
            const a = rnd() * Math.PI * 2;
            c.beginPath();
            c.arc(ix + rnd() * iw, iy + rnd() * ih, 20 + rnd() * 110, a, a + 0.3 + rnd() * 0.6);
            c.stroke();
        }
        [[0.2, 0.25], [0.75, 0.7], [0.5, 0.1]].forEach(([fx, fy]) => {
            const rg = c.createRadialGradient(ix + iw * fx, iy + ih * fy, 0, ix + iw * fx, iy + ih * fy, 160);
            rg.addColorStop(0, 'rgba(255,255,255,0.5)');
            rg.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = rg;
            c.fillRect(ix, iy, iw, ih);
        });
        c.restore();
    }

    // ---------- skaters ----------
    const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
    const JACKET = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    const PANTS = ['#1e3a8a', '#111827', '#4b5563', '#7c2d12', '#065f46', '#be185d'];
    const HATS = ['beanie', 'earmuffs', 'hair', 'beanie', 'cap', 'beanie'];
    const skaters = (() => {
        const rnd = seeded(2024);
        const pick = arr => arr[Math.floor(rnd() * arr.length)];
        return Array.from({ length: 10 }, (_, i) => ({
            t: i / 10 + rnd() * 0.03,
            speed: 50 + rnd() * 50,
            lane: (rnd() - 0.5) * 10,
            skin: pick(SKIN), jacket: JACKET[i % JACKET.length], pants: pick(PANTS),
            hat: HATS[i % HATS.length], hatColor: pick(JACKET), scarf: pick(JACKET),
            kid: i % 4 === 3, wobbly: i === 1, fallen: 0, phase: rnd() * 6, face: 1
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

    function updateSkaters(dt) {
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
    }

    function drawSkater(c, sk) {
        const p = trackPoint(sk.t, sk.lane);
        if (Math.abs(p.dx) > 0.2) sk.face = p.dx < 0 ? -1 : 1;
        const sc = (mobile ? 0.8 : 1.25) * (sk.kid ? 0.78 : 1);
        c.save();
        c.translate(p.x, p.y);
        c.scale(sc * sk.face, sc);
        c.fillStyle = 'rgba(30,58,138,0.18)';
        c.beginPath();
        c.ellipse(0, 1, 10, 2.5, 0, 0, Math.PI * 2);
        c.fill();
        if (sk.fallen > 0) c.rotate(-1.25);
        else if (sk.wobbly) c.rotate(Math.sin(time * 9) * 0.12);

        const str = Math.sin(sk.phase);
        const feet = [{ x: 5 * str, y: -Math.max(0, -str) * 3 }, { x: -5 * str, y: -Math.max(0, str) * 3 }];
        c.lineCap = 'round';
        c.strokeStyle = sk.pants;
        c.lineWidth = 3.5;
        feet.forEach(f => line(c, 0, -15, f.x, f.y - 3));
        feet.forEach(f => {
            c.fillStyle = '#f8fafc';
            c.fillRect(f.x - 2, f.y - 5, 5, 3.5);
            c.strokeStyle = '#94a3b8';
            c.lineWidth = 1;
            line(c, f.x - 3, f.y - 0.5, f.x + 4, f.y - 0.5);
        });

        c.translate(0, -15);
        c.rotate(0.18);
        const arm = Math.sin(sk.phase) * 0.4;
        c.strokeStyle = sk.jacket;
        c.lineWidth = 3;
        line(c, 0, -10, -8 * Math.cos(arm), -6 - 3 * Math.sin(arm));
        c.fillStyle = sk.jacket;
        rr(c, -4.5, -13, 9, 14, 3.5);
        c.fill();
        line(c, 0, -10, 9 * Math.cos(arm), -6 + 3 * Math.sin(arm));
        c.fillStyle = sk.scarf;
        c.fillRect(-4.5, -13, 9, 3);
        c.beginPath();
        c.moveTo(-3, -12.5);
        c.lineTo(-11, -12 + Math.sin(time * 8 + sk.phase) * 2);
        c.lineTo(-10, -9);
        c.closePath();
        c.fill();

        c.fillStyle = sk.skin;
        circle(c, 0.5, -18, 4.5);
        c.fillStyle = sk.hatColor;
        if (sk.hat === 'beanie') {
            c.beginPath();
            c.arc(0.5, -18.5, 4.9, Math.PI, Math.PI * 2);
            c.fill();
            c.fillStyle = '#fff';
            circle(c, 0.5, -24.2, 1.9);
        } else if (sk.hat === 'cap') {
            c.beginPath();
            c.arc(0.5, -18.5, 4.8, Math.PI, Math.PI * 2);
            c.fill();
            c.fillRect(1, -19.5, 6.5, 1.6);
        } else if (sk.hat === 'earmuffs') {
            c.strokeStyle = sk.hatColor;
            c.lineWidth = 1.4;
            c.beginPath();
            c.arc(0.5, -18, 5.2, Math.PI * 1.05, Math.PI * 1.95);
            c.stroke();
            c.fillStyle = '#3f2a1d';
            c.beginPath();
            c.arc(0.5, -18.6, 4.6, Math.PI * 1.1, Math.PI * 1.9);
            c.fill();
            c.fillStyle = sk.hatColor;
            circle(c, -3.6, -17.5, 2);
        } else {
            c.fillStyle = '#3f2a1d';
            c.beginPath();
            c.arc(0.5, -18.6, 4.8, Math.PI * 0.95, Math.PI * 2.05);
            c.fill();
            c.fillRect(-4.2, -19, 2.5, 6);
        }
        c.restore();
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
            c.fillStyle = 'rgba(0,0,0,0.4)';
            c.beginPath();
            c.ellipse(0, 2, 38, 6, 0, 0, Math.PI * 2);
            c.fill();
        }
        c.translate(0, -A.lift / s);
        if (fast) c.rotate(0.08);
        c.lineCap = 'round';
        c.lineJoin = 'round';

        // wheels
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
        c.strokeStyle = '#94a3b8';
        c.lineWidth = 3;
        line(c, -26, -20, -22, -10);
        line(c, 28, -20, 22, -10);
        line(c, -24, -14, 24, -14);
        // handle
        c.strokeStyle = '#cbd5e1';
        line(c, -36, -60, -50, -70);
        c.fillStyle = '#ef4444';
        circle(c, -50, -70, 4.5);

        c.translate(0, bob);
        // robot body (behind the basket front)
        c.fillStyle = '#5eead4';
        rr(c, -17, -64, 36, 30, 12);
        c.fill();
        // a lone paper sticking out of the cart after the shopping trip
        if (A.paper) {
            c.save();
            c.translate(24, -58);
            c.rotate(0.35);
            c.fillStyle = '#f8fafc';
            c.fillRect(-7, -22, 14, 22);
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
        c.fillStyle = 'rgba(203,213,225,0.2)';
        basket();
        c.fill();
        c.strokeStyle = '#cbd5e1';
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
        c.fillStyle = '#f1f5f9';
        rr(c, -23, -108, 48, 44, 16);
        c.fill();
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
            c.beginPath();
            if (A.mood === 'sad') {
                line(c, -11, -93, -4, -95.5);
                line(c, 13, -93, 6, -95.5);
                c.beginPath();
                c.arc(1, -74, 4, Math.PI * 1.15, Math.PI * 1.85);
            } else {
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
            c.fillStyle = '#7dd3fc';
            c.beginPath();
            c.moveTo(29, -104);
            c.quadraticCurveTo(34, -96, 29, -94);
            c.quadraticCurveTo(24, -96, 29, -104);
            c.fill();
        }

        // propeller beanie
        const BEANIE = ['#ef4444', '#facc15', '#3b82f6', '#22c55e'];
        BEANIE.forEach((col, k) => {
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
        c.fillStyle = '#ef4444';
        c.beginPath();
        c.ellipse(1 - 8 * spin, -128, Math.max(1, 8 * Math.abs(spin)), 2.6, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#3b82f6';
        c.beginPath();
        c.ellipse(1 + 8 * spin, -128, Math.max(1, 8 * Math.abs(spin)), 2.6, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#facc15';
        circle(c, 1, -128, 2.2);
        c.restore();
    }

    // ---------- tasks (each returns true when finished) ----------
    const move = (target, speed, maxSec = Infinity) => {
        let start = null;
        return dt => {
            const p = target();
            if (!start) {
                start = { y: A.y, s: A.s, d: Math.hypot(p.x - A.x, p.y - A.y) || 1 };
                speed = Math.max(speed, start.d / maxSec);
            }
            const dx = p.x - A.x, dy = p.y - A.y, d = Math.hypot(dx, dy);
            const step = reduce ? Infinity : speed * dt;
            if (Math.abs(dx) > 1) A.face = dx < 0 ? -1 : 1;
            if (d <= step) {
                Object.assign(A, p, { lift: 0 });
                return true;
            }
            A.x += dx / d * step;
            A.y += dy / d * step;
            A.speed = speed;
            A.dist += step / A.s;
            const left = clamp((d - step) / start.d, 0, 1);
            A.s = p.s + (start.s - p.s) * left;
            // hop up with the propeller when changing levels
            A.lift = Math.abs(p.y - start.y) > 30 ? Math.sin((1 - left) * Math.PI) * Math.min(70, start.d * 0.25) : 0;
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

    // ---------- story ----------
    function intro() {
        if (started || !stores.length) return;
        started = true;
        const f = front();
        const ground = stores.filter(s => s.level === stores[0].level);
        const st = ground.reduce((a, b) => Math.abs(b.x + b.w / 2 - f.x) < Math.abs(a.x + a.w / 2 - f.x) ? b : a);
        const i = stores.indexOf(st);
        Object.assign(A, doorOf(i)(), { alpha: 0 });
        queue.push(wait(600), glow(i), fade(1, 350), move(front, 150), call(showAsk));
    }

    function shop(q) {
        busy = true;
        hideBubble();
        A.mood = 'go';
        A.paper = false;
        // Visit stores across all levels in random order (up to 9); double back for at least 7 visits.
        const order = [...stores.keys()].sort(() => Math.random() - 0.5).slice(0, 9);
        while (order.length < 7) {
            const i = Math.floor(Math.random() * stores.length);
            if (i !== order[order.length - 1]) order.push(i);
        }
        let checked = 0;
        const setStatus = () => {
            status.textContent = `Searching for “${q}” · ${checked}/${order.length} store visits`;
        };
        queue.push(call(() => { setStatus(); status.hidden = false; }));
        order.forEach(i => {
            queue.push(
                move(doorOf(i), 1900),
                glow(i), fade(0, 90), wait(170),
                call(() => {
                    checked++;
                    setStatus();
                    const st = stores[i];
                    if (st) pops.push({ x: st.x + st.w / 2, y: st.top + st.h * 0.42, text: POPS[Math.floor(Math.random() * POPS.length)], t0: time });
                }),
                fade(1, 90)
            );
        });
        queue.push(
            wait(250),
            call(() => {
                status.hidden = true;
                A.mood = 'sad';
                A.paper = true;
            }),
            move(front, 170, 2.5),
            call(() => showAnswer(q, order.length))
        );
    }

    // ---------- speech bubble ----------
    function popIn() {
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
        answerSub.textContent = `I ran in and out of ${n} stores looking for “${q}”. Every single one sells papers.`;
        popIn();
    }

    function hideBubble() {
        bubble.hidden = true;
    }

    function placeBubble() {
        if (bubble.hidden) return;
        const headY = A.y - A.lift - (BOT_H + 4) * A.s;
        const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
        const left = clamp(A.x - bw / 2, 12, vw - bw - 12);
        bubble.style.left = left + 'px';
        bubble.style.top = headY - bh - 14 + 'px';
        bubble.style.setProperty('--tail-x', clamp(A.x - left, 20, bw - 20) + 'px');
    }

    form.addEventListener('submit', e => {
        e.preventDefault();
        if (busy) return;
        shop(input.value.trim().slice(0, 60) || 'something nice');
    });
    againBtn.addEventListener('click', showAsk);

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
        updateSkaters(dt);

        const sy = clamp(window.scrollY, 0, Math.max(0, H - vh));
        bg.setTransform(dpr, 0, 0, dpr, 0, 0);
        bg.clearRect(0, 0, vw, vh);
        const ch = Math.min(vh, H);
        bg.drawImage(scene, 0, sy * dpr, W * dpr, ch * dpr, 0, 0, W, ch);
        bg.save();
        bg.translate(0, -sy);
        stores.forEach(st => {
            if (st.glow > 0) {
                bg.globalAlpha = st.glow * 0.6;
                bg.fillStyle = st.color;
                bg.fillRect(...st.door);
                bg.globalAlpha = 1;
            }
            if (Math.sin(time * 0.7 + st.seed) * Math.sin(time * 11 + st.seed * 3) > 0.94) {
                bg.fillStyle = 'rgba(13,12,18,0.6)';
                bg.fillRect(...st.sign);
            }
        });
        skaters.forEach(sk => { if (sk.on) drawSkater(bg, sk); });
        bg.restore();

        fg.setTransform(dpr, 0, 0, dpr, 0, 0);
        fg.clearRect(0, 0, vw, vh);
        fg.save();
        fg.translate(0, -sy);
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
                drawBot(fg, p.x, p.y, p.s, A.alpha * 0.12 * (k + 1) / trail.length, true);
            });
            A.lift = lift;
            drawBot(fg, A.x, A.y, A.s, A.alpha, false);
        }
        fg.restore();
        placeBubble();
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
