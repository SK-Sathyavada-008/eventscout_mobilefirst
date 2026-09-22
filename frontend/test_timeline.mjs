import assert from "node:assert";
import test from "node:test";
import {
  parseSafeDate,
  formatDateRange,
  getEventMilestones,
  getNextRelevantMilestone,
  buildTimelineGroups,
  toDateKey,
} from "./src/utils/timelineUtils.ts";

const REF_DATE = new Date("2026-09-22T00:00:00Z");

test("1. Event with start date", () => {
  const ev = {
    title: "AI & Cloud Summit",
    event_url: "https://example.com",
    date_time: "2026-10-15T09:00:00Z",
    organizer: "AWS",
    source: "meetup",
    mode_location: "Online",
    is_free: true,
    categories: ["Cloud"],
    scraped_at: "2026-09-22T00:00:00Z",
  };

  const milestones = getEventMilestones(ev, REF_DATE);
  assert.strictEqual(milestones.length, 1);
  assert.strictEqual(milestones[0].type, "start");
  assert.strictEqual(milestones[0].label, "Event starts");
  assert.ok(milestones[0].isUpcoming);

  const next = getNextRelevantMilestone(ev, REF_DATE);
  assert.strictEqual(next.type, "start");
  assert.strictEqual(next.label, "Event starts");
});

test("2. Event with start + end date (multi-day)", () => {
  const ev = {
    title: "Global Developer Conference 2026",
    event_url: "https://example.com/devconf",
    date_time: "2026-09-28T09:00:00Z",
    start_date: "2026-09-28T09:00:00Z",
    end_date: "2026-09-30T17:00:00Z",
    organizer: "DevOrg",
    source: "meetup",
    mode_location: "In-Person",
    is_free: false,
    categories: ["Conference"],
    scraped_at: "2026-09-22T00:00:00Z",
  };

  const milestones = getEventMilestones(ev, REF_DATE);
  assert.strictEqual(milestones.length, 2);
  assert.strictEqual(milestones[0].type, "start");
  assert.strictEqual(milestones[1].type, "end");

  const range = formatDateRange(ev.start_date, ev.end_date);
  assert.ok(range.includes("Sep 28"));
  assert.ok(range.includes("Sep 30"));
  assert.ok(range.includes("→"));
});

test("3. Event with registration deadline", () => {
  const ev = {
    title: "National Coding Challenge",
    event_url: "https://example.com/challenge",
    date_time: "2026-10-05T10:00:00Z",
    registration_deadline: "2026-09-28T12:00:00Z",
    organizer: "TechOrg",
    source: "unstop",
    mode_location: "Online",
    is_free: true,
    categories: ["Competition"],
    scraped_at: "2026-09-22T00:00:00Z",
  };

  const milestones = getEventMilestones(ev, REF_DATE);
  assert.strictEqual(milestones.length, 2);
  assert.strictEqual(milestones[0].type, "registration_deadline");
  assert.strictEqual(milestones[0].label, "Registration closes");
  assert.strictEqual(milestones[1].type, "start");

  const next = getNextRelevantMilestone(ev, REF_DATE);
  assert.strictEqual(next.type, "registration_deadline");
  assert.ok(next.fullLabel.includes("Registration closes — Sep 28"));
});

test("4. Event with submission deadline", () => {
  const ev = {
    title: "AI Agents Global Buildathon",
    event_url: "https://example.com/buildathon",
    date_time: "2026-09-15T00:00:00Z",
    start_date: "2026-09-15T00:00:00Z",
    submission_deadline: "2026-10-03T12:00:00Z",
    organizer: "Devpost",
    source: "devpost",
    mode_location: "Online",
    is_free: true,
    categories: ["Hackathon"],
    scraped_at: "2026-09-22T00:00:00Z",
  };

  const milestones = getEventMilestones(ev, REF_DATE);
  const subMilestone = milestones.find((m) => m.type === "submission_deadline");
  assert.ok(subMilestone);
  assert.strictEqual(subMilestone.label, "Submission deadline");
  assert.ok(subMilestone.fullLabel.includes("Submission deadline — Oct 3"));
});

