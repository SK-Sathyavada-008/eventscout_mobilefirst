"use client";

import Link from "next/link";

interface OfflineStateProps {
  onRetry?: () => void;
}

export default function OfflineState({ onRetry }: OfflineStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-6 text-center animate-fadeIn">
      {/* Crossed out Wi-Fi icon in circular badge */}
      <div className="w-24 h-24 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-6 shadow-xl shadow-indigo-950/20">
        <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L3 3m6.343 6.343a4.978 4.978 0 011.414-.343m0 0a5 5 0 014.243 4.243m-4.243-4.243l4.243 4.243" />
        </svg>
      </div>

      <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
        You're offline
      </h2>
      <p className="text-slate-400 text-sm max-w-xs sm:max-w-sm mb-7 leading-relaxed">
        No worries! You can still view your saved events and offline bookmarks.
      </p>

      <div className="flex flex-col w-full max-w-xs gap-3">
        <Link
          href="/saved"
          className="w-full py-3.5 px-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active-press flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span>View Saved Events</span>
        </Link>

        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full py-2.5 px-4 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
          >
            Try Reconnecting ↻
          </button>
        )}
      </div>
    </div>
  );
}
