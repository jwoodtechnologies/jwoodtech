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
- Installed `jwoodtech-main` codebase (backend + frontend) into `/app`.
- Added `EMERGENT_LLM_KEY` + `JWT_SECRET` to `backend/.env`.
- Extended `eon_app.py`:
  - New `EON_SYSTEM_PROMPT` (agent-platform tone).
  - `EON_AGENTS` static roster (Researcher / Planner / Writer / Analyst).
  - `_llm_reply` helper using `emergentintegrations.LlmChat` (Claude
    Sonnet 4.5). Falls back to the previous `openai_client` path when
    set, and to the Emergent universal key otherwise.
  - `_log_activity` for activity-feed entries.
  - New endpoints: `GET /agents`, `GET /tasks`, `POST /tasks`,
    `PATCH /tasks/{id}`, `DELETE /tasks/{id}`,
    `POST /tasks/{id}/run` (executes the task end-to-end via the
    specialist agent's persona), `GET /activity`, `GET /dashboard`.
- Rewrote `frontend/src/pages/Eon.jsx`:
  - **Splash** is EON-only ("EON" + "Personal AI agent system").
  - **No login wall** — app opens to Dashboard immediately.
  - **Sidebar** with Dashboard / Agent / Tasks / Wallet (SOON) /
    Market & News (SOON), mobile-collapsible.
  - **AuthGate modal** pops up only when a gated action is attempted;
    preserves the typed prompt in `sessionStorage` and auto-sends it
    after successful sign-in. Includes a visual "Continue with Google"
    button (currently toasts "coming soon").
  - **DashboardView**: stats (messages / threads / tasks), 4 specialist
    agents cards, Recent activity panel.
  - **AgentView**: chat with EON, hero chips, voice input, prompt
    save-on-gate.
  - **TasksView**: create + agent dropdown, Run button (calls
    `/tasks/{id}/run`), result block, delete.
  - **ComingSoon** panels for Wallet + Market/News.
- Test report `iteration_1.json` — 100% backend, 100% frontend
  acceptance criteria passing. 15/15 pytest cases green.

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
