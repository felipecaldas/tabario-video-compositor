# Hybrid FFmpeg + Remotion Renderer

## Purpose

The hybrid renderer moves final source-video composition out of Remotion and into FFmpeg. Remotion remains in the pipeline, but only as a graphics plate renderer for captions, typography, badges, lower thirds, brand elements, and end cards.

This architecture exists because the Remotion-primary final render path proved fragile for real video stitching during `TAB-181`, including black-frame and start-of-clip stutter failures. The new pipeline gives timeline ownership to FFmpeg, where source video decode, normalization, transitions, audio, and output validation are deterministic and inspectable.

## Ownership Boundaries

FFmpeg owns:

- Source video normalization to the target FPS, resolution, codec, pixel format, and timestamp cadence.
- Timeline composition for sequential fullscreen scenes.
- Multi-video layouts such as picture-in-picture, split horizontal, split vertical, and talking-head variants.
- Scene boundary transitions before final stitching.
- Voiceover and music placement, ducking, loudness normalization, and final AAC/H.264 encoding.
- Final validation with `ffprobe`, duration checks, audio/video stream checks, and black-frame detection.

Remotion owns:

- Transparent graphics plates for captions, lower thirds, kinetic titles, badges, logo reveals, and brand accents.
- Full-frame graphics plates for typographic scenes and end cards when no source video is needed.
- React-based animation of brand overlays, but not source video stitching.

The API/job runner owns:

- Hydrating brand and handoff data.
- Generating the existing `CompositionManifest`.
- Translating `CompositionManifest` to the renderer-neutral `TimelineManifest`.
- Selecting the renderer implementation through migration config.
- Persisting renderer artifacts and validation reports.

## Canonical Timeline Manifest

`TimelineManifest` is the renderer-neutral contract introduced under `src/timeline`.

It separates the final render into:

- `assets`: source video, audio, image, and graphics assets by stable id.
- `layouts`: normalized layout definitions with frame-relative regions.
- `tracks.video`: video clips with start frame, duration, asset ref, layout ref, region ref, and grade.
- `tracks.audio`: voiceover/music clips with start frame, optional duration, source offset, and gain.
- `tracks.graphics`: Remotion-rendered overlay or full-frame plate clips.
- `transitions`: frame-accurate scene boundary transitions between video clip ids.
- `outputs`: final container, codecs, pixel format, and filename.
- `captions`: word-level timing preserved for graphics plate rendering.

The manifest validates:

- Missing video/audio assets.
- Bad layout or region references.
- Duplicate asset, layout, or video clip ids.
- Video/audio/graphics clips that exceed timeline duration.
- Caption words with invalid timing.
- Transitions that reference missing clips or exceed timeline duration.

## FFmpeg Base Render Flow

1. Normalize every source clip to the target FPS, resolution, codec, pixel format, and timestamp base.
2. Build one FFmpeg filter graph from `TimelineManifest`.
3. Render video clips according to their layout regions.
4. Apply transitions at scene boundaries before the final stitch.
5. Mix voiceover and music according to the audio track.
6. Composite Remotion graphics plates over the base video.
7. Encode the final MP4 output.
8. Run final validation and persist the validation report beside render artifacts.

Sequential fullscreen scenes are a special case of the same timeline model: each scene is a video clip on the main region, with monotonically increasing `start_frame`.

## Remotion Graphics Flow

1. Extract graphics clips and caption timing from `TimelineManifest`.
2. Render transparent plates for overlay components.
3. Render full-frame plates for typographic scenes or end cards when needed.
4. Emit graphics artifacts with stable filenames and exact frame spans.
5. Let FFmpeg composite those plates onto the base render.

Remotion should not open, decode, stitch, or transition source video in the final production renderer.

## Transition Mapping

The transition contract stays semantic at the manifest layer and maps to FFmpeg-native approximations:

- `soft_cut`: short crossfade or near-cut dissolve.
- `slide_push`: directional `xfade` slide/push approximation.
- `color_wipe`: wipe with brand/accent color plate where feasible.
- `scale_push`: zoom/scale push approximation.
- `zoom_blur`: zoom transition with blur approximation.

Transitions are applied before final concat/stitching. Clips must not be pre-stitched before transition processing, because that removes the overlap window required for frame-accurate transitions.

## Migration Notes

The deployment selector is `VIDEO_COMPOSITOR_RENDERER`.

- `ffmpeg_hybrid`: production default. This renders graphics plates with Remotion, then performs final source-video stitching, transitions, audio mix, encode, and validation in FFmpeg.
- `remotion_primary`: rollback path. This keeps the previous Remotion-first final render and FFmpeg post-pass available during migration.

If the variable is omitted, the code defaults `NODE_ENV=production` to `ffmpeg_hybrid` and non-production environments to `remotion_primary`. The Docker Compose service sets `VIDEO_COMPOSITOR_RENDERER=${VIDEO_COMPOSITOR_RENDERER:-ffmpeg_hybrid}` so production containers do not accidentally use the rollback renderer.

## Deployment and Rollback

### video-compositor

Normal production deployment:

```bash
VIDEO_COMPOSITOR_RENDERER=ffmpeg_hybrid docker compose up -d --build tabario-video-compositor
docker compose logs -f tabario-video-compositor
```

Validate a production render by confirming:

- `/compose/start` returns a `compose_job_id`.
- `GET /compose/:id` reaches `status=done`.
- `/data/shared/{run_id}/composed.mp4` exists.
- `/data/shared/{run_id}/composed.validation.json` exists and reports the expected dimensions, FPS, duration, video stream, and audio stream.

Rollback to the previous Remotion-primary final renderer:

```bash
VIDEO_COMPOSITOR_RENDERER=remotion_primary docker compose up -d --build tabario-video-compositor
docker compose logs -f tabario-video-compositor
```

The rollback keeps the same `/compose/start` and `GET /compose/:id` API contract. No `edit-videos` request shape change is required.

### edit-videos

Confirm the worker can reach the compositor before enabling brief-aware handoff traffic:

```bash
TABARIO_VIDEO_COMPOSITOR_URL=http://tabario-video-compositor:9312 docker compose up -d --build api worker
docker compose logs -f worker
```

For normal production traffic, keep `TABARIO_VIDEO_COMPOSITOR_URL` pointed at the compositor and allow brief-aware requests to use `handoff_to_compositor=true` or the auto-computed handoff path.

If the compositor must be bypassed entirely, disable the handoff at the caller by sending `handoff_to_compositor=false`. If only the hybrid renderer is failing, prefer the `video-compositor` rollback selector above so brief-aware handoff, polling, upload, and webhook behavior remain unchanged.

Remotion code remains valuable for graphics plates and future experiments, but Remotion-primary final rendering is a temporary rollback path only.
