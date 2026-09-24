"""
Location classification, normalization, and filtering utilities for EventScout.
Matches the frontend logic in frontend/src/utils/locationUtils.ts.
Operates strictly on location metadata (mode, mode_location, city, country, location).
Does NOT match on unrelated text such as event descriptions or titles.
"""
import re
from typing import Any, Dict, Optional, Tuple

ONLINE_REGEX = re.compile(
    r"\b(online|virtual|remote|digital|webinar|everywhere|worldwide|livestream|live stream|zoom|teams|twitch|youtube|discord)\b",
    re.IGNORECASE,
)

HYDERABAD_KEYWORDS = [
    "hyderabad",
    "secunderabad",
    "cyberabad",
    "hitec city",
    "gachibowli",
    "madhapur",
    "kondapur",
    "t-hub",
    "vnrvjiet",
]

INDIA_KEYWORDS = [
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
]

USA_KEYWORDS = [
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
]

INTERNATIONAL_KEYWORDS = [
    ("uk", "UK", "London"),
    ("united kingdom", "UK", "London"),
    ("london", "UK", "London"),
    ("germany", "Germany", "Berlin"),
    ("mannheim", "Germany", "Mannheim"),
    ("baden-württemberg", "Germany", "Mannheim"),
    ("mexico", "Mexico", "Mexico City"),
    ("queretaro", "Mexico", "Queretaro"),
    ("canada", "Canada", "Toronto"),
    ("singapore", "Singapore", "Singapore"),
    ("japan", "Japan", "Tokyo"),
    ("tokyo", "Japan", "Tokyo"),
    ("france", "France", "Paris"),
    ("australia", "Australia", "Sydney"),
]


def is_online_event(event: Dict[str, Any]) -> bool:
    """
    Returns True if the event explicitly indicates online / virtual attendance.
    """
    mode = str(event.get("mode") or "").strip().lower()
    if mode == "online":
        return True

    mode_loc = str(event.get("mode_location") or "").strip()
    loc = str(event.get("location") or "").strip()

    if ONLINE_REGEX.search(mode_loc) or mode_loc.lower() == "online":
        return True
    if ONLINE_REGEX.search(loc) or loc.lower() == "online":
        return True

    return False


def is_offline_event(event: Dict[str, Any]) -> bool:
    """
    Returns True if the event represents a physical in-person attendance mode.
    """
    if is_online_event(event):
        return False

    mode = str(event.get("mode") or "").strip().lower()
    if mode in ("offline", "in-person", "in_person"):
        return True

    mode_loc = str(event.get("mode_location") or "").strip().lower()
    city = str(event.get("city") or "").strip().lower()
    loc = str(event.get("location") or "").strip().lower()

    if not mode_loc and not city and not loc:
        return False
    if mode_loc in ("location not specified", "unspecified", "tbd", "unknown", "other / unknown"):
        return False

    return True


