"""
Location classification and filtering utility for EventScout.
Matches the frontend logic in frontend/src/utils/locationUtils.ts.
Operates strictly on location metadata (mode_location, city, country, location).
Does NOT match on unrelated text such as event descriptions or titles.
"""
import re
from typing import Any, Dict

ONLINE_REGEX = re.compile(r"\b(online|virtual|remote|digital|webinar|everywhere|worldwide)\b", re.IGNORECASE)

INDIA_KEYWORDS = [
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
]

USA_KEYWORDS = [
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
]


def classify_event_location(event: Dict[str, Any]) -> str:
    """
    Classifies an event into one of the canonical location categories:
    'Hyderabad', 'India', 'USA', 'Online', 'Other'.
    """
    mode_loc = str(event.get("mode_location") or "").strip()
    city = str(event.get("city") or "").strip().lower()
    country = str(event.get("country") or "").strip().lower()
    loc = str(event.get("location") or "").strip().lower()

    raw_loc = f"{mode_loc} {city} {country} {loc}".lower()

    # 1. Online: Check if explicitly marked Online or contains online/virtual keywords
    if ONLINE_REGEX.search(mode_loc) or mode_loc.lower() == "online":
        return "Online"

    # 2. Hyderabad: Explicit Hyderabad or Secunderabad match
    if (
        city in ("hyderabad", "secunderabad")
        or "hyderabad" in raw_loc
        or "secunderabad" in raw_loc
    ):
        return "Hyderabad"

    # 3. India / Other Indian locations (excluding Hyderabad)
    if country in ("in", "india"):
        return "India"
    for keyword in INDIA_KEYWORDS:
        if keyword in raw_loc:
            return "India"

    # 4. USA: Explicit US country or US cities / states
    if country in ("us", "usa", "united states"):
        return "USA"
    for keyword in USA_KEYWORDS:
        if keyword in raw_loc:
            return "USA"

    # 5. Fallback check for online term anywhere in raw location
    if "online" in raw_loc:
        return "Online"

    # 6. Other / Unknown
    return "Other"


def match_location_filter(event: Dict[str, Any], selected_location: str) -> bool:
    """
    Evaluates whether an event satisfies the selected location filter option.
    Accepts case-insensitive matching e.g. 'hyderabad', 'india', 'usa', 'online', 'other', or 'all'.
    """
    if not selected_location or selected_location.lower() == "all":
        return True

    category = classify_event_location(event)
    return category.lower() == selected_location.strip().lower()
