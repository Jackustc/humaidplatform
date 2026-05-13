const required = ["OPENAI_API_KEY", "ADMIN_PASSWORD", "ADMIN_SECRET", "KV_REST_API_URL", "KV_REST_API_TOKEN"];

export function checkEnv() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[humaid] Missing environment variables: ${missing.join(", ")}`);
  }
}