def normalize_event_location(raw_item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Produces standardized, predictable location metadata:
    - mode: 'online' | 'offline' | 'hybrid' | 'unknown'
    - mode_location: sanitized display string (e.g. 'Online', 'Offline - Hyderabad', 'Davis, California')
    - city: e.g. 'Hyderabad', 'Davis', 'Nagpur', or None
    - country: e.g. 'India', 'USA', 'Germany', or None
    - location: canonical display string (e.g. 'Hyderabad, India', 'Online')
    """
    mode_loc = str(raw_item.get("mode_location") or "").strip()
    loc = str(raw_item.get("location") or "").strip()
    city = str(raw_item.get("city") or "").strip() if raw_item.get("city") else None
    country = str(raw_item.get("country") or "").strip() if raw_item.get("country") else None
    title = str(raw_item.get("title") or "").strip()
    source = str(raw_item.get("source") or "").strip().lower()
    event_url = str(raw_item.get("event_url") or "").strip()

    raw_text = mode_loc or loc or ""

    # 1. URL cleanup: If mode_location is a URL, it is a scraper artifact
    if raw_text.startswith("http://") or raw_text.startswith("https://"):
        url_lower = raw_text.lower()
        if "gdg" in url_lower or "gdg.community.dev" in url_lower:
            matched_city = None
            for c in ["nagpur", "chennai", "hubli", "bengaluru", "delhi", "mumbai", "hyderabad", "pune", "kolkata"]:
                if f"-{c}-" in url_lower or f"/{c}" in url_lower:
                    matched_city = c.capitalize()
                    break
            if matched_city:
                c_name = "Hyderabad" if matched_city.lower() in ("hyderabad", "secunderabad") else matched_city
                return {
                    "mode": "offline",
                    "mode_location": f"Offline - {c_name}" if c_name == "Hyderabad" else f"{c_name}, India",
                    "city": c_name,
                    "country": "India",
                    "location": f"{c_name}, India",
                }
            return {
                "mode": "offline",
                "mode_location": "India",
                "city": None,
                "country": "India",
                "location": "India",
            }
        elif "hackerearth.com" in url_lower:
            return {
                "mode": "online",
                "mode_location": "Online",
                "city": None,
                "country": None,
                "location": "Online",
            }
        raw_text = ""

    # 2. Title artifact cleanup: e.g. Microsoft Reactor, Hack2Skill
    if raw_text and title and (
        raw_text.lower() == title.lower()
        or raw_text.lower().startswith("ai genius |")
        or "github copilot" in raw_text.lower()
    ):
        if "microsoft_reactor" in source:
            return {
                "mode": "online",
                "mode_location": "Online",
                "city": None,
                "country": None,
                "location": "Online",
            }
        elif "hack2skill" in source:
            if "police-hackathon-karnataka" in event_url.lower():
                return {
                    "mode": "offline",
                    "mode_location": "Karnataka, India",
                    "city": "Bengaluru",
                    "country": "India",
                    "location": "Karnataka, India",
                }
            return {
                "mode": "online",
                "mode_location": "Online",
                "city": None,
                "country": None,
                "location": "Online",
            }
        raw_text = ""

    # 3. Multiline cleanup: e.g. AWS or MLH or Devfolio / Hack2Skill
    if "\n" in raw_text:
        lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
        # Check if any line specifies mode keywords
        for l in lines:
            l_lower = l.lower()
            if "online" in l_lower or "virtual" in l_lower:
                return {
                    "mode": "online",
                    "mode_location": "Online",
                    "city": None,
                    "country": None,
                    "location": "Online",
                }
            elif "hybrid" in l_lower:
                return {
                    "mode": "hybrid",
                    "mode_location": "Hybrid",
                    "city": None,
                    "country": None,
                    "location": "Hybrid",
                }
            elif any(k in l_lower for k in ("in_person", "in-person", "offline")):
                if "san francisco" in raw_text.lower():
                    return {
                        "mode": "offline",
                        "mode_location": "San Francisco, CA, USA",
                        "city": "San Francisco",
                        "country": "USA",
                        "location": "San Francisco, CA, USA",
                    }
                return {
                    "mode": "offline",
                    "mode_location": "In-Person",
                    "city": None,
                    "country": None,
                    "location": "In-Person",
                }

        # Check if explicitly virtual stream
        if any(ONLINE_REGEX.search(l) for l in lines) or any(
            k in raw_text.lower() for k in ["everywhere", "worldwide", "digital", "twitch", "youtube"]
        ):
            has_venue = any(
                k in raw_text.lower()
                for k in ["san francisco", "new york", "hyderabad", "chicago", "austin", "seattle", "davis"]
            )
            if not has_venue:
                return {
                    "mode": "online",
                    "mode_location": "Online",
                    "city": None,
                    "country": None,
                    "location": "Online",
                }
        if "san francisco" in raw_text.lower():
            return {
                "mode": "offline",
                "mode_location": "San Francisco, CA, USA",
                "city": "San Francisco",
                "country": "USA",
                "location": "San Francisco, CA, USA",
            }
        if "re:invent" in raw_text.lower():
            return {
                "mode": "offline",
                "mode_location": "Las Vegas, NV, USA",
                "city": "Las Vegas",
                "country": "USA",
                "location": "Las Vegas, NV, USA",
            }
        raw_text = lines[0] if lines else ""
    elif raw_text.upper() == "OFFLINE":
        return {
            "mode": "offline",
            "mode_location": "In-Person",
            "city": None,
            "country": None,
            "location": "In-Person",
        }
    elif raw_text.upper() in ("ONLINE", "VIRTUAL"):
        return {
            "mode": "online",
            "mode_location": "Online",
            "city": None,
            "country": None,
            "location": "Online",
        }
    elif raw_text.upper() == "HYBRID":
        return {
            "mode": "hybrid",
            "mode_location": "Hybrid",
            "city": None,
            "country": None,
            "location": "Hybrid",
        }

    # 4. Check explicit Online keywords
    if ONLINE_REGEX.search(raw_text) or raw_text.lower() == "online":
        return {
            "mode": "online",
            "mode_location": "Online",
            "city": None,
            "country": None,
            "location": "Online",
        }

    # 5. Check IIT Hyderabad source
    if "iit_hyderabad" in source:
        if "📍 iit hyderabad" in title.lower() or "iit hyderabad" in raw_text.lower():
            return {
                "mode": "offline",
                "mode_location": "IIT Hyderabad, Kandi",
                "city": "Hyderabad",
                "country": "India",
                "location": "Hyderabad, India",
            }
        return {
            "mode": "online",
            "mode_location": "Online",
            "city": None,
            "country": None,
            "location": "Online",
        }

    combined = f"{raw_text} {city or ''} {country or ''}".lower()

    # 6. Check Hyderabad
    if (city and city.lower() in ("hyderabad", "secunderabad", "cyberabad")) or any(
        k in combined for k in HYDERABAD_KEYWORDS
    ):
        c_name = (
            "Secunderabad"
            if (city and city.lower() == "secunderabad")
            or ("secunderabad" in combined and "hyderabad" not in combined)
            else "Hyderabad"
        )
        return {
            "mode": "offline",
            "mode_location": f"Offline - {c_name}",
            "city": c_name,
            "country": "India",
            "location": f"{c_name}, India",
        }

    # 7. Check USA
    if (country and country.lower() in ("us", "usa", "united states")) or any(
        k in combined for k in USA_KEYWORDS
    ):
        matched_city = None
        for us_c in [
            "New York City",
            "New York",
            "San Francisco",
            "Davis",
            "Seattle",
            "Austin",
            "Boston",
            "Chicago",
            "Los Angeles",
            "Washington DC",
            "Las Vegas",
        ]:
            if us_c.lower() in combined:
                matched_city = us_c
                break
        clean_loc = raw_text if raw_text and not raw_text.startswith("http") else f"{matched_city or 'USA'}, USA"
        return {
            "mode": "offline",
            "mode_location": clean_loc,
            "city": matched_city,
            "country": "USA",
            "location": f"{clean_loc}, USA" if "usa" not in clean_loc.lower() else clean_loc,
        }

    # 8. Check India (Other)
    if (country and country.lower() in ("in", "india")) or any(
        k in combined for k in INDIA_KEYWORDS
    ):
        matched_city = None
        for in_c in [
            "Bengaluru",
            "Bangalore",
            "Delhi",
            "New Delhi",
            "Mumbai",
            "Chennai",
            "Pune",
            "Kolkata",
            "Noida",
            "Gurgaon",
            "Gurugram",
            "Nagpur",
            "Kochi",
            "Coimbatore",
            "Ahmedabad",
            "Jaipur",
            "Chandigarh",
            "Hubli",
        ]:
            if in_c.lower() in combined:
                matched_city = in_c
                break
        clean_loc = (
            raw_text
            if raw_text and not raw_text.startswith("http")
            else (f"{matched_city}, India" if matched_city else "India")
        )
        return {
            "mode": "offline",
            "mode_location": clean_loc,
            "city": matched_city,
            "country": "India",
            "location": f"{clean_loc}, India" if "india" not in clean_loc.lower() else clean_loc,
        }

    # Check AWS generic community hubs without venue
    if "aws_community" in source and any(
        k in title.lower() for k in ["user group", "student builder", "partner events", "startups events", "training events"]
    ):
        return {
            "mode": "unknown",
            "mode_location": "Location not specified",
            "city": None,
            "country": None,
            "location": "Other / Unknown",
        }

    # 9. Check International
    matched_int_city = None
    matched_int_country = None
    for kw, cntry, def_city in INTERNATIONAL_KEYWORDS:
        if kw in combined:
            matched_int_country = cntry
            if kw in ("mannheim", "queretaro", "london", "tokyo", "paris", "sydney", "toronto", "singapore"):
                matched_int_city = kw.capitalize()
            elif not matched_int_city:
                matched_int_city = def_city
            break

    if matched_int_country:
        final_city = city or matched_int_city
        clean_loc = f"{final_city}, {matched_int_country}"
        return {
            "mode": "offline",
            "mode_location": clean_loc,
            "city": final_city,
            "country": matched_int_country,
            "location": clean_loc,
        }

    # 10. Unknown / Not specified
    if not raw_text or raw_text.lower() in (
        "location not specified",
        "unspecified",
        "tbd",
        "unknown",
        "other / unknown",
    ):
        return {
            "mode": "unknown",
            "mode_location": "Location not specified",
            "city": None,
            "country": None,
            "location": "Other / Unknown",
        }

    return {
        "mode": "offline",
        "mode_location": raw_text,
        "city": city,
        "country": country,
        "location": raw_text,
    }


def classify_event_location(event: Dict[str, Any]) -> str:
    """
    Classifies an event into one of the canonical location categories:
    'Hyderabad', 'India', 'USA', 'Online', 'Other'.
    Operates strictly on location metadata (mode, mode_location, city, country, location).
    """
    # 1. Online: Explicit mode or online keywords
    if is_online_event(event):
        return "Online"

    city = str(event.get("city") or "").strip().lower()
    country = str(event.get("country") or "").strip().lower()
    mode_loc = str(event.get("mode_location") or "").strip().lower()
    loc = str(event.get("location") or "").strip().lower()

    # Discard non-venue strings (URLs, titles) from classification matching
    if mode_loc.startswith("http://") or mode_loc.startswith("https://"):
        mode_loc = ""
    if loc.startswith("http://") or loc.startswith("https://"):
        loc = ""

    raw_loc = f"{mode_loc} {city} {country} {loc}".strip()

    # 2. Hyderabad: Explicit Hyderabad or Secunderabad match
    if city in ("hyderabad", "secunderabad", "cyberabad"):
        return "Hyderabad"
    for keyword in HYDERABAD_KEYWORDS:
        if keyword in raw_loc:
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

    # 5. Fallback check for online term in clean location fields
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
