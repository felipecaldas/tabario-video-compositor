import React, { createContext, useContext } from 'react';
import { EditStyle } from '../src/styles/schema';
import { DEFAULT_STYLE_ID, StyleRegistry } from '../src/styles/registry';

export const FALLBACK_STYLE: EditStyle = {
  id: DEFAULT_STYLE_ID,
  name: 'Fallback Style',
  description: 'Safe fallback style for composition discovery',
  typography: {
    heading_scale: 0.09,
    body_scale: 0.045,
    caption_scale: 0.05,
    weight_heading: 700,
    weight_body: 500,
    case: 'sentence',
    tracking: 0,
    line_height: 1.1,
  },
  caption_animation: {
    style: 'karaoke',
    active_word_color: '#ffffff',
    active_word_scale: 1.05,
    background: 'bar',
    position: 'lower_third',
    max_words_visible: 4,
  },
  transitions: {
    preferred: ['soft_cut'],
    intensity: 'standard',
    color_wipe_max: 0,
  },
  motion: {
    energy: 'medium',
    pace: 'medium',
    ken_burns_strength: 0.35,
  },
  grade: 'neutral',
  overlays: {
    density: 'standard',
    badges_max: 1,
    use_lower_third: true,
  },
};

export function safeResolveStyle(styleId?: string): EditStyle {
  try {
    return StyleRegistry.resolve(styleId ?? DEFAULT_STYLE_ID);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[remotion] Style resolution failed for style_id=${styleId ?? DEFAULT_STYLE_ID}: ${message}`);
    return FALLBACK_STYLE;
  }
}

const StyleContext = createContext<EditStyle>(FALLBACK_STYLE);

export function StyleProvider({
  style,
  children,
}: {
  style: EditStyle;
  children: React.ReactNode;
}) {
  return <StyleContext.Provider value={style}>{children}</StyleContext.Provider>;
}

export function useStyle(): EditStyle {
  return useContext(StyleContext);
}
