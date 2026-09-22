import type { Event } from "@/types/event";

export type MilestoneType =
  | "registration_deadline"
  | "submission_deadline"
  | "start"
  | "end";

export interface EventMilestone {
  id: string;
  type: MilestoneType;
  label: string; // e.g. "Registration closes", "Submission deadline", "Event starts", "Event ends"
  fullLabel: string; // e.g. "Registration closes — Sep 28"
  date: Date;
  dateStr: string;
  formattedDate: string;
  shortDate: string;
  isUpcoming: boolean;
  isPast: boolean;
  icon: string;
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
  };
}

export interface TimelineItem {
  event: Event;
  currentMilestone: EventMilestone;
  allMilestones: EventMilestone[];
  dateRangeDisplay?: string | null;
}

export interface TimelineDateGroup {
  dateKey: string; // "YYYY-MM-DD"
  displayDate: string; // e.g. "Today — Sep 22", "Sat, Sep 28"
  isToday: boolean;
  isTomorrow: boolean;
  items: TimelineItem[];
}

/**
 * Safely parse a date value from string or Date object.
 * Returns null if the value is missing or invalid.
 */
export function parseSafeDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  try {
    const s = String(val).trim();
    if (!s) return null;
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
  } catch {
    return null;
  }
}

/**
 * Formats a date range e.g. "Sep 28 → Sep 30, 2026"
 */
