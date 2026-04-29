import { execFile } from 'child_process';
import { isAbsolute, join } from 'path';
import { promisify } from 'util';
import {
  TimelineManifest,
  TimelineAudioClip,
  TimelineLayout,
  TimelineTransition,
  TimelineVideoClip,
} from '../timeline';

const execFileAsync = promisify(execFile);

export interface HybridFfmpegRenderOptions {
  timeline: TimelineManifest;
  inputDir: string;
  outputPath: string;
  graphicsPlates?: HybridGraphicsPlateInput[];
}

export interface HybridGraphicsPlateInput {
  clipId: string;
  filename: string;
}

interface IndexedInput {
  assetId: string;
  filename: string;
  inputIndex: number;
}

interface RenderedScene {
  label: string;
  durationFrames: number;
  clipIds: Set<string>;
}

export function buildHybridFfmpegArgs(options: HybridFfmpegRenderOptions): string[] {
  assertSupportedTimeline(options.timeline);

  const videoInputs = collectInputs(
    options.timeline,
    options.timeline.tracks.video.map((clip) => clip.asset_id),
  );
  const audioInputs = collectInputs(
    options.timeline,
    options.timeline.tracks.audio.map((clip) => clip.asset_id),
    videoInputs.length,
  );
  const graphicsInputs = collectGraphicsPlateInputs(
    options.graphicsPlates ?? [],
    videoInputs.length + audioInputs.length,
  );

  const args = [
    ...inputArgs(videoInputs, options.inputDir),
    ...inputArgs(audioInputs, options.inputDir),
    ...inputArgs(graphicsInputs, options.inputDir),
  ];

  const videoFilters = buildVideoFilters(options.timeline, videoInputs);
  const graphicsFilters = buildGraphicsOverlayFilters(options.timeline, graphicsInputs);
  const audioFilters = buildAudioFilters(options.timeline, audioInputs);
  const filterComplex = [...videoFilters, ...graphicsFilters, ...audioFilters].join(';');
  const videoOutputLabel = graphicsFilters.length > 0 ? '[compositedv]' : '[basev]';

  args.push(
    '-filter_complex', filterComplex,
    '-map', videoOutputLabel,
  );

  const hasAudio = audioFilters.length > 0;

  if (hasAudio) {
    args.push('-map', '[mixeda]');
  } else {
    args.push('-an');
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', options.timeline.outputs[0].pixel_format,
    '-r', String(options.timeline.fps),
    '-fps_mode', 'cfr',
  );

  if (hasAudio) {
    args.push(
      '-c:a', options.timeline.outputs[0].audio_codec,
      '-b:a', '192k',
    );
  }

  args.push(
    '-movflags', '+faststart',
    '-y',
    options.outputPath,
  );

  return args;
}

export async function renderHybridFfmpeg(options: HybridFfmpegRenderOptions): Promise<void> {
  const args = buildHybridFfmpegArgs(options);

  try {
    const { stderr } = await execFileAsync('ffmpeg', args);
    if (stderr) {
      console.debug(`[ffmpeg-hybrid] stderr: ${stderr}`);
    }
  } catch (err) {
    throw new Error(`Hybrid FFmpeg render failed: ${(err as Error).message}`);
  }
}

function assertSupportedTimeline(timeline: TimelineManifest): void {
  if (timeline.tracks.video.length === 0) {
    throw new Error('Hybrid FFmpeg renderer requires at least one video clip');
  }
}

function collectInputs(
  timeline: TimelineManifest,
  assetIds: string[],
  startIndex = 0,
): IndexedInput[] {
  const uniqueIds = [...new Set(assetIds)];
  return uniqueIds.map((assetId, offset) => {
    const asset = timeline.assets.find((candidate) => candidate.id === assetId);
    if (!asset) {
      throw new Error(`Timeline asset not found: ${assetId}`);
    }

    return {
      assetId,
      filename: asset.filename,
      inputIndex: startIndex + offset,
    };
  });
}

function collectGraphicsPlateInputs(plates: HybridGraphicsPlateInput[], startIndex: number): IndexedInput[] {
  return plates.map((plate, offset) => ({
    assetId: plate.clipId,
    filename: plate.filename,
    inputIndex: startIndex + offset,
  }));
}

