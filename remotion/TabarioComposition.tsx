import React, { useEffect } from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  staticFile,
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
import { safeResolveStyle, StyleProvider } from './StyleContext';
import { KineticTitle } from './components/KineticTitle';
import { StaggerTitle } from './components/StaggerTitle';
import { LowerThird } from './components/LowerThird';
import { CaptionBar } from './components/CaptionBar';
import { LogoReveal } from './components/LogoReveal';
import { EndCard } from './components/EndCard';
import { SoftCut } from './components/SoftCut';
import { ColorWipe } from './components/ColorWipe';
import { ScalePush } from './components/ScalePush';
import { SlideTransition } from './components/SlideTransition';
import { ZoomBlur } from './components/ZoomBlur';
import { KenBurns } from './components/KenBurns';
import { TalkingHeadScene } from './components/TalkingHeadScene';
import { BrandAccentLine } from './components/BrandAccentLine';
import { MotionBadge } from './components/MotionBadge';
import { MetricCallout } from './components/MetricCallout';
import { CinematicBars } from './components/CinematicBars';
import { CaptionTrack } from './components/captions/CaptionTrack';
import { SplitHorizontal } from './components/SplitHorizontal';
import { SplitVertical } from './components/SplitVertical';
import { PictureInPicture } from './components/PictureInPicture';
import { TypographicBackground } from './components/TypographicBackground';
import { FrameAccurateVideo } from './components/FrameAccurateVideo';

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

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function isImageFile(filename?: string): boolean {
  return /\.(png|jpg|jpeg|webp|gif|avif)$/i.test(filename ?? '');
}

function nestedCta(props: Record<string, unknown>): Record<string, unknown> | undefined {
  return typeof props.cta === 'object' && props.cta !== null
    ? props.cta as Record<string, unknown>
    : undefined;
}

function nestedCtaText(props: Record<string, unknown>): string | undefined {
  return nestedCta(props)?.text as string | undefined;
}

function nestedCtaUrl(props: Record<string, unknown>): string | undefined {
  return nestedCta(props)?.url as string | undefined;
}

function nestedCtaShowQr(props: Record<string, unknown>): boolean | undefined {
  return nestedCta(props)?.show_qr as boolean | undefined;
}

