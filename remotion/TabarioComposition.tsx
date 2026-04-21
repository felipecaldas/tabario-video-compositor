import React from 'react';
import { AbsoluteFill, Audio, Sequence, Video, useVideoConfig } from 'remotion';
import { BrandProfile, CompositionManifest, ManifestOverlay } from '../src/types';
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

const DATA_SHARED_BASE = '/data/shared';

function resolveClipPath(runId: string, filename: string): string {
  return `${DATA_SHARED_BASE}/${runId}/${filename}`;
}

function renderOverlay(overlay: ManifestOverlay, runId: string): React.ReactNode {
  const { component, start_frame, duration_frames, props } = overlay;
  const p = props as Record<string, unknown>;

  return (
    <Sequence key={`${component}-${start_frame}`} from={start_frame} durationInFrames={duration_frames}>
      {component === 'kinetic_title' && <KineticTitle text={String(p.text ?? '')} color={p.color as string | undefined} />}
      {component === 'stagger_title' && <StaggerTitle text={String(p.text ?? '')} color={p.color as string | undefined} />}
      {component === 'lower_third' && <LowerThird name={String(p.name ?? '')} subtitle={p.subtitle as string | undefined} />}
      {component === 'caption_bar' && <CaptionBar text={String(p.text ?? '')} />}
      {component === 'logo_reveal' && <LogoReveal />}
      {component === 'soft_cut' && <SoftCut fromSrc={String(p.fromSrc ?? '')} toSrc={String(p.toSrc ?? '')} />}
      {component === 'color_wipe' && <ColorWipe fromSrc={String(p.fromSrc ?? '')} toSrc={String(p.toSrc ?? '')} accentColor={p.accentColor as string | undefined} />}
      {component === 'scale_push' && <ScalePush fromSrc={String(p.fromSrc ?? '')} toSrc={String(p.toSrc ?? '')} />}
      {component === 'split_horizontal' && <SplitHorizontal leftSrc={String(p.leftSrc ?? '')} rightSrc={String(p.rightSrc ?? '')} />}
      {component === 'split_vertical' && <SplitVertical topSrc={String(p.topSrc ?? '')} bottomSrc={String(p.bottomSrc ?? '')} />}
      {component === 'picture_in_picture' && <PictureInPicture mainSrc={String(p.mainSrc ?? '')} overlaySrc={String(p.overlaySrc ?? '')} />}
    </Sequence>
  );
}

interface TabarioCompositionProps extends CompositionManifest {
  brandProfile?: BrandProfile;
}

export const TabarioComposition: React.FC<TabarioCompositionProps> = (props) => {
  const { durationInFrames } = useVideoConfig();
  const { scenes, overlays, audio_track, closing, run_id, brandProfile } = props;

  if (brandProfile) {
    console.log(`[remotion] BrandProvider initialised for client_id=${brandProfile.client_id}`);
  }

  // Accumulate scene start frames
  let accFrame = 0;
  const sceneFrames = scenes.map((scene) => {
    const start = accFrame;
    accFrame += scene.duration_frames;
    return { ...scene, start_frame: start };
  });

  const voiceoverPath = resolveClipPath(run_id, audio_track.voiceover_filename);

  return (
    <BrandProvider brand={brandProfile ?? { id: '', client_id: props.client_id }}>
      <AbsoluteFill style={{ background: '#000' }}>
        {/* Scenes */}
        {sceneFrames.map((scene) => (
          <Sequence key={scene.index} from={scene.start_frame} durationInFrames={scene.duration_frames}>
            <Video
              src={resolveClipPath(run_id, scene.clip_filename)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Sequence>
        ))}

        {/* Overlays */}
        {overlays.map((overlay) => renderOverlay(overlay, run_id))}

        {/* Closing end card */}
        <Sequence from={closing.start_frame} durationInFrames={closing.duration_frames}>
          <EndCard
            ctaText={closing.cta.text}
            ctaUrl={closing.cta.url}
            showQr={closing.cta.show_qr}
            showLogo={closing.show_logo}
          />
        </Sequence>

        {/* Voiceover audio */}
        <Audio src={voiceoverPath} />
      </AbsoluteFill>
    </BrandProvider>
  );
};
