// Shopping-agent mall scene for the home page background.
(() => {
    const mall = document.getElementById('mall');
    if (!mall) return;
    const canvas = mall.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const card = document.querySelector('.card');
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
        ['SLIDES', '#e879f9'], ['REBUTTALS', '#fbbf24'], ['TABLES', '#38bdf8']
    ];
    const POPS = ['only papers', 'papers', 'more papers', 'just PDFs', 'an appendix',
        'footnotes', 'a draft', 'nope', 'tables', 'a rebuttal'];

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    let W = 0, H = 0, L = null, stores = [];
    let time = 0, started = false, busy = false;
    const A = { x: 0, y: 0, alpha: 0, face: 1, phase: 0, speed: 0 };
    const queue = [], trail = [], pops = [];

    function seeded(seed) {
        return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    }

    function rr(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function line(x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    // ---------- layout ----------
    function layout() {
        const r = mall.getBoundingClientRect();
        W = r.width;
        H = r.height;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // When the mall is the full-screen backdrop, tuck the stores under the bio card.
        const fixed = getComputedStyle(mall).position === 'fixed';
        const contentBottom = fixed && card ? card.getBoundingClientRect().bottom - r.top : 0;
        const floorY = H - clamp(H * 0.22, 130, 230);
        const storeH = clamp(fixed ? floorY - contentBottom - 28 : H * 0.42, 140, 250);
        const n = clamp(Math.round(W / 180), 4, STORES.length);
        L = {
            floorY, storeH, n,
            storeTop: floorY - storeH,
            sw: W / n,
            s1: clamp(Math.min(H / 820, W / 500), 0.75, 1.15),
            doorY: floorY + 6,
            frontY: H - 16
        };

        stores = [];
        for (let i = 0; i < n; i++) {
            const rnd = seeded(i * 7919 + 13);
            const stacks = [];
            for (let k = 0; k < 4; k++) {
                stacks.push({ count: 3 + Math.floor(rnd() * 5), tilt: (rnd() - 0.5) * 0.25, off: rnd() });
            }
            stores.push({ x: i * L.sw, w: L.sw, name: STORES[i][0], color: STORES[i][1], glow: 0, stacks, flicker: rnd() * 10 });
        }

        if (started && !busy && queue.length === 0) {
            const f = front();
            A.x = f.x;
            A.y = f.y;
        }
    }

    const front = () => ({ x: W / 2, y: L.frontY });
    const door = i => () => ({ x: stores[i] ? stores[i].x + stores[i].w / 2 : W / 2, y: L.doorY });
    const scaleAt = y => L.s1 * (0.55 + 0.45 * clamp((y - L.doorY) / (L.frontY - L.doorY), 0, 1));

    // ---------- tasks (each returns true when finished) ----------
    const move = (target, speed) => dt => {
        const p = target();
        const dx = p.x - A.x, dy = p.y - A.y;
        const d = Math.hypot(dx, dy);
        const step = reduce ? Infinity : speed * dt;
        if (Math.abs(dx) > 1) A.face = dx < 0 ? -1 : 1;
        if (d <= step) {
            A.x = p.x;
            A.y = p.y;
            return true;
        }
        A.x += dx / d * step;
        A.y += dy / d * step;
        A.speed = speed;
        A.phase += step / (9 * scaleAt(A.y));
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
    const glow = i => call(() => { if (stores[i]) stores[i].glow = 1; });

    // ---------- story ----------
    function intro() {
        started = true;
        const i = Math.floor(L.n / 2);
        const d = door(i)();
        A.x = d.x;
        A.y = d.y;
        A.alpha = 0;
        queue.push(wait(600), glow(i), fade(1, 350), move(front, 150), call(showAsk));
    }

    function shop(q) {
        busy = true;
        hideBubble();
        // Visit every store in random order (up to 9); on small screens, double back for at least 7 visits.
        const order = [...Array(L.n).keys()].sort(() => Math.random() - 0.5).slice(0, 9);
        while (order.length < 7) {
            const i = Math.floor(Math.random() * L.n);
            if (i !== order[order.length - 1]) order.push(i);
        }
        let checked = 0;
        const setStatus = () => {
            status.textContent = `Searching for “${q}” · ${checked}/${order.length} store visits`;
        };
        queue.push(call(() => { setStatus(); status.hidden = false; }));
        order.forEach(i => {
            queue.push(
                move(door(i), 1900),
                glow(i), fade(0, 90), wait(170),
                call(() => {
                    checked++;
                    setStatus();
                    pops.push({ i, text: POPS[Math.floor(Math.random() * POPS.length)], t0: time });
                }),
                fade(1, 90)
            );
        });
        queue.push(
            wait(250),
            call(() => { status.hidden = true; }),
            move(front, 170),
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
        answerBox.hidden = true;
        askBox.hidden = false;
        input.value = '';
        popIn();
        if (getComputedStyle(mall).position === 'fixed') input.focus({ preventScroll: true });
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
        const r = mall.getBoundingClientRect();
        const headY = A.y - 132 * scaleAt(A.y);
        const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
        const vw = document.documentElement.clientWidth;
        const left = clamp(r.left + A.x - bw / 2, 12, vw - bw - 12);
        bubble.style.left = left + window.scrollX + 'px';
        bubble.style.top = r.top + window.scrollY + headY - bh - 14 + 'px';
        bubble.style.setProperty('--tail-x', clamp(r.left + A.x - left, 20, bw - 20) + 'px');
    }

    form.addEventListener('submit', e => {
        e.preventDefault();
        if (busy) return;
        shop(input.value.trim().slice(0, 60) || 'something nice');
    });
    againBtn.addEventListener('click', showAsk);

    // ---------- drawing ----------
    function drawBackdrop() {
        const bg = ctx.createLinearGradient(0, 0, 0, L.floorY);
        bg.addColorStop(0, '#0b0b10');
        bg.addColorStop(1, '#18161f');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, L.floorY);

        // upper-level balcony railing
        const ry = L.storeTop - 10;
        if (ry > 40) {
            ctx.fillStyle = '#121118';
            ctx.fillRect(0, ry, W, 10);
            ctx.strokeStyle = 'rgba(255,255,255,0.07)';
            ctx.lineWidth = 1;
            line(0, ry - 22, W, ry - 22);
            for (let x = 8; x < W; x += 18) line(x, ry - 22, x, ry);
        }
        // spotlights onto the signs
        stores.forEach(st => {
            const cx = st.x + st.w / 2;
            const g = ctx.createLinearGradient(0, L.storeTop - 6, 0, L.storeTop + L.storeH * 0.4);
            g.addColorStop(0, 'rgba(255,236,200,0.12)');
            g.addColorStop(1, 'rgba(255,236,200,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(cx - 6, L.storeTop - 4);
            ctx.lineTo(cx + 6, L.storeTop - 4);
            ctx.lineTo(cx + st.w * 0.45, L.storeTop + L.storeH * 0.4);
            ctx.lineTo(cx - st.w * 0.45, L.storeTop + L.storeH * 0.4);
            ctx.fill();
        });
    }

    function drawPapers(x0, wReg, baseY, stacks) {
        if (wReg < 16) return;
        stacks.forEach((sk, j) => {
            const cx = x0 + wReg * (j + 0.5) / stacks.length;
            const pw = clamp(wReg / stacks.length - 8, 8, 20);
            if (j % 2 === 0) {
                // fanned sheets on display
                for (let c = 0; c < 3; c++) {
                    ctx.save();
                    ctx.translate(cx, baseY);
                    ctx.rotate(sk.tilt + (c - 1) * 0.18);
                    ctx.fillStyle = c === 2 ? '#f8fafc' : '#cbd5e1';
                    ctx.fillRect(-pw / 2, -pw * 1.3, pw, pw * 1.3);
                    if (c === 2) {
                        ctx.fillStyle = '#94a3b8';
                        for (let l = 1; l < 5; l++) {
                            ctx.fillRect(-pw / 2 + 2, -pw * 1.3 + l * pw * 0.24, pw - 4 - (l === 4 ? pw * 0.3 : 0), 1);
                        }
                    }
                    ctx.restore();
                }
            } else {
                // flat pile
                for (let c = 0; c < sk.count; c++) {
                    ctx.fillStyle = c % 2 ? '#e2e8f0' : '#f8fafc';
                    ctx.fillRect(cx - pw * 0.7 + (sk.off - 0.5) * c * 1.5, baseY - (c + 1) * 2.2, pw * 1.4, 2);
                }
            }
        });
    }

    function drawStore(st) {
        const { x, w } = st, top = L.storeTop, h = L.storeH, fy = L.floorY;
        ctx.fillStyle = '#1b1922';
        ctx.fillRect(x, top, w, h);
        ctx.fillStyle = '#28252f';
        ctx.fillRect(x, top, 5, h);
        ctx.fillRect(x + w - 5, top, 5, h);
        const ix = x + 9, iw = w - 18;

        // neon sign
        const sh = Math.max(24, h * 0.16);
        ctx.fillStyle = '#0d0c12';
        rr(ix, top + 8, iw, sh, 5);
        ctx.fill();
        let fs = Math.min(sh * 0.5, 16);
        ctx.font = `700 ${fs}px Inter, sans-serif`;
        while (ctx.measureText(st.name).width > iw - 14 && fs > 8) {
            fs -= 0.5;
            ctx.font = `700 ${fs}px Inter, sans-serif`;
        }
        const flicker = Math.sin(time * 0.7 + st.flicker) * Math.sin(time * 11 + st.flicker * 3) > 0.93;
        ctx.save();
        ctx.globalAlpha = flicker ? 0.35 : 1;
        ctx.shadowColor = st.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = st.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(st.name, x + w / 2, top + 8 + sh / 2 + 1);
        ctx.restore();

        // striped awning
        const ay = top + 14 + sh, ah = Math.max(12, h * 0.09);
        const stripes = Math.max(4, Math.round(iw / 14)), sw = iw / stripes;
        for (let k = 0; k < stripes; k++) {
            ctx.fillStyle = k % 2 ? '#d4d4d8' : st.color;
            ctx.fillRect(ix + k * sw, ay, sw + 0.5, ah);
            ctx.beginPath();
            ctx.arc(ix + k * sw + sw / 2, ay + ah, sw / 2, 0, Math.PI);
            ctx.fill();
        }

        // shop window
        const gy = ay + ah, gh = fy - gy;
        const g = ctx.createLinearGradient(0, gy, 0, fy);
        g.addColorStop(0, '#3b3328');
        g.addColorStop(1, '#1f1b16');
        ctx.fillStyle = g;
        ctx.fillRect(ix, gy, iw, gh);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = st.color;
        ctx.fillRect(ix, gy, iw, gh);
        ctx.globalAlpha = 1;

        // door (lights up while the agent is inside)
        const dw = clamp(iw * 0.32, 26, 56), dh = Math.min(gh * 0.82, 90 * L.s1);
        const dx = x + w / 2 - dw / 2, dy = fy - dh;
        ctx.fillStyle = '#0a090d';
        ctx.fillRect(dx, dy, dw, dh);
        if (st.glow > 0) {
            ctx.globalAlpha = st.glow * 0.6;
            ctx.fillStyle = st.color;
            ctx.fillRect(dx, dy, dw, dh);
            ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = '#4a4556';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx, dy, dw, dh);
        line(x + w / 2, dy, x + w / 2, fy);
        ctx.strokeStyle = '#3a3644';
        ctx.strokeRect(ix + 0.5, gy + 0.5, iw - 1, gh - 1);

        // shelves of papers on both sides of the door
        const shelfY = fy - gh * 0.3;
        const leftW = dx - ix - 6, rightX = dx + dw + 6, rightW = ix + iw - rightX;
        ctx.fillStyle = '#5b5245';
        if (leftW > 16) ctx.fillRect(ix + 3, shelfY, leftW, 3);
        if (rightW > 16) ctx.fillRect(rightX, shelfY, rightW - 3, 3);
        drawPapers(ix + 6, leftW - 6, shelfY, st.stacks.slice(0, 2));
        drawPapers(rightX, rightW - 6, shelfY, st.stacks.slice(2));
    }

    function drawFloor() {
        const fy = L.floorY;
        const fg = ctx.createLinearGradient(0, fy, 0, H);
        fg.addColorStop(0, '#2b2733');
        fg.addColorStop(1, '#121016');
        ctx.fillStyle = fg;
        ctx.fillRect(0, fy, W, H - fy);

        // window light reflecting on the floor
        stores.forEach(st => {
            const g = ctx.createLinearGradient(0, fy, 0, fy + 50);
            g.addColorStop(0, st.color + (st.glow > 0.3 ? '40' : '18'));
            g.addColorStop(1, st.color + '00');
            ctx.fillStyle = g;
            ctx.fillRect(st.x + 9, fy, st.w - 18, 50);
        });

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = -30; i <= 30; i++) {
            const xt = W / 2 + i * 70, xb = W / 2 + i * 168;
            if (xb > -W && xb < 2 * W) line(xt, fy, xb, H);
        }
        for (let k = 1; k < 7; k++) {
            const y = fy + (H - fy) * Math.pow(k / 7, 1.7);
            line(0, y, W, y);
        }
        ctx.fillStyle = '#0f0e13';
        ctx.fillRect(0, fy - 2, W, 3);
    }

    function drawPops() {
        for (let k = pops.length - 1; k >= 0; k--) {
            const p = pops[k], st = stores[p.i];
            const t = time - p.t0;
            if (t > 1.1 || !st) {
                pops.splice(k, 1);
                continue;
            }
            const x = st.x + st.w / 2, y = L.storeTop + L.storeH * 0.45 - t * 32;
            ctx.save();
            ctx.globalAlpha = 1 - t / 1.1;
            ctx.font = '600 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const tw = ctx.measureText(p.text).width + 16;
            ctx.fillStyle = 'rgba(15,23,42,0.85)';
            rr(x - tw / 2, y - 11, tw, 22, 11);
            ctx.fill();
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(p.text, x, y + 0.5);
            ctx.restore();
        }
    }

    function drawBot(x, y, s, alpha, ghost) {
        const moving = A.speed > 0, fast = A.speed > 700;
        const swing = moving ? Math.sin(A.phase) * (fast ? 0.9 : 0.55) : 0;
        const bob = moving ? -Math.abs(Math.sin(A.phase)) * 2.5 : Math.sin(time * 2.2) * 0.8;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.scale(s * A.face, s);
        if (!ghost) {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.beginPath();
            ctx.ellipse(0, 2, 24, 5, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        if (fast) ctx.rotate(0.14);

        // legs
        [-1, 1].forEach(sgn => {
            ctx.save();
            ctx.translate(sgn * 8, -38);
            ctx.rotate(sgn * swing);
            ctx.fillStyle = sgn < 0 ? '#8b95a5' : '#9ca3af';
            rr(-4, 0, 8, 34, 4);
            ctx.fill();
            ctx.fillStyle = '#374151';
            rr(-5, 30, 14, 7, 3);
            ctx.fill();
            ctx.restore();
        });

        ctx.translate(0, bob);
        // back arm
        ctx.save();
        ctx.translate(-18, -68);
        ctx.rotate(swing * 0.8);
        ctx.fillStyle = '#a8b3c2';
        rr(-3.5, 0, 7, 26, 3.5);
        ctx.fill();
        ctx.restore();
        // body
        ctx.fillStyle = '#e5e7eb';
        rr(-17, -76, 34, 42, 11);
        ctx.fill();
        ctx.fillStyle = '#3b82f6';
        rr(-9, -66, 18, 12, 3);
        ctx.fill();
        ctx.fillStyle = '#bfdbfe';
        ctx.fillRect(-5, -61, 4, 2);
        ctx.fillRect(1, -61, 4, 2);
        // front arm holding an (empty) shopping bag
        ctx.save();
        ctx.translate(18, -68);
        ctx.rotate(-swing * 0.8);
        ctx.fillStyle = '#cbd5e1';
        rr(-3.5, 0, 7, 26, 3.5);
        ctx.fill();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 31, 5, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        rr(-9, 30, 18, 17, 3);
        ctx.fill();
        ctx.fillStyle = '#b45309';
        ctx.fillRect(-9, 34, 18, 2);
        ctx.restore();
        // head
        ctx.fillStyle = '#f3f4f6';
        rr(-22, -112, 44, 34, 12);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        rr(-17, -104, 34, 17, 8);
        ctx.fill();
        const blink = time % 3.4 < 0.12 ? 0.15 : 1;
        const look = moving ? 3 : Math.sin(time * 0.8) * 2;
        ctx.fillStyle = '#22d3ee';
        if (!ghost) {
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = 6;
        }
        [-6, 7].forEach(ex => {
            ctx.beginPath();
            ctx.ellipse(ex + look, -95.5, 3, 3 * blink, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.shadowBlur = 0;
        // antenna
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 2;
        line(0, -112, 0, -122);
        ctx.fillStyle = Math.floor(time * 2) % 2 ? '#f87171' : '#4ade80';
        ctx.beginPath();
        ctx.arc(0, -125, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ---------- loop ----------
    let last = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        time += dt;

        A.speed = 0;
        if (queue.length && queue[0](dt)) queue.shift();
        if (A.speed > 700) {
            trail.push({ x: A.x, y: A.y });
            if (trail.length > 5) trail.shift();
        } else if (trail.length) {
            trail.shift();
        }
        stores.forEach(st => { st.glow = Math.max(0, st.glow - dt * 1.6); });

        ctx.clearRect(0, 0, W, H);
        drawBackdrop();
        stores.forEach(drawStore);
        drawFloor();
        drawPops();
        if (started && A.alpha > 0.01) {
            trail.forEach((p, k) => drawBot(p.x, p.y, scaleAt(p.y), A.alpha * 0.12 * (k + 1) / trail.length, true));
            drawBot(A.x, A.y, scaleAt(A.y), A.alpha, false);
        }
        placeBubble();
        requestAnimationFrame(frame);
    }

    layout();
    window.addEventListener('resize', layout);
    if (card && 'ResizeObserver' in window) new ResizeObserver(layout).observe(card);

    // Start the walk-in once the mall is on screen (it sits below the bio on phones).
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) {
                io.disconnect();
                intro();
            }
        }, { threshold: 0.4 });
        io.observe(mall);
    } else {
        intro();
    }
    requestAnimationFrame(frame);
})();
