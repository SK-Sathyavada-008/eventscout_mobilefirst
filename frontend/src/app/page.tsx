"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Event } from "@/types/event";
import EventCard from "@/components/EventCard";
import { useAuth } from "@/contexts/AuthContext";
import { isHackathon, isWorkshop, EventSectionType } from "@/utils/eventUtils";
import PWAInstallModal from "@/components/PWAInstallModal";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function DiscoverPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth & Saved state
  const { user, token, isAuthenticated, refreshUser, updateUser } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Search & Category
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<EventSectionType>("all");

  // PWA install modal state
  const { isInstallable } = usePWAInstall();
  const [showPWAInstall, setShowPWAInstall] = useState(false);

  // Sync saved event IDs with the authenticated user
  useEffect(() => {
    if (user?.saved_event_ids) {
      setSavedIds(new Set(user.saved_event_ids));
    } else {
      setSavedIds(new Set());
    }
  }, [user?.saved_event_ids]);

  // First-time onboarding check: if user hasn't onboarded yet, redirect to /onboarding
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasOnboarded = localStorage.getItem("eventscout_onboarded");
      if (!hasOnboarded && !isAuthenticated) {
        router.push("/onboarding");
      }
    }
  }, [isAuthenticated, router]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Fetch events
  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${apiUrl}/events?sort_by=recommended`, { headers });
        if (!res.ok) throw new Error("Failed to load events from server.");

        const data = await res.json();
        setEvents(data);
        setError(null);

        // Cache events locally for offline support
        if (typeof window !== "undefined") {
          localStorage.setItem("eventscout_cached_events", JSON.stringify(data));
        }
      } catch (err) {
        console.warn("API unreachable, falling back to local pre-scraped events:", err);
        // Try local storage cache first, then fallback_events.json
        if (typeof window !== "undefined") {
          const cached = localStorage.getItem("eventscout_cached_events");
          if (cached) {
            try {
              setEvents(JSON.parse(cached));
              setError(null);
              setLoading(false);
              return;
            } catch {}
          }
        }

        try {
          const fallbackRes = await fetch("/fallback_events.json");
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            setEvents(fallbackData);
            setError(null);
            return;
          }
        } catch (fallbackErr) {
          console.error("Failed to load fallback events:", fallbackErr);
        }
        setError("Unable to load events. Make sure EventScout backend is active.");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [apiUrl, token]);

  // Handle Save / Unsave
  const handleToggleSave = useCallback(
    async (eventId: string, currentlySaved: boolean) => {
      if (!token) {
        router.push("/login");
        return;
      }

      // Optimistic update
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (currentlySaved) next.delete(eventId);
        else next.add(eventId);
        return next;
      });

      const newSavedList = currentlySaved
        ? (user?.saved_event_ids || []).filter((id) => id !== eventId)
        : [...(user?.saved_event_ids || []), eventId];
      updateUser({ saved_event_ids: newSavedList });

      // Cache saved in localStorage for offline availability
      if (typeof window !== "undefined") {
        localStorage.setItem("eventscout_saved_ids", JSON.stringify(newSavedList));
      }

      try {
        if (!token.startsWith("demo-token-")) {
          const method = currentlySaved ? "DELETE" : "POST";
          await fetch(`${apiUrl}/events/${eventId}/save`, {
            method,
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        refreshUser();
      } catch (err: any) {
        // In offline mode, preserve local update
        console.warn("Save sync kept in offline storage:", err);
      }
    },
    [apiUrl, token, user, refreshUser, updateUser, router]
  );

  // Filtered by Search & Category
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (activeCategory === "hackathons" && !isHackathon(ev)) return false;
      if (activeCategory === "workshops" && !isWorkshop(ev)) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        ev.title?.toLowerCase().includes(q) ||
        ev.organizer?.toLowerCase().includes(q) ||
        ev.categories?.some((c) => c.toLowerCase().includes(q)) ||
        ev.source?.toLowerCase().includes(q)
      );
    });
  }, [events, activeCategory, searchQuery]);

  // Happening This Week / Urgent
  const happeningThisWeek = useMemo(() => {
    const now = new Date();
    const urgent = events.filter((ev) => {
      try {
        const dt = new Date(ev.date_time);
        const diffDays = (dt.getTime() - now.getTime()) / (1000 * 3600 * 24);
        return diffDays >= -1 && diffDays <= 7;
      } catch {
        return false;
      }
    });
    // Fallback to top picks if no events this week
    if (urgent.length === 0) {
      return events.slice(0, 5);
    }
    return urgent.slice(0, 6);
  }, [events]);

  // Recommended for You (Intelligent ranking scores)
  const recommendedEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => (b.ranking_score || 0) - (a.ranking_score || 0))
      .slice(0, 8);
  }, [events]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-6">
      {/* Hero Header matching Screen 2 */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-1">
          Discover what's happening in tech.
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Handpicked hackathons, workshops, and student opportunities.
        </p>
      </div>

      {/* Mobile Search Bar */}
      <div className="relative mb-5">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          id="discover-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search events, companies, skills..."
          className="w-full pl-10 pr-10 py-3 bg-[#131b2e] border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all"
        />
        {searchQuery ? (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
          >
            ✕
          </button>
        ) : (
          <Link
            href="/explore"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-indigo-400"
            title="Advanced Filters & Sort"
          >
            <div className="p-1.5 rounded-lg bg-slate-800/80 text-slate-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
          </Link>
        )}
      </div>

      {/* Quick Categories Matching Screen 2 Grid */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-4 mb-7">
        {[
          { id: "all", label: "All", icon: "⊞", color: "from-indigo-600 to-indigo-500" },
          { id: "hackathons", label: "Hackathons", icon: "⚡", color: "from-amber-600 to-orange-500" },
          { id: "workshops", label: "Workshops", icon: "👥", color: "from-emerald-600 to-teal-500" },
          { id: "conferences", label: "Conferences", icon: "📅", color: "from-purple-600 to-pink-500" },
        ].map((cat) => {
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as EventSectionType)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active-press ${
                isSelected
                  ? "bg-[#1e2742] border-indigo-500/80 shadow-md shadow-indigo-500/10 text-white"
                  : "bg-[#131b2e] border-slate-800 hover:border-slate-700 text-slate-300"
              }`}
            >
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg sm:text-xl mb-1.5 shadow-sm transition-transform ${
                  isSelected
                    ? "bg-gradient-to-br text-white scale-105 " + cat.color
                    : "bg-slate-800/80 text-slate-300"
                }`}
              >
                {cat.icon}
              </div>
              <span className="text-[11px] sm:text-xs font-bold tracking-tight truncate w-full text-center">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className="h-6 bg-slate-800 rounded w-1/3 animate-pulse" />
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-72 h-64 bg-[#131b2e] border border-slate-800 rounded-2xl animate-pulse flex-shrink-0"
              />
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-rose-950/30 border border-rose-800/50 rounded-2xl p-5 text-center text-rose-300 mb-6">
          <p className="font-bold mb-1">Could not connect to live API</p>
          <p className="text-xs text-rose-400">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* SECTION 1: 🔥 Happening This Week (Horizontal Carousel) */}
          {!searchQuery && happeningThisWeek.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔥</span>
                  <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                    Happening This Week
                  </h2>
                </div>
                <Link
                  href="/explore"
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  See all →
                </Link>
              </div>

              {/* Horizontal scrollable carousel */}
              <div className="flex items-stretch gap-3.5 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar snap-x snap-mandatory">
                {happeningThisWeek.map((ev) => (
                  <div key={ev.id || ev.title} className="snap-start">
                    <EventCard
                      event={ev}
                      variant="featured"
                      isSaved={ev.id ? savedIds.has(ev.id) : false}
                      onToggleSave={isAuthenticated ? handleToggleSave : undefined}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: ✨ Recommended for You */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  {searchQuery ? "Search Results" : "Recommended for You"}
                </h2>
              </div>
              <Link
                href="/explore"
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Explore All ({filteredEvents.length}) →
              </Link>
            </div>

            {/* If search query is active, show filtered; otherwise show top recommendations */}
            <div className="space-y-3">
              {(searchQuery ? filteredEvents : recommendedEvents).map((ev) => (
                <EventCard
                  key={ev.id || ev.title}
                  event={ev}
                  variant="compact"
                  isSaved={ev.id ? savedIds.has(ev.id) : false}
                  onToggleSave={isAuthenticated ? handleToggleSave : undefined}
                />
              ))}

              {(searchQuery ? filteredEvents : recommendedEvents).length === 0 && (
                <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-8 text-center">
                  <span className="text-3xl block mb-2">🔍</span>
                  <p className="text-white font-bold text-base mb-1">No matching events found</p>
                  <p className="text-slate-400 text-xs mb-4">
                    Try another search keyword or switch categories.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setActiveCategory("all");
                    }}
                    className="py-2 px-4 bg-indigo-600 text-white text-xs font-bold rounded-xl"
                  >
                    Clear Search
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* PWA Install banner for Android Chrome users */}
      {isInstallable && (
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 border border-indigo-500/30 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              E
            </div>
            <div>
              <p className="text-xs font-bold text-white">Install EventScout App</p>
              <p className="text-[11px] text-slate-400">Add to home screen for offline access</p>
            </div>
          </div>
          <button
            onClick={() => setShowPWAInstall(true)}
            className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md active-press whitespace-nowrap"
          >
            Install
          </button>
        </div>
      )}

      <PWAInstallModal
        isOpen={showPWAInstall}
        onClose={() => setShowPWAInstall(false)}
      />
    </div>
  );
}
