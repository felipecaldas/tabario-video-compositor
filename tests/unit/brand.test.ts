import { hydrateBrandProfile, BrandProfileNotFoundError } from '../../src/brand/hydrator';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  })),
}));

const { createClient } = require('@supabase/supabase-js');

describe('hydrateBrandProfile', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    jest.clearAllMocks();
  });

  it('returns typed BrandProfile on success', async () => {
    const mockRow = {
      id: 'bp-1',
      client_id: 'client-1',
      tone_of_voice: 'professional',
      brand_colors: { primary: '#ffffff', accent: '#3B82F6' },
      logo_primary_url: 'https://example.com/logo.png',
      logo_safe_zone_ratio: 0.15,
      audio_targets: { voiceover_lufs: -16, music_ducking_db: -12 },
    };

    createClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: mockRow, error: null }),
          }),
        }),
      }),
    });

    const profile = await hydrateBrandProfile('client-1');
    expect(profile.id).toBe('bp-1');
    expect(profile.client_id).toBe('client-1');
    expect(profile.brand_colors?.primary).toBe('#ffffff');
    expect(profile.logo_primary_url).toBe('https://example.com/logo.png');
    expect(profile.audio_targets?.voiceover_lufs).toBe(-16);
  });

  it('throws BrandProfileNotFoundError when no row found', async () => {
    createClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
          }),
        }),
      }),
    });

    await expect(hydrateBrandProfile('missing-client')).rejects.toThrow(BrandProfileNotFoundError);
    await expect(hydrateBrandProfile('missing-client')).rejects.toThrow('missing-client');
  });
});
