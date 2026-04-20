import React, { createContext, useContext } from 'react';
import { BrandProfile, BrandColors } from '../src/types';

interface BrandContextValue {
  colors: BrandColors;
  logoPrimaryUrl?: string;
  logoInverseUrl?: string;
  logoSafeZoneRatio: number;
  headingFontUrl?: string;
  bodyFontUrl?: string;
  titleCase: 'sentence' | 'upper' | 'title';
}

const DEFAULT_COLORS: BrandColors = {
  primary: '#ffffff',
  secondary: '#000000',
  accent: '#3B82F6',
  muted: '#6B7280',
  background: '#000000',
};

const BrandContext = createContext<BrandContextValue>({
  colors: DEFAULT_COLORS,
  logoSafeZoneRatio: 0.15,
  titleCase: 'sentence',
});

export function BrandProvider({
  brand,
  children,
}: {
  brand: BrandProfile;
  children: React.ReactNode;
}) {
  const value: BrandContextValue = {
    colors: { ...DEFAULT_COLORS, ...brand.brand_colors },
    logoPrimaryUrl: brand.logo_primary_url,
    logoInverseUrl: brand.logo_inverse_url,
    logoSafeZoneRatio: brand.logo_safe_zone_ratio ?? 0.15,
    headingFontUrl: brand.heading_font_url,
    bodyFontUrl: brand.body_font_url,
    titleCase: brand.title_case ?? 'sentence',
  };

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  return useContext(BrandContext);
}
