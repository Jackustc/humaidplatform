export type ProvenanceSpan = {
  start: number;
  end: number;
  source: string; // e.g. "agent_1", "agent_A", "user_typed"
  text: string;
};

// Minimum character length to classify a chunk as agent-originated
const MIN_MATCH = 40;

/**
 * Compares finalText against known agent outputs and tags each span
 * of text with its most likely provenance source.
 */
export function computeProvenance(
  finalText: string,
  sources: { id: string; text: string }[]
): ProvenanceSpan[] {
  const spans: ProvenanceSpan[] = [];
  let i = 0;

  while (i < finalText.length) {
    let matched = false;

    for (const src of sources) {
      const maxLen = Math.min(500, finalText.length - i);
      for (let len = maxLen; len >= MIN_MATCH; len--) {
        const chunk = finalText.slice(i, i + len);
        if (src.text.includes(chunk)) {
          const last = spans[spans.length - 1];
          if (last && last.source === src.id) {
            last.end = i + len;
            last.text = finalText.slice(last.start, last.end);
          } else {
            spans.push({ start: i, end: i + len, source: src.id, text: chunk });
          }
          i += len;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      // Accumulate user-typed characters into a single span
      const last = spans[spans.length - 1];
      if (last && last.source === "user_typed") {
        last.end = i + 1;
        last.text = finalText.slice(last.start, last.end);
      } else {
        spans.push({ start: i, end: i + 1, source: "user_typed", text: finalText[i] });
      }
      i += 1;
    }
  }

  return spans;
}

/**
 * Summarises provenance spans into a simple breakdown by source.
 */
export function summariseProvenance(spans: ProvenanceSpan[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const span of spans) {
    totals[span.source] = (totals[span.source] ?? 0) + (span.end - span.start);
  }
  return totals;
}
