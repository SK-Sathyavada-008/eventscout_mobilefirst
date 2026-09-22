"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Event } from "@/types/event";
import { useAuth } from "@/contexts/AuthContext";
import { getEventClassification } from "@/utils/eventUtils";
import { getEventId } from "@/components/EventCard";
import EventDescription from "@/components/EventDescription";
import { getEventMilestones, formatDateRange } from "@/utils/timelineUtils";

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"about" | "timeline">("about");
  const [copiedShare, setCopiedShare] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const { user, token, isAuthenticated, refreshUser, updateUser } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [applying, setApplying] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Check saved/applied state
  useEffect(() => {
    if (event?.id && user?.saved_event_ids) {
      setIsSaved(user.saved_event_ids.includes(event.id));
    }
    if (event?.id && user?.applied_event_ids) {
      setIsApplied(user.applied_event_ids.includes(event.id));
    }
  }, [event?.id, user?.saved_event_ids, user?.applied_event_ids]);

  const rawId = params?.id as string;
  const decodedId = decodeURIComponent(rawId || "").trim();

  // Load event by ID
  useEffect(() => {
    async function loadEvent() {
      setLoading(true);
      const target = decodedId.toLowerCase();

      const isMatch = (e: Event) => {
        const eId = (e.id || e._id || "").toLowerCase();
        const eSlug = getEventId(e).toLowerCase();
        const eTitle = (e.title || "").toLowerCase();
        return eId === target || eSlug === target || eTitle === target || eId === rawId;
      };

      try {
        // 1. Check cached events in localStorage first
        if (typeof window !== "undefined") {
          const cached = localStorage.getItem("eventscout_cached_events");
          if (cached) {
            try {
              const list: Event[] = JSON.parse(cached);
              const found = list.find(isMatch);
              if (found) {
                setEvent(found);
                setLoading(false);
                return;
              }
            } catch {}
          }
        }

        // 2. Fetch from API
        try {
          const headers: Record<string, string> = {};
          if (token) headers["Authorization"] = `Bearer ${token}`;
          const res = await fetch(`${apiUrl}/events`, { headers });
          if (res.ok) {
            const list: Event[] = await res.json();
            const found = list.find(isMatch);
            if (found) {
              setEvent(found);
              setLoading(false);
              return;
            }
          }
        } catch (apiErr) {
          console.warn("API unreachable, trying fallback:", apiErr);
        }

        // 3. Fallback file
        const fbRes = await fetch("/fallback_events.json");
        if (fbRes.ok) {
          const list: Event[] = await fbRes.json();
          const found = list.find(isMatch);
          if (found) {
            setEvent(found);
            setLoading(false);
            return;
          }
          // If direct ID didn't match, fallback to first item
          if (list.length > 0) {
            setEvent(list[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load event details:", err);
      } finally {
        setLoading(false);
      }
    }

    if (decodedId) loadEvent();
  }, [decodedId, rawId, apiUrl, token]);

  // Handle Save Toggle
  const handleToggleSave = async () => {
    if (!token) {
      router.push("/login");
      return;
    }
    const targetId = event?.id || event?._id;
    if (!targetId) return;

    setSaving(true);
    const willBeSaved = !isSaved;
    setIsSaved(willBeSaved);

    const newSavedList = willBeSaved
      ? [...(user?.saved_event_ids || []), targetId]
      : (user?.saved_event_ids || []).filter((eId) => eId !== targetId);
    updateUser({ saved_event_ids: newSavedList });

    if (typeof window !== "undefined") {
      localStorage.setItem("eventscout_saved_ids", JSON.stringify(newSavedList));
    }

    try {
      if (token) {
        await fetch(`${apiUrl}/events/${targetId}/save`, {
          method: willBeSaved ? "POST" : "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      refreshUser();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("eventscout-toast", {
            detail: { message: willBeSaved ? "Saved to your list" : "Removed from saved" },
          })
        );
      }
    } catch (err) {
      console.warn("Saved event updated offline:", err);
    } finally {
      setSaving(false);
    }
  };

  // Handle Apply Toggle
  const handleToggleApply = async () => {
    if (!token) {
      router.push("/login");
      return;
    }
    if (!event?.id) return;

    setApplying(true);
    const willBeApplied = !isApplied;
    setIsApplied(willBeApplied);

    const newAppliedList = willBeApplied
      ? [...(user?.applied_event_ids || []), event.id]
      : (user?.applied_event_ids || []).filter((eId) => eId !== event.id);
    updateUser({ applied_event_ids: newAppliedList });

    try {
      if (token) {
        await fetch(`${apiUrl}/events/${event.id}/apply`, {
          method: willBeApplied ? "POST" : "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      refreshUser();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("eventscout-toast", {
            detail: { message: willBeApplied ? "Marked as applied" : "Unmarked as applied" },
          })
        );
      }
    } catch (err) {
      console.warn("Applied event updated offline:", err);
    } finally {
      setApplying(false);
    }
  };

  // Share handler
  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const shareData = {
      title: event?.title || "EventScout Opportunity",
      text: `Check out ${event?.title} on EventScout!`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {}
  };

  // Generate and download .ics file
  const handleAddToCalendar = () => {
    if (!event) return;
    const formatICSDate = (dateString: string) => {
      const d = new Date(dateString);
      return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const start = formatICSDate(event.date_time);
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${start}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || "View full details on EventScout."}`,
      `LOCATION:${event.mode_location || "Online"}`,
      `URL:${event.registration_url || event.event_url || ""}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.title.replace(/\\s+/g, "_")}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="h-64 bg-[#131b2e] rounded-3xl animate-pulse mb-6" />
        <div className="h-8 bg-slate-800 rounded w-3/4 mb-3 animate-pulse" />
        <div className="h-4 bg-slate-800 rounded w-1/2 mb-6 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-slate-800 rounded w-full animate-pulse" />
          <div className="h-4 bg-slate-800 rounded w-5/6 animate-pulse" />
          <div className="h-4 bg-slate-800 rounded w-4/6 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <span className="text-4xl block mb-3">🔎</span>
        <h2 className="text-xl font-bold text-white mb-2">Event Not Found</h2>
        <p className="text-slate-400 text-sm mb-6">
          The requested opportunity may have expired or is unavailable.
        </p>
        <Link
          href="/explore"
          className="inline-block py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl"
        >
          Explore Other Opportunities
        </Link>
      </div>
    );
  }

  const classification = getEventClassification(event);
  const isTopPick =
    (event.ranking_score && event.ranking_score >= 0.81) ||
    event.host_tier === "TIER_1_COMPANY" ||
    event.host_tier === "TOP_UNIVERSITY";

  const matchScore = event.ranking_score ? Math.round(event.ranking_score * 100) : null;

  const formattedDate = new Date(event.date_time).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const milestones = useMemo(() => {
    return event ? getEventMilestones(event) : [];
  }, [event]);

  const dateRange = useMemo(() => {
    return event ? formatDateRange(event.start_date || event.date_time, event.end_date) : null;
  }, [event]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-2 pb-24">
      {/* Top Header Bar with Back, Share, Save */}
      <div className="flex items-center justify-between py-2 mb-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 px-3 py-2 rounded-xl transition-colors active-press"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Share Button */}
          <button
            onClick={handleShare}
            aria-label="Share event"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors active-press relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {copiedShare && (
              <span className="absolute -bottom-7 right-0 text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded shadow whitespace-nowrap">
                Link Copied!
              </span>
            )}
          </button>

          {/* Bookmark Save */}
          <button
            onClick={handleToggleSave}
            disabled={saving}
            aria-label={isSaved ? "Unsave event" : "Save event"}
            className={`p-2 rounded-xl transition-colors active-press ${
              isSaved
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                : "bg-slate-800/80 text-slate-300 hover:text-white"
            }`}
          >
            <svg
              className="w-5 h-5"
              fill={isSaved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Hero / Poster Image */}
      <div className="relative w-full h-52 sm:h-72 rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 mb-5 shadow-xl">
        {event.poster_image_url && !imageFailed ? (
          <Image
            src={event.poster_image_url}
            alt={event.title}
            fill
            unoptimized
            className="object-cover"
            priority
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1e1b4b] via-[#0f172a] to-[#020617] flex flex-col items-center justify-center p-6 text-center relative">
            <div className="absolute inset-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:20px_20px] opacity-20" />
            <span className="text-4xl sm:text-5xl mb-3">
              {classification === "hackathon" ? "⚡" : classification === "workshop" ? "🛠️" : "🎯"}
            </span>
            <span className="text-xs font-black tracking-widest text-indigo-400 uppercase bg-indigo-950/80 border border-indigo-800/50 px-3 py-1 rounded-full">
              {event.source || "Tech Opportunity"}
            </span>
          </div>
        )}
      </div>

      {/* Badges Row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {isTopPick && (
          <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-md flex items-center gap-1">
            <span>⭐</span>
            <span>TOP PICK</span>
          </span>
        )}
        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full">
          {event.is_free ? "Free Entry" : `${event.price_currency || ""} ${event.price_amount || "Paid"}`}
        </span>
        {matchScore && (
          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-bold px-3 py-1 rounded-full">
            ⭐ {matchScore}% Match
          </span>
        )}
      </div>

      {/* Event Title */}
      <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight mb-4">
        {event.title}
      </h1>

      {/* Metadata Cards */}
      <div className="bg-[#131b2e] border border-slate-800 rounded-2xl p-4 sm:p-5 mb-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
            📅
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Date & Time</div>
            <div className="font-bold text-white">{formattedDate}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-300">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center flex-shrink-0">
            📍
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Location / Venue</div>
            <div className="font-bold text-white">{event.mode_location || "Online"}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-300">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            🏢
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Organizer</div>
            <div className="font-bold text-white flex items-center gap-2">
              <span>{event.organizer || "Event Host"}</span>
              {event.host_badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {event.host_badge}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-xs font-bold px-3 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 capitalize">
          {classification}
        </span>
        {event.source && (
          <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 capitalize">
            Source: {event.source}
          </span>
        )}
        {event.categories?.map((cat) => (
          <span
            key={cat}
            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/60"
          >
            {cat}
          </span>
        ))}
      </div>

      {/* Segmented Tabs matching Screen 4 */}
      <div className="flex items-center border-b border-slate-800 mb-5 overflow-x-auto no-scrollbar">
        {[
          { id: "about", label: "About" },
          { id: "timeline", label: "Timeline" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-2.5 px-4 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "text-indigo-400 border-indigo-500 bg-indigo-950/20"
                : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mb-10 text-slate-300 text-sm leading-relaxed space-y-4">
        {activeTab === "about" && (
          <>
            <EventDescription
              description={event.description}
              className="whitespace-pre-line text-slate-300 leading-relaxed"
              fallbackText="A flagship technical event bringing together passionate developers, students, and tech leaders to innovate and build real-world solutions."
            />

            {/* Structured Highlights */}
            <div className="bg-[#131b2e] border border-slate-800/90 rounded-2xl p-4 space-y-2.5 mt-4">
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <span className="text-emerald-400">🎓</span>
                <span>Open to all students and developers worldwide</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <span className="text-indigo-400">👥</span>
                <span>Teams or solo participants welcome</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <span className="text-amber-400">⚡</span>
                <span>Intelligently verified by EventScout engine</span>
              </div>
            </div>

            {/* Why Recommended */}
            {event.why_recommended && event.why_recommended.length > 0 && (
              <div className="bg-indigo-950/30 border border-indigo-800/50 rounded-2xl p-4 mt-4">
                <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">
                  ✨ Why Recommended:
                </div>
                <div className="space-y-1.5">
                  {event.why_recommended.map((r, i) => (
                    <div key={i} className="text-xs text-indigo-200 flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "timeline" && (
          <div className="space-y-6">
            {/* Real Milestones Track */}
            <div className="relative pl-6 sm:pl-8 border-l-2 border-indigo-500/30 ml-2 sm:ml-3 space-y-6 py-1">
              {milestones.map((m, idx) => (
                <div key={m.id} className="relative">
                  {/* Step Node */}
                  <div
                    className={`absolute -left-[31px] sm:-left-[39px] top-0.5 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                      m.isPast
                        ? "bg-slate-800 border-slate-700 text-slate-400"
                        : "bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30"
                    }`}
                  >
                    {idx + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${m.badgeStyle.bg} ${m.badgeStyle.text} ${m.badgeStyle.border}`}
                      >
                        {m.isPast ? "Closed / Past" : "Upcoming"}
                      </span>
                    </div>
                    <div className="text-xs text-indigo-300 font-semibold mt-1">
                      {m.formattedDate}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Date Range & Duration Highlight if multi-day */}
            {dateRange && dateRange.includes("→") && (
              <div className="bg-[#131b2e] border border-slate-800/90 rounded-2xl p-4 flex items-center gap-3 mt-4">
                <span className="text-xl">📅</span>
                <div>
                  <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                    Full Event Schedule
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {dateRange}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Sticky Bottom CTA matching Screen 4 */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 bg-[#0b0f19]/95 backdrop-blur-md border-t border-slate-800/80 p-3 sm:p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={handleToggleSave}
            disabled={saving}
            className={`py-3.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all active-press ${
              isSaved
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill={isSaved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span className="hidden sm:inline">{isSaved ? "Saved" : "Save Event"}</span>
          </button>

          <button
            onClick={handleToggleApply}
            disabled={applying}
            className={`py-3.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all active-press ${
              isApplied
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill={isApplied ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">{isApplied ? "Applied" : "Mark Applied"}</span>
          </button>

          <button
            onClick={handleAddToCalendar}
            className="hidden sm:flex py-3.5 px-4 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 text-xs font-bold items-center justify-center gap-2 transition-all active-press"
          >
            📅 <span className="hidden md:inline">Add to Calendar</span>
          </button>

          <a
            href={event.registration_url || event.event_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-black text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active-press transition-all"
          >
            <span>Visit Official Page</span>
            <span className="text-base">↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}
