(() => {
    const root = document.documentElement;
    const card = document.querySelector('.card');
    const layer = document.getElementById('team');
    const scene = document.getElementById('scene');
    const pixel = document.getElementById('pixel');
    const prompt = document.getElementById('prompt');
    const skipBtn = document.getElementById('skip');
    if (!card || !layer || !scene || !pixel || !prompt) return;

    const photo = card.querySelector('.profile-image img');
    const name = card.querySelector('h1');
    const emailBox = card.querySelector('.contact-emails');
    const emails = [...emailBox.querySelectorAll('a')];
    const paras = [...card.querySelectorAll('.bio p')];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const TYPO = ['philosophy', 'phylosophy'];

    const SPEED = 1;
    const TYPING = 3;
    let epoch = 0;
    let running = false;
    const preps = [];
    const sleep = ms => {
        const e = epoch;
        return new Promise(r => setTimeout(() => { if (e === epoch) r(); }, ms / SPEED));
    };
    const box = el => {
        const r = el.getBoundingClientRect();
        return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
    };
    const ROBOT = (() => {
        const grid = rows => {
            let out = '';
            rows.forEach((row, y) => [...row].forEach((ch, x) => {
                if (ch !== '.') out += `<rect class="${ch}" x="${x}" y="${y}" width="1" height="1"/>`;
            }));
            return out;
        };
        const E = '..............';
        const base = [
            '.......a......', '.......b......', '....bbbbbbb...', '....bsesesb...',
            '....bsssssb...', '....bbbbbbb...', '...bbbbbbbbb..', E,
            '...bbbbbbbbb..', '....bbbbbbb...', '....bb...bb...', '...bbb...bbb..'
        ];
        const reach = [E, E, E, E, E, E, 'k..bbbbbbbbb..', 'cclbbbbbbbbb..', 'k..bbbbbbbbb..'];
        const pull = [E, E, E, E, E, E, E, '.ccbbbbbbbbb..'];
        return `<svg width="28" height="24" viewBox="0 0 14 12" shape-rendering="crispEdges">${grid(base)}<g class="t0">${grid(reach)}</g><g class="t1">${grid(pull)}</g></svg>`;
    })();

    const agents = [];

    const pearls = (pts, r) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fffaf0" stroke="#d9cbb0" stroke-width="0.4"/>`).join('');
    const arc = (cx, cy, rx, ry, from, to, n) => Array.from({ length: n }, (_, i) => {
        const t = (from + (to - from) * i / (n - 1)) * Math.PI / 180;
        return [+(cx + rx * Math.cos(t)).toFixed(1), +(cy + ry * Math.sin(t)).toFixed(1)];
    });
    const HEAD_ART = `
        <path d="M22 36c-3-16 8-30 26-30s29 14 26 30c4 8 3 20-3 28-5 6-12 4-14 0l-1-12h-16l-1 12c-2 4-9 6-14 0-6-8-7-20-3-28z" fill="#1d1411"/>
        <circle cx="20" cy="44" r="6" fill="#1d1411"/><circle cx="24" cy="54" r="6.2" fill="#1d1411"/><circle cx="29" cy="62" r="5.6" fill="#1d1411"/>
        <circle cx="76" cy="44" r="6" fill="#1d1411"/><circle cx="72" cy="54" r="6.2" fill="#1d1411"/><circle cx="67" cy="62" r="5.6" fill="#1d1411"/>
        <circle cx="24" cy="30" r="6.5" fill="#1d1411"/><circle cx="72" cy="30" r="6.5" fill="#1d1411"/>
        <ellipse cx="31.5" cy="42" rx="2.3" ry="3.6" fill="#c98f68"/><ellipse cx="64.5" cy="42" rx="2.3" ry="3.6" fill="#c98f68"/>
        <path d="M32 36c0-11 7-17 16-17s16 6 16 17c0 8-1 13-4 18-3 5-7 7-12 7s-9-2-12-7c-3-5-4-10-4-18z" fill="#d9a07a" stroke="#b57b55" stroke-width="0.8"/>
        <path d="M33 47c1 11 7 17 15 17s14-6 15-17c-3 7-8 9-15 9s-12-2-15-9z" fill="#4a3226" opacity="0.4"/>
        <circle cx="36.5" cy="47" r="3.6" fill="#d98a72" opacity="0.5"/><circle cx="59.5" cy="47" r="3.6" fill="#d98a72" opacity="0.5"/>
        <path d="M34.5 30.5c3-2.2 8-2.6 12-1" stroke="#1d1411" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path d="M49.5 29.5c4-1.6 9-1.2 12 1" stroke="#1d1411" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <ellipse cx="40" cy="36" rx="3.4" ry="2.2" fill="#fff"/><ellipse cx="56" cy="36" rx="3.4" ry="2.2" fill="#fff"/>
        <circle cx="40.4" cy="36" r="1.6" fill="#2a1a12"/><circle cx="56.4" cy="36" r="1.6" fill="#2a1a12"/>
        <rect x="32.5" y="31" width="14.5" height="10" rx="3" fill="#9ec5f0" fill-opacity="0.22" stroke="#15100e" stroke-width="2.2"/>
        <rect x="49" y="31" width="14.5" height="10" rx="3" fill="#9ec5f0" fill-opacity="0.22" stroke="#15100e" stroke-width="2.2"/>
        <path d="M47 34.5h2" stroke="#15100e" stroke-width="2"/>
        <path d="M32.5 34l-3.5-1.2M63.5 34l3.5-1.2" stroke="#15100e" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M48 40v7q-2.4 2-4.8 0.6" stroke="#a46b47" fill="none" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M40.5 52q7.5 7.5 15 0q-2.5 7-7.5 7t-7.5-7z" fill="#7a1f1f"/>
        <path d="M42 52.6q6 2.8 12 0q-2.6 3.8-6 3.8t-6-3.8z" fill="#fff"/>
        <path d="M35 49q6.5-5 13-1.6q6.5-3.4 13 1.6q-4.5 3.4-13 1.8q-8.5 1.6-13-1.8z" fill="#1d1411"/>
        <circle cx="27" cy="17" r="7" fill="#1d1411"/><circle cx="69" cy="17" r="7" fill="#1d1411"/><circle cx="35" cy="10" r="7" fill="#1d1411"/><circle cx="61" cy="10" r="7" fill="#1d1411"/><circle cx="48" cy="7" r="7.5" fill="#1d1411"/><circle cx="41" cy="9" r="6" fill="#1d1411"/><circle cx="55" cy="9" r="6" fill="#1d1411"/>
        <circle cx="32" cy="24" r="4.6" fill="#1d1411"/><circle cx="64" cy="24" r="4.6" fill="#1d1411"/>
        <circle cx="38" cy="24.6" r="3" fill="#1d1411"/><circle cx="45" cy="25.2" r="2.8" fill="#1d1411"/><circle cx="52" cy="25.2" r="2.8" fill="#1d1411"/><circle cx="58.5" cy="24.6" r="3" fill="#1d1411"/>
    `;
    const NECK_ART = `
        ${pearls(arc(48, 62, 15, 9, 20, 160, 10), 1.7)}
        ${pearls(arc(48, 62, 19, 16, 25, 155, 12), 1.9)}
        <circle cx="48" cy="79" r="3.6" fill="#d4a017"/><circle cx="48" cy="79" r="2.2" fill="#b42a2a"/>
    `;
    const DOTS = pts => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.1" fill="#b42a2a"/><circle cx="${x}" cy="${y}" r="0.8" fill="#f2d6a2"/>`).join('');

    function pixelArt() {
        const robe = `<path d="M12 96c0-22 14-33 36-33s36 11 36 33z" fill="#efe2c4" stroke="#bda57a" stroke-width="1"/>`;
        const lid = `<g class="lid"><rect x="25" y="70" width="46" height="22" rx="3" fill="#e7e5e4" stroke="#a8a29e" stroke-width="2"/><circle cx="48" cy="81" r="3.2" fill="#2563eb"/></g>`;
        const hand = (x, cls) => `<ellipse class="hand ${cls}" cx="${x}" cy="91" rx="4.2" ry="3.2" fill="#e9bf9a" stroke="#c99a74" stroke-width="0.6"/>`;
        return `<svg viewBox="0 0 96 96" width="96" height="96">${robe}${DOTS([[22, 86], [74, 86], [18, 93], [78, 93], [30, 76], [66, 76]])}${NECK_ART}${HEAD_ART}${lid}<rect x="4" y="92" width="88" height="4" fill="#d6d3d1"/>${hand(23, 'l')}${hand(73, 'r')}<rect class="glow" x="27" y="72" width="42" height="18" rx="2" fill="#2563eb"/></svg>`;
    }

    const WALKER = (() => {
        const sleeve = `<path d="M31 64l-8 24 7 2 8-20z" fill="#efe2c4" stroke="#bda57a" stroke-width="0.8"/><path d="M65 64l7 22-7 3-8-22z" fill="#efe2c4" stroke="#bda57a" stroke-width="0.8"/>`;
        const coat = `<path d="M29 62h38l7 30H22z" fill="#efe2c4" stroke="#bda57a" stroke-width="1"/><rect x="26" y="75" width="44" height="4.5" fill="#a31f2a"/><circle cx="48" cy="77" r="2.4" fill="#d4a017"/>`;
        const laptop = `<rect x="66" y="78" width="24" height="5" rx="1" fill="#e7e5e4" stroke="#a8a29e" stroke-width="1.2"/><circle cx="68" cy="82" r="3.2" fill="#e9bf9a" stroke="#c99a74" stroke-width="0.6"/>`;
        const upper = `${coat}${DOTS([[34, 86], [62, 86], [40, 69], [56, 69]])}${sleeve}${NECK_ART.replace(/<circle cx="48" cy="79"[^>]*\/><circle cx="48" cy="79"[^>]*\/>/, '')}${HEAD_ART}${laptop}`;
        const leg = (x, w) => `<rect x="${x}" y="91" width="${w}" height="10" fill="#3b3a52"/><path d="M${x - 1} 100h${w + 4}q2 1 1 4h-${w + 5}z" fill="#1c1917"/>`;
        const A = leg(32, 11) + leg(53, 11);
        const B = leg(38, 9) + leg(49, 9);
        return `<svg viewBox="0 0 96 104" width="96" height="104"><g class="wa">${A}</g><g class="wb">${B}</g>${upper}</svg>`;
    })();

    function lap() {
        const r = pixel.getBoundingClientRect();
        return { x: r.left + window.scrollX + r.width / 2 - 2, y: r.top + window.scrollY + r.height * 14 / 24 - 6 };
    }

    async function intro() {
        const r = scene.getBoundingClientRect();
        const dx = window.innerWidth / 2 - (r.left + r.width / 2);
        const dy = window.innerHeight / 2 - (r.top + r.height / 2);
        scene.style.transform = `translate(${dx}px, ${dy}px) scale(1.25)`;
        scene.classList.add('on');
        await sleep(700);
        const text = 'Make me a website';
        const caret = document.createElement('span');
        caret.className = 'caret';
        const span = document.createElement('span');
        prompt.replaceChildren(span, caret);
        for (let i = 1; i <= text.length; i++) {
            span.textContent = text.slice(0, i);
            await sleep(text[i - 1] === ' ' ? 150 : 70);
        }
        await sleep(550);
        caret.remove();
        prompt.classList.add('sent');
        scene.classList.add('idle');
        await sleep(300);
    }

    function spawn(role, x, y, opts = {}) {
        const el = document.createElement('div');
        el.className = 'agent' + (opts.lead ? ' lead' : '');
        el.innerHTML = ROBOT + '<span class="tag"><b></b><i></i></span>';
        el.querySelector('b').textContent = role;
        layer.appendChild(el);
        const a = {
            el, x, y, tx: x, ty: y, k: opts.speed || 7, follow: null, arrive: null,
            status: s => { el.querySelector('i').textContent = s; }
        };
        agents.push(a);
        place(a);
        requestAnimationFrame(() => el.classList.add('on'));
        return a;
    }

    const edge = x => Math.min(x, document.documentElement.clientWidth - 24);

    function place(a) {
        a.el.classList.toggle('flip', a.x > document.documentElement.clientWidth - 170);
        a.el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
    }

    function go(a, x, y) {
        a.follow = null;
        a.tx = x;
        a.ty = y;
        return new Promise(r => { a.arrive = r; });
    }

    let crew = [];
    const TAXI_LEN = 76;
    const TAXI = (() => {
        const L = TAXI_LEN;
        const R = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
        let s = R(1, 6, L - 2, 4, '#facc15') + R(1, 9, L - 2, 1, '#ca8a04') + R(7, 3, L - 14, 3, '#facc15');
        for (let x = 8; x + 5 <= L - 8; x += 8) s += R(x, 4, 5, 2, '#bfdbfe');
        const m = Math.floor(L / 2) - 3;
        s += R(m, 1, 6, 2, '#ffffff') + R(m + 1, 2, 1, 1, '#1c1917') + R(m + 3, 2, 1, 1, '#1c1917') + R(m + 5, 2, 1, 1, '#1c1917')
            + R(L - 2, 6, 1, 1, '#fffbeb') + R(1, 6, 1, 1, '#dc2626');
        for (let x = 3; x <= L - 5; x += 2) s += R(x, 7, 1, 1, '#1c1917');
        [5, Math.floor(L / 2) - 2, L - 9].forEach(x => { s += R(x, 9, 4, 3, '#1c1917') + R(x + 1, 10, 2, 1, '#a8a29e'); });
        return `<svg width="${L * 3}" height="36" viewBox="0 0 ${L} 12" shape-rendering="crispEdges">${s}</svg>`;
    })();

    function slot(i, n) {
        const r = prompt.getBoundingClientRect();
        const sp = Math.min(44, Math.max(28, (document.documentElement.clientWidth - 80) / n));
        const cx = r.left + window.scrollX + r.width / 2;
        return { x: cx - (n - 1) * sp / 2 + i * sp - 16, y: r.bottom + window.scrollY + 66 };
    }

    function park(a) {
        a.status('');
        a.el.classList.add('parked');
        const s = slot(Math.max(0, crew.indexOf(a)), crew.length);
        return Promise.race([go(a, s.x, s.y), sleep(2500)]);
    }

    async function departure() {
        const b = box(pixel);
        pixel.classList.add('closing');
        await sleep(900);
        const w = document.createElement('div');
        w.className = 'walker';
        w.innerHTML = WALKER;
        w.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
        layer.appendChild(w);
        w.offsetWidth;
        pixel.style.visibility = 'hidden';
        await sleep(350);
        const target = window.scrollX - 140;
        const secs = Math.max(1, (b.x - target) / 340);
        w.classList.add('walking');
        w.style.transition = `transform ${secs}s linear`;
        w.style.transform = `translate3d(${target}px, ${b.y}px, 0)`;
        await sleep(secs * 1000);
        w.remove();
        pixel.classList.add('gone');
    }

    async function sendOff() {
        const n = crew.length;
        await Promise.all(crew.map((a, i) => {
            const s = slot(i, n);
            return Promise.race([go(a, s.x, s.y), sleep(3000)]);
        }));
        crew.forEach((a, i) => {
            a.el.style.setProperty('--d', i * 0.11 + 's');
            a.el.classList.add('dance');
        });
        await sleep(2500);
        const first = slot(0, n), last = slot(n - 1, n);
        const vw = window.scrollX + document.documentElement.clientWidth;
        const stop = Math.min(last.x + 80, vw - TAXI_LEN * 3 - 12);
        const top = first.y - 27;
        const taxi = document.createElement('div');
        taxi.className = 'taxi';
        taxi.innerHTML = TAXI;
        taxi.firstChild.style.transform = 'scaleX(-1)';
        taxi.style.transform = `translate3d(${vw + 40}px, ${top}px, 0)`;
        layer.appendChild(taxi);
        taxi.offsetWidth;
        taxi.classList.add('drive');
        taxi.style.transform = `translate3d(${stop}px, ${top}px, 0)`;
        await sleep(1700);
        taxi.classList.remove('drive');
        const step = n > 1 ? (TAXI_LEN * 3 - 42 - 28) / (n - 1) : 0;
        const offs = crew.map((_, i) => 18 + i * step);
        await Promise.all(crew.map(async (a, i) => {
            a.k = 14;
            await Promise.race([go(a, stop + offs[i], first.y), sleep(2500)]);
            a.el.classList.remove('dance');
        }));
        await sleep(250);
        await Promise.all(crew.map(async (a, i) => {
            await Promise.race([go(a, stop + offs[i], top - 26), sleep(700)]);
            await Promise.race([go(a, stop + offs[i], top), sleep(700)]);
            a.el.classList.add('dance');
        }));
        await sleep(600);
        crew.forEach((a, i) => {
            a.k = 40;
            a.follow = () => {
                const r = taxi.getBoundingClientRect();
                return { x: r.left + window.scrollX + offs[i], y: top };
            };
        });
        taxi.firstChild.style.transform = '';
        taxi.classList.add('drive');
        taxi.style.transform = `translate3d(${vw + 260}px, ${top}px, 0)`;
        const gone = departure();
        await sleep(1900);
        taxi.remove();
        crew.forEach(a => {
            a.el.remove();
            const at = agents.indexOf(a);
            if (at >= 0) agents.splice(at, 1);
        });
        await gone;
        crew = [];
    }

    async function leave(a, x, y) {
        await Promise.race([go(a, x, y), sleep(700)]);
        a.el.classList.remove('on');
        await sleep(300);
        a.el.remove();
        agents.splice(agents.indexOf(a), 1);
    }

    let last = performance.now();
    function tick(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        agents.forEach(a => {
            if (a.follow) {
                const p = a.follow();
                if (p) {
                    a.tx = p.x;
                    a.ty = p.y;
                }
            }
            const k = Math.min(1, dt * a.k * SPEED);
            a.x += (a.tx - a.x) * k;
            a.y += (a.ty - a.y) * k;
            if (a.arrive && Math.hypot(a.tx - a.x, a.ty - a.y) < 1.5) {
                const r = a.arrive;
                a.arrive = null;
                r();
            }
            place(a);
        });
        requestAnimationFrame(tick);
    }

    function prepare(el) {
        const orig = [...el.childNodes];
        const ghost = document.createElement('span');
        const typed = document.createElement('span');
        ghost.className = 'ghost';
        typed.className = 'typed';
        orig.forEach(n => {
            ghost.appendChild(n.cloneNode(true));
            typed.appendChild(n.cloneNode(true));
        });
        const walk = document.createTreeWalker(typed, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walk.nextNode()) nodes.push(walk.currentNode);
        const texts = nodes.map((n, i) => {
            const t = n.textContent.replace(/\s+/g, ' ');
            return i === 0 ? t.trimStart() : t;
        });
        nodes.forEach(n => { n.textContent = ''; });
        const caret = document.createElement('span');
        caret.className = 'caret';
        el.classList.add('typing');
        el.replaceChildren(ghost, typed);
        return { el, orig, typed, nodes, texts, caret };
    }

    function finish(t) {
        t.caret.remove();
        t.el.replaceChildren(...t.orig);
        t.el.classList.remove('typing');
    }

    const caretPoint = t => () => {
        if (!t.caret.isConnected) return null;
        const r = t.caret.getBoundingClientRect();
        return { x: r.right + window.scrollX + 2, y: r.bottom + window.scrollY - 3 };
    };

    async function type(t, a, cps, swap) {
        a.follow = caretPoint(t);
        for (let i = 0; i < t.nodes.length; i++) {
            const node = t.nodes[i];
            let text = t.texts[i];
            if (swap && text.includes(swap[0])) text = text.replace(swap[0], swap[1]);
            node.parentNode.insertBefore(t.caret, node.nextSibling);
            for (let j = 0; j < text.length;) {
                const step = 2;
                j = Math.min(text.length, j + step);
                node.textContent = text.slice(0, j);
                const pause = text[j - 1] === ' ' ? 1.5 : /[.,!]/.test(text[j - 1]) ? 4 : 1;
                await sleep(1000 * step * pause / cps / TYPING);
            }
        }
        a.follow = null;
    }

    function markTypo(t) {
        const node = t.nodes.find(n => n.textContent.includes(TYPO[1]));
        if (!node) return null;
        const start = node.textContent.indexOf(TYPO[1]);
        const word = node.splitText(start);
        word.splitText(TYPO[1].length);
        const span = document.createElement('span');
        word.parentNode.insertBefore(span, word);
        span.appendChild(word);
        return span;
    }

    function wire(el) {
        const b = box(el);
        const w = document.createElement('div');
        w.className = 'wire';
        Object.assign(w.style, { left: b.x - 8 + 'px', top: b.y - 5 + 'px', width: b.w + 16 + 'px', height: b.h + 10 + 'px' });
        layer.appendChild(w);
        requestAnimationFrame(() => w.classList.add('on'));
        return w;
    }

    function clearWire(w) {
        w.classList.add('done');
        setTimeout(() => w.remove(), 600 / SPEED);
    }

    async function assemble() {
        const tName = prepare(name);
        const tMail = emails.map(prepare);
        const tPara = paras.map(prepare);
        preps.push(tName, ...tMail, ...tPara);
        photo.classList.add('pending');
        root.classList.add('links-pending');
        root.classList.remove('assemble');
        await intro();

        scene.classList.add('flash');
        let p = lap();
        const lead = spawn('orchestrator', p.x, p.y, { lead: true, speed: 9 });
        lead.status('planning');
        await sleep(500);
        scene.classList.add('move');
        scene.style.transform = '';
        const c = box(card);
        await Promise.race([go(lead, c.x + c.w / 2, c.y - 34), sleep(900)]);
        lead.k = 12;
        scene.classList.remove('flash');

        const slots = [photo.parentElement, name, emailBox, ...paras];
        const wires = new Map();
        for (const el of slots) {
            const b = box(el);
            go(lead, b.x + b.w + 4, b.y + b.h - 6);
            await sleep(240);
            wires.set(el, wire(el));
        }
        const nWriters = paras.length;
        const photoAgent = true;
        const linkerAgent = true;
        const roles = [
            ...(photoAgent ? ['photo'] : []), 'profile',
            ...Array.from({ length: nWriters }, (_, i) => nWriters > 1 ? `writer ${i + 1}` : 'writer'),
            'checker', ...(linkerAgent ? ['linker'] : [])
        ];
        const size = document.getElementById('team-size');
        if (size) size.textContent = roles.length + 1;

        await sleep(250);
        lead.status(`spawning ${roles.length} agents`);
        scene.classList.add('flash');
        await sleep(450);
        const team = {};
        p = lap();
        for (const r of roles) {
            team[r] = spawn(r, p.x, p.y);
            await sleep(110);
        }
        scene.classList.remove('flash');
        const writers = roles.filter(r => r.startsWith('writer')).map(r => team[r]);
        crew = [lead, ...roles.map(r => team[r])];

        lead.status('delegating');
        const pb = box(photo);
        go(team.profile, pb.x - 30, pb.y + pb.h / 2 + 40);
        if (team.photo) go(team.photo, pb.x - 40, pb.y + 10);
        writers.forEach((a, i) => {
            const b = box(paras[i]);
            go(a, b.x, b.y + 14);
        });
        const bio = box(paras[0].parentElement);
        go(team.checker, edge(bio.x + bio.w + 24), bio.y + bio.h * 0.45);
        team.checker.status('waiting');
        if (team.linker) {
            go(team.linker, edge(bio.x + bio.w + 24), bio.y + bio.h * 0.75);
            team.linker.status('waiting');
        }
        await sleep(700);
        go(lead, edge(c.x + c.w + 10), c.y - 24);
        lead.status('monitoring');

        const photoJob = (async () => {
            const a = team.photo || team.profile;
            a.status('placing photo');
            await Promise.race([go(a, pb.x + pb.w / 2 - 46, pb.y + pb.h / 2 + 34), sleep(500)]);
            photo.classList.remove('pending');
            await go(a, pb.x + pb.w / 2, pb.y + pb.h / 2);
            clearWire(wires.get(photo.parentElement));
            if (team.photo) {
                a.status('reporting');
                await sleep(400);
                park(a);
            } else {
                await sleep(250);
            }
        })();

        const profileJob = (async () => {
            const a = team.profile;
            if (!team.photo) await photoJob;
            else await sleep(300);
            a.status('writing');
            await type(tName, a, 26);
            finish(tName);
            clearWire(wires.get(name));
            for (const t of tMail) {
                await type(t, a, 55);
                finish(t);
            }
            clearWire(wires.get(emailBox));
            a.status('reporting');
            await sleep(400);
            park(a);
        })();

        const paraDone = paras.map(() => {
            let resolve;
            const p = new Promise(r => { resolve = r; });
            p.resolve = resolve;
            return p;
        });
        let typoSpan = null;
        const chars = tPara.map(t => t.texts.join('').length);
        const longest = Math.max(...chars);
        const writerJobs = writers.map(async (a, w) => {
            const mine = paras.map((_, i) => i).filter(i => i % nWriters === w).sort((i, j) => (i === 1) - (j === 1));
            const cps = 80 * mine.reduce((s, i) => s + chars[i], 0) / longest;
            await sleep(500 + w * 220);
            for (const i of mine) {
                a.status(mine.length > 1 ? `writing ${mine.indexOf(i) + 1}/${mine.length}` : 'writing');
                await type(tPara[i], a, cps + w * 6, i === 1 ? TYPO : null);
                if (i === 1) typoSpan = markTypo(tPara[i]);
                else {
                    finish(tPara[i]);
                    clearWire(wires.get(paras[i]));
                }
                paraDone[i].resolve();
            }
            a.status('reporting');
            await sleep(400);
            park(a);
        });

        const linkBatch = async (a, scope) => {
            a.status('linking');
            for (const link of scope.querySelectorAll('a')) {
                const r = box(link);
                await Promise.race([go(a, r.x + r.w, r.y + r.h - 2), sleep(650)]);
                link.classList.add('linked');
                await sleep(180);
            }
            a.status('waiting');
        };

        const checkTypo = async a => {
            a.status('reviewing');
            if (typoSpan) {
                const r = box(typoSpan);
                await go(a, r.x + r.w, r.y + r.h - 2);
                typoSpan.classList.add('flag');
                a.status('typo found');
                await sleep(700);
                typoSpan.textContent = TYPO[0];
                a.status('fixed');
                await sleep(600);
                typoSpan.classList.remove('flag');
                await sleep(300);
            }
            finish(tPara[1]);
            clearWire(wires.get(paras[1]));
        };

        const batches = [[paraDone[0], paras[0]], [profileJob, emailBox]];
        const work = (a, tasks) => (async () => {
            const ready = [];
            let wake = () => {};
            tasks.forEach(([job, fn]) => job.then(() => {
                ready.push(fn);
                wake();
            }));
            for (let n = 0; n < tasks.length; n++) {
                while (!ready.length) await new Promise(r => { wake = r; });
                await ready.shift()();
            }
            a.status('done');
            await sleep(300);
            await park(a);
        })();
        const linkTasks = a => batches.map(([job, scope]) => [job, () => linkBatch(a, scope)]);

        const checkJob = work(team.checker, [
            [paraDone[1], () => checkTypo(team.checker)],
            ...(team.linker ? [] : linkTasks(team.checker))
        ]);
        const linkJob = team.linker ? work(team.linker, linkTasks(team.linker)) : Promise.resolve();

        await Promise.all([photoJob, profileJob, ...writerJobs, checkJob, linkJob]);
        root.classList.remove('links-pending');
        lead.status('done');
        await sleep(700);
        prompt.classList.remove('sent');
        prompt.textContent = `Created by a team of ${roles.length + 1} agents`;
        prompt.classList.add('credit');
        lead.status('');
        lead.el.classList.add('parked');
        await sleep(400);
        await sendOff();
        running = false;
        if (skipBtn) skipBtn.classList.remove('on');
    }

    function showAll() {
        root.classList.remove('assemble', 'links-pending');
        photo.classList.remove('pending');
        scene.style.transform = '';
        scene.classList.add('on', 'idle');
        pixel.classList.add('gone');
        prompt.textContent = 'Created by a team of agents';
        prompt.classList.add('credit');
    }

    function settle() {
        epoch++;
        running = false;
        if (skipBtn) skipBtn.classList.remove('on');
        agents.length = 0;
        crew = [];
        layer.replaceChildren();
        preps.forEach(t => { if (t.el.classList.contains('typing')) finish(t); });
        card.querySelectorAll('.flag').forEach(f => f.classList.remove('flag'));
        root.classList.remove('assemble', 'links-pending', 'instant');
        photo.classList.remove('pending');
        scene.classList.remove('flash', 'move');
        scene.style.transform = '';
        scene.classList.add('on', 'idle');
        pixel.classList.add('gone');
        prompt.classList.remove('sent');
        prompt.textContent = 'Created by a team of agents';
        prompt.classList.add('credit');
        idle();
    }

    function visible(r) {
        return r.top > 40 && r.bottom < window.innerHeight - 40 && r.right < window.innerWidth - 60;
    }

    async function review() {
        const nodes = [];
        paras.forEach(p => {
            const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
            while (walk.nextNode()) nodes.push(walk.currentNode);
        });
        const node = nodes[Math.floor(Math.random() * nodes.length)];
        const words = [...node.textContent.matchAll(/[A-Za-z]{5,}/g)];
        if (!words.length) return;
        const m = words[Math.floor(Math.random() * words.length)];
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const rect = range.getClientRects()[0];
        if (!rect || !visible(rect)) return;
        const x = rect.left + window.scrollX, y = rect.top + window.scrollY;
        const a = spawn('checker', x + rect.width + 70, y + rect.height + 50);
        a.status('reviewing');
        await go(a, x + rect.width, y + rect.height - 2);
        const mark = document.createElement('div');
        mark.className = 'mark';
        Object.assign(mark.style, { left: x - 2 + 'px', top: y + 'px', width: rect.width + 4 + 'px', height: rect.height + 'px' });
        layer.appendChild(mark);
        requestAnimationFrame(() => mark.classList.add('on'));
        await sleep(1100);
        a.status('looks good');
        mark.classList.remove('on');
        await sleep(900);
        mark.remove();
        await leave(a, a.x + 70, a.y + 50);
    }

    async function recheck() {
        const links = [...card.querySelectorAll('a')].filter(l => visible(l.getBoundingClientRect()));
        if (!links.length) return;
        const link = links[Math.floor(Math.random() * links.length)];
        const r = box(link);
        const a = spawn('linker', r.x + r.w + 70, r.y + r.h + 50);
        a.status('checking link');
        await go(a, r.x + r.w, r.y + r.h - 2);
        link.classList.remove('linked');
        root.classList.add('links-pending');
        await sleep(350);
        link.classList.add('linked');
        await sleep(500);
        root.classList.remove('links-pending');
        a.status('200 OK');
        await sleep(900);
        await leave(a, a.x + 70, a.y + 50);
    }

    async function idle() {
        for (;;) {
            await sleep(10000 + Math.random() * 8000);
            if (document.hidden) continue;
            await (Math.random() < 0.6 ? review() : recheck());
        }
    }

    pixel.innerHTML = pixelArt();

    if (reduce) {
        showAll();
        return;
    }
    requestAnimationFrame(tick);
    if (root.classList.contains('instant')) {
        settle();
        return;
    }
    running = true;
    if (skipBtn) {
        skipBtn.classList.add('on');
        skipBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (running) settle();
        });
    }
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && running) settle();
    });
    window.addEventListener('pageshow', e => {
        if (e.persisted && running) settle();
    });
    const ready = document.fonts ? document.fonts.ready : Promise.resolve();
    ready
        .then(() => running && assemble().then(idle))
        .catch(() => {
            if (running) {
                running = false;
                if (skipBtn) skipBtn.classList.remove('on');
                showAll();
                idle();
            }
        });
})();
