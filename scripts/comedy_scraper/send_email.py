"""Compose and send the monthly digest via SMTP.

Configured entirely through env vars:

  SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS
  EMAIL_FROM (defaults to SMTP_USER), EMAIL_TO (comma-separated), SITE_URL

If SMTP_HOST is unset, the function logs the digest and returns — so local
dev runs and first deploys don't fail.
"""
from __future__ import annotations

import html
import logging
import os
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage

from .build_site import MONTHS
from .models import Comedian

log = logging.getLogger(__name__)


def send_digest(comedians: list[Comedian], *, now: datetime | None = None) -> bool:
    now = now or datetime.now()
    host = os.environ.get("SMTP_HOST", "").strip()
    to = os.environ.get("EMAIL_TO", "").strip()
    if not host or not to:
        log.info("SMTP_HOST or EMAIL_TO unset — skipping email send.")
        return False

    user = os.environ.get("SMTP_USER", "")
    pw = os.environ.get("SMTP_PASS", "")
    port = int(os.environ.get("SMTP_PORT", "587"))
    from_addr = os.environ.get("EMAIL_FROM", user or "comedy@amysterling.org")

    subject = f"{MONTHS[now.month - 1]} comedy in Boston — {len(comedians)} comedians"
    site_url = os.environ.get("SITE_URL", "https://amyleesterling.github.io/amysterling/comedy/")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.set_content(_plain(comedians, now, site_url))
    msg.add_alternative(_html(comedians, now, site_url), subtype="html")

    ctx = ssl.create_default_context()
    try:
        with smtplib.SMTP(host, port, timeout=20) as s:
            s.starttls(context=ctx)
            if user and pw:
                s.login(user, pw)
            s.send_message(msg)
    except Exception as e:
        log.exception("Email send failed: %s", e)
        return False
    log.info("Sent digest to %s (%d comedians)", to, len(comedians))
    return True


def _plain(comedians: list[Comedian], now: datetime, site_url: str) -> str:
    lines = [
        f"{MONTHS[now.month - 1]} {now.year} — Boston comedy digest",
        "=" * 48,
        "",
    ]
    for c in comedians:
        lines.append(c.name)
        for s in sorted(c.shows, key=lambda s: s.date):
            lines.append(
                f"  · {s.date.strftime('%a %b %-d, %-I:%M %p')}  {s.venue} ({s.venue_city})"
            )
        if c.clips:
            lines.append("  clips:")
            for clip in c.clips[:3]:
                lines.append(f"    - {clip.watch_url}")
        lines.append("")
    lines.append(f"Full page: {site_url}")
    return "\n".join(lines)


def _html(comedians: list[Comedian], now: datetime, site_url: str) -> str:
    rows = []
    for c in comedians:
        show_html = "".join(
            f'<li>{html.escape(s.date.strftime("%a %b %-d, %-I:%M %p"))} · '
            f'<a href="{html.escape(s.url)}">{html.escape(s.venue)}</a> '
            f'<span style="color:#888">({html.escape(s.venue_city)})</span></li>'
            for s in sorted(c.shows, key=lambda s: s.date)
        )
        clips_html = ""
        if c.clips:
            clips_html = '<div style="margin-top:8px">' + "".join(
                f'<a href="{html.escape(cl.watch_url)}" '
                f'style="display:inline-block;margin-right:6px">'
                f'<img src="{html.escape(cl.thumbnail)}" width="120" '
                f'style="border-radius:6px;border:0" alt=""></a>'
                for cl in c.clips[:3]
            ) + "</div>"
        rows.append(
            f"""
<tr><td style="padding:18px 0;border-bottom:1px solid #eee">
  <div style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#111">
    {html.escape(c.name)}
  </div>
  <ul style="margin:6px 0 0;padding-left:18px;color:#333;font-size:14px;line-height:1.6">{show_html}</ul>
  {clips_html}
</td></tr>"""
        )
    body = "".join(rows) or '<tr><td style="padding:24px;color:#666">No shows announced this month — check back soon.</td></tr>'
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#faf8f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px">
        <tr><td>
          <div style="font-family:Georgia,serif;font-size:48px;font-weight:700;letter-spacing:-1px;color:#111">
            {html.escape(MONTHS[now.month - 1])}
          </div>
          <div style="color:#666;font-size:14px;margin-top:4px">
            Stand-up announced for greater Boston · {now.year}
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">
            {body}
          </table>
          <div style="margin-top:28px;color:#666;font-size:12px">
            <a href="{html.escape(site_url)}" style="color:#b27cff">See the full page →</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
