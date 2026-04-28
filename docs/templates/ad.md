# Ad Template — Editorial Rules & Philosophy

> "People do not remember your transitions. They remember how the ad made them feel and what it made them do."

## 1. Editorial Philosophy

A high-converting ad is a **behavior-changing machine**. Its purpose is to make someone stop, feel, understand, trust, and act — in under 30 seconds.

Every editorial decision must serve this goal. An ad is not a brand film. It is not a demo reel. It is a conversion tool.

Five things a great ad does, in order:

1. **Stops the scroll** — pattern interrupt in the first 1.5 seconds
2. **Makes the viewer care** — agitates a pain they already feel
3. **Builds desire** — shows the product as the obvious solution
4. **Creates trust** — proof that it works for real people
5. **Makes action easy** — one clear, urgent command

---

## 2. Scene Structure — The 6-Act Formula

Target total duration: **≤ 30 seconds**

| # | Role | Duration | Purpose | Transition IN |
|---|------|----------|---------|--------------|
| 1 | `hook` | 0.5–1.5s | Stop the scroll — bold claim, startling visual, or emotional reaction | cold open `zoom_blur` |
| 2 | `problem` | 1.5–3s | Agitate the pain — viewer sees their frustration | `scale_push` |
| 3 | `solution` | 2.5–4.5s | Brand pivot — product/service revealed as the answer | `color_wipe` (accent, once per video) |
| 4 | `proof` ×1–3 | 1.5–2.5s each | Social proof — metrics, testimonials, results, star ratings | `slide_push` left |
| 5 | `outcome` | 2–3.5s | Life after — viewer imagines themselves post-purchase | `soft_cut` |
| 6 | `cta` | 2–3s | Direct command — one action, urgent language | `zoom_blur` |

### Why this structure works

- **Problem before solution** — viewers skip ads that open with a product. Show the pain first; it earns the right to show the product.
- **Proof at 0:12–0:20** — most brands put proof too late (or skip it). Proof at the midpoint doubles credibility before the CTA ask.
- **Outcome before CTA** — one clean aspirational beat gives the brain a moment to imagine before being asked to act.
- **Transition escalation** — energy builds toward the CTA. The viewer is most engaged in the final 5 seconds.

---

## 3. Component Usage

| Scene | Component | Props | Why |
|-------|-----------|-------|-----|
| hook | `kinetic_title` | `text`, `color: "#FFFFFF"` | Bold centered text that appears on frame 0 and pops in |
| problem | *(none)* | — | Let the visual speak; text competes with the emotional impact |
| solution | `stagger_title` | `text` = product name, `color: "#FFFFFF"` | Word-by-word stagger creates a reveal rhythm |
| proof | `metric_callout` | `metric` = stat, `label` = context | Large number on a dark scrim — impossible to miss |
| outcome | *(none)* | — | One clean aspirational shot, no text clutter |
| cta | `kinetic_title` | `text` = action verb, `color: "#FFFFFF"` | Fills the frame; viewer knows exactly what to do |

### MetricCallout component

`<MetricCallout metric="3× FASTER" label="than the competition" />`

- Hero number at 90px bold — dominates the frame
- Accent-colour underline for brand anchoring
- Dark scrim (60% opacity rounded rect) ensures legibility on any background
- Spring entry: scale 0.7→1.0 in ~6 frames

---

## 4. Text Treatment Rules

**Default colour:** `#FFFFFF` (white) — always. Never use `brand_colors.primary` in an ad.

**Text shadow:** `0 2px 20px rgba(0,0,0,0.85)` — stronger than decorative, weaker than a full scrim. Ensures contrast on both light and dark footage.

**Animation timing:** text must be at full opacity by frame 3. Use `interpolate(frame, [0, 3], [0, 1])` for opacity, not a slow spring. Spring is fine for scale pop.

**Font size:** KineticTitle = 72px, StaggerTitle = 64px, MetricCallout metric = ~90px. Never go below 48px for any ad overlay.

**Word count:** 3–7 words per overlay. Ads are watched muted; text must be skimmable in under a second.

---

## 5. Grade & Color Rules

| Scene | Grade | Reasoning |
|-------|-------|-----------|
| hook | `neutral` | Let the clip stand on its own for the pattern interrupt |
| problem | `high_contrast` | Heightens the pain; dark and stark feels more urgent |
| solution | `vibrant_warm` | Product reveal should feel positive and aspirational |
| proof | `neutral` | Trust is built through clarity, not color manipulation |
| outcome | `vibrant_warm` | The transformation should feel warm and optimistic |
| cta | `vibrant_warm` | Match the energy of the ask |

