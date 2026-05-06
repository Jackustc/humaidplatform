# HUMAID Platform

**Human Multi-Agent AI Interaction Dynamics**

This is a research prototype built to support the HUMAID theoretical framework, which studies how a single human user interacts with a collection of AI agents. The platform is designed for academic experimentation and allows participants to complete a literature review task using multiple AI agents in two distinct interaction modes.

---

## What This Platform Does

The platform presents participants with a research task: conduct a literature review on Generative AI in Higher Education. Participants are given a choice between two modes of interacting with AI agents to complete this task.

**Collaborative Mode**

In this mode, three AI agents work in a sequential pipeline. Agent 1 generates a set of relevant search keywords. Agent 2 takes those keywords and retrieves a list of relevant academic papers. Agent 3 reads those papers and produces a synthesized literature review summary. The participant follows the pipeline step by step and can edit the final output before submitting.

This mode demonstrates coordination, workflow delegation, and multi-agent collaboration.

**Competitive Mode**

In this mode, three AI agents tackle the same task independently and simultaneously. Each agent produces its own version of the literature review using a different writing style: one is analytical and structured, one is narrative and flowing, and one is critical and concise. The participant reads all three outputs, selects the one they prefer, edits it if they wish, and submits.

This mode demonstrates comparison, trust, preference formation, and the cognitive dynamics of evaluating parallel AI outputs.

---

## What Gets Logged

Every session captures the following data, which is written to a local JSON file at `logs/sessions.json` and printed to the server console.

For all sessions: session ID, mode selected, task topic, start time, end time, final submission text, and whether the participant edited the AI output.

For collaborative sessions: the timestamp at which the participant advanced each step.

For competitive sessions: which agent was selected and at what time.

For all sessions: a confidence rating from 1 to 5 that the participant provides before submitting.

This data layer is designed to support future user studies. A database integration (Supabase) is planned for a later iteration.

---

## Tech Stack

The application is built with Next.js 14 using the App Router. The UI is styled with Tailwind CSS. There is no external database in this prototype version. The AI agent outputs are currently hardcoded placeholders that simulate realistic responses. Real AI integration (Claude API and Semantic Scholar for paper retrieval) is planned for the next development phase.

---

## Running the Project Locally

Make sure you have Node.js installed. Then run the following commands.

```
npm install
npm run dev
```

Open your browser and go to http://localhost:3000.

---

## Project Structure

```
app/
  page.tsx              Landing page with mode selection
  collaborative/        Collaborative mode flow
  competitive/          Competitive mode flow
  submit/               Final submission and confidence rating
  api/log/              Logging endpoint
lib/
  data.ts               All agent outputs and task configuration
logs/
  sessions.json         Interaction logs (created on first submission)
```

---

## Roadmap

**Current (Week 1)**
Fully functional prototype with hardcoded agent outputs, both interaction modes, and a working data logging endpoint.

**Week 2**
Integration of real AI agents using the Claude API. Agent 1 and Agent 3 will use Claude with role-specific system prompts. Agent 2 will retrieve real papers from the Semantic Scholar API.

**Week 3**
Database integration with Supabase to persist session logs. UI refinements based on feedback.

**Week 4**
End-to-end testing, edge case handling, and documentation for research deployment.

---

## Research Context

This platform is built to support ongoing research on the HUMAID theoretical framework. The framework addresses a gap in existing human-AI interaction theory, which has primarily focused on one-to-one (dyadic) interactions between a human and a single AI. As multi-agent AI systems become more common, new dynamics emerge around information overload, inconsistent agent outputs, and social influence effects that existing models do not account for.

The platform is intended for use in controlled user studies where participants are assigned to one of the two interaction modes and their behavior is observed and logged for analysis.

For questions about the research, refer to the working paper on SSRN.
