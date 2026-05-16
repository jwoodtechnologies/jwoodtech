# EON — Personal AI Agent Platform (PRD)

## Original problem statement
Upgrade EON (the `/eon` page of the Jwood Technologies app) from a simple
AI chatbot into a **personal AI agent system** inspired by NousResearch's
Hermes architecture. The Hermes repo cannot be installed verbatim (165k+
lines of CLI/TUI/gateway-first Python around browser daemons, MCP, OAuth
providers, messaging adapters); instead, its **concepts** (multi-agent
roster, tasks, activity log, dashboard) were adapted into EON's existing
FastAPI + React stack.

Branding & UX constraints (user-stated, verbatim where relevant):
- Keep the EON name. Do NOT reference WoodAI anywhere. Do NOT reference
  Hermes publicly in the frontend.
- Keep the EON orb + starfield. Cinematic, premium, alive.
- Splash is EON-only.
- Remove the login wall. After the user types a prompt, the auth modal
  pops up and the prompt is preserved + auto-sent post-signin.
- Add a visual "Continue with Google" button (not hooked up yet).
- Nav sections: Agent, Tasks, Dashboard, Wallet (Coming Soon),
  Market / News (Coming Soon).
- Backend-only LLM calls; keys via env vars.

## Architecture (current)
- **Backend:** FastAPI (`/api/eon-app/*`) on `/app/backend/eon_app.py`,
  mounted from `server.py`. MongoDB collections: `eon_users`,
  `eon_messages`, `eon_threads`, `eon_tasks`, `eon_activity`.
- **LLM brain:** `emergentintegrations.LlmChat` with Anthropic Claude
  Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via `EMERGENT_LLM_KEY`.
  Provider + model swappable via `EON_LLM_PROVIDER` / `EON_LLM_MODEL`.
- **Frontend:** React + Tailwind. Single page at
  `/app/frontend/src/pages/Eon.jsx` driving the entire EON shell.

## User personas
- **Guest visitor** — browses Dashboard + Agent freely, blocked at the
  "do something" boundary (send / create task / run task).
- **Free user** — 5 LLM calls (chat + task-run counted).
- **Admin** — `admin@jwoodtechnologies.com / 7607`, unlimited.

## Core requirements (static)
1. EON-only branding (no WoodAI / no Hermes in UI).
2. Starfield + orb visuals.
3. Sidebar with 5 sections.
4. Auth-on-action, not on-entry.
5. Visual Google sign-in button.
6. Backend stores: users, messages, threads, tasks, activity.
7. Specialist agents: Researcher, Planner, Writer, Analyst.
8. Task lifecycle: queued → running → done | failed.

## What's been implemented — 2026-05-16
- Installed `jwoodtech-main` codebase + built EON Agent Platform (Dashboard / Agent / Tasks) with Researcher web-search citations.
- **Homepage**:
  - Single floating EON orb (clean, no extra halos) — opens a **conversational lead-capture chatbot** with a full-screen **animated starfield backdrop**. Multi-step flow: greeting → first name → last name → email (validated) → message → "Got it — Jwood Technologies will get back to you within 24–48 hours." Stored in `eon_contact_leads`.
  - Footer: **"PRODUCTS OF JWOOD TECHNOLOGIES"** band with 3 card links (EON · WoodX · NXT1). Tight legal row underneath with socials.
- **EON page**:
  - Dashboard "Talk to EON" white button replaced with the **glowing EON orb** that opens the Agent chat view.
- **WoodX (`/woodchat`)**:
  - **Default theme: dark carbon-black** (premium). Light mode available.
  - **Premium typography: Geist + Geist Mono**.
  - **Real WoodX logo** (white PNG, inverted via CSS filter for light mode) replacing the old WX box mark.
  - Cleaner sidebar: brand row, workspace nav (Chats / Groups / Contacts / **EON** live / Wallet (Soon) / Market & News (Soon)), theme toggle, user pill, sign-out.
  - Minimal legal footer: `© · HOME · EON ↗ · ●NXT1 ↗`.
  - **Auth modal redesign**: WoodX logo head, **Continue with Google** button (visual only — toasts "coming soon"), "or" divider, Sign in / Create account tabs, encrypted-private-no-spam tagline.
  - **EON live inside WoodX** via `POST /api/woodchat/eon/chat` (Claude Sonnet 4.5).
  - **CometChat auth_token flow**: when `COMETCHAT_REST_API_KEY` is set, backend issues an auth_token and the frontend uses `loginWithAuthToken` — Auth Key never leaves the server.
  - Mobile: collapsing sidebar, condensed topbar/footer, fully responsive.
- **Backend** new endpoints under `/api/woodchat/`:
  - `GET /comet/config` — idempotent CometChat user creation + token issuance.
  - `POST /eon/chat` — EON Messaging Agent (Claude Sonnet 4.5 via Emergent LLM key, multi-turn).

## Backlog (not yet built)
- **P1**: Wallet section (credits, billing, per-agent usage).
- **P1**: Market / News section (Researcher-curated live feeds).
- **P1**: Hook up real Google OAuth (Emergent-managed Google Auth).
- **P1**: User-owned Anthropic / OpenAI keys (swap `EMERGENT_LLM_KEY`
  for user-supplied keys via Profile settings).
- **P2**: Streaming responses for chat + task execution.
- **P2**: Task scheduling / cron (Hermes-style).
- **P2**: Tool use (web search, file upload, calendar) per agent.
- **P3**: Skills hub / cross-session memory per Hermes design.
- **P3**: Split `Eon.jsx` (>1200 lines) into per-view files.
- **P3**: Don't charge a free message when the LLM call errors out.
- **P3**: Move `EON_AGENTS` roster to a DB collection so admin can edit.

## Next tasks (priority order)
1. Hook real Anthropic + OpenAI keys to swap from Emergent universal key
   once you provide them (env: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).
2. Wire up Google sign-in via Emergent-managed Google Auth.
3. Build out Wallet (billing / credits) and Market / News (Researcher
   feed) sections.
