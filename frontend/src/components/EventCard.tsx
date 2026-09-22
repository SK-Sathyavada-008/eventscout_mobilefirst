"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Event } from "@/types/event";
import { getEventClassification } from "@/utils/eventUtils";

interface EventCardProps {
  event: Event;
  /** Whether the current user has saved this event. Undefined = not authenticated. */
  isSaved?: boolean;
  /** Called when the user clicks Save/Unsave. Undefined = not authenticated. */
  onToggleSave?: (eventId: string, currentlySaved: boolean) => Promise<void>;
  /** Visual variant: 'compact' (Explore/Saved list), 'featured' (carousel), or 'standard' (grid) */
  variant?: "standard" | "featured" | "compact";
}

export function getEventId(event: Event): string {
  return event.id || event._id || encodeURIComponent(event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
}

export default function EventCard({
  event,
  isSaved,
  onToggleSave,
  variant = "standard",
}: EventCardProps) {
  const [saving, setSaving] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const classification = getEventClassification(event);
  const eventId = getEventId(event);

  // Helper to detect if a scraped URL is a person's avatar rather than an event poster
  const isAvatar = (url?: string | null) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes("avatar") ||
      lower.includes("/users/") ||
      lower.includes("/user/") ||
      lower.includes("profile") ||
      lower.includes("attendee") ||
      lower.includes("gravatar") ||
      lower.includes("author")
    );
  };

  const hasValidImage = Boolean(event.poster_image_url && !isAvatar(event.poster_image_url));

  const formattedDate = new Date(event.date_time).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const shortDate = new Date(event.date_time).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const isTopPick =
    (event.ranking_score && event.ranking_score >= 0.81) ||
    event.host_tier === "TIER_1_COMPANY" ||
    event.host_tier === "TOP_UNIVERSITY";

  const matchScore = event.ranking_score
    ? Math.round(event.ranking_score * 100)
    : null;

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const eventIdentity = event.id || event._id;
    if (!onToggleSave || !eventIdentity) return;

    setSaving(true);
    try {
      const willBeSaved = !isSaved;
      await onToggleSave(eventIdentity, !!isSaved);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("eventscout-toast", {
            detail: { message: willBeSaved ? "Saved to your list" : "Removed from saved" },
          })
        );
      }
    } catch {
      // Handled in parent
    } finally {
      setSaving(false);
    }
  };

  // Render Thumbnail
  const renderThumbnail = (className: string) => {
    if (hasValidImage && !imageFailed) {
      return (
        <Image
          src={event.poster_image_url!}
          alt={event.title}
          fill
          unoptimized
          className="object-cover"
          sizes="120px"
          onError={() => setImageFailed(true)}
        />
      );
    }
    return (
      <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 flex flex-col items-center justify-center p-2 text-center select-none">
        <span className="text-xl mb-1">
          {classification === "hackathon" ? "⚡" : classification === "workshop" ? "🛠️" : "🎯"}
        </span>
        <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider truncate max-w-[90%]">
          {event.source || "Tech"}
        </span>
      </div>
    );
  };

  /* ----------------------------------------------------
     COMPACT VARIANT (Matching Screen 3 Explore & Screen 6 Saved)
     ---------------------------------------------------- */
  if (variant === "compact") {
    return (
      <Link
        href={`/events/${eventId}`}
        className="flex items-center gap-3.5 p-3 sm:p-3.5 bg-[#131b2e] hover:bg-[#18233c] border border-slate-800/90 hover:border-slate-700/80 rounded-2xl transition-all shadow-sm group active-press relative"
      >
        {/* Left: Square Thumbnail */}
        <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden flex-shrink-0 bg-slate-900 border border-slate-800/80">
          {renderThumbnail("w-full h-full")}
        </div>

        {/* Right: Content */}
        <div className="flex flex-col flex-grow min-w-0 pr-8">
          {/* Badges Row */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {classification === "hackathon" && (
              <span className="bg-amber-500/15 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-500/30">
                Hackathon
              </span>
            )}
            {classification === "workshop" && (
              <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">
                Workshop
              </span>
            )}
            {(classification === "conference" || classification === "meetup") && (
              <span className="bg-indigo-500/15 text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-500/30">
                Conference
              </span>
            )}

            <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
              {event.is_free ? "Free" : "Paid"}
            </span>

            {isTopPick && (
              <span className="bg-orange-500/20 text-orange-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                ⭐ Top Pick
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug mb-1">
            {event.title}
          </h3>

          {/* Date & Time */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5 truncate">
            <span>📅</span>
            <span className="truncate">{shortDate}</span>
          </div>

          {/* Location & Host */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
            <span>📍</span>
            <span className="truncate">
              {event.mode_location || (event.city ? `${event.city}` : "Online")}
            </span>
          </div>
        </div>

        {/* Top Right: Bookmark Button */}
        {onToggleSave && (event.id || event._id) && (
          <button
            aria-label={isSaved ? "Unsave event" : "Save event"}
            onClick={handleSaveClick}
            disabled={saving}
            className={`absolute top-3 right-3 p-2 rounded-xl transition-all ${
              isSaved
                ? "text-amber-400 hover:text-amber-300 bg-amber-400/10"
                : "text-slate-400 hover:text-white hover:bg-slate-800/80"
            }`}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                className="w-5 h-5"
                fill={isSaved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            )}
          </button>
        )}
      </Link>
    );
  }

  /* ----------------------------------------------------
     FEATURED VARIANT (Matching Screen 2 Happening This Week)
     ---------------------------------------------------- */
  if (variant === "featured") {
    return (
      <div className="relative flex flex-col bg-[#131b2e] border border-slate-800 rounded-2xl overflow-hidden shadow-lg group active-press min-w-[280px] sm:min-w-[340px] max-w-[380px] flex-shrink-0">
        {/* Banner Area */}
        <Link href={`/events/${eventId}`} className="block relative h-40 w-full bg-slate-900 overflow-hidden">
          {renderThumbnail("w-full h-full group-hover:scale-105 transition-transform duration-300")}

          {/* Badges Over Image */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            {isTopPick && (
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                <span>⭐</span>
                <span>Top Pick</span>
              </span>
            )}
            <span className="bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
              {event.is_free ? "Free" : "Paid"}
            </span>
          </div>

          {/* Save Button Over Image */}
          {onToggleSave && (event.id || event._id) && (
            <button
              aria-label={isSaved ? "Unsave event" : "Save event"}
              onClick={handleSaveClick}
              disabled={saving}
              className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-md ${
                isSaved
                  ? "bg-amber-500 text-white"
                  : "bg-slate-900/80 text-slate-300 hover:text-white"
              }`}
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-4 h-4"
                  fill={isSaved ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              )}
            </button>
          )}
        </Link>

        {/* Card Body */}
        <div className="p-4 flex flex-col flex-grow">
          <Link href={`/events/${eventId}`}>
            <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug mb-2">
              {event.title}
            </h3>
          </Link>

          <div className="text-xs text-slate-400 space-y-1 mb-3">
            <div className="flex items-center gap-1.5">
              <span>📅</span>
              <span className="font-medium text-slate-300">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span>📍</span>
              <span className="truncate">{event.mode_location || "Online"}</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              {classification === "hackathon" ? "Hackathon" : classification === "workshop" ? "Workshop" : "Conference"}
            </span>
            {event.host_badge && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 truncate max-w-[150px]">
                {event.host_badge}
              </span>
            )}
            {matchScore && (
              <span className="text-[11px] font-bold text-emerald-400 ml-auto">
                ⭐ {matchScore}% Match
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------
     STANDARD VARIANT (Default / Desktop Grid)
     ---------------------------------------------------- */
  return (
    <div className="flex flex-col bg-[#131b2e] border border-slate-800/90 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-500/40 transition-all duration-200 group relative">
      {/* Banner / Poster */}
      <Link href={`/events/${eventId}`} className="relative h-44 w-full bg-slate-900 overflow-hidden block">
        {renderThumbnail("w-full h-full group-hover:scale-105 transition-transform duration-300")}

        {/* Top Left: Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {isTopPick && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
              <span>⭐</span>
              <span>TOP PICK</span>
            </div>
          )}
          <div className="bg-emerald-600/90 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full backdrop-blur-xs shadow-sm">
            {event.is_free ? "Free" : `${event.price_currency || ""} ${event.price_amount || "Paid"}`}
          </div>
        </div>

        {/* Save Button */}
        {onToggleSave && (event.id || event._id) && (
          <button
            aria-label={isSaved ? "Unsave event" : "Save event"}
            onClick={handleSaveClick}
            disabled={saving}
            className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-md ${
              isSaved
                ? "bg-amber-500 text-white"
                : "bg-slate-900/80 text-slate-300 hover:text-white"
            }`}
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                className="w-4 h-4"
                fill={isSaved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            )}
          </button>
        )}

        {/* Source badge */}
        {event.source && (
          <div className="absolute bottom-2.5 left-3 bg-slate-900/90 backdrop-blur-xs text-[11px] font-medium px-2 py-0.5 rounded-md text-slate-300 capitalize border border-slate-700/60">
            {event.source}
          </div>
        )}
      </Link>

      {/* Body */}
      <div className="p-4 sm:p-5 flex flex-col flex-grow">
        <div className="text-xs font-semibold text-indigo-400 mb-1.5 uppercase tracking-wide">
          {formattedDate}
        </div>

        <Link href={`/events/${eventId}`}>
          <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 leading-tight mb-2">
            {event.title}
          </h3>
        </Link>

        {/* Organizer */}
        <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5 truncate">
          <span>🏢</span>
          <span className="truncate">{event.organizer || "EventScout Host"}</span>
          {event.host_badge && (
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 truncate">
              {event.host_badge}
            </span>
          )}
        </div>

        {/* Location */}
        <div className="text-xs text-slate-400 mb-3 flex items-center gap-1.5 truncate">
          <span>📍</span>
          <span className="truncate">{event.mode_location || "Online"}</span>
        </div>

        {/* Action Buttons */}
        <div className="mt-auto pt-3 border-t border-slate-800/80 flex items-center gap-2">
          <Link
            href={`/events/${eventId}`}
            className="flex-1 text-center py-2 px-3 bg-slate-800/80 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors active-press"
          >
            Details →
          </Link>
          <a
            href={event.registration_url || event.event_url}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors active-press flex items-center gap-1"
          >
            <span>Apply</span>
            <span>↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}