test("5. Event with multiple dates (registration, start, end)", () => {
  const ev = {
    title: "Hyderabad Web3 Hackathon",
    event_url: "https://example.com/web3",
    date_time: "2026-10-02T09:00:00Z",
    start_date: "2026-10-02T09:00:00Z",
    end_date: "2026-10-04T18:00:00Z",
    registration_deadline: "2026-09-24T23:59:00Z",
    organizer: "T-Hub",
    source: "devfolio",
    mode_location: "Hyderabad",
    is_free: true,
    categories: ["Hackathon"],
    scraped_at: "2026-09-22T00:00:00Z",
  };

  const milestones = getEventMilestones(ev, REF_DATE);
  assert.strictEqual(milestones.length, 3);
  assert.strictEqual(milestones[0].type, "registration_deadline");
  assert.strictEqual(milestones[1].type, "start");
  assert.strictEqual(milestones[2].type, "end");

  // Verify next relevant milestone is registration deadline first
  const next = getNextRelevantMilestone(ev, REF_DATE);
  assert.strictEqual(next.type, "registration_deadline");
  assert.strictEqual(next.label, "Registration closes");
});

test("6. Past deadline + future event", () => {
  // Registration deadline closed on Sep 20, but event starts on Oct 2
  const ev = {
    title: "Flagship Hackathon",
    event_url: "https://example.com/hack",
    date_time: "2026-10-02T09:00:00Z",
    start_date: "2026-10-02T09:00:00Z",
    registration_deadline: "2026-09-20T23:59:00Z", // Past!
    organizer: "Devfolio",
    source: "devfolio",
    mode_location: "Online",
    is_free: true,
    categories: ["Hackathon"],
    scraped_at: "2026-09-22T00:00:00Z",
  };

  const milestones = getEventMilestones(ev, REF_DATE);
  assert.strictEqual(milestones.length, 2);
  assert.strictEqual(milestones[0].isPast, true);
  assert.strictEqual(milestones[1].isUpcoming, true);

  // Must NOT show the expired deadline as the next upcoming milestone!
  const next = getNextRelevantMilestone(ev, REF_DATE);
  assert.strictEqual(next.type, "start");
  assert.strictEqual(next.label, "Event starts");
  assert.ok(next.fullLabel.includes("Event starts — Oct 2"));
});

test("7. Missing deadline falls back to event date", () => {
  const ev = {
    title: "Tech Meetup",
    event_url: "https://example.com/meetup",
    date_time: "2026-10-12T18:00:00Z",
    organizer: "Meetup Group",
    source: "meetup",
    mode_location: "Online",
    is_free: true,
    categories: ["Meetup"],
    scraped_at: "2026-09-22T00:00:00Z",
  };

  const next = getNextRelevantMilestone(ev, REF_DATE);
  assert.ok(next);
  assert.strictEqual(next.type, "start");
  assert.strictEqual(next.label, "Event starts");
  assert.ok(next.fullLabel.includes("Event starts — Oct 12"));
});

test("8. Missing dates does not crash", () => {
  const evNoDate = {
    title: "Unscheduled Event",
    event_url: "https://example.com/no-date",
    date_time: null,
    organizer: "Unknown",
    source: "generic",
    mode_location: "Online",
    is_free: true,
    categories: [],
    scraped_at: "2026-09-22T00:00:00Z",
  };

  const milestones = getEventMilestones(evNoDate, REF_DATE);
  assert.deepStrictEqual(milestones, []);
  const next = getNextRelevantMilestone(evNoDate, REF_DATE);
  assert.strictEqual(next, null);

  const groups = buildTimelineGroups([evNoDate], REF_DATE);
  assert.deepStrictEqual(groups, []);
});

