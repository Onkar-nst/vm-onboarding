/* ═══════════════════════════════════════════════════════
   Onkar Dange — Portfolio interactions
   Vanilla JS. Native scroll (keeps position:sticky intact).
   ═══════════════════════════════════════════════════════ */

const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─────────── PRELOADER ─────────── */
(function preloader() {
  const el = $('#preloader'), bar = $('#preBar');

  // dev flag: add ?nopreload to the URL to skip the intro while working on the page
  if (location.search.includes('nopreload')) {
    el.remove();
    // defer so the fan cards exist before we lay them out
    setTimeout(() => {
      startHero();
      if (location.hash) {
        const t = $(location.hash);
        if (t) t.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    }, 250);
    return;
  }

  document.body.classList.add('loading');
  let p = 0;
  const tick = setInterval(() => {
    p = Math.min(100, p + Math.random() * 18 + 6);
    bar.style.width = p + '%';
    if (p >= 100) {
      clearInterval(tick);
      setTimeout(() => {
        el.classList.add('done');
        document.body.classList.remove('loading');
        startHero();
      }, 350);
    }
  }, 140);
})();

/* ─────────── CUSTOM CURSOR ─────────── */
(function cursor() {
  const dot = $('#cursorDot'), ring = $('#cursorRing');
  if (!dot || window.matchMedia('(hover: none)').matches) return;
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;

  addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
  });

  (function loop() {
    rx = lerp(rx, mx, 0.18); ry = lerp(ry, my, 0.18);
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  })();

  const hoverables = 'a, button, .fan-card, .poster, .arch-card, .service-row';
  document.addEventListener('mouseover', e => {
    if (e.target.closest(hoverables)) ring.classList.add('grow');
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(hoverables)) ring.classList.remove('grow');
  });
})();

/* ─────────── NAV ─────────── */
(function nav() {
  const navEl = $('#nav'), burger = $('#navBurger'), menu = $('#mobileMenu');
  let last = 0;

  addEventListener('scroll', () => {
    const y = scrollY;
    if (y > 200 && y > last) navEl.classList.add('hidden');
    else navEl.classList.remove('hidden');
    last = y;
  }, { passive: true });

  const toggle = () => {
    burger.classList.toggle('open');
    menu.classList.toggle('open');
    document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
  };
  burger.addEventListener('click', toggle);
  $$('#mobileMenu a').forEach(a => a.addEventListener('click', () => {
    burger.classList.remove('open');
    menu.classList.remove('open');
    document.body.style.overflow = '';
  }));

  // Resume link — point these at your PDF
  const resumeUrl = '#';
  [$('#resumeLink'), $('#resumeLinkMobile')].forEach(el => {
    if (!el) return;
    el.addEventListener('click', e => {
      if (resumeUrl === '#') {
        e.preventDefault();
        toast('Add your resume link in app.js → resumeUrl');
      }
    });
  });
})();

/* ─────────── HERO: split title + fanning card stack ─────────── */
const FAN = [
  { label: 'Aurora',   g: 'linear-gradient(150deg,#1e3a8a,#7c3aed)' },
  { label: 'Voyage',   g: 'linear-gradient(150deg,#0f766e,#22c55e)' },
  { label: 'Pulse',    g: 'linear-gradient(150deg,#b45309,#f59e0b)' },
  { label: 'Marketly', g: 'linear-gradient(150deg,#9d174d,#f43f5e)' },
  { label: 'Reelist',  g: 'linear-gradient(150deg,#1e293b,#0ea5e9)' },
  { label: 'Handy',    g: 'linear-gradient(150deg,#4c1d95,#db2777)' },
  { label: 'Sketch',   g: 'linear-gradient(150deg,#065f46,#84cc16)' },
  { label: 'Nimbus',   g: 'linear-gradient(150deg,#7c2d12,#fb923c)' },
  { label: 'Echo',     g: 'linear-gradient(150deg,#312e81,#6366f1)' },
  { label: 'Orbit',    g: 'linear-gradient(150deg,#831843,#a855f7)' },
  { label: 'Forge',    g: 'linear-gradient(150deg,#134e4a,#14b8a6)' }
];

(function buildFan() {
  const fan = $('#fan');
  FAN.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'fan-card';
    card.innerHTML = `<div class="fan-face" style="background:${c.g}">${c.label}</div>`;
    card.dataset.i = i;
    fan.appendChild(card);
  });
})();

// spread the cards into an arc
function layoutFan() {
  const cards = $$('.fan-card');
  const n = cards.length;
  const wide = innerWidth > 768;
  const spreadX = wide ? 68 : 30;   // px between card centres
  const arc = wide ? 130 : 84;      // arc depth
  const rot = wide ? 4.2 : 3.0;     // deg per step

  cards.forEach((card, i) => {
    const t = i - (n - 1) / 2;               // -5 … +5
    const x = t * spreadX;
    const y = (t * t) * (arc / ((n / 2) ** 2)) * 0.32;
    const r = t * rot;
    card.dataset.x = x; card.dataset.y = y; card.dataset.r = r;
    card.style.zIndex = 20 - Math.abs(t);
    card.style.transitionDelay = `${i * 45}ms`;
    card.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
  });
}

