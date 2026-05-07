"use client";

import { usePathname } from "next/navigation";

const STEPS = [
  { label: "Consent", match: (p: string) => p === "/" },
  { label: "Task", match: (p: string) => p === "/task" },
  { label: "Instructions", match: (p: string) => p === "/instructions" },
  { label: "Work", match: (p: string) => p === "/collaborative" || p === "/competitive" },
  { label: "Submit", match: (p: string) => p === "/submit" },
];

export function ProgressBar() {
  const pathname = usePathname();
  const currentIndex = STEPS.findIndex((s) => s.match(pathname));
  if (currentIndex === -1) return null;

  return (
    <div className="border-b border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center">
        {STEPS.map((step, i) => {
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div key={step.label} className="flex items-center">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                    isDone ? "bg-gray-400" : isCurrent ? "bg-gray-900" : "bg-gray-200"
                  }`}
                />
                <span
                  className={`text-xs transition-colors ${
                    isCurrent ? "text-gray-900 font-medium" : isDone ? "text-gray-400" : "text-gray-300"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-px mx-2 flex-shrink-0 ${isDone ? "bg-gray-300" : "bg-gray-100"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
