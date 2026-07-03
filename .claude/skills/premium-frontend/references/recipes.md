# Premium Frontend — Code Recipes

Copy-ready building blocks for premium execution. Everything here favors primitives that run anywhere (CSS, Web Animations API, `IntersectionObserver`, `requestAnimationFrame`); library-only recipes (Lenis/GSAP/Three) are flagged for real production projects. Adapt values to the chosen flavor — don't paste blindly.

## Contents
1. [Design tokens (CSS custom properties)](#1-design-tokens)
2. [Fluid typography with clamp()](#2-fluid-typography)
3. [Elevation / shadow scale](#3-elevation--shadow-scale)
4. [Focus ring & button states](#4-focus-ring--button-states)
5. [Scroll-reveal with stagger (IntersectionObserver)](#5-scroll-reveal-with-stagger)
6. [CSS-only scroll reveal (animation-timeline)](#6-css-only-scroll-reveal)
7. [Magnetic button](#7-magnetic-button)
8. [Split-text headline reveal](#8-split-text-headline-reveal)
9. [Grain / noise overlay (SVG)](#9-grain--noise-overlay)
10. [Subtle mesh / aurora background](#10-subtle-mesh--aurora-background)
11. [Animated hairline grid background](#11-animated-hairline-grid-background)
12. [Lenis + GSAP + Three.js scroll setup (production)](#12-lenis--gsap--threejs-production)
13. [Reduced-motion guard](#13-reduced-motion-guard)

---

## 1. Design tokens

Define once, reference everywhere. This is what makes a page cohere. Tune the neutral ramp and the single accent to the subject.

```css
:root {
  /* Neutral ramp — never pure #000/#fff. Many deliberate steps. */
  --bg:        #fafafa;   /* near-white canvas            */
  --surface:   #ffffff;   /* raised cards                 */
  --ink:       #0a0a0a;   /* near-black text (warmth ok)  */
  --ink-2:     #454545;   /* secondary text              */
  --ink-3:     #767676;   /* muted / captions            */
  --line:      rgba(0,0,0,0.08);  /* hairline borders     */
  --line-2:    rgba(0,0,0,0.04);  /* faintest dividers    */

  /* Exactly ONE accent. Links, primary CTA, focus — almost nothing else. */
  --accent:      #0a72ef;
  --accent-ink:  #ffffff;

  /* Spacing — one 4px-based scale used for every gap on the page */
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px; --s-5: 24px;
  --s-6: 32px; --s-7: 48px; --s-8: 64px; --s-9: 96px; --s-10: 128px; --s-11: 160px;

  /* Radius — pick ONE language; don't mix sharp + pill at random */
  --r-sm: 6px; --r-md: 10px; --r-lg: 16px; --r-pill: 9999px;

  /* Motion vocabulary — a tiny reusable set of curves + durations */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);   /* general UI          */
  --ease-out:      cubic-bezier(0.16, 1, 0.3, 1);  /* premium reveal      */
  --ease-out-quart:cubic-bezier(0.25, 1, 0.5, 1);  /* snappy hover/toggle */
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1); /* playful only     */
  --d-micro: 160ms;  --d-enter: 400ms;  --d-big: 700ms;

  --maxw: 1200px;      /* content max width */
  --measure: 68ch;     /* body line length  */
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a0a0a; --surface: #161616; --ink: #f2f2f2;
    --ink-2: #b4b4b4; --ink-3: #8a8a8a;
    --line: rgba(255,255,255,0.10); --line-2: rgba(255,255,255,0.06);
    --accent: #4d9bff; /* slightly brighter, less buzzy on black */
  }
}
```

---

## 2. Fluid typography

Type that scales smoothly across viewports with no breakpoints, plus the negative-tracking + tight-leading that defines the premium display look.

```css
:root {
  --step--1: clamp(0.83rem, 0.80rem + 0.15vw, 0.90rem);
  --step-0:  clamp(1.00rem, 0.95rem + 0.25vw, 1.13rem);  /* body 16–18px  */
  --step-1:  clamp(1.25rem, 1.15rem + 0.6vw, 1.50rem);
  --step-2:  clamp(1.75rem, 1.50rem + 1.2vw, 2.25rem);
  --step-3:  clamp(2.25rem, 1.90rem + 1.9vw, 3.25rem);
  --step-4:  clamp(3.00rem, 2.30rem + 3.4vw, 5.50rem);   /* display       */
}

body {
  font-family: "Geist", system-ui, sans-serif;
  font-size: var(--step-0);
  line-height: 1.6;                 /* body: 1.5–1.65 */
  color: var(--ink);
  font-feature-settings: "liga", "calt";
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}
p { max-width: var(--measure); text-wrap: pretty; }  /* kills orphans */

.display {
  font-size: var(--step-4);
  line-height: 1.05;                /* display: 1.0–1.15 */
  letter-spacing: -0.04em;          /* tighten as size grows */
  font-weight: 600;
  text-wrap: balance;               /* even, no lonely last word */
}
h2 { font-size: var(--step-3); line-height: 1.1; letter-spacing: -0.03em; text-wrap: balance; }

.eyebrow {                          /* small label: opposite treatment */
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: var(--step--1);
  letter-spacing: 0.08em;           /* POSITIVE tracking */
  text-transform: uppercase;
  color: var(--ink-3);
}
.tabular { font-variant-numeric: tabular-nums; } /* prices, tables, counters */
```

---

## 3. Elevation / shadow scale

Border-first depth. Most things get a hairline; only genuinely floating elements cast layered shadows. Note the inner light ring that makes a card glow from within.

```css
:root {
  /* Level 0 — flat, defined by border only (the default) */
  --elev-0: 0 0 0 1px var(--line);

  /* Level 1 — resting card: shadow-as-border + faint ambient + inner ring */
  --elev-1:
    0 0 0 1px rgba(0,0,0,0.06),
    0 1px 2px rgba(0,0,0,0.04),
    inset 0 0 0 1px rgba(255,255,255,0.6);

  /* Level 2 — raised / hover */
  --elev-2:
    0 0 0 1px rgba(0,0,0,0.07),
    0 2px 4px rgba(0,0,0,0.04),
    0 8px 16px -8px rgba(0,0,0,0.06);

  /* Level 3 — floating: menus, popovers, modals (real shadow earns its place) */
  --elev-3:
    0 0 0 1px rgba(0,0,0,0.08),
    0 4px 8px rgba(0,0,0,0.04),
    0 16px 32px -12px rgba(0,0,0,0.12);
}

.card {
  background: var(--surface);
  border-radius: var(--r-md);
  box-shadow: var(--elev-1);
  transition: box-shadow var(--d-micro) var(--ease-out-quart),
              transform  var(--d-micro) var(--ease-out-quart);
}
.card:hover { box-shadow: var(--elev-2); transform: translateY(-2px); }
```

---

## 4. Focus ring & button states

Never `outline: none` without a replacement. Buttons need a real press state, not just a color swap.

```css
:where(a, button, input, [tabindex]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--r-sm);
}

.btn {
  --_bg: var(--ink);
  background: var(--_bg);
  color: var(--surface);
  padding: 0.7em 1.25em;
  border: 0;
  border-radius: var(--r-sm);
  font: inherit; font-weight: 500;
  cursor: pointer;
  transition: transform var(--d-micro) var(--ease-out-quart),
              filter    var(--d-micro) var(--ease-out-quart);
}
.btn:hover  { filter: brightness(1.08); transform: translateY(-1px); }
.btn:active { transform: translateY(0) scale(0.98); filter: brightness(0.96); }

.btn--ghost { background: transparent; color: var(--ink);
              box-shadow: inset 0 0 0 1px var(--line); }
```

---

## 5. Scroll-reveal with stagger

The single highest-impact motion technique. Fade + short rise as elements enter, staggered through a group. Works everywhere; no library.

```html
<div data-reveal-group>
  <div data-reveal>First</div>
  <div data-reveal>Second</div>
  <div data-reveal>Third</div>
</div>
```
```css
[data-reveal] {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity var(--d-enter) var(--ease-out),
              transform var(--d-enter) var(--ease-out);
  transition-delay: var(--reveal-delay, 0ms);
  will-change: transform, opacity;
}
[data-reveal].is-visible { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  [data-reveal] { opacity: 1; transform: none; transition: none; }
}
```
```js
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('is-visible');
    io.unobserve(e.target);              // reveal once
  }
}, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

document.querySelectorAll('[data-reveal-group]').forEach((group) => {
  group.querySelectorAll('[data-reveal]').forEach((el, i) => {
    el.style.setProperty('--reveal-delay', `${i * 60}ms`); // 40–80ms stagger
    io.observe(el);
  });
});
```

---

## 6. CSS-only scroll reveal

For simple cases in modern browsers, no JS. Progressive enhancement — content is visible if unsupported.

```css
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .reveal-css {
      animation: reveal-in linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 45%;
    }
    @keyframes reveal-in {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: none; }
    }
  }
}
```

---

## 7. Magnetic button

A primary CTA that gently pulls toward the cursor. Disproportionately premium for its size.

```js
function makeMagnetic(el, strength = 0.35) {
  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
  };
  const reset = () => { el.style.transform = 'translate(0,0)'; };
  el.style.transition = 'transform 350ms cubic-bezier(0.16,1,0.3,1)';
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', reset);
}
if (matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
  document.querySelectorAll('[data-magnetic]').forEach((el) => makeMagnetic(el));
}
```
React version:
```jsx
function useMagnetic(strength = 0.35) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia('(hover: hover)').matches) return;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform =
        `translate(${(e.clientX - r.left - r.width/2)*strength}px,` +
        `${(e.clientY - r.top - r.height/2)*strength}px)`;
    };
    const reset = () => { el.style.transform = 'translate(0,0)'; };
    el.style.transition = 'transform 350ms cubic-bezier(0.16,1,0.3,1)';
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);
    return () => { el.removeEventListener('pointermove', move);
                   el.removeEventListener('pointerleave', reset); };
  }, [strength]);
  return ref;
}
```

---

## 8. Split-text headline reveal

Animate a headline by word or line for a signature hero moment. Uses the Web Animations API. Provide a plain fallback for reduced motion.

```js
function revealHeadline(el, { by = 'word', stagger = 60 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const parts = el.textContent.trim().split(by === 'word' ? /(\s+)/ : '');
  el.textContent = '';
  el._parts = [];
  parts.forEach((part) => {
    if (/^\s+$/.test(part)) { el.append(part); return; }
    const wrap = document.createElement('span');
    wrap.style.display = 'inline-block';
    wrap.style.overflow = 'hidden';
    wrap.style.verticalAlign = 'top';
    const inner = document.createElement('span');
    inner.style.display = 'inline-block';
    inner.textContent = part;
    wrap.append(inner);
    el.append(wrap);
    el._parts.push(inner);
  });
  el._parts.forEach((inner, i) => {
    inner.animate(
      [{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }],
      { duration: 700, delay: i * stagger, fill: 'both',
        easing: 'cubic-bezier(0.16,1,0.3,1)' }
    );
  });
}
// revealHeadline(document.querySelector('.display'), { by: 'word', stagger: 55 });
```

---

## 9. Grain / noise overlay

A 2–4% noise layer over flat colors and gradients kills banding and adds a tactile, film-like quality. Pure CSS/SVG, no image asset.

```css
.grain::after {
  content: '';
  position: absolute; inset: 0;
  pointer-events: none;
  opacity: 0.035;                       /* 2–4% */
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

---

## 10. Subtle mesh / aurora background

The antidote to the slop hero gradient: soft, desaturated, low-opacity, sitting *behind* content as atmosphere. Layer 2–3 large blurred radial glows and let them drift slowly.

```css
.aurora {
  position: relative;
  isolation: isolate;
  background: var(--bg);
  overflow: hidden;
}
.aurora::before {
  content: '';
  position: absolute; inset: -30%;
  z-index: -1;
  background:
    radial-gradient(40% 40% at 20% 30%, rgba(10,114,239,0.14), transparent 70%),
    radial-gradient(35% 35% at 80% 20%, rgba(222,29,141,0.10), transparent 70%),
    radial-gradient(45% 45% at 60% 80%, rgba(120,80,255,0.10), transparent 70%);
  filter: blur(40px) saturate(120%);
  animation: drift 24s ease-in-out infinite alternate;
}
@keyframes drift {
  to { transform: translate3d(4%, -3%, 0) rotate(6deg) scale(1.08); }
}
@media (prefers-reduced-motion: reduce) { .aurora::before { animation: none; } }
```

---

## 11. Animated hairline grid background

The systematic-lane texture. Keep it near-subliminal (≤8–15% opacity); if you consciously notice it, it's too strong. Optional slow drift.

```css
.grid-bg {
  background-color: var(--bg);
  background-image:
    linear-gradient(to right,  var(--line-2) 1px, transparent 1px),
    linear-gradient(to bottom, var(--line-2) 1px, transparent 1px);
  background-size: 64px 64px;
  /* Fade the grid toward the edges so it reads as texture, not a table */
  -webkit-mask-image: radial-gradient(120% 120% at 50% 0%, #000 40%, transparent 100%);
          mask-image: radial-gradient(120% 120% at 50% 0%, #000 40%, transparent 100%);
}
```

---

## 12. Lenis + GSAP + Three.js (production)

**Real projects only** — these libraries aren't in the artifact sandbox. The industry-standard stack for cinematic scroll: Lenis smooths native scroll, GSAP's ticker drives everything, ScrollTrigger binds timelines to scroll, Three renders on the same tick so DOM and WebGL stay frame-perfect.

```js
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1.1 }); // silky, controlled
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));   // one clock for everything
gsap.ticker.lagSmoothing(0);

// Pinned scene: scroll advances *time inside the scene*, not the scene itself.
gsap.timeline({
  scrollTrigger: { trigger: '.scene', start: 'top top', end: '+=150%',
                   scrub: 1, pin: true, anticipatePin: 1 },
})
  .from('.scene__title', { yPercent: 40, autoAlpha: 0, ease: 'power2.out' })
  .to('.scene__media', { scale: 1.15, ease: 'none' }, 0);
```

Three.js hero, rendered on the same GSAP tick (sketch):
```js
gsap.ticker.add((t) => {
  lenis.raf(t * 1000);
  mesh.rotation.y = t * 0.2;
  renderer.render(scene, camera);
});
```
**Always** detect device tier before the heavy scene loads and serve fewer particles / simpler shaders on weak hardware; give non-WebGL devices a static fallback that keeps the visual language and the conversion path. Call `renderer.dispose()` / lose context on unmount.

---

## 13. Reduced-motion guard

A blanket safety net in addition to per-effect guards. Never rely on this alone for parallax/autoplay — gate those in JS too.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```
```js
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function initMotion() {
  if (reduced.matches) return;   // skip parallax, autoplay, magnetic, split-text
  /* ...set up motion... */
}
initMotion();
reduced.addEventListener('change', initMotion);
```
