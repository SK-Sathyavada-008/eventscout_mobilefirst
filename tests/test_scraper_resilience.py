"""
tests/test_scraper_resilience.py
================================
Tests for scraper error resilience, failure isolation, and log sanitization.
"""

import pytest
from unittest.mock import MagicMock, patch

from eventscout.services.scraper_service import ScraperService
from eventscout.utils.logging_config import sanitize_dict, sanitize_value


def test_sensitive_data_sanitization():
    """Verify that passwords, tokens, and API keys are strictly redacted in logs."""
    raw_payload = {
        "email": "user@example.com",
        "password": "SuperSecretPassword123!",
        "jwt_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy",
        "api_key": "AIzaSyDummyGeminiKey",
        "nested": {
            "bearer_token": "secret_bearer_token",
            "safe_field": "public_data",
        }
    }

    sanitized = sanitize_dict(raw_payload)

    assert sanitized["email"] == "user@example.com"
    assert sanitized["password"] == "***REDACTED***"
    assert sanitized["jwt_token"] == "***REDACTED***"
    assert sanitized["api_key"] == "***REDACTED***"
    assert sanitized["nested"]["bearer_token"] == "***REDACTED***"
    assert sanitized["nested"]["safe_field"] == "public_data"


def test_scraper_failure_isolation():
    """Verify that if one source raises an exception, the entire scraper does NOT crash."""
    mock_source_db = MagicMock()
    mock_source_db.get_enabled_sources.return_value = [
        {"id": "source_broken", "name": "Broken Site", "strategy": "REST_API"},
        {"id": "source_working", "name": "Working Site", "strategy": "REST_API"},
    ]

    mock_event_db = MagicMock()
    mock_notif_service = MagicMock()

    service = ScraperService(
        notification_service=mock_notif_service,
        source_db=mock_source_db,
        event_db=mock_event_db,
    )

    # Patch factory to simulate first source throwing an error and second succeeding
    with patch("eventscout.services.scraper_service.get_collector_for_source") as mock_factory:
        failing_collector = MagicMock()
        failing_collector.collect.side_effect = TimeoutError("Connection to source timed out")

        working_collector = MagicMock()
        working_collector.collect.return_value = [
            {"title": "Valid Event", "date_time": "2026-10-15T10:00:00Z", "url": "https://example.com/ev1"}
        ]

        mock_factory.side_effect = [failing_collector, working_collector]

        # Running pipeline should complete cleanly without unhandled exception
        summary = service.run_pipeline(max_pages=1)

        assert summary["dynamic_sources_executed"] == 2
        # Verify that source_db recorded failure for the broken source
        mock_source_db.update_source_health.assert_any_call(
            "source_broken", success=False, error_msg="Connection to source timed out"
        )


import unittest
from datetime import datetime, timezone
from eventscout.processors.normalizer import EventNormalizer, parse_datetime_flexible
from eventscout.filters.technical_filter import TechnicalEventFilter
from eventscout.database.mongodb import EventDatabase


