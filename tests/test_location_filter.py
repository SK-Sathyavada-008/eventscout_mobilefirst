"""
tests/test_location_filter.py
=============================
Tests for Location/Place categorization and filtering logic.
Verifies:
1. Hyderabad categorization (mode_location="Hyderabad", city="Hyderabad", secunderabad)
2. India (Other) categorization (Bengaluru, Mumbai, Delhi, country="India", excluding Hyderabad)
3. USA categorization (San Francisco, CA, Austin, TX, country="USA")
4. Online categorization (mode_location="Online", "Virtual Webinar", etc.)
5. Other / Unknown categorization (London, UK, Berlin, Germany, empty location)
6. Negative tests: An online event with "Hyderabad" or "San Francisco" in title/description
   must NOT be classified as Hyderabad or USA (strictly check location fields).
7. match_location_filter behavior for 'All' and each individual category.
"""

import unittest
from eventscout.utils.location_utils import classify_event_location, match_location_filter


class TestLocationFilter(unittest.TestCase):
    def test_classify_online_events(self):
        """Online events are identified and not misclassified as physical places."""
        ev1 = {"title": "Virtual AI Conference", "mode_location": "Online"}
        self.assertEqual(classify_event_location(ev1), "Online")

        ev2 = {"title": "Remote Hackathon", "mode_location": "Virtual / Remote"}
        self.assertEqual(classify_event_location(ev2), "Online")

        ev3 = {"title": "Global Webinar", "mode_location": "Webinar Worldwide"}
        self.assertEqual(classify_event_location(ev3), "Online")

    def test_classify_hyderabad_events(self):
        """Hyderabad and Secunderabad are accurately classified as Hyderabad."""
        ev1 = {"title": "Hyderabad DevFest", "mode_location": "Hyderabad, Telangana, India", "city": "Hyderabad"}
        self.assertEqual(classify_event_location(ev1), "Hyderabad")

        ev2 = {"title": "HITEC City Meetup", "mode_location": "T-Hub, Hyderabad"}
        self.assertEqual(classify_event_location(ev2), "Hyderabad")

        ev3 = {"title": "Secunderabad Workshop", "mode_location": "Secunderabad, Telangana"}
        self.assertEqual(classify_event_location(ev3), "Hyderabad")

    def test_classify_india_other_events(self):
        """Indian locations outside Hyderabad are classified as India."""
        ev1 = {"title": "Bangalore Tech Summit", "mode_location": "Bengaluru, Karnataka, India", "city": "Bengaluru"}
        self.assertEqual(classify_event_location(ev1), "India")

        ev2 = {"title": "Mumbai Python Meetup", "mode_location": "Mumbai, Maharashtra"}
        self.assertEqual(classify_event_location(ev2), "India")

        ev3 = {"title": "Delhi Open Source Day", "mode_location": "New Delhi", "country": "India"}
        self.assertEqual(classify_event_location(ev3), "India")

    def test_classify_usa_events(self):
        """US events are classified as USA."""
        ev1 = {"title": "SF Tech Week", "mode_location": "San Francisco, CA, USA", "country": "USA"}
        self.assertEqual(classify_event_location(ev1), "USA")

        ev2 = {"title": "Austin AI Summit", "mode_location": "Austin, Texas"}
        self.assertEqual(classify_event_location(ev2), "USA")

        ev3 = {"title": "Seattle Cloud Expo", "mode_location": "Seattle, Washington", "country": "US"}
        self.assertEqual(classify_event_location(ev3), "USA")

    def test_classify_other_unknown_events(self):
        """Events in other international locations or missing location metadata fall into Other."""
        ev1 = {"title": "London PyData", "mode_location": "London, UK"}
        self.assertEqual(classify_event_location(ev1), "Other")

        ev2 = {"title": "Tokyo Game Dev", "mode_location": "Tokyo, Japan"}
        self.assertEqual(classify_event_location(ev2), "Other")

        ev3 = {"title": "Unspecified Meetup", "mode_location": ""}
        self.assertEqual(classify_event_location(ev3), "Other")

    def test_negative_isolation_from_title_and_description(self):
        """Event title and description mentioning cities MUST NOT trigger false positive location matching."""
        ev_online = {
            "title": "Hyderabad AI Hackathon Watch Party Online",
            "description": "Join us from San Francisco, Hyderabad, London or anywhere in India!",
            "mode_location": "Online",
            "city": "",
            "country": "",
        }
        # Because mode_location is Online, it must be classified as Online, NOT Hyderabad, India, or USA
        self.assertEqual(classify_event_location(ev_online), "Online")

    def test_match_location_filter(self):
        """match_location_filter returns True for 'All' and matches category accurately."""
        hyd_event = {"mode_location": "Hyderabad, India"}
        online_event = {"mode_location": "Online"}

        # All returns True
        self.assertTrue(match_location_filter(hyd_event, "All"))
        self.assertTrue(match_location_filter(online_event, "All"))

        # Case insensitive matching
        self.assertTrue(match_location_filter(hyd_event, "Hyderabad"))
        self.assertTrue(match_location_filter(hyd_event, "hyderabad"))
        self.assertFalse(match_location_filter(hyd_event, "India"))

        self.assertTrue(match_location_filter(online_event, "Online"))
        self.assertFalse(match_location_filter(online_event, "USA"))

    def test_fallback_events_dataset(self):
        """Verifies every event in real dataset fallback_events.json maps to a valid category."""
        import json
        from pathlib import Path

        path = Path("frontend/public/fallback_events.json")
        if not path.exists():
            return

        with open(path, "r", encoding="utf-8") as f:
            events = json.load(f)

        valid_categories = {"Hyderabad", "India", "USA", "Online", "Other"}
        counts = {cat: 0 for cat in valid_categories}

        for ev in events:
            cat = classify_event_location(ev)
            self.assertIn(cat, valid_categories)
            counts[cat] += 1

        # Confirm expected counts
        self.assertGreater(counts["Hyderabad"], 0)
        self.assertGreater(counts["India"], 0)
        self.assertGreater(counts["Online"], 0)
        self.assertGreater(counts["USA"], 0)
        self.assertGreater(counts["Other"], 0)
        self.assertEqual(sum(counts.values()), len(events))


if __name__ == "__main__":
    unittest.main()
