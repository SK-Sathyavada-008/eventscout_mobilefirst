import { Event } from "@/types/event";

export type LocationCategory =
  | "All"
  | "Hyderabad"
  | "India"
  | "USA"
  | "Online"
  | "Other";

export interface LocationOption {
  id: LocationCategory;
  label: string;
}

export const LOCATION_OPTIONS: LocationOption[] = [
  { id: "All", label: "All Locations" },
  { id: "Hyderabad", label: "Hyderabad" },
  { id: "India", label: "India (Other)" },
  { id: "USA", label: "USA" },
  { id: "Online", label: "Online" },
  { id: "Other", label: "Other / Unknown" },
];

const ONLINE_REGEX = /\b(online|virtual|remote|digital|webinar|everywhere|worldwide|livestream|live stream|zoom|teams|twitch|youtube|discord)\b/i;

const HYDERABAD_KEYWORDS = [
  "hyderabad",
  "secunderabad",
  "cyberabad",
  "hitec city",
  "gachibowli",
  "madhapur",
  "kondapur",
  "t-hub",
  "vnrvjiet",
];

const INDIA_KEYWORDS = [
  "india",
  "bengaluru",
  "bangalore",
  "delhi",
  "new delhi",
  "mumbai",
  "chennai",
  "pune",
  "kolkata",
  "noida",
  "gurgaon",
  "gurugram",
  "nagpur",
  "kochi",
  "coimbatore",
  "ahmedabad",
  "jaipur",
  "chandigarh",
  "hubli",
  "kerala",
  "karnataka",
  "tamil nadu",
  "maharashtra",
  "telangana",
  "andhra pradesh",
];

const USA_KEYWORDS = [
  "usa",
  "united states",
  "california",
  "new york",
  "nyc",
  "davis",
  "san francisco",
  "seattle",
  "austin",
  "boston",
  "chicago",
  "los angeles",
  "texas",
  "washington",
  "las vegas",
  "nevada",
  "massachusetts",
  "illinois",
  "florida",
  "dmv",
];

/**
 * Returns true if the event explicitly represents online or virtual attendance.
 */
export function isOnlineEvent(event: Event): boolean {
  if (event.mode?.toLowerCase() === "online") return true;

  const modeLocation = (event.mode_location || "").trim();
  const loc = (event.location || "").trim();

  if (ONLINE_REGEX.test(modeLocation) || modeLocation.toLowerCase() === "online") {
    return true;
  }
  if (ONLINE_REGEX.test(loc) || loc.toLowerCase() === "online") {
    return true;
  }

  return false;
}

/**
 * Returns true if the event represents an in-person physical event.
 */
export function isOfflineEvent(event: Event): boolean {
  if (isOnlineEvent(event)) return false;

  const mode = (event.mode || "").toLowerCase();
  if (mode === "offline" || mode === "in-person" || mode === "in_person") {
    return true;
  }

  const modeLoc = (event.mode_location || "").trim().toLowerCase();
  const city = (event.city || "").trim().toLowerCase();
  const loc = (event.location || "").trim().toLowerCase();

  if (!modeLoc && !city && !loc) return false;
  if (
    modeLoc === "location not specified" ||
    modeLoc === "unspecified" ||
    modeLoc === "tbd" ||
    modeLoc === "unknown" ||
    modeLoc === "other / unknown"
  ) {
    return false;
  }

  return true;
}

/**
 * Classifies an event into one of the canonical location categories based strictly on location fields:
 * mode, mode_location, city, country, location.
 * Does NOT inspect event description or title to prevent false substring matches.
 */
export function classifyEventLocation(event: Event): LocationCategory {
  // 1. Online: Check if explicitly online
  if (isOnlineEvent(event)) {
    return "Online";
  }

  const city = (event.city || "").trim().toLowerCase();
  const country = (event.country || "").trim().toLowerCase();
  let modeLocation = (event.mode_location || "").trim().toLowerCase();
  let loc = (event.location || "").trim().toLowerCase();

  // Strip scraper artifact URLs from text matching
  if (modeLocation.startsWith("http://") || modeLocation.startsWith("https://")) {
    modeLocation = "";
  }
  if (loc.startsWith("http://") || loc.startsWith("https://")) {
    loc = "";
  }

  const rawLoc = `${modeLocation} ${city} ${country} ${loc}`.trim();

  // 2. Hyderabad: Explicit Hyderabad or Secunderabad match
  if (city === "hyderabad" || city === "secunderabad" || city === "cyberabad") {
    return "Hyderabad";
  }
  for (const keyword of HYDERABAD_KEYWORDS) {
    if (rawLoc.includes(keyword)) {
      return "Hyderabad";
    }
  }

  // 3. India / Other Indian locations (excluding Hyderabad)
  if (country === "in" || country === "india") {
    return "India";
  }
  for (const keyword of INDIA_KEYWORDS) {
    if (rawLoc.includes(keyword)) {
      return "India";
    }
  }

  // 4. USA: Explicit US country or US cities / states
  if (country === "us" || country === "usa" || country === "united states") {
    return "USA";
  }
  for (const keyword of USA_KEYWORDS) {
    if (rawLoc.includes(keyword)) {
      return "USA";
    }
  }

  // 5. Fallback check for online term in clean location fields
  if (rawLoc.includes("online")) {
    return "Online";
  }

  // 6. Other / Unknown
  return "Other";
}

/**
 * Evaluates whether an event satisfies the selected location filter option.
 */
export function matchLocationFilter(event: Event, selectedLocation: string): boolean {
  if (!selectedLocation || selectedLocation.toLowerCase() === "all") {
    return true;
  }
  const category = classifyEventLocation(event);
  return category.toLowerCase() === selectedLocation.trim().toLowerCase();
}
