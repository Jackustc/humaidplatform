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
      className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
    >
      Log out
    </button>
  );
}



