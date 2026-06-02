"use client";

import { usePathname } from "next/navigation";

export function AdminLogout() {
  const pathname = usePathname();
  if (!pathname.startsWith("/humaidadmin2026")) return null;

  return (
    <button
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        window.location.href = "/humaidadmin2026/login";
      }}
      aria-label="Log out"
      className="flex items-center gap-1.5 text-sm font-medium border border-gray-300 hover:border-red-400 text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-md transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
      </svg>
      Log out
    </button>
  );
}
