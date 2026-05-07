"use client";

import { useEffect, useState } from "react";

type Survey = { trust: number; difficulty: number; satisfaction: number; effort: number };
type Session = {
  sessionId: string;
  mode: string;
  startTime: string;
  endTime: string;
  wasEdited: boolean;
  originalLength?: number;
  finalLength?: number;
  charsAdded?: number;
  charsRemoved?: number;
  selectedAgentName?: string;
  confidenceRating: number;
  postTaskSurvey: Survey;
  demographics?: { ageRange: string; education: string; aiFamiliarity: string; fieldOfStudy: string };
  provenanceSummary?: Record<string, number>;
  events?: unknown[];
  loggedAt: string;
};

function duration(start: string, end: string) {
  const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function avg(arr: number[]) {
  if (!arr.length) return "—";
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
}

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => { setSessions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const collaborative = sessions.filter((s) => s.mode === "collaborative");
  const competitive = sessions.filter((s) => s.mode === "competitive");
  const edited = sessions.filter((s) => s.wasEdited);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Research Data</p>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Session Dashboard</h1>
          <p className="text-sm text-gray-500">All recorded participant sessions.</p>
        </div>
        <a
          href="/api/export"
          className="flex-shrink-0 text-sm font-medium border border-gray-300 hover:border-gray-500 text-gray-700 px-4 py-2 rounded-md transition-colors"
        >
          Export CSV
        </a>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="border border-gray-200 rounded-lg p-10 text-center">
          <p className="text-sm text-gray-400">No sessions recorded yet.</p>
          <p className="text-xs text-gray-300 mt-1">Sessions appear here after participants complete the study.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Total sessions", value: sessions.length },
              { label: "Collaborative", value: collaborative.length },
              { label: "Competitive", value: competitive.length },
              { label: "Edited AI output", value: `${edited.length} (${Math.round((edited.length / sessions.length) * 100)}%)` },
            ].map((card) => (
              <div key={card.label} className="border border-gray-200 rounded-lg p-4 bg-white">
                <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                <p className="text-xl font-semibold text-gray-900">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Averages */}
          <div className="border border-gray-200 rounded-lg p-5 mb-6 bg-white">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Survey Averages</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
              {[
                { label: "Confidence", values: sessions.map((s) => s.confidenceRating).filter(Boolean) },
                { label: "Trust", values: sessions.map((s) => s.postTaskSurvey?.trust).filter(Boolean) },
                { label: "Difficulty", values: sessions.map((s) => s.postTaskSurvey?.difficulty).filter(Boolean) },
                { label: "Satisfaction", values: sessions.map((s) => s.postTaskSurvey?.satisfaction).filter(Boolean) },
                { label: "Effort", values: sessions.map((s) => s.postTaskSurvey?.effort).filter(Boolean) },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                  <p className="font-semibold text-gray-900">{avg(item.values)} <span className="text-xs font-normal text-gray-400">/ 5</span></p>
                </div>
              ))}
            </div>
          </div>

          {/* Sessions table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">All Sessions</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Logged At", "Session ID", "Mode", "Duration", "Agent", "Edited", "Orig→Final chars", "Events", "Prov: Agent %", "Confidence", "Trust", "Difficulty", "Satisfaction", "Effort", "Age", "Education"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-gray-400 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...sessions].reverse().map((s) => (
                    <tr key={s.sessionId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                        {s.loggedAt ? new Date(s.loggedAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-400 whitespace-nowrap">{s.sessionId?.slice(0, 18)}…</td>
                      <td className="px-4 py-2.5 capitalize text-gray-700">{s.mode}</td>
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{s.startTime && s.endTime ? duration(s.startTime, s.endTime) : "—"}</td>
                      <td className="px-4 py-2.5 text-gray-700">{s.selectedAgentName ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${s.wasEdited ? "bg-gray-100 text-gray-700" : "text-gray-300"}`}>
                          {s.wasEdited ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                        {s.originalLength != null ? `${s.originalLength} → ${s.finalLength}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-500">{s.events?.length ?? "—"}</td>
                      <td className="px-4 py-2.5 text-center text-gray-500">
                        {s.provenanceSummary
                          ? (() => {
                              const total = Object.values(s.provenanceSummary).reduce((a, b) => a + b, 0);
                              const agent = Object.entries(s.provenanceSummary).filter(([k]) => k !== "user_typed").reduce((a, [, v]) => a + v, 0);
                              return total > 0 ? `${Math.round((agent / total) * 100)}%` : "—";
                            })()
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-700">{s.confidenceRating ?? "—"}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700">{s.postTaskSurvey?.trust ?? "—"}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700">{s.postTaskSurvey?.difficulty ?? "—"}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700">{s.postTaskSurvey?.satisfaction ?? "—"}</td>
                      <td className="px-4 py-2.5 text-center text-gray-700">{s.postTaskSurvey?.effort ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{s.demographics?.ageRange ?? "—"}</td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{s.demographics?.education ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-gray-300 mt-4 text-center">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} — most recent first
          </p>
        </>
      )}
    </div>
  );
}
