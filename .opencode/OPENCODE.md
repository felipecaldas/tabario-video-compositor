# OpenCode Linear Integration Rules

These rules govern how OpenCode sessions interact with Linear issue tracking for the Tabario project.

## Linear Configuration

| Field | Value |
|---|---|
| Workspace | `tabario` |
| Project | `Tabario` |
| Project ID | `0b36da10-5b97-4b08-a802-b868e3fa2db1` |
| Team | `Tabario` |
| Team key | `TAB` |
| Team ID | `3b83ebc7-ce0f-449d-ba84-bd1f76664e64` |

API Key Location: `./.env` (LINEAR_APP_API_KEY)

---

## Memory Management
When you discover something valuable for the future sessions - architectural decisions, bug fixes, gotchas, environment quicks - immediatelly append it to ./opencode/memory.md

Don't wait to be asked. Don't wait for session end.

Kee entries short: date, what, why. Read this file at the start of every session.

## Core Rule: Linear Sync is Mandatory

**No work is done without a Linear issue.**

### Before Starting Work

1. **Check for existing issue**: Search Linear for an existing issue that matches the work
2. **If no issue exists**: Create a new Linear issue BEFORE writing any code
3. **Move to In Progress**: Transition the issue to `In Progress` and add a start comment

### While Working

- Add progress comments for meaningful milestones, blockers, verification outcomes, and scope changes
- Keep the issue updated as work progresses

### After Work is Complete

**MANDATORY**: When work is verified and complete:

1. Move the issue to `Done`
2. Add a completion comment with:
   - Changed files
   - Verification performed
   - Any residual risks or next steps
   - Commit SHA (if applicable)

### Read-Only Exception

Pure read-only research that produces **no code, docs, tests, workflows, or other artifacts** does NOT require a Linear issue.

---

## Issue Creation Rules

### When to Create a New Issue

Create a new Linear issue when:

1. **New feature or enhancement** that requires code, docs, tests, or workflows
2. **Bug fix** that requires code changes
3. **Refactoring** that touches production code
4. **Infrastructure changes** (Docker, deployment, CI/CD)
5. **Documentation updates** (READMEs, architecture docs, API docs)
6. **Test additions** (unit, integration, E2E tests)
7. **n8n workflow changes** (new workflows, webhook prompt changes)
8. **Database changes** (Supabase migrations, RLS, schema changes)

### When to Update an Existing Issue

Update an existing issue when:

1. Continuing work on an `In Progress` or `Backlog` issue
2. Completing a task tracked in an existing issue
3. Adding progress to an epic's sub-issue
4. Addressing feedback on an existing issue

### Epic vs Single Issue

| Situation | Use |
|---|---|
| Multi-task implementation plan | Create parent `[EPIC] ...` + one sub-issue per task with `parentId` |
| Single standalone task | Create single issue without epic |

---

## Required Issue Fields

| Field | Requirement |
|---|---|
| `title` | Short, imperative (e.g., "Add user authentication") |
| `team` | MUST be `TAB` |
| `project` | MUST be `Tabario` |
| `description` | Markdown with: Summary, Scope/files touched, Acceptance criteria, Plan reference |
| `labels` | At least one relevant label (see taxonomy below) |
| `priority` | Default to `3` unless task clearly needs different priority |
| `parentId` | Required for sub-issues; omit for single issues |

---

## Label Taxonomy

Apply at least one label. Create labels on first use if missing.

| Label | When to Apply |
|---|---|
| `vcaas` | V-CaaS brand-aware pipeline work |
| `backend` | `edit-videos`, `videomerge`, Temporal, or FastAPI work |
| `frontend` | `tabario-frontend` changes |
| `runpod` | `runpod-serverless` worker, ComfyUI workflows, or input schema |
| `infra` | Docker, docker-compose, deployment, CI/CD, or secrets |
| `docs` | Contract docs, architecture docs, READMEs |
| `tests` | Unit, integration, or E2E tests |
| `n8n` | n8n workflow or webhook prompt changes |
| `db` | Supabase migrations, RLS, or schema changes |

---

## Linear GraphQL API Access

When Linear MCP tools are unavailable, use the Linear GraphQL API with the API key from `.env`.

### Example: Create Issue

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $(grep LINEAR_APP_API_KEY .env | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { issueCreate(input: { teamId: \"3b83ebc7-ce0f-449d-ba84-bd1f76664e64\", title: \"Add user authentication\", description: \"## Summary\n...\", priority: 3, labelIds: [...] }) { success issue { id identifier } } }"
  }'
```

### Example: Move to Done

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $(grep LINEAR_APP_API_KEY .env | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { issueUpdate(id: \"<issue-id>\", input: { stateId: \"<done-state-id>\" }) { success issue { id identifier state { name } } } }"
  }'
```

### Example: Add Comment

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $(grep LINEAR_APP_API_KEY .env | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { commentCreate(input: { issueId: \"<issue-id>\", body: \"Work complete: changed files X, Y, Z\" }) { success comment { id } } }"
  }'
```

### Get State IDs

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $(grep LINEAR_APP_API_KEY .env | cut -d'=' -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { team(id: \"3b83ebc7-ce0f-449d-ba84-bd1f76664e64\") { states { nodes { id name } } } }"
  }'
```

### Important Notes

- **NEVER fabricate Linear issue IDs, state IDs, or commit URLs**
- Always use real IDs returned from API responses
- If neither Linear MCP nor API credentials are available, state the blocker clearly before proceeding with work that requires ticket creation

---

## Completion Comment Template

When moving an issue to `Done`, include:

```markdown
## Completion Summary

**Changed files:**
- path/to/file1.ts (changes)
- path/to/file2.py (changes)

**Verification performed:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Code review completed

**Acceptance criteria mapping:**
- ✅ AC1: ...
- ✅ AC2: ...

**Residual risks / next steps:**
- None identified

**Commit:** <SHA> (if applicable)
**Branch:** <branch-name>
```

---

## Post-Commit Workflow

When OpenCode completes work and commits changes:

1. **Verify**: Ensure the commit fully satisfies acceptance criteria
2. **Update Linear**:
   - Move issue to `Done` if complete
   - Add completion comment with commit details
3. **For epics**: Verify all sibling sub-issues are `Done` before transitioning parent epic

### Commit Message Format

Include Linear ticket identifier in commit messages:

```
feat(classifier): add scene_type field (TAB-144)
fix(renderer): resolve black-frame issue (TAB-181)
docs(api): update endpoint documentation (TAB-150)
```

---

## Common Workflows

### Starting New Work

1. User requests work
2. **Check Linear** for existing issue
3. **If none exists**: Create issue with required fields
4. Move issue to `In Progress`
5. Add start comment: "Beginning implementation"
6. Proceed with implementation

### Completing Work

1. Complete implementation and verification
2. Move issue to `Done`
3. Add completion comment with:
   - Changed files
   - Verification performed
   - Any next steps
4. Inform user work is complete

### Handling Epic Work

1. Create `[EPIC]` parent issue if multi-task plan
2. Create sub-issues with `parentId` set to epic
3. Work through sub-issues one at a time
4. When all sub-issues are `Done`, verify and move epic to `Done`
5. Add epic completion comment summarizing all completed work

---

## Forbidden Actions

❌ **NEVER** start implementation without a Linear issue
❌ **NEVER** close or merge work that lacks a Linear ticket
❌ **NEVER** reopen already `Done` issues (comment and flag to user instead)
❌ **NEVER** fabricate Linear IDs
❌ **NEVER** skip the completion comment when marking `Done`
❌ **NEVER** omit the Linear ticket identifier from commit messages
