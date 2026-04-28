import React from 'react';
import { useStyle } from '../../StyleContext';
import { CaptionTrack as CaptionTrackData } from '../../../src/types';
import { TikTokBold } from './styles/TikTokBold';
import { Karaoke } from './styles/Karaoke';
import { Typewriter } from './styles/Typewriter';
import { Neon } from './styles/Neon';

interface CaptionTrackProps {
  track: CaptionTrackData;
}

/**
 * Style-aware caption renderer. Dispatches to the correct animation component
 * based on the active EditStyle's caption_animation.style.
 */
export const CaptionTrack: React.FC<CaptionTrackProps> = ({ track }) => {
  const { caption_animation } = useStyle();

  switch (caption_animation.style) {
    case 'tiktok_bold':
      return <TikTokBold track={track} />;
    case 'karaoke':
      return <Karaoke track={track} />;
    case 'typewriter':
      return <Typewriter track={track} />;
    case 'neon':
      return <Neon track={track} />;
    case 'subtle_fade':
      // subtle_fade uses the same flow as karaoke but with muted palette
      return <Karaoke track={track} />;
    default:
      return <Karaoke track={track} />;
  }
};