class TestScraperPipelines(unittest.TestCase):
    def setUp(self):
        self.normalizer = EventNormalizer()
        self.tech_filter = TechnicalEventFilter()

    def test_devfolio_normalization_and_classification(self):
        """Verify Devfolio events with non-keyword titles survive classification via source context."""
        raw_card = {
            "title": "DEFINE 4.0",
            "event_url": "https://define4.devfolio.co/",
            "date_time": "STARTS 09/10/26",
            "mode_location": "OFFLINE\nOPEN\nSTARTS 09/10/26",
            "description": "DEFINE 4.0 | Hackathon | THEME | NO RESTRICTIONS | +250 participating | OFFLINE",
            "poster_image_url": "https://assets.devfolio.co/users/sample.png",
        }
        source_meta = {"name": "Devfolio", "source_type": "hackathon_platform"}
        ev = self.normalizer.normalize(raw_card, source_meta)
        self.assertIsNotNone(ev)
        self.assertEqual(ev.title, "DEFINE 4.0")
        self.assertEqual(ev.mode_location, "In-Person")
        self.assertEqual(ev.organizer, "Devfolio")

        # Must survive technical classification
        is_tech, cats = self.tech_filter.classify(ev.title, ev.description, ev.organizer)
        self.assertTrue(is_tech)
        self.assertIn("Open Source & Hackathons", cats)

    def test_devpost_date_ranges_and_classification(self):
        """Verify Devpost submission period ranges parse and events survive classification."""
        raw_tile = {
            "title": "RevenueCat Shipaton 2026",
            "event_url": "https://revenuecat-shipaton-2026.devpost.com/",
            "date_time": "Jul 31 - Oct 01, 2026",
            "mode_location": "Online",
            "description": "Build high-growth apps in this developer hackathon challenge.",
            "poster_image_url": "https://d112y698adiu2z.cloudfront.net/sample.jpg",
        }
        source_meta = {"name": "Devpost", "source_type": "hackathon_platform"}
        ev = self.normalizer.normalize(raw_tile, source_meta)
        self.assertIsNotNone(ev)
        self.assertEqual(ev.title, "RevenueCat Shipaton 2026")
        self.assertEqual(ev.mode_location, "Online")

        # Verify parsed date is accurate to October 1, 2026
        dt = parse_datetime_flexible("Jul 31 - Oct 01, 2026")
        self.assertEqual(dt.year, 2026)
        self.assertEqual(dt.month, 10)
        self.assertEqual(dt.day, 1)

        is_tech, cats = self.tech_filter.classify(ev.title, ev.description, ev.organizer)
        self.assertTrue(is_tech)
        self.assertIn("Open Source & Hackathons", cats)

    def test_hack2skill_title_extraction_and_expiration(self):
        """Verify Hack2Skill titles are legitimate event names and dates filter expired events."""
        past_card = {
            "title": "AI for Impact",
            "event_url": "https://hack2skill.com/event/aiforimpact_reg",
            "date_time": "Mon Nov 25 2024",
            "mode_location": "FREE | VIRTUAL\nRegistration closed",
            "description": "AI for Impact Hackathon",
        }
        future_card = {
            "title": "Builder Pop-Up",
            "event_url": "https://hack2skill.com/event/builderpopup/",
            "date_time": "Wed Oct 07 2026",
            "mode_location": "FREE | IN_PERSON\nRegister Now",
            "description": "In-person builder hackathon",
        }
        source_meta = {"name": "Hack2Skill", "source_type": "hackathon_platform"}

        # Past event normalization & expiration check
        ev_past = self.normalizer.normalize(past_card, source_meta)
        self.assertIsNotNone(ev_past)
        self.assertNotEqual(ev_past.title, "Registration closed")
        self.assertEqual(ev_past.title, "AI for Impact")
        self.assertEqual(ev_past.mode_location, "Online")
        # Past 2024 date is expired
        self.assertTrue(EventDatabase.is_expired(ev_past.date_time, reference_time=datetime(2026, 9, 22, tzinfo=timezone.utc)))

        # Future event normalization & upcoming check
        ev_future = self.normalizer.normalize(future_card, source_meta)
        self.assertIsNotNone(ev_future)
        self.assertEqual(ev_future.title, "Builder Pop-Up")
        self.assertEqual(ev_future.mode_location, "In-Person")
        self.assertFalse(EventDatabase.is_expired(ev_future.date_time, reference_time=datetime(2026, 9, 22, tzinfo=timezone.utc)))

    def test_existing_meetup_source_regression(self):
        """Verify existing Meetup event data continues to parse and normalize cleanly."""
        raw_meetup = {
            "title": "Hyderabad Python Users Group: Python 3.14 Deep Dive",
            "event_url": "https://www.meetup.com/hyderabad-python/events/123456/",
            "date_time": "2026-10-15T10:00:00+05:30",
            "mode_location": "In-Person - Hyderabad",
            "description": "Deep dive into Python language features and optimizations.",
            "organizer": "Hyderabad Python Users Group",
        }
        ev = self.normalizer.normalize(raw_meetup, {"name": "Meetup"})
        self.assertIsNotNone(ev)
        self.assertEqual(ev.title, "Hyderabad Python Users Group: Python 3.14 Deep Dive")
        is_tech, cats = self.tech_filter.classify(ev.title, ev.description, ev.organizer)
        self.assertTrue(is_tech)
        self.assertIn("Software & Web Development", cats)


if __name__ == "__main__":
    unittest.main()
