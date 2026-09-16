"""
Email Service for EventScout Daily Digest.

Features:
- Formats rich HTML & plaintext email digests of relevant upcoming events.
- Enforces daily idempotency: never sends more than 1 digest per user per calendar day.
- Supports SMTP delivery via TLS/SSL.
- Includes safe local development fallback (saves preview to data/sent_emails/ and logs summary).
- Respects user's email_enabled notification preference.
"""

import logging
import os
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

from eventscout.database.mongodb import EventDatabase
from eventscout.database.notification_db import NotificationDatabase
from eventscout.database.user_db import UserDatabase
from eventscout.services.notification_service import is_event_relevant

load_dotenv()

logger = logging.getLogger("EventScoutEmailService")


def _format_event_html(event: Dict[str, Any], index: int) -> str:
    """Renders a single event item in HTML."""
    title = event.get("title", "Technical Event")
    org = event.get("organizer", "Organizer")
    mode = event.get("mode_location", "Online")
    url = event.get("registration_url") or event.get("event_url") or "#"
    dt = str(event.get("date_time", ""))
    price = "Free" if event.get("is_free", True) else f"{event.get('price_currency', '')} {event.get('price_amount', 'Paid')}".strip()

    return f"""
    <div style="margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 10px; background-color: #ffffff;">
      <div style="font-size: 13px; font-weight: 600; color: #4f46e5; text-transform: uppercase; margin-bottom: 4px;">
        #{index} • {mode} • {price}
      </div>
      <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #111827;">
        <a href="{url}" style="color: #111827; text-decoration: none;">{title}</a>
      </h3>
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #4b5563;">
        <strong>Host:</strong> {org}<br/>
        <strong>When:</strong> {dt}
      </p>
      <a href="{url}" style="display: inline-block; padding: 8px 16px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
        View & Register →
      </a>
    </div>
    """


def _format_event_text(event: Dict[str, Any], index: int) -> str:
    """Renders a single event item in plaintext."""
    title = event.get("title", "Technical Event")
    org = event.get("organizer", "Organizer")
    mode = event.get("mode_location", "Online")
    url = event.get("registration_url") or event.get("event_url") or ""
    dt = str(event.get("date_time", ""))
    price = "Free" if event.get("is_free", True) else "Paid"

    return f"{index}. {title}\n   Host: {org} | Mode: {mode} ({price})\n   When: {dt}\n   Link: {url}\n"


def build_daily_digest(
    user: Dict[str, Any],
    events: List[Dict[str, Any]],
    date_str: str,
) -> tuple[str, str, str]:
    """
    Builds subject, plain text body, and HTML body for a user's daily digest.
    """
    username = user.get("username") or user.get("email", "").split("@")[0]
    count = len(events)
    subject = f"EventScout — Your Daily Digest ({count} upcoming opportunities)"

    # Text Body
    text_items = "\n".join(_format_event_text(e, i) for i, e in enumerate(events, start=1))
    text_body = f"""Hello {username},

Here is your EventScout daily digest for {date_str}.
We found {count} upcoming technical events matching your profile:

{text_items}

To update your interests or notification settings, visit:
http://localhost:3000/preferences

Happy learning!
The EventScout Team
"""

    # HTML Body
    html_items = "".join(_format_event_html(e, i) for i, e in enumerate(events, start=1))
    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
    <div style="background-color: #4f46e5; padding: 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">EventScout</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Your Daily Technical Event Intelligence</p>
    </div>
    <div style="padding: 24px;">
      <p style="margin-top: 0; font-size: 15px; color: #374151;">
        Hello <strong>{username}</strong>,<br/>
        Here are <strong>{count}</strong> upcoming opportunities curated for you for <strong>{date_str}</strong>:
      </p>
      {html_items}
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
        You are receiving this digest because daily email digests are enabled on your account.<br/>
        <a href="http://localhost:3000/preferences" style="color: #4f46e5; text-decoration: none;">Manage preferences</a>
      </div>
    </div>
  </div>
