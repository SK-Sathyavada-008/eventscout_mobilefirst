"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus();

  if (isOnline && !wasOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-300 ${
        !isOnline
          ? "bg-amber-600 text-white shadow-md"
          : "bg-emerald-600 text-white shadow-md animate-fadeIn"
      }`}
    >
      {!isOnline ? (
        <>
          <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L3 3m6.343 6.343a4.978 4.978 0 011.414-.343m0 0a5 5 0 014.243 4.243m-4.243-4.243l4.243 4.243" />
          </svg>
          <span>You are offline. Showing cached content & saved events.</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Connection restored. Back online!</span>
        </>
      )}
    </div>
  );
}
