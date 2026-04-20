# Video Compositor — Completion Webhook Contract

## Overview

`tabario-video-compositor` emits a completion webhook after every compose job finishes (success or failure). This mirrors the `send_completion_webhook` contract from `edit-videos` so n8n can handle both services identically.

## Endpoint

Configured via `VIDEO_COMPLETED_N8N_WEBHOOK_URL` environment variable.

## Method

`POST`

## Payload

### Success

```json
{
  "run_id": "abc-123",
  "video_idea_id": "idea-456",
  "video_url": "https://your-project.supabase.co/storage/v1/object/public/videos/compositor/abc-123/composed.mp4",
  "status": "completed",
  "platform": "tiktok",
  "compose_job_id": "job-uuid"
}
```

### Failure

```json
{
  "run_id": "abc-123",
  "video_idea_id": "idea-456",
  "video_url": "",
  "status": "failed",
  "error": "Manifest generation failed after all retries",
  "platform": "tiktok",
  "compose_job_id": "job-uuid"
}
```

## Fields

| Field | Type | Always Present | Description |
|---|---|---|---|
| `run_id` | string | ✅ | Shared run identifier from `edit-videos` handoff |
| `video_idea_id` | string | ❌ | Optional — passed through from handoff payload if present |
| `video_url` | string | ✅ | Public Supabase storage URL (empty string on failure) |
| `status` | `"completed"` \| `"failed"` | ✅ | Job outcome |
| `error` | string | ❌ | Only present when `status = "failed"` |
| `platform` | string | ❌ | Target platform from brief (e.g. `tiktok`, `yt_shorts`) |
| `compose_job_id` | string | ✅ | Internal compositor job UUID for tracing |

## Retry Behaviour

- Retries up to 3 times on HTTP 5xx responses, with exponential backoff (2s, 4s)
- Fails immediately and does **not** retry on HTTP 4xx responses
- If all retries are exhausted, the job status is set to `failed` and a best-effort failure webhook is still attempted
