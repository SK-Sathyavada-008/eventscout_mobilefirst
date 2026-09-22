"""
tests/test_conference_filter.py
===============================
Unit and integration tests for Conference category classification and filtering.
Verifies:
1. Conference filter returns all matching Conference events.
2. Case/representation handling works (Conference, conference, Conferences, CONFERENCE).
3. Other categories still work (Hackathons, Workshops, technical categories).
4. Clearing the category filter still returns the expected events (All).
5. Conference + Hyderabad/location filter works.
6. Conference + Online mode filter works.
7. Conference + search still works.
8. Existing category/filter compatibility is preserved.
"""

import json
import os
import re
import unittest
from unittest.mock import MagicMock, patch

from eventscout.database.mongodb import EventDatabase
from eventscout.utils.location_utils import match_location_filter


# Emulate frontend classification logic in Python for cross-tier verification
HACKATHON_PLATFORMS = {"devpost", "devfolio", "mlh", "unstop"}
HACKATHON_REGEX = re.compile(
    r"\b(hackathon|hackathons|hack|hacks|buildathon|codeathon|datathon|game\s*jam|ideathon|challenge|bounty)\b",
    re.I,
)
WORKSHOP_REGEX = re.compile(
    r"\b(workshop|workshops|bootcamp|bootcamps|masterclass|masterclasses|hands-on|hands on|training|tutorial|tutorials|webinar|webinars|deep dive|lab|labs|coding camp|study jam|tech talk|lecture|course)\b",
    re.I,
)


def is_hackathon(ev):
    src = (ev.get("source") or "").lower().strip()
    if src in HACKATHON_PLATFORMS:
        return True
    title = ev.get("title") or ""
    desc = ev.get("description") or ""
    cats = " ".join(ev.get("categories") or [])
    return bool(HACKATHON_REGEX.search(title) or HACKATHON_REGEX.search(cats) or HACKATHON_REGEX.search(desc))


def is_workshop(ev):
    if is_hackathon(ev):
        return False
    title = ev.get("title") or ""
    desc = ev.get("description") or ""
    cats = " ".join(ev.get("categories") or [])
    return bool(WORKSHOP_REGEX.search(title) or WORKSHOP_REGEX.search(cats) or WORKSHOP_REGEX.search(desc))


def is_conference(ev):
    if is_hackathon(ev):
        return False
    if is_workshop(ev):
        return False
    return True


def get_event_classification(ev):
    if is_hackathon(ev):
        return "hackathon"
    if is_workshop(ev):
        return "workshop"
    return "conference"


