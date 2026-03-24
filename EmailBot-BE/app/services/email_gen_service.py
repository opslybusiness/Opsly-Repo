"""
Email generation service.

Uses the Gemini LLM (already configured for this project) to write
personalised cold-email subject lines and bodies given:
  - the sender's business profile
  - the prospect's business info
  - an optional campaign-level context string
"""
import logging
from typing import Dict, Optional

from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)

_PROMPT_TEMPLATE = """\
You are a professional cold-email copywriter. Write a concise, personalised outreach email.

SENDER INFO:
Name: {sender_name}
Type of Business: {sender_type}
Area of Work: {sender_area}
Location: {sender_location}
Representative: {sender_contact_name}
Description: {sender_description}

PROSPECT INFO:
Business Name: {prospect_name}
Description: {prospect_description}
Location: {prospect_location}
Website: {prospect_website}

{campaign_context_line}

Requirements:
- Subject line: compelling and specific (under 60 characters, no generic phrases like "Quick question")
- Body: 3-4 short paragraphs maximum
- Mention the prospect's business by name and reference something specific about them
- Lead with value the sender offers, not a feature list
- Single, clear call-to-action (e.g. "Would you be open to a 15-minute call this week?")
- Conversational but professional tone
- Sign off with the sender's actual name and company; do NOT use placeholder text

Respond in EXACTLY this format — no extra commentary:
SUBJECT: <subject line here>
BODY:
<email body here>
"""


class EmailGenService:
    def __init__(self):
        self._model = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            convert_system_message_to_human=True,
        )

    def generate_cold_email(
        self,
        sender_profile: Dict,
        prospect: Dict,
        campaign_context: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Generate a personalised cold email.

        Args:
            sender_profile: dict with keys name, type, area_of_work, location,
                            contact_name, description (optional).
            prospect:       dict with keys business_name, description, location,
                            website (all optional except business_name).
            campaign_context: free-text hint added to the prompt (e.g. target industry).

        Returns:
            {"subject": str, "body": str}
        """
        context_line = (
            f"Campaign goal: {campaign_context}" if campaign_context else ""
        )

        prompt = _PROMPT_TEMPLATE.format(
            sender_name=sender_profile.get("name", ""),
            sender_type=sender_profile.get("type", ""),
            sender_area=sender_profile.get("area_of_work", ""),
            sender_location=sender_profile.get("location", ""),
            sender_contact_name=sender_profile.get("contact_name", ""),
            sender_description=sender_profile.get("description") or "N/A",
            prospect_name=prospect.get("business_name", ""),
            prospect_description=prospect.get("description") or "N/A",
            prospect_location=prospect.get("location") or "N/A",
            prospect_website=prospect.get("website") or "N/A",
            campaign_context_line=context_line,
        )

        try:
            response = self._model.invoke([HumanMessage(content=prompt)])
            return self._parse_response(response.content.strip())
        except Exception as exc:
            logger.error("Email generation failed: %s", exc)
            raise

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_response(raw: str) -> Dict[str, str]:
        """
        Parse the structured LLM output into {"subject": ..., "body": ...}.
        Falls back gracefully if the model doesn't follow the format exactly.
        """
        subject = ""
        body_lines = []
        in_body = False

        for line in raw.splitlines():
            stripped = line.strip()
            if stripped.upper().startswith("SUBJECT:"):
                subject = stripped[len("SUBJECT:"):].strip()
            elif stripped.upper() == "BODY:":
                in_body = True
            elif in_body:
                body_lines.append(line)

        body = "\n".join(body_lines).strip()

        # Graceful fallback: treat first line as subject, everything after as body
        if not subject or not body:
            lines = raw.splitlines()
            subject = lines[0].replace("SUBJECT:", "").strip() if lines else ""
            body = "\n".join(lines[2:]).strip() if len(lines) > 2 else ""

        return {"subject": subject, "body": body}
