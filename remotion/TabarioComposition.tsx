import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  Video,
} from 'remotion';
import {
  BrandProfile,
  CompositionManifest,
  GradeType,
  ManifestOverlay,
  ManifestScene,
  ManifestTransition,
} from '../src/types';
import { TextOverlay } from '../src/manifest/schema';
import { BrandProvider } from './BrandContext';
import { KineticTitle } from './components/KineticTitle';
import { StaggerTitle } from './components/StaggerTitle';
import { LowerThird } from './components/LowerThird';
import { CaptionBar } from './components/CaptionBar';
import { LogoReveal } from './components/LogoReveal';
import { EndCard } from './components/EndCard';
import { SoftCut } from './components/SoftCut';
import { ColorWipe } from './components/ColorWipe';
import { ScalePush } from './components/ScalePush';
import { SplitHorizontal } from './components/SplitHorizontal';
import { SplitVertical } from './components/SplitVertical';
import { PictureInPicture } from './components/PictureInPicture';
import { TypographicBackground } from './components/TypographicBackground';

/**
 * Map a grade name to a CSS `filter` string applied to the scene's `<Video>`.
 * Keep the effects subtle — heavy colour shifts are best done upstream in the
 * clip generator rather than as a post-filter.
 */
export function gradeToFilter(grade?: GradeType): string | undefined {
  switch (grade) {
    case 'desaturated_cool':
      return 'saturate(0.7) contrast(1.05) hue-rotate(-10deg) brightness(0.95)';
    case 'vibrant_warm':
      return 'saturate(1.25) contrast(1.1) hue-rotate(10deg) brightness(1.05)';
    case 'high_contrast':
      return 'contrast(1.35) saturate(1.1)';
    case 'neutral':
    default:
      return undefined;
  }
}

/**
 * Convert a dB value to a linear volume multiplier (for `<Audio volume>`).
 * -12 dB → ~0.251; 0 dB → 1.0.
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Render the correct React node for a single overlay component entry.
 * Passing `sceneSrc` lets transition overlays fall back to the scene's
 * clip when the LLM omitted `fromSrc`/`toSrc` (best effort only).
 */
function renderOverlayBody(
  component: ManifestOverlay['component'],
  props: Record<string, unknown>,
  fallbackSrc?: string,
): React.ReactNode {
  const p = props;
  const fromSrc = (p.fromSrc as string | undefined) ?? fallbackSrc ?? '';
  const toSrc = (p.toSrc as string | undefined) ?? fallbackSrc ?? '';

  switch (component) {
    case 'kinetic_title':
      return <KineticTitle text={String(p.text ?? '')} color={p.color as string | undefined} />;
    case 'stagger_title':
      return <StaggerTitle text={String(p.text ?? '')} color={p.color as string | undefined} />;
    case 'lower_third':
      return (
        <LowerThird
          name={String(p.name ?? p.text ?? '')}
          subtitle={p.subtitle as string | undefined}
        />
      );
    case 'caption_bar':
      return <CaptionBar text={String(p.text ?? '')} />;
    case 'logo_reveal':
      return <LogoReveal />;
    case 'typographic_background':
      return (
        <TypographicBackground
          text={String(p.text ?? '')}
          color={p.color as string | undefined}
          backgroundColor={p.backgroundColor as string | undefined}
          animation={p.animation as 'fade' | 'slide' | 'scale' | undefined}
        />
      );
    case 'end_card':
      return (
        <EndCard
          ctaText={String(p.ctaText ?? p.text ?? '')}
          ctaUrl={p.ctaUrl as string | undefined}
          showQr={Boolean(p.showQr)}
          showLogo={p.showLogo !== false}
        />
      );
    case 'soft_cut':
      return <SoftCut fromSrc={fromSrc} toSrc={toSrc} />;
    case 'color_wipe':
      return (
        <ColorWipe
          fromSrc={fromSrc}
          toSrc={toSrc}
          accentColor={p.accentColor as string | undefined}
        />
      );
    case 'scale_push':
      return <ScalePush fromSrc={fromSrc} toSrc={toSrc} />;
    case 'split_horizontal':
      return (
        <SplitHorizontal
          leftSrc={String(p.leftSrc ?? fallbackSrc ?? '')}
          rightSrc={String(p.rightSrc ?? fallbackSrc ?? '')}
        />
      );
    case 'split_vertical':
      return (
        <SplitVertical
          topSrc={String(p.topSrc ?? fallbackSrc ?? '')}
          bottomSrc={String(p.bottomSrc ?? fallbackSrc ?? '')}
        />
      );
    case 'picture_in_picture':
      return (
        <PictureInPicture
          mainSrc={String(p.mainSrc ?? fallbackSrc ?? '')}
          overlaySrc={String(p.overlaySrc ?? '')}
        />
      );
    default:
      return null;
  }
}

interface TabarioCompositionProps extends CompositionManifest {
  brandProfile?: BrandProfile;
}

