"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

function applyInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function scholarUrl(ref: string): string {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(ref)}`;
}

function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const result: string[] = [];
  let inList = false;
  let inRefSection = false;
  let inRefList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect "References" / "References:" heading
    if (/^(\*{1,2})?references?:?(\*{1,2})?\s*$/i.test(trimmed)) {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inRefList) { result.push("</ol>"); inRefList = false; }
      result.push(`<p style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase;margin:20px 0 8px;border-top:1px solid #e5e7eb;padding-top:12px">References</p>`);
      inRefSection = true;
      continue;
    }

    if (line.startsWith("### ")) {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inRefList) { result.push("</ol>"); inRefList = false; }
      inRefSection = false;
      result.push(`<h3 style="font-size:13px;font-weight:600;color:#1f2937;margin:10px 0 4px">${applyInline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inRefList) { result.push("</ol>"); inRefList = false; }
      inRefSection = false;
      result.push(`<h2 style="font-size:14px;font-weight:700;color:#111827;margin:12px 0 4px">${applyInline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      if (inList) { result.push("</ul>"); inList = false; }
      if (inRefList) { result.push("</ol>"); inRefList = false; }
      inRefSection = false;
      result.push(`<h1 style="font-size:15px;font-weight:700;color:#111827;margin:12px 0 6px">${applyInline(line.slice(2))}</h1>`);
    } else if (trimmed === "") {
      if (inList) { result.push("</ul>"); inList = false; }
      // Don't close ref list on blank lines — references may have blank lines between them
    } else if (inRefSection) {
      // Render as numbered list item with Scholar link
      if (!inRefList) {
        result.push('<ol style="margin:0;padding-left:20px;list-style-type:decimal">');
        inRefList = true;
      }
      const clean = trimmed.replace(/^\d+\.\s*/, ""); // strip any "1." the model added
      const link = `<a href="${scholarUrl(clean)}" target="_blank" rel="noopener noreferrer" style="color:#3b82f6;font-size:11px;margin-left:6px;text-decoration:underline">Link</a>`;
      result.push(`<li style="font-size:12px;color:#4b5563;line-height:1.8;margin:5px 0;padding-left:4px">${applyInline(clean)}${link}</li>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList) { result.push('<ul style="margin:4px 0;padding-left:16px">'); inList = true; }
      result.push(`<li style="font-size:13px;color:#374151;line-height:1.6;margin:2px 0">${applyInline(line.slice(2))}</li>`);
    } else {
      if (inList) { result.push("</ul>"); inList = false; }
      result.push(`<p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 8px">${applyInline(line)}</p>`);
    }
  }
  if (inList) result.push("</ul>");
  if (inRefList) result.push("</ol>");
  return result.join("");
}

type SessionData = {
  sessionId: string;
  mode: "collaborative" | "competitive";
  task: string;
  startTime: string;
  endTime: string;
  finalSubmission: string;
  wasEdited: boolean;
  originalLength?: number;
  finalLength?: number;
  charsAdded?: number;
  charsRemoved?: number;
  selectedAgent?: number;
  selectedAgentName?: string;
};

const LIKERT_QUESTIONS = [
  { id: "trust", label: "How much did you trust the AI output?", low: "Did not trust at all", high: "Trusted completely" },
  { id: "difficulty", label: "How difficult was the task?", low: "Very easy", high: "Very difficult" },
  { id: "satisfaction", label: "How satisfied are you with your final answer?", low: "Not satisfied", high: "Very satisfied" },
  { id: "effort", label: "How much mental effort did this task require?", low: "Very little effort", high: "A great deal of effort" },
];

