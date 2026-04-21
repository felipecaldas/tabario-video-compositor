// ─── Handoff payload from edit-videos ────────────────────────────────────────

export interface HandoffPayload {
  run_id: string;
  client_id: string;
  brief: Brief;
  platform: Platform;
  voiceover_path: string;
  clip_paths: string[];
  video_format: string;
  target_resolution: string;
  video_idea_id?: string;
  workflow_id?: string;
  user_access_token: string;
}

export type Platform = 'yt_shorts' | 'tiktok' | 'instagram' | 'x' | string;

export interface Brief {
  hook?: string;
  narrative_structure?: string;
  script?: string;
  summary?: string;
  caption?: string;
  title?: string;
  tone?: string;
  call_to_action?: string;
  platform_notes?: string;
  aspect_ratio?: string;
  scenes?: BriefScene[];
  platform_briefs?: PlatformBriefModel[];
}

export interface SceneBriefInput {
  scene_number: number;
  spoken_line: string;
  caption_text: string;
  duration_seconds: number;
  visual_description: string;
}

export interface PlatformBriefModel {
  platform: string;
  hook?: string;
  tone?: string;
  aspect_ratio?: string;
  scenes: SceneBriefInput[];
  call_to_action?: string;
  platform_notes?: string;
}

export interface BriefScene {
  index: number;
  description: string;
  duration_seconds?: number;
  visual_direction?: string;
}

// ─── Brand profile (hydrated from Supabase) ──────────────────────────────────

export interface BrandProfile {
  id: string;
  client_id: string;
  tone_of_voice?: string;
  brand_keywords?: string[];
  target_platforms?: string[];
  brand_colors?: BrandColors;
  do_list?: string[];
  dont_list?: string[];
  audience_description?: string;
  // Extended fields (added in brand_profiles migration)
  logo_primary_url?: string;
  logo_inverse_url?: string;
  logo_safe_zone_ratio?: number;
  heading_font_url?: string;
  body_font_url?: string;
  title_case?: 'sentence' | 'upper' | 'title';
  motion_style?: MotionStyle;
  audio_targets?: AudioTargets;
  cta_defaults?: CtaDefaults;
}

export interface BrandColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  muted?: string;
  background?: string;
}

export interface MotionStyle {
  energy?: 'low' | 'medium' | 'high';
  pace?: 'slow' | 'medium' | 'fast';
  transition_preference?: TransitionType[];
  disallowed_effects?: string[];
}

export interface AudioTargets {
  voiceover_lufs?: number;
  music_ducking_db?: number;
  music_library_id?: string;
  music_track_url?: string;
}

export interface CtaDefaults {
  url?: string;
  show_qr?: boolean;
  logo_position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// ─── Composition Manifest (LLM output, validated with Zod) ───────────────────

export type TransitionType = 'soft_cut' | 'color_wipe' | 'scale_push';
export type LayoutType = 'fullscreen' | 'split_horizontal' | 'split_vertical' | 'picture_in_picture';
export type GradeType = 'neutral' | 'desaturated_cool' | 'vibrant_warm' | 'high_contrast';
export type ComponentType =
  | 'kinetic_title'
  | 'stagger_title'
  | 'lower_third'
  | 'caption_bar'
  | 'split_horizontal'
  | 'split_vertical'
  | 'picture_in_picture'
  | 'soft_cut'
  | 'color_wipe'
  | 'scale_push'
  | 'logo_reveal'
  | 'end_card';

export interface CompositionManifest {
  schema: 'compose.v1';
  brief_id?: string;
  client_id: string;
  run_id: string;
  platform: Platform;
  fps: number;
  width: number;
  height: number;
  duration_frames: number;
  scenes: ManifestScene[];
  transitions: ManifestTransition[];
  overlays: ManifestOverlay[];
  audio_track: AudioTrack;
  closing: ClosingSpec;
  narrative_arcs?: NarrativeArc[];
}

export interface ManifestScene {
  index: number;
  clip_filename: string;
  duration_frames: number;
  layout: LayoutType;
  grade?: GradeType;
}

export interface ManifestTransition {
  between: [number, number];
  type: TransitionType;
  duration_frames: number;
  accent_color?: string;
}

export interface ManifestOverlay {
  component: ComponentType;
  scene_index: number;
  start_frame: number;
  duration_frames: number;
  props: Record<string, unknown>;
}

export interface AudioTrack {
  voiceover_filename: string;
  music_source?: { id?: string; url?: string };
  lufs_target: number;
  music_ducking_db: number;
}

export interface ClosingSpec {
  component: 'end_card';
  cta: { text: string; url?: string; show_qr?: boolean };
  show_logo: boolean;
  start_frame: number;
  duration_frames: number;
}

export interface NarrativeArc {
  range: [number, number];
  grade: GradeType;
  music_cue?: string;
}

// ─── Compose job ─────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'hydrating' | 'generating_manifest' | 'rendering' | 'post_processing' | 'done' | 'failed';

export interface ComposeJob {
  id: string;
  run_id: string;
  client_id: string;
  status: JobStatus;
  manifest?: CompositionManifest;
  final_video_path?: string;
  output_url?: string;
  error?: string;
  created_at: Date;
  updated_at: Date;
}
