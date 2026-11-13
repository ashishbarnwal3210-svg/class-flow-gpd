# ClassFlow

A mobile-first academic collaboration hub with a warm ivory/sage glass UI. This repository contains a React/Vite frontend, Supabase/Postgres schema and RLS migrations, and server-side Edge Function scaffolds for AI search, document indexing and LiveKit token issuance.

> **Integration status:** the existing Supabase project `Class Flow` (`ojnsowsceogblhaetmcc`, ap-southeast-2) is connected. All 17 database migrations have been executed and recorded; the private resource bucket, auth, Postgres REST access, RLS, and realtime publication are configured. A browser-safe publishable key is stored only in ignored `.env.local`. Email verification is disabled (`mailer_autoconfirm=true`). The previous account was deleted at the user's request. The owner account `Ashish_17` is now the initial administrator; new registrations ask only for name, username and password; Supabase Auth uses a hidden reserved alias internally. The deployed login Edge Function resolves username/ClassFlow ID to that alias without exposing it and applies hashed IP/identifier rate limits. The JWT-protected Copilot Edge Function is deployed and the Groq key/model/endpoint are configured as Supabase server secrets. The key was not shipped to the client. A direct sandbox request to Groq hit Cloudflare Error 1010, so successful AI generation still needs an authenticated runtime smoke test. No student accounts or academic catalogue data have been seeded; parser/embeddings and LiveKit are not configured.

## Stack

- React 19, TypeScript, Vite 7
- Tailwind CSS 4 (Vite plugin) plus ClassFlow design tokens and responsive component styles
- Supabase Auth, Postgres, Storage, Realtime and Edge Functions
- TanStack Query, Zustand for app-wide toast state, Zod validation, Lucide icons and Framer Motion
- Vitest + Testing Library

## Run locally

```bash
npm ci
# If .env.local is absent, copy .env.example and fill in the browser-safe URL/key.
npm run dev
```

A populated `.env.local` is already configured for the connected Supabase project in this workspace. Other clones without that ignored file render in setup mode. This browser configuration contains only a publishable key; privileged provider credentials are never placed in client variables.

## Supabase bootstrap and deployment

1. The workspace is already linked at runtime to the existing Supabase project **Class Flow** (`ojnsowsceogblhaetmcc`, ap-southeast-2). Its 17 migrations have been applied via the authenticated Supabase connector; the local migration filenames are aligned to the remote schema changes. The publishable key is in ignored `.env.local` (never commit it, even though publishable keys are designed for browsers). A REST read against `branches` returned HTTP 200.
2. Supabase username/password signup is enabled with email auto-confirmation (`mailer_autoconfirm=true`); the UI asks only for name, username and password (minimum six characters). The previous account was deleted at the user's request. The owner account `Ashish_17` exists and has the Admin role. Supabase stores a hidden reserved alias internally because its Auth API requires an email identifier; no real email is requested or verified. Without a recovery email/phone, password reset requires admin/support help. Set the production Site URL and allow-list before release.
3. For future schema changes, install the Supabase CLI, authenticate and link to this same project. First confirm that `supabase migration list --linked` shows all 17 migrations as applied and `supabase db push --dry-run` shows no unexpected replays. Then use `supabase db push` only for new reviewed migrations. Migrations define normalized tables, RLS, private storage, per-user permissions, history, realtime publication and hybrid retrieval RPC.
4. `Ashish_17` is the bootstrapped owner Admin. Admins can promote other members to Admin or assign least-privilege Subadmin roles from Admin Studio; role changes use a protected, audited RPC. The first Admin must configure actual branches, semesters, subjects and notices before campus resources are fully usable; no institution-specific catalogue data has been guessed or seeded.
5. The Copilot function is already deployed with server-side Groq settings (`AI_API_KEY`, `AI_MODEL`, `AI_CHAT_COMPLETIONS_URL`, `AI_DAILY_LIMIT`). To enable document indexing later, configure a separate compatible parser and 1536-dimension embeddings provider, then deploy `index-resource`. To enable calls, configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, then deploy `call-token`:

   ```bash
   supabase secrets set AI_EMBEDDING_API_KEY=... AI_EMBEDDING_MODEL=... AI_EMBEDDING_URL=...
   supabase secrets set DOCUMENT_PARSER_URL=... DOCUMENT_PARSER_API_KEY=...
   supabase secrets set LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
   supabase functions deploy index-resource
   supabase functions deploy call-token
   ```

   Secrets belong only in Supabase Edge Function secrets or a supported secret manager; never in browser storage, public tables, committed files or `VITE_` variables. The Groq chat key is not an embeddings key.