function LikertScale({
  question,
  value,
  onChange,
}: {
  question: (typeof LIKERT_QUESTIONS)[0];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <p className="text-sm font-medium text-gray-800 mb-3">{question.label}</p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-24 text-right leading-tight">{question.low}</span>
        <div className="flex gap-2 flex-1 justify-center">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={`w-9 h-9 rounded-full text-sm font-medium border transition-all ${
                value === n
                  ? "bg-gray-900 text-white border-gray-900"
                  : "border-gray-200 text-gray-500 hover:border-gray-400"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 w-24 leading-tight">{question.high}</span>
      </div>
    </div>
  );
}

// Change 7: copy button component
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }
  return (
    <button
      onClick={handleCopy}
      className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 px-2.5 py-1 rounded transition-colors"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function SubmitPage() {
  const [data, setData] = useState<SessionData | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [likert, setLikert] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("humaid_session_data");
    if (raw) setData(JSON.parse(raw));
  }, []);

  const allAnswered = rating > 0 && LIKERT_QUESTIONS.every((q) => likert[q.id] > 0);

  async function handleFinalSubmit() {
    if (!allAnswered) return;
    setIsSubmitting(true);
    const demographics = sessionStorage.getItem("humaid_demographics");
    try {
      await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          confidenceRating: rating,
          postTaskSurvey: likert,
          demographics: demographics ? JSON.parse(demographics) : null,
        }),
      });
    } catch (err) {
      // Non-critical
      console.error("[submit] Failed to log session:", err);
    }
    setIsSubmitting(false);
    setSubmitted(true);
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-sm text-gray-400">No session data found.</p>
        <Link href="/" className="text-gray-700 underline text-sm mt-2 inline-block">Return to home</Link>
      </div>
    );
  }

  if (submitted) {
    const durationSec = data.startTime && data.endTime
      ? Math.round((new Date(data.endTime).getTime() - new Date(data.startTime).getTime()) / 1000)
      : null;

    const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
      { label: "Mode", value: <span className="capitalize">{data.mode}</span> },
      ...(data.selectedAgentName ? [{ label: "Selected agent", value: data.selectedAgentName }] : []),
      { label: "Confidence rating", value: `${rating} / 5` },
      { label: "Response edited", value: data.wasEdited ? "Yes" : "No" },
      ...(data.wasEdited && data.charsAdded != null
        ? [{ label: "Characters added / removed", value: `+${data.charsAdded} / -${data.charsRemoved}` }]
        : []),
      ...(durationSec !== null
        ? [{ label: "Duration", value: durationSec < 60 ? `${durationSec}s` : `${Math.round(durationSec / 60)}m` }]
        : []),
      { label: "Session ID", value: data.sessionId, mono: true },
    ];

    return (
      <div className="max-w-md mx-auto py-10">
        <div className="mb-5 text-center" style={{ textAlign: "center" }}>
          <div className="w-9 h-9 border-2 border-gray-900 rounded-full flex items-center justify-center mb-4 mx-auto">
            <svg className="w-4 h-4 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Submission recorded</h1>
          <p className="text-sm text-gray-500">Thank you for participating in this study.</p>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden mb-5">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Session Summary</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2 font-medium text-gray-400">Field</th>
                <th className="text-left px-4 py-2 font-medium text-gray-400">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="text-left px-4 py-2.5 text-gray-500 align-top">{r.label}</td>
                  <td className={`text-left px-4 py-2.5 font-medium text-gray-800 align-top break-all ${r.mono ? "font-mono text-gray-500 font-normal" : ""}`}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8" style={{ textAlign: "center" }}>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Review and Submit</h1>
        <p className="text-sm text-gray-500">Review your answer and complete the short survey before submitting.</p>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-2 mb-6 text-xs">
        <span className="border border-gray-200 rounded px-2.5 py-1 text-gray-500 capitalize">{data.mode} mode</span>
        {data.selectedAgentName && (
          <span className="border border-gray-200 rounded px-2.5 py-1 text-gray-500">Selected: {data.selectedAgentName}</span>
        )}
        {data.wasEdited && (
          <span className="border border-gray-200 rounded px-2.5 py-1 text-gray-500">Edited</span>
        )}
      </div>

      {/* Final submission — Change 7: copy button */}
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Your Submission</p>
          <CopyButton text={data.finalSubmission} />
        </div>
        <div className="p-5">
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(data.finalSubmission) }} />
        </div>
      </div>

      {/* Confidence rating */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6">
        <p className="text-sm font-medium text-gray-900 mb-1">How confident are you in this submission?</p>
        <p className="text-xs text-gray-400 mb-4">1 = not confident, 5 = very confident</p>
        <div className="flex gap-2 mb-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="focus:outline-none"
            >
              <svg
                className={`w-8 h-8 transition-colors ${star <= (hoverRating || rating) ? "text-gray-900" : "text-gray-200"}`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-xs text-gray-400">
            {["", "Not confident", "Slightly confident", "Moderately confident", "Quite confident", "Very confident"][rating]}
          </p>
        )}
      </div>

      {/* Post-task survey */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6">
        <p className="text-sm font-medium text-gray-900 mb-1">Quick survey</p>
        <p className="text-xs text-gray-400 mb-4">Rate your experience on each dimension below.</p>
        {LIKERT_QUESTIONS.map((q) => (
          <LikertScale
            key={q.id}
            question={q}
            value={likert[q.id] || 0}
            onChange={(v) => setLikert((prev) => ({ ...prev, [q.id]: v }))}
          />
        ))}
      </div>

      <button
        onClick={handleFinalSubmit}
        disabled={!allAnswered || isSubmitting}
        className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors text-sm"
      >
        {isSubmitting ? "Submitting..." : !allAnswered ? "Complete all fields to submit" : "Submit and complete"}
      </button>

      <p className="text-center text-xs text-gray-400 mt-4">
        Your response is logged anonymously for research purposes.
      </p>
    </div>
  );
}
