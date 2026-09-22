"""
Event Normalizer for EventScout.
Converts arbitrary raw dictionaries from dynamic collectors into standardized Event domain models.
"""
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from eventscout.models.event import Event

logger = logging.getLogger("EventNormalizer")


def parse_datetime_flexible(val: Any) -> Optional[datetime]:
    """
    Attempts to parse arbitrary date/time formats into an aware UTC datetime object.
    Supports ISO formats, epoch timestamps (seconds or ms), and common text date strings.
    """
    if val is None:
        return None

    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc)

    # If integer or float timestamp
    if isinstance(val, (int, float)):
        # If timestamp is in milliseconds (e.g. > 10^11)
        if val > 1e11:
            val = val / 1000.0
        try:
            return datetime.fromtimestamp(val, tz=timezone.utc)
        except Exception:
            return None

    val_str = str(val).strip()
    if not val_str:
        return None

    # Try numeric string
    if val_str.isdigit():
        num = int(val_str)
        if num > 1e11:
            num = num / 1000.0
        try:
            return datetime.fromtimestamp(num, tz=timezone.utc)
        except Exception:
            pass

    # Try standard ISO parsing
    try:
        # Replace 'Z' with +00:00 for python fromisoformat
        iso_str = val_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass

    # Try common format strings
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d %b %Y %H:%M",
        "%d %B %Y %H:%M",
        "%b %d, %Y",
        "%B %d, %Y",
        "%a %b %d %Y",
        "%a, %b %d, %Y, %I:%M %p",
        "%a, %b %d, %I:%M %p",
        "%A, %B %d, %Y",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y",
        "%d/%m/%Y",
        "%d/%m/%y",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(val_str, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue

    now = datetime.now(timezone.utc)

    # Check for embedded date patterns like 'Mon Nov 25 2024' or 'Wed Oct 07 2026'
    match_weekday_date = re.search(r"\b([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4})\b", val_str)
    if match_weekday_date:
        try:
            dt = datetime.strptime(match_weekday_date.group(1), "%a %b %d %Y")
            return dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass

    # Check for embedded 'STARTS DD/MM/YY' or 'STARTS DD/MM/YYYY'
    match_starts = re.search(r"STARTS?\s+(\d{1,2}/\d{1,2}/\d{2,4})", val_str, re.IGNORECASE)
    if match_starts:
        d_str = match_starts.group(1)
        for d_fmt in ("%d/%m/%y", "%d/%m/%Y"):
            try:
                dt = datetime.strptime(d_str, d_fmt)
                return dt.replace(tzinfo=timezone.utc)
            except Exception:
                pass

    # Check for date ranges e.g. 'Jul 31 - Oct 01, 2026' or 'Aug 31 - Oct 23, 2026'
    match_range = re.search(r"-\s*([A-Za-z]{3}\s+\d{1,2},\s*\d{4})", val_str)
    if match_range:
        try:
            dt = datetime.strptime(match_range.group(1), "%b %d, %Y")
            return dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass

    # Fallback: Check for future date if relative (e.g., "In 2 days", "Tomorrow", "9 days left", "about 1 month left")
    lower_val = val_str.lower()
    if "tomorrow" in lower_val:
        return now + timedelta(days=1)
    if "today" in lower_val:
        return now

    match_relative = re.search(r"(?:about\s+)?(\d+)\s+(day|days|week|weeks|month|months|hour|hours)\s+left", lower_val)
    if match_relative:
        num = int(match_relative.group(1))
        unit = match_relative.group(2)
        if "day" in unit:
            return now + timedelta(days=num)
        elif "week" in unit:
            return now + timedelta(weeks=num)
        elif "month" in unit:
            return now + timedelta(days=num * 30)
        elif "hour" in unit:
            return now + timedelta(hours=num)

    # If all parsing fails, return a default future date (e.g. 7 days from now) with warning
    logger.warning("Unable to parse date string '%s'. Defaulting to 7 days from now.", val_str)
    return now + timedelta(days=7)


class EventNormalizer:
    """
    Validates and normalizes raw event dicts into domain Event instances.
    """

    def __init__(self, default_source_name: str = "generic"):
        self.default_source_name = default_source_name

    def normalize(self, raw_item: Dict[str, Any], source_meta: Optional[Dict[str, Any]] = None) -> Optional[Event]:
        source_meta = source_meta or {}
        source_name = source_meta.get("name") or self.default_source_name

        # 1. Title (Mandatory)
        title = raw_item.get("title")
        if not title or not isinstance(title, str) or not title.strip():
            return None
        title = re.sub(r"\s+", " ", title).strip()

        # If title is a raw URL, convert the slug into a human-readable title
        if title.startswith("http://") or title.startswith("https://"):
            path = title.split("?")[0].rstrip("/")
            slug = path.split("/")[-1]
            slug = re.sub(r"^google-gdg-", "GDG ", slug, flags=re.I)
            slug = re.sub(r"-presents-", ": ", slug, flags=re.I)
            slug = slug.replace("-", " ").strip()
            title = " ".join([w.capitalize() if not w.isupper() else w for w in slug.split()]) or title

        # Strip common redundant suffixes
        title = re.sub(r"\s*\|\s*Google Developer Groups.*$", "", title, flags=re.I).strip()
        title = re.sub(r"\s*\|\s*HackerEarth.*$", "", title, flags=re.I).strip()
        title = re.sub(r"\s*-\s*Devfolio.*$", "", title, flags=re.I).strip()

        # 2. Event URL (Mandatory)
        event_url = raw_item.get("event_url") or raw_item.get("url") or source_meta.get("url") or ""
        if not event_url:
            return None

        # 3. Date Time (Mandatory)
        raw_dt = raw_item.get("date_time") or raw_item.get("startDate") or raw_item.get("start_time") or raw_item.get("date")
        date_time = parse_datetime_flexible(raw_dt)
        if not date_time:
            date_time = datetime.now(timezone.utc) + timedelta(days=7)

        # 4. Organizer
        organizer = raw_item.get("organizer") or raw_item.get("host") or source_name
        organizer = str(organizer).strip() if organizer else source_name

        # 5. Location / Mode
        mode_location = raw_item.get("mode_location") or raw_item.get("location") or "Online"
        mode_str = str(mode_location).strip()
        if "\n" in mode_str:
            lines = [l.strip() for l in mode_str.split("\n") if l.strip()]
            found_mode = None
            for l in lines:
                l_lower = l.lower()
                if "online" in l_lower or "virtual" in l_lower:
                    found_mode = "Online"
                    break
                elif "hybrid" in l_lower:
                    found_mode = "Hybrid"
                    break
                elif "in_person" in l_lower or "in-person" in l_lower or "offline" in l_lower:
                    found_mode = "In-Person"
                    break
            mode_str = found_mode or (lines[0] if lines else "Online")
        elif mode_str.upper() == "OFFLINE":
            mode_str = "In-Person"
        elif mode_str.upper() in ("ONLINE", "VIRTUAL"):
            mode_str = "Online"
        elif mode_str.upper() == "HYBRID":
            mode_str = "Hybrid"

        # 6. Pricing
        is_free = raw_item.get("is_free", True)
        if isinstance(is_free, str):
            is_free = is_free.lower() in ("true", "free", "1", "yes")

        price_amount = raw_item.get("price_amount")
        if price_amount is not None:
            try:
                price_amount = float(price_amount)
            except Exception:
                price_amount = None

        price_currency = raw_item.get("price_currency")

        # 7. Categories & Technical flag
        categories = raw_item.get("categories") or []
        if isinstance(categories, str):
            categories = [c.strip() for c in categories.split(",") if c.strip()]

        is_technical = raw_item.get("is_technical", True)
        if isinstance(is_technical, str):
            is_technical = is_technical.lower() in ("true", "1", "yes")

        # 8. IDs and URLs
        source_event_id = raw_item.get("source_event_id") or raw_item.get("id")
        if source_event_id:
            source_event_id = str(source_event_id)
        else:
            source_event_id = event_url

        registration_url = raw_item.get("registration_url") or event_url
        poster_image_url = raw_item.get("poster_image_url") or raw_item.get("image")
        
        # Discard profile avatars, user photos, and attendee portraits from being treated as event posters
        if poster_image_url:
            img_lower = str(poster_image_url).lower()
            if any(k in img_lower for k in ("avatar", "/users/", "/user/", "profile", "attendee", "gravatar", "author")):
                poster_image_url = None

        description = raw_item.get("description")
        if description:
            description = str(description).strip()
            if description.startswith("http://") or description.startswith("https://"):
                description = None

        # If description is missing but source is a hackathon platform, provide informative technical fallback
        if not description:
            source_type = source_meta.get("source_type", "")
            if "hackathon" in source_type.lower() or "hackathon" in source_name.lower():
                description = f"Technical hackathon opportunity hosted on {source_name}."

        return Event(
            title=title,
            event_url=event_url,
            date_time=date_time,
            organizer=organizer,
            source=source_name.lower().replace(" ", "_"),
            mode_location=mode_str,
            city=raw_item.get("city"),
            country=raw_item.get("country"),
            poster_image_url=poster_image_url,
            description=description,
            is_free=is_free,
            price_amount=price_amount,
            price_currency=price_currency,
            source_event_id=source_event_id,
            registration_url=registration_url,
            is_technical=is_technical,
            categories=categories,
        )

    def normalize_batch(self, raw_items: List[Dict[str, Any]], source_meta: Optional[Dict[str, Any]] = None) -> List[Event]:
        valid_events = []
        for item in raw_items:
            ev = self.normalize(item, source_meta)
            if ev:
                valid_events.append(ev)
        return valid_events
