---
name: premium-frontend
description: Use this skill whenever building, designing, or refining any website, landing page, marketing page, web-app UI, hero section, or dashboard where the goal is a premium, high-end, polished, "wow-factor" result — the calibre of Vercel, Linear, Stripe, Apple, or SpaceX — rather than a generic template. Trigger it for any request mentioning premium / high-end / luxury / aesthetic / polished / beautiful / award-winning / "not generic" frontend, and whenever someone is unhappy that a design looks templated, cheap, "AI-generated," or "like every other site." Also use it proactively when about to build a public-facing web UI and quality matters, even if the word "premium" is never said. It covers the craft of premium execution — typography, color and light, space and layout, depth and materials, motion and micro-interaction, the signature moment, premium copy — plus a firewall of anti-"AI-slop" patterns to never ship. Extends the `frontend-design` skill; read both when available.
---

# Premium Frontend

## What "premium" actually is

Premium is not a look. It is not dark mode, it is not a serif headline, it is not a glassy card with a gradient. Those are surfaces, and any of them can look cheap. Premium is a **property that emerges when a hundred small decisions are all correct and all pointing the same direction** — type, spacing, color, motion, copy, and the restraint to stop. A visitor cannot name why a page feels expensive; they feel the coherence before they read a word. Your job is to manufacture that coherence deliberately.

Two ideas do most of the work, and they are in tension, which is the whole craft:

1. **Precision.** Every value is chosen, not defaulted. The letter-spacing, the exact grey of a border, the 40ms between staggered items, the radius on a button — a real designer decided each one, and you must too. Sloppiness anywhere leaks into the whole.
2. **Restraint.** Spend boldness in exactly one place. Vercel looks expensive because of what it **omits** — no accent-color confetti, no drop shadows everywhere, no five typefaces. Amateurs add to impress; the premium move is almost always to remove. Chanel's rule applies to interfaces: before you ship, take one thing off.

Hold these two together and the result reads as "wow" without a single gimmick. **The wow the user is asking for is earned through flawless execution of a restrained idea, not achieved by piling on effects.** More animation, more gradients, and more sections usually make a page feel *more* generated, not more premium. Reach for spectacle (WebGL, scroll cinema, 3D) only when the subject genuinely calls for it — and then execute it to the same obsessive standard.

## Pick a flavor of premium and commit

"Premium" spans a spectrum. The fastest way to look generic is to average across it. Choose one lane for the brief and execute it purely — mixing lanes is how you get mush.

- **Systematic / precise** — Vercel, Linear, Stripe. Monochrome or near-monochrome, one restrained accent, tight negative-tracked display type, hairline borders, vast whitespace, subtle grid, motion that is quick and functional. Reads as *engineering rigor*.
- **Cinematic / atmospheric** — Apple, SpaceX, high-end automotive. Full-bleed imagery or video, minimal chrome, condensed or wide display type, dramatic scale, slow confident motion, deep contrast. Reads as *event*. The signature is usually the media itself; the UI gets out of the way.
- **Editorial** — fashion, publishing, agencies. Real typographic hierarchy, an unexpected serif or grotesque, asymmetry, generous margins, ink-on-paper restraint. Reads as *taste*.
- **Warm / crafted** — premium consumer, D2C, hospitality. Warmer neutrals, a real photographic or illustrative point of view, softer radii, tactile materials. Reads as *care*.
- **Refined-brutalist / technical** — dev tools, crypto-infra, hardware. Mono type, sharp corners, exposed structure, data as decoration. Reads as *substance*.

State the lane before building, and let every later decision inherit from it. When the brief already pins a direction, follow it exactly — the brief always wins.

## The anti-slop firewall (read this before you write any code)

There is a specific, recognizable "AI-generated website" look, and users can spot it in half a second. It comes from a model reaching for the statistical center of everything it has seen. Treat the following as a hard blocklist. If your draft contains these, you have produced the default, not a design.

**Structure & layout tells**
- The skeleton `hero → three feature cards with icons → testimonials → pricing table → footer`, in that order, is the single biggest tell. If you find yourself laying this out by reflex, stop and design the structure around *this* subject's actual content.
- Everything uniform: identical padding, identical border-radius, identical card heights everywhere. Real systems create hierarchy through **intentional variation** — a hero card is not the same weight as a footer link.
- A centered headline + subhead + two buttons, floating in the middle of a mostly-empty hero with a gradient behind it.
- Perfectly even 3-column grids for content that isn't actually three peer items.

