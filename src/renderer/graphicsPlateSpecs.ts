import { join } from 'path';
import { TimelineGraphicsClip, TimelineManifest } from '../timeline';

export interface GraphicsPlateSpec {
  id: string;
  clipId: string;
  filename: string;
  outputPath: string;
  startFrame: number;
  durationFrames: number;
  renderMode: TimelineGraphicsClip['render_mode'];
  plateType: 'graphics_clip' | 'caption_track';
  clip?: TimelineGraphicsClip;
}

export interface BuildGraphicsPlateSpecsOptions {
  timeline: TimelineManifest;
  outputDir: string;
}

export function buildGraphicsPlateSpecs(options: BuildGraphicsPlateSpecsOptions): GraphicsPlateSpec[] {
  const graphicsSpecs = options.timeline.tracks.graphics.map((clip) => plateSpecForGraphicsClip(options, clip));
  // Only emit a caption plate when we actually have words to render. An empty
  // caption track would otherwise produce a full-frame transparent plate that
  // costs a Chromium render and adds an unnecessary overlay pass.
  const hasCaptionWords = Boolean(
    options.timeline.captions && options.timeline.captions.words.length > 0,
  );
  const captionSpec = hasCaptionWords ? [plateSpecForCaptions(options)] : [];

  return [...graphicsSpecs, ...captionSpec];
}

function plateSpecForGraphicsClip(
  options: BuildGraphicsPlateSpecsOptions,
  clip: TimelineGraphicsClip,
): GraphicsPlateSpec {
  const filename = `${sanitizePlateId(clip.id)}.mov`;
  return {
    id: `plate:${clip.id}`,
    clipId: clip.id,
    filename,
    outputPath: join(options.outputDir, filename),
    startFrame: clip.start_frame,
    durationFrames: clip.duration_frames,
    renderMode: clip.render_mode,
    plateType: 'graphics_clip',
    clip,
  };
}

function plateSpecForCaptions(options: BuildGraphicsPlateSpecsOptions): GraphicsPlateSpec {
  const filename = 'caption-track.mov';
  return {
    id: 'plate:caption_track',
    clipId: 'caption_track',
    filename,
    outputPath: join(options.outputDir, filename),
    startFrame: 0,
    durationFrames: options.timeline.duration_frames,
    renderMode: 'transparent_plate',
    plateType: 'caption_track',
  };
}

function sanitizePlateId(id: string): string {
  return id.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}
