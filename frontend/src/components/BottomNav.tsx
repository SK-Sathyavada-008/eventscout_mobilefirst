"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const savedCount = user?.saved_event_ids?.length || 0;

  // Don't show bottom nav on onboarding screen
  if (pathname === "/onboarding") return null;

  const navItems = [
    {
      label: "Home",
      href: "/",
      icon: (active: boolean) => (
        <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: "Explore",
      href: "/explore",
      icon: (active: boolean) => (
        <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      label: "Saved",
      href: "/saved",
      badge: savedCount > 0 ? savedCount : undefined,
      icon: (active: boolean) => (
        <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
    },
    {
      label: "Profile",
      href: "/profile",
      icon: (active: boolean) => (
        <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? 0 : 2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0b0f19]/95 backdrop-blur-md border-t border-slate-800/80 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] transition-all shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[64px] py-1 px-2 rounded-xl transition-all relative active-press ${
                isActive
                  ? "text-indigo-400 font-bold"
                  : "text-slate-400 hover:text-slate-200 font-medium"
              }`}
            >
              <div className="relative flex items-center justify-center">
                {item.icon(isActive)}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-indigo-600 text-white min-w-[16px] text-center leading-tight">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{item.label}</span>
              {isActive && (
                <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-indigo-400" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
