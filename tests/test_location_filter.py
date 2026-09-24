"""
tests/test_location_filter.py
=============================
Tests for Location/Place categorization, normalization, and multi-criteria filtering logic.
Verifies:
1. Hyderabad categorization (Hyderabad, Hyderabad Telangana, Hyderabad India, HITEC City / Hyderabad, Gachibowli, Secunderabad)
2. USA categorization (New York / USA, Davis CA, Austin TX, SF CA)
3. International categorization (London / UK, Mannheim / Germany, Queretaro / Mexico)
4. Other Indian city categorization (Bengaluru, Nagpur, Chennai, Mumbai, Delhi)
5. Online categorization (Explicit online event, Zoom, Webinar, Digital)
6. Unknown & Missing location categorization
7. Data integrity constraints:
   - USA does not become Hyderabad.
   - UK does not become India.
   - Unknown does not become Hyderabad.
   - Online does not become Offline.
   - Hyderabad is detected only from actual event location metadata.
8. Filter combinations:
   - Hyderabad + Conference
   - Hyderabad + Hackathon
   - Hyderabad + Workshop
   - Online + Hackathon
   - USA + Conference
   - India (Other) + Workshop
9. Deterministic normalization with normalize_event_location.
"""

import unittest
from eventscout.utils.location_utils import (
    classify_event_location,
    match_location_filter,
    normalize_event_location,
    is_online_event,
    is_offline_event,
)


