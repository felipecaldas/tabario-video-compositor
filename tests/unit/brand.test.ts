jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('hydrateBrandProfile', () => {
  let hydrateBrandProfile: (
    clientId: string,
    userAccessToken: string,
  ) => Promise<unknown>;
  let BrandProfileNotFoundError: new (clientId: string) => Error;
  let createClient: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    const mod = require('../../src/brand/hydrator');
    hydrateBrandProfile = mod.hydrateBrandProfile;
    BrandProfileNotFoundError = mod.BrandProfileNotFoundError;
    createClient = require('@supabase/supabase-js').createClient;
  });

  function setupClient(data: Record<string, unknown> | null, error: Error | null = null) {
    const single = jest.fn().mockResolvedValue({ data, error });
    const eq = jest.fn().mockReturnValue({ single });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    const client = { from };
    createClient.mockReturnValue(client);
    return { client, from, select, eq, single };
  }

  it('returns a typed BrandProfile when Supabase returns a row', async () => {
    const mockRow = {
      id: 'bp-1',
      client_id: 'client-1',
      tone_of_voice: 'professional',
      brand_colors: { primary: '#ffffff', accent: '#3B82F6' },
      logo_primary_url: 'https://example.com/logo.png',
      logo_safe_zone_ratio: 0.15,
      heading_font_url: 'https://cdn/hd.woff2',
      body_font_url: 'https://cdn/bd.woff2',
      title_case: 'upper',
      audio_targets: { voiceover_lufs: -16, music_ducking_db: -12 },
      motion_style: { energy: 'high' },
      cta_defaults: { url: 'https://tabario.com' },
      brand_keywords: ['minimal', 'clean'],
      target_platforms: ['tiktok'],
      do_list: ['Use accent'],
      dont_list: ['Use neon'],
      audience_description: 'founders',
      logo_inverse_url: 'https://example.com/inv.png',
    };

    setupClient(mockRow);

    const profile = (await hydrateBrandProfile(
      'client-1',
      'user-jwt-token',
    )) as Record<string, unknown>;

    expect(profile.id).toBe('bp-1');
    expect(profile.client_id).toBe('client-1');
    expect((profile.brand_colors as Record<string, string>)?.primary).toBe('#ffffff');
    expect(profile.logo_primary_url).toBe('https://example.com/logo.png');
    expect((profile.audio_targets as Record<string, number>)?.voiceover_lufs).toBe(-16);
    expect(profile.title_case).toBe('upper');
    expect(profile.heading_font_url).toBe('https://cdn/hd.woff2');
  });

  it('forwards user JWT via Authorization header to Supabase client', async () => {
    setupClient({ id: 'x', client_id: 'c' });
    await hydrateBrandProfile('c', 'jwt-abc');
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        global: expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer jwt-abc' }),
        }),
      }),
    );
  });

  it('throws BrandProfileNotFoundError when Supabase returns error', async () => {
    setupClient(null, { message: 'not found' } as Error);
    await expect(hydrateBrandProfile('missing', 'jwt')).rejects.toThrow(
      BrandProfileNotFoundError,
    );
    await expect(hydrateBrandProfile('missing', 'jwt')).rejects.toThrow('missing');
  });

  it('throws BrandProfileNotFoundError when Supabase returns null data with no error', async () => {
    setupClient(null, null);
    await expect(hydrateBrandProfile('empty', 'jwt')).rejects.toThrow(
      BrandProfileNotFoundError,
    );
  });

  it('throws when SUPABASE_URL not set', async () => {
    jest.resetModules();
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = 'x';
    const mod = require('../../src/brand/hydrator');
    await expect(mod.hydrateBrandProfile('c', 'jwt')).rejects.toThrow(/SUPABASE_URL/);
  });

  it('throws when SUPABASE_ANON_KEY not set', async () => {
    jest.resetModules();
    process.env.SUPABASE_URL = 'https://x';
    delete process.env.SUPABASE_ANON_KEY;
    const mod = require('../../src/brand/hydrator');
    await expect(mod.hydrateBrandProfile('c', 'jwt')).rejects.toThrow(/SUPABASE_ANON_KEY/);
  });

  it('defaults optional columns to undefined when null', async () => {
    setupClient({
      id: 'bp-2',
      client_id: 'client-2',
      tone_of_voice: null,
      brand_colors: null,
      logo_primary_url: null,
      heading_font_url: null,
      audio_targets: null,
    });
    const p = (await hydrateBrandProfile('client-2', 'jwt')) as Record<string, unknown>;
    expect(p.id).toBe('bp-2');
    expect(p.tone_of_voice).toBeUndefined();
    expect(p.brand_colors).toBeUndefined();
    expect(p.logo_primary_url).toBeUndefined();
    expect(p.heading_font_url).toBeUndefined();
  });
});
