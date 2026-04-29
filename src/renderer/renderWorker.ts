import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { join } from 'path';
import { BrandProfile, CompositionManifest } from '../types';

const REMOTION_ROOT = join(__dirname, '../../remotion/index.ts');
const REMOTION_PROBE_ROOT = join(__dirname, '../../remotion/probe.ts');
const COMPOSITION_ID = 'TabarioComposition';
const PROBE_COMPOSITION_ID = 'ProbeComposition';
const CHROME_PATH = process.env.CHROME_PATH;

function summarizeManifest(manifest: CompositionManifest): string {
  return [
    `run_id=${manifest.run_id}`,
    `schema=${manifest.schema}`,
    `scenes=${manifest.scenes?.length ?? 0}`,
    `transitions=${manifest.transitions?.length ?? 0}`,
    `overlays=${manifest.overlays?.length ?? 0}`,
    `duration=${manifest.duration_frames}`,
    `fps=${manifest.fps}`,
    `size=${manifest.width}x${manifest.height}`,
  ].join(', ');
}

function summarizeComposition(composition: Record<string, unknown>): string {
  const duration = composition.durationInFrames ?? composition.duration;
  const fps = composition.fps;
  const width = composition.width;
  const height = composition.height;

  return [
    `id=${composition.id ?? '(unknown)'}`,
    `duration=${typeof duration === 'number' ? duration : '(unknown)'}`,
    `fps=${typeof fps === 'number' ? fps : '(unknown)'}`,
    `size=${typeof width === 'number' && typeof height === 'number' ? `${width}x${height}` : '(unknown)'}`,
  ].join(', ');
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}

async function runStage<T>(stage: string, action: () => Promise<T>): Promise<T> {
  const started = Date.now();
  console.log(`[renderer] ${stage}: start`);
  try {
    const result = await action();
    console.log(`[renderer] ${stage}: complete (${Date.now() - started}ms)`);
    return result;
  } catch (err) {
    console.error(`[renderer] ${stage}: failed after ${Date.now() - started}ms: ${formatError(err)}`);
    throw err;
  }
}

function chromiumLaunchOptions() {
  return {
    ...(CHROME_PATH ? { browserExecutable: CHROME_PATH } : {}),
    chromiumOptions: {
      disableWebSecurity: false,
      enableMultiProcessOnLinux: true,
      headless: true,
    },
    logLevel: 'verbose' as const,
  };
}

interface BrowserLogEntry {
  text?: string;
  type?: string;
  stackTrace?: unknown;
  location?: { url?: string; lineNumber?: number; columnNumber?: number };
}

async function runSelectCompositionProbe(): Promise<void> {
  console.log('[renderer] probe: start');
  try {
    const probeBundle = await bundle({
      entryPoint: REMOTION_PROBE_ROOT,
    });
    console.log(`[renderer] probe: bundle=${probeBundle}`);
    const probeComposition = await selectComposition({
      serveUrl: probeBundle,
      id: PROBE_COMPOSITION_ID,
      inputProps: {},
      ...chromiumLaunchOptions(),
    });
    console.log(`[renderer] probe: success ${summarizeComposition(probeComposition)}`);
  } catch (err) {
    console.error(`[renderer] probe: failed ${formatError(err)}`);
  }
}

export interface RenderOptions {
  manifest: CompositionManifest;
  outputPath: string;
  /**
   * Absolute filesystem directory whose contents will be served to the
   * Remotion bundle as static assets (accessible via `staticFile(filename)`
   * inside the composition).  Typically `/data/shared/{run_id}`.  When
   * omitted the bundler defaults to `./public` relative to the entry point,
   * which will NOT contain the per-run clips — callers should always pass
   * this in production.
   */
  publicDir?: string;
  brandProfile?: BrandProfile;
  onProgress?: (progress: number) => void;
}

/**
 * Render a CompositionManifest to an MP4 file using Remotion.
 * Writes the output to outputPath.  The per-run clip directory is
 * exposed to Remotion via `publicDir` so `<Video src={staticFile(...)}>`
 * inside the composition can resolve to the right files.
 */
export async function renderComposition(options: RenderOptions): Promise<void> {
  const { manifest, outputPath, brandProfile, onProgress, publicDir } = options;

  console.log(`[renderer] Manifest summary: ${summarizeManifest(manifest)}`);
  console.log(
    `[renderer] Render options: outputPath=${outputPath}, publicDir=${publicDir ?? '(default)'}, ` +
      `brandProfile=${brandProfile ? `client_id=${brandProfile.client_id}` : '(none)'}`,
  );
  console.log(
    `[renderer] Runtime: uid=${typeof process.getuid === 'function' ? process.getuid() : 'unknown'}, ` +
      `gid=${typeof process.getgid === 'function' ? process.getgid() : 'unknown'}, ` +
      `chromePath=${CHROME_PATH ?? '(default)'}`,
  );

  // Merge brandProfile into inputProps so BrandProvider is fully populated
  const inputProps: Record<string, unknown> = {
    ...(manifest as unknown as Record<string, unknown>),
    ...(brandProfile ? { brandProfile } : {}),
  };

  console.log(`[renderer] Input props prepared: includeBrandProfile=${Boolean(brandProfile)}`);

  const bundleLocation = await runStage('bundle', () =>
    bundle({
      entryPoint: REMOTION_ROOT,
      ...(publicDir ? { publicDir } : {}),
    }),
  );
  console.log(`[renderer] Bundle location: ${bundleLocation}`);

  let composition: Record<string, unknown>;
  try {
    composition = await runStage('selectComposition', () =>
      selectComposition({
        serveUrl: bundleLocation,
        id: COMPOSITION_ID,
        inputProps,
        ...chromiumLaunchOptions(),
      }),
    );
  } catch (err) {
    await runSelectCompositionProbe();
    throw err;
  }
  console.log(`[renderer] Selected composition summary: ${summarizeComposition(composition)}`);

  console.log(
    `[renderer] Chromium options: headless=true, disableWebSecurity=false, ` +
      `enableMultiProcessOnLinux=true, serveUrl=${bundleLocation}, compositionId=${COMPOSITION_ID}, ` +
      `browserExecutable=${CHROME_PATH ?? '(default)'}`,
  );
  console.log('[renderer] Encoding mode: sequential (disallowParallelEncoding=true)');
  await runStage('renderMedia', () =>
    renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      ...(CHROME_PATH ? { browserExecutable: CHROME_PATH } : {}),
      disallowParallelEncoding: true,
      dumpBrowserLogs: true,
      logLevel: 'verbose',
      onBrowserLog: (log: BrowserLogEntry) => {
        const entry = log;
        const location = entry.location?.url
          ? ` @ ${entry.location.url}:${entry.location.lineNumber ?? 0}:${entry.location.columnNumber ?? 0}`
          : '';
        console.log(
          `[renderer][browser:${entry.type ?? 'log'}] ${entry.text ?? '(no text)'}${location}`,
        );
        if (entry.stackTrace) {
          console.log(`[renderer][browser:stack] ${JSON.stringify(entry.stackTrace)}`);
        }
      },
      onProgress: ({ progress }: { progress: number }) => {
        const pct = Math.round(progress * 100);
        console.log(`[renderer] Render progress: ${pct}%`);
        onProgress?.(pct);
      },
      chromiumOptions: {
        disableWebSecurity: false,
        enableMultiProcessOnLinux: true,
        headless: true,
      },
    }),
  );

  console.log(`[renderer] Render complete: ${outputPath}`);
}