These grades are applied by `buildTemplateManifest` via `default_grade_per_role` in `ad.json`. The LLM prompt also enforces them.

---

## 6. Transition Sequence

Transitions **must escalate in energy** toward the CTA. The viewer's engagement peaks in the final seconds — match it.

```
hook ──[scale_push]──▶ problem ──[color_wipe]──▶ solution ──[slide_push left]──▶ proof(s) ──[soft_cut]──▶ outcome ──[zoom_blur]──▶ cta
```

| Boundary | Type | Rationale |
|----------|------|-----------|
| hook → problem | `scale_push` | Outgoing hook zooms away — signals "pay attention, something new" |
| problem → solution | `color_wipe` | The brand pivot moment — brand accent sweeps in from left |
| solution → proof | `slide_push` left | Forward motion — moving toward proof |
| proof → proof | `slide_push` left | Maintains forward momentum through all proof scenes |
| proof → outcome | `soft_cut` | Breathing room — the outcome needs a clean, calm entry |
| outcome → cta | `zoom_blur` | Maximum energy — snap the viewer to attention for the ask |

`color_wipe` may only appear **once per video**. If multiple boundaries need a prominent transition, use `zoom_blur` or `scale_push` instead.

---

## 7. Retention Rules

Elite editors follow one rule: **change something every 1–3 seconds**.

What counts as a change:
- Camera angle or scene cut
- Text appearing or disappearing
- Transition effect
- Grade shift (achieved by our per-role grade prescriptions)
- Motion change (ken_burns zoom direction)

Our duration caps enforce this:

| Scene | Cap | Max frames at 30fps |
|-------|-----|---------------------|
| hook | 1.5s | 45 |
| problem | 3s | 90 |
| each proof | 2.5s | 75 |
| cta | 3s | 90 |

Anything longer breaks attention. The solution and outcome scenes are allowed slightly more space (4–5s) because they carry emotional weight and need a few frames to breathe.

---

## 8. Quality Checklist

Run this before marking any ad render as done:

- [ ] **Strong first frame?** — video starts on motion, not a black frame or a static logo
- [ ] **Caption appears frame 0?** — hook text is visible within 3 frames, not after a 0.5s fade-in
- [ ] **Understandable muted?** — all key messages are in text overlays; the ad works without sound
- [ ] **Text legible on dark AND light backgrounds?** — white text with drop shadow passes both
- [ ] **No dead seconds?** — no scene exceeds its duration cap
- [ ] **Product shown early?** — solution scene appears by ~0:06
- [ ] **Proof included?** — at least one `metric_callout` overlay in the proof section
- [ ] **Transition sequence correct?** — escalates from `scale_push` to `color_wipe` to `zoom_blur`
- [ ] **CTA is an action verb?** — "Shop Now", "Try Free Today", not "Learn More"
- [ ] **Total duration ≤ 30s?**

---

## 9. What NOT to Do

| Anti-pattern | Why it kills the ad |
|-------------|-------------------|
| Logo intro | Viewers skip in the first 2 seconds. A logo is not a hook. |
| Slow fade-in on the first frame | Wastes the first second; the viewer is already gone |
| All `soft_cut` transitions | No energy, no rhythm; feels like a slideshow |
| Dark text on dark footage | Illegible. Brand-primary blue (#1A3B5D) on dark video is invisible. |
| Generic "Learn More" CTA | Passive, weak, easy to ignore. Use imperative verbs. |
| Proof scene at the end | By then, the viewer has already decided. Place proof at 0:12–0:20. |
| Overlays on every scene | Clutters the frame. Outcome and problem scenes must breathe. |
| `motion_badge` for proof | Too small, too peripheral. Use `metric_callout` — it fills the frame. |
| Skipping the outcome scene | The viewer needs to imagine the transformation before being asked to act. |
| Font size < 48px | Not readable on mobile at normal viewing distance. |

---

## Implementation Reference

| File | Role |
|------|------|
| `src/templates/library/ad.json` | Blueprint: scene roles, duration targets, default transitions, default grades |
| `src/manifest/prompt.md` → "Ad template rules" | LLM instructions for generating ad manifests |
| `remotion/components/KineticTitle.tsx` | Hook and CTA text overlay |
| `remotion/components/StaggerTitle.tsx` | Solution product name reveal |
| `remotion/components/MetricCallout.tsx` | Proof section large metric display |
| `remotion/TabarioComposition.tsx` | Wires all components to manifest |
| `src/services/testRenderService.ts` → `buildTemplateManifest()` | Applies default_transitions and default_grade_per_role from blueprint |