</body>
</html>
"""

    return subject, text_body, html_body


def build_new_events_alert(
    user: Dict[str, Any],
    events: List[Dict[str, Any]],
    date_str: str,
) -> tuple[str, str, str]:
    """
    Builds subject, plain text body, and HTML body for an instant new event alert.
    """
    username = user.get("username") or user.get("email", "").split("@")[0]
    count = len(events)
    subject = f"EventScout Alert — {count} New Technical Opportunities Found Today"

    # Text Body
    text_items = "\n".join(_format_event_text(e, i) for i, e in enumerate(events, start=1))
    text_body = f"""Hello {username},

New technical events matching your profile have just been discovered ({date_str}):

{text_items}

View details & register directly on EventScout:
http://localhost:3000/explore

Manage your notification preferences:
http://localhost:3000/preferences

Happy learning!
The EventScout Team
"""

    # HTML Body
    html_items = "".join(_format_event_html(e, i) for i, e in enumerate(events, start=1))
    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
    <div style="background-color: #4f46e5; padding: 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">EventScout Alert</h1>
      <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Fresh Opportunities Just Discovered</p>
    </div>
    <div style="padding: 24px;">
      <p style="margin-top: 0; font-size: 15px; color: #374151;">
        Hello <strong>{username}</strong>,<br/>
        We just discovered <strong>{count}</strong> new technical opportunities matching your interests today (<strong>{date_str}</strong>):
      </p>
      {html_items}
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
        You receive instant alerts at most once per calendar day.<br/>
        <a href="http://localhost:3000/preferences" style="color: #4f46e5; text-decoration: none;">Manage preferences</a>
      </div>
    </div>
  </div>
</body>
</html>
"""

    return subject, text_body, html_body