function inputArgs(inputs: IndexedInput[], inputDir: string): string[] {
  return inputs.flatMap((input) => ['-i', resolveInputPath(inputDir, input.filename)]);
}

function resolveInputPath(inputDir: string, filename: string): string {
  return isAbsolute(filename) ? filename : join(inputDir, filename);
}

function buildVideoFilters(timeline: TimelineManifest, inputs: IndexedInput[]): string[] {
  const scenes = groupVideoClipsIntoScenes(timeline);
  const filters: string[] = [];
  const renderedScenes: RenderedScene[] = [];

  scenes.forEach((sceneClips, sceneIndex) => {
    const duration = Math.max(...sceneClips.map((clip) => clip.duration_frames));
    const durationSeconds = formatSeconds(framesToSeconds(duration, timeline.fps));
    const baseLabel = `scene${sceneIndex}base`;

    filters.push(
      `color=c=black:s=${timeline.width}x${timeline.height}:d=${durationSeconds}:r=${timeline.fps},format=${timeline.outputs[0].pixel_format}[${baseLabel}]`,
    );

    const sortedClips = [...sceneClips].sort(
      (a, b) => regionZIndex(timeline, a) - regionZIndex(timeline, b) || a.id.localeCompare(b.id),
    );
    let currentLabel = baseLabel;

    sortedClips.forEach((clip, clipIndex) => {
      const input = inputForAsset(inputs, clip.asset_id);
      const region = regionForClip(timeline, clip);
      const rect = regionRect(timeline, region);
      const videoLabel = `scene${sceneIndex}v${clipIndex}`;
      const outputLabel = clipIndex === sortedClips.length - 1 ? `scene${sceneIndex}` : `scene${sceneIndex}tmp${clipIndex}`;

      filters.push(buildVideoClipFilter(timeline, input, clip, rect.width, rect.height, videoLabel));
      filters.push(
        `[${currentLabel}][${videoLabel}]overlay=x=${rect.x}:y=${rect.y}:eof_action=pass[${outputLabel}]`,
      );
      currentLabel = outputLabel;
    });

    renderedScenes.push({
      label: `scene${sceneIndex}`,
      durationFrames: duration,
      clipIds: new Set(sceneClips.map((clip) => clip.id)),
    });
  });

  filters.push(...buildSceneStitchFilters(timeline, renderedScenes));

  return filters;
}

function buildSceneStitchFilters(timeline: TimelineManifest, scenes: RenderedScene[]): string[] {
  if (scenes.length === 1) {
    return finalizeBaseVideoDuration(timeline, scenes[0].label, scenes[0].durationFrames);
  }

  const filters: string[] = [];
  let currentLabel = scenes[0].label;
  let currentDurationFrames = scenes[0].durationFrames;

  for (let index = 1; index < scenes.length; index += 1) {
    const previous = scenes[index - 1];
    const next = scenes[index];
    const transition = transitionBetweenScenes(timeline.transitions, previous, next);
    const outputLabel = `stitched${index}`;

    if (transition) {
      const duration = framesToSeconds(transition.duration_frames, timeline.fps);
      const offset = framesToSeconds(currentDurationFrames - transition.duration_frames, timeline.fps);
      const paddedNextLabel = `scene${index}pad`;
      filters.push(
        `[${next.label}]tpad=stop_mode=clone:stop_duration=${formatSeconds(duration)}[${paddedNextLabel}]`,
      );
      filters.push(
        `[${currentLabel}][${paddedNextLabel}]xfade=transition=${xfadeTransition(transition)}:duration=${formatSeconds(duration)}:offset=${formatSeconds(offset)}[${outputLabel}]`,
      );
      currentDurationFrames += next.durationFrames;
    } else {
      filters.push(`[${currentLabel}][${next.label}]concat=n=2:v=1:a=0[${outputLabel}]`);
      currentDurationFrames += next.durationFrames;
    }

    currentLabel = outputLabel;
  }

  return [
    ...filters,
    ...finalizeBaseVideoDuration(timeline, currentLabel, currentDurationFrames),
  ];
}