**Type & color tells**
- **Inter as the body/display face by default.** Inter is fine, but it is *the* default in every AI tool, so on an unspecified brief it reads as a tell. Choose a face for a reason (see Typography).
- The **purple-to-blue / indigo gradient** ("Tailwind blue," `#6366F1`→`#8B5CF6`). Also: teal-to-lime, and any gradient used as a hero background just to fill space.
- Default browser letter-spacing on big headlines (they need negative tracking to look intentional).
- Rounded-everything at `12px`+ with no variation; drop shadows on every card.

**Content tells (copy is half the battle)**
- Averaged headlines that describe no real product: "Build the future of X," "Your all-in-one platform," "Scale without limits," "Empower your workflow." Specificity is the antidote — Stripe says "Financial infrastructure for the internet"; Linear says "Plan and build products."
- The formula `[adjective] + [noun] + "that helps you" + [verb]` repeated across every feature.
- Filler that fits any company on earth: "We deliver exceptional solutions that drive meaningful results."
- **Hallucinated testimonials** — "Sarah M., Marketing Director" with a generic quote and no real person, company, or link. Never invent these. Omit the section or use a placeholder that is obviously a placeholder.
- Stock-slop imagery: diverse team around a glowing laptop, abstract 3D blobs/spheres floating in space, plasticky AI illustrations that are too smooth and too symmetric.

**The antidotes**, applied throughout: choose typography for a reason; derive color from the subject, not the default palette; vary weight and rhythm to build hierarchy; write copy in a specific human voice about the *actual* thing; add motion only where it communicates something. If a sentence or a section could appear on a thousand other sites without anyone noticing, cut it or make it specific.

---

## Craft pillar 1 — Typography (the biggest premium/cheap lever)

Type is where "expensive" is won or lost. Get this right and mediocre everything-else still reads as considered; get it wrong and nothing rescues it.

**Choose faces deliberately.** Pair a display face with real personality against a clean body face, and add a mono only if data/technical voice calls for it. Avoid the reflex defaults. Strong, freely-available options to reach for instead of Inter: for display — *Geist*, *General Sans*, *Satoshi*, *Clash Display*, *Instrument Serif* (editorial), *Fraunces* (warm/serif), *Space Grotesk* (technical). For body — *Geist*, *Inter Tight* (tighter than plain Inter), *Söhne*-likes, *Supreme*, *Switzer*. For mono — *Geist Mono*, *JetBrains Mono*, *Berkeley Mono* feel. Prefer a superfamily (sans + mono from the same designer, e.g. Geist) so marketing copy and code share a voice.

**The single highest-ROI trick: negative tracking on display type.** Large headlines look 30% less intentional at default spacing. Tighten as size grows: roughly `letter-spacing: -0.02em` around 32px, `-0.03em` around 48px, up to `-0.04em`/`-0.045em` at 64px+. Pair with tight line-height (`1.0`–`1.15` for display). This "compressed type" is the core of the Vercel/Linear look. Do the opposite for tiny uppercase labels/eyebrows: *positive* tracking (`0.05`–`0.12em`), often in mono.

**Set a real scale, not random sizes.** Use a modular scale (ratio ~1.2–1.333) so sizes relate. Typical roles: display 48–96px, H1 36–56, H2 28–36, H3 20–24, body 16–18, small 13–14, eyebrow 11–13 uppercase. **Body text should be 16–18px, never the cramped 13–14px default** on marketing pages; keep line length to ~60–75 characters and body line-height 1.5–1.65.

**Weight carries hierarchy.** Premium type often lives at the extremes — a heavy/semibold display against a regular body — not a soup of mediums. Contrast in weight reads as confidence.

**Rendering details that separate pro from amateur:** enable OpenType features (`font-feature-settings: "liga", "calt"`; `"tnum"` for tabular numbers in tables/prices); use `text-wrap: balance` on headlines and `text-wrap: pretty` on paragraphs to kill orphans; set `-webkit-font-smoothing: antialiased` on dark backgrounds; hang punctuation and trim leading with care. Never let a headline wrap to a single lonely word.

## Craft pillar 2 — Color & light

