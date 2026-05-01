import { BrandProfile, Brief, CompositionManifest, ManifestOverlay, ManifestScene } from '../types';

export interface EngagementSceneReport {
  index: number;
  role: string;
  duration_frames: number;
  duration_seconds: number;
  overlay_count: number;
}

export interface EngagementValidationReport {
  use_case: string;
  normalized: boolean;
  valid: boolean;
  issues: string[];
  cta_text: string | null;
  total_duration_seconds: number;
  transition_types: string[];
  scenes: EngagementSceneReport[];
}

const CTA_FALLBACKS = ['Shop Now', 'Try Free Today', 'Book a Call', 'Download Now'] as const;
const PASSIVE_CTA_PATTERNS = [/learn more/i, /find out more/i, /discover more/i];

const ROLE_CAP_SECONDS: Record<string, number> = {
  hook: 1.5,
  problem: 3,
  solution: 5,
  proof: 2.5,
  outcome: 4,
  cta: 3,
};

function buildSceneRoles(sceneCount: number): string[] {
  if (sceneCount < 5) {
    return Array.from({ length: sceneCount }, () => 'content');
  }

  if (sceneCount === 5) {
    return ['hook', 'problem', 'solution', 'outcome', 'cta'];
  }

  const proofCount = Math.min(3, Math.max(1, sceneCount - 5));
  const roles = ['hook', 'problem', 'solution'];
  for (let index = 0; index < proofCount; index += 1) {
    roles.push('proof');
  }
  roles.push('outcome', 'cta');
  return roles;
}

function imperativeCtaText(brief: Brief, manifest: CompositionManifest): string {
  const candidates = [
    brief.call_to_action,
    manifest.closing?.cta.text,
    ...manifest.overlays
      .filter((overlay) => overlay.component === 'kinetic_title')
      .map((overlay) => String(overlay.props.text ?? '')),
  ].filter((value): value is string => Boolean(value && value.trim()));

  const existing = candidates.find((candidate) => !PASSIVE_CTA_PATTERNS.some((pattern) => pattern.test(candidate)));
  if (existing) {
    return existing.trim();
  }

  return CTA_FALLBACKS[0];
}

function proofMetricText(scene: ManifestScene, index: number): { metric: string; label: string } {
  const source = scene.scene_overlays?.[0]?.text?.trim();
  if (source) {
    return { metric: source.toUpperCase(), label: 'Real customer proof' };
  }

  const defaults = [
    { metric: 'REAL RESULTS', label: 'Customer-backed proof' },
    { metric: '5-STAR REVIEWS', label: 'Social proof' },
    { metric: 'TRUSTED DAILY', label: 'Proven outcome' },
  ];
  return defaults[index % defaults.length];
}

function sceneStartFrames(scenes: ManifestScene[]): Map<number, number> {
  const starts = new Map<number, number>();
  let cursor = 0;
  scenes.forEach((scene) => {
    starts.set(scene.index, cursor);
    cursor += scene.duration_frames;
  });
  return starts;
}

function buildProofOverlay(
  scene: ManifestScene,
  startFrame: number,
  metric: string,
  label: string,
): ManifestOverlay {
  return {
    component: 'metric_callout',
    scene_index: scene.index,
    start_frame: startFrame,
    duration_frames: scene.duration_frames,
    props: {
      metric,
      label,
      color: '#FFFFFF',
    },
  };
}

function buildCtaOverlay(scene: ManifestScene, startFrame: number, text: string): ManifestOverlay {
  return {
    component: 'kinetic_title',
    scene_index: scene.index,
    start_frame: startFrame,
    duration_frames: scene.duration_frames,
    props: {
      text,
      color: '#FFFFFF',
    },
  };
}

