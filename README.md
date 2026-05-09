# HUMAID Platform

**Human Multi-Agent AI Interaction Dynamics**

A research platform studying how people interact with multiple AI agents when completing academic tasks. Participants complete a literature review using AI agents in one of two interaction modes. Every interaction is logged and available to researchers through a password-protected admin dashboard.

Live platform: https://humaidplatform.vercel.app

GitHub repository: https://github.com/kanadmotiwale/humaidplatform

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| AI | OpenAI GPT-4o |
| Database | Upstash Redis (via Vercel KV) |
| Deployment | Vercel |
| Auth | Custom cookie-based password gate |

---

## Application Flow

### 1. Consent and Demographics

A participant visits the platform and sees a consent form with a brief description of the study. They fill in demographic fields (age range, education level, AI familiarity, field of study) and check a consent box. A unique session ID is generated at this point in the format `sess_<timestamp>_<random>`. All subsequent events are tracked under that ID using sessionStorage.

---

### 2. Task and Mode Selection

The participant reads the task description — a literature review on Generative AI in Higher Education — and selects either Collaborative Mode or Competitive Mode. Their choice is stored in sessionStorage and they are sent to the instructions page.

---

### 3. Collaborative Mode

The participant works through a sequential three-step pipeline. Each step calls the OpenAI API and the result from one step is passed as input to the next.

**Step 1 — Agent 1: Keyword Specialist**
Calls `POST /api/agents/keywords` with the topic. GPT-4o generates 12 to 15 specific academic search keywords. They are displayed as tags. The participant clicks "Use these keywords" to proceed.

**Step 2 — Agent 2: Paper Search Specialist**
Calls `POST /api/agents/papers` with the keywords from Step 1. GPT-4o generates 5 to 7 realistic academic paper references with titles, authors, years, journals, relevance ratings, and summaries. The participant reviews the papers and clicks "Use these papers."

**Step 3 — Agent 3: Literature Summarizer**
Calls `POST /api/agents/summary` with the papers from Step 2. GPT-4o synthesizes a three-paragraph literature review. The participant can edit the text before submitting.

---

### 4. Competitive Mode

All three agents run simultaneously in parallel. On page load, `POST /api/agents/competitive` fires a single request that calls GPT-4o three times concurrently, each with a different style prompt. The three outputs appear side by side.

- **Agent A — Analytical and Structured**: evidence-based with bullet points and clear headers
- **Agent B — Narrative and Flowing**: continuous prose that builds an argument
- **Agent C — Critical and Concise**: short, direct, surfaces tensions and gaps

The participant must scroll through each output before the Select button unlocks. They select one, optionally edit it, and submit.

---

### 5. Submission and Survey

After submitting, the participant rates their confidence in the final answer (1 to 5), then completes a short post-task survey covering trust in the AI output, perceived difficulty, satisfaction, and mental effort (all 1 to 5 scales). Clicking "Submit and complete" sends all session data to `POST /api/log`, which writes it to Upstash Redis.

---

## What Gets Logged

Every session records the following:

**Session metadata**
Session ID, mode, task topic, start time, end time, whether the output was edited, original character count, final character count, characters added, characters removed.

**Collaborative-specific**
Timestamps for each step transition (when the participant advanced from Agent 1 to 2, and 2 to 3).

**Competitive-specific**
Which agent was selected and the timestamp of selection.

**Survey data**
Confidence rating, trust, difficulty, satisfaction, and effort scores. Demographics (age range, education, AI familiarity, field of study).

**Provenance analysis**
A character-level comparison between the participant's final text and the original AI output using a longest-common-substring algorithm. Reports what percentage of the final submission came from the AI versus was typed by the participant.

**Event stream**
A timestamped log of every interaction during the session: when the participant viewed each agent panel (with dwell time in milliseconds), scroll depth percentages on each agent card, hover durations, copy events, paste events, textarea focus and blur, and debounced edit events with character and word counts.

---

## Admin Dashboard

The admin dashboard is available at `/admin` and is protected by a password. Unauthenticated users are redirected to `/admin/login`. The cookie lasts 7 days.

The dashboard shows:

- Summary cards: total sessions, collaborative count, competitive count, percentage who edited the AI output
- Survey averages across all sessions: confidence, trust, difficulty, satisfaction, effort
- A full sessions table with all recorded fields
- An Export CSV button that downloads a two-section CSV: session summary rows and a full event stream

---

## Project Structure

```
app/
  page.tsx                    Consent and demographics
  task/                       Task description and mode selection
  instructions/               Mode-specific instructions
  collaborative/              Sequential three-agent pipeline
  competitive/                Parallel three-agent comparison
  submit/                     Confidence rating, survey, and final logging
  admin/
    page.tsx                  Session dashboard (protected)
    login/page.tsx            Password login page
  api/
    agents/
      keywords/route.ts       GPT-4o keyword generation
      papers/route.ts         GPT-4o paper retrieval
      summary/route.ts        GPT-4o literature review synthesis
      competitive/route.ts    Three parallel GPT-4o calls
    log/route.ts              Writes session to Upstash Redis
    sessions/route.ts         Reads all sessions from Upstash Redis
    export/route.ts           Generates and downloads CSV
    admin/
      login/route.ts          Validates password, sets cookie
      logout/route.ts         Clears cookie
components/
  progress-bar.tsx            Step indicator shown in the navbar
lib/
  data.ts                     Task configuration and topic
  event-logger.ts             Client-side event accumulator (sessionStorage)
  provenance.ts               LCS-based text provenance algorithm
middleware.ts                 Redirects unauthenticated /admin requests to login
```

---

## Environment Variables

The following variables must be set in `.env.local` for local development and in Vercel for production.

```
OPENAI_API_KEY=        Your OpenAI API key (GPT-4o access required)
ADMIN_PASSWORD=        Password to log in to the admin dashboard
ADMIN_SECRET=          Random secret string used to sign the admin cookie
KV_REST_API_URL=       Injected automatically by Vercel when Upstash is connected
KV_REST_API_TOKEN=     Injected automatically by Vercel when Upstash is connected
```

---

## Running Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For the AI routes to work locally you need a valid `OPENAI_API_KEY` in `.env.local`. For the admin dashboard to persist data locally you need the Upstash KV vars, which you can pull using the Vercel CLI:

```bash
npx vercel env pull .env.local
```

---

## Research Context

This platform supports ongoing research on the HUMAID theoretical framework, which addresses a gap in human-AI interaction theory. Existing models focus on one-to-one (dyadic) interactions between a human and a single AI. As multi-agent systems become more common, new dynamics emerge around information overload, inconsistent agent outputs, delegation behaviour, and social influence effects that existing models do not account for.

Working paper: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6650059
