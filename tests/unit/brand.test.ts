jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('hydrateBrandProfile', () => {
  let hydrateBrandProfile: (clientId: string) => Promise<unknown>;
  let BrandProfileNotFoundError: new (clientId: string) => Error;
  let createClient: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    // Re-require after resetModules so the singleton _client is cleared
    const mod = require('../../src/brand/hydrator');
    hydrateBrandProfile = mod.hydrateBrandProfile;
    BrandProfileNotFoundError = mod.BrandProfileNotFoundError;
    createClient = require('@supabase/supabase-js').createClient;
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

    const profile = await hydrateBrandProfile('client-1') as Record<string, unknown>;
    expect(profile.id).toBe('bp-1');
    expect(profile.client_id).toBe('client-1');
    expect((profile.brand_colors as Record<string, string>)?.primary).toBe('#ffffff');
    expect(profile.logo_primary_url).toBe('https://example.com/logo.png');
    expect((profile.audio_targets as Record<string, number>)?.voiceover_lufs).toBe(-16);
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
