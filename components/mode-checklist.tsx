type Step = { label: string; time: string };

const CHECKLISTS: Record<"collaborative" | "competitive", { total: string; steps: Step[] }> = {
  collaborative: {
    total: "about 10-15 minutes",
    steps: [
      { label: "Describe your task and set any preferences or per-agent instructions", time: "~1 min" },
      { label: "Start the pipeline and follow the orchestrator's plan and each agent's handoff", time: "~3-4 min" },
      { label: "Read the final report produced by the last agent", time: "~2-3 min" },
      { label: "Edit the report, or send feedback to run the pipeline again", time: "~3-4 min" },
      { label: "Submit your answer and complete the short survey", time: "~1-2 min" },
    ],
  },
  competitive: {
    total: "about 10-15 minutes",
    steps: [
      { label: "Describe your task and set any preferences or per-agent styles", time: "~1 min" },
      { label: "Run the agents and read all three reports and their critiques", time: "~4-5 min" },
      { label: "Review the orchestrator's decision and choose the best output", time: "~2 min" },
      { label: "Edit the chosen report, or request another round with feedback", time: "~3-4 min" },
      { label: "Submit your answer and complete the short survey", time: "~1-2 min" },
    ],
  },
};

export function ModeChecklist({ mode }: { mode: "collaborative" | "competitive" }) {
  const { total, steps } = CHECKLISTS[mode];

  return (
    <div className="border border-gray-200 rounded-lg p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Your To-Do List</p>
        <span className="text-xs text-gray-500">Estimated time: {total}</span>
      </div>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="w-5 h-5 bg-gray-900 text-white rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-sm text-gray-600 leading-relaxed flex-1">{step.label}</span>
            <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5">{step.time}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
