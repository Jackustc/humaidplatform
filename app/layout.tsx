import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ProgressBar } from "@/components/progress-bar";
import { ErrorBoundary } from "@/components/error-boundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HUMAID Platform",
  description: "Human Multi-Agent AI Interaction Dynamics — Research Prototype",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full bg-white text-gray-900`}>
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold tracking-tight">H</span>
              </div>
              <span className="text-lg font-bold text-gray-900 tracking-tight">HUMAID Platform</span>
            </a>
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-400 font-mono hidden sm:inline">Research Prototype v1</span>
            </div>
          </div>
        </nav>
        <ProgressBar />
        <main className="max-w-5xl mx-auto px-6 py-10">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </body>
    </html>
  );
}