class TestLocationFilter(unittest.TestCase):
    # -------------------------------------------------------------------------
    # 1. Location Classification Requirements (Items 1-10)
    # -------------------------------------------------------------------------

    def test_01_classify_hyderabad_simple(self):
        """1. Plain 'Hyderabad'"""
        ev = {"mode_location": "Hyderabad", "city": "Hyderabad"}
        self.assertEqual(classify_event_location(ev), "Hyderabad")

    def test_02_classify_hyderabad_telangana(self):
        """2. 'Hyderabad, Telangana'"""
        ev = {"mode_location": "Hyderabad, Telangana", "city": "Hyderabad", "country": "India"}
        self.assertEqual(classify_event_location(ev), "Hyderabad")

    def test_03_classify_hyderabad_india(self):
        """3. 'Hyderabad, India'"""
        ev = {"mode_location": "Hyderabad, India", "city": "Hyderabad", "country": "India"}
        self.assertEqual(classify_event_location(ev), "Hyderabad")

    def test_04_classify_hitec_city_hyderabad(self):
        """4. 'HITEC City / Hyderabad'"""
        ev1 = {"mode_location": "HITEC City, Hyderabad", "city": "Hyderabad"}
        self.assertEqual(classify_event_location(ev1), "Hyderabad")

        ev2 = {"mode_location": "T-Hub, HITEC City", "city": "Hyderabad"}
        self.assertEqual(classify_event_location(ev2), "Hyderabad")

        ev3 = {"mode_location": "Gachibowli, Hyderabad"}
        self.assertEqual(classify_event_location(ev3), "Hyderabad")

        ev4 = {"mode_location": "Secunderabad, Telangana"}
        self.assertEqual(classify_event_location(ev4), "Hyderabad")

    def test_05_classify_new_york_usa(self):
        """5. 'New York / USA'"""
        ev1 = {"mode_location": "New York, USA", "city": "New York", "country": "USA"}
        self.assertEqual(classify_event_location(ev1), "USA")

        ev2 = {"mode_location": "Davis, California", "country": "USA"}
        self.assertEqual(classify_event_location(ev2), "USA")

        ev3 = {"mode_location": "San Francisco, CA, USA", "city": "San Francisco"}
        self.assertEqual(classify_event_location(ev3), "USA")

    def test_06_classify_london_uk(self):
        """6. 'London / UK'"""
        ev1 = {"mode_location": "London, UK", "city": "London", "country": "UK"}
        self.assertEqual(classify_event_location(ev1), "Other")

        ev2 = {"mode_location": "Mannheim, Germany", "city": "Mannheim", "country": "Germany"}
        self.assertEqual(classify_event_location(ev2), "Other")

    def test_07_classify_other_indian_city(self):
        """7. 'Other Indian city' (Bengaluru, Nagpur, Chennai, Mumbai, Delhi)"""
        ev1 = {"mode_location": "Bengaluru, Karnataka, India", "city": "Bengaluru", "country": "India"}
        self.assertEqual(classify_event_location(ev1), "India")

        ev2 = {"mode_location": "Nagpur, India", "city": "Nagpur", "country": "India"}
        self.assertEqual(classify_event_location(ev2), "India")

        ev3 = {"mode_location": "Chennai, India", "city": "Chennai", "country": "India"}
        self.assertEqual(classify_event_location(ev3), "India")

        ev4 = {"mode_location": "Mumbai, Maharashtra", "city": "Mumbai"}
        self.assertEqual(classify_event_location(ev4), "India")

    def test_08_classify_explicit_online_event(self):
        """8. 'Explicit online event'"""
        ev1 = {"mode_location": "Online"}
        self.assertEqual(classify_event_location(ev1), "Online")

        ev2 = {"mode": "online", "mode_location": "Virtual / Remote"}
        self.assertEqual(classify_event_location(ev2), "Online")

        ev3 = {"mode_location": "Global Webinar Everywhere, Worldwide DIGITAL"}
        self.assertEqual(classify_event_location(ev3), "Online")

    def test_09_classify_unknown_location(self):
        """9. 'Unknown location'"""
        ev1 = {"mode_location": "Location not specified", "city": None, "country": None}
        self.assertEqual(classify_event_location(ev1), "Other")

        ev2 = {"mode_location": "Unknown", "city": "", "country": ""}
        self.assertEqual(classify_event_location(ev2), "Other")

    def test_10_classify_missing_location(self):
        """10. 'Missing location'"""
        ev1 = {"mode_location": "", "city": None, "country": None, "location": None}
        self.assertEqual(classify_event_location(ev1), "Other")

        ev2 = {}
        self.assertEqual(classify_event_location(ev2), "Other")

    # -------------------------------------------------------------------------
    # 2. Data Integrity Guarantees
    # -------------------------------------------------------------------------

    def test_data_integrity_usa_not_hyderabad(self):
        """USA events MUST NEVER be classified as Hyderabad."""
        ev = {"title": "NYC Hackathon", "mode_location": "New York City, New York", "country": "USA"}
        cat = classify_event_location(ev)
        self.assertNotEqual(cat, "Hyderabad")
        self.assertEqual(cat, "USA")

    def test_data_integrity_uk_not_india(self):
        """UK events MUST NEVER be classified as India."""
        ev = {"title": "London AI Summit", "mode_location": "London, UK", "city": "London", "country": "UK"}
        cat = classify_event_location(ev)
        self.assertNotEqual(cat, "India")
        self.assertEqual(cat, "Other")

    def test_data_integrity_unknown_not_hyderabad(self):
        """Unknown or empty locations MUST NEVER pretend to be Hyderabad."""
        ev = {"title": "Mystery Hackathon", "mode_location": "Location not specified"}
        cat = classify_event_location(ev)
        self.assertNotEqual(cat, "Hyderabad")
        self.assertEqual(cat, "Other")

    def test_data_integrity_online_not_offline(self):
        """Online events MUST be recognized as online and not offline."""
        ev = {"title": "Global Online Challenge", "mode_location": "Online"}
        self.assertTrue(is_online_event(ev))
        self.assertFalse(is_offline_event(ev))
        self.assertEqual(classify_event_location(ev), "Online")

    def test_data_integrity_no_false_match_from_description_or_title(self):
        """Hyderabad in description/title MUST NOT classify an online or foreign event as Hyderabad."""
        ev_online = {
            "title": "Hyderabad AI Hackathon Watch Party Online",
            "description": "Join developers from Hyderabad, New York, and London in this global virtual webinar.",
            "mode_location": "Online",
            "city": "",
            "country": "",
        }
        self.assertEqual(classify_event_location(ev_online), "Online")
        self.assertNotEqual(classify_event_location(ev_online), "Hyderabad")

    # -------------------------------------------------------------------------
    # 3. Filter Combinations Testing
    # -------------------------------------------------------------------------

    def test_filter_combinations(self):
        """Test multi-signal filter combinations: Location + Category / Type."""
        import re

        HACKATHON_REGEX = re.compile(r"\b(hackathon|hackathons|hack|hacks|buildathon|codeathon|datathon)\b", re.I)
        WORKSHOP_REGEX = re.compile(r"\b(workshop|workshops|bootcamp|masterclass|hands-on|tutorial)\b", re.I)
        CONFERENCE_REGEX = re.compile(r"\b(conference|conferences|summit|summits|symposium|convention|keynote)\b", re.I)

        def is_conf(e):
            text = f"{e.get('title', '')} {' '.join(e.get('categories', []))}".lower()
            return bool(CONFERENCE_REGEX.search(text))

        def is_hack(e):
            text = f"{e.get('title', '')} {' '.join(e.get('categories', []))}".lower()
            return bool(HACKATHON_REGEX.search(text))

        def is_ws(e):
            text = f"{e.get('title', '')} {' '.join(e.get('categories', []))}".lower()
            return bool(WORKSHOP_REGEX.search(text))

        events = [
            # 1. Hyderabad + Conference
            {
                "title": "Apache Kafka Conference Hyderabad 2026",
                "categories": ["Conference", "Data"],
                "mode_location": "Offline - Hyderabad",
                "city": "Hyderabad",
                "country": "India",
            },
            # 2. Hyderabad + Hackathon
            {
                "title": "Convergence Hackathon Hyderabad 2k26",
                "categories": ["Hackathon", "AI"],
                "mode_location": "Offline - Hyderabad",
                "city": "Hyderabad",
                "country": "India",
            },
            # 3. Hyderabad + Workshop
            {
                "title": "Hands-on Generative AI Workshop Hyderabad",
                "categories": ["Workshop", "Generative AI"],
                "mode_location": "Offline - Hyderabad",
                "city": "Hyderabad",
                "country": "India",
            },
            # 4. Online + Hackathon
            {
                "title": "Nebius Global AI Hackathon",
                "categories": ["Hackathon", "AI"],
                "mode_location": "Online",
            },
            # 5. USA + Conference
            {
                "title": "AWS re:Invent Cloud Conference",
                "categories": ["Conference", "Cloud"],
                "mode_location": "Las Vegas, NV, USA",
                "country": "USA",
            },
            # 6. India (Other) + Workshop
            {
                "title": "Bengaluru React Developer Workshop",
                "categories": ["Workshop", "React"],
                "mode_location": "Bengaluru, Karnataka, India",
                "city": "Bengaluru",
                "country": "India",
            },
        ]

        # Combination 1: Hyderabad + Conference
        hyd_conf = [
            e for e in events
            if match_location_filter(e, "Hyderabad") and is_conf(e)
        ]
        self.assertEqual(len(hyd_conf), 1)
        self.assertIn("Kafka", hyd_conf[0]["title"])

        # Combination 2: Hyderabad + Hackathon
        hyd_hack = [
            e for e in events
            if match_location_filter(e, "Hyderabad") and is_hack(e)
        ]
        self.assertEqual(len(hyd_hack), 1)
        self.assertIn("Convergence", hyd_hack[0]["title"])

        # Combination 3: Hyderabad + Workshop
        hyd_ws = [
            e for e in events
            if match_location_filter(e, "Hyderabad") and is_ws(e)
        ]
        self.assertEqual(len(hyd_ws), 1)
        self.assertIn("Generative AI Workshop", hyd_ws[0]["title"])

        # Combination 4: Online + Hackathon
        online_hack = [
            e for e in events
            if match_location_filter(e, "Online") and is_hack(e)
        ]
        self.assertEqual(len(online_hack), 1)
        self.assertIn("Nebius", online_hack[0]["title"])

        # Combination 5: USA + Conference
        usa_conf = [
            e for e in events
            if match_location_filter(e, "USA") and is_conf(e)
        ]
        self.assertEqual(len(usa_conf), 1)
        self.assertIn("re:Invent", usa_conf[0]["title"])

        # Combination 6: India (Other) + Workshop
        india_ws = [
            e for e in events
            if match_location_filter(e, "India") and is_ws(e)
        ]
        self.assertEqual(len(india_ws), 1)
        self.assertIn("Bengaluru", india_ws[0]["title"])

    # -------------------------------------------------------------------------
    # 4. Normalization Layer Unit Tests
    # -------------------------------------------------------------------------

    def test_normalize_event_location_url_cleanup(self):
        """URLs in location are cleaned and mapped to clean city/country or Online."""
        he_raw = {
            "title": "HCLTech GCP Challenge",
            "source": "hackerearth",
            "mode_location": "https://www.hackerearth.com/challenges/competitive/hcltech-gcp/",
        }
        he_norm = normalize_event_location(he_raw)
        self.assertEqual(he_norm["mode"], "online")
        self.assertEqual(he_norm["mode_location"], "Online")

        gdg_raw = {
            "title": "GDG Cloud Nagpur Build with AI",
            "source": "google_developer_groups",
            "mode_location": "https://gdg.community.dev/events/details/google-gdg-cloud-nagpur-presents-build-with-ai/",
        }
        gdg_norm = normalize_event_location(gdg_raw)
        self.assertEqual(gdg_norm["mode"], "offline")
        self.assertEqual(gdg_norm["city"], "Nagpur")
        self.assertEqual(gdg_norm["country"], "India")
        self.assertEqual(gdg_norm["mode_location"], "Nagpur, India")

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

        self.assertGreater(counts["Hyderabad"], 0)
        self.assertGreater(counts["India"], 0)
        self.assertGreater(counts["Online"], 0)
        self.assertGreater(counts["USA"], 0)
        self.assertGreater(counts["Other"], 0)
        self.assertEqual(sum(counts.values()), len(events))


if __name__ == "__main__":
    unittest.main()