6. A Vercel project named `class-flow-gpd` has been created with Vite build settings, but no deployment is live because no Git repository/source is attached. Connect the source repository or deploy the built files, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Vercel builds, then set Supabase Auth Site URL/redirects to the assigned production domain. Verify storage, backups, monitoring and policies with a staging account before release.

## Included migrations

| Migration | Contents |
| --- | --- |
| `20261112135218_initial_schema.sql` | Profiles/private identifiers, roles, academic catalogue, resources/files/version history, social/messaging/group/call/notification tables, AI chunks, integration status, audit log, RLS and private storage bucket. |
| `20261112135316_search_and_updated_at.sql` | Service-only hybrid vector/full-text retrieval and protected Subadmin assignment RPC. |
| `20261112135329_resource_file_history.sql` | Recoverable file soft-deletion history and complete metadata snapshots. |
| `20261112135338_user_presence_and_usage.sql` | Download accounting, presence and Realtime publication. |
| `20261112135353_authorization_hardening.sql` | Per-person Subadmin permissions, safe friend-request transitions and blocked-message enforcement. |
| `20261112135402_social_request_controls.sql` | Safe connection removal and friendship deletion controls. |
| `20261112135412_storage_and_signup_hardening.sql` | Required signup metadata, reduced hard-delete surface and own-folder storage cleanup. |
| `20261112135419_download_statistics.sql` | Authenticated, non-PII download-count RPC for library sorting. |
| `20261112135431_resource_permission_boundaries.sql` | Separate resource edit/delete permissions and trigger-enforced delete-only scope. |
| `20261112135437_resource_file_replacement.sql` | Links replacement file versions to their predecessor. |
| `20261112135447_resource_file_add_history.sql` | Adds file-add events to the resource version/audit history. |
| `20261112135457_ai_usage_limits.sql` | Atomic server-only daily AI usage consumption and user-readable usage history. |
| `20261112141724_messaging_rpcs.sql` | Safe transactional direct/group chat creation for accepted, unblocked connections and conversation activity ordering. |
| `20261112145000_student_id_login.sql` | Service-role-only identifier-to-auth resolution and hashed per-IP/per-identifier sign-in rate limiting. |
| `20261112162000_username_only_accounts.sql` | Unique usernames, name/username-only profile creation, hidden auth aliases, and username-based login resolution. |
| `20261112172247_optional_resource_academics.sql` | Makes branch, semester, and subject optional for uploaded resources; includes null-aware academic filter behavior for hybrid search. |
| `20261113161638_resource_covers_and_role_admin.sql` | Grants initial Admin access to `Ashish_17`; adds audited Admin/Student/Subadmin role management and restricts direct role-table writes. |

## Edge Function settings

- `student-login` (deployed, public pre-auth endpoint): resolves username/ClassFlow ID to a hidden Supabase Auth alias server-side, validates the password through standard Supabase Auth, and returns the session. Hashed IP and identifier throttles are applied; the service role key remains server-side. Email confirmation is disabled project-wide.
- `copilot` (deployed): requires a valid Supabase JWT, applies a server-side daily limit (40 by default), routes academic queries to hybrid/vector or full-text retrieval, and sends general questions through the OpenAI-compatible Groq Chat Completions API. The configured model is `llama-3.3-70b-versatile`. Only a separate `AI_EMBEDDING_API_KEY` enables embeddings; the Groq chat key is never forwarded to OpenAI. `AI_API_KEY`, `AI_MODEL`, `AI_CHAT_COMPLETIONS_URL`, and embedding settings are server secrets. A provider response has not yet been confirmed from an authenticated app session.
- `index-resource`: verifies resource ownership or Admin access, calls the configured document parser, chunks extracted text, creates embeddings and stores them in `document_chunks`. It requires a compatible parser endpoint and an embedding provider; without those secrets, uploaded files remain available but are not AI-indexed.
- `call-token`: verifies conversation membership and issues a short-lived LiveKit room token server-side. LiveKit secrets never reach the browser.