export function formatDateRange(
  startVal?: string | Date | null,
  endVal?: string | Date | null
): string | null {
  const start = parseSafeDate(startVal);
  const end = parseSafeDate(endVal);

  if (!start) return null;
  if (!end || start.getTime() === end.getTime()) {
    return start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  const startFormatted = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });

  const endFormatted = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startFormatted} → ${endFormatted}`;
}

/**
 * Extracts and returns all valid milestones for an event in chronological order.
 */
export function getEventMilestones(
  event: Event,
  referenceDate: Date = new Date()
): EventMilestone[] {
  const milestones: EventMilestone[] = [];
  const refTime = referenceDate.getTime();

  // 1. Registration Deadline
  const regDate = parseSafeDate(event.registration_deadline);
  if (regDate) {
    const isUpcoming = regDate.getTime() >= refTime;
    const shortDate = regDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    milestones.push({
      id: "registration_deadline",
      type: "registration_deadline",
      label: "Registration closes",
      fullLabel: `Registration closes — ${shortDate}`,
      date: regDate,
      dateStr: regDate.toISOString(),
      formattedDate: regDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      shortDate,
      isUpcoming,
      isPast: !isUpcoming,
      icon: "⏳",
      badgeStyle: {
        bg: "bg-amber-500/15",
        text: "text-amber-400",
        border: "border-amber-500/30",
      },
    });
  }

  // 2. Submission Deadline
  const subDate = parseSafeDate(event.submission_deadline);
  if (subDate) {
    const isUpcoming = subDate.getTime() >= refTime;
    const shortDate = subDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    milestones.push({
      id: "submission_deadline",
      type: "submission_deadline",
      label: "Submission deadline",
      fullLabel: `Submission deadline — ${shortDate}`,
      date: subDate,
      dateStr: subDate.toISOString(),
      formattedDate: subDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      shortDate,
      isUpcoming,
      isPast: !isUpcoming,
      icon: "📝",
      badgeStyle: {
        bg: "bg-purple-500/15",
        text: "text-purple-400",
        border: "border-purple-500/30",
      },
    });
  }

  // 3. Event Starts (start_date or date_time)
  const startDate = parseSafeDate(event.start_date || event.date_time);
  if (startDate) {
    const isUpcoming = startDate.getTime() >= refTime;
    const shortDate = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    milestones.push({
      id: "start",
      type: "start",
      label: "Event starts",
      fullLabel: `Event starts — ${shortDate}`,
      date: startDate,
      dateStr: startDate.toISOString(),
      formattedDate: startDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      shortDate,
      isUpcoming,
      isPast: !isUpcoming,
      icon: "🚀",
      badgeStyle: {
        bg: "bg-indigo-500/15",
        text: "text-indigo-400",
        border: "border-indigo-500/30",
      },
    });
  }

  // 4. Event Ends (end_date)
  const endDate = parseSafeDate(event.end_date);
  if (endDate) {
    const isUpcoming = endDate.getTime() >= refTime;
    const shortDate = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    milestones.push({
      id: "end",
      type: "end",
      label: "Event ends",
      fullLabel: `Event ends — ${shortDate}`,
      date: endDate,
      dateStr: endDate.toISOString(),
      formattedDate: endDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      shortDate,
      isUpcoming,
      isPast: !isUpcoming,
      icon: "🏁",
      badgeStyle: {
        bg: "bg-emerald-500/15",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
      },
    });
  }

  // Sort milestones chronologically
  milestones.sort((a, b) => a.date.getTime() - b.date.getTime());

  return milestones;
}

/**
 * Returns the next relevant milestone for an event:
 * - If an event has upcoming milestones, returns the EARLIEST upcoming one.
 * - If deadlines (registration/submission) have passed but the event itself is upcoming,
 *   it skips the passed deadlines and returns "Event starts".
 * - If missing deadlines, falls back to start date or end date.
 * - If all milestones are in the past, returns the last milestone or null.
 */
export function getNextRelevantMilestone(
  event: Event,
  referenceDate: Date = new Date()
): EventMilestone | null {
  const milestones = getEventMilestones(event, referenceDate);
  if (milestones.length === 0) return null;

  // Find the first milestone that is in the future
  const refTime = referenceDate.getTime();
  const futureMilestone = milestones.find((m) => m.date.getTime() >= refTime);

  if (futureMilestone) {
    return futureMilestone;
  }

  // If no future milestones exist, return the last one (marked as past)
  return milestones[milestones.length - 1];
}

/**
 * Formats a Date into a canonical sortable "YYYY-MM-DD" key in local timezone.
 */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Builds chronological timeline date groups for an array of events:
 * 1. Finds the next relevant upcoming milestone for each event.
 * 2. Filters out events that have completely passed.
 * 3. Groups events by date header.
 * 4. Sorts date headers chronologically.
 */
export function buildTimelineGroups(
  events: Event[],
  referenceDate: Date = new Date()
): TimelineDateGroup[] {
  const refTime = referenceDate.getTime();
  const todayKey = toDateKey(referenceDate);

  const tomorrow = new Date(referenceDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = toDateKey(tomorrow);

  // Group events by milestone date
  const groupsMap = new Map<string, { date: Date; items: TimelineItem[] }>();

  for (const ev of events) {
    const currentMilestone = getNextRelevantMilestone(ev, referenceDate);
    if (!currentMilestone) continue;

    // Follow existing application behavior: exclude past milestones/events from upcoming timeline
    // (Allow events on the same day even if earlier in the day)
    const eventDateKey = toDateKey(currentMilestone.date);
    const isPastDay = currentMilestone.date.getTime() < refTime && eventDateKey < todayKey;
    if (isPastDay) continue;

    const allMilestones = getEventMilestones(ev, referenceDate);
    const rangeDisplay = formatDateRange(ev.start_date || ev.date_time, ev.end_date);

    const timelineItem: TimelineItem = {
      event: ev,
      currentMilestone,
      allMilestones,
      dateRangeDisplay: rangeDisplay,
    };

    if (!groupsMap.has(eventDateKey)) {
      groupsMap.set(eventDateKey, {
        date: currentMilestone.date,
        items: [],
      });
    }

    groupsMap.get(eventDateKey)!.items.push(timelineItem);
  }

  // Sort groups chronologically
  const sortedKeys = Array.from(groupsMap.keys()).sort();

  return sortedKeys.map((key) => {
    const groupData = groupsMap.get(key)!;
    const isToday = key === todayKey;
    const isTomorrow = key === tomorrowKey;

    let displayDate: string;
    if (isToday) {
      displayDate = `Today — ${groupData.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else if (isTomorrow) {
      displayDate = `Tomorrow — ${groupData.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    } else {
      displayDate = groupData.date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: groupData.date.getFullYear() !== referenceDate.getFullYear() ? "numeric" : undefined,
      });
    }

    // Sort items within group by milestone time, then title
    groupData.items.sort((a, b) => {
      const diff = a.currentMilestone.date.getTime() - b.currentMilestone.date.getTime();
      if (diff !== 0) return diff;
      return a.event.title.localeCompare(b.event.title);
    });

    return {
      dateKey: key,
      displayDate,
      isToday,
      isTomorrow,
      items: groupData.items,
    };
  });
}
