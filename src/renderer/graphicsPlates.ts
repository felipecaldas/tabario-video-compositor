import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
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
    const inputProps = {
      timeline: options.timeline,
      clip: spec.clip,
      plateType: spec.plateType,
      brandProfile: options.brandProfile,
    };
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: GRAPHICS_PLATE_COMPOSITION_ID,
      inputProps,
    });

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'prores',
      proResProfile: '4444',
      outputLocation: spec.outputPath,
      inputProps,
      onProgress: ({ progress }: { progress: number }) => {
        options.onProgress?.(spec, Math.round(progress * 100));
      },
    });
  }

  return specs;
}
