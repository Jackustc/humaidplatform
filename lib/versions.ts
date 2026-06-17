/**
 * Version stamps attached to every session record so that data collected under
 * different code / prompt revisions can be told apart during analysis.
 */

// Data schema version — bump whenever the shape of the logged session changes.
export const SCHEMA_VERSION = "1.0.0";

// Version of the agent prompt set. Bump when any orchestrator/agent prompt changes.
export const PROMPT_VERSION = "1.0.0";

// Deployed app version. On Vercel this is injected automatically; falls back to
// "dev" for local development.
export const APP_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.NEXT_PUBLIC_APP_VERSION ??
  "dev";
