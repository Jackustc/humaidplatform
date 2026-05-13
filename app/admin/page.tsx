"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";

type Survey = { trust: number; difficulty: number; satisfaction: number; effort: number };

type LogEntry = {
  id: string;
  timestamp: string;
  actor: string;
  type: string;
  content: string;
};

type AgentOutput = {
  id: number;
  name: string;
  style: string;
  output: string;
  critique: string;
};

type RoundLog = {
  roundNumber: number;
  userMessage: string;
  logs?: LogEntry[];
  // collaborative extras
  keywordCount?: number;
  paperCount?: number;
  // competitive extras
  agentOutputs?: AgentOutput[];
  coordinatorDecision?: string;
  coordinatorRationale?: string;
};

type Session = {
  sessionId: string;
  participantId?: string;
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
  rounds?: RoundLog[];
  loggedAt: string;
};

// ── Actor badge colours (matches participant-facing pages) ──────────────────
const ACTOR_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  orchestrator: { bg: "bg-gray-900",    text: "text-white",        label: "Orchestrator" },
  coordinator:  { bg: "bg-gray-900",    text: "text-white",        label: "Coordinator"  },
  agent_a:      { bg: "bg-blue-100",    text: "text-blue-800",     label: "Agent A"      },
  agent_b:      { bg: "bg-emerald-100", text: "text-emerald-800",  label: "Agent B"      },
  agent_c:      { bg: "bg-violet-100",  text: "text-violet-800",   label: "Agent C"      },
};

const TYPE_LABEL: Record<string, string> = {
  plan:       "📋 Plan",
  assignment: "→ Brief",
  output:     "✓ Output",
  review:     "🔍 Review",
  critique:   "💬 Critique",
  decision:   "⚖️ Decision",
  final:      "✅ Complete",
};