export function renderOverlayBody(
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
          ctaText={String(p.ctaText ?? p.text ?? nestedCtaText(p) ?? '')}
          ctaUrl={(p.ctaUrl as string | undefined) ?? nestedCtaUrl(p)}
          showQr={Boolean(p.showQr ?? nestedCtaShowQr(p))}
          showLogo={p.showLogo !== false}
        />
      );
    case 'brand_accent_line':
      return <BrandAccentLine position={p.position as 'bottom' | 'top' | 'middle' | undefined} />;
    case 'motion_badge':
      return <MotionBadge text={String(p.text ?? '')} />;
    case 'metric_callout':
      return (
        <MetricCallout
          metric={String(p.metric ?? p.text ?? '')}
          label={String(p.label ?? '')}
          color={p.color as string | undefined}
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

export const TabarioComposition: React.FC<TabarioCompositionProps> = (props) => {
  const {
    scenes,
    overlays,
    transitions,
    audio_track,
    closing,
    brandProfile,
    caption_track,
  } = props;

  // Defensive checks to prevent "Cannot read properties of undefined (reading 'map')"
  const safeScenes = scenes ?? [];
  const safeTransitions = transitions ?? [];
  const safeOverlays = overlays ?? [];
  const firstSceneClip = safeScenes[0]?.clip_filename;
  const hasCaptionTrack = Boolean(caption_track);
  const safeAudioTrack = audio_track ?? {
    voiceover_filename: '',
    lufs_target: -16,
    music_ducking_db: -12,
  };
  const safeClosing = closing ?? {
    component: 'end_card' as const,
    cta: { text: '' },
    show_logo: false,
    start_frame: Math.max(0, props.duration_frames ?? 300),
    duration_frames: 0,
  };

  useEffect(() => {
    console.log(
      `[remotion] TabarioComposition mounted: run_id=${props.run_id}, scenes=${safeScenes.length}, ` +
        `transitions=${safeTransitions.length}, overlays=${safeOverlays.length}, ` +
        `duration=${props.duration_frames}, fps=${props.fps}, size=${props.width}x${props.height}, ` +
        `caption_track=${hasCaptionTrack}, first_clip=${firstSceneClip ?? '(none)'}`,
    );
  }, [
    props.run_id,
    props.duration_frames,
    props.fps,
    props.width,
    props.height,
    hasCaptionTrack,
    safeScenes.length,
    firstSceneClip,
    safeTransitions.length,
    safeOverlays.length,
  ]);

  let accFrame = 0;
  const sceneFrames: SceneWithStart[] = safeScenes.map((scene) => {
    const start = accFrame;
    accFrame += scene.duration_frames;
    return { ...scene, start_frame: start };
  });

  const voiceoverSrc = safeAudioTrack.voiceover_filename
    ? staticFile(safeAudioTrack.voiceover_filename)
    : null;
  const musicUrl = safeAudioTrack.music_source?.url;
  const musicVolume = dbToLinear(safeAudioTrack.music_ducking_db ?? -12);
  const firstSceneSrc = firstSceneClip ? staticFile(firstSceneClip) : null;
  const firstTransition = safeTransitions[0];
  const firstTransitionSources = (() => {
    if (!firstTransition) {
      return null;
    }
    const [fromIdx, toIdx] = firstTransition.between;
    const fromScene = sceneFrames.find((s) => s.index === fromIdx);
    const toScene = sceneFrames.find((s) => s.index === toIdx);
    if (!fromScene?.clip_filename || !toScene?.clip_filename) {
      return null;
    }
    return {
      type: firstTransition.type,
      fromSrc: staticFile(fromScene.clip_filename),
      toSrc: staticFile(toScene.clip_filename),
    };
  })();

  useEffect(() => {
    console.log(
      `[remotion] Media sources: firstSceneSrc=${firstSceneSrc ?? '(none)'}, ` +
        `voiceoverSrc=${voiceoverSrc ?? '(none)'}, musicUrl=${musicUrl ?? '(none)'}`,
    );
    if (firstTransitionSources) {
      console.log(
        `[remotion] First transition: type=${firstTransitionSources.type}, ` +
          `fromSrc=${firstTransitionSources.fromSrc}, toSrc=${firstTransitionSources.toSrc}`,
      );
    }
  }, [firstSceneSrc, voiceoverSrc, musicUrl, firstTransitionSources]);

  const renderScene = (scene: SceneWithStart): React.ReactNode => {
    const filter = gradeToFilter(scene.grade);
    const sceneSrc = scene.clip_filename ? staticFile(scene.clip_filename) : undefined;
    const isImage = isImageFile(scene.clip_filename);
    const useKenBurns = isImage && scene.motion !== 'static';

    // Text budget gating: suppress heavy text overlays when the source image is already text-heavy
    const density = scene.image_text_density ?? 'none';
    const allowKinetic = density === 'none' || density === 'low';
    const allowAnyOverlay = density !== 'high';
    const filteredOverlays = (scene.scene_overlays ?? []).filter((ov: TextOverlay) => {
      if (!allowAnyOverlay) return false;
      if (!allowKinetic && (ov.component === 'kinetic_title' || ov.component === 'stagger_title')) return false;
      return true;
    });

    // Build clip element — Img for static images, OffthreadVideo for clips.
    const clipElement = sceneSrc ? (
      isImage ? (
        <Img
          src={sceneSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            ...(filter ? { filter } : {}),
          }}
        />
      ) : (
        <FrameAccurateVideo
          src={sceneSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            ...(filter ? { filter } : {}),
          }}
        />
      )
    ) : null;

    const wrappedClip =
      useKenBurns && clipElement ? <KenBurns>{clipElement}</KenBurns> : clipElement;

    return (
      <Sequence
        key={`scene-${scene.index}`}
        from={scene.start_frame}
        durationInFrames={scene.duration_frames}
      >
        {/* Talking head layout overrides default clip rendering */}
        {scene.talking_head_layout && sceneSrc ? (
          <TalkingHeadScene src={sceneSrc} variant={scene.talking_head_layout} />
        ) : (
          wrappedClip
        )}
        {/* Scene-level text overlays (gated by text budget) */}
        {filteredOverlays.map((ov: TextOverlay, i: number) => (
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
        {tr.type === 'slide_push' && (
          <SlideTransition fromSrc={fromSrc} toSrc={toSrc} direction={tr.direction ?? 'left'} />
        )}
        {tr.type === 'zoom_blur' && <ZoomBlur fromSrc={fromSrc} toSrc={toSrc} />}
        {/* 'slide' is a deprecated alias for slide_push left */}
        {tr.type === 'slide' && (
          <SlideTransition fromSrc={fromSrc} toSrc={toSrc} direction="left" />
        )}
      </Sequence>
    );
  };

  const editStyle = safeResolveStyle(props.style_id);

  return (
    <StyleProvider style={editStyle}>
    <BrandProvider brand={brandProfile ?? { id: '', client_id: props.client_id }}>
      <AbsoluteFill style={{ background: '#000' }}>
        {sceneFrames.map(renderScene)}
        {safeTransitions.map(renderTransition)}
        {safeOverlays.map(renderManifestOverlay)}

        {safeClosing.duration_frames > 0 && (
          <Sequence
            from={safeClosing.start_frame}
            durationInFrames={safeClosing.duration_frames}
          >
            <EndCard
              ctaText={safeClosing.cta.text}
              ctaUrl={safeClosing.cta.url}
              showQr={safeClosing.cta.show_qr}
              showLogo={safeClosing.show_logo}
            />
          </Sequence>
        )}

        {voiceoverSrc && <Audio src={voiceoverSrc} />}
        {musicUrl && <Audio src={musicUrl} volume={musicVolume} />}

        {/* Optional cinematic bars — only when brand profile opts in */}
        {brandProfile?.motion_style?.cinematic_bars && <CinematicBars />}

        {/* Word-level captions — only rendered when the manifest includes a caption_track */}
        {caption_track && <CaptionTrack track={caption_track} />}
      </AbsoluteFill>
    </BrandProvider>
    </StyleProvider>
  );
};
