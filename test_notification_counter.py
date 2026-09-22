"""
Unit and Integration tests for Notification Counter Fix:
Verifies:
Case 1: 30 total, 25 unread, limit=25 -> notifications.length=25, unread_count=25
Case 2: 30 total, 30 unread, limit=25 -> notifications.length=25, unread_count=30
Case 3: 100 total, 73 unread, limit=25 -> notifications.length=25, unread_count=73
Case 4: Mark one unread notification as read -> 73 -> 72
Case 5: Mark all as read -> 72 -> 0
Case 6: Changing notification list limit does NOT affect global unread count
"""

import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from bson import ObjectId
from fastapi.testclient import TestClient

from api.main import app
from api.auth import create_access_token


class MockNotificationStore:
    """Stateful in-memory notification store simulating MongoDB behavior."""

    def __init__(self, user_id: str, total_count: int, unread_count: int):
        self.user_id = user_id
        self.notifications = []
        for i in range(total_count):
            oid = str(ObjectId())
            self.notifications.append({
                "id": oid,
                "_id": oid,
                "user_id": user_id,
                "event_id": str(ObjectId()),
                "type": "new_event",
                "title": f"Notification {i}",
                "message": f"Message body for notification {i}",
                "read": i >= unread_count,  # First `unread_count` are unread (read=False)
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    def get_user_notifications(self, user_id: str, limit: int = 30):
        user_notifs = [n for n in self.notifications if n["user_id"] == user_id]
        return user_notifs[:limit]

    def get_unread_count(self, user_id: str) -> int:
        return sum(1 for n in self.notifications if n["user_id"] == user_id and not n["read"])

    def mark_as_read(self, user_id: str, notification_id: str) -> bool:
        for n in self.notifications:
            if n["user_id"] == user_id and (n["id"] == notification_id or n["_id"] == notification_id):
                n["read"] = True
                return True
        return False

    def mark_all_read(self, user_id: str) -> int:
        count = 0
        for n in self.notifications:
            if n["user_id"] == user_id and not n["read"]:
                n["read"] = True
                count += 1
        return count


class TestNotificationCounterCases(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.user_id = str(ObjectId())
        self.token = create_access_token({
            "sub": self.user_id,
            "email": "tester@example.com",
            "username": "tester",
        })
        self.headers = {"Authorization": f"Bearer {self.token}"}

    @patch("api.routers.notifications.NotificationDatabase")
    def test_case_1_30_total_25_unread_limit_25(self, mock_db_cls):
        """Case 1: 30 total, 25 unread, limit=25 -> notifications.length=25, unread_count=25."""
        store = MockNotificationStore(self.user_id, total_count=30, unread_count=25)
        mock_db = MagicMock()
        mock_db.get_user_notifications.side_effect = store.get_user_notifications
        mock_db.get_unread_count.side_effect = store.get_unread_count
        mock_db_cls.return_value = mock_db

        res = self.client.get("/notifications?limit=25", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(len(data["notifications"]), 25)
        self.assertEqual(data["unread_count"], 25)

    @patch("api.routers.notifications.NotificationDatabase")
    def test_case_2_30_total_30_unread_limit_25(self, mock_db_cls):
        """Case 2: 30 total, 30 unread, limit=25 -> notifications.length=25, unread_count=30."""
        store = MockNotificationStore(self.user_id, total_count=30, unread_count=30)
        mock_db = MagicMock()
        mock_db.get_user_notifications.side_effect = store.get_user_notifications
        mock_db.get_unread_count.side_effect = store.get_unread_count
        mock_db_cls.return_value = mock_db

        res = self.client.get("/notifications?limit=25", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Paginated slice has 25 notifications, but global unread count is 30
        self.assertEqual(len(data["notifications"]), 25)
        self.assertEqual(data["unread_count"], 30)

    @patch("api.routers.notifications.NotificationDatabase")
    def test_case_3_100_total_73_unread_limit_25(self, mock_db_cls):
        """Case 3: 100 total, 73 unread, limit=25 -> notifications.length=25, unread_count=73."""
        store = MockNotificationStore(self.user_id, total_count=100, unread_count=73)
        mock_db = MagicMock()
        mock_db.get_user_notifications.side_effect = store.get_user_notifications
        mock_db.get_unread_count.side_effect = store.get_unread_count
        mock_db_cls.return_value = mock_db

        res = self.client.get("/notifications?limit=25", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(len(data["notifications"]), 25)
        self.assertEqual(data["unread_count"], 73)

    @patch("api.routers.notifications.NotificationDatabase")
    def test_case_4_mark_one_unread_notification_as_read(self, mock_db_cls):
        """Case 4: Mark one unread notification as read: 73 -> 72."""
        store = MockNotificationStore(self.user_id, total_count=100, unread_count=73)
        mock_db = MagicMock()
        mock_db.get_user_notifications.side_effect = store.get_user_notifications
        mock_db.get_unread_count.side_effect = store.get_unread_count
        mock_db.mark_as_read.side_effect = store.mark_as_read
        mock_db_cls.return_value = mock_db

        # Verify initial global count is 73
        res = self.client.get("/notifications/unread-count", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["unread_count"], 73)

        # Mark first unread notification as read
        unread_notif_id = store.notifications[0]["id"]
        read_res = self.client.post(f"/notifications/{unread_notif_id}/read", headers=self.headers)
        self.assertEqual(read_res.status_code, 200)
        self.assertTrue(read_res.json()["read"])

        # Verify global unread count decreased by exactly 1: 73 -> 72
        res2 = self.client.get("/notifications/unread-count", headers=self.headers)
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()["unread_count"], 72)

        # Also verify GET /notifications endpoint returns unread_count=72
        res3 = self.client.get("/notifications?limit=25", headers=self.headers)
        self.assertEqual(res3.status_code, 200)
        self.assertEqual(res3.json()["unread_count"], 72)

    @patch("api.routers.notifications.NotificationDatabase")
    def test_case_5_mark_all_as_read(self, mock_db_cls):
        """Case 5: Mark all as read: 72 -> 0."""
        store = MockNotificationStore(self.user_id, total_count=100, unread_count=72)
        mock_db = MagicMock()
        mock_db.get_user_notifications.side_effect = store.get_user_notifications
        mock_db.get_unread_count.side_effect = store.get_unread_count
        mock_db.mark_all_read.side_effect = store.mark_all_read
        mock_db_cls.return_value = mock_db

        # Verify initial global count is 72
        res = self.client.get("/notifications/unread-count", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["unread_count"], 72)

        # Mark all read
        res_all = self.client.post("/notifications/read-all", headers=self.headers)
        self.assertEqual(res_all.status_code, 200)
        self.assertTrue(res_all.json()["success"])
        self.assertEqual(res_all.json()["marked_read"], 72)

        # Verify global count becomes 0
        res_after = self.client.get("/notifications/unread-count", headers=self.headers)
        self.assertEqual(res_after.status_code, 200)
        self.assertEqual(res_after.json()["unread_count"], 0)

        # Verify GET /notifications also returns 0 unread
        res_list = self.client.get("/notifications?limit=25", headers=self.headers)
        self.assertEqual(res_list.status_code, 200)
        self.assertEqual(res_list.json()["unread_count"], 0)

    @patch("api.routers.notifications.NotificationDatabase")
    def test_case_6_limit_change_does_not_change_global_unread_count(self, mock_db_cls):
        """Case 6: Changing pagination limit from 25 to other values does NOT change global unread_count."""
        store = MockNotificationStore(self.user_id, total_count=100, unread_count=73)
        mock_db = MagicMock()
        mock_db.get_user_notifications.side_effect = store.get_user_notifications
        mock_db.get_unread_count.side_effect = store.get_unread_count
        mock_db_cls.return_value = mock_db

        # Test limit=10
        res_10 = self.client.get("/notifications?limit=10", headers=self.headers)
        self.assertEqual(res_10.status_code, 200)
        data_10 = res_10.json()
        self.assertEqual(len(data_10["notifications"]), 10)
        self.assertEqual(data_10["unread_count"], 73)

        # Test limit=25
        res_25 = self.client.get("/notifications?limit=25", headers=self.headers)
        self.assertEqual(res_25.status_code, 200)
        data_25 = res_25.json()
        self.assertEqual(len(data_25["notifications"]), 25)
        self.assertEqual(data_25["unread_count"], 73)

        # Test limit=50
        res_50 = self.client.get("/notifications?limit=50", headers=self.headers)
        self.assertEqual(res_50.status_code, 200)
        data_50 = res_50.json()
        self.assertEqual(len(data_50["notifications"]), 50)
        self.assertEqual(data_50["unread_count"], 73)


if __name__ == "__main__":
    unittest.main()
