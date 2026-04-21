import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { join } from 'path';
import { BrandProfile, CompositionManifest } from '../types';

const REMOTION_ROOT = join(__dirname, '../../remotion/index.ts');
const COMPOSITION_ID = 'TabarioComposition';

export interface RenderOptions {
  manifest: CompositionManifest;
  outputPath: string;
  brandProfile?: BrandProfile;
  onProgress?: (progress: number) => void;
}

/**
 * Render a CompositionManifest to an MP4 file using Remotion.
 * Writes the output to outputPath.
 */
export async function renderComposition(options: RenderOptions): Promise<void> {
  const { manifest, outputPath, brandProfile, onProgress } = options;

  // Merge brandProfile into inputProps so BrandProvider is fully populated
  const inputProps: Record<string, unknown> = {
    ...(manifest as unknown as Record<string, unknown>),
    ...(brandProfile ? { brandProfile } : {}),
  };

  console.log(`[renderer] Bundling Remotion composition for run_id=${manifest.run_id}`);
  if (brandProfile) {
    console.log(`[renderer] Brand profile attached for client_id=${brandProfile.client_id}`);
  }
  const bundleLocation = await bundle({ entryPoint: REMOTION_ROOT });

  console.log(`[renderer] Selecting composition: ${COMPOSITION_ID}`);
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: COMPOSITION_ID,
    inputProps,
  });

  console.log(`[renderer] Starting render → ${outputPath}`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      console.log(`[renderer] Render progress: ${pct}%`);
      onProgress?.(pct);
    },
    chromiumOptions: {
      disableWebSecurity: false,
      headless: true,
    },
  });

  console.log(`[renderer] Render complete: ${outputPath}`);
}
