import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import { basename } from 'path';

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'videos';

let _client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/**
 * Upload the final composed MP4 to Supabase storage.
 * Returns the public URL for the uploaded file.
 */
export async function uploadFinalVideo(filePath: string, runId: string): Promise<string> {
  const supabase = getSupabaseClient();
  const fileName = basename(filePath);
  const storagePath = `compositor/${runId}/${fileName}`;

  console.log(`[storage] Uploading ${filePath} → ${STORAGE_BUCKET}/${storagePath}`);

  const stream = createReadStream(filePath);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, stream, {
      contentType: 'video/mp4',
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

  console.log(`[storage] Upload complete: ${data.publicUrl}`);
  return data.publicUrl;
}
