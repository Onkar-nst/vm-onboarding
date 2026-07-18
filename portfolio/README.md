# Onkar Dange — Portfolio

A single-page portfolio built to match the structure, motion, and interaction design
of a modern dark-canvas developer portfolio. Vanilla HTML/CSS/JS — no build step,
no framework, no dependencies.

```sh
# from the repo root
./run.sh          # then open http://localhost:4173/portfolio/
```

Add `?nopreload` to the URL to skip the intro animation while you're editing:
`http://localhost:4173/portfolio/?nopreload`

---

## What's in it

| Section | Effects |
|---|---|
| **Preloader** | Two-line display title rising into place, floating emoji, progress bar, fade-out |
| **Nav** | Floating glass pill, vertical text-swap on hover, fill-swap Resume button, hides on scroll-down, animated hamburger + full-screen mobile menu |
| **Hero** | Giant name with gradient "Hello, I'm" behind it, 11-card fanning stack (arcs out on load, lifts on hover, parallax with pointer), magnetic CTA, pinging "available" dot |
| **About** | Word-by-word scroll-linked text reveal (words brighten as you scroll) |
| **Work** | Sticky stacking cards — each project pins full-screen and scales/dims as the next slides over it |
| **Services** | Row list with a dark fill sweeping up on hover, title inverting to white, icon scaling + rotating to green |
| **Education** | Two-column timeline, green accent year labels, left borders that turn green on hover, lifting cert cards |
| **Playground** | Infinite horizontal marquee (pauses on hover), poster zoom, pixel-font labels that brighten |
| **Archive** | Draggable/throwable card stack — drag or click the top card to flick through |
| **Footer** | Magnetic "Let's Meet" button with colour-fill sweep, lifting social pills |
| **Global** | Custom blend-mode cursor with a lagging ring that grows over interactive elements, scroll-reveal on every block, reduced-motion support |

## Fonts & colours

- **Antonio** — display/headings · **Geist** — body · **Geist Mono** — labels · **VT323** — pixel labels
- `#0F0F0F` canvas · `#020202` deep · `#f2f2f2` light sections · `#22C55E` green accent

---

## Make it yours — the only things you need to edit

Everything below is placeholder content. Nothing else needs touching.

**1. Your name** — `index.html`, the `.hero-title` block:
```html
<span class="ht-line" data-split>Onkar</span>
<span class="ht-line" data-split>Dange</span>
```

**2. Projects** — `index.html`, the six `.work-panel` blocks. Each has a year,
category, title, description, and two links. To use real screenshots, replace
`<div class="wc-shot" data-shot="1">…</div>` with `<img src="your-shot.png" alt="">`.

**3. Hero fan cards** — `app.js`, the `FAN` array (label + gradient per card).

**4. Services** — `index.html`, the six `.service-row` blocks.

**5. Education & certifications** — `index.html`, the `.edu-item` and `.cert-card`
blocks. These are placeholders (`Your University Name`, `Grade: —`) — put your real
details in.

**6. Playground posters** — `app.js`, the `POSTERS` array.

**7. Archive cards** — `app.js`, the `ARCHIVE` array.

**8. Contact** — `index.html` footer: phone number (`+91 XXXXX XXXXX`), the email in
both `mailto:` links, and the LinkedIn / Instagram / GitHub hrefs.

**9. Resume link** — `app.js`, set `const resumeUrl = '#'` to your PDF URL (Drive
link is fine). Until you do, clicking Resume shows a reminder toast.

---

## Deploying

It's static — drop the `portfolio/` folder on any host:

- **Vercel / Netlify:** drag the folder in, or point it at the repo with `portfolio`
  as the root directory.
- **GitHub Pages:** push and enable Pages on the branch, `/portfolio` folder.

## Notes

- Scrolling is native, deliberately — the work section's sticky stacking depends on
  `position: sticky`, which breaks under transform-based "smooth scroll" libraries.
- Scroll reveals are position-based rather than using IntersectionObserver, so content
  can't get stranded invisible if you deep-link into the middle of the page.
- Respects `prefers-reduced-motion` — animations collapse for users who ask for that.
- The custom cursor and pointer parallax disable themselves on touch devices.
