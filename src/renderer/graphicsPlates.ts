import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { BrandProfile } from '../types';
import { TimelineManifest } from '../timeline';
import {
  buildGraphicsPlateSpecs,
  BuildGraphicsPlateSpecsOptions,
  GraphicsPlateSpec,
} from './graphicsPlateSpecs';

const REMOTION_ROOT = join(__dirname, '../../remotion/index.ts');
const GRAPHICS_PLATE_COMPOSITION_ID = 'GraphicsPlate';
const CHROME_PATH = process.env.CHROME_PATH;

export { buildGraphicsPlateSpecs, BuildGraphicsPlateSpecsOptions, GraphicsPlateSpec };

export interface RenderGraphicsPlatesOptions extends BuildGraphicsPlateSpecsOptions {
  publicDir?: string;
  brandProfile?: BrandProfile;
  onProgress?: (plate: GraphicsPlateSpec, progress: number) => void;
}

export async function renderGraphicsPlates(options: RenderGraphicsPlatesOptions): Promise<GraphicsPlateSpec[]> {
  const specs = buildGraphicsPlateSpecs(options);
  if (specs.length === 0) {
    return [];
  }

  const bundleLocation = await bundle({
    entryPoint: REMOTION_ROOT,
    ...(options.publicDir ? { publicDir: options.publicDir } : {}),
  });

  for (const spec of specs) {
    // Always include every key, even when "absent". JSON.stringify drops
    // undefined fields, and Remotion v4 only merges inputProps keys that are
    // also declared in defaultProps — so we use null for absent values to
    // make sure the field arrives in the bundle and overrides the default.
    const inputProps = {
      timeline: options.timeline,
      clip: spec.clip ?? null,
      plateType: spec.plateType,
      brandProfile: options.brandProfile ?? null,
    };
    console.log(
      `[graphicsPlates] Rendering plate ${spec.id} (type=${spec.plateType}, ` +
        `start=${spec.startFrame}, duration=${spec.durationFrames}) -> ${spec.outputPath}`,
    );
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: GRAPHICS_PLATE_COMPOSITION_ID,
      inputProps,
      ...(CHROME_PATH ? { browserExecutable: CHROME_PATH } : {}),
      chromiumOptions: {
        disableWebSecurity: false,
        enableMultiProcessOnLinux: true,
        headless: true,
      },
    });

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'prores',
      proResProfile: '4444',
      // CRITICAL: pin alpha-preserving pixel format. Without this, ProRes 4444
      // can resolve to yuv422p10le (no alpha) and the resulting plate is opaque,
      // which blacks out the underlying video when overlaid in ffmpeg.
      pixelFormat: 'yuva444p10le',
      // yuva444p10le requires alpha-capable frames; Remotion defaults to JPEG
      // (no alpha) and rejects the combo. PNG preserves transparency.
      imageFormat: 'png',
      outputLocation: spec.outputPath,
      inputProps,
      ...(CHROME_PATH ? { browserExecutable: CHROME_PATH } : {}),
      chromiumOptions: {
        disableWebSecurity: false,
        enableMultiProcessOnLinux: true,
        headless: true,
      },
      onProgress: ({ progress }: { progress: number }) => {
        options.onProgress?.(spec, Math.round(progress * 100));
      },
    });

    const plateBytes = existsSync(spec.outputPath) ? statSync(spec.outputPath).size : 0;
    console.log(`[graphicsPlates] Plate ${spec.id} written: ${plateBytes} bytes`);
  }

  return specs;
}
