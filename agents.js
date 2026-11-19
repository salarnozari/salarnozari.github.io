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

    const HEAD = [
        '.......h..h.', '.....h.hhhhh', '....hhhhhhhh', '...hhhhhhhhh', '...hhhhhhhhh',
        '...hhhhsssss', '....hhssssss', '....hhgggggg', '.....sgwegss', '.....sssssss',
        '......sssshh', '.......sssmm', '........ssss', '....jjjjjjWb', '...jjjjjjjWW',
        '..jjjjjjjjJW', '..jjjjjjjjjJ', '..jjjjjjjjjj', '..jjjjjjjjjj', '..jjjjjjjjjj',
        '..jjjjjjjjjj', '..jjjjjjjjjj'
    ];
    const PAL = {
        h: '#2b2420', s: '#c99a74', g: '#1c1917', w: '#f5f5f4', e: '#1c1917', m: '#8e4f3e',
        j: '#ece3d3', J: '#d9cdb8', W: '#ffffff', b: '#1c1917', L: '#e7e5e4', l: '#a8a29e',
        a: '#2563eb', d: '#d6d3d1'
    };

    function pixelArt() {
        const grid = HEAD.map(r => (r + [...r].reverse().join('')).split(''));
        while (grid.length < 24) grid.push(new Array(24).fill('.'));
        for (let y = 14; y <= 21; y++) {
            for (let x = 5; x <= 18; x++) grid[y][x] = y === 14 || x === 5 || x === 18 ? 'l' : 'L';
        }
        grid[17][11] = grid[17][12] = grid[18][11] = grid[18][12] = 'a';
        for (let x = 0; x < 24; x++) grid[22][x] = 'd';
        let out = '';
        grid.forEach((row, y) => {
            for (let x = 0; x < 24;) {
                const ch = row[x];
                let n = 1;
                while (x + n < 24 && row[x + n] === ch) n++;
                if (ch !== '.') out += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${PAL[ch]}"/>`;
                x += n;
            }
        });
        const hand = (x, cls) => `<rect class="hand ${cls}" x="${x}" y="20" width="2" height="2" fill="${PAL.s}"/>`;
        return `<svg viewBox="0 0 24 24" width="96" height="96" shape-rendering="crispEdges">${out}${hand(3, 'l')}${hand(19, 'r')}<rect class="glow" x="6" y="15" width="12" height="6" fill="${PAL.a}"/></svg>`;
    }

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
    const TAXI = (() => {
        const R = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
        let s = R(1, 6, 26, 4, '#facc15') + R(1, 9, 26, 1, '#ca8a04') + R(7, 3, 14, 3, '#facc15')
            + R(8, 4, 5, 2, '#bfdbfe') + R(15, 4, 5, 2, '#bfdbfe')
            + R(11, 1, 6, 2, '#ffffff') + R(12, 2, 1, 1, '#1c1917') + R(14, 2, 1, 1, '#1c1917') + R(16, 2, 1, 1, '#1c1917')
            + R(26, 6, 1, 1, '#fffbeb') + R(1, 6, 1, 1, '#dc2626');
        for (let x = 3; x <= 23; x += 2) s += R(x, 7, 1, 1, '#1c1917');
        s += R(5, 9, 4, 3, '#1c1917') + R(19, 9, 4, 3, '#1c1917') + R(6, 10, 2, 1, '#a8a29e') + R(20, 10, 2, 1, '#a8a29e');
        return `<svg width="84" height="36" viewBox="0 0 28 12" shape-rendering="crispEdges">${s}</svg>`;
    })();

    function slot(i, n) {
        const r = prompt.getBoundingClientRect();
        const sp = Math.min(44, Math.max(28, (document.documentElement.clientWidth - 80) / n));
        const cx = r.left + window.scrollX + r.width / 2;
        return { x: cx - (n - 1) * sp / 2 + i * sp - 16, y: r.bottom + window.scrollY + 40 };
    }

    function park(a) {
        a.status('');
        a.el.classList.add('parked');
        const s = slot(Math.max(0, crew.indexOf(a)), crew.length);
        return Promise.race([go(a, s.x, s.y), sleep(2500)]);
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
        await sleep(5000);
        const first = slot(0, n), last = slot(n - 1, n);
        const vw = window.scrollX + document.documentElement.clientWidth;
        const stop = Math.min(last.x + 80, vw - 96);
        const top = first.y - 27;
        const taxi = document.createElement('div');
        taxi.className = 'taxi';
        taxi.innerHTML = TAXI;
        taxi.firstChild.style.transform = 'scaleX(-1)';
        taxi.style.transform = `translate3d(${vw + 20}px, ${top}px, 0)`;
        layer.appendChild(taxi);
        taxi.offsetWidth;
        taxi.classList.add('drive');
        taxi.style.transform = `translate3d(${stop}px, ${top}px, 0)`;
        await sleep(1700);
        taxi.classList.remove('drive');
        const door = stop + 42 - 16;
        const rides = [...crew].reverse().map(async (a, k) => {
            await sleep(k * 260);
            await Promise.race([go(a, door, first.y), sleep(2500)]);
            a.el.classList.remove('dance', 'on');
            await sleep(300);
            a.el.remove();
            const at = agents.indexOf(a);
            if (at >= 0) agents.splice(at, 1);
        });
        await Promise.all(rides);
        await sleep(400);
        taxi.firstChild.style.transform = '';
        taxi.classList.add('drive');
        taxi.style.transform = `translate3d(${vw + 140}px, ${top}px, 0)`;
        await sleep(1800);
        taxi.remove();
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
