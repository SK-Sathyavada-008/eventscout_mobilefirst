"""
Event domain model for EventScout.
Provides a standardized representation of events collected across all platforms.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class Event:
    """
    Standardized Event data model.
    Maintains 100% backward compatibility with existing data/events.json fields
    while providing enriched metadata for discovery, filtering, and notifications.
    """
    # Core identifying fields
    title: str
    event_url: str
    date_time: datetime
    organizer: str
    source: str = "meetup"

    # Location & Attendance
    mode: str = "online"
    mode_location: str = "Online"
    location: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None

    # Media & Display
    poster_image_url: Optional[str] = None
    description: Optional[str] = None

    # Pricing
    is_free: bool = True
    price_amount: Optional[float] = None
    price_currency: Optional[str] = None

    # Platform & Identification
    source_event_id: Optional[str] = None
    registration_url: Optional[str] = None

    # Technical Classification & Discovery
    is_technical: bool = True
    categories: List[str] = field(default_factory=list)

    # Date, Deadlines & Timeline
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    registration_deadline: Optional[datetime] = None
    submission_deadline: Optional[datetime] = None

    # Metadata
    scraped_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    def __getitem__(self, key: str) -> Any:
        """Enables dictionary-style indexing e.g. event['title']."""
        try:
            return getattr(self, key)
        except AttributeError:
            raise KeyError(key)

    def get(self, key: str, default: Any = None) -> Any:
        """Enables dict-like get method e.g. event.get('price_amount')."""
        return getattr(self, key, default)

    def __contains__(self, key: str) -> bool:
        """Enables 'title' in event checks."""
        return hasattr(self, key)

    def to_dict(self) -> Dict[str, Any]:
        """Convert the Event instance into a JSON-serializable dictionary."""
        d = asdict(self)
        for dt_field in ("date_time", "start_date", "end_date", "registration_deadline", "submission_deadline"):
            val = getattr(self, dt_field, None)
            if isinstance(val, datetime):
                d[dt_field] = val.isoformat()
        return d