## Deployment

- `vercel.json` builds `dist/` and rewrites SPA routes to `index.html`.
- `.github/workflows/ci.yml` runs `npm ci`, tests, production build and production-dependency audit.
- Example browser variables are in `.env.example`.

## Verified in this workspace

- `npm run build` — production TypeScript/Vite build passed before and after the backend configuration.
- `npm run build` — TypeScript/Vite production build passes; upstream Zod annotation warnings are non-fatal.
- `npm test` — 9/9 tests pass. `npm audit --omit=dev --audit-level=high` — 0 known vulnerabilities. Production static smoke checks returned HTTP 200 for `/`, `/profile`, `/library`, `/dashboard`, `/admin`, and built assets.
- Resource uploads no longer require branch, semester, or subject selectors; course context can go in the description. Existing classifications are retained for old resources, and null academic metadata is included by filtered hybrid search.
- Resource cards now show a signed first-image cover when present, use compact storefront-style layouts, and keep other files in the expandable attachment area. Copilot and resource cards have responsive mobile styling.
- File validation tolerates generic mobile MIME types by deriving the supported MIME from the extension. `Ashish_17` is the initial Admin; audited role management lets Admins assign Admin or least-privilege Subadmin access through a protected RPC.
- All 17 database migrations are applied. The private bucket, realtime publication tables, transactional messaging RPCs, AI usage RPC, username resolver, role assignment RPC and login rate-limit table were inspected. An API-level signup and username/password login smoke test passed; its temporary test account was deleted immediately. The user's own credentials were not tested.
- Copilot Edge Function is `ACTIVE` with JWT verification; unauthenticated invocation returned HTTP 401 as expected. Groq secrets are stored server-side only. Direct provider smoke testing from this sandbox hit Cloudflare Error 1010, so a successful AI answer is not claimed as end-to-end tested.
- **Not verified end-to-end:** the user's own sign-in, resource upload/download, role changes from an authenticated browser session, realtime messaging, a successful Groq completion from the Edge Function, document parsing/embeddings, LiveKit, or production Vercel deployment. The Vercel project exists but is not yet deployed.

## Current implementation notes

- Resource workflow includes multi-select and drag/drop, per-file type/size validation, live per-file and overall upload progress, cancellation of pending uploads, Assignment-only conditional metadata, description/tags/page-count metadata, partial-success preservation/retry, private signed preview/download, bookmarks/download counts, file add/remove/replace with history, own/admin/permission-scoped metadata edits and soft archive.
- Editing a document's page count updates metadata only; it does not alter the physical file.
- Dashboard, resource library and signed image covers, academic filters, Copilot, editable member name/bio, an Instagram-style grid of the member’s uploaded resources, profile/directory, campus-notice popover, group-chat entry point, admin catalogue setup, notice publishing, and audited Admin/Subadmin role assignment are connected to Supabase queries/policies.
- Direct messages and study groups now use Supabase conversation/message tables, realtime invalidation, transactional RPCs and friend/block authorization. Friend-request send/accept/cancel/remove is live against Supabase. Authenticated two-user/group browser testing is still pending. Friend-request rejection/block/report controls, timetable/assignment flows, call UI, subject/catalogue deletion, archived-resource restore and resource change-reason capture still need product flows. Call-token and document-index functions are not deployed until provider credentials exist.
- Local builds use browser-safe Supabase values from ignored `.env.local`; the production Vercel environment variables still need configuration when a source repository is connected. Groq credentials are kept in Supabase Edge Function secrets; the app does not bundle privileged keys. The Copilot function is deployed; indexing and LiveKit still need independent provider credentials.
