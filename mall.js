// Shopping-agent mall for the home page: a symmetrical retro (80s synthwave) mall drawn in
// one-point perspective, an ice rink in front with the bio printed under the ice, skaters
// gliding over it, and a cart-riding shopping agent that searches random stores in five seconds.
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
    const rinkLayer = document.createElement('canvas'); // the rink, drawn in front of the shoppers
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

    // Ordinary shops on the signs; the joke is that they are just product categories from papers.
    const STORES = [
        ['CANDY SHOP', '#ff3cac'], ['HOT SAUCE', '#ff5e5e'], ['SNEAKERS', '#01cdfe'],
        ['TOY STORE', '#ffb800'], ['COFFEE', '#ff9a5a'], ['GADGETS', '#05ffa1'],
        ['PET SHOP', '#7df9ff'], ['FLOWERS', '#ff71ce'], ['CHEESE', '#fffb96'],
        ['PERFUME', '#b967ff'], ['BAKERY', '#ffb86b'], ['ICE CREAM', '#00f5d4'],
        ['VINYL RECORDS', '#ff9de2'], ['TEA HOUSE', '#9bff9b'], ['PIZZA', '#ff6b6b'],
        ['HATS', '#a78bfa'], ['SOCKS', '#f472b6'], ['CHOCOLATE', '#ffa96b'],
        ['JEWELRY', '#67e8f9'], ['GAMES', '#c084fc'], ['PLANTS', '#4ade80'],
        ['SUNGLASSES', '#60a5fa'], ['POPCORN', '#fde047'], ['KITES', '#fb7185']
    ];
    const POPS = ['only papers', 'papers?!', 'more papers', 'just PDFs', 'a footnote',
        'an appendix', 'papers again', 'nope', 'Table 3', 'a draft'];
    const BOT_H = 130, PERSON_H = 1.7, BOT_UNITS = 1.9;
    const SEARCH_MS = 5000, INSIDE_MS = 320, RETURN_MS = 900;
    const PINK = '#ff3cac', CYAN = '#01cdfe';

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    let vw = 0, vh = 0, W = 0, H = 0, dpr = 1, mobile = false, s1 = 1;
    let V = null, rink = null, track = null, stores = [], walkers = [], escalators = [];
    let time = 0, started = false, busy = false;
    const A = { x: 0, y: 0, s: 1, alpha: 0, face: 1, dist: 0, speed: 0, lift: 0, prop: 0, mood: 'happy', paper: false, float: false };
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

    function fitText(c, text, maxW, size, family, weight) {
        let fs = size;
        c.font = `${weight} ${fs}px ${family}`;
        while (c.measureText(text).width > maxW && fs > 5) {
            fs -= 0.5;
            c.font = `${weight} ${fs}px ${family}`;
        }
    }

    // ---------- perspective ----------
    // World units: x across the mall (0 = centre), y up (0 = ground floor), z into the screen.
    const P = (x, y, z) => ({ x: V.cx + V.f * x / z, y: V.cy - V.f * (y - V.camY) / z });
    const ppu = z => V.f / z;                       // screen pixels per world unit at depth z

    function quad(c, pts, fill) {
        c.beginPath();
        pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
        c.closePath();
        if (fill) {
            c.fillStyle = fill;
            c.fill();
        }
    }

    function seg(c, a, b) {
        line(c, a.x, a.y, b.x, b.y);
    }

    function neon(c, a, b, color, width = 2) {
        c.save();
        c.strokeStyle = color;
        c.shadowColor = color;
        c.shadowBlur = 10;
        c.lineWidth = width;
        seg(c, a, b);
        c.shadowBlur = 0;
        c.strokeStyle = 'rgba(255,255,255,0.75)';
        c.lineWidth = Math.max(0.6, width * 0.35);
        seg(c, a, b);
        c.restore();
    }

    // Local drawing frame on a side wall at (y, z): x runs along the wall in reading order,
    // y runs down, and `k` local units make one world unit.
    function wallFrame(side, y, z, k) {
        const x = side * V.X, p = P(x, y, z);
        const ux = -V.f * x / (z * z), uy = V.f * (y - V.camY) / (z * z);
        const dir = side < 0 ? 1 : -1;
        return [ux * dir / k, uy * dir / k, 0, ppu(z) / k, p.x, p.y];
    }

    function inFrame(c, m, fn) {
        c.save();
        c.transform(...m);
        fn();
        c.restore();
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
    // Window products for each store, drawn about 20 units tall with the base at y = 0.
    const BRIGHT = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
    const pickC = rnd => BRIGHT[Math.floor(rnd() * BRIGHT.length)];
    const poly = (c, pts, color) => {
        c.fillStyle = color;
        c.beginPath();
        pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.closePath();
        c.fill();
    };
    const PRODUCTS = {
        'CANDY SHOP': (c, rnd) => {
            if (rnd() < 0.5) {
                c.strokeStyle = '#e5e7eb';
                c.lineWidth = 1.6;
                line(c, 0, 0, 0, -10);
                c.fillStyle = pickC(rnd);
                circle(c, 0, -14, 6);
                c.strokeStyle = '#fff';
                c.lineWidth = 1.3;
                c.beginPath();
                c.arc(0, -14, 3.5, 0, Math.PI * 1.5);
                c.stroke();
            } else {
                c.fillStyle = 'rgba(219,234,254,0.85)';
                rr(c, -7, -16, 14, 16, 3);
                c.fill();
                for (let i = 0; i < 7; i++) {
                    c.fillStyle = pickC(rnd);
                    circle(c, -4 + rnd() * 8, -3 - rnd() * 10, 2);
                }
                c.fillStyle = '#db2777';
                c.fillRect(-6, -19, 12, 3);
            }
        },
        'HOT SAUCE': (c, rnd) => {
            const col = rnd() < 0.6 ? '#dc2626' : '#ea580c';
            c.fillStyle = col;
            rr(c, -4, -13, 8, 13, 2);
            c.fill();
            c.fillRect(-1.5, -18, 3, 5);
            c.fillStyle = '#15803d';
            c.fillRect(-2, -21, 4, 3);
            c.fillStyle = '#fef3c7';
            c.fillRect(-4, -9, 8, 4);
            poly(c, [[0, -8.5], [1.5, -6], [0, -5.5], [-1.5, -6]], '#f97316');
        },
        'SNEAKERS': (c, rnd) => {
            poly(c, [[-9, 0], [9, 0], [9, -3], [4, -5], [0, -6], [-2, -11], [-8, -11], [-9, -6]], pickC(rnd));
            c.fillStyle = '#fff';
            c.fillRect(-9, -2, 18, 2);
            c.strokeStyle = '#fff';
            c.lineWidth = 0.9;
            line(c, -3, -9, 1, -7);
            line(c, -3, -7, 1, -5.5);
        },
        'TOY STORE': (c, rnd) => {
            if (rnd() < 0.5) {
                c.fillStyle = '#b45309';
                circle(c, -4, -18, 2.2);
                circle(c, 4, -18, 2.2);
                circle(c, 0, -14, 5);
                circle(c, 0, -5, 5.5);
                c.fillStyle = '#fde68a';
                circle(c, 0, -12.5, 2);
                circle(c, 0, -5, 3);
            } else {
                c.fillStyle = pickC(rnd);
                circle(c, 0, -7, 7);
                c.fillStyle = '#fff';
                c.fillRect(-7, -8.5, 14, 3);
            }
        },
        'COFFEE': (c, rnd) => {
            if (rnd() < 0.5) {
                c.fillStyle = '#fff';
                c.strokeStyle = '#78350f';
                c.lineWidth = 1.2;
                rr(c, -6, -11, 11, 11, 2);
                c.fill();
                c.stroke();
                c.beginPath();
                c.arc(5, -6, 3, -Math.PI / 2, Math.PI / 2);
                c.stroke();
                c.fillStyle = '#78350f';
                c.fillRect(-5, -10, 9, 2);
                c.strokeStyle = '#a8a29e';
                line(c, -2, -13, -1, -17);
                line(c, 2, -13, 3, -17);
            } else {
                c.fillStyle = '#78350f';
                rr(c, -6, -18, 12, 18, 2);
                c.fill();
                c.fillStyle = '#fef3c7';
                c.fillRect(-4, -12, 8, 5);
            }
        },
        'GADGETS': (c, rnd) => {
            if (rnd() < 0.5) {
                c.fillStyle = '#111827';
                rr(c, -5, -18, 10, 18, 2);
                c.fill();
                c.fillStyle = '#38bdf8';
                rr(c, -4, -16.5, 8, 14, 1);
                c.fill();
            } else {
                c.strokeStyle = '#111827';
                c.lineWidth = 2;
                c.beginPath();
                c.arc(0, -8, 7, Math.PI, 0);
                c.stroke();
                c.fillStyle = pickC(rnd);
                rr(c, -9, -9, 4, 8, 2);
                c.fill();
                rr(c, 5, -9, 4, 8, 2);
                c.fill();
            }
        },
        'PET SHOP': (c, rnd) => {
            if (rnd() < 0.5) {
                c.fillStyle = '#f5f5f4';
                c.fillRect(-6, -6, 12, 3);
                [[-6, -6.5], [-6, -2.5], [6, -6.5], [6, -2.5]].forEach(([x, y]) => circle(c, x, y, 2.2));
            } else {
                c.fillStyle = 'rgba(186,230,253,0.8)';
                circle(c, 0, -8, 8);
                poly(c, [[-3, -8], [2, -10], [3, -8], [2, -6]], '#f97316');
                poly(c, [[-3, -8], [-6, -10], [-6, -6]], '#f97316');
            }
        },
        'FLOWERS': (c, rnd) => {
            c.strokeStyle = '#16a34a';
            c.lineWidth = 1.2;
            [[-4, -14], [0, -17], [4, -14]].forEach(([x, y]) => line(c, 0, -6, x, y));
            [[-4, -14], [0, -17], [4, -14]].forEach(([x, y]) => {
                c.fillStyle = pickC(rnd);
                circle(c, x, y, 2.6);
                c.fillStyle = '#fde047';
                circle(c, x, y, 1);
            });
            c.fillStyle = '#0ea5e9';
            rr(c, -3, -7, 6, 7, 1.5);
            c.fill();
        },
        'CHEESE': c => {
            poly(c, [[-8, 0], [8, 0], [8, -9], [-8, -3]], '#facc15');
            poly(c, [[-8, -3], [8, -9], [6, -10], [-8, -4]], '#fde047');
            c.fillStyle = '#eab308';
            circle(c, -3, -2, 1.3);
            circle(c, 3, -4, 1.6);
            circle(c, 6, -2, 1);
        },
        'PERFUME': (c, rnd) => {
            c.fillStyle = rnd() < 0.5 ? 'rgba(240,171,252,0.9)' : 'rgba(253,186,116,0.9)';
            rr(c, -5, -12, 10, 12, 3);
            c.fill();
            c.fillStyle = '#7e22ce';
            c.fillRect(-2, -16, 4, 4);
            c.fillStyle = 'rgba(255,255,255,0.6)';
            c.fillRect(-3, -10, 1.5, 7);
        },
        'BAKERY': (c, rnd) => {
            c.fillStyle = '#d97706';
            c.beginPath();
            if (rnd() < 0.5) {
                c.ellipse(0, -5, 8, 5, 0, 0, Math.PI * 2);
                c.fill();
                c.strokeStyle = '#fbbf24';
                c.lineWidth = 1;
                [-3, 0, 3].forEach(x => line(c, x - 1, -8, x + 1, -3));
            } else {
                c.arc(0, -2, 8, Math.PI, 0);
                c.fill();
                c.strokeStyle = '#92400e';
                c.lineWidth = 0.8;
                [-4, 0, 4].forEach(x => line(c, x, -2, x * 0.7, -9));
            }
        },
        'ICE CREAM': (c, rnd) => {
            poly(c, [[-4, -9], [4, -9], [0, 0]], '#d97706');
            c.fillStyle = pickC(rnd);
            circle(c, 0, -12, 4.5);
            c.fillStyle = '#fdf2f8';
            circle(c, 0, -17, 3.5);
            c.fillStyle = '#dc2626';
            circle(c, 0, -21, 1.3);
        },
        'VINYL RECORDS': (c, rnd) => {
            c.fillStyle = '#111827';
            circle(c, 0, -9, 9);
            c.strokeStyle = '#374151';
            c.lineWidth = 0.6;
            [7, 5].forEach(r => {
                c.beginPath();
                c.arc(0, -9, r, 0, Math.PI * 2);
                c.stroke();
            });
            c.fillStyle = pickC(rnd);
            circle(c, 0, -9, 3);
        },
        'TEA HOUSE': (c, rnd) => {
            const col = pickC(rnd);
            c.fillStyle = col;
            c.beginPath();
            c.ellipse(0, -6, 7, 6, 0, 0, Math.PI * 2);
            c.fill();
            c.fillRect(-2, -14, 4, 3);
            c.strokeStyle = col;
            c.lineWidth = 2;
            line(c, 6, -7, 10, -11);
            c.beginPath();
            c.arc(-7, -7, 3, Math.PI / 2, Math.PI * 1.5);
            c.stroke();
        },
        'PIZZA': c => {
            poly(c, [[-7, -14], [7, -14], [0, 0]], '#fbbf24');
            c.fillStyle = '#b45309';
            rr(c, -8, -16, 16, 3, 1.5);
            c.fill();
            c.fillStyle = '#dc2626';
            circle(c, -2, -10, 1.6);
            circle(c, 2.5, -11, 1.4);
            circle(c, 0, -5, 1.3);
        },
        'HATS': (c, rnd) => {
            if (rnd() < 0.5) {
                c.fillStyle = '#111827';
                c.fillRect(-5, -15, 10, 13);
                c.fillRect(-8, -3, 16, 3);
                c.fillStyle = pickC(rnd);
                c.fillRect(-5, -6, 10, 2);
            } else {
                c.fillStyle = pickC(rnd);
                c.beginPath();
                c.arc(0, -2, 7, Math.PI, 0);
                c.fill();
                c.fillRect(0, -3, 10, 2.5);
            }
        },
        'SOCKS': (c, rnd) => {
            const col = pickC(rnd);
            c.fillStyle = col;
            c.fillRect(-3, -18, 6, 14);
            rr(c, -3, -7, 11, 7, 3);
            c.fill();
            c.fillStyle = '#fff';
            c.fillRect(-3, -15, 6, 1.5);
            c.fillRect(-3, -11, 6, 1.5);
        },
        'CHOCOLATE': c => {
            c.fillStyle = '#7c2d12';
            rr(c, -6, -17, 12, 17, 1);
            c.fill();
            c.strokeStyle = '#5b1f0e';
            c.lineWidth = 0.8;
            line(c, 0, -17, 0, -8);
            line(c, -6, -13, 6, -13);
            c.fillStyle = '#fbbf24';
            c.fillRect(-6, -8, 12, 8);
        },
        'JEWELRY': c => {
            c.strokeStyle = '#facc15';
            c.lineWidth = 2;
            c.beginPath();
            c.arc(0, -6, 5, 0, Math.PI * 2);
            c.stroke();
            poly(c, [[-3, -11], [3, -11], [4.5, -13.5], [0, -17], [-4.5, -13.5]], '#7dd3fc');
        },
        'GAMES': (c, rnd) => {
            c.fillStyle = '#4b5563';
            rr(c, -8, -11, 16, 8, 4);
            c.fill();
            c.fillStyle = '#e5e7eb';
            c.fillRect(-6, -7.6, 4, 1.2);
            c.fillRect(-4.6, -9, 1.2, 4);
            c.fillStyle = pickC(rnd);
            circle(c, 4, -8.5, 1.2);
            circle(c, 6, -6.5, 1.2);
        },
        'PLANTS': c => {
            poly(c, [[-5, -6], [5, -6], [4, 0], [-4, 0]], '#c2410c');
            c.fillStyle = '#16a34a';
            [[-4, -11, -0.6], [4, -11, 0.6], [0, -14, 0]].forEach(([x, y, a]) => {
                c.beginPath();
                c.ellipse(x, y, 2.5, 6, a, 0, Math.PI * 2);
                c.fill();
            });
        },
        'SUNGLASSES': (c, rnd) => {
            c.fillStyle = rnd() < 0.5 ? '#111827' : '#7c3aed';
            circle(c, -4.5, -8, 4);
            circle(c, 4.5, -8, 4);
            c.strokeStyle = '#111827';
            c.lineWidth = 1.2;
            line(c, -1, -9, 1, -9);
            line(c, -8.5, -9, -10, -11);
            line(c, 8.5, -9, 10, -11);
        },
        'POPCORN': c => {
            c.fillStyle = '#fff7ed';
            [[-4, -14], [0, -16], [4, -14], [-2, -12], [2, -12]].forEach(([x, y]) => circle(c, x, y, 2.8));
            poly(c, [[-6, -12], [6, -12], [4.5, 0], [-4.5, 0]], '#dc2626');
            c.fillStyle = '#fff';
            c.fillRect(-2.5, -12, 1.8, 12);
            c.fillRect(1.2, -12, 1.8, 12);
        },
        'KITES': (c, rnd) => {
            const col = pickC(rnd);
            poly(c, [[0, -21], [6, -13], [0, -10], [-6, -13]], col);
            poly(c, [[0, -10], [6, -13], [0, -3]], '#fde047');
            poly(c, [[0, -10], [-6, -13], [0, -3]], col);
            c.strokeStyle = '#475569';
            c.lineWidth = 0.8;
            c.beginPath();
            c.moveTo(0, -3);
            c.quadraticCurveTo(-3, -1, 1, 0);
            c.stroke();
        }
    };

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
        spacer.style.height = mobile ? '560px' : '';
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
        s1 = mobile ? 0.72 : clamp(vh / 860, 0.75, 0.95);

        // Camera in the middle of the mall, a little below the top floor, looking straight down
        // the corridor. On phones the mall fills the area below the rink.
        const top = mobile ? rink.y + rink.h + 6 : 0, bottom = H, regionH = bottom - top;
        const K = 3, Lh = 4, ceil = K * Lh, camY = mobile ? 6 : 7, zNear = 10;
        const ppuN = regionH * 1.08 / ceil;
        V = {
            K, Lh, ceil, camY, zNear, zFar: 52, top, bottom,
            f: ppuN * zNear, cx: W / 2, cy: bottom + 0.03 * regionH - ppuN * camY, X: W * 0.51 / ppuN
        };
        V.B = V.X * 0.33;                 // balcony walkway depth
        V.storeH = 3.3;
        V.fascia = 0.6;
        V.zStart = zNear * 0.55;
        V.zBridge = V.zFar - 4.5;

        stores = [];
        const sd = clamp(V.X * 0.65, 3.6, 6.4);
        const z0 = zNear * 0.8;
        const n = Math.floor((V.zBridge - z0) / sd);
        for (let k = 0; k < K; k++) {
            for (let i = 0; i < n; i++) {
                [-1, 1].forEach(side => {
                    const idx = ((k * n + i) * 2 + (side > 0 ? 1 : 0)) % STORES.length;
                    const za = z0 + i * sd;
                    stores.push({ side, k, za, zb: za + sd, zm: za + sd / 2, name: STORES[idx][0], color: STORES[idx][1], glow: 0, seed: idx * 7919 + k * 31 + 13 });
                });
            }
        }
        renderScene();
        renderRink();
        renderFrost();
        buildPeople();
        buildEscalators();
    }

    // where the agent hovers: next to the question box, or off to the side after "Just browsing"
    function boxRect() {
        const bw = bubble.hidden ? Math.min(560, vw - 24) : bubble.offsetWidth;
        const bh = bubble.hidden ? 200 : bubble.offsetHeight;
        const left = (vw - bw) / 2;
        const top = mobile ? V.top + 10 : Math.max(8, rink.y - bh - 14);
        return { left, top, bw, bh };
    }
    const askSpot = () => {
        const b = boxRect();
        if (mobile) return { x: vw - 58, y: b.top + b.bh + 30 + BOT_H * s1, s: s1 };
        return { x: Math.max(56, b.left - 62 * s1 - 12), y: b.top + b.bh / 2 + 64 * s1, s: s1 };
    };
    const restSpot = () => mobile ? { x: vw / 2, y: H - 24, s: s1 } : { x: vw - 64 * s1 - 8, y: rink.y + 40 + BOT_H * s1, s: s1 };
    const doorPt = st => {
        const p = P(st.side * (V.X - 0.35), st.k * V.Lh, st.zm);
        return { x: p.x, y: p.y, s: ppu(st.zm) * BOT_UNITS / BOT_H };
    };

    // stores the agent can visibly drive into (on screen, big enough, not hidden behind the rink)
    function visibleStores() {
        const y0 = mobile ? V.top : 0, y1 = mobile ? H : vh;
        return stores.filter(st => {
            const p = doorPt(st);
            if (p.s < 0.17) return false;
            if (p.x < 24 || p.x > vw - 24 || p.y - BOT_H * p.s < y0 + 6 || p.y > y1 - 4) return false;
            const overRink = p.x > rink.x - 12 && p.x < rink.x + rink.w + 12 && p.y > rink.y - 12 && p.y - BOT_H * p.s < rink.y + rink.h;
            return !overRink;
        });
    }

    // ---------- static scene ----------
    function renderScene() {
        scene.width = Math.round(W * dpr);
        scene.height = Math.round(H * dpr);
        const c = scene.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const { X, B, K, Lh, ceil, zFar: zF, zStart: zS, zBridge: zB } = V;
        c.fillStyle = '#12061f';
        c.fillRect(0, 0, W, H);

        // ceiling with a sunset skylight down the middle
        quad(c, [P(-X, ceil, zS), P(X, ceil, zS), P(X, ceil, zF), P(-X, ceil, zF)], '#1d0b36');
        const sk = X - B;
        const sg = c.createLinearGradient(0, P(0, ceil, zS).y, 0, P(0, ceil, zF).y);
        sg.addColorStop(0, '#14052e');
        sg.addColorStop(0.55, '#5b1a8f');
        sg.addColorStop(1, '#ff6ec7');
        quad(c, [P(-sk, ceil, zS), P(sk, ceil, zS), P(sk, ceil, zF), P(-sk, ceil, zF)], sg);
        const rnd = seeded(11);
        c.fillStyle = 'rgba(255,255,255,0.8)';
        for (let i = 0; i < 40; i++) {
            const p = P((rnd() * 2 - 1) * sk, ceil, zS + rnd() * (zF - zS) * 0.5);
            c.fillRect(p.x, p.y, 1.5, 1.5);
        }
        c.strokeStyle = '#140628';
        c.lineWidth = 2;
        for (let i = -2; i <= 2; i++) seg(c, P(sk * i / 2, ceil, zS), P(sk * i / 2, ceil, zF));
        for (let z = zS; z < zF; z += 3) seg(c, P(-sk, ceil, z), P(sk, ceil, z));
        [-1, 1].forEach(s => neon(c, P(s * sk, ceil, zS), P(s * sk, ceil, zF), CYAN, 3));

        drawBackWall(c);

        // side walls, level by level
        for (let k = 0; k < K; k++) {
            [-1, 1].forEach(s => {
                const y = k * Lh;
                quad(c, [P(s * X, y, zS), P(s * X, y, zF), P(s * X, y + Lh, zF), P(s * X, y + Lh, zS)], k % 2 ? '#2a1248' : '#311556');
            });
        }
        stores.forEach(st => drawStore(c, st));

        // checkerboard ground floor
        const t = X / 5;
        for (let xi = -5; xi < 5; xi++) {
            for (let z = zS, j = 0; z < zF; z += t, j++) {
                const z2 = Math.min(zF, z + t);
                quad(c, [P(xi * t, 0, z), P((xi + 1) * t, 0, z), P((xi + 1) * t, 0, z2), P(xi * t, 0, z2)], ((xi + j) % 2 + 2) % 2 ? '#f3e8ff' : '#1e1035');
            }
        }

        // bridges across the far end, then the side balconies
        for (let k = K - 1; k >= 1; k--) {
            const y = k * Lh;
            quad(c, [P(-X, y, zB), P(X, y, zB), P(X, y, zF), P(-X, y, zF)], y < V.camY ? '#f6c7e6' : '#1d0b36');
            quad(c, [P(-X, y - 0.45, zB), P(X, y - 0.45, zB), P(X, y, zB), P(-X, y, zB)], '#2a1248');
            neon(c, P(-X, y - 0.22, zB), P(X, y - 0.22, zB), PINK, 2);
            quad(c, [P(-X, y, zB), P(X, y, zB), P(X, y + 1, zB), P(-X, y + 1, zB)], 'rgba(1,205,254,0.12)');
            c.strokeStyle = '#e9e3ff';
            c.lineWidth = 1.5;
            seg(c, P(-X, y + 1, zB), P(X, y + 1, zB));
        }
        for (let k = K - 1; k >= 1; k--) {
            const y = k * Lh;
            [-1, 1].forEach(s => {
                const xi = s * (X - B), xo = s * X;
                const surf = [P(xo, y, zS), P(xi, y, zS), P(xi, y, zB), P(xo, y, zB)];
                if (y < V.camY) {
                    quad(c, surf, '#f6c7e6');
                } else {
                    quad(c, surf, '#1d0b36');
                    c.save();
                    c.fillStyle = '#fffb96';
                    c.shadowColor = '#fffb96';
                    c.shadowBlur = 8;
                    for (let z = zS + 1; z < zB; z += 3) {
                        const p = P(s * (X - B * 0.5), y, z);
                        circle(c, p.x, p.y, Math.max(1, ppu(z) * 0.08));
                    }
                    c.restore();
                }
                quad(c, [P(xi, y - 0.45, zS), P(xi, y - 0.45, zB), P(xi, y, zB), P(xi, y, zS)], '#2a1248');
                neon(c, P(xi, y - 0.22, zS), P(xi, y - 0.22, zB), PINK, 2.5);
                quad(c, [P(xi, y, zS), P(xi, y, zB), P(xi, y + 1, zB), P(xi, y + 1, zS)], 'rgba(1,205,254,0.10)');
                c.strokeStyle = 'rgba(233,227,255,0.45)';
                c.lineWidth = 1;
                for (let z = zS; z < zB; z += 2) seg(c, P(xi, y, z), P(xi, y + 1, z));
                c.strokeStyle = '#e9e3ff';
                c.lineWidth = 2.5;
                seg(c, P(xi, y + 1, zS), P(xi, y + 1, zB));
            });
        }

        // palm planters, mirrored on both sides
        for (let k = 0; k < K; k++) {
            for (let z = V.zNear + 3; z < zB; z += 11) {
                [-1, 1].forEach(s => {
                    const x = k === 0 ? s * (X - B - 0.6) : s * (X - B + 0.45);
                    const p = P(x, k * Lh, z);
                    drawPalm(c, p.x, p.y, ppu(z) / 30, s);
                });
            }
        }
    }

    function drawBackWall(c) {
        const { X, ceil, zFar: zF } = V;
        const wall = [P(-X, 0, zF), P(X, 0, zF), P(X, ceil, zF), P(-X, ceil, zF)];
        const yTop = wall[2].y, yBot = wall[0].y;
        const mg = c.createLinearGradient(0, yTop, 0, yBot);
        mg.addColorStop(0, '#2b1055');
        mg.addColorStop(0.45, '#7b2cbf');
        mg.addColorStop(0.7, '#ff3cac');
        mg.addColorStop(1, '#ffb86b');
        quad(c, wall, mg);
        c.save();
        quad(c, wall);
        c.clip();
        // synthwave sun with stripes cut out of it
        const sc = P(0, ceil * 0.45, zF), sr = ppu(zF) * X * 0.42;
        const sunG = c.createLinearGradient(0, sc.y - sr, 0, sc.y + sr);
        sunG.addColorStop(0, '#fffb96');
        sunG.addColorStop(1, '#ff3cac');
        c.fillStyle = sunG;
        circle(c, sc.x, sc.y, sr);
        c.fillStyle = mg;
        for (let i = 0; i < 6; i++) c.fillRect(sc.x - sr, sc.y + sr * (0.08 + i * 0.16), sr * 2, sr * (0.03 + i * 0.022));
        // neon grid below the horizon
        const hz = P(0, ceil * 0.2, zF).y;
        c.fillStyle = '#1a0638';
        c.fillRect(wall[0].x, hz, wall[1].x - wall[0].x, yBot - hz);
        c.strokeStyle = 'rgba(1,205,254,0.7)';
        c.lineWidth = 1;
        for (let i = -8; i <= 8; i++) line(c, sc.x + i * sr * 0.1, hz, sc.x + i * sr * 0.6, yBot);
        for (let i = 1; i < 6; i++) {
            const yy = hz + (yBot - hz) * Math.pow(i / 6, 1.8);
            line(c, wall[0].x, yy, wall[1].x, yy);
        }
        [-1, 1].forEach(s => drawPalm(c, sc.x + s * sr * 1.45, hz, ppu(zF) / 16, -s, '#1a0638'));
        c.restore();
        const sign = P(0, ceil * 0.82, zF);
        c.save();
        c.font = `${Math.max(8, ppu(zF) * 1.15)}px Monoton, Righteous, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.shadowColor = PINK;
        c.shadowBlur = 14;
        c.fillStyle = '#ffd1ec';
        c.fillText('THE PAPER MALL', sign.x, sign.y);
        c.restore();
    }

    // a potted palm (or a flat silhouette when `solid` is given); s = scale, dir = lean
    function drawPalm(c, x, y, s, dir, solid) {
        if (s < 0.15) return;
        c.save();
        c.translate(x, y);
        c.scale(s * dir, s);
        c.lineCap = 'round';
        if (!solid) {
            c.fillStyle = '#ff71ce';
            c.beginPath();
            c.moveTo(-9, -12);
            c.lineTo(9, -12);
            c.lineTo(7, 0);
            c.lineTo(-7, 0);
            c.closePath();
            c.fill();
            c.fillStyle = '#01cdfe';
            c.fillRect(-9, -12, 18, 3);
        }
        c.strokeStyle = solid || '#9a6a3a';
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(0, -12);
        c.quadraticCurveTo(-2, -40, 6, -62);
        c.stroke();
        c.strokeStyle = solid || '#05c46b';
        c.lineWidth = 4.5;
        [[-34, -48], [-26, -72], [6, -84], [34, -70], [36, -46]].forEach(([dx, dy]) => {
            c.beginPath();
            c.moveTo(6, -62);
            c.quadraticCurveTo(6 + dx * 0.5, -62 + (dy + 62) * 0.2 - 10, 6 + dx, dy);
            c.stroke();
        });
        c.restore();
    }

    function drawStore(c, st) {
        const { side, k, za, zb, zm } = st;
        const rnd = seeded(st.seed);
        const y0 = k * V.Lh, yT = y0 + V.storeH, yF = yT - V.fascia;
        const w = (z, y) => P(side * V.X, y, z);

        quad(c, [w(za, y0), w(zb, y0), w(zb, yT), w(za, yT)], '#170a2b');
        // fascia with a neon name
        quad(c, [w(za + 0.1, yF), w(zb - 0.1, yF), w(zb - 0.1, yT - 0.05), w(za + 0.1, yT - 0.05)], '#0d0518');
        if (ppu(zm) * V.fascia > 7) {
            inFrame(c, wallFrame(side, (yF + yT) / 2, zm, 40), () => {
                fitText(c, st.name, (zb - za) * 40 * 0.82, V.fascia * 40 * 0.62, 'Righteous, sans-serif', 400);
                c.textAlign = 'center';
                c.textBaseline = 'middle';
                c.shadowColor = st.color;
                c.shadowBlur = 8;
                c.fillStyle = st.color;
                c.fillText(st.name, 0, 1);
            });
        }

        // bright window
        const ga = za + 0.3, gb = zb - 0.3, gy = yF - 0.15;
        const win = [w(ga, y0), w(gb, y0), w(gb, gy), w(ga, gy)];
        quad(c, win, '#fdf0ff');
        const g = c.createLinearGradient(0, Math.min(win[2].y, win[3].y), 0, Math.max(win[0].y, win[1].y));
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, st.color + '99');
        quad(c, win, g);

        // door
        const dw = Math.min(1.6, (zb - za) * 0.3), d0 = zm - dw / 2, d1 = zm + dw / 2;
        st.door = [w(d0, y0), w(d1, y0), w(d1, y0 + 2.3), w(d0, y0 + 2.3)];
        quad(c, st.door, 'rgba(29,11,58,0.88)');

        // shelves of the store's own products either side of the door
        const product = PRODUCTS[st.name];
        [[ga + 0.15, d0 - 0.15], [d1 + 0.15, gb - 0.15]].forEach(([a, b]) => {
            if (b - a < 0.6) return;
            [0.95, 1.85].forEach(sy => {
                c.strokeStyle = '#a16207';
                c.lineWidth = Math.max(1, ppu((a + b) / 2) * 0.06);
                seg(c, w(a, y0 + sy), w(b, y0 + sy));
                const cnt = b - a >= 1.6 ? 2 : 1;
                for (let j = 0; j < cnt; j++) {
                    const z = a + (b - a) * (j + 0.5) / cnt;
                    if (ppu(z) * 0.7 < 5 || !product) continue;
                    inFrame(c, wallFrame(side, y0 + sy, z, 20 / 0.7), () => product(c, rnd));
                }
            });
        });

        // neon outlines
        c.save();
        c.strokeStyle = st.color;
        c.shadowColor = st.color;
        c.shadowBlur = 10;
        c.lineWidth = clamp(ppu(zm) * 0.05, 1, 3);
        quad(c, win);
        c.stroke();
        quad(c, st.door);
        c.stroke();
        c.restore();
        c.strokeStyle = '#3d1d6b';
        c.lineWidth = clamp(ppu(za) * 0.08, 1, 6);
        seg(c, w(za, y0), w(za, yT + 0.6));
    }

    // the rink sits flat in front of the mall, with the bio printed under its ice
    function renderRink() {
        const m = 30, { x, y, w, h, r } = rink;
        rinkLayer.width = Math.round((w + 2 * m) * dpr);
        rinkLayer.height = Math.round((h + 2 * m) * dpr);
        const c = rinkLayer.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, m * dpr, m * dpr);
        c.save();
        c.shadowColor = 'rgba(255,60,172,0.55)';
        c.shadowBlur = 26;
        c.fillStyle = '#ffffff';
        rr(c, 0, 0, w, h, r);
        c.fill();
        c.restore();
        c.lineWidth = 4;
        c.strokeStyle = PINK;
        rr(c, 2, 2, w - 4, h - 4, r - 2);
        c.stroke();
        c.lineWidth = 2;
        c.strokeStyle = CYAN;
        rr(c, 6, 6, w - 12, h - 12, r - 6);
        c.stroke();
        const ix = 9, iy = 9, iw = w - 18, ih = h - 18;
        const g = c.createLinearGradient(ix, iy, ix + iw, iy + ih);
        g.addColorStop(0, '#f4fbff');
        g.addColorStop(0.5, '#e3f1fb');
        g.addColorStop(1, '#f3eefe');
        c.fillStyle = g;
        rr(c, ix, iy, iw, ih, r - 9);
        c.fill();
        c.save();
        rr(c, ix, iy, iw, ih, r - 9);
        c.clip();
        c.lineWidth = 4;
        c.strokeStyle = 'rgba(255,60,172,0.16)';
        line(c, w / 2, iy, w / 2, iy + ih);
        c.strokeStyle = 'rgba(1,205,254,0.18)';
        line(c, w * 0.22, iy, w * 0.22, iy + ih);
        line(c, w * 0.78, iy, w * 0.78, iy + ih);
        c.restore();
        rink.layerX = x - m;
        rink.layerY = y - m;
        rink.layerW = w + 2 * m;
        rink.layerH = h + 2 * m;
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

    // ---------- shoppers ----------
    const walkX = (k, s) => s * (k === 0 ? V.X - 1.3 : V.X - V.B * 0.5);

    function buildPeople() {
        const rnd = seeded(77);
        walkers = [];
        for (let k = 0; k < V.K; k++) {
            [-1, 1].forEach(s => {
                for (let j = 0; j < (mobile ? 1 : 2); j++) {
                    walkers.push({
                        k, s, z: V.zNear * 1.05 + rnd() * (V.zBridge - V.zNear * 1.1), dir: rnd() < 0.5 ? -1 : 1,
                        speed: 1 + rnd() * 0.5, alpha: 1, state: 'walk', wait: 0, phase: rnd() * 6,
                        p: makePerson(rnd, k * 4 + j * 2 + (s > 0 ? 1 : 0))
                    });
                }
            });
        }
    }

    function updateWalkers(dt) {
        walkers.forEach(wk => {
            if (wk.state === 'gone') {
                if ((wk.wait -= dt) > 0) return;
                // come back out of another store on the same floor
                const list = stores.filter(st => st.k === wk.k && st.side === wk.s);
                wk.z = list[Math.floor(Math.random() * list.length)].zm;
                wk.state = 'out';
                wk.alpha = 0;
                return;
            }
            if (wk.state === 'in') {
                wk.alpha = Math.max(0, wk.alpha - dt * 2);
                if (wk.alpha === 0) {
                    wk.state = 'gone';
                    wk.wait = 1 + Math.random() * 3;
                }
                return;
            }
            if (wk.state === 'out') {
                wk.alpha = Math.min(1, wk.alpha + dt * 2);
                if (wk.alpha === 1) wk.state = 'walk';
                return;
            }
            wk.z += wk.dir * wk.speed * dt;
            wk.phase += dt * 6;
            const zmin = V.zNear * 1.05, zmax = V.zBridge - 1;
            if (wk.z < zmin || wk.z > zmax) {
                wk.dir *= -1;
                wk.z = clamp(wk.z, zmin, zmax);
            } else if (Math.random() < dt * 0.08) {
                // pop into the store being passed
                if (stores.some(st => st.k === wk.k && st.side === wk.s && Math.abs(st.zm - wk.z) < 0.4)) wk.state = 'in';
            }
        });
    }

    // ---------- escalators (a mirrored pair, first floor up to the top floor) ----------
    function buildEscalators() {
        escalators = [-1, 1].map(s => ({
            s, up: s < 0, xm: s * (V.X - V.B - 0.6), xa: s * (V.X - V.B - 0.15), xb: s * (V.X - V.B - 1.05),
            z0: 6.5, z1: 13.5, y0: V.Lh, y1: 2 * V.Lh
        }));
        escalators.forEach(e => {
            e.riders = [0, 1].map(j => ({
                e, path: null, seg: 0, t: 0, alpha: 1, wait: j * 4 + (e.up ? 0 : 2), phase: 0, face: 1,
                p: makePerson(seeded(31 + j * 7 + (e.s > 0 ? 50 : 0)), j * 3 + (e.s > 0 ? 1 : 0) + 2)
            }));
        });
    }

    // Up riders walk in along the first floor, ride up and walk into a top-floor store;
    // down riders come out of a top-floor store, ride down and walk off towards the viewer.
    function riderPath(e) {
        const s = e.s, xw = walkX(1, s), xd = s * (V.X - 0.3);
        const ups = stores.filter(st => st.k === 2 && st.side === s && st.zm > e.z1 + 1 && st.zm < e.z1 + 14);
        const b = ups.length ? ups[Math.floor(Math.random() * ups.length)].zm : e.z1 + 4;
        const lower = [{ x: xw, y: e.y0, z: 3.5 }, { x: xw, y: e.y0, z: e.z0 - 0.6 }, { x: e.xm, y: e.y0, z: e.z0 }];
        const upper = [{ x: e.xm, y: e.y1, z: e.z1 }, { x: xw, y: e.y1, z: e.z1 + 0.6 }, { x: xw, y: e.y1, z: b }, { x: xd, y: e.y1, z: b }];
        if (e.up) {
            lower[2].ride = true;
            return { pts: [...lower, ...upper], fadeStart: false, fadeEnd: true };
        }
        const pts = [...upper.reverse(), ...lower.reverse()];
        pts[3].ride = true;
        return { pts, fadeStart: true, fadeEnd: false };
    }

    function updateRider(rd, dt) {
        if (!rd.path) {
            if ((rd.wait -= dt) > 0) return;
            rd.path = riderPath(rd.e);
            rd.seg = 0;
            rd.t = 0;
        }
        const pts = rd.path.pts, a = pts[rd.seg], b = pts[rd.seg + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 0.01;
        rd.t += dt * (a.ride ? 0.9 : 1.3) / len;
        if (!a.ride) rd.phase += dt * 6;
        if (rd.t >= 1) {
            rd.seg++;
            rd.t = 0;
            if (rd.seg >= pts.length - 1) {
                rd.path = null;
                rd.wait = 1 + Math.random() * 3;
                return;
            }
        }
        const last = rd.seg === pts.length - 2, first = rd.seg === 0;
        rd.alpha = rd.path.fadeEnd && last ? 1 - rd.t : rd.path.fadeStart && first ? rd.t : 1;
    }

    function riderPos(rd) {
        const pts = rd.path.pts, a = pts[rd.seg], b = pts[rd.seg + 1], t = rd.t;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, ride: !!a.ride };
    }

    const escPt = (e, x, u, dy = 0) => P(x, e.y0 + (e.y1 - e.y0) * u + dy, e.z0 + (e.z1 - e.z0) * u);

    function drawEscalatorBody(c, e) {
        quad(c, [escPt(e, e.xb, 0, -0.1), escPt(e, e.xb, 1, -0.1), escPt(e, e.xb, 1, -0.9), escPt(e, e.xb, 0, -0.9)], '#2a1248');
        neon(c, escPt(e, e.xb, 0, -0.5), escPt(e, e.xb, 1, -0.5), PINK, 2);
        quad(c, [escPt(e, e.xa, 0), escPt(e, e.xb, 0), escPt(e, e.xb, 1), escPt(e, e.xa, 1)], '#4a3a66');
        c.strokeStyle = '#a99bd0';
        c.lineWidth = 1.2;
        const n = 18, ph = (time * 0.5) % 1;
        for (let i = 0; i < n; i++) {
            const u = (i + (e.up ? ph : 1 - ph)) / n;
            seg(c, escPt(e, e.xa, u), escPt(e, e.xb, u));
        }
    }

    function drawEscalatorGlass(c, e) {
        [e.xa, e.xb].forEach(x => {
            quad(c, [escPt(e, x, 0), escPt(e, x, 1), escPt(e, x, 1, 1), escPt(e, x, 0, 1)], 'rgba(1,205,254,0.16)');
            c.strokeStyle = '#0d0518';
            c.lineWidth = 3.5;
            c.lineCap = 'round';
            seg(c, escPt(e, x, -0.03, 1), escPt(e, x, 1.03, 1));
        });
    }

    // ---------- skaters ----------
    const skaters = (() => {
        const rnd = seeded(2024);
        return Array.from({ length: 10 }, (_, i) => ({
            t: i / 10 + rnd() * 0.03, speed: 50 + rnd() * 50, lane: (rnd() - 0.5) * 12,
            p: makePerson(rnd, i), wobbly: i === 1, fallen: 0, phase: rnd() * 6, face: 1
        }));
    })();

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

    // ---------- the agent: a hot-pink robot riding a shopping cart, same colours as its box ----------
    function drawBot(c, x, y, s, alpha, ghost) {
        const moving = A.speed > 0, fast = A.speed > 700;
        const hover = A.float && !moving;
        const bob = hover ? Math.sin(time * 2.2) * 5 : moving ? Math.sin(A.dist * 0.25) * 1.5 : Math.sin(time * 2.4) * 1.2;
        c.save();
        c.globalAlpha = alpha;
        c.translate(x, y);
        c.scale(s * A.face, s);
        // glow so the agent is easy to spot while it talks
        if (!ghost && (A.float || !bubble.hidden)) {
            const rg = c.createRadialGradient(0, -70, 10, 0, -70, 110);
            rg.addColorStop(0, 'rgba(255,60,172,0.45)');
            rg.addColorStop(1, 'rgba(255,60,172,0)');
            c.fillStyle = rg;
            c.fillRect(-120, -190, 240, 240);
        }
        if (!ghost && A.lift < 4 && !A.float) {
            c.fillStyle = 'rgba(0,0,0,0.3)';
            c.beginPath();
            c.ellipse(0, 2, 38, 6, 0, 0, Math.PI * 2);
            c.fill();
        }
        c.translate(0, -A.lift / s + bob);
        if (fast) c.rotate(0.08);
        c.lineCap = 'round';
        c.lineJoin = 'round';

        // wheels and chassis
        [-22, 22].forEach(wx => {
            c.fillStyle = '#1d0b3a';
            circle(c, wx, -6, 6);
            c.fillStyle = CYAN;
            circle(c, wx, -6, 2.2);
            c.strokeStyle = '#7dd3fc';
            c.lineWidth = 1.5;
            const a = A.dist / 6;
            line(c, wx - 4 * Math.cos(a), -6 - 4 * Math.sin(a), wx + 4 * Math.cos(a), -6 + 4 * Math.sin(a));
        });
        c.strokeStyle = '#c4b5fd';
        c.lineWidth = 3;
        line(c, -26, -20, -22, -10);
        line(c, 28, -20, 22, -10);
        line(c, -24, -14, 24, -14);
        line(c, -36, -60, -50, -70);
        c.fillStyle = CYAN;
        circle(c, -50, -70, 4.5);

        // robot body (behind the basket front)
        c.fillStyle = PINK;
        c.strokeStyle = '#ffffff';
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
        c.fillStyle = 'rgba(1,205,254,0.18)';
        basket();
        c.fill();
        c.strokeStyle = '#c4b5fd';
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
        c.strokeStyle = CYAN;
        c.lineWidth = 4;
        line(c, -37, -60, 39, -60);
        // hands on the rim
        c.fillStyle = PINK;
        circle(c, -8, -61, 4.5);
        circle(c, 20, -61, 4.5);

        // head
        c.fillStyle = '#ffffff';
        c.strokeStyle = PINK;
        c.lineWidth = 3;
        rr(c, -23, -108, 48, 44, 16);
        c.fill();
        c.stroke();
        c.fillStyle = '#1d0b3a';
        rr(c, -16, -100, 34, 28, 10);
        c.fill();
        // face
        c.strokeStyle = c.fillStyle = '#67e8f9';
        c.lineWidth = 2.2;
        if (!ghost) {
            c.shadowColor = CYAN;
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
        c.fillStyle = 'rgba(255,60,172,0.6)';
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
        [PINK, '#fffb96', CYAN, '#b967ff'].forEach((col, k) => {
            c.fillStyle = col;
            c.beginPath();
            c.moveTo(1, -106);
            c.ellipse(1, -106, 20, 15, 0, Math.PI + k * Math.PI / 4, Math.PI + (k + 1) * Math.PI / 4);
            c.closePath();
            c.fill();
        });
        c.fillStyle = '#fffb96';
        rr(c, -20, -108, 42, 5, 2.5);
        c.fill();
        c.strokeStyle = '#c4b5fd';
        c.lineWidth = 2;
        line(c, 1, -121, 1, -127);
        const spin = Math.cos(A.prop);
        [[PINK, -1], [CYAN, 1]].forEach(([col, sgn]) => {
            c.fillStyle = col;
            c.beginPath();
            c.ellipse(1 + sgn * 8 * spin, -128, Math.max(1, 8 * Math.abs(spin)), 2.6, 0, 0, Math.PI * 2);
            c.fill();
        });
        c.fillStyle = '#fffb96';
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
                Object.assign(A, segs[segs.length - 1].to, { alpha: 1, lift: 0 });
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
        const f = askSpot();
        const vis = visibleStores();
        const list = vis.length ? vis : stores;
        const st = list.reduce((a, b) => Math.hypot(doorPt(b).x - f.x, doorPt(b).y - f.y) < Math.hypot(doorPt(a).x - f.x, doorPt(a).y - f.y) ? b : a);
        Object.assign(A, doorPt(st), { alpha: 0, float: false });
        queue.push(wait(600), call(() => { st.glow = 1; }), fade(1, 350), call(() => { A.float = true; }), move(askSpot, 260), call(showAsk));
    }

    function shop(q) {
        busy = true;
        hideBubble();
        A.mood = 'go';
        A.paper = false;
        A.float = false;
        // a handful of random visible stores, all visited within exactly SEARCH_MS
        const pool = visibleStores();
        const k = Math.min(Math.max(pool.length, 1), 4 + Math.floor(Math.random() * 3));
        const order = (pool.length ? pool : stores).slice().sort(() => Math.random() - 0.5).slice(0, k);
        const stops = order.map(doorPt);
        const home = askSpot();
        let prev = { x: A.x, y: A.y, s: A.s };
        const dists = stops.map(p => {
            const d = Math.hypot(p.x - prev.x, p.y - prev.y);
            prev = p;
            return d;
        });
        const sum = dists.reduce((a, b) => a + b, 0) || 1;
        const travel = SEARCH_MS - RETURN_MS - order.length * INSIDE_MS;
        const setStatus = n => {
            status.textContent = `Searching for “${q}” · store ${n} of ${order.length}`;
        };

        const segs = [];
        prev = { x: A.x, y: A.y, s: A.s };
        stops.forEach((p, n) => {
            segs.push({ type: 'move', from: prev, to: p, dur: travel * dists[n] / sum });
            segs.push({
                type: 'in', dur: INSIDE_MS, start: () => {
                    const st = order[n];
                    st.glow = 1;
                    const sp = P(st.side * V.X, st.k * V.Lh + V.storeH + 0.2, st.zm);
                    pops.push({ x: sp.x, y: sp.y, text: POPS[Math.floor(Math.random() * POPS.length)], t0: time });
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
                A.float = true;
            }
        });
        setStatus(0);
        status.hidden = false;
        queue.push(timeline(segs, () => showAnswer(q, order.length)));
    }

    // ---------- speech box ----------
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
        A.float = true;
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

    // "Just browsing": the agent floats aside and waits with a small prompt
    function dismiss() {
        if (busy) return;
        busy = true;
        hideBubble();
        queue.push(move(restSpot, 520), call(() => {
            busy = false;
            A.mood = 'happy';
            chip.hidden = false;
        }));
    }

    function summon() {
        if (busy) return;
        busy = true;
        chip.hidden = true;
        queue.push(move(askSpot, 520), call(showAsk));
    }

    function placeUI() {
        const headY = A.y - A.lift - BOT_H * A.s * 0.72;
        if (!bubble.hidden) {
            const b = boxRect();
            bubble.style.left = b.left + 'px';
            bubble.style.top = b.top + 'px';
            const side = !mobile;
            bubble.classList.toggle('tail-left', side);
            if (side) bubble.style.setProperty('--tail-y', clamp(headY - b.top, 26, b.bh - 26) + 'px');
            else bubble.style.setProperty('--tail-x', clamp(A.x - b.left, 26, b.bw - 26) + 'px');
        }
        if (!chip.hidden) {
            const cw = chip.offsetWidth, ch = chip.offsetHeight;
            const left = clamp(A.x - cw / 2, 8, vw - cw - 8);
            chip.style.left = left + 'px';
            chip.style.top = A.y - A.lift - (BOT_H + 14) * A.s - ch - 6 + 'px';
            chip.style.setProperty('--tail-x', clamp(A.x - left, 16, cw - 16) + 'px');
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

    // ---------- loop ----------
    let last = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        time += dt;

        A.speed = 0;
        if (queue.length && queue[0](dt)) queue.shift();
        // while idle, keep hovering at its spot (follows the box as it resizes)
        if (started && !busy && !queue.length) {
            const t = chip.hidden ? askSpot() : restSpot();
            const k = Math.min(1, dt * 6);
            A.x += (t.x - A.x) * k;
            A.y += (t.y - A.y) * k;
            A.s += (t.s - A.s) * k;
        }
        A.prop += dt * (A.float || A.lift > 0 || A.speed > 700 ? 34 : 5);
        if (A.speed > 700) {
            trail.push({ x: A.x, y: A.y, s: A.s, lift: A.lift });
            if (trail.length > 5) trail.shift();
        } else if (trail.length) {
            trail.shift();
        }
        stores.forEach(st => { st.glow = Math.max(0, st.glow - dt * 1.6); });
        updateWalkers(dt);
        escalators.forEach(e => e.riders.forEach(rd => updateRider(rd, dt)));
        updateSkaters(dt);

        const sy = clamp(window.scrollY, 0, Math.max(0, H - vh));
        bg.setTransform(dpr, 0, 0, dpr, 0, 0);
        bg.clearRect(0, 0, vw, vh);
        const ch = Math.min(vh, H);
        bg.drawImage(scene, 0, sy * dpr, W * dpr, ch * dpr, 0, 0, W, ch);
        bg.save();
        bg.translate(0, -sy);
        stores.forEach(st => {
            if (st.glow > 0 && st.door) {
                bg.globalAlpha = st.glow * 0.7;
                quad(bg, st.door, st.color);
                bg.globalAlpha = 1;
            }
        });

        // shoppers and escalator riders, far to near
        escalators.forEach(e => drawEscalatorBody(bg, e));
        const people = [];
        walkers.forEach(wk => {
            if (wk.state === 'gone') return;
            const x = walkX(wk.k, wk.s) + (wk.s * (V.X - 0.3) - walkX(wk.k, wk.s)) * (1 - wk.alpha);
            const face = wk.state === 'walk' ? (wk.s < 0 ? wk.dir : -wk.dir) : (wk.state === 'in' ? -wk.s : wk.s);
            people.push({ z: wk.z, x, y: wk.k * V.Lh, alpha: wk.alpha, p: wk.p, face, phase: wk.phase, mode: 'walk' });
        });
        escalators.forEach(e => e.riders.forEach(rd => {
            if (!rd.path) return;
            const q = riderPos(rd), sp = P(q.x, q.y, q.z);
            if (rd.prevX !== undefined && Math.abs(sp.x - rd.prevX) > 0.05) rd.face = sp.x > rd.prevX ? 1 : -1;
            rd.prevX = sp.x;
            people.push({ z: q.z, x: q.x, y: q.y, alpha: rd.alpha, p: rd.p, face: rd.face, phase: rd.phase, mode: q.ride ? 'stand' : 'walk' });
        }));
        people.sort((a, b) => b.z - a.z).forEach(pp => {
            if (pp.z <= 1) return;
            const scale = ppu(pp.z) * PERSON_H / 38;
            if (scale < 0.08 || scale > 2.6 || pp.alpha <= 0) return;
            const sp = P(pp.x, pp.y, pp.z);
            bg.globalAlpha = pp.alpha;
            drawPerson(bg, pp.p, sp.x, sp.y, scale, pp.face, pp.phase, pp.mode);
            bg.globalAlpha = 1;
        });
        escalators.forEach(e => drawEscalatorGlass(bg, e));
        bg.drawImage(rinkLayer, rink.layerX, rink.layerY, rink.layerW, rink.layerH);
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
            fg.fillStyle = 'rgba(29,11,58,0.92)';
            rr(fg, p.x - tw / 2, y - 11, tw, 22, 11);
            fg.fill();
            fg.strokeStyle = PINK;
            fg.lineWidth = 1.5;
            fg.stroke();
            fg.fillStyle = '#ffffff';
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
        placeUI();
        requestAnimationFrame(frame);
    }

    layout();
    window.addEventListener('resize', layout);
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(card);
    if (document.fonts) {
        Promise.all(['20px Monoton', '20px Righteous'].map(f => document.fonts.load(f).catch(() => null)))
            .then(() => document.fonts.ready)
            .then(layout);
    }

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