interface SceneWithStart extends ManifestScene {
  start_frame: number;
}

/**
 * Top-level composition.  Assembles scenes, scene_overlays, manifest-level
 * overlays, transitions between adjacent scenes, voiceover and music.
 */
export const TabarioComposition: React.FC<TabarioCompositionProps> = (props) => {
  const {
    scenes,
    overlays,
    transitions,
    audio_track,
    closing,
    brandProfile,
  } = props;

  // Precompute each scene's start frame (cumulative).
  let accFrame = 0;
  const sceneFrames: SceneWithStart[] = scenes.map((scene) => {
    const start = accFrame;
    accFrame += scene.duration_frames;
    return { ...scene, start_frame: start };
  });

  const voiceoverSrc = staticFile(audio_track.voiceover_filename);
  const musicUrl = audio_track.music_source?.url;
  const musicVolume = dbToLinear(audio_track.music_ducking_db ?? -12);

  const renderScene = (scene: SceneWithStart): React.ReactNode => {
    const filter = gradeToFilter(scene.grade);
    const sceneSrc = scene.clip_filename ? staticFile(scene.clip_filename) : undefined;

    return (
      <Sequence
        key={`scene-${scene.index}`}
        from={scene.start_frame}
        durationInFrames={scene.duration_frames}
      >
        {sceneSrc && (
          <Video
            src={sceneSrc}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              ...(filter ? { filter } : {}),
            }}
          />
        )}
        {/* Scene-level text overlays (TextOverlaySchema) */}
        {scene.scene_overlays?.map((ov: TextOverlay, i: number) => (
          <Sequence
            key={`scene-${scene.index}-ov-${i}`}
            from={0}
            durationInFrames={scene.duration_frames}
          >
            {renderOverlayBody(ov.component, {
              text: ov.text,
              ...(ov.props ?? {}),
            })}
          </Sequence>
        ))}
      </Sequence>
    );
  };

  const renderManifestOverlay = (overlay: ManifestOverlay, i: number): React.ReactNode => {
    const sceneSrc = (() => {
      const s = sceneFrames.find((x) => x.index === overlay.scene_index);
      return s?.clip_filename ? staticFile(s.clip_filename) : undefined;
    })();
    return (
      <Sequence
        key={`overlay-${i}`}
        from={overlay.start_frame}
        durationInFrames={overlay.duration_frames}
      >
        {renderOverlayBody(overlay.component, overlay.props, sceneSrc)}
      </Sequence>
    );
  };

  const renderTransition = (
    tr: ManifestTransition,
    i: number,
  ): React.ReactNode => {
    const [fromIdx, toIdx] = tr.between;
    const fromScene = sceneFrames.find((s) => s.index === fromIdx);
    const toScene = sceneFrames.find((s) => s.index === toIdx);
    if (!fromScene || !toScene || !fromScene.clip_filename || !toScene.clip_filename) {
      return null;
    }
    // Centre the transition on the boundary between the two scenes.
    const boundary = toScene.start_frame;
    const half = Math.floor(tr.duration_frames / 2);
    const from = Math.max(0, boundary - half);
    const fromSrc = staticFile(fromScene.clip_filename);
    const toSrc = staticFile(toScene.clip_filename);
    return (
      <Sequence
        key={`transition-${i}`}
        from={from}
        durationInFrames={tr.duration_frames}
      >
        {tr.type === 'soft_cut' && <SoftCut fromSrc={fromSrc} toSrc={toSrc} />}
        {tr.type === 'color_wipe' && (
          <ColorWipe fromSrc={fromSrc} toSrc={toSrc} accentColor={tr.accent_color} />
        )}
        {tr.type === 'scale_push' && <ScalePush fromSrc={fromSrc} toSrc={toSrc} />}
      </Sequence>
    );
  };

  return (
    <BrandProvider brand={brandProfile ?? { id: '', client_id: props.client_id }}>
      <AbsoluteFill style={{ background: '#000' }}>
        {/* Scenes */}
        {sceneFrames.map(renderScene)}

        {/* Transitions (layered on top of scenes at their boundaries) */}
        {transitions.map(renderTransition)}

        {/* Manifest-level overlays */}
        {overlays.map(renderManifestOverlay)}

        {/* Closing end card */}
        <Sequence
          from={closing.start_frame}
          durationInFrames={closing.duration_frames}
        >
          <EndCard
            ctaText={closing.cta.text}
            ctaUrl={closing.cta.url}
            showQr={closing.cta.show_qr}
            showLogo={closing.show_logo}
          />
        </Sequence>

        {/* Voiceover (full duration, at target LUFS applied later by ffmpeg) */}
        <Audio src={voiceoverSrc} />

        {/* Optional background music, ducked by music_ducking_db (linear) */}
        {musicUrl && <Audio src={musicUrl} volume={musicVolume} />}
      </AbsoluteFill>
    </BrandProvider>
  );
};
