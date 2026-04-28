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
  /** Optional canonical output FPS. When omitted, compositor preserves source clip FPS. */
  target_fps?: number;
  video_idea_id?: string;
  workflow_id?: string;
  user_access_token: string;
  /** Requested EditStyle — resolved by StyleRegistry; defaults to 'corporate_clean'. */
  style_id?: StyleId;
  /** Requested use-case template — resolved by TemplateRegistry. */
  use_case?: UseCaseId;
}

export type Platform = 'yt_shorts' | 'tiktok' | 'instagram' | 'x' | string;

export interface VisualDirection {
  mood?: string;
  color_feel?: string;
  shot_style?: string;
  branding_elements?: string;
}

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
  visual_direction?: VisualDirection;
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
  cinematic_bars?: boolean;
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

export type TransitionType = 'soft_cut' | 'color_wipe' | 'scale_push' | 'slide_push' | 'zoom_blur' | 'slide';
export type SlideDirection = 'left' | 'right' | 'up' | 'down';
export type ImageTextDensity = 'none' | 'low' | 'medium' | 'high';
export type MotionType = 'ken_burns' | 'static';
export type TalkingHeadLayout = 'full' | 'sidebar' | 'pip_bottom_right';
export type LayoutType = 'fullscreen' | 'split_horizontal' | 'split_vertical' | 'picture_in_picture';
export type GradeType = 'neutral' | 'desaturated_cool' | 'vibrant_warm' | 'high_contrast';
export type StyleId = string;
export type UseCaseId = 'ad' | 'how_to' | 'property_tour' | 'talking_head' | 'thought_leadership' | string;
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
  | 'end_card'
  | 'typographic_background'
  | 'brand_accent_line'
  | 'motion_badge'
  | 'metric_callout';

export type TextOverlayComponent = 'kinetic_title' | 'stagger_title' | 'caption_bar';

export interface SceneOverlay {
  component: TextOverlayComponent;
  text: string;
  props?: Record<string, unknown>;
}

export interface CompositionManifest {
  schema: 'compose.v1' | 'compose.v2';
  brief_id?: string;
  client_id: string;
  run_id: string;
  /** EditStyle id — defaults to 'corporate_clean' when omitted (v1 backwards compat). */
  style_id?: StyleId;
  /** UseCaseTemplate id — optional; used by the slot-filling LLM path. */
  use_case?: UseCaseId;
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
  caption_track?: CaptionTrack;
}

export interface ManifestScene {
  index: number;
  /** Optional: omitted for purely typographic scenes with no underlying clip. */
  clip_filename?: string;
  duration_frames: number;
  layout: LayoutType;
  grade?: GradeType;
  /** Controls overlay suppression when the source image is already text-heavy. */
  image_text_density?: ImageTextDensity;
  /** Enables Ken Burns motion on static AI-generated images. Defaults to ken_burns for image clips. */
  motion?: MotionType;
  /** When set, renders the clip using the specified presenter layout instead of default. */
  talking_head_layout?: TalkingHeadLayout;
  scene_overlays?: SceneOverlay[];
}

export interface ManifestTransition {
  between: [number, number];
  type: TransitionType;
  duration_frames: number;
  accent_color?: string;
  /** Direction for slide_push transitions. Defaults to 'left'. */
  direction?: SlideDirection;
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

export interface CaptionWord {
  word: string;
  start_frame: number;
  end_frame: number;
}

export interface PauseMarker {
  start_frame: number;
  duration_frames: number;
}

export interface CaptionTrack {
  words: CaptionWord[];
  pauses?: PauseMarker[];
}

// ─── Compose job ─────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'hydrating' | 'resolving_style' | 'generating_manifest' | 'transcoding' | 'rendering' | 'post_processing' | 'done' | 'failed';

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
