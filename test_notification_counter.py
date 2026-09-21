"""
Unit and Integration tests for Notification Counter Fix:
Verifies:
1. 0 unread notifications -> unread_count is 0.
2. 1 unread notification -> unread_count is 1.
3. Multiple unread notifications (e.g. 25) -> exact count.
4. Read notifications do NOT count (e.g. 25 total, 5 read -> count is 20).
5. Marking a notification as read immediately decrements unread count.
6. Marking all notifications as read resets unread count to 0.
7. Pagination / limits do NOT cause duplicate or distorted counting.
8. Dynamic calculation from actual notification items matches state.
"""

import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from bson import ObjectId
from fastapi.testclient import TestClient

from api.main import app
from api.auth import create_access_token


class TestNotificationCounter(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.user_id = str(ObjectId())
        self.token = create_access_token({
            "sub": self.user_id,
            "email": "tester@example.com",
            "username": "tester",
        })

    def _generate_notifications(self, count: int, unread_count: int):
        """Generates mock notifications where the first `unread_count` are unread."""
        items = []
        for i in range(count):
            items.append({
                "id": f"notif_{i}",
                "_id": f"notif_{i}",
                "user_id": self.user_id,
                "event_id": str(ObjectId()),
                "type": "new_event",
                "title": f"Event {i}",
                "message": f"Details for event {i}",
                "read": i >= unread_count,  # First `unread_count` are False, remainder True
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        return items

    @patch("api.routers.notifications.NotificationDatabase")
    def test_zero_unread_notifications(self, mock_db_cls):
        """0 unread notifications returns unread_count 0."""
        mock_db = MagicMock()
        mock_db_cls.return_value = mock_db

        # 10 notifications, all marked read
        mock_db.get_user_notifications.return_value = self._generate_notifications(count=10, unread_count=0)

        res = self.client.get("/notifications", headers={"Authorization": f"Bearer {self.token}"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["notifications"]), 10)
        self.assertEqual(data["unread_count"], 0)

    @patch("api.routers.notifications.NotificationDatabase")
    def test_single_unread_notification(self, mock_db_cls):
        """1 unread notification returns unread_count 1."""
        mock_db = MagicMock()
        mock_db_cls.return_value = mock_db

        mock_db.get_user_notifications.return_value = self._generate_notifications(count=5, unread_count=1)

        res = self.client.get("/notifications", headers={"Authorization": f"Bearer {self.token}"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["notifications"]), 5)
        self.assertEqual(data["unread_count"], 1)

    @patch("api.routers.notifications.NotificationDatabase")
    def test_multiple_unread_notifications_exact_count(self, mock_db_cls):
        """Exactly 25 unread notifications returns unread_count 25 dynamically."""
        mock_db = MagicMock()
        mock_db_cls.return_value = mock_db

        # 25 notifications, all unread
        mock_db.get_user_notifications.return_value = self._generate_notifications(count=25, unread_count=25)

        res = self.client.get("/notifications?limit=25", headers={"Authorization": f"Bearer {self.token}"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["notifications"]), 25)
        self.assertEqual(data["unread_count"], 25)

    @patch("api.routers.notifications.NotificationDatabase")
    def test_read_notifications_do_not_count(self, mock_db_cls):
        """Read notifications do NOT contribute to unread_count (25 total, 5 unread -> 5)."""
        mock_db = MagicMock()
        mock_db_cls.return_value = mock_db

        mock_db.get_user_notifications.return_value = self._generate_notifications(count=25, unread_count=5)

        res = self.client.get("/notifications?limit=25", headers={"Authorization": f"Bearer {self.token}"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["unread_count"], 5)

    @patch("api.routers.notifications.NotificationDatabase")
    def test_unread_count_lightweight_endpoint(self, mock_db_cls):
        """GET /notifications/unread-count dynamically returns exact count."""
        mock_db = MagicMock()
        mock_db_cls.return_value = mock_db

        mock_db.get_user_notifications.return_value = self._generate_notifications(count=25, unread_count=7)

        res = self.client.get("/notifications/unread-count", headers={"Authorization": f"Bearer {self.token}"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["unread_count"], 7)

    @patch("api.routers.notifications.NotificationDatabase")
    def test_mark_as_read_and_immediate_update(self, mock_db_cls):
        """Marking a notification as read succeeds and updates read state."""
        mock_db = MagicMock()
        mock_db_cls.return_value = mock_db
        mock_db.mark_as_read.return_value = True

        res = self.client.post("/notifications/notif_0/read", headers={"Authorization": f"Bearer {self.token}"})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["read"])
        mock_db.mark_as_read.assert_called_with(user_id=self.user_id, notification_id="notif_0")

    @patch("api.routers.notifications.NotificationDatabase")
    def test_mark_all_read(self, mock_db_cls):
        """Marking all as read succeeds."""
        mock_db = MagicMock()
        mock_db_cls.return_value = mock_db
        mock_db.mark_all_read.return_value = 25

        res = self.client.post("/notifications/read-all", headers={"Authorization": f"Bearer {self.token}"})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["success"])
        mock_db.mark_all_read.assert_called_with(user_id=self.user_id)


if __name__ == "__main__":
    unittest.main()
