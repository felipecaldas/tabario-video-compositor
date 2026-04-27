import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
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
import { StyleProvider } from './StyleContext';
import { StyleRegistry, DEFAULT_STYLE_ID } from '../src/styles/registry';
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
import { CinematicBars } from './components/CinematicBars';
import { SplitHorizontal } from './components/SplitHorizontal';
import { SplitVertical } from './components/SplitVertical';
import { PictureInPicture } from './components/PictureInPicture';
import { TypographicBackground } from './components/TypographicBackground';

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
    case 'brand_accent_line':
      return <BrandAccentLine position={p.position as 'bottom' | 'top' | 'middle' | undefined} />;
    case 'motion_badge':
      return <MotionBadge text={String(p.text ?? '')} />;
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
  } = props;

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

    // Build clip element — Img for static images, Video for clips
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
        <Video
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

  const editStyle = StyleRegistry.resolve(props.style_id ?? DEFAULT_STYLE_ID);

  return (
    <StyleProvider style={editStyle}>
    <BrandProvider brand={brandProfile ?? { id: '', client_id: props.client_id }}>
      <AbsoluteFill style={{ background: '#000' }}>
        {sceneFrames.map(renderScene)}
        {transitions.map(renderTransition)}
        {overlays.map(renderManifestOverlay)}

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

        <Audio src={voiceoverSrc} />
        {musicUrl && <Audio src={musicUrl} volume={musicVolume} />}

        {/* Optional cinematic bars — only when brand profile opts in */}
        {brandProfile?.motion_style?.cinematic_bars && <CinematicBars />}
      </AbsoluteFill>
    </BrandProvider>
    </StyleProvider>
  );
};
