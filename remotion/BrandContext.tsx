import React, { createContext, useContext } from 'react';
import { BrandProfile, BrandColors } from '../src/types';
import {
  BODY_FAMILY,
  HEADING_FAMILY,
  fontFamilyOrFallback,
  useBrandFontLoader,
} from './fonts';

interface BrandContextValue {
  colors: BrandColors;
  logoPrimaryUrl?: string;
  logoInverseUrl?: string;
  logoSafeZoneRatio: number;
  headingFontUrl?: string;
  bodyFontUrl?: string;
  /**
   * Ready-to-use CSS `font-family` values.  These always include a
   * sans-serif fallback stack so components render cleanly even before
   * the branded font resolves (or when no URL is configured).
   */
  headingFamily: string;
  bodyFamily: string;
  titleCase: 'sentence' | 'upper' | 'title';
}

const DEFAULT_COLORS: BrandColors = {
  primary: '#ffffff',
  secondary: '#000000',
  accent: '#3B82F6',
  muted: '#6B7280',
  background: '#000000',
};

const DEFAULT_FONT_STACK = fontFamilyOrFallback(HEADING_FAMILY, false);

const BrandContext = createContext<BrandContextValue>({
  colors: DEFAULT_COLORS,
  logoSafeZoneRatio: 0.15,
  headingFamily: DEFAULT_FONT_STACK,
  bodyFamily: DEFAULT_FONT_STACK,
  titleCase: 'sentence',
});

export function BrandProvider({
  brand,
  children,
}: {
  brand: BrandProfile;
  children: React.ReactNode;
}) {
  // Kick off font loading — blocks render via delayRender until resolved.
  useBrandFontLoader({
    headingFontUrl: brand.heading_font_url,
    bodyFontUrl: brand.body_font_url,
  });

  const value: BrandContextValue = {
    colors: { ...DEFAULT_COLORS, ...brand.brand_colors },
    logoPrimaryUrl: brand.logo_primary_url,
    logoInverseUrl: brand.logo_inverse_url,
    logoSafeZoneRatio: brand.logo_safe_zone_ratio ?? 0.15,
    headingFontUrl: brand.heading_font_url,
    bodyFontUrl: brand.body_font_url,
    headingFamily: fontFamilyOrFallback(HEADING_FAMILY, Boolean(brand.heading_font_url)),
    bodyFamily: fontFamilyOrFallback(BODY_FAMILY, Boolean(brand.body_font_url)),
    titleCase: brand.title_case ?? 'sentence',
  };

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  return useContext(BrandContext);
}
