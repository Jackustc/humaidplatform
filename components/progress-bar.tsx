"use client";

import { usePathname, useRouter } from "next/navigation";

const STEPS = [
  { label: "Login", path: "/" },
  { label: "Task", path: "/task" },
  { label: "Instructions", path: "/instructions" },
  { label: "Work", path: null }, // dynamic — /collaborative or /competitive
  { label: "Submit", path: "/submit" },
];

function matchStep(label: string, pathname: string) {
  if (label === "Work") return pathname === "/collaborative" || pathname === "/competitive";
  const step = STEPS.find((s) => s.label === label);
  return step?.path === pathname;
}

// Resolve the correct URL for a step, accounting for dynamic Work path
function resolveStepPath(label: string): string | null {
  if (label === "Work") {
    if (typeof window === "undefined") return null;
    const mode = sessionStorage.getItem("humaid_mode");
    if (!mode) return null;
    return mode === "collaborative" ? "/collaborative" : "/competitive";
  }
  return STEPS.find((s) => s.label === label)?.path ?? null;
}

// Check if navigating back to a step is safe (all required session keys are present)
function canNavigateTo(stepIndex: number): boolean {
  if (typeof window === "undefined") return false;
  if (stepIndex === 0) return true; // Login always accessible
  if (stepIndex >= 1 && !sessionStorage.getItem("humaid_participant_id")) return false;
  if (stepIndex >= 2 && !sessionStorage.getItem("humaid_mode")) return false;
  if (stepIndex === 3 && !sessionStorage.getItem("humaid_mode")) return false;
  return true;
}

export function ProgressBar() {
  const pathname = usePathname();
  const router = useRouter();
  const currentIndex = STEPS.findIndex((s) => matchStep(s.label, pathname));
  if (currentIndex === -1) return null;

  function handleStepClick(index: number) {
    // Never allow skipping ahead
    if (index >= currentIndex) return;
    // Check session prerequisites
    if (!canNavigateTo(index)) return;
    const path = resolveStepPath(STEPS[index].label);
    if (path) router.push(path);
  }

  return (
    <div className="border-b border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center justify-center">
        {STEPS.map((step, i) => {
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isClickable = isDone && canNavigateTo(i);

          return (
            <div key={step.label} className="flex items-center">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                    isDone ? "bg-gray-400" : isCurrent ? "bg-gray-900" : "bg-gray-200"
                  }`}
                />
                <span
                  onClick={() => isClickable && handleStepClick(i)}
                  title={isClickable ? `Go back to ${step.label}` : undefined}
                  className={`text-xs transition-colors select-none ${
                    isCurrent
                      ? "text-gray-900 font-medium"
                      : isDone
                      ? isClickable
                        ? "text-gray-400 hover:text-gray-700 cursor-pointer underline-offset-2 hover:underline"
                        : "text-gray-400"
                      : "text-gray-300 cursor-not-allowed"
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