**Restraint is the whole game.** A premium palette is usually a disciplined neutral ramp + exactly one accent. The accent appears on links, the primary CTA, focus rings, and almost nothing else. Overusing the accent (blue everywhere) is a classic tell.

**Never pure black on pure white.** `#000` on `#FFF` is harsh and cheap-looking. Use a near-black (`#0A0A0A`, `#111`, `#171717` — Vercel's warmth trick) and a near-white (`#FAFAFA`, `#F7F7F5`). The micro-contrast reads as softness and intent.

**Build a real neutral ramp,** not three greys. You need many deliberate steps so every border, divider, muted label, and disabled state lands on its own value. Borders live around `rgba(0,0,0,0.06–0.10)` on light (not `0.15`+, which looks heavy) and `rgba(255,255,255,0.06–0.12)` on dark.

**Gradients, done right.** The slop gradient is a full-bleed purple→blue wash behind a hero. Premium gradients are either (a) barely-there atmospheric washes — soft, desaturated, multi-stop, low-opacity, sitting *behind* content as texture; or (b) tight, intentional accents on a small element. Mesh gradients and subtle radial glows work when they're quiet. If a gradient is the loudest thing on screen, it's wrong.

**Dark mode is not `filter: invert`.** Elevated surfaces get *lighter* (not darker) as they rise; shadows become subtle glows or lighter borders; saturate accents slightly and reduce their brightness so they don't buzz on black; text is off-white, never pure white.

**Color from the subject.** Derive the palette from the real thing — the product's material, the brand's world, the domain's vernacular — rather than a stock scheme. This alone defeats most sameness.

## Craft pillar 3 — Space & layout

**Whitespace is confidence.** The most consistent signal of a premium page is *how much room it gives itself*. Vercel runs 80–160px of vertical padding between sections; component padding is generous (24px+ inside cards). Cramped layouts read as cheap. When in doubt, add space, then add more. The paradox to exploit: **compress the type (tight tracking, tight leading) and expand the space around it.** Dense text in vast space is the signature contrast of expensive design.

**Systematic spacing.** Every gap comes from one scale, based on 4px: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160`. Mixing 16px here and 20px there breaks the illusion of precision. Consistency *is* the polish.

**Grid & alignment.** Use a real column grid (commonly 12) and a max content width (often ~1100–1280px) with comfortable gutters. Align to it religiously — optical alignment beats mathematical when they disagree (icons, punctuation, and caps often need a nudge). A faint background grid or dot pattern can reinforce rigor, but keep it near-subliminal (≤8–15% opacity, hairline lines); if you consciously notice it, it's too strong.

**Rhythm and density contrast.** A great page breathes — it alternates dense, information-rich passages with open, quiet ones. Uniform density is monotonous. Let the hero be spacious, a feature section be tighter, a stat band be dense, then open up again.

## Craft pillar 4 — Depth & materials

How you express elevation is a fingerprint of quality.

**Border-first, not shadow-first.** Premium UIs (Vercel especially) define most elements with a 1px hairline border or a **shadow-as-border** — `box-shadow: 0 0 0 1px rgba(0,0,0,0.08)` — and reserve real drop shadows for genuinely floating things (menus, popovers, modals). Shadows on every card is a tell.

**Layered, physical shadows.** When you do cast a shadow, don't use one blurry blob. Stack layers, each doing a job — a tight contact shadow, a mid ambient layer, a soft far layer, and often an inner light ring that makes a card "glow" from within. Example stack (Vercel-style):
```
box-shadow:
  0 0 0 1px rgba(0,0,0,0.08),
  0 2px 2px rgba(0,0,0,0.04),
  0 8px 8px -8px rgba(0,0,0,0.04),
  inset 0 0 0 1px #fafafa;
```
Multi-layer shadows read as "built," single blobs read as "floating sticker." (See `references/recipes.md` for a full elevation scale.)

**Glass and grain, sparingly.** `backdrop-filter: blur()` on sticky nav or overlays looks refined *if* you also add a faint border and keep the tint subtle. A very low-opacity **noise/grain overlay** (2–4% via an SVG feTurbulence texture) over flat backgrounds and gradients kills banding and adds a tactile, film-like quality that instantly reads as crafted rather than generated. Radius should be consistent and usually modest (0–8px for the systematic lane; larger only if the flavor calls for it) — and pick one radius language, don't mix sharp and pill randomly.

---

## Motion & micro-interaction

Motion is where a static-good page becomes memorable — or becomes slop. The discipline: **every animation must communicate something** (state, spatial relationship, feedback, hierarchy). If you can't say in one sentence what an animation tells the user, delete it.

**Easing is everything; never `linear`, rarely default `ease`.** Nothing physical moves at constant speed. Keep a tiny vocabulary of curves and reuse them:
- **Standard / in-out** — `cubic-bezier(0.4, 0, 0.2, 1)` — most UI transitions.
- **Premium ease-out ("expo")** — `cubic-bezier(0.16, 1, 0.3, 1)` — the confident, fast-then-glide reveal behind the Apple/Vercel feel. Use for entrances and scroll reveals.
- **Ease-out quart** — `cubic-bezier(0.25, 1, 0.5, 1)` — snappy but smooth for hovers/toggles.
- Reserve **overshoot/spring** (a `back`-style curve or real spring physics) for playful moments only; the systematic lane avoids bounce.

**Durations, calibrated.** Micro-interactions (hover, press, toggle) `120–220ms`; entrances and reveals `300–500ms`; large or full-screen transitions `500–800ms`. **Duration scales with distance/size** — a big element traveling far takes longer than a small nudge. Anything over ~800ms for a routine transition adds latency and feels sluggish; a page transition that delays content is a UX regression, not a flourish.

**Orchestrate; never animate everything at once.** Reveal related items in a **stagger** of `40–80ms` per item so the eye flows through hierarchy. A single orchestrated page-load sequence (logo/nav settle, then headline, then subhead, then CTA, then media) lands far harder than scattered independent effects. Borrow the classic principles: slight **anticipation** before a move, **follow-through** (a 3–8px overshoot that settles) on arrival, secondary elements reacting with a small delay.

**The high-value micro-interactions:**
- Buttons: subtle scale/brightness on hover (`~1.02`), a real press state (`~0.98`, `~120ms`), never just a color swap.
- **Magnetic buttons / cursor affinity:** a primary CTA that gently pulls toward the cursor within its hit area — a few dozen lines, disproportionately premium. (Recipe included.)
- Links: an underline that draws in from one side, not an instant on/off.
- Cards: lift + border-brighten on hover, content parallax within.
- **Scroll-triggered reveals:** fade + short rise (`translateY(16–24px)` → `0`, opacity `0→1`) as elements enter, via `IntersectionObserver`, staggered. This one technique elevates almost any page.
- **Split-text reveals:** animate a headline by word or line (clip-reveal from below) for a signature hero moment.
- Number counters, animated gradients/auroras, and marquees — use at most one, and keep it quiet.

**Scroll experiences (when the flavor earns them).** For cinematic/atmospheric work, scroll-driven storytelling is the wow: pinned sections where scroll advances *time inside a scene*, layered parallax, clip-path section transitions, a WebGL/Three.js hero. The production stack is **Lenis (smooth scroll) + GSAP ScrollTrigger + Three.js**; simple cases can use the native CSS `animation-timeline: view()` with no JS. Always detect device capability and serve a lighter version (fewer particles, simpler shaders) or a static fallback on weak hardware, and preserve the conversion path without WebGL. (Setup in `references/recipes.md`.)

**Non-negotiables for motion:**
- Respect `prefers-reduced-motion: reduce` — gate transforms/parallax/auto-play behind it and provide instant, non-moving equivalents. ~35% of adults over 40 have vestibular sensitivity; this is not optional.
- **Animate only `transform` and `opacity`** for 60fps; animating layout properties (width, top, margin) causes jank. Use `will-change` sparingly and remove it after.
- Motion must never *add* perceived latency to a task. Fast for utility, expressive only for moments.

## The signature moment

Premium pages are remembered for **one** thing. Decide what it is and pour craft into it: an unrepeatable hero (a live product demo, a WebGL scene, a kinetic-type headline, an interactive artifact that embodies the product), a single transition nobody else has, a data visualization that *is* the story. Everything around the signature stays quiet and disciplined so the one bold thing lands. Spending boldness everywhere means it lands nowhere. Pick the moment; protect it.

## Copy & voice (design material, not filler)

Words are UI. Bring the same intent to them as to spacing. Write from the user's side of the screen: name things by what people recognize and control, describe what something *does* in plain, specific terms, use active voice, and keep an action's label consistent through its whole flow ("Publish" → toast "Published"). Sentence case, plain verbs, no filler. Be specific over clever — specificity is what makes copy sound human and defeats the averaged-headline tell. Treat empty states as invitations and errors as directions (what happened, how to fix it), in the interface's voice, never apologizing or vague. If you must supply placeholder testimonials/logos/metrics, make them clearly placeholder — never fabricate a real-sounding person or number.

---

## The quality floor & self-critique (do this every time)

Build to this floor without announcing it, and critique your own work as you go. **Take a screenshot and look with fresh eyes** — a picture is worth a thousand tokens; most slop survives because no one looked.

Ship checklist:
- **Responsive** down to 360px: fluid type (`clamp()`), reflowed grids, generous touch targets (≥44px, ≥8px apart), reduced section padding on mobile (e.g. 96→48).
- **Accessible:** visible keyboard focus (a styled focus-ring, never `outline:none` with no replacement), real contrast (WCAG AA: 4.5:1 text), semantic landmarks and heading order, `alt` text, labeled controls, reduced-motion honored.
- **Performance:** LCP < 2.5s, INP < 200ms, CLS < 0.1; animate only transform/opacity; lazy-load below-the-fold media; subset/`display:swap` fonts; ship no layout shift.
- **Consistency audit:** one spacing scale, one radius language, one type scale, one motion vocabulary. Hunt for the value that doesn't belong.

Then run the three tests:
1. **The squint test.** Blur your eyes (or the screenshot). Does a clear hierarchy remain — one obvious focal point, clean rhythm — or does everything read at the same weight? Fix flatness.
2. **The sameness test.** Could this exact page belong to a hundred other companies? If yes, it's the default. Push the type, color, structure, or signature until it could only be *this* subject.
3. **The remove-one-thing test.** Take one element/effect/color off. Did the page get worse? If not, leave it off. Repeat until removing anything would hurt.

## Implementation notes & stack

Work in two passes, mostly in your head: **plan → critique the plan against this firewall → build to the revised plan.** Draft a compact token system first (4–6 named colors, 2–3 typefaces with roles, the spacing/radius scales, the motion curves, and the one signature) and reject any part that reads as the generic default before writing a line of code. Watch CSS specificity — type-based and element-based selectors (`.section` vs `.cta`) can cancel each other's paddings; keep the cascade clean.

Choose tools to the target:
- **Real production project (you're writing files):** the premium motion stack is fair game — Framer Motion / Motion.dev for React, GSAP + ScrollTrigger for timelines and scroll, Lenis for smooth scroll, Three.js/R3F for WebGL. Use a superfamily font, a token layer (CSS custom properties or Tailwind theme), and the recipes.
- **In-sandbox artifacts (React/HTML preview):** heavier libraries (GSAP, Lenis, Framer Motion) are typically **not** available; lean on **CSS transitions/animations, the Web Animations API, `IntersectionObserver`, `requestAnimationFrame`, and `three` (r128)**, which are enough for excellent results. No `localStorage`/`sessionStorage` in artifacts — keep state in memory.
- Either way, prefer primitives that work everywhere; only reach for a library when it earns its weight.

**Copy-ready code lives in `references/recipes.md`** — motion tokens as CSS custom properties, the premium easing set, the layered elevation/shadow scale, fluid type with `clamp()`, `IntersectionObserver` scroll-reveal with stagger, a magnetic button, split-text headline reveal, an SVG grain overlay, a subtle mesh/aurora background, and the Lenis + GSAP + Three.js scroll setup for real projects. Read it when you're ready to implement.

## One-paragraph summary to internalize

Pick one flavor of premium and commit. Manufacture coherence through precise, systematic tokens — a real type scale with negatively-tracked display faces that aren't Inter, a disciplined neutral ramp with a single restrained accent and no pure black/white, one 4px-based spacing scale used everywhere, border-first depth with layered shadows, and a tiny motion vocabulary of custom ease-out curves with 40–80ms staggers that only ever animate transform and opacity. Give the page far more whitespace than feels necessary, compress the type inside it, and spend all your boldness on a single signature moment while keeping everything else quiet. Write specific, human copy about the actual thing. Refuse every item on the AI-slop blocklist. Then screenshot it, squint, remove one more thing, and ship it to the quality floor.
