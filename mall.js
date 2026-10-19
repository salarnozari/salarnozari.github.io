(() => {
    const page = document.querySelector('.single-page');
    const card = document.querySelector('.card');
    const spacer = document.getElementById('mall-spacer');
    const bgCanvas = document.getElementById('mall-bg');
    const fgCanvas = document.getElementById('mall-fg');
    if (!page || !card || !spacer || !bgCanvas || !fgCanvas) return;
    const bg = bgCanvas.getContext('2d');
    const fg = fgCanvas.getContext('2d');
    const scene = document.createElement('canvas');

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

    const POPS = ['only papers', 'papers?!', 'more papers', 'just PDFs', 'a footnote',
        'an appendix', 'papers again', 'nope', 'Table 3', 'a draft'];
    const SEARCH_MS = 5000, INSIDE_MS = 320, RETURN_MS = 900;
    const COL = {
        floor: '#f6f5f3', dot: 'rgba(28,25,23,0.06)', store: '#f1efeb', wall: '#dcd7d1',
        front: '#cdc8c1', jamb: '#b8b1a9', fix: '#e3dfd9', rack: '#d9d4cd', plant: '#cdd6c9',
        corner: '#e9e6e2', ice: '#eef5f9', iceEdge: '#cfe0ea',
        ink: '#1c1917', accent: '#2563eb', skater: '#475569', trail: '100,140,170'
    };
    const JACKETS = ['#8fa3b8', '#c49a8a', '#9bb5a0', '#b7a6c9', '#d4b483', '#7d8a99', '#c7a1a8', '#a8b3a0'];
    const HAIR = ['#2f2a26', '#5a4636', '#8a6a4a', '#c9a46a', '#1f1f1f', '#6b4a3a'];
    const SKIN = ['#f1d3b8', '#e8c4a0', '#d4a37c', '#a87452', '#7a4f35'];

    function makePerson(rnd, i) {
        const pick = arr => arr[Math.floor(rnd() * arr.length)];
        return {
            jacket: JACKETS[i % JACKETS.length], hair: pick(HAIR), skin: pick(SKIN),
            pants: pick(['#3f3a36', '#4b5563', '#57534e', '#334155']),
            hat: rnd() < 0.25 ? pick(JACKETS) : null, bag: rnd() < 0.35 ? pick(['#e7d8c3', '#d6d3d1', '#c9b8a6']) : null
        };
    }

    function drawPerson(c, p, x, y, ang, phase, mode, size) {
        const swing = mode === 'stand' ? 0 : Math.sin(phase);
        c.save();
        c.translate(x, y);
        c.scale(size, size);
        c.fillStyle = 'rgba(28,25,23,0.10)';
        c.beginPath();
        c.ellipse(1.2, 1.8, 5.5, 8.5, ang, 0, Math.PI * 2);
        c.fill();
        c.rotate(ang);
        const stride = mode === 'skate' ? 5.5 : 4;
        c.fillStyle = p.pants;
        [[1, 2.6], [-1, -2.6]].forEach(([k, side]) => {
            c.beginPath();
            c.ellipse(k * swing * stride + 1, side, 2.6, 1.5, 0, 0, Math.PI * 2);
            c.fill();
        });
        const reach = mode === 'skate' ? 11 : 8.2;
        c.fillStyle = p.jacket;
        [[-1, 1], [1, -1]].forEach(([k, side]) => {
            const hx = mode === 'skate' ? 0.5 : k * swing * 3;
            c.strokeStyle = p.jacket;
            c.lineWidth = 2.6;
            c.lineCap = 'round';
            line(c, 0, side * 5.5, hx, side * reach);
            c.fillStyle = p.skin;
            circle(c, hx, side * reach, 1.5);
        });
        if (p.bag && mode !== 'skate') {
            c.fillStyle = p.bag;
            c.fillRect(-3 * swing - 2, 9.6, 4.5, 3.4);
        }
        c.fillStyle = p.jacket;
        c.beginPath();
        c.ellipse(0, 0, 3.8, 7.2, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.12)';
        c.beginPath();
        c.ellipse(0.8, 0, 2, 5.6, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = p.skin;
        circle(c, 1.3, 0, 3.6);
        c.fillStyle = p.hat || p.hair;
        c.beginPath();
        c.arc(1.3, 0, 3.8, p.hat ? 0 : Math.PI * 0.6, p.hat ? Math.PI * 2 : Math.PI * 1.4);
        if (!p.hat) c.ellipse(0.4, 0, 3, 3.6, 0, Math.PI * 1.4, Math.PI * 0.6, true);
        c.fill();
        if (p.hat) {
            c.fillStyle = 'rgba(255,255,255,0.7)';
            circle(c, 1.3, 0, 1.2);
        }
        c.restore();
    }

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    let vw = 0, vh = 0, W = 0, H = 0, dpr = 1, mobile = false, R = 11;
    let rink = null, track = null, loop = null, stores = [], corners = [], walkers = [], skaters = [];
    let time = 0, started = false, busy = false, searching = false;
    const A = { x: 0, y: 0, alpha: 0, ang: 0, paper: false };
    const queue = [], route = [], pops = [];

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

    function loopPoint(L, t, lane) {
        const x = L.x - lane, y = L.y - lane, w = L.w + 2 * lane, h = L.h + 2 * lane;
        const r = Math.max(2, L.r + lane), sw = w - 2 * r, sh = h - 2 * r, arc = Math.PI * r / 2;
        let d = (((t % 1) + 1) % 1) * (2 * sw + 2 * sh + 4 * arc);
        const corner = (cx, cy, a0) => {
            const a = a0 + d / r;
            return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
        };
        if (d < sw) return { x: x + r + d, y };
        if ((d -= sw) < arc) return corner(x + w - r, y + r, -Math.PI / 2);
        if ((d -= arc) < sh) return { x: x + w, y: y + r + d };
        if ((d -= sh) < arc) return corner(x + w - r, y + h - r, 0);
        if ((d -= arc) < sw) return { x: x + w - r - d, y: y + h };
        if ((d -= sw) < arc) return corner(x + r, y + h - r, Math.PI / 2);
        if ((d -= arc) < sh) return { x, y: y + h - r - d };
        d -= sh;
        return corner(x + r, y + r, Math.PI);
    }
    const perimeter = L => 2 * (L.w + L.h);

    function nearestT(L, p) {
        let best = 0, bd = Infinity;
        for (let i = 0; i < 400; i++) {
            const q = loopPoint(L, i / 400, 0), d = Math.hypot(q.x - p.x, q.y - p.y);
            if (d < bd) {
                bd = d;
                best = i / 400;
            }
        }
        return best;
    }

    function legPath(a, b) {
        const t0 = nearestT(loop, a), t1 = nearestT(loop, b);
        let d = t1 - t0;
        d -= Math.round(d);
        const n = Math.max(1, Math.ceil(Math.abs(d) / 0.01));
        const pts = [a];
        for (let i = 0; i <= n; i++) pts.push(loopPoint(loop, t0 + d * i / n, 0));
        pts.push(b);
        return pts;
    }

    const pathLen = pts => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);

    function pathAt(pts, f, total) {
        let d = f * total;
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y);
            if (d <= l || i === pts.length - 1) {
                const k = l ? Math.min(1, d / l) : 1;
                return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx: b.x - a.x, dy: b.y - a.y };
            }
            d -= l;
        }
        return pts[pts.length - 1];
    }

    function band(x, y, w, h, horizontal, out, len) {
        const span = horizontal ? w : h, n = Math.max(1, Math.round(span / len)), step = span / n;
        for (let i = 0; i < n; i++) {
            const sx = horizontal ? x + i * step : x, sy = horizontal ? y : y + i * step;
            const sw = horizontal ? step : w, sh = horizontal ? h : step;
            const fx = out.x > 0 ? sx + sw : out.x < 0 ? sx : sx + sw / 2;
            const fy = out.y > 0 ? sy + sh : out.y < 0 ? sy : sy + sh / 2;
            const n0 = stores.length;
            stores.push({
                x: sx, y: sy, w: sw, h: sh, out, door: { x: fx, y: fy },
                kind: (n0 * 3) % 5, plant: (n0 * 7) % 5 === 2, glow: 0
            });
        }
    }

    function layout() {
        mobile = getComputedStyle(page).position !== 'fixed';
        vw = document.documentElement.clientWidth;
        vh = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        [bgCanvas, fgCanvas].forEach(cv => {
            cv.width = Math.round(vw * dpr);
            cv.height = Math.round(vh * dpr);
        });
        spacer.style.height = mobile ? '560px' : '';
        const sy = window.scrollY;
        const cr = card.getBoundingClientRect();
        const cb = { x: cr.left, y: cr.top + sy, w: cr.width, h: cr.height };
        W = vw;
        H = mobile ? spacer.getBoundingClientRect().bottom + sy : vh;
        R = mobile ? 10 : 11;

        const px = mobile ? 12 : 56, py = mobile ? 16 : 44;
        rink = { x: cb.x - px, y: cb.y - py, w: cb.w + 2 * px, h: cb.h + 2 * py, r: mobile ? 24 : 48 };
        track = { x: cb.x - px * 0.5, y: cb.y - py * 0.5, w: cb.w + px, h: cb.h + py, r: mobile ? 14 : 30 };

        stores = [];
        corners = [];
        if (mobile) {
            const D = clamp(W * 0.28, 84, 120), y0 = rink.y + rink.h + 36, y1 = H - 16;
            band(0, y0, D, y1 - y0, false, { x: 1, y: 0 }, 104);
            band(W - D, y0, D, y1 - y0, false, { x: -1, y: 0 }, 104);
            loop = { x: D + 22, y: y0 + 14, w: W - 2 * D - 44, h: y1 - y0 - 28, r: 18 };
        } else {
            const D = clamp(Math.min(W, H) * 0.14, 72, 120), gap = D + 56;
            const top = rink.y >= gap, bottom = H - rink.y - rink.h >= gap;
            const left = rink.x >= gap, right = W - rink.x - rink.w >= gap;
            const y0 = top ? D : 0, y1 = bottom ? H - D : H;
            const x0 = left ? D : 0, x1 = right ? W - D : W;
            if (top) band(x0, 0, x1 - x0, D, true, { x: 0, y: 1 }, 170);
            if (right) band(W - D, y0, D, y1 - y0, false, { x: -1, y: 0 }, 150);
            if (bottom) band(x0, H - D, x1 - x0, D, true, { x: 0, y: -1 }, 170);
            if (left) band(0, y0, D, y1 - y0, false, { x: 1, y: 0 }, 150);
            corners = [[top, left, 0, 0], [top, right, W - D, 0], [bottom, left, 0, H - D], [bottom, right, W - D, H - D]]
                .filter(k => k[0] && k[1]).map(k => ({ x: k[2], y: k[3], w: D, h: D }));
            const lx = (x0 + rink.x) / 2, ly = (y0 + rink.y) / 2;
            loop = { x: lx, y: ly, w: (x1 + rink.x + rink.w) / 2 - lx, h: (y1 + rink.y + rink.h) / 2 - ly, r: 36 };
        }

        renderScene();
        buildPeople();
    }

    function renderScene() {
        scene.width = Math.round(W * dpr);
        scene.height = Math.round(H * dpr);
        const c = scene.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.fillStyle = COL.floor;
        c.fillRect(0, 0, W, H);
        c.fillStyle = COL.dot;
        for (let y = 12; y < H; y += 24) {
            for (let x = 12; x < W; x += 24) c.fillRect(x, y, 1.2, 1.2);
        }

        corners.forEach(k => {
            c.fillStyle = COL.corner;
            c.fillRect(k.x, k.y, k.w, k.h);
        });
        stores.forEach(st => drawStore(c, st));

        c.save();
        c.shadowColor = 'rgba(28,25,23,0.08)';
        c.shadowBlur = 24;
        c.shadowOffsetY = 6;
        c.fillStyle = COL.ice;
        rr(c, rink.x, rink.y, rink.w, rink.h, rink.r);
        c.fill();
        c.restore();
        c.strokeStyle = COL.iceEdge;
        c.lineWidth = 2;
        rr(c, rink.x + 1, rink.y + 1, rink.w - 2, rink.h - 2, rink.r - 1);
        c.stroke();
        c.strokeStyle = 'rgba(37,99,235,0.08)';
        c.lineWidth = 1.5;
        rr(c, rink.x + 8, rink.y + 8, rink.w - 16, rink.h - 16, rink.r - 8);
        c.stroke();
    }

    function storeFrame(st) {
        const horizontal = st.out.y !== 0;
        const l = horizontal ? st.w : st.h, d = horizontal ? st.h : st.w;
        if (st.out.y > 0) return { m: [1, 0, 0, -1, st.x, st.y + st.h], l, d };
        if (st.out.y < 0) return { m: [1, 0, 0, 1, st.x, st.y], l, d };
        if (st.out.x > 0) return { m: [0, 1, -1, 0, st.x + st.w, st.y], l, d };
        return { m: [0, 1, 1, 0, st.x, st.y], l, d };
    }

    const doorWidth = l => clamp(0.3 * l, 28, 44);

    function drawStore(c, st) {
        const { m, l, d } = storeFrame(st);
        c.save();
        c.transform(...m);
        c.fillStyle = COL.store;
        c.fillRect(0, 0, l, d);
        c.fillStyle = COL.wall;
        c.fillRect(0, d - 4, l, 4);
        c.fillRect(0, 0, 1.5, d);
        c.fillRect(l - 1.5, 0, 1.5, d);

        const v0 = 0.28 * d, v1 = d - 12, u0 = 8, u1 = l - 8, vm = (v0 + v1) / 2;
        c.fillStyle = COL.fix;
        if (st.kind === 0) {
            const n = mobile || l < 130 ? 3 : 4, len = Math.min(0.45 * d, v1 - v0);
            for (let i = 0; i < n; i++) {
                rr(c, l * (i + 1) / (n + 1) - 2.5, v1 - len, 5, len, 2);
                c.fill();
            }
        } else if (st.kind === 1) {
            c.fillRect(u0, v1 - 5, u1 - u0, 5);
            rr(c, l / 2 - 0.16 * l, vm - 0.09 * d - 3, 0.32 * l, 0.18 * d, 3);
            c.fill();
        } else if (st.kind === 2) {
            c.fillRect(l / 2 - 0.25 * l, v1 - 6, 0.5 * l, 6);
            const r = clamp(0.06 * Math.min(l, d), 4, 7), n = mobile ? 3 : 4;
            for (let i = 0; i < n; i++) circle(c, l * (i + 1) / (n + 1), i % 2 ? v0 + r + 2 : v1 - 6 - r - 8, r);
        } else if (st.kind === 3) {
            c.fillRect(u0, v1 - 4, u1 - u0, 4);
            c.strokeStyle = COL.rack;
            c.lineWidth = 1.5;
            [l / 3, 2 * l / 3].forEach(u => {
                c.beginPath();
                c.arc(u, vm - 2, 8, 0, Math.PI * 2);
                c.stroke();
            });
        } else {
            [[0.3, 0], [0.5, 5], [0.7, 0]].forEach(([f, dv]) => c.fillRect(l * f - 4.5, vm - 6 + dv, 9, 9));
        }
        if (st.plant) {
            c.fillStyle = COL.plant;
            circle(c, u1 - 2, v0 + 2, 4);
        }
        drawFront(c, l, COL.front, COL.jamb, 1);
        c.restore();
    }

    function drawFront(c, l, glass, jamb, width) {
        const dw = doorWidth(l), a = l / 2 - dw / 2, b = l / 2 + dw / 2;
        c.strokeStyle = glass;
        c.lineWidth = width;
        line(c, 0, 0.5, a, 0.5);
        line(c, b, 0.5, l, 0.5);
        c.strokeStyle = jamb;
        c.lineWidth = 2;
        line(c, a, 0, a, 6);
        line(c, b, 0, b, 6);
    }

    function drawVisit(c, st) {
        const { m, l, d } = storeFrame(st);
        c.save();
        c.globalAlpha = st.glow;
        c.transform(...m);
        c.fillStyle = 'rgba(37,99,235,0.08)';
        c.fillRect(1.5, 0, l - 3, d - 4);
        drawFront(c, l, COL.accent, COL.accent, 1.5);
        c.restore();
    }

    function buildPeople() {
        const rnd = seeded(77);
        const nw = clamp(Math.round(perimeter(loop) / (mobile ? 110 : 90)), 4, 22);
        walkers = Array.from({ length: nw }, (_, i) => ({
            t: (i + rnd() * 0.7) / nw, lane: (rnd() - 0.5) * (mobile ? 18 : 30), speed: 22 + rnd() * 16,
            dir: rnd() < 0.5 ? -1 : 1, pause: 0, phase: rnd() * 6, ang: 0, p: makePerson(rnd, i)
        }));
        const ns = clamp(Math.round(perimeter(track) / 220), 3, 9);
        if (skaters.length !== ns) {
            skaters = Array.from({ length: ns }, (_, i) => ({
                t: i / ns + rnd() * 0.04, lane: (rnd() - 0.5) * 10, speed: 55 + rnd() * 45, hist: [],
                phase: rnd() * 6, p: makePerson(rnd, i + 3)
            }));
        }
        skaters.forEach(sk => { sk.hist = []; });
    }

    function updatePeople(dt) {
        const pw = perimeter(loop), pt = perimeter(track);
        walkers.forEach(wk => {
            if (wk.pause > 0) {
                wk.pause -= dt;
                return;
            }
            wk.t += wk.dir * wk.speed * dt / pw;
            wk.phase += dt * wk.speed * 0.32;
            if (Math.random() < dt * 0.06) wk.pause = 1 + Math.random() * 2.5;
            if (Math.random() < dt * 0.02) wk.dir *= -1;
        });
        skaters.forEach(sk => {
            sk.t += sk.speed * dt / pt;
            sk.phase += dt * sk.speed * 0.06;
            const p = loopPoint(track, sk.t, sk.lane);
            sk.hist.push({ x: p.x, y: p.y });
            if (sk.hist.length > 26) sk.hist.shift();
        });
    }

    function drawPeople(c) {
        skaters.forEach(sk => {
            const h = sk.hist;
            for (let i = 1; i < h.length; i++) {
                c.strokeStyle = `rgba(${COL.trail},${0.4 * i / h.length})`;
                c.lineWidth = 1.5;
                line(c, h[i - 1].x, h[i - 1].y, h[i].x, h[i].y);
            }
            const p = h[h.length - 1], q = h[h.length - 3];
            if (!p || !q) return;
            drawPerson(c, sk.p, p.x, p.y, Math.atan2(p.y - q.y, p.x - q.x), sk.phase, 'skate', mobile ? 1 : 1.3);
        });
        walkers.forEach(wk => {
            const p = loopPoint(loop, wk.t, wk.lane), q = loopPoint(loop, wk.t + wk.dir * 0.003, wk.lane);
            const target = Math.atan2(q.y - p.y, q.x - p.x);
            let d = target - wk.ang;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            wk.ang += d * 0.2;
            drawPerson(c, wk.p, p.x, p.y, wk.ang, wk.phase, wk.pause > 0 ? 'stand' : 'walk', mobile ? 1 : 1.3);
        });
    }

    function drawAgent(c) {
        c.save();
        c.globalAlpha = A.alpha;
        c.translate(A.x, A.y);
        if (searching) {
            const k = (time * 1.3) % 1;
            c.strokeStyle = `rgba(37,99,235,${0.45 * (1 - k)})`;
            c.lineWidth = 1.5;
            c.beginPath();
            c.arc(0, 0, R + 3 + k * 16, 0, Math.PI * 2);
            c.stroke();
        }
        const r = R * (1 + (searching ? 0 : 0.035 * Math.sin(time * 2.4)));
        c.fillStyle = 'rgba(28,25,23,0.14)';
        circle(c, 1, 2.5, r);
        c.fillStyle = COL.ink;
        circle(c, 0, 0, r);
        c.fillStyle = '#ffffff';
        circle(c, Math.cos(A.ang) * r * 0.45, Math.sin(A.ang) * r * 0.45, r * 0.24);
        if (A.paper) {
            c.translate(r + 2, -r - 2);
            c.rotate(0.25);
            c.fillStyle = '#ffffff';
            c.strokeStyle = '#a8a29e';
            c.lineWidth = 1;
            c.fillRect(-6, -8, 12, 16);
            c.strokeRect(-6, -8, 12, 16);
            c.fillStyle = '#c9c5c0';
            for (let l = 0; l < 4; l++) c.fillRect(-4, -5 + l * 3.5, 8, 1);
        }
        c.restore();
    }

    function drawRoute(c) {
        for (let i = route.length - 1; i >= 0; i--) {
            if (time - route[i].t > 2.4) route.splice(i, 1);
        }
        c.lineWidth = 2;
        c.lineCap = 'round';
        for (let i = 1; i < route.length; i++) {
            const a = route[i - 1], b = route[i];
            c.strokeStyle = `rgba(37,99,235,${0.5 * Math.max(0, 1 - (time - b.t) / 2.4)})`;
            line(c, a.x, a.y, b.x, b.y);
        }
    }

    function drawPops(c) {
        for (let k = pops.length - 1; k >= 0; k--) {
            const p = pops[k], t = time - p.t0;
            if (t > 1.2) {
                pops.splice(k, 1);
                continue;
            }
            c.globalAlpha = Math.min(1, (1.2 - t) / 0.4);
            c.font = '500 12px Inter, sans-serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            const tw = c.measureText(p.text).width + 18, y = p.y - t * 16;
            c.fillStyle = '#ffffff';
            c.strokeStyle = COL.wall;
            c.lineWidth = 1;
            rr(c, p.x - tw / 2, y - 11, tw, 22, 11);
            c.fill();
            c.stroke();
            c.fillStyle = COL.ink;
            c.fillText(p.text, p.x, y + 0.5);
            c.globalAlpha = 1;
        }
    }

    function boxRect() {
        const bw = bubble.hidden ? Math.min(480, vw - 24) : bubble.offsetWidth;
        const bh = bubble.hidden ? 170 : bubble.offsetHeight;
        const left = (vw - bw) / 2;
        let top;
        if (mobile) top = rink.y + rink.h + 12;
        else if (rink.y - bh - 16 >= 8) top = rink.y - bh - 16;
        else if (rink.y + rink.h + 16 + bh <= vh - 8) top = rink.y + rink.h + 16;
        else top = 8;
        return { left, top, bw, bh };
    }
    const askSpot = () => {
        const b = boxRect();
        if (mobile) return { x: vw - 36, y: b.top + b.bh + 28 };
        return { x: Math.max(24, b.left - 30), y: b.top + b.bh / 2 };
    };
    const restSpot = () => mobile ? { x: vw / 2, y: H - 30 } : { x: loop.x + loop.w, y: rink.y + rink.h / 2 };
    const doorPt = st => ({ x: st.door.x + st.out.x * 16, y: st.door.y + st.out.y * 16 });

    function visibleStores() {
        const y0 = mobile ? rink.y + rink.h : 0;
        return stores.filter(st => {
            const p = doorPt(st);
            return p.x > 16 && p.x < vw - 16 && p.y > y0 && p.y < H - 8;
        });
    }

    function face(dx, dy) {
        if (Math.hypot(dx, dy) > 0.5) A.ang = Math.atan2(dy, dx);
    }

    const move = (target, speed) => dt => {
        const p = target();
        const dx = p.x - A.x, dy = p.y - A.y, d = Math.hypot(dx, dy);
        const step = reduce ? Infinity : speed * dt;
        face(dx, dy);
        if (d <= step) {
            A.x = p.x;
            A.y = p.y;
            return true;
        }
        A.x += dx / d * step;
        A.y += dy / d * step;
        return false;
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
                Object.assign(A, segs[segs.length - 1].to, { alpha: 1 });
                onDone();
                return true;
            }
            const sg = segs[j], f = (t - acc) / sg.dur;
            if (sg.type === 'move') {
                const p = pathAt(sg.path, reduce ? 1 : ease(f), sg.len);
                face(p.dx || 0, p.dy || 0);
                A.x = p.x;
                A.y = p.y;
                A.alpha = 1;
                if (searching) route.push({ x: A.x, y: A.y, t: time });
            } else {
                A.alpha = f < 0.25 ? 1 - f / 0.25 : f > 0.75 ? (f - 0.75) / 0.25 : 0;
            }
            return false;
        };
    };

    function intro() {
        if (started || !stores.length) return;
        started = true;
        const f = askSpot();
        const list = visibleStores().length ? visibleStores() : stores;
        const dist = st => Math.hypot(doorPt(st).x - f.x, doorPt(st).y - f.y);
        const st = list.reduce((a, b) => (dist(b) < dist(a) ? b : a));
        Object.assign(A, doorPt(st), { alpha: 0 });
        queue.push(wait(600), call(() => { st.glow = 1; }), fade(1, 350), move(askSpot, 240), call(showAsk));
    }

    function shop(q) {
        busy = true;
        searching = true;
        hideBubble();
        A.paper = false;
        const pool = visibleStores();
        const k = Math.min(Math.max(pool.length, 1), 4 + Math.floor(Math.random() * 3));
        const order = (pool.length ? pool : stores).slice().sort(() => Math.random() - 0.5).slice(0, k);
        let prev = { x: A.x, y: A.y };
        const stops = order.map(doorPt);
        const legs = stops.map(p => {
            const path = legPath(prev, p);
            prev = p;
            return { path, len: pathLen(path) };
        });
        const sum = legs.reduce((a, l) => a + l.len, 0) || 1;
        const travel = SEARCH_MS - RETURN_MS - order.length * INSIDE_MS;
        const setStatus = n => {
            status.textContent = `Searching for “${q}” · store ${n} of ${order.length}`;
        };

        const segs = [];
        stops.forEach((p, n) => {
            segs.push({ type: 'move', ...legs[n], to: p, dur: travel * legs[n].len / sum });
            segs.push({
                type: 'in', dur: INSIDE_MS, start: () => {
                    const st = order[n];
                    st.glow = 1;
                    pops.push({ x: st.x + st.w / 2, y: st.y + st.h / 2 - 16, text: POPS[Math.floor(Math.random() * POPS.length)], t0: time });
                    setStatus(n + 1);
                }
            });
        });
        const home = askSpot(), back = legPath(prev, home);
        segs.push({
            type: 'move', path: back, len: pathLen(back), to: home, dur: RETURN_MS, start: () => {
                status.hidden = true;
                searching = false;
                A.paper = true;
            }
        });
        setStatus(0);
        status.hidden = false;
        queue.push(timeline(segs, () => showAnswer(q, order.length)));
    }

    function popIn() {
        chip.hidden = true;
        bubble.hidden = false;
        bubble.classList.remove('pop');
        void bubble.offsetWidth;
        bubble.classList.add('pop');
    }

    function showAsk() {
        busy = false;
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
        answerSub.textContent = `I checked ${n} stores for “${q}”. Turns out these stores are just categories used in papers.`;
        popIn();
    }

    function hideBubble() {
        bubble.hidden = true;
    }

    function dismiss() {
        if (busy) return;
        busy = true;
        hideBubble();
        queue.push(move(restSpot, 420), call(() => {
            busy = false;
            A.paper = false;
            chip.hidden = false;
        }));
    }

    function summon() {
        if (busy) return;
        busy = true;
        chip.hidden = true;
        queue.push(move(askSpot, 420), call(showAsk));
    }

    function placeUI() {
        if (!bubble.hidden) {
            const b = boxRect();
            bubble.style.left = b.left + 'px';
            bubble.style.top = b.top + 'px';
            const side = !mobile;
            bubble.classList.toggle('tail-left', side);
            if (side) bubble.style.setProperty('--tail-y', clamp(A.y - b.top, 22, b.bh - 22) + 'px');
            else bubble.style.setProperty('--tail-x', clamp(A.x - b.left, 22, b.bw - 22) + 'px');
        }
        if (!chip.hidden) {
            const cw = chip.offsetWidth, ch = chip.offsetHeight;
            const left = clamp(A.x - cw / 2, 8, vw - cw - 8);
            chip.style.left = left + 'px';
            chip.style.top = A.y - R - ch - 12 + 'px';
            chip.style.setProperty('--tail-x', clamp(A.x - left, 14, cw - 14) + 'px');
        }
    }

    form.addEventListener('submit', e => {
        e.preventDefault();
        if (busy) return;
        shop(input.value.trim().slice(0, 60) || 'something nice');
    });
    againBtn.addEventListener('click', showAsk);
    bubble.querySelectorAll('.bubble-dismiss').forEach(b => b.addEventListener('click', dismiss));
    chip.addEventListener('click', summon);

    let last = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        time += dt;

        if (queue.length && queue[0](dt)) queue.shift();
        if (started && !busy && !queue.length) {
            const t = chip.hidden ? askSpot() : restSpot();
            const k = Math.min(1, dt * 6);
            A.x += (t.x - A.x) * k;
            A.y += (t.y - A.y) * k;
        }
        stores.forEach(st => { st.glow = Math.max(0, st.glow - dt * 1.2); });
        updatePeople(dt);

        const sy = clamp(window.scrollY, 0, Math.max(0, H - vh));
        bg.setTransform(dpr, 0, 0, dpr, 0, 0);
        bg.clearRect(0, 0, vw, vh);
        const ch = Math.min(vh, H);
        bg.drawImage(scene, 0, sy * dpr, W * dpr, ch * dpr, 0, 0, W, ch);
        bg.save();
        bg.translate(0, -sy);
        stores.forEach(st => {
            if (st.glow > 0) drawVisit(bg, st);
        });
        drawPeople(bg);
        bg.restore();

        fg.setTransform(dpr, 0, 0, dpr, 0, 0);
        fg.clearRect(0, 0, vw, vh);
        fg.save();
        fg.translate(0, -sy);
        drawRoute(fg);
        drawPops(fg);
        if (started && A.alpha > 0.01) drawAgent(fg);
        fg.restore();
        placeUI();
        requestAnimationFrame(frame);
    }

    layout();
    window.addEventListener('resize', layout);
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(card);
    if (document.fonts) document.fonts.ready.then(layout);

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
