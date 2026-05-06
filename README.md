# HUMAID Platform

**Human Multi-Agent AI Interaction Dynamics**

This is a research prototype built to support the HUMAID theoretical framework, which studies how a single human user interacts with a collection of AI agents. The platform is designed for academic experimentation and allows participants to complete a literature review task using multiple AI agents in two distinct interaction modes.

Live platform: https://humaidplatform.vercel.app

GitHub repository: https://github.com/kanadmotiwale/humaidplatform

---

## Application Flow

### Landing Page

A participant visits the platform and is presented with a single research task: conduct a literature review on Generative AI in Higher Education. The page shows a brief description of the task, the estimated time required, and two mode options. The participant reads the task and selects either Collaborative Mode or Competitive Mode to begin. A unique session ID is generated at this point and all subsequent interactions are tracked under that ID.

---

### Collaborative Mode

The participant works through a three-step sequential pipeline. Each step must be completed before the next one begins.

**Step 1 — Agent 1: Keyword Specialist**

The participant lands on the collaborative page and Agent 1 begins running immediately. After a short loading period, Agent 1 produces a list of 15 search keywords relevant to the topic of Generative AI in Higher Education. The keywords are displayed as individual tags. The participant reviews them and clicks "Use these keywords" to pass them to the next agent. The timestamp of this action is recorded.

**Step 2 — Agent 2: Paper Search Specialist**

Agent 2 takes the keywords from Agent 1 and searches for relevant academic papers. After loading, it returns 6 papers, each showing the title, authors, year, journal, a relevance rating (High or Medium), and a one-line summary. The participant reviews the papers and clicks "Use these papers" to continue. The timestamp of this action is recorded.

**Step 3 — Agent 3: Literature Summarizer**

Agent 3 synthesizes the retrieved papers into a structured three-paragraph literature review. The participant can read the output and edit it directly in a text area if they want to revise or improve it. Once satisfied, they click "Submit final answer" to proceed to the submission page.

---

### Competitive Mode

The participant lands on the competitive page and all three agents begin running simultaneously. After a short loading period, all three outputs appear at the same time in a side-by-side layout.

**Agent A — Analytical and Structured**
Produces a literature review using clear headers, bullet points, and an evidence-based structure.

**Agent B — Narrative and Flowing**
Produces a literature review written as cohesive prose that synthesizes findings into a continuous argument.

**Agent C — Critical and Concise**
Produces a shorter, more critical review that directly surfaces tensions and gaps in the literature.

The participant reads all three outputs and clicks "Select this response" on the one they find most useful. The selected text populates an editable text area below the cards. The participant can edit the text before clicking "Submit final answer." The timestamp of the selection and the identity of the selected agent are both recorded.

---

### Submission Page

After submitting from either mode, the participant lands on the submission page. They see their final answer, along with a summary of their session metadata: the mode used, whether they edited the AI output, and the time elapsed. They are then asked to rate their confidence in the submission on a scale of 1 to 5. Once they select a rating, the "Submit and complete" button becomes active. Clicking it sends all session data to the logging endpoint and shows a confirmation screen with a summary of the recorded session.

---

## What Gets Logged

Every session records the following data and writes it to a local JSON file at logs/sessions.json. In the next development phase this will move to a Supabase database.

Session ID, mode selected, task topic, start time, end time, final submission text, whether the participant edited the AI output, and confidence rating.

For collaborative sessions: the timestamp at which the participant advanced each step.

For competitive sessions: which agent was selected and at what time the selection was made.

---

## Tech Stack

The application is built with Next.js 14 using the App Router. The UI is styled with Tailwind CSS. There is no external database in this prototype version. The AI agent outputs are currently hardcoded placeholders that simulate realistic responses. Real AI integration using the Claude API and Semantic Scholar for paper retrieval is planned for the next development phase.

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
  collaborative/        Collaborative mode — three step pipeline
  competitive/          Competitive mode — parallel agent comparison
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
Fully functional prototype with hardcoded agent outputs, both interaction modes, and a working data logging endpoint. Deployed at humaidplatform.vercel.app.

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

For questions about the research, refer to the working paper on SSRN: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6650059
