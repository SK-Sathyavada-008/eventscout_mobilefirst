"""
Notifications router for EventScout API.

Endpoints:
    GET  /notifications               — Get user's notifications & unread count
    GET  /notifications/unread-count  — Get total unread count
    POST /notifications/{id}/read     — Mark a specific notification as read
    POST /notifications/read-all      — Mark all notifications as read
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from api.auth import get_current_user
from eventscout.database.notification_db import NotificationDatabase

logger = logging.getLogger("EventScoutNotificationsRouter")

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", summary="Get current user's notifications")
async def get_notifications(
    limit: int = Query(30, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns recent notifications for the authenticated user, sorted newest first.
    Includes the total unread count for UI badges.
    Enforces user isolation via Bearer JWT.
    """
    db = NotificationDatabase()
    user_id = current_user["id"]

    notifications = db.get_user_notifications(user_id=user_id, limit=limit)
    unread_count = db.get_unread_count(user_id=user_id)

    return {
        "notifications": notifications,
        "unread_count": unread_count,
    }


@router.get("/unread-count", summary="Get unread notification count")
async def get_unread_count(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, int]:
    """
    Lightweight endpoint returning only the unread count for periodic UI polling.
    """
    db = NotificationDatabase()
    count = db.get_unread_count(current_user["id"])
    return {"unread_count": count}


@router.post("/{notification_id}/read", summary="Mark a notification as read")
async def mark_notification_read(
    notification_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Marks a single notification as read.
    Guarantees user isolation: User A cannot mark User B's notifications as read.
    """
    db = NotificationDatabase()
    success = db.mark_as_read(user_id=current_user["id"], notification_id=notification_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    return {"id": notification_id, "read": True}


@router.post("/read-all", summary="Mark all notifications as read")
async def mark_all_notifications_read(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Marks all notifications for the authenticated user as read.
    """
    db = NotificationDatabase()
    marked = db.mark_all_read(user_id=current_user["id"])
    return {"success": True, "marked_read": marked}


@router.get("/email-status", summary="Get outbound email configuration status")
async def get_email_status(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns the current email delivery configuration status,
    including SMTP configuration check and recipient email.
    """
    from eventscout.services.email_service import EmailService
    service = EmailService()
    smtp_diag = service.verify_smtp_connection()

    return {
        "user_email": current_user.get("email"),
        "user_email_enabled": current_user.get("notification_preferences", {}).get("email_enabled", True),
        "smtp": smtp_diag,
    }


@router.post("/send-digest", summary="Trigger immediate daily event digest for current user")
async def send_user_digest(
    force: bool = Query(True, description="Bypass same-day duplicate check"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Builds and delivers a curated technical event digest for the authenticated user immediately.
    """
    from eventscout.services.email_service import EmailService
    from eventscout.database.user_db import UserDatabase

    user_db = UserDatabase()
    user_doc = user_db.find_by_id(current_user["id"])
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")

    service = EmailService()
    result = service.send_digest_to_user(user_doc, force=force)
    return result


@router.post("/test-email", summary="Send a test verification email")
async def send_test_email(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Sends a test verification email to confirm the user's notification delivery pipeline.
    """
    recipient = current_user.get("email")
    if not recipient:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No email associated with current user.")

    from eventscout.services.email_service import EmailService
    service = EmailService()
    result = service.send_test_email(recipient)
    return result

