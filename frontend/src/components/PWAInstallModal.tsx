"use client";

import { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PWAInstallModal({ isOpen, onClose }: PWAInstallModalProps) {
  const { isInstallable, promptInstall } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setInstalling(true);
    setMessage(null);
    try {
      const outcome = await promptInstall();
      if (outcome) {
        onClose();
      } else {
        // Fallback tip for browsers/iOS
        setMessage(
          "To install: tap your browser menu (⋮ or Share ⎋) and select 'Add to Home Screen'."
        );
      }
    } catch {
      setMessage("Installation could not be started automatically. Try browser menu > Add to Home screen.");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full sm:max-w-md bg-[#131b2e] border border-slate-700/80 rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl relative animate-slideUp text-center"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Brand Icon */}
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white font-black text-4xl">
          E
        </div>

        {/* Title & Value props */}
        <h3 className="text-2xl font-black text-white tracking-tight mb-4">
          Install EventScout
        </h3>

        <div className="text-left bg-slate-900/60 border border-slate-800 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex items-center gap-3 text-sm text-slate-200">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              ✓
            </span>
            <span>Fast and lightweight app</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-200">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              ✓
            </span>
            <span>Works offline with saved events</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-200">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
              ✓
            </span>
            <span>Get instant access & updates</span>
          </div>
        </div>

        {message && (
          <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 p-2.5 rounded-lg mb-4 text-center">
            {message}
          </p>
        )}

        {/* Action Button */}
        <button
          onClick={handleInstallClick}
          disabled={installing}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-base shadow-lg shadow-indigo-600/30 transition-all active-press flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>{installing ? "Adding..." : "Add to Home Screen"}</span>
        </button>
      </div>
    </div>
  );
}