function startHero() {
  const cards = $$('.fan-card');
  layoutFan();
  requestAnimationFrame(() => cards.forEach(c => c.classList.add('in')));
  setTimeout(() => cards.forEach(c => { c.style.transitionDelay = '0ms'; }), 1200);
}

addEventListener('resize', () => { if ($('.fan-card.in')) layoutFan(); });

// hover lift + parallax tilt on the fan
(function fanInteract() {
  const fan = $('#fan');
  fan.addEventListener('mouseover', e => {
    const card = e.target.closest('.fan-card');
    if (!card) return;
    const { x, y, r } = card.dataset;
    card.style.transform = `translate(${x}px, ${+y - 34}px) rotate(${r}deg) scale(1.12)`;
  });
  fan.addEventListener('mouseout', e => {
    const card = e.target.closest('.fan-card');
    if (!card) return;
    const { x, y, r } = card.dataset;
    card.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
  });

  // subtle parallax of whole stage with pointer
  const hero = $('.hero');
  if (reduced) return;
  hero.addEventListener('mousemove', e => {
    const cx = (e.clientX / innerWidth - 0.5) * 2;
    const cy = (e.clientY / innerHeight - 0.5) * 2;
    fan.style.transform = `translate(${cx * 14}px, ${cy * 10}px)`;
  });
  hero.addEventListener('mouseleave', () => { fan.style.transform = 'translate(0,0)'; });
})();

// split hero title letters for the rise animation
(function splitTitle() {
  $$('[data-split]').forEach(line => {
    line.innerHTML = `<span>${line.textContent}</span>`;
  });
})();

