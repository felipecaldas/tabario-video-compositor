import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { BrandProfile } from '../src/types';
import { TimelineGraphicsClip, TimelineManifest } from '../src/timeline';
import { BrandProvider } from './BrandContext';
import { safeResolveStyle, StyleProvider } from './StyleContext';
import { CaptionTrack } from './components/captions/CaptionTrack';
import { renderOverlayBody } from './TabarioComposition';

export interface GraphicsPlateCompositionProps {
  timeline: TimelineManifest;
  clip?: TimelineGraphicsClip;
  plateType?: 'graphics_clip' | 'caption_track';
  brandProfile?: BrandProfile;
}

export const GraphicsPlateComposition: React.FC<GraphicsPlateCompositionProps> = ({
  timeline,
  clip,
  plateType = 'graphics_clip',
  brandProfile,
}) => {
  const editStyle = safeResolveStyle(timeline.style_id);

  return (
    <StyleProvider style={editStyle}>
      <BrandProvider brand={brandProfile ?? { id: '', client_id: timeline.client_id }}>
        <AbsoluteFill style={{ background: 'transparent' }}>
          {plateType === 'caption_track' && timeline.captions ? (
            <CaptionTrack track={timeline.captions} />
          ) : null}
          {plateType === 'graphics_clip' && clip ? (
            <Sequence from={0} durationInFrames={clip.duration_frames}>
              {renderOverlayBody(clip.component as Parameters<typeof renderOverlayBody>[0], clip.props)}
            </Sequence>
          ) : null}
        </AbsoluteFill>
      </BrandProvider>
    </StyleProvider>
  );
};