class EmailService:
    """
    Handles daily digest preparation, idempotency verification, and delivery.
    """

    def __init__(
        self,
        user_db: Optional[UserDatabase] = None,
        event_db: Optional[EventDatabase] = None,
        notification_db: Optional[NotificationDatabase] = None,
    ):
        self.user_db = user_db or UserDatabase()
        self.event_db = event_db or EventDatabase()
        self.notification_db = notification_db or NotificationDatabase()

        # SMTP config
        self.smtp_host = os.getenv("SMTP_HOST", "").strip()
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USERNAME", "").strip()
        self.smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
        self.smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes")
        self.email_from = os.getenv("EMAIL_FROM", "EventScout <notifications@eventscout.dev>").strip()

    def is_smtp_configured(self) -> bool:
        """Returns True if an outbound SMTP host is configured."""
        return bool(self.smtp_host)

    def verify_smtp_connection(self) -> Dict[str, Any]:
        """
        Tests the SMTP connection and authentication.
        Returns a dictionary with status and diagnostic details.
        """
        if not self.smtp_host:
            return {
                "configured": False,
                "status": "warning",
                "message": "SMTP_HOST is not configured in .env. System running in local preview mode.",
                "host": "",
                "port": self.smtp_port,
            }

        try:
            if self.smtp_port == 465:
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10)
                if self.smtp_use_tls:
                    server.starttls()

            if self.smtp_user and self.smtp_password:
                server.login(self.smtp_user, self.smtp_password)

            server.quit()
            return {
                "configured": True,
                "status": "success",
                "message": f"Successfully connected and authenticated with {self.smtp_host}:{self.smtp_port}",
                "host": self.smtp_host,
                "port": self.smtp_port,
            }
        except Exception as exc:
            logger.error("SMTP verification failed for %s:%d: %s", self.smtp_host, self.smtp_port, exc)
            return {
                "configured": True,
                "status": "error",
                "message": f"SMTP handshake failed: {str(exc)}",
                "host": self.smtp_host,
                "port": self.smtp_port,
            }

    def send_email(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str,
    ) -> bool:
        """
        Sends an email via SMTP. Supports port 465 (SSL) and port 587/25 (TLS).
        If SMTP_HOST is not configured, safely logs the email and saves an HTML snapshot.
        """
        if not self.smtp_host:
            # Development fallback mode
            logger.info("[DEV EMAIL FALLBACK] SMTP_HOST not configured. Simulating delivery to '%s'.", to_email)
            out_dir = Path("data") / "sent_emails"
            out_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            safe_email = to_email.replace("@", "_at_").replace(".", "_")
            out_path = out_dir / f"digest_{timestamp}_{safe_email}.html"
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(html_body)
            logger.info("Saved email snapshot to: %s", out_path)
            return True

        # Production / Configured SMTP mode
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self.email_from
        msg["To"] = to_email

        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        try:
            # Handle implicit SSL (port 465) vs explicit TLS (port 587/25)
            if self.smtp_port == 465:
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=15) as server:
                    if self.smtp_user and self.smtp_password:
                        server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.email_from, [to_email], msg.as_string())
            else:
                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15) as server:
                    if self.smtp_use_tls:
                        server.starttls()
                    if self.smtp_user and self.smtp_password:
                        server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.email_from, [to_email], msg.as_string())

            logger.info("Successfully sent email to '%s' via SMTP (%s:%d).", to_email, self.smtp_host, self.smtp_port)
            return True
        except Exception as exc:
            logger.error("Failed to send email via SMTP to '%s': %s", to_email, exc, exc_info=True)
            return False

    def send_test_email(self, to_email: str) -> Dict[str, Any]:
        """
        Sends a test email to verify end-to-end delivery for a specific recipient.
        """
        subject = "EventScout — Notification Delivery Test"
        text_body = f"Hello,\n\nThis is a test email from EventScout to verify that your email notification settings and SMTP configuration are working correctly.\n\nTime: {datetime.now(timezone.utc).isoformat()}"
        html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f9fafb; padding: 24px;">
  <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; padding: 24px;">
    <h2 style="color: #4f46e5; margin-top: 0;">EventScout Delivery Test</h2>
    <p style="color: #374151;">Your notification delivery pipeline is active!</p>
    <p style="color: #6b7280; font-size: 13px;">Recipient: <strong>{to_email}</strong><br/>Timestamp: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")}</p>
  </div>