test("9. Multiple events sorted chronologically in timeline", () => {
  const events = [
    {
      title: "Event D",
      event_url: "https://example.com/d",
      date_time: "2026-10-02T09:00:00Z", // Oct 2
      organizer: "Org",
      source: "meetup",
      mode_location: "Online",
      is_free: true,
      categories: [],
      scraped_at: "2026-09-22T00:00:00Z",
    },
    {
      title: "Event A",
      event_url: "https://example.com/a",
      date_time: "2026-10-15T09:00:00Z",
      registration_deadline: "2026-09-22T12:00:00Z", // Sep 22
      organizer: "Org",
      source: "meetup",
      mode_location: "Online",
      is_free: true,
      categories: [],
      scraped_at: "2026-09-22T00:00:00Z",
    },
    {
      title: "Event C",
      event_url: "https://example.com/c",
      date_time: "2026-09-28T09:00:00Z", // Sep 28
      organizer: "Org",
      source: "meetup",
      mode_location: "Online",
      is_free: true,
      categories: [],
      scraped_at: "2026-09-22T00:00:00Z",
    },
    {
      title: "Event B",
      event_url: "https://example.com/b",
      date_time: "2026-10-10T09:00:00Z",
      submission_deadline: "2026-09-25T18:00:00Z", // Sep 25
      organizer: "Org",
      source: "meetup",
      mode_location: "Online",
      is_free: true,
      categories: [],
      scraped_at: "2026-09-22T00:00:00Z",
    },
  ];

  const groups = buildTimelineGroups(events, REF_DATE);
  assert.strictEqual(groups.length, 4);
  assert.ok(groups[0].items[0].event.title === "Event A"); // Sep 22
  assert.ok(groups[1].items[0].event.title === "Event B"); // Sep 25
  assert.ok(groups[2].items[0].event.title === "Event C"); // Sep 28
  assert.ok(groups[3].items[0].event.title === "Event D"); // Oct 2
});

test("10. Events occurring on the same date are grouped together", () => {
  const events = [
    {
      title: "Morning Hackathon",
      event_url: "https://example.com/h1",
      date_time: "2026-09-28T09:00:00Z",
      organizer: "A",
      source: "meetup",
      mode_location: "Online",
      is_free: true,
      categories: [],
      scraped_at: "2026-09-22T00:00:00Z",
    },
    {
      title: "Afternoon Workshop",
      event_url: "https://example.com/w1",
      date_time: "2026-09-28T14:00:00Z",
      organizer: "B",
      source: "meetup",
      mode_location: "Online",
      is_free: true,
      categories: [],
      scraped_at: "2026-09-22T00:00:00Z",
    },
  ];

  const groups = buildTimelineGroups(events, REF_DATE);
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].items.length, 2);
  assert.strictEqual(groups[0].items[0].event.title, "Morning Hackathon");
  assert.strictEqual(groups[0].items[1].event.title, "Afternoon Workshop");
});

test("11. Malformed dates do not crash parseSafeDate or timeline", () => {
  assert.strictEqual(parseSafeDate("not-a-valid-date"), null);
  assert.strictEqual(parseSafeDate(""), null);
  assert.strictEqual(parseSafeDate(undefined), null);
  assert.strictEqual(formatDateRange("invalid", "nonsense"), null);

  const evMalformed = {
    title: "Corrupt Date Event",
    event_url: "https://example.com/corrupt",
    date_time: "totally_invalid_time_string",
    organizer: "Org",
    source: "meetup",
    mode_location: "Online",
    is_free: true,
    categories: [],
    scraped_at: "2026-09-22T00:00:00Z",
  };

  const milestones = getEventMilestones(evMalformed, REF_DATE);
  assert.deepStrictEqual(milestones, []);
  const groups = buildTimelineGroups([evMalformed], REF_DATE);
  assert.deepStrictEqual(groups, []);
});

test("12. Today and Tomorrow relative flags are accurately set", () => {
  const todayEvent = {
    title: "Today's Event",
    event_url: "https://example.com/today",
    date_time: "2026-09-22T10:00:00Z",
    organizer: "Org",
    source: "meetup",
    mode_location: "Online",
    is_free: true,
    categories: [],
    scraped_at: "2026-09-22T00:00:00Z",
  };

  const tomorrowEvent = {
    title: "Tomorrow's Event",
    event_url: "https://example.com/tomorrow",
    date_time: "2026-09-23T10:00:00Z",
    organizer: "Org",
    source: "meetup",
    mode_location: "Online",
    is_free: true,
    categories: [],
    scraped_at: "2026-09-22T00:00:00Z",
  };

  const groups = buildTimelineGroups([todayEvent, tomorrowEvent], REF_DATE);
  assert.strictEqual(groups.length, 2);
  assert.strictEqual(groups[0].isToday, true);
  assert.ok(groups[0].displayDate.includes("Today"));
  assert.strictEqual(groups[1].isTomorrow, true);
  assert.ok(groups[1].displayDate.includes("Tomorrow"));
});