/* ─────────── BIO: word-by-word scroll reveal ─────────── */
(function bioReveal() {
  const p = $('#bioText');
  if (!p) return;
  const words = p.textContent.trim().split(/\s+/);
  p.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(' ');
  const spans = $$('.w', p);

  const onScroll = () => {
    const r = p.getBoundingClientRect();
    // progress: 0 when block enters lower third, 1 when it passes upper third
    const start = innerHeight * 0.85;
    const end = innerHeight * 0.2;
    const prog = clamp((start - r.top) / (start - end + r.height * 0.6), 0, 1);
    const upto = Math.round(prog * spans.length);
    spans.forEach((s, i) => s.classList.toggle('on', i < upto));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ─────────── WORK: sticky stacking cards ─────────── */
(function workStack() {
  const panels = $$('.work-panel');
  if (!panels.length) return;

  const onScroll = () => {
    panels.forEach((panel, i) => {
      const card = $('.work-card', panel);
      const r = panel.getBoundingClientRect();
      // how far this panel has been scrolled past (0 → 1 across one viewport)
      const past = clamp(-r.top / innerHeight, 0, 1);
      const isLast = i === panels.length - 1;
      const scale = isLast ? 1 : 1 - past * 0.14;
      const y = isLast ? 0 : past * -40;
      const dim = isLast ? 0 : past * 0.55;
      card.style.transform = `translateY(${y}px) scale(${scale})`;
      card.style.filter = `brightness(${1 - dim})`;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ─────────── PLAYGROUND: marquee posters ─────────── */
const POSTERS = [
  { label: 'ctrl+z',   t: 'Undo',   g: 'linear-gradient(160deg,#312e81,#8b5cf6)' },
  { label: '404',      t: 'Lost',   g: 'linear-gradient(160deg,#7f1d1d,#ef4444)' },
  { label: 'sudo',     t: 'Root',   g: 'linear-gradient(160deg,#064e3b,#10b981)' },
  { label: 'git push', t: 'Ship',   g: 'linear-gradient(160deg,#0c4a6e,#38bdf8)' },
  { label: 'no sleep', t: '3 A.M.', g: 'linear-gradient(160deg,#4a044e,#e879f9)' },
  { label: 'rm -rf',   t: 'Oops',   g: 'linear-gradient(160deg,#78350f,#fbbf24)' }
];

(function marquee() {
  const track = $('#marqueeTrack');
  if (!track) return;
  const make = () => POSTERS.map(p => `
    <div class="poster">
      <div class="poster-img" style="background:${p.g}">
        <div class="p-inner">${p.t}</div>
      </div>
      <h3 class="poster-label">${p.label}</h3>
    </div>`).join('');
  track.innerHTML = make() + make(); // duplicate for seamless loop
})();

/* ─────────── ARCHIVE: draggable card stack ─────────── */
const ARCHIVE = [
  { year: '2023', cat: 'UX/UI Case Study', title: 'Transit App Redesign' },
  { year: '2022', cat: 'Logo Design',      title: 'Logofolio Vol. 1' },
  { year: '2022', cat: 'UI & Branding',    title: 'Studio Identity' },
  { year: '2021', cat: 'Poster Series',    title: 'Type Experiments' },
  { year: '2021', cat: 'Web Design',       title: 'Campus Fest Site' },
  { year: '2020', cat: 'Where it started', title: 'First Portfolio' }
];

(function archiveStack() {
  const stack = $('#archStack');
  if (!stack) return;

  stack.innerHTML = ARCHIVE.map((c, i) => `
    <div class="arch-card" data-i="${i}">
      <div class="ac-top">
        <span class="ac-year">${c.year}</span>
        <div class="ac-ring"><i></i></div>
      </div>
      <div class="ac-mid">
        <span class="ac-cat">${c.cat}</span>
        <h4 class="ac-title">${c.title}</h4>
      </div>
      <div class="ac-lines"><i></i><i></i></div>
    </div>`).join('');

  let cards = $$('.arch-card', stack);
  const restack = () => {
    cards.forEach((c, i) => {
      c.style.zIndex = cards.length - i;
      c.style.transform = `translateY(${i * 9}px) scale(${1 - i * 0.035}) rotate(${i % 2 ? 1.6 : -1.6}deg)`;
      c.style.opacity = i > 3 ? 0 : 1;
    });
  };
  restack();

  const cycle = dir => {
    const top = cards.shift();
    top.classList.add('gone');
    top.style.transform = `translate(${dir * 460}px, 40px) rotate(${dir * 26}deg)`;
    top.style.opacity = '0';
    setTimeout(() => {
      top.classList.remove('gone');
      cards.push(top);
      restack();
    }, 480);
    restack();
    $('#archHint')?.style.setProperty('opacity', '0');
  };

  // pointer drag
  let startX = 0, dx = 0, dragging = false, active = null;
  stack.addEventListener('pointerdown', e => {
    active = e.target.closest('.arch-card');
    if (!active || active !== cards[0]) return;
    dragging = true; startX = e.clientX; dx = 0;
    active.classList.add('dragging');
    active.setPointerCapture(e.pointerId);
  });
  stack.addEventListener('pointermove', e => {
    if (!dragging || !active) return;
    dx = e.clientX - startX;
    active.style.transform = `translate(${dx}px, ${Math.abs(dx) * 0.08}px) rotate(${dx * 0.05}deg)`;
  });
  const end = () => {
    if (!dragging || !active) return;
    active.classList.remove('dragging');
    dragging = false;
    if (Math.abs(dx) > 90) cycle(Math.sign(dx));
    else restack();
    active = null;
  };
  stack.addEventListener('pointerup', end);
  stack.addEventListener('pointercancel', end);

  // click top card to cycle
  stack.addEventListener('click', e => {
    const c = e.target.closest('.arch-card');
    if (c && c === cards[0] && Math.abs(dx) < 6) cycle(1);
  });
})();

/* ─────────── MAGNETIC BUTTONS ─────────── */
(function magnetic() {
  if (reduced) return;
  $$('.magnetic').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = 'translate(0,0)'; });
  });
})();

/* ─────────── SCROLL REVEAL ─────────── */
/* Position-based rather than IntersectionObserver: fires reliably even when the
   page is loaded already scrolled (deep link) or IO delivery is throttled, so
   content can never get stuck invisible. */
(function reveal() {
  // tag the blocks that should animate in
  $$('.work-intro, .services-head, .service-row').forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 6) * 60}ms`;
  });

  const items = $$('.reveal');
  let queued = false;

  const check = () => {
    queued = false;
    const vh = innerHeight;
    for (let i = items.length - 1; i >= 0; i--) {
      const el = items[i];
      const r = el.getBoundingClientRect();
      // reveal once its top edge has entered the lower part of the viewport
      if (r.top < vh - 60 && r.bottom > 0) {
        el.classList.add('in');
        items.splice(i, 1);            // stop tracking it
      } else if (r.bottom <= 0) {
        el.classList.add('in');        // already scrolled past — show immediately
        items.splice(i, 1);
      }
    }
  };

  // called directly (not via rAF) so it still works if frames are throttled
  const onScroll = () => check();

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  check();
  // re-check once fonts/images settle and the layout shifts
  setTimeout(check, 400);
  addEventListener('load', check);
})();

/* ─────────── SMALL TOAST ─────────── */
let toastTimer;
function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = `position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(80px);
      background:#fff;color:#000;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600;
      z-index:1200;opacity:0;transition:all .35s cubic-bezier(.22,1,.36,1);box-shadow:0 12px 40px rgba(0,0,0,.4)`;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(80px)';
  }, 2600);
}

/* ─────────── ANCHOR OFFSET FIX ─────────── */
$$('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id === '#' || id.length < 2) return;
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });
});