</body>
</html>"""
        success = self.send_email(to_email, subject, text_body, html_body)
        return {
            "success": success,
            "to_email": to_email,
            "smtp_configured": bool(self.smtp_host),
            "mode": "smtp" if self.smtp_host else "fallback_snapshot",
        }

    def send_digest_to_user(
        self,
        user: Dict[str, Any],
        force: bool = False,
        target_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Prepares and delivers the daily digest to a single specific user.
        If force is True, bypasses same-day duplicate check.
        """
        date_str = target_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        user_id = str(user.get("id") or user.get("_id"))
        email = user.get("email")

        if not email:
            return {"success": False, "reason": "User has no email address configured"}

        notif_prefs = user.get("notification_preferences", {})
        if not notif_prefs.get("email_enabled", True) and not force:
            return {"success": False, "reason": "User has email notifications disabled"}

        if not force and self.notification_db.has_digest_been_sent(user_id, date_str):
            return {"success": False, "reason": f"Digest already sent today ({date_str})"}

        upcoming_events = self.event_db.get_upcoming_events()
        if not upcoming_events:
            return {"success": False, "reason": "No upcoming events available to send"}

        # Filter relevant events
        relevant = [e for e in upcoming_events if is_event_relevant(user, e)]
        if not relevant:
            relevant = upcoming_events[:5]
        else:
            relevant = relevant[:10]

        subject, text_body, html_body = build_daily_digest(user, relevant, date_str)
        success = self.send_email(email, subject, text_body, html_body)

        if success:
            self.notification_db.record_digest_sent(user_id, date_str, len(relevant))

        return {
            "success": success,
            "email": email,
            "event_count": len(relevant),
            "mode": "smtp" if self.smtp_host else "fallback_snapshot",
            "date": date_str,
        }

    def send_daily_digests(
        self,
        target_date: Optional[str] = None,
        force: bool = False,
    ) -> int:
        """
        Processes and sends daily digests for all eligible users.
        target_date defaults to today's UTC date (YYYY-MM-DD).
        Enforces idempotency unless force=True.
        Returns the number of digests successfully sent.
        """
        date_str = target_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        users = self.user_db.get_all_active_users()
        upcoming_events = self.event_db.get_upcoming_events()

        if not upcoming_events:
            logger.info("No upcoming events found in database. Skipping daily digests.")
            return 0

        sent_count = 0

        for user in users:
            user_id = str(user.get("id") or user.get("_id"))
            email = user.get("email")
            if not email:
                continue

            notif_prefs = user.get("notification_preferences", {})
            if not notif_prefs.get("email_enabled", True):
                logger.debug("User '%s' has email digest disabled. Skipping.", email)
                continue

            # Check daily idempotency
            if not force and self.notification_db.has_digest_been_sent(user_id, date_str):
                logger.debug("Digest already sent to user '%s' for %s. Skipping duplicate.", email, date_str)
                continue

            # Filter relevant events for this user
            relevant_events = [e for e in upcoming_events if is_event_relevant(user, e)]
            if not relevant_events:
                # Fallback to general upcoming events
                relevant_events = upcoming_events[:5]
            else:
                relevant_events = relevant_events[:10]

            subject, text_body, html_body = build_daily_digest(user, relevant_events, date_str)
            success = self.send_email(email, subject, text_body, html_body)

            if success:
                self.notification_db.record_digest_sent(user_id, date_str, len(relevant_events))
                sent_count += 1

        logger.info("Daily digest run complete for %s. Sent %d digest(s) across %d user(s).", date_str, sent_count, len(users))
        return sent_count

    def dispatch_daily_event_alerts(
        self,
        new_events: List[Dict[str, Any]],
        target_date: Optional[str] = None,
    ) -> int:
        """
        Dispatches instant email alerts for newly discovered events to eligible users.
        Strictly limits to AT MOST ONCE PER DAY: If a user has already received an email today
        (e.g. from an earlier scraper run or daily digest), they will NOT receive a duplicate alert.
        Returns the number of users successfully notified via email.
        """
        if not new_events:
            return 0

        date_str = target_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        users = self.user_db.get_all_active_users()
        sent_count = 0

        for user in users:
            user_id = str(user.get("id") or user.get("_id"))
            email = user.get("email")
            if not email:
                continue

            notif_prefs = user.get("notification_preferences", {})
            if not notif_prefs.get("email_enabled", True):
                continue

            # Enforce strictly once-a-day per calendar day
            if self.notification_db.has_digest_been_sent(user_id, date_str):
                logger.debug("User '%s' has already received today's email (%s). Skipping repeat alert.", email, date_str)
                continue

            # Match relevant events to user profile
            relevant_events = [e for e in new_events if is_event_relevant(user, e)]
            if not relevant_events:
                continue

            relevant_events = relevant_events[:10]
            subject, text_body, html_body = build_new_events_alert(user, relevant_events, date_str)
            success = self.send_email(email, subject, text_body, html_body)

            if success:
                self.notification_db.record_digest_sent(user_id, date_str, len(relevant_events))
                sent_count += 1

        logger.info(
            "Instant daily event alert run complete for %s: Alerted %d user(s) for %d newly discovered event(s).",
            date_str,
            sent_count,
            len(new_events),
        )
        return sent_count


if __name__ == "__main__":
    service = EmailService()
    print("Testing daily digest dispatch...")
    count = service.send_daily_digests(force=True)
    print(f"Dispatched {count} digest(s).")
