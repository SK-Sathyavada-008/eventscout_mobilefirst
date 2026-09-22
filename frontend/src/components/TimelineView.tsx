"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Event } from "@/types/event";
import { buildTimelineGroups, TimelineDateGroup } from "@/utils/timelineUtils";
import { getEventId } from "@/components/EventCard";
import { getEventClassification } from "@/utils/eventUtils";

interface TimelineViewProps {
  events: Event[];
  className?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
}

export default function TimelineView({
  events,
  className = "",
  emptyTitle = "No upcoming milestones or deadlines",
  emptySubtitle = "Events with approaching registration deadlines or scheduled dates will appear here chronologically.",
}: TimelineViewProps) {
  const groups: TimelineDateGroup[] = useMemo(() => {
    return buildTimelineGroups(events);
  }, [events]);

  if (groups.length === 0) {
    return (
      <div className={`bg-[#131b2e] border border-slate-800 rounded-3xl p-8 sm:p-12 text-center ${className}`}>
        <span className="text-4xl block mb-3">⏳</span>
        <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">{emptyTitle}</h3>
        <p className="text-slate-400 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
          {emptySubtitle}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative pl-6 sm:pl-8 border-l-2 border-indigo-500/30 ml-3 sm:ml-5 space-y-8 py-2 ${className}`}>
      {groups.map((group) => (
        <div key={group.dateKey} className="relative">
          {/* Timeline Node on vertical track */}
          <div
            className={`absolute -left-[31px] sm:-left-[39px] top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-transform ${
              group.isToday
                ? "bg-amber-500 border-amber-300 text-slate-950 shadow-md shadow-amber-500/30 scale-110"
                : group.isTomorrow
                ? "bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30"
                : "bg-slate-900 border-indigo-500/70 text-indigo-400"
            }`}
          >
            {group.isToday ? "★" : "•"}
          </div>

          {/* Date Section Header */}
          <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
            <h3
              className={`text-sm sm:text-base font-extrabold tracking-tight ${
                group.isToday
                  ? "text-amber-300"
                  : group.isTomorrow
                  ? "text-indigo-300"
                  : "text-white"
              }`}
            >
              {group.displayDate}
            </h3>
            {group.isToday && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                TODAY
              </span>
            )}
            <span className="text-[11px] text-slate-400">
              ({group.items.length} {group.items.length === 1 ? "milestone" : "milestones"})
            </span>
          </div>

          {/* Events occurring on this milestone date */}
          <div className="space-y-3">
            {group.items.map((item) => {
              const eventId = getEventId(item.event);
              const milestone = item.currentMilestone;
              const classification = getEventClassification(item.event);

              // Secondary future milestones (e.g. event starts later)
              const futureMilestones = item.allMilestones.filter(
                (m) => m.id !== milestone.id && m.isUpcoming && m.date.getTime() > milestone.date.getTime()
              );

              return (
                <Link
                  key={`${item.event.id || item.event.title}-${milestone.id}`}
                  href={`/events/${eventId}`}
                  className="block p-3.5 sm:p-4 bg-[#131b2e] hover:bg-[#18233c] border border-slate-800/90 hover:border-indigo-500/50 rounded-2xl transition-all shadow-sm group active-press"
                >
                  {/* Top row: Milestone Label Badge + Category */}
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    {/* Primary Milestone Badge */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${milestone.badgeStyle.bg} ${milestone.badgeStyle.text} ${milestone.badgeStyle.border}`}
                    >
                      <span>{milestone.icon}</span>
                      <span>{milestone.fullLabel}</span>
                    </div>

                    {/* Classification / Price Tag */}
                    <div className="flex items-center gap-1.5 text-[10px]">
                      {classification === "hackathon" && (
                        <span className="bg-amber-500/15 text-amber-400 font-bold px-2 py-0.5 rounded-md border border-amber-500/30">
                          Hackathon
                        </span>
                      )}
                      {classification === "workshop" && (
                        <span className="bg-emerald-500/15 text-emerald-400 font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">
                          Workshop
                        </span>
                      )}
                      {(classification === "conference" || classification === "meetup") && (
                        <span className="bg-indigo-500/15 text-indigo-400 font-bold px-2 py-0.5 rounded-md border border-indigo-500/30">
                          Conference
                        </span>
                      )}
                      <span className="bg-slate-800 text-slate-300 font-semibold px-1.5 py-0.5 rounded-md">
                        {item.event.is_free ? "Free" : "Paid"}
                      </span>
                    </div>
                  </div>

                  {/* Event Title */}
                  <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug mb-1.5">
                    {item.event.title}
                  </h4>

                  {/* Metadata Row: Organizer, Location, Date Range */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                    {item.event.organizer && (
                      <span className="truncate max-w-[180px] text-slate-300 font-medium">
                        by {item.event.organizer}
                      </span>
                    )}

                    {/* Mode / Location */}
                    <span className="flex items-center gap-1 text-slate-400">
                      <span>{item.event.mode_location?.toLowerCase().includes("online") ? "🌐" : "📍"}</span>
                      <span className="truncate max-w-[140px]">{item.event.mode_location || "Online"}</span>
                    </span>

                    {/* Date Range if multi-day or different from current milestone */}
                    {item.dateRangeDisplay && item.dateRangeDisplay.includes("→") && (
                      <span className="text-[11px] text-indigo-300 font-medium bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-800/40">
                        Duration: {item.dateRangeDisplay}
                      </span>
                    )}
                  </div>

                  {/* Secondary Milestones (if any upcoming) */}
                  {futureMilestones.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/70 flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                      <span className="text-slate-500">Next:</span>
                      {futureMilestones.map((fm) => (
                        <span key={fm.id} className="text-indigo-300 font-medium flex items-center gap-1">
                          <span>{fm.icon}</span>
                          <span>{fm.fullLabel}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