function finalizeBaseVideoDuration(
  timeline: TimelineManifest,
  inputLabel: string,
  renderedDurationFrames: number,
): string[] {
  const paddingFrames = timeline.duration_frames - renderedDurationFrames;
  if (paddingFrames <= 0) {
    return [`[${inputLabel}]copy[basev]`];
  }

  return [
    `[${inputLabel}]tpad=stop_mode=clone:stop_duration=${formatSeconds(framesToSeconds(paddingFrames, timeline.fps))}[basev]`,
  ];
}

function buildGraphicsOverlayFilters(timeline: TimelineManifest, inputs: IndexedInput[]): string[] {
  if (inputs.length === 0) {
    return [];
  }

  const filters: string[] = [];
  let currentLabel = 'basev';

  inputs.forEach((input, index) => {
    const clip = timeline.tracks.graphics.find((candidate) => candidate.id === input.assetId);
    const captionPlate = input.assetId === 'caption_track' && timeline.captions;
    if (!clip && !captionPlate) {
      throw new Error(`Timeline graphics clip not found for plate: ${input.assetId}`);
    }

    const startFrame = clip?.start_frame ?? 0;
    const durationFrames = clip?.duration_frames ?? timeline.duration_frames;
    const startSeconds = formatSeconds(framesToSeconds(startFrame, timeline.fps));
    const endSeconds = formatSeconds(framesToSeconds(startFrame + durationFrames, timeline.fps));
    const plateLabel = `plate${index}`;
    const outputLabel = index === inputs.length - 1 ? 'compositedv' : `composited${index}`;

    filters.push(
      `[${input.inputIndex}:v]setpts=PTS-STARTPTS+${startSeconds}/TB,format=rgba[${plateLabel}]`,
    );
    filters.push(
      `[${currentLabel}][${plateLabel}]overlay=x=0:y=0:eof_action=pass:enable='between(t,${startSeconds},${endSeconds})'[${outputLabel}]`,
    );
    currentLabel = outputLabel;
  });

  return filters;
}

function transitionBetweenScenes(
  transitions: TimelineTransition[],
  fromScene: RenderedScene,
  toScene: RenderedScene,
): TimelineTransition | undefined {
  return transitions.find((transition) => (
    fromScene.clipIds.has(transition.from_clip_id) && toScene.clipIds.has(transition.to_clip_id)
  ));
}

function xfadeTransition(transition: TimelineTransition): string {
  switch (transition.type) {
    case 'soft_cut':
      return 'fade';
    case 'slide':
    case 'slide_push':
      return slideXfadeTransition(transition.direction);
    case 'color_wipe':
      return wipeXfadeTransition(transition.direction);
    case 'scale_push':
      return 'zoomin';
    case 'zoom_blur':
      return 'hblur';
  }
}

function slideXfadeTransition(direction: TimelineTransition['direction']): string {
  switch (direction ?? 'left') {
    case 'right':
      return 'slideright';
    case 'up':
      return 'slideup';
    case 'down':
      return 'slidedown';
    case 'left':
    default:
      return 'slideleft';
  }
}

function wipeXfadeTransition(direction: TimelineTransition['direction']): string {
  switch (direction ?? 'left') {
    case 'right':
      return 'wiperight';
    case 'up':
      return 'wipeup';
    case 'down':
      return 'wipedown';
    case 'left':
    default:
      return 'wipeleft';
  }
}

