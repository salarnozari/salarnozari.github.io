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

    const SKIN = '#c98f68';
    const SKIN_LINE = '#a8714f';
    const HAIR = '#1a1311';
    const CAP = '#1f2633';
    const HOOD = '#3d5a80';
    const HOOD_LINE = '#2b4262';
    const curls = pts => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${HAIR}"/>`).join('');
    const HEAD_ART = `
        <path d="M55 13C63 4.5 76 4 80.5 8.6C77.5 13.4 67.5 16.6 59.5 17.6z" fill="#151a24"/>
        <path d="M58 15.2C65 10.4 73 9 78.6 9.4" stroke="#2c3546" stroke-width="0.8" fill="none"/>
        ${curls([[30.5, 27, 4.4], [65.5, 27, 4.4], [28.5, 33.5, 4.6], [67.5, 33.5, 4.6], [28.8, 40.5, 4.3], [67.2, 40.5, 4.3], [30.5, 46.5, 3.8], [65.5, 46.5, 3.8], [33, 50.5, 3], [63, 50.5, 3]])}
        <ellipse cx="32.6" cy="41" rx="2.6" ry="4" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="0.6"/>
        <ellipse cx="63.4" cy="41" rx="2.6" ry="4" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="0.6"/>
        <ellipse cx="48" cy="40" rx="15.5" ry="19" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="0.8"/>
        <path d="M33.2 43.5C33.4 53 39 59 48 59.2C57 59 62.6 53 62.8 43.5C61.5 50 58.5 53.2 55.5 53.6Q48 51.4 40.5 53.6C37.5 53.2 34.5 50 33.2 43.5Z" fill="#2a1d18" opacity="0.26"/>
        <circle cx="38" cy="46" r="3.6" fill="#d9776a" opacity="0.3"/><circle cx="58" cy="46" r="3.6" fill="#d9776a" opacity="0.3"/>
        <path d="M48 38v6.4q-2.2 2-4.4 0.8" stroke="#94603f" fill="none" stroke-width="1.2" stroke-linecap="round"/>
        <g class="ex-n"><path d="M44 55.4q4 2.4 8 0" stroke="#7a2b24" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>
        <g class="ex-s"><ellipse cx="48" cy="56.4" rx="2.4" ry="2.7" fill="#5c1a16"/><ellipse cx="48" cy="57.5" rx="1.4" ry="0.9" fill="#d8645c"/></g>
        <g class="ex-h"><path d="M42.6 54.4q5.4 6.4 10.8 0z" fill="#fff" stroke="#7a2b24" stroke-width="1.1" stroke-linejoin="round"/></g>
        <path d="M38.6 54C39 50.2 43 48.6 48 50.2C53 48.6 57 50.2 57.4 54Q53.4 52 48 52.6Q42.6 52 38.6 54Z" fill="${HAIR}"/>
        <path d="M31.5 27.5C31 14.5 38.5 7.5 48 7.5C57.5 7.5 65 14.5 64.5 27.5Q48 23 31.5 27.5Z" fill="${CAP}" stroke="#121620" stroke-width="0.8"/>
        <path d="M48 7.5C42.5 11.5 39.5 17.5 39 25.2M48 7.5C53.5 11.5 56.5 17.5 57 25.2" stroke="#121620" stroke-width="0.7" fill="none"/>
        <path d="M36 13.5C39 10.5 42.5 9.2 45 9" stroke="#3a4558" stroke-width="1.2" fill="none" stroke-linecap="round"/>
        <circle cx="48" cy="7.8" r="1.6" fill="#121620"/>
        <path d="M41.8 25.4Q41.8 18.8 48 18.8Q54.2 18.8 54.2 25.4Z" fill="${HAIR}"/>
        <rect x="41" y="21.6" width="14" height="2.2" rx="1.1" fill="#2e3748"/>
        <circle cx="43.6" cy="22.7" r="0.6" fill="#cfd6e3"/><circle cx="46.4" cy="22.7" r="0.6" fill="#cfd6e3"/><circle cx="49.2" cy="22.7" r="0.6" fill="#cfd6e3"/><circle cx="52" cy="22.7" r="0.6" fill="#cfd6e3"/>
        ${curls([[44.6, 25.4, 2], [48, 26, 2.3], [51.4, 25.3, 1.9]])}
        <g class="ex-n">
            <path d="M36.5 29.8q4.5-2.8 9-0.8M50.5 29q4.5-2 9 0.8" stroke="${HAIR}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
            <circle cx="40.8" cy="36.4" r="1.9" fill="#1f1512"/><circle cx="55.2" cy="36.4" r="1.9" fill="#1f1512"/>
            <circle cx="41.4" cy="35.8" r="0.55" fill="#fff"/><circle cx="55.8" cy="35.8" r="0.55" fill="#fff"/>
        </g>
        <g class="ex-s">
            <path d="M36.5 28q4.5-3.6 9-1.6M50.5 26.4q4.5-2 9 1.6" stroke="${HAIR}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
            <circle cx="40.8" cy="36.4" r="3" fill="#fff" stroke="#1f1512" stroke-width="0.6"/><circle cx="55.2" cy="36.4" r="3" fill="#fff" stroke="#1f1512" stroke-width="0.6"/>
            <circle cx="40.8" cy="36.4" r="1.3" fill="#1f1512"/><circle cx="55.2" cy="36.4" r="1.3" fill="#1f1512"/>
            <path d="M68 29q2 3 0 5q-2-2 0-5z" fill="#7dd3fc"/>
        </g>
        <g class="ex-h">
            <path d="M36.5 29.8q4.5-2.8 9-0.8M50.5 29q4.5-2 9 0.8" stroke="${HAIR}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
            <path d="M38.2 37.6q2.6-3 5.2 0M52.6 37.6q2.6-3 5.2 0" stroke="#1f1512" stroke-width="1.7" fill="none" stroke-linecap="round"/>
        </g>
        <rect x="35" y="32" width="11.6" height="8.8" rx="2.6" fill="#dbeafe" fill-opacity="0.14" stroke="#111" stroke-width="1.9"/>
        <rect x="49.4" y="32" width="11.6" height="8.8" rx="2.6" fill="#dbeafe" fill-opacity="0.14" stroke="#111" stroke-width="1.9"/>
        <path d="M46.6 35q1.4-1.3 2.8 0M35 34.2l-2.6-0.6M61 34.2l2.6-0.6" stroke="#111" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M37 33.6l2.6 0M51.4 33.6l2.6 0" stroke="#fff" stroke-width="0.8" stroke-linecap="round" opacity="0.6"/>
    `;
    const NECK_ART = `
        <rect x="42.5" y="54" width="11" height="11" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="0.6"/>
        <path d="M31 66C34 60 40 58.5 48 62.5C56 58.5 62 60 65 66C60 71 36 71 31 66Z" fill="${HOOD_LINE}"/>
        <path d="M35 65.5C39 63 44 63.2 48 66C52 63.2 57 63 61 65.5" stroke="#5a7aa3" stroke-width="1.4" fill="none" stroke-linecap="round"/>
        <path d="M44.6 67.5l-0.8 9M51.4 67.5l0.8 9" stroke="#e7e5e4" stroke-width="1.1" stroke-linecap="round"/>
        <rect x="42.8" y="76" width="1.8" height="2.6" rx="0.6" fill="#a8a29e"/><rect x="51.4" y="76" width="1.8" height="2.6" rx="0.6" fill="#a8a29e"/>
    `;

    function pixelArt() {
        const robe = `<path d="M12 96c0-22 14-33 36-33s36 11 36 33z" fill="${HOOD}" stroke="${HOOD_LINE}" stroke-width="1"/>`;
        const lid = `<g class="lid"><rect x="25" y="70" width="46" height="22" rx="3" fill="#e7e5e4" stroke="#a8a29e" stroke-width="2"/><circle cx="48" cy="81" r="3.2" fill="#2563eb"/></g>`;
        const hand = (x, cls) => `<ellipse class="hand ${cls}" cx="${x}" cy="91" rx="4.2" ry="3.2" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="0.6"/>`;
        return `<svg viewBox="0 0 96 96" width="96" height="96">${robe}${NECK_ART}${HEAD_ART}${lid}<rect x="4" y="92" width="88" height="4" fill="#d6d3d1"/>${hand(23, 'l')}${hand(73, 'r')}<rect class="glow" x="27" y="72" width="42" height="18" rx="2" fill="#2563eb"/></svg>`;
    }

    const WALKER = (() => {
        const sleeve = `<path d="M31 64l-8 24 7 2 8-20z" fill="${HOOD}" stroke="${HOOD_LINE}" stroke-width="0.8"/><path d="M65 64l7 22-7 3-8-22z" fill="${HOOD}" stroke="${HOOD_LINE}" stroke-width="0.8"/>`;
        const coat = `<path d="M29 62h38l6 30H23z" fill="${HOOD}" stroke="${HOOD_LINE}" stroke-width="1"/><path d="M36 79h24l-2.5 9h-19z" fill="${HOOD_LINE}"/><rect x="23.5" y="89" width="49" height="3" fill="${HOOD_LINE}"/>`;
        const laptop = `<rect x="66" y="78" width="24" height="5" rx="1" fill="#e7e5e4" stroke="#a8a29e" stroke-width="1.2"/><circle cx="68" cy="82" r="3.2" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="0.6"/>`;
        const upper = `${coat}${sleeve}${NECK_ART}${HEAD_ART}${laptop}`;
        const leg = (x, w) => `<rect x="${x}" y="91" width="${w}" height="10" fill="#334766"/><path d="M${x - 1} 99.5h${w + 4}q2.4 1 1.4 4.5h-${w + 5.4}z" fill="#f5f5f4" stroke="#a8a29e" stroke-width="0.6"/><rect x="${x - 1}" y="102.6" width="${w + 5}" height="1.4" fill="#dc2626"/>`;
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
        w.dataset.mood = 'happy';
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
        pixel.dataset.mood = 'surprised';
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
        pixel.dataset.mood = 'happy';
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
        pixel.dataset.mood = 'happy';
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
        pixel.dataset.mood = 'happy';
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
