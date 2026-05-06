"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+", "Prefer not to say"];
const EDUCATION_LEVELS = ["Undergraduate student", "Graduate student", "PhD student", "Faculty / Researcher", "Industry professional", "Other"];
const AI_FAMILIARITY = [
  "I have never used AI tools",
  "I have used AI tools a few times",
  "I use AI tools regularly",
  "I consider myself an AI expert",
];

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function ConsentPage() {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [demographics, setDemographics] = useState({
    ageRange: "",
    education: "",
    aiFamiliarity: "",
    fieldOfStudy: "",
  });

  const isComplete = consent && demographics.ageRange && demographics.education && demographics.aiFamiliarity;

  function handleBegin() {
    if (!isComplete) return;
    const sessionId = generateSessionId();
    sessionStorage.setItem("humaid_session_id", sessionId);
    sessionStorage.setItem("humaid_start_time", new Date().toISOString());
    sessionStorage.setItem("humaid_demographics", JSON.stringify(demographics));
    sessionStorage.setItem("humaid_consented", "true");
    router.push("/task");
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1 tracking-tight">
          Participant Information and Consent
        </h1>
        <p className="text-sm text-gray-500">
          Please read the following before taking part in this study.
        </p>
      </div>

      {/* Study info */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6 space-y-3">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">About This Study</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            This study examines how people interact with multiple AI agents to complete a literature review task.
            You will be asked to work with AI agents in one of two modes and submit a final written response.
            The session takes approximately 10 to 15 minutes.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Data and Privacy</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Your responses are recorded anonymously. No personally identifiable information is collected.
            Session data including your final submission, time taken, and interaction patterns will be used
            for academic research purposes only.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Participation</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Participation is voluntary. You may stop at any time without consequence.
          </p>
        </div>
      </div>

      {/* Demographics */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">About You</p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Age range</label>
            <div className="grid grid-cols-3 gap-2">
              {AGE_RANGES.map((range) => (
                <button
                  key={range}
                  onClick={() => setDemographics((d) => ({ ...d, ageRange: range }))}
                  className={`text-xs py-2 px-3 rounded border transition-colors ${
                    demographics.ageRange === range
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Education level</label>
            <div className="grid grid-cols-2 gap-2">
              {EDUCATION_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setDemographics((d) => ({ ...d, education: level }))}
                  className={`text-xs py-2 px-3 rounded border transition-colors text-left ${
                    demographics.education === level
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Familiarity with AI tools</label>
            <div className="space-y-2">
              {AI_FAMILIARITY.map((level) => (
                <button
                  key={level}
                  onClick={() => setDemographics((d) => ({ ...d, aiFamiliarity: level }))}
                  className={`w-full text-xs py-2 px-3 rounded border transition-colors text-left ${
                    demographics.aiFamiliarity === level
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              Field of study or work <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Information Systems, Computer Science, Management"
              value={demographics.fieldOfStudy}
              onChange={(e) => setDemographics((d) => ({ ...d, fieldOfStudy: e.target.value }))}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Consent checkbox */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-gray-900 flex-shrink-0"
          />
          <span className="text-sm text-gray-700 leading-relaxed">
            I have read the information above and agree to participate in this study. I understand my
            data will be used for academic research and that I may withdraw at any time.
          </span>
        </label>
      </div>

      <button
        onClick={handleBegin}
        disabled={!isComplete}
        className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors text-sm"
      >
        {isComplete ? "Begin Study" : "Complete all fields to continue"}
      </button>

      <p className="text-xs text-gray-400 text-center mt-4">
        Your responses are anonymous and used for research purposes only.
      </p>
    </div>
  );
}
