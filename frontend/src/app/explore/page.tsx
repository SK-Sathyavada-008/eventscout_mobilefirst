"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Event } from "@/types/event";
import EventCard from "@/components/EventCard";
import { useAuth } from "@/contexts/AuthContext";
import { isHackathon, isWorkshop } from "@/utils/eventUtils";

function ExploreContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auth & Saved
  const { user, token, isAuthenticated, refreshUser, updateUser } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategoryChip, setSelectedCategoryChip] = useState<string>("All");
  const [selectedMode, setSelectedMode] = useState<string>("All");
  const [selectedPrice, setSelectedPrice] = useState<string>("All");
  const [selectedSource, setSelectedSource] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("recommended");

  // Modal bottom sheet states
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Sync saved IDs
  useEffect(() => {
    if (user?.saved_event_ids) {
      setSavedIds(new Set(user.saved_event_ids));
    }
  }, [user?.saved_event_ids]);

  // Fetch events
  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${apiUrl}/events?sort_by=${sortBy}`, { headers });
        if (!res.ok) throw new Error("Could not load events.");

        const data = await res.json();
        setEvents(data);
        setError(null);
      } catch (err) {
        console.warn("Using fallback events:", err);
        try {
          const fallbackRes = await fetch("/fallback_events.json");
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            setEvents(fallbackData);
            setError(null);
            return;
          }
        } catch {}
        setError("Could not load events from server.");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [apiUrl, sortBy, token]);

  // Handle Save / Unsave
  const handleToggleSave = useCallback(
    async (eventId: string, currentlySaved: boolean) => {
      if (!token) return;

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

      try {
        if (token) {
          await fetch(`${apiUrl}/events/${eventId}/save`, {
            method: currentlySaved ? "DELETE" : "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        refreshUser();
      } catch (err) {
        console.warn("Saved event updated offline:", err);
      }
    },
    [apiUrl, token, user, refreshUser, updateUser]
  );

  // Available sources list
  const availableSources = useMemo(() => {
    const s = new Set<string>();
    events.forEach((ev) => {
      if (ev.source) s.add(ev.source);
    });
    return ["All", ...Array.from(s).sort()];
  }, [events]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Category chip filter
      if (selectedCategoryChip === "Hackathons" && !isHackathon(ev)) return false;
      if (selectedCategoryChip === "Workshops" && !isWorkshop(ev)) return false;
      if (
        selectedCategoryChip !== "All" &&
        selectedCategoryChip !== "Hackathons" &&
        selectedCategoryChip !== "Workshops"
      ) {
        if (selectedCategoryChip === "Conferences") {
          const isConf = ev.title?.toLowerCase().includes('conference') || 
                         ev.categories?.some(c => c.toLowerCase().includes('conference') || c.toLowerCase().includes('meetup'));
          if (!isConf) return false;
        } else {
          const match = ev.categories?.some(
            (c) => c.toLowerCase() === selectedCategoryChip.toLowerCase()
          );
          if (!match) return false;
        }
      }

      // Mode filter
      if (selectedMode !== "All") {
        const loc = (ev.mode_location || "").toLowerCase();
        if (selectedMode === "Online" && !loc.includes("online")) return false;
        if (selectedMode === "In-Person" && loc.includes("online")) return false;
      }

      // Price filter
      if (selectedPrice === "Free" && !ev.is_free) return false;
      if (selectedPrice === "Paid" && ev.is_free) return false;

      // Source filter
      if (selectedSource !== "All" && ev.source?.toLowerCase() !== selectedSource.toLowerCase()) {
        return false;
      }

      // Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        ev.title?.toLowerCase().includes(q) ||
        ev.organizer?.toLowerCase().includes(q) ||
        ev.description?.toLowerCase().includes(q) ||
        ev.categories?.some((c) => c.toLowerCase().includes(q)) ||
        ev.source?.toLowerCase().includes(q)
      );
    });
  }, [events, selectedCategoryChip, selectedMode, selectedPrice, selectedSource, searchQuery]);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedMode !== "All") count++;
    if (selectedPrice !== "All") count++;
    if (selectedSource !== "All") count++;
    if (selectedCategoryChip !== "All") count++;
    return count;
  }, [selectedMode, selectedPrice, selectedSource, selectedCategoryChip]);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategoryChip("All");
    setSelectedMode("All");
    setSelectedPrice("All");
    setSelectedSource("All");
    setSortBy("recommended");
    setIsFilterSheetOpen(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-2 sm:pt-6 pb-6">
      {/* Top Title matching Screen 3 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Explore
        </h1>
        {activeFiltersCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-xs font-bold text-rose-400 hover:text-rose-300"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative mb-3.5">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search events, topics, organizers..."
          className="w-full pl-10 pr-10 py-3 bg-[#131b2e] border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter & Sort Controls Row matching Screen 3 */}
      <div className="flex items-center gap-2.5 mb-3.5">
        {/* Filters Button */}
        <button
          onClick={() => setIsFilterSheetOpen(true)}
          className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all active-press ${
            activeFiltersCount > 0
              ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
              : "bg-[#131b2e] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-extrabold">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* Sort Button */}
        <button
          onClick={() => setIsSortSheetOpen(true)}
          className="flex-1 py-2.5 px-4 rounded-xl bg-[#131b2e] border border-slate-800 text-slate-300 hover:border-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all active-press"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          <span className="capitalize">
            Sort: {sortBy === "recommended" ? "Recommended" : sortBy}
          </span>
          <span className="text-[10px]">▼</span>
        </button>
      </div>

      {/* Category Chips (Horizontal Scrollable) matching Screen 3 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar mb-4">
        {[
          "All",
          "Hackathons",
          "Workshops",
          "Conferences",
          "Internships",
          "Competitions",
        ].map((chip) => {
          const isSelected = selectedCategoryChip === chip;
          return (
            <button
              key={chip}
              onClick={() => setSelectedCategoryChip(chip)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all active-press ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-[#131b2e] text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* Opportunities Count matching Screen 3 */}
      <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
        <span className="font-semibold text-slate-300">
          {filteredEvents.length} opportunities found
        </span>
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-24 bg-[#131b2e] border border-slate-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Event List (Vertical single column matching Screen 3) */}
      {!loading && !error && (
        <div className="space-y-3">
          {filteredEvents.map((ev) => (
            <EventCard
              key={ev.id || ev.title}
              event={ev}
              variant="compact"
              isSaved={ev.id ? savedIds.has(ev.id) : false}
              onToggleSave={isAuthenticated ? handleToggleSave : undefined}
            />
          ))}

          {filteredEvents.length === 0 && (
            <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-10 text-center">
              <span className="text-4xl block mb-3">🔍</span>
              <h3 className="text-lg font-bold text-white mb-1">No events found</h3>
              <p className="text-slate-400 text-xs mb-5 max-w-xs mx-auto">
                Try adjusting your search criteria or resetting filters.
              </p>
              <button
                onClick={resetFilters}
                className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter Bottom Sheet Modal */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full sm:max-w-md bg-[#131b2e] border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-lg font-black text-white">Filters</h3>
              <button
                onClick={() => setIsFilterSheetOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/80"
              >
                ✕
              </button>
            </div>

            {/* Mode */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["All", "Online", "In-Person"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMode(m)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedMode === m
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Price
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["All", "Free", "Paid"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPrice(p)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedPrice === p
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Source Platform
              </label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full py-2.5 px-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-medium text-white capitalize outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {availableSources.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={resetFilters}
                className="flex-1 py-3 px-4 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => setIsFilterSheetOpen(false)}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sort Bottom Sheet Modal */}
      {isSortSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full sm:max-w-md bg-[#131b2e] border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="text-lg font-black text-white">Sort By</h3>
              <button
                onClick={() => setIsSortSheetOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/80"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {[
                { id: "recommended", label: "🌟 Recommended (Intelligent)", desc: "Host reputation & match score" },
                { id: "soonest", label: "📅 Soonest Event", desc: "Happening upcoming dates" },
                { id: "deadline", label: "⏳ Registration Deadline", desc: "Closing soonest first" },
                { id: "newest", label: "🆕 Newly Discovered", desc: "Latest scraped events" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSortBy(s.id);
                    setIsSortSheetOpen(false);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                    sortBy === s.id
                      ? "bg-indigo-600/20 border-indigo-500 text-white"
                      : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold">{s.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{s.desc}</div>
                  </div>
                  {sortBy === s.id && (
                    <span className="text-indigo-400 font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-8 text-center text-slate-400 text-sm">
          Loading explore page...
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
