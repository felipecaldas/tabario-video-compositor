# Remotion KB

## Purpose

This document captures the practical lessons from building and debugging the Tabario compositor with Remotion. It is not API documentation. It is a working engineering note about what has failed, what has worked, and what standards we should hold going forward.

## What Remotion Is Good At Here

Remotion is a strong fit for:

- graphics plates
- branded motion systems
- captions
- end cards
- lower thirds
- transparent overlays
- deterministic React-driven animation

Remotion is a weak fit, in our current stack, for:

- final stitching of many real source video clips
- browser-based decode of heterogeneous generated video assets
- long render paths where a Chrome/container issue can kill the whole job

That boundary should stay explicit. If the job is "animate graphics", Remotion is the right tool. If the job is "own the final source-video timeline", FFmpeg is the safer owner.

## The Failures We Hit

### 1. `selectComposition()` can fail before anything mounts

We hit:

- `Protocol error (Target.setAutoAttach): Target closed`

Important point: this error does not mean scene rendering failed. It can happen during composition discovery, before the composition mounts.

Practical causes we saw or ruled out:

- unsafe `defaultProps`
- module-load crashes in composition dependencies
- Chromium/container launch issues
- code paths that throw before the first rendered frame

### 2. Empty or unsafe `defaultProps` are not harmless

`defaultProps={{} as CompositionManifest}` was a real bug. `selectComposition()` is allowed to evaluate the component using those defaults. If the component dereferences nested fields immediately, discovery can crash before runtime props are ever applied.

Rule:

- every Remotion `Composition` must have real minimal `defaultProps`
- composition code must tolerate missing optional branches

### 3. Module-load work is a risk multiplier

Style resolution at module load time is dangerous. If a registry lookup throws during import, the whole composition can die before the browser gets to mount anything.

Rule:

- avoid doing non-trivial resolution at module load
- prefer runtime guards with a safe fallback

### 4. Rendering "success" does not mean media worked

We had runs where Remotion completed and wrote a file, but the result was:

- black video
- missing audio
- tiny output size

That means render completion is not enough as a success condition.

Rule:

- validate final outputs
- inspect output size, streams, duration, and black-frame ratio

## What Actually Helped

### Stage-level renderer logging

The useful breakdown was:

- `bundle`
- `selectComposition`
- `renderMedia`

Once those were separate, we stopped guessing.

### Browser/runtime logging

Useful logs:

- runtime `uid/gid`
- `CHROME_PATH`
- composition mount logs
- first resolved `staticFile()` URLs
- browser console forwarding

Without those, a lot of time gets lost to blind speculation.

### Probe compositions

A trivial probe composition was worth adding. It answers one important question quickly:

- is Chromium/Remotion itself broken?
- or is our real composition broken during import/evaluation?

That distinction matters.

## Source Video Rules

### Normalize input clips first

Generated clips came in with varying FPS and codecs. That was not stable enough for either Remotion or FFmpeg.

Rule:

- normalize clips to CFR H.264/yuv420p before timeline composition
- log original codec/FPS and normalized output path

### Always patch manifests to normalized filenames

If normalization creates `*_cfr24_h264.mp4`, the manifest must reference those names, not the original files.

Rule:

- normalization output is not an implementation detail
- manifest/timeline asset refs must match the actual render inputs

### Detect the real voiceover filename

Hardcoding `voiceover.mp3` was wrong because some runs contain `voiceover.wav`.

Rule:

- detect the real voiceover asset from the run directory
- propagate that filename through manifest and timeline generation

## Remotion-Specific Code Standards

### Composition code must be defensive

Safe patterns:

- `const safeScenes = scenes ?? []`
- guard optional `audio_track`, `closing`, `caption_track`
- conditionally render `Audio` only when a source exists

Unsafe patterns:

- `audio_track.voiceover_filename` without a guard
- `closing.start_frame` without a fallback
- assuming arrays are always present

### Keep source video wrappers simple

We introduced `FrameAccurateVideo` and changed behavior around `OffthreadVideo`. That increased the failure surface.

Rule:

- keep the source-video wrapper minimal
- add instrumentation there, but avoid unnecessary abstraction
- treat any switch between `Video` and `OffthreadVideo` as a high-risk change that needs explicit validation

### Use Remotion for graphics, not for owning the final timeline

TAB-208 made this clearer. Remotion plates plus FFmpeg final composition is more robust than asking Chrome to be the final video editor.

Rule:

- captions, overlays, end cards: Remotion
- source clip stitch, audio mix, layout composition, transition graph: FFmpeg

## Hybrid Renderer Lessons

### The test path must exercise the real renderer

We lost time debugging the wrong thing because the test-render endpoint was still pinned to `renderComposition()` while production selection had already moved toward `ffmpeg_hybrid`.

Rule:

- test endpoints must honor the same renderer selector as the main compose path

### `xfade` changes duration unless we compensate

This was a key bug. In the hybrid renderer, each `xfade` overlap shortens the produced base video unless the incoming clip or final stream is padded.

Observed symptom:

- video froze around 10s
- audio kept going
- FFmpeg output length proved the base video ended early

Rule:

- if transitions overlap clips, preserve declared timeline duration explicitly
- pad the incoming scene for `xfade`
- pad the final base video to `timeline.duration_frames`

### Closing/end-card overlays still need base-video duration behind them

If the closing is only a graphics plate and the base video ends before the closing window, the result is a frozen final frame under the overlay.

Rule:

- graphics overlays do not create timeline duration by themselves
- the base video stream must exist for the full declared render duration

### Voiceover length must constrain the final timeline

We saw voiceover at ~18s and output at ~17s. That is not acceptable for test-render UX.

Rule:

- if voiceover is longer than the generated manifest, extend the manifest duration
- for now, extend the closing segment
- longer term, template duration allocation should become audio-aware earlier in manifest generation

## Validation Standards Going Forward

Every substantial renderer change should be checked against:

- successful bundle
- successful composition selection
- expected media asset resolution
- final file has video stream
- final file has audio stream when required
- final duration matches expectation within tolerance
- black-frame ratio below threshold

For hybrid rendering specifically:

- base video length must match `timeline.duration_frames`
- transitions must not silently collapse total duration
- overlays must not be mistaken for timeline duration

## Development Standards We Should Adopt

### 1. Keep Remotion discovery-safe

- real `defaultProps`
- guarded optional branches
- no fragile module-load side effects

### 2. Prefer primary-path parity in tests

- test endpoints should follow the same renderer selector as production
- rollback paths should stay explicit and opt-in

### 3. Add validation early, not after a user reports bad output

- final output validation should be part of the render pipeline
- hybrid renderer already has the right direction here

### 4. Treat browser-based source-video rendering as high risk

When a change touches:

- `Video`
- `OffthreadVideo`
- Chromium launch options
- public asset resolution

it needs stronger verification than a happy-path local render.

### 5. Log the actual assets and durations

For render debugging, the high-value logs are:

- resolved clip filenames after normalization
- voiceover filename
- final manifest duration
- renderer selection
- timeline track counts
- FFmpeg command/filter graph for hybrid output

## Next Improvements

The next quality steps should be:

1. make manifest generation audio-aware so scene allocation targets voiceover duration better
2. add an automated regression test that verifies hybrid output duration stays equal to timeline duration even with transitions and closing plates
3. add a regression test for test-render voiceover extension behavior
4. decide, explicitly, when `Video` vs `OffthreadVideo` is allowed in this codebase and document that policy beside `FrameAccurateVideo`
5. keep Remotion focused on graphics plates unless there is a measured reason to re-expand its responsibility