function buildVideoClipFilter(
  timeline: TimelineManifest,
  input: IndexedInput,
  clip: TimelineVideoClip,
  width: number,
  height: number,
  outputLabel: string,
): string {
  const sourceStart = framesToSeconds(clip.source_in_frame, timeline.fps);
  const duration = framesToSeconds(clip.duration_frames, timeline.fps);

  return [
    `[${input.inputIndex}:v]`,
    `trim=start=${formatSeconds(sourceStart)}:duration=${formatSeconds(duration)}`,
    ',setpts=PTS-STARTPTS',
    `,fps=${timeline.fps}`,
    `,scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `,crop=${width}:${height}`,
    ',setsar=1',
    `,format=${timeline.outputs[0].pixel_format}`,
    `[${outputLabel}]`,
  ].join('');
}

function groupVideoClipsIntoScenes(timeline: TimelineManifest): TimelineVideoClip[][] {
  const groups = new Map<string, TimelineVideoClip[]>();

  [...timeline.tracks.video].sort(byStartFrameThenId).forEach((clip) => {
    const key = `${clip.start_frame}:${clip.layout_id}`;
    groups.set(key, [...(groups.get(key) ?? []), clip]);
  });

  return [...groups.values()].sort(
    (a, b) => a[0].start_frame - b[0].start_frame || a[0].id.localeCompare(b[0].id),
  );
}

function layoutForClip(timeline: TimelineManifest, clip: TimelineVideoClip): TimelineLayout {
  const layout = timeline.layouts.find((candidate) => candidate.id === clip.layout_id);
  if (!layout) {
    throw new Error(`Timeline layout not found for clip "${clip.id}": ${clip.layout_id}`);
  }
  return layout;
}

function regionForClip(timeline: TimelineManifest, clip: TimelineVideoClip): TimelineLayout['regions'][number] {
  const layout = layoutForClip(timeline, clip);
  const region = layout.regions.find((candidate) => candidate.id === clip.region_id);
  if (!region) {
    throw new Error(`Timeline region not found for clip "${clip.id}": ${clip.layout_id}/${clip.region_id}`);
  }
  return region;
}

function regionZIndex(timeline: TimelineManifest, clip: TimelineVideoClip): number {
  return regionForClip(timeline, clip).z_index;
}

function regionRect(
  timeline: TimelineManifest,
  region: TimelineLayout['regions'][number],
): { x: number; y: number; width: number; height: number } {
  const x = Math.round(region.x * timeline.width);
  const y = Math.round(region.y * timeline.height);
  const width = evenDimension(Math.round(region.width * timeline.width));
  const height = evenDimension(Math.round(region.height * timeline.height));

  return { x, y, width, height };
}

function evenDimension(value: number): number {
  return Math.max(2, value % 2 === 0 ? value : value - 1);
}

function buildAudioFilters(timeline: TimelineManifest, inputs: IndexedInput[]): string[] {
  if (timeline.tracks.audio.length === 0) {
    return [];
  }

  const clips = [...timeline.tracks.audio].sort(byStartFrameThenId);
  const perClipFilters = clips.map((clip, index) => buildAudioClipFilter(timeline, inputs, clip, index));
  const mixInputs = clips.map((_clip, index) => `[a${index}]`).join('');
  const mix = `${mixInputs}amix=inputs=${clips.length}:duration=longest:dropout_transition=0,loudnorm=I=-16:LRA=11:TP=-1.5[mixeda]`;

  return [...perClipFilters, mix];
}

function buildAudioClipFilter(
  timeline: TimelineManifest,
  inputs: IndexedInput[],
  clip: TimelineAudioClip,
  index: number,
): string {
  const input = inputForAsset(inputs, clip.asset_id);
  const sourceStart = framesToSeconds(clip.source_in_frame, timeline.fps);
  const duration = framesToSeconds(clip.duration_frames ?? timeline.duration_frames, timeline.fps);
  const startDelayMs = Math.round(framesToSeconds(clip.start_frame, timeline.fps) * 1000);
  const volume = clip.gain_db === undefined ? '' : `,volume=${clip.gain_db}dB`;

  return [
    `[${input.inputIndex}:a]`,
    `atrim=start=${formatSeconds(sourceStart)}:duration=${formatSeconds(duration)}`,
    ',asetpts=PTS-STARTPTS',
    `,adelay=${startDelayMs}:all=1`,
    volume,
    `[a${index}]`,
  ].join('');
}

function inputForAsset(inputs: IndexedInput[], assetId: string): IndexedInput {
  const input = inputs.find((candidate) => candidate.assetId === assetId);
  if (!input) {
    throw new Error(`Timeline input not found for asset: ${assetId}`);
  }
  return input;
}

function byStartFrameThenId(
  a: Pick<TimelineVideoClip | TimelineAudioClip, 'start_frame' | 'id'>,
  b: Pick<TimelineVideoClip | TimelineAudioClip, 'start_frame' | 'id'>,
): number {
  return a.start_frame - b.start_frame || a.id.localeCompare(b.id);
}

function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

function formatSeconds(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}
