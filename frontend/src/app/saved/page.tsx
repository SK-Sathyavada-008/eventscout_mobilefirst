"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Event } from "@/types/event";
import EventCard from "@/components/EventCard";
import { useAuth } from "@/contexts/AuthContext";

function SavedEventsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") === "attending" ? "attending" : "saved";

  const { user, token, isAuthenticated, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"saved" | "attending">(initialTab);
  const [savedEvents, setSavedEvents] = useState<Event[]>([]);
  const [attendingEvents, setAttendingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Fetch saved events
  const fetchSavedEvents = useCallback(async () => {
    setLoading(true);
    try {
      if (token && !token.startsWith("demo-token-")) {
        try {
          const res = await fetch(`${apiUrl}/events/saved`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data: Event[] = await res.json();
            setSavedEvents(data);
            // Cache in local storage for offline
            if (typeof window !== "undefined") {
              localStorage.setItem("eventscout_cached_saved_events", JSON.stringify(data));
            }
            setLoading(false);
            return;
          }
        } catch (apiErr) {
          console.warn("API unreachable, trying fallback:", apiErr);
        }
      }

      // Fallback: use user.saved_event_ids or local cache
      let userSavedIds = new Set(user?.saved_event_ids || []);
      if (typeof window !== "undefined") {
        const cachedIds = localStorage.getItem("eventscout_saved_ids");
        if (cachedIds) {
          try {
            const parsed = JSON.parse(cachedIds);
            parsed.forEach((id: string) => userSavedIds.add(id));
          } catch {}
        }
        const cachedSaved = localStorage.getItem("eventscout_cached_saved_events");
        if (cachedSaved) {
          try {
            setSavedEvents(JSON.parse(cachedSaved));
            setLoading(false);
            return;
          } catch {}
        }
      }

      // If we have saved IDs, load their details from fallback_events.json
      const fbRes = await fetch("/fallback_events.json");
      if (fbRes.ok) {
        const all: Event[] = await fbRes.json();
        const matched = all.filter((e) => e.id && userSavedIds.has(e.id));
        setSavedEvents(matched.length > 0 ? matched : all.slice(0, 3)); // demo items if empty
      }
    } catch (err) {
      console.warn("Using offline cached saved events:", err);
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("eventscout_cached_saved_events");
        if (cached) {
          try {
            setSavedEvents(JSON.parse(cached));
          } catch {}
        }
      }
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, user?.saved_event_ids]);

  useEffect(() => {
    fetchSavedEvents();
  }, [fetchSavedEvents]);

  // Handle Unsave
  const handleToggleSave = async (eventId: string, currentlySaved: boolean) => {
    if (currentlySaved) {
      setSavedEvents((prev) => prev.filter((ev) => ev.id !== eventId));
      const nextIds = (user?.saved_event_ids || []).filter((id) => id !== eventId);
      updateUser({ saved_event_ids: nextIds });
      if (typeof window !== "undefined") {
        localStorage.setItem("eventscout_saved_ids", JSON.stringify(nextIds));
      }
    }

    try {
      if (token && !token.startsWith("demo-token-")) {
        await fetch(`${apiUrl}/events/${eventId}/save`, {
          method: currentlySaved ? "DELETE" : "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.warn("Offline save toggle:", err);
    }
  };

  const displayedList = activeTab === "saved" ? savedEvents : attendingEvents;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-2 pb-12">
      {/* Header matching Screen 6 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white transition-colors active-press"
          >
            ←
          </button>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Saved Events
          </h1>
        </div>

        {savedEvents.length > 0 && (
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-800/50"
          >
            {isEditMode ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {/* Segmented Tabs matching Screen 6 */}
      <div className="flex items-center bg-[#131b2e] border border-slate-800 p-1 rounded-2xl mb-5 max-w-sm">
        <button
          onClick={() => setActiveTab("saved")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "saved"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Saved ({savedEvents.length})
        </button>
        <button
          onClick={() => setActiveTab("attending")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "attending"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Attending ({attendingEvents.length})
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-[#131b2e] border border-slate-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Content List */}
      {!loading && (
        <>
          {displayedList.length > 0 ? (
            <div className="space-y-3">
              {displayedList.map((ev) => (
                <div key={ev.id || ev.title} className="relative">
                  <EventCard
                    event={ev}
                    variant="compact"
                    isSaved={true}
                    onToggleSave={handleToggleSave}
                  />
                  {isEditMode && (
                    <button
                      onClick={() => ev.id && handleToggleSave(ev.id, true)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-black flex items-center justify-center shadow-md z-10 hover:bg-rose-500"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Empty State matching Screen 6 */
            <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-10 text-center my-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center text-3xl">
                🔖
              </div>
              <h3 className="text-lg font-bold text-white mb-1.5">
                {activeTab === "saved" ? "Nothing saved yet" : "No attending events"}
              </h3>
              <p className="text-slate-400 text-xs max-w-xs mx-auto mb-6 leading-relaxed">
                {activeTab === "saved"
                  ? "Save events you're interested in and find them here later even while offline."
                  : "Events you've registered for or marked as attending will appear here."}
              </p>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 active-press transition-all"
              >
                <span>Explore Events</span>
                <span>→</span>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SavedPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-8 text-center text-slate-400 text-sm">
          Loading saved events...
        </div>
      }
    >
      <SavedEventsContent />
    </Suspense>
  );
}