export function normalizeAdManifest(
  manifest: CompositionManifest,
  brief: Brief,
  brandProfile: BrandProfile,
): { manifest: CompositionManifest; report: EngagementValidationReport } {
  if (manifest.use_case !== 'ad') {
    return {
      manifest,
      report: {
        use_case: manifest.use_case ?? 'unknown',
        normalized: false,
        valid: true,
        issues: [],
        cta_text: manifest.closing?.cta.text ?? null,
        total_duration_seconds: manifest.duration_frames / manifest.fps,
        transition_types: manifest.transitions.map((transition) => transition.type),
        scenes: manifest.scenes.map((scene) => ({
          index: scene.index,
          role: 'content',
          duration_frames: scene.duration_frames,
          duration_seconds: scene.duration_frames / manifest.fps,
          overlay_count: (scene.scene_overlays?.length ?? 0) + manifest.overlays.filter((overlay) => overlay.scene_index === scene.index).length,
        })),
      },
    };
  }

  const issues: string[] = [];
  const normalizedScenes = manifest.scenes.slice(0, 8).map((scene) => ({
    ...scene,
    scene_overlays: scene.scene_overlays ? [...scene.scene_overlays] : undefined,
  }));
  if (manifest.scenes.length > normalizedScenes.length) {
    issues.push(`trimmed_scenes:${manifest.scenes.length - normalizedScenes.length}`);
  }

  const roles = buildSceneRoles(normalizedScenes.length);
  if (normalizedScenes.length < 5) {
    issues.push('too_few_scenes_for_ad_arc');
  }
  if (!roles.includes('proof')) {
    issues.push('missing_proof_scene');
  }

  const normalizedCta = imperativeCtaText(brief, manifest);
  const managedSceneIndexes = new Set<number>();

  normalizedScenes.forEach((scene, roleIndex) => {
    const role = roles[roleIndex] ?? 'content';
    const cappedFrames = ROLE_CAP_SECONDS[role]
      ? Math.min(scene.duration_frames, Math.max(1, Math.round(ROLE_CAP_SECONDS[role] * manifest.fps)))
      : scene.duration_frames;
    scene.duration_frames = cappedFrames;

    if (role === 'outcome') {
      scene.scene_overlays = [];
      managedSceneIndexes.add(scene.index);
      return;
    }

    if (role === 'proof') {
      scene.scene_overlays = [];
      managedSceneIndexes.add(scene.index);
      return;
    }

    if (role === 'cta') {
      managedSceneIndexes.add(scene.index);
    }
  });

  const starts = sceneStartFrames(normalizedScenes);
  const overlays: ManifestOverlay[] = normalizedScenes.flatMap((scene, index) => {
    const role = roles[index] ?? 'content';
    if (role === 'proof') {
      const { metric, label } = proofMetricText(scene, index);
      return [buildProofOverlay(scene, starts.get(scene.index) ?? 0, metric, label)];
    }
    if (role === 'cta') {
      return [buildCtaOverlay(scene, starts.get(scene.index) ?? 0, normalizedCta)];
    }
    return [];
  });

  const sceneDurationsTotal = normalizedScenes.reduce((sum, scene) => sum + scene.duration_frames, 0);
  const closingDuration = manifest.closing?.duration_frames ?? Math.round(2 * manifest.fps);
  const totalDurationFrames = sceneDurationsTotal + closingDuration;
  const accentColor = brandProfile.brand_colors?.accent;

  const transitions = roles.length >= 5
    ? roles
      .map((_role, index) => index)
      .slice(0, roles.length - 1)
      .map((index) => {
        const fromScene = normalizedScenes[index];
        const toScene = normalizedScenes[index + 1];
        const boundary = `${roles[index]}->${roles[index + 1]}`;
        switch (boundary) {
          case 'hook->problem':
            return { between: [fromScene.index, toScene.index] as [number, number], type: 'scale_push' as const, duration_frames: 12 };
          case 'problem->solution':
            return { between: [fromScene.index, toScene.index] as [number, number], type: 'color_wipe' as const, duration_frames: 12, accent_color: accentColor };
          case 'solution->proof':
          case 'proof->proof':
            return { between: [fromScene.index, toScene.index] as [number, number], type: 'slide_push' as const, duration_frames: 12, direction: 'left' as const };
          case 'proof->outcome':
            return { between: [fromScene.index, toScene.index] as [number, number], type: 'soft_cut' as const, duration_frames: 10 };
          case 'outcome->cta':
            return { between: [fromScene.index, toScene.index] as [number, number], type: 'zoom_blur' as const, duration_frames: 12 };
          default:
            return { between: [fromScene.index, toScene.index] as [number, number], type: 'soft_cut' as const, duration_frames: 10 };
        }
      })
    : manifest.transitions;

  const preservedOverlays = manifest.overlays.filter((overlay) => {
    if (managedSceneIndexes.has(overlay.scene_index)) {
      return false;
    }
    return overlay.component === 'lower_third' || overlay.component === 'logo_reveal';
  });

  const closing = {
    component: 'end_card' as const,
    cta: {
      text: normalizedCta,
      url: manifest.closing?.cta.url ?? undefined,
      show_qr: manifest.closing?.cta.show_qr ?? brandProfile.cta_defaults?.show_qr ?? false,
    },
    show_logo: manifest.closing?.show_logo ?? true,
    start_frame: sceneDurationsTotal,
    duration_frames: closingDuration,
  };

  const normalizedManifest: CompositionManifest = {
    ...manifest,
    scenes: normalizedScenes,
    overlays: [...preservedOverlays, ...overlays],
    transitions,
    closing,
    duration_frames: totalDurationFrames,
  };

  if (PASSIVE_CTA_PATTERNS.some((pattern) => pattern.test(normalizedCta))) {
    issues.push('passive_cta_text');
  }
  if (transitions.filter((transition) => transition.type === 'color_wipe').length !== 1) {
    issues.push('invalid_color_wipe_count');
  }
  if (normalizedManifest.duration_frames / normalizedManifest.fps > 30) {
    issues.push('duration_exceeds_30s');
  }

  return {
    manifest: normalizedManifest,
    report: {
      use_case: 'ad',
      normalized: true,
      valid: issues.length === 0,
      issues,
      cta_text: normalizedCta,
      total_duration_seconds: normalizedManifest.duration_frames / normalizedManifest.fps,
      transition_types: normalizedManifest.transitions.map((transition) => transition.type),
      scenes: normalizedScenes.map((scene, index) => ({
        index: scene.index,
        role: roles[index] ?? 'content',
        duration_frames: scene.duration_frames,
        duration_seconds: scene.duration_frames / normalizedManifest.fps,
        overlay_count:
          (scene.scene_overlays?.length ?? 0) +
          normalizedManifest.overlays.filter((overlay) => overlay.scene_index === scene.index).length,
      })),
    },
  };
}
