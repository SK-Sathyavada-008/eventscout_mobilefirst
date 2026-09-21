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

const ONLINE_REGEX = /\b(online|virtual|remote|digital|webinar|everywhere|worldwide)\b/i;

const INDIA_KEYWORDS = [
  "india",
  "bengaluru",
  "bangalore",
  "delhi",
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
  "kerala",
  "karnataka",
  "tamil nadu",
  "maharashtra",
];

const USA_KEYWORDS = [
  "usa",
  "united states",
  "california",
  "new york",
  "davis",
  "san francisco",
  "seattle",
  "austin",
  "boston",
  "chicago",
  "los angeles",
  "texas",
  "washington",
];

/**
 * Classifies an event into one of the canonical location categories based strictly on location fields:
 * mode_location, city, country, location.
 * Does NOT inspect event description or title to prevent false substring matches.
 */
export function classifyEventLocation(event: Event): LocationCategory {
  const modeLocation = (event.mode_location || "").trim();
  const city = (event.city || "").trim().toLowerCase();
  const country = (event.country || "").trim().toLowerCase();
  const loc = (event.location || "").trim().toLowerCase();
  const rawLoc = `${modeLocation} ${city} ${country} ${loc}`.toLowerCase();

  // 1. Online: Check if explicitly marked Online or contains online/virtual keywords in location fields
  if (ONLINE_REGEX.test(modeLocation) || modeLocation.toLowerCase() === "online") {
    return "Online";
  }

  // 2. Hyderabad: Explicit Hyderabad or Secunderabad match
  if (
    city === "hyderabad" ||
    city === "secunderabad" ||
    rawLoc.includes("hyderabad") ||
    rawLoc.includes("secunderabad")
  ) {
    return "Hyderabad";
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

  // 5. Fallback check for online term anywhere in raw location
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
  if (!selectedLocation || selectedLocation === "All") {
    return true;
  }
  const category = classifyEventLocation(event);
  return category === selectedLocation;
}
