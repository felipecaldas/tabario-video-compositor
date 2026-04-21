import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BrandProfile } from '../types';

export class BrandProfileNotFoundError extends Error {
  constructor(clientId: string) {
    super(`No brand profile found for client_id: ${clientId}`);
    this.name = 'BrandProfileNotFoundError';
  }
}

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL must be set');
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error('SUPABASE_ANON_KEY must be set');
  return key;
}

/**
 * Create a per-request Supabase client that attaches the user's JWT
 * via the Authorization header so RLS policies apply under the user's identity.
 */
function createUserClient(userAccessToken: string): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    },
  });
}

/**
 * Fetch and return the brand profile for a given client_id.
 * Uses the anon key + the forwarded user JWT so RLS applies under the user's identity.
 */
export async function hydrateBrandProfile(clientId: string, userAccessToken: string): Promise<BrandProfile> {
  console.log(`[hydrator] Fetching brand profile for client_id=${clientId}`);
  const supabase = createUserClient(userAccessToken);

  const { data, error } = await supabase
    .from('brand_profiles')
    .select('*')
    .eq('client_id', clientId)
    .single();

  if (error || !data) {
    throw new BrandProfileNotFoundError(clientId);
  }

  return {
    id: data.id,
    client_id: data.client_id,
    tone_of_voice: data.tone_of_voice ?? undefined,
    brand_keywords: data.brand_keywords ?? undefined,
    target_platforms: data.target_platforms ?? undefined,
    brand_colors: data.brand_colors ?? undefined,
    do_list: data.do_list ?? undefined,
    dont_list: data.dont_list ?? undefined,
    audience_description: data.audience_description ?? undefined,
    logo_primary_url: data.logo_primary_url ?? undefined,
    logo_inverse_url: data.logo_inverse_url ?? undefined,
    logo_safe_zone_ratio: data.logo_safe_zone_ratio ?? undefined,
    heading_font_url: data.heading_font_url ?? undefined,
    body_font_url: data.body_font_url ?? undefined,
    title_case: data.title_case ?? undefined,
    motion_style: data.motion_style ?? undefined,
    audio_targets: data.audio_targets ?? undefined,
    cta_defaults: data.cta_defaults ?? undefined,
  };
}
