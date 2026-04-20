import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BrandProfile } from '../types';

export class BrandProfileNotFoundError extends Error {
  constructor(clientId: string) {
    super(`No brand profile found for client_id: ${clientId}`);
    this.name = 'BrandProfileNotFoundError';
  }
}

let _client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/**
 * Fetch and return the brand profile for a given client_id.
 * Uses the Supabase service-role key (server-side only).
 */
export async function hydrateBrandProfile(clientId: string): Promise<BrandProfile> {
  const supabase = getSupabaseClient();

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
