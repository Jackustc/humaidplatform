# HUMAID Platform

**Human Multi-Agent AI Interaction Dynamics**

HUMAID is a research platform for studying how people work with multiple AI agents on a knowledge task. Each participant writes a short industrial report on the use of Generative AI in industry, assisted by a team of three AI agents. The platform records how the participant guides, reviews, and edits the agents' output, and makes that data available to researchers through a password-protected dashboard.

Deployment: NA

## Overview

Participants are recruited through CloudResearch Connect. On arrival they enter their Connect participant ID, which is validated before the session begins. They are then given a writing task and complete it in one of two interaction modes. Every meaningful action during the session is logged, and the final submission is compared against the original AI output to measure how much of it the participant actually changed.

The study is built around a comparison between two ways of organising several agents around a single task.

## Interaction Modes

### Collaborative

Three agents work in sequence under a coordinating orchestrator. The orchestrator reads the participant's task and decides what each agent should do; the roles are not fixed and vary from run to run. The first two agents carry out research and analysis, and the final agent writes the report using their combined work. The participant sees the orchestrator's full activity log, reads the finished report, and can edit it before submitting. If the result is unsatisfactory, the participant can send written feedback and the orchestrator runs the pipeline again.

### Competitive

Three agents work on the same task independently and in parallel, each producing its own report. They then review each other's work, and the orchestrator selects the version it considers strongest, with a written rationale. The participant sees all three reports, the critiques, and the orchestrator's decision. They can keep the recommended version or choose a different agent's output, edit it, and submit. As in collaborative mode, the participant can request another round with feedback.

Before starting, the participant can optionally provide a custom task, set preferences such as tone or audience, and assign specific instructions to individual agents.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| AI providers | OpenAI, Groq, DeepSeek |
| Data store | Upstash Redis (Vercel KV) |
| Recruitment | CloudResearch Connect |
| Auth | Cookie-based password gate |

## AI Models

The three agents are deliberately powered by different model providers (OpenAI, Groq, and DeepSeek) so that their outputs are genuinely distinct rather than three variations from a single model. The orchestrator's planning and decision steps run on OpenAI. The provider assigned to each agent is recorded with every session.

## Data Collection

Each completed session is stored as a single record. Alongside the participant's submission and survey responses, the record captures a structured set of fields intended for quantitative analysis, including:

- Version stamps for the data schema, the deployed build, and the agent prompt set
- The participant, assignment, and project identifiers from CloudResearch Connect
- The condition (mode) and how it was assigned
- The actual task used and whether the participant customised it
- The order agents were shown and which model served each one
- Timing: total session duration, time spent on the instructions, and time spent viewing each agent's output
- Edit metrics: edit distance and word-count change between the AI output and the final submission
- The number of re-runs, and whether the participant kept the orchestrator's recommendation
- API latency per call and in aggregate, and the number of failed model calls

A separate event stream records lower-level interactions during the session, such as scroll depth on each panel and debounced edits to the report.

## Participant Validation

Connect participant IDs are validated on the server through the CloudResearch validate-participants endpoint before a participant can start or submit. A participant who has already completed a session is prevented from completing a second one. Both behaviours are controlled by environment flags so the study settings can change without a code change:

- `STRICT_PARTICIPANT_VALIDATION` set to `true` blocks participants when validation cannot be completed. By default the platform allows them through and records the session as unvalidated.
- `ALLOW_REPEAT_PARTICIPATION` set to `true` permits repeat completions. By default they are blocked.

## Admin Dashboard

The dashboard sits behind a private path and a password, with the session cookie lasting seven days. It shows summary counts, survey averages, a table of all sessions, and a per-session log that includes the full agent conversation and the data-quality metrics. Researchers can export the data as Excel, CSV, or JSON.

## Environment Variables

Set the following for local development and in the hosting environment for production:

```
OPENAI_API_KEY            OpenAI API key
GROQ_API_KEY              Groq API key
DEEPSEEK_API_KEY          DeepSeek API key
ADMIN_PASSWORD            Password for the admin dashboard
ADMIN_SECRET              Secret used to sign the admin session cookie
KV_REST_API_URL           Key-value store REST URL
KV_REST_API_TOKEN         Key-value store REST token
CLOUDRESEARCH_API_KEY     CloudResearch Connect API key (participant validation)
```

Optional flags: `STRICT_PARTICIPANT_VALIDATION`, `ALLOW_REPEAT_PARTICIPATION`.

## Running Locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. The AI routes require valid model provider keys. Participant validation falls back to allowing entry when no CloudResearch key is configured, so the flow can be tested locally without one.

## Research Context

The platform supports work on the HUMAID framework, which addresses a gap in human-AI interaction theory. Most existing models describe a single human interacting with a single AI. As multi-agent systems become more common, new dynamics arise around information overload, inconsistent outputs across agents, delegation, and social influence, none of which the dyadic models account for. HUMAID provides a controlled setting in which these dynamics can be observed and measured.
