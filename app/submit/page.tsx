"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type SessionData = {
  sessionId: string;
  mode: "collaborative" | "competitive";
  task: string;
  startTime: string;
  endTime: string;
  finalSubmission: string;
  wasEdited: boolean;
  selectedAgent?: number;
  selectedAgentName?: string;
};

export default function SubmitPage() {
  const [data, setData] = useState<SessionData | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("humaid_session_data");
    if (raw) setData(JSON.parse(raw));
  }, []);

  async function handleFinalSubmit() {
    if (rating === 0) return;
    setIsSubmitting(true);
    try {
      await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, confidenceRating: rating }),
      });
    } catch {
      // Non-critical
    }
    setIsSubmitting(false);
    setSubmitted(true);
  }

  if (!data) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <p className="text-sm text-gray-400">No session data found.</p>
        <Link href="/" className="text-gray-700 underline text-sm mt-2 inline-block">
          Return to home
        </Link>
      </div>
    );
  }

  if (submitted) {
    const durationSec = data.startTime && data.endTime
      ? Math.round((new Date(data.endTime).getTime() - new Date(data.startTime).getTime()) / 1000)
      : null;

    return (
      <div className="max-w-xl mx-auto py-16">
        <div className="mb-8">
          <div className="w-10 h-10 border-2 border-gray-900 rounded-full flex items-center justify-center mb-5">
            <svg className="w-5 h-5 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Submission recorded</h1>
          <p className="text-sm text-gray-500">Thank you for participating in this study.</p>
        </div>

        <div className="border border-gray-200 rounded-lg p-5 text-sm text-gray-600 space-y-2 mb-8">
          <div className="flex justify-between">
            <span className="text-gray-400 text-xs">Mode</span>
            <span className="text-xs font-medium capitalize">{data.mode}</span>
          </div>
          {data.selectedAgentName && (
            <div className="flex justify-between">
              <span className="text-gray-400 text-xs">Selected agent</span>
              <span className="text-xs font-medium">{data.selectedAgentName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400 text-xs">Confidence rating</span>
            <span className="text-xs font-medium">{rating} / 5</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-xs">Response edited</span>
            <span className="text-xs font-medium">{data.wasEdited ? "Yes" : "No"}</span>
          </div>
          {durationSec !== null && (
            <div className="flex justify-between">
              <span className="text-gray-400 text-xs">Duration</span>
              <span className="text-xs font-medium">
                {durationSec < 60 ? `${durationSec}s` : `${Math.round(durationSec / 60)}m`}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400 text-xs">Session ID</span>
            <span className="text-xs font-mono text-gray-500">{data.sessionId}</span>
          </div>
        </div>

        <Link
          href="/"
          className="inline-block border border-gray-300 hover:border-gray-500 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-md transition-colors"
        >
          Start a new session
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Review & Submit</h1>
        <p className="text-sm text-gray-500">
          Review your final answer and rate your confidence before submitting.
        </p>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-2 mb-6 text-xs">
        <span className="border border-gray-200 rounded px-2.5 py-1 text-gray-500 capitalize">
          {data.mode} mode
        </span>
        {data.selectedAgentName && (
          <span className="border border-gray-200 rounded px-2.5 py-1 text-gray-500">
            Selected: {data.selectedAgentName}
          </span>
        )}
        {data.wasEdited && (
          <span className="border border-gray-200 rounded px-2.5 py-1 text-gray-500">
            Edited
          </span>
        )}
      </div>

      {/* Final text */}
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Your Submission</p>
        </div>
        <div className="p-5">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{data.finalSubmission}</p>
        </div>
      </div>

      {/* Confidence */}
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
                className={`w-8 h-8 transition-colors ${
                  star <= (hoverRating || rating) ? "text-gray-900" : "text-gray-200"
                }`}
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

      <button
        onClick={handleFinalSubmit}
        disabled={rating === 0 || isSubmitting}
        className="w-full bg-gray-900 hover:bg-gray-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors text-sm"
      >
        {isSubmitting ? "Submitting..." : rating === 0 ? "Select a confidence rating to continue" : "Submit & complete"}
      </button>

      <p className="text-center text-xs text-gray-400 mt-4">
        Your response is logged anonymously for research purposes.
      </p>
    </div>
  );
}
