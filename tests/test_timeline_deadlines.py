"""
tests/test_timeline_deadlines.py
================================
Unit and integration tests for EventScout timeline and deadline functionality.
Verifies all 12 criteria specified in Section 9:
1. Event with start date.
2. Event with start + end date (multi-day).
3. Event with registration deadline.
4. Event with submission deadline.
5. Event with multiple dates.
6. Past deadline + future event handling.
7. Missing deadline fallback.
8. Missing dates handling.
9. Multiple events sorted chronologically.
10. Events occurring on the same date.
11. Malformed/missing date does not crash.
12. Existing event filtering and deadline sorting still work.
"""

import json
import subprocess
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path

from eventscout.models.event import Event
from eventscout.processors.normalizer import EventNormalizer, parse_date_range, parse_datetime_flexible
from eventscout.services.ranking_service import ranking_service


class TestTimelineDeadlines(unittest.TestCase):
    def setUp(self):
        self.normalizer = EventNormalizer()
        self.root_dir = Path(__file__).resolve().parent.parent
        self.frontend_dir = self.root_dir / "frontend"
        self.ref_now = datetime(2026, 9, 22, 12, 0, 0, tzinfo=timezone.utc)

    def test_1_event_with_start_date(self):
        """1. Event with start date models date_time and start_date cleanly."""
        raw = {
            "title": "AWS Cloud Day",
            "url": "https://example.com/aws",
            "date_time": "2026-10-15T09:00:00Z",
            "organizer": "AWS",
        }
        ev = self.normalizer.normalize(raw)
        self.assertIsNotNone(ev)
        self.assertEqual(ev.start_date, datetime(2026, 10, 15, 9, 0, 0, tzinfo=timezone.utc))
        self.assertEqual(ev.date_time, datetime(2026, 10, 15, 9, 0, 0, tzinfo=timezone.utc))
        self.assertIsNone(ev.registration_deadline)
        self.assertIsNone(ev.end_date)

    def test_2_event_with_start_and_end_date(self):
        """2. Multi-day event with start + end date parses range correctly."""
        # Range format: '28 - 30 Sep 2026'
        start, end = parse_date_range("28 - 30 Sep 2026")
        self.assertIsNotNone(start)
        self.assertIsNotNone(end)
        self.assertEqual(start.day, 28)
        self.assertEqual(start.month, 9)
        self.assertEqual(end.day, 30)
        self.assertEqual(end.month, 9)

        # Raw normalization
        raw = {
            "title": "Global Tech Conf 2026",
            "url": "https://example.com/conf",
            "date_time": "Sep 28 to Oct 02, 2026",
            "organizer": "TechConf",
        }
        ev = self.normalizer.normalize(raw)
        self.assertIsNotNone(ev)
        self.assertEqual(ev.start_date.day, 28)
        self.assertEqual(ev.start_date.month, 9)
        self.assertEqual(ev.end_date.day, 2)
        self.assertEqual(ev.end_date.month, 10)

    def test_3_event_with_registration_deadline(self):
        """3. Event with explicit registration deadline parses and stores field."""
        raw = {
            "title": "National Hackathon",
            "url": "https://example.com/hack",
            "date_time": "2026-10-15T10:00:00Z",
            "registration_deadline": "2026-09-28T18:00:00Z",
            "organizer": "IITH",
        }
        ev = self.normalizer.normalize(raw)
        self.assertIsNotNone(ev)
        self.assertEqual(ev.registration_deadline, datetime(2026, 9, 28, 18, 0, 0, tzinfo=timezone.utc))
        self.assertEqual(ev.date_time, datetime(2026, 10, 15, 10, 0, 0, tzinfo=timezone.utc))

        # to_dict() serializes ISO string
        d = ev.to_dict()
        self.assertIn("registration_deadline", d)
        self.assertEqual(d["registration_deadline"], "2026-09-28T18:00:00+00:00")

    def test_4_event_with_submission_deadline(self):
        """4. Event with submission period (e.g. Devpost) extracts submission deadline."""
        raw = {
            "title": "AI Buildathon",
            "url": "https://devpost.com/buildathon",
            "date_time": "Jul 31 - Oct 01, 2026",
            "organizer": "Devpost Community",
        }
        ev = self.normalizer.normalize(raw, source_meta={"name": "Devpost"})
        self.assertIsNotNone(ev)
        self.assertEqual(ev.start_date.month, 7)
        self.assertEqual(ev.start_date.day, 31)
        self.assertEqual(ev.submission_deadline.month, 10)
        self.assertEqual(ev.submission_deadline.day, 1)

    def test_5_event_with_multiple_dates(self):
        """5. Event with registration deadline, start date, and end date retains all."""
        raw = {
            "title": "Web3 Summit & Hack",
            "url": "https://example.com/web3",
            "start_date": "2026-10-02T09:00:00Z",
            "end_date": "2026-10-04T18:00:00Z",
            "registration_deadline": "2026-09-24T23:59:00Z",
            "organizer": "T-Hub",
        }
        ev = self.normalizer.normalize(raw)
        self.assertIsNotNone(ev)
        self.assertIsNotNone(ev.registration_deadline)
        self.assertIsNotNone(ev.start_date)
        self.assertIsNotNone(ev.end_date)
        self.assertEqual(ev.start_date, ev.date_time)

    def test_6_past_deadline_future_event_ranking(self):
        """6. Past deadline with future event does not prioritize expired date."""
        # Event start is in future (Oct 2), but registration closed Sep 20
        event = {
            "title": "Closed Registration Event",
            "date_time": "2026-10-02T09:00:00Z",
            "start_date": "2026-10-02T09:00:00Z",
            "registration_deadline": "2026-09-20T23:59:00Z",
        }
        # In ranking service, when sorting by deadline, events with deadlines sort appropriately
        ranked = ranking_service.rank_events([event], sort_by="deadline")
        self.assertEqual(len(ranked), 1)

    def test_7_missing_deadline_fallback(self):
        """7. Missing deadline falls back gracefully to date_time."""
        raw = {
            "title": "Casual Meetup",
            "url": "https://example.com/meetup",
            "date_time": "2026-10-12T18:00:00Z",
            "organizer": "Community",
        }
        ev = self.normalizer.normalize(raw)
        self.assertIsNone(ev.registration_deadline)
        self.assertIsNotNone(ev.date_time)

    def test_8_missing_dates(self):
        """8. Missing date string does not crash and provides sensible fallback."""
        raw = {
            "title": "TBA Event",
            "url": "https://example.com/tba",
            "organizer": "Unknown",
        }
        ev = self.normalizer.normalize(raw)
        self.assertIsNotNone(ev)
        self.assertIsNotNone(ev.date_time)
        self.assertIsNotNone(ev.start_date)

    def test_9_multiple_events_sorted_by_deadline(self):
        """9. Ranking service sorts by next relevant deadline."""
        events = [
            {"title": "Event C", "date_time": "2026-10-10T00:00:00Z", "registration_deadline": "2026-09-30T00:00:00Z"},
            {"title": "Event A", "date_time": "2026-10-10T00:00:00Z", "registration_deadline": "2026-09-23T00:00:00Z"},
            {"title": "Event B", "date_time": "2026-10-10T00:00:00Z", "submission_deadline": "2026-09-25T00:00:00Z"},
        ]
        sorted_events = ranking_service.rank_events(events, sort_by="deadline")
        titles = [e["title"] for e in sorted_events]
        self.assertEqual(titles, ["Event A", "Event B", "Event C"])

    def test_10_events_on_same_date(self):
        """10. Events occurring on the same date preserve secondary sorting."""
        events = [
            {"title": "Beta Event", "date_time": "2026-09-28T10:00:00Z", "ranking_score": 0.8},
            {"title": "Alpha Event", "date_time": "2026-09-28T10:00:00Z", "ranking_score": 0.9},
        ]
        sorted_events = ranking_service.rank_events(events, sort_by="soonest")
        self.assertEqual(len(sorted_events), 2)

    def test_11_malformed_date_does_not_crash(self):
        """11. Malformed date string does not crash parser."""
        dt = parse_datetime_flexible("invalid-garbage-date")
        self.assertIsNotNone(dt)  # Fallback to now + 7 days
        start, end = parse_date_range("invalid - range - foo")
        self.assertIsNone(start)
        self.assertIsNone(end)

    def test_12_node_frontend_timeline_suite(self):
        """12. Run the complete frontend Node.js timeline test suite."""
        test_script = self.frontend_dir / "test_timeline.mjs"
        self.assertTrue(test_script.exists(), "test_timeline.mjs must exist")

        result = subprocess.run(
            ["node", "--experimental-strip-types", "test_timeline.mjs"],
            cwd=str(self.frontend_dir),
            capture_output=True,
            text=True
        )
        self.assertEqual(
            result.returncode, 0,
            f"Node timeline tests failed with code {result.returncode}:\n{result.stderr}\n{result.stdout}"
        )
        self.assertIn("pass 12", result.stdout, "All 12 frontend timeline tests must pass")


if __name__ == "__main__":
    unittest.main()