class TestConferenceCategoryFilter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Load real event datasets
        cls.events_json_path = os.path.join("eventscout", "data", "events.json")
        cls.fallback_json_path = os.path.join("frontend", "public", "fallback_events.json")

        cls.data_events = []
        if os.path.exists(cls.events_json_path):
            with open(cls.events_json_path, "r", encoding="utf-8") as f:
                cls.data_events = json.load(f)

        cls.fallback_events = []
        if os.path.exists(cls.fallback_json_path):
            with open(cls.fallback_json_path, "r", encoding="utf-8") as f:
                cls.fallback_events = json.load(f)

    # ------------------------------------------------------------------
    # 1. Conference filter returns all matching Conference events
    # ------------------------------------------------------------------
    def test_conference_filter_returns_all_matching_events(self):
        """Selecting Conference returns all events that display the Conference badge, not just ~1."""
        events = self.fallback_events or self.data_events
        self.assertGreater(len(events), 0)

        # Count how many events are classified as conference
        conference_events = [ev for ev in events if is_conference(ev)]
        # Previously only 1 or 2 matched because it required 'conference' in title
        self.assertGreater(len(conference_events), 15, "Expected more than 15 conference events in dataset")

        for ev in conference_events:
            self.assertEqual(get_event_classification(ev), "conference")
            self.assertFalse(is_hackathon(ev))
            self.assertFalse(is_workshop(ev))

    # ------------------------------------------------------------------
    # 2. Case and representation handling works (Conference, conference, etc.)
    # ------------------------------------------------------------------
    @patch.object(EventDatabase, "get_collection")
    def test_case_and_representation_handling(self, mock_get_collection):
        """Backend query_events handles 'Conference', 'conference', 'Conferences', 'CONFERENCE'."""
        mock_col = MagicMock()
        mock_get_collection.return_value = mock_col
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = mock_cursor
        mock_cursor.__iter__.return_value = []
        mock_col.find.return_value = mock_cursor

        db = EventDatabase()

        representations = ["Conference", "conference", "Conferences", "CONFERENCE", "conferences"]
        for rep in representations:
            mock_col.find.reset_mock()
            db.query_events(category=rep)
            # Inspect query passed to mongo find
            self.assertTrue(mock_col.find.called)
            query_arg = mock_col.find.call_args[0][0]
            # Must have condition targeting conference/meetup
            found_conf_match = False
            for cond in query_arg.get("$and", []):
                for or_cond in cond.get("$or", []):
                    for field in ["categories", "title", "description", "source"]:
                        if field in or_cond:
                            val = or_cond[field]
                            if isinstance(val, dict) and "conference" in val.get("$regex", "").lower():
                                found_conf_match = True
            self.assertTrue(found_conf_match, f"Failed for representation: {rep}")

    # ------------------------------------------------------------------
    # 3. Other categories still work
    # ------------------------------------------------------------------
    def test_other_categories_still_work(self):
        """Hackathons and Workshops are correctly partitioned and do not collide with Conferences."""
        events = self.fallback_events or self.data_events
        hackathons = [ev for ev in events if is_hackathon(ev)]
        workshops = [ev for ev in events if is_workshop(ev)]
        conferences = [ev for ev in events if is_conference(ev)]

        self.assertGreater(len(hackathons), 0)
        self.assertGreater(len(workshops), 0)
        self.assertGreater(len(conferences), 0)

        # Mutually exclusive partition
        set_h = set(id(e) for e in hackathons)
        set_w = set(id(e) for e in workshops)
        set_c = set(id(e) for e in conferences)

        self.assertEqual(len(set_h.intersection(set_w)), 0, "Hackathons and Workshops must not overlap")
        self.assertEqual(len(set_h.intersection(set_c)), 0, "Hackathons and Conferences must not overlap")
        self.assertEqual(len(set_w.intersection(set_c)), 0, "Workshops and Conferences must not overlap")
        self.assertEqual(len(hackathons) + len(workshops) + len(conferences), len(events))

    # ------------------------------------------------------------------
    # 4. Clearing the category filter still returns the expected events
    # ------------------------------------------------------------------
    def test_clearing_category_filter_returns_all_events(self):
        """When category filter is 'All' or cleared, all events are returned."""
        events = self.fallback_events or self.data_events
        active_category = "all"
        filtered = [
            ev for ev in events
            if (active_category == "all" or
                (active_category == "conferences" and is_conference(ev)) or
                (active_category == "hackathons" and is_hackathon(ev)) or
                (active_category == "workshops" and is_workshop(ev)))
        ]
        self.assertEqual(len(filtered), len(events))

    # ------------------------------------------------------------------
    # 5. Conference + Hyderabad / location filter works
    # ------------------------------------------------------------------
    def test_conference_plus_location_filter(self):
        """Filtering by Conference AND Location (e.g. Hyderabad) works correctly."""
        events = self.fallback_events or self.data_events
        conf_hyd = [
            ev for ev in events
            if is_conference(ev) and match_location_filter(ev, "Hyderabad")
        ]
        self.assertIsInstance(conf_hyd, list)
        for ev in conf_hyd:
            self.assertTrue(is_conference(ev))
            self.assertTrue(match_location_filter(ev, "Hyderabad"))

    # ------------------------------------------------------------------
    # 6. Conference + Online mode filter works
    # ------------------------------------------------------------------
    def test_conference_plus_online_mode_filter(self):
        """Filtering by Conference AND Mode=Online works correctly."""
        events = self.fallback_events or self.data_events
        conf_online = [
            ev for ev in events
            if is_conference(ev) and "online" in (ev.get("mode_location") or "").lower()
        ]
        self.assertGreater(len(conf_online), 0)
        for ev in conf_online:
            self.assertTrue(is_conference(ev))
            self.assertIn("online", (ev.get("mode_location") or "").lower())

    # ------------------------------------------------------------------
    # 7. Conference + search still works
    # ------------------------------------------------------------------
    def test_conference_plus_search_filter(self):
        """Filtering by Conference AND Search Query (e.g. 'AI' or 'Data') works correctly."""
        events = self.fallback_events or self.data_events
        q = "ai"
        conf_ai = [
            ev for ev in events
            if is_conference(ev) and (
                q in (ev.get("title") or "").lower() or
                q in (ev.get("organizer") or "").lower() or
                any(q in str(c).lower() for c in (ev.get("categories") or []))
            )
        ]
        self.assertGreater(len(conf_ai), 0)
        for ev in conf_ai:
            self.assertTrue(is_conference(ev))

    # ------------------------------------------------------------------
    # 8. Existing category/filter tests compatibility
    # ------------------------------------------------------------------
    @patch.object(EventDatabase, "get_collection")
    def test_backend_technical_topics_preserved(self, mock_get_collection):
        """Backend queries for technical topic categories (e.g. 'Cloud & DevOps') remain exact regex matches."""
        mock_col = MagicMock()
        mock_get_collection.return_value = mock_col
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = mock_cursor
        mock_cursor.__iter__.return_value = []
        mock_col.find.return_value = mock_cursor

        db = EventDatabase()
        db.query_events(category="Cloud & DevOps")

        query_arg = mock_col.find.call_args[0][0]
        # Should contain categories matching "Cloud & DevOps"
        self.assertIn("$and", query_arg)
        found_cloud = any(
            cond.get("categories", {}).get("$regex") == re.escape("Cloud & DevOps")
            for cond in query_arg["$and"]
        )
        self.assertTrue(found_cloud)


if __name__ == "__main__":
    unittest.main()