// ── Log Modal ───────────────────────────────────────────────────────────────
function LogModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const dur = session.startTime && session.endTime
    ? duration(session.startTime, session.endTime)
    : "—";

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-white w-full max-w-3xl mx-4 my-8 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Modal header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Conversation Log</p>
            <h2 className="text-base font-semibold text-gray-900 capitalize">{session.mode} Mode</h2>
            <div className="flex flex-wrap gap-3 mt-2">
              <span className="text-xs text-gray-400 font-mono">{session.sessionId}</span>
              {session.participantId && (
                <span className="text-xs text-gray-500">Participant: <span className="font-medium">{session.participantId}</span></span>
              )}
              <span className="text-xs text-gray-500">Duration: <span className="font-medium">{dur}</span></span>
              <span className="text-xs text-gray-500">Rounds: <span className="font-medium">{session.rounds?.length ?? 1}</span></span>
              <span className="text-xs text-gray-500">Edited: <span className="font-medium">{session.wasEdited ? "Yes" : "No"}</span></span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1 flex-shrink-0 ml-4"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable log body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {!session.rounds || session.rounds.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No conversation log saved for this session.</p>
          ) : (
            session.rounds.map((round) => (
              <div key={round.roundNumber}>
                {/* Round header */}
                <div className="mb-3">
                  <span className="text-xs font-semibold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-full">
                    Round {round.roundNumber}
                  </span>
                </div>

                {/* User message — shown for every round */}
                {round.userMessage && (
                  <div className="mb-3 border border-blue-100 bg-blue-50 rounded-lg px-4 py-3">
                    <p className="text-xs font-medium text-blue-500 uppercase tracking-widest mb-1">
                      {round.roundNumber === 1 ? "User's initial brief" : "User feedback"}
                    </p>
                    <p className="text-xs text-gray-700 leading-relaxed">{round.userMessage}</p>
                  </div>
                )}

                {/* Log entries */}
                {round.logs && round.logs.length > 0 ? (
                  <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                    {round.logs.map((entry, i) => {
                      const style = ACTOR_STYLE[entry.actor] ?? { bg: "bg-gray-100", text: "text-gray-700", label: entry.actor };
                      const prefix = TYPE_LABEL[entry.type] ?? entry.type;
                      return (
                        <div key={entry.id ?? i} className="flex gap-3 px-4 py-2.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 h-fit mt-0.5 ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                          <div>
                            <span className="text-xs font-medium text-gray-400 mr-1.5">{prefix}</span>
                            <span className="text-xs text-gray-600 leading-relaxed">{entry.content}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 pl-1">No log entries for this round.</p>
                )}

                {/* Competitive: agent outputs */}
                {round.agentOutputs && round.agentOutputs.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {round.agentOutputs.map((agent) => (
                      <details key={agent.id} className="border border-gray-100 rounded-lg">
                        <summary className="px-4 py-2.5 text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-50 rounded-lg list-none flex items-center justify-between">
                          <span>{agent.name} — {agent.style}</span>
                          <span className="text-gray-300">▸ expand</span>
                        </summary>
                        <div className="px-4 pb-3 space-y-2 border-t border-gray-50">
                          <div className="bg-gray-50 rounded p-3 mt-2">
                            <p className="text-xs font-medium text-gray-400 mb-1">Output</p>
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{agent.output}</p>
                          </div>
                          <div className="bg-amber-50 rounded p-3">
                            <p className="text-xs font-medium text-amber-600 mb-1">Critique</p>
                            <p className="text-xs text-gray-600 leading-relaxed">{agent.critique}</p>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                )}

                {/* Coordinator decision */}
                {round.coordinatorDecision && (
                  <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Coordinator Decision</p>
                    <p className="text-xs text-gray-700">{round.coordinatorDecision}</p>
                    {round.coordinatorRationale && (
                      <p className="text-xs text-gray-500 mt-1 italic">{round.coordinatorRationale}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="text-sm font-medium border border-gray-300 hover:border-gray-500 text-gray-700 px-4 py-2 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function duration(start: string, end: string) {
  const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function avg(arr: number[]) {
  if (!arr.length) return "—";
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
}

function avgNum(arr: number[]): number {
  if (!arr.length) return 0;
  return parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2));
}

const tickStyle = { fontSize: 10, fill: "#9ca3af" };

// ── Admin Page ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLog, setActiveLog] = useState<Session | null>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then(async (r) => {
        if (r.status === 401) { window.location.href = "/admin/login"; return; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setSessions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => { console.error("[admin]", err); setLoading(false); });
  }, []);

  const collaborative = sessions.filter((s) => s.mode === "collaborative");
  const competitive   = sessions.filter((s) => s.mode === "competitive");
  const edited        = sessions.filter((s) => s.wasEdited);

  const modeData = [
    { mode: "Collaborative", count: collaborative.length },
    { mode: "Competitive",   count: competitive.length  },
  ];

  const confidenceData = [1, 2, 3, 4, 5].map((r) => ({
    rating: String(r),
    count: sessions.filter((s) => s.confidenceRating === r).length,
  }));

  const surveyAvgData = [
    { label: "Trust",        value: avgNum(sessions.map((s) => s.postTaskSurvey?.trust).filter(Boolean))        },
    { label: "Difficulty",   value: avgNum(sessions.map((s) => s.postTaskSurvey?.difficulty).filter(Boolean))   },
    { label: "Satisfaction", value: avgNum(sessions.map((s) => s.postTaskSurvey?.satisfaction).filter(Boolean)) },
    { label: "Effort",       value: avgNum(sessions.map((s) => s.postTaskSurvey?.effort).filter(Boolean))       },
  ];

  const editRateData = [
    { mode: "Collaborative", total: collaborative.length, edited: collaborative.filter((s) => s.wasEdited).length },
    { mode: "Competitive",   total: competitive.length,   edited: competitive.filter((s) => s.wasEdited).length   },
  ];

  return (
    <>
      {/* Log Modal */}
      {activeLog && <LogModal session={activeLog} onClose={() => setActiveLog(null)} />}

      <div className="w-full">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Research Data</p>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Session Dashboard</h1>
            <p className="text-sm text-gray-500">All recorded participant sessions.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/export"
              className="flex-shrink-0 text-sm font-medium border border-gray-300 hover:border-gray-500 text-gray-700 px-4 py-2 rounded-md transition-colors"
            >
              Export CSV
            </a>
            <button
              onClick={async () => {
                await fetch("/api/admin/logout", { method: "POST" });
                window.location.href = "/admin/login";
              }}
              className="flex-shrink-0 text-sm font-medium text-gray-400 hover:text-gray-700 px-3 py-2 transition-colors"
            >
              Log out
            </button>
          </div>
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
                { label: "Total sessions",  value: sessions.length },
                { label: "Collaborative",   value: collaborative.length },
                { label: "Competitive",     value: competitive.length },
                { label: "Edited AI output", value: `${edited.length} (${Math.round((edited.length / sessions.length) * 100)}%)` },
              ].map((card) => (
                <div key={card.label} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                  <p className="text-xl font-semibold text-gray-900">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Sessions table — latest first, full width, no horizontal scroll */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">All Sessions</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Session ID</th>
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium whitespace-nowrap">Logged At</th>
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Mode</th>
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Log</th>
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Duration</th>
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Agent</th>
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Edited</th>
                    <th className="text-center px-3 py-2.5 text-gray-400 font-medium">Conf.</th>
                    <th className="text-center px-3 py-2.5 text-gray-400 font-medium">Trust</th>
                    <th className="text-center px-3 py-2.5 text-gray-400 font-medium">Diff.</th>
                    <th className="text-center px-3 py-2.5 text-gray-400 font-medium">Sat.</th>
                    <th className="text-center px-3 py-2.5 text-gray-400 font-medium">Effort</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.sessionId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-gray-400">{s.sessionId?.slice(0, 20)}…</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                        {s.loggedAt ? new Date(s.loggedAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2.5 capitalize text-gray-700">{s.mode}</td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setActiveLog(s)}
                          className="text-xs font-medium text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-400 px-2 py-1 rounded transition-colors"
                        >
                          View Log
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                        {s.startTime && s.endTime ? duration(s.startTime, s.endTime) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">{s.selectedAgentName ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded font-medium ${s.wasEdited ? "bg-gray-100 text-gray-700" : "text-gray-300"}`}>
                          {s.wasEdited ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-700">{s.confidenceRating ?? "—"}</td>
                      <td className="px-3 py-2.5 text-center text-gray-700">{s.postTaskSurvey?.trust ?? "—"}</td>
                      <td className="px-3 py-2.5 text-center text-gray-700">{s.postTaskSurvey?.difficulty ?? "—"}</td>
                      <td className="px-3 py-2.5 text-center text-gray-700">{s.postTaskSurvey?.satisfaction ?? "—"}</td>
                      <td className="px-3 py-2.5 text-center text-gray-700">{s.postTaskSurvey?.effort ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Survey averages */}
            <div className="border border-gray-200 rounded-lg p-5 mb-6 bg-white">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Survey Averages</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                {[
                  { label: "Confidence",   values: sessions.map((s) => s.confidenceRating).filter(Boolean)          },
                  { label: "Trust",        values: sessions.map((s) => s.postTaskSurvey?.trust).filter(Boolean)       },
                  { label: "Difficulty",   values: sessions.map((s) => s.postTaskSurvey?.difficulty).filter(Boolean)  },
                  { label: "Satisfaction", values: sessions.map((s) => s.postTaskSurvey?.satisfaction).filter(Boolean)},
                  { label: "Effort",       values: sessions.map((s) => s.postTaskSurvey?.effort).filter(Boolean)      },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                    <p className="font-semibold text-gray-900">{avg(item.values)} <span className="text-xs font-normal text-gray-400">/ 5</span></p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pie charts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

              {/* Pie 1 — Sessions by Mode */}
              <div className="border border-gray-200 rounded-lg p-5 bg-white">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Sessions by Mode</p>
                <p className="text-xs text-gray-400 mb-3">Total {sessions.length} sessions — collaborative vs competitive split</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: `Collaborative (${collaborative.length})`, value: collaborative.length },
                        { name: `Competitive (${competitive.length})`,     value: competitive.length  },
                      ]}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={collaborative.length && competitive.length ? 3 : 0}
                      dataKey="value"
                    >
                      <Cell fill="#111827" />
                      <Cell fill="#9ca3af" />
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value} session${value !== 1 ? "s" : ""}`, ""]}
                      contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 6 }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span style={{ fontSize: 11, color: "#6b7280" }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Pie 2 — AI Output Acceptance Rate */}
              <div className="border border-gray-200 rounded-lg p-5 bg-white">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">AI Output Acceptance</p>
                <p className="text-xs text-gray-400 mb-3">How many participants accepted the AI output without editing</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: `Accepted as-is (${sessions.length - edited.length})`, value: sessions.length - edited.length },
                        { name: `Edited output (${edited.length})`,                    value: edited.length                   },
                      ]}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={edited.length && edited.length < sessions.length ? 3 : 0}
                      dataKey="value"
                    >
                      <Cell fill="#111827" />
                      <Cell fill="#d1d5db" />
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value} session${value !== 1 ? "s" : ""}`, ""]}
                      contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 6 }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span style={{ fontSize: 11, color: "#6b7280" }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

            </div>

            {/* Bar charts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="border border-gray-200 rounded-lg p-5 bg-white">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Mode Distribution</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={modeData} barCategoryGap="40%">
                    <XAxis dataKey="mode" tick={tickStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 6 }} cursor={{ fill: "#f9fafb" }} />
                    <Bar dataKey="count" fill="#111827" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="border border-gray-200 rounded-lg p-5 bg-white">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Confidence Rating Distribution</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={confidenceData} barCategoryGap="30%">
                    <XAxis dataKey="rating" tick={tickStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 6 }} cursor={{ fill: "#f9fafb" }} />
                    <Bar dataKey="count" fill="#6b7280" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="border border-gray-200 rounded-lg p-5 bg-white">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Survey Averages Comparison</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={surveyAvgData} barCategoryGap="40%">
                    <XAxis dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={tickStyle} axisLine={false} tickLine={false} domain={[0, 5]} />
                    <Tooltip contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 6 }} cursor={{ fill: "#f9fafb" }} />
                    <Bar dataKey="value" fill="#374151" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="border border-gray-200 rounded-lg p-5 bg-white">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Edit Rate by Mode</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={editRateData} barCategoryGap="30%">
                    <XAxis dataKey="mode" tick={tickStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 6 }} cursor={{ fill: "#f9fafb" }} />
                    <Bar dataKey="total"  fill="#9ca3af" radius={[3, 3, 0, 0]} name="Total" />
                    <Bar dataKey="edited" fill="#111827" radius={[3, 3, 0, 0]} name="Edited" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <p className="text-xs text-gray-300 mt-4 text-center">
              {sessions.length} session{sessions.length !== 1 ? "s" : ""} — most recent first
            </p>
          </>
        )}
      </div>
    </>
  );
}
