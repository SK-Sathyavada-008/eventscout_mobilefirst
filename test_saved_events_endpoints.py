"""
Unit test for Saved Events endpoints and flow in EventScout API.
Verifies:
1. POST /events/{event_id}/save saves an event
2. Multiple saves of the same event are idempotent (no duplicates)
3. GET /events/saved returns saved events
4. GET /users/me/saved-events alias returns the exact same saved events
5. DELETE /events/{event_id}/save unsaves the event
6. GET /events/saved after unsave returns empty / does not contain unsaved event
"""

import unittest
from unittest.mock import patch, MagicMock
from bson import ObjectId
from fastapi.testclient import TestClient

from api.main import app
from api.auth import create_access_token


class TestSavedEventsFlow(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.user_id = "65f000000000000000000001"
        self.event_id = "65f000000000000000000099"
        self.token = create_access_token({
            "sub": self.user_id,
            "email": "test@eventscout.dev",
            "username": "testuser",
        })
        self.auth_headers = {"Authorization": f"Bearer {self.token}"}

    @patch("api.routers.saved_events.UserDatabase")
    @patch("api.routers.saved_events.EventDatabase")
    def test_save_and_retrieve_flow(self, mock_event_db_cls, mock_user_db_cls):
        mock_user_db = MagicMock()
        mock_event_db = MagicMock()
        mock_user_db_cls.return_value = mock_user_db
        mock_event_db_cls.return_value = mock_event_db

        saved_ids_storage = []

        def fake_save(uid, eid):
            if eid not in saved_ids_storage:
                saved_ids_storage.append(eid)
            return True

        def fake_unsave(uid, eid):
            if eid in saved_ids_storage:
                saved_ids_storage.remove(eid)
            return True

        mock_user_db.save_event.side_effect = fake_save
        mock_user_db.unsave_event.side_effect = fake_unsave
        mock_user_db.get_saved_event_ids.side_effect = lambda uid: list(saved_ids_storage)

        # Mock collection for EventDatabase
        mock_col = MagicMock()
        mock_event_db.get_collection.return_value = mock_col
        mock_col.find_one.return_value = {"_id": ObjectId(self.event_id), "title": "PyData Conference"}

        mock_event_doc = {
            "_id": ObjectId(self.event_id),
            "title": "PyData Conference",
            "date_time": "2026-10-01T10:00:00+00:00",
            "organizer": "PyData Org",
            "mode_location": "Online",
            "is_free": True,
        }
        mock_col.find.side_effect = lambda query: [mock_event_doc] if any(
            str(oid) == self.event_id for oid in query.get("_id", {}).get("$in", [])
        ) else []

        # 1. Initially 0 saved events
        res_initial = self.client.get("/events/saved", headers=self.auth_headers)
        self.assertEqual(res_initial.status_code, 200)
        self.assertEqual(res_initial.json(), [])

        # 2. Save event
        res_save = self.client.post(f"/events/{self.event_id}/save", headers=self.auth_headers)
        self.assertEqual(res_save.status_code, 200)
        self.assertEqual(res_save.json(), {"saved": True, "event_id": self.event_id})
        self.assertEqual(len(saved_ids_storage), 1)

        # 3. Save again (test idempotency / no duplicates)
        res_save_again = self.client.post(f"/events/{self.event_id}/save", headers=self.auth_headers)
        self.assertEqual(res_save_again.status_code, 200)
        self.assertEqual(len(saved_ids_storage), 1)

        # 4. GET /events/saved returns event
        res_saved = self.client.get("/events/saved", headers=self.auth_headers)
        self.assertEqual(res_saved.status_code, 200)
        saved_items = res_saved.json()
        self.assertEqual(len(saved_items), 1)
        self.assertEqual(saved_items[0]["id"], self.event_id)
        self.assertEqual(saved_items[0]["title"], "PyData Conference")

        # 5. GET /users/me/saved-events (alias) returns exact same event
        res_alias = self.client.get("/users/me/saved-events", headers=self.auth_headers)
        self.assertEqual(res_alias.status_code, 200)
        self.assertEqual(res_alias.json(), saved_items)

        # 6. Unsave event
        res_unsave = self.client.delete(f"/events/{self.event_id}/save", headers=self.auth_headers)
        self.assertEqual(res_unsave.status_code, 200)
        self.assertEqual(res_unsave.json(), {"saved": False, "event_id": self.event_id})
        self.assertEqual(len(saved_ids_storage), 0)

        # 7. GET /events/saved is now empty
        res_after_unsave = self.client.get("/events/saved", headers=self.auth_headers)
        self.assertEqual(res_after_unsave.status_code, 200)
        self.assertEqual(res_after_unsave.json(), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
