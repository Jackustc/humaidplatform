// Keys the app cannot run correctly without. Groq and DeepSeek power Agent B
// and Agent C in both orchestrator modes, so they belong here too.
const required = [
  "OPENAI_API_KEY",
  "GROQ_API_KEY",
  "DEEPSEEK_API_KEY",
  "ADMIN_PASSWORD",
  "ADMIN_SECRET",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
];

// Keys that are optional today but expected once a feature is enabled.
const optional = ["CLOUDRESEARCH_API_KEY"];

export function checkEnv() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[humaid] Missing environment variables: ${missing.join(", ")}`);
  }
  const missingOptional = optional.filter((k) => !process.env[k]);
  if (missingOptional.length > 0) {
    console.warn(`[humaid] Optional environment variables not set: ${missingOptional.join(", ")}`);
  }
}
