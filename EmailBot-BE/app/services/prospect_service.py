"""
Prospect discovery service.

Workflow:
  1. search_businesses()  – Serper.dev Google Search API → list of {name, website, description}
  2. enrich_prospect_email() – tries Hunter.io domain search, then falls back to
     scraping the prospect's website for a contact email address.

Required env vars:
  SERPER_API_KEY      – Serper.dev API key (serper.dev — 2500 free queries/month)

Optional env vars:
  HUNTER_IO_API_KEY   – Hunter.io API key (improves email discovery accuracy)
"""
import logging
import os
import re
import time
from typing import Dict, List, Optional
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Ensure .env is loaded regardless of module import order.
load_dotenv()


def _serper_api_key() -> str:
    return (os.getenv("SERPER_API_KEY") or "").strip()


def _hunter_api_key() -> str:
    return (os.getenv("HUNTER_IO_API_KEY") or "").strip()

# Email addresses whose domains are clearly noise
_BLACKLISTED_EMAIL_DOMAINS = {
    "example.com", "w3.org", "schema.org", "google.com",
    "sentry.io", "cloudflare.com", "wordpress.com",
}
# Common prefixes that indicate a generic/business contact address (preferred)
_PREFERRED_EMAIL_PREFIXES = (
    "contact", "info", "hello", "sales", "business",
    "hi", "marketing", "support", "team",
)

# Domains that are unlikely to be valid outreach targets.
_JUNK_WEBSITE_DOMAINS = {
    "facebook.com", "instagram.com", "linkedin.com", "x.com", "twitter.com",
    "youtube.com", "tiktok.com", "pinterest.com", "wikipedia.org",
    "yelp.com", "tripadvisor.com", "glassdoor.com", "indeed.com",
    "github.com", "gitlab.com", "medium.com", "substack.com",
}


def normalize_domain(website: Optional[str]) -> str:
    """Extract and normalize a root domain from a URL-like string."""
    if not website:
        return ""
    candidate = website.strip().lower()
    if not candidate:
        return ""
    if not candidate.startswith(("http://", "https://")):
        candidate = f"https://{candidate}"
    try:
        parsed = urlparse(candidate)
        domain = parsed.netloc.lower().strip()
    except Exception:
        return ""
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def is_junk_domain(domain: str) -> bool:
    """Return True for domains that should be skipped during prospect intake."""
    if not domain:
        return True
    return domain in _JUNK_WEBSITE_DOMAINS or domain in _BLACKLISTED_EMAIL_DOMAINS


def search_businesses(
    query: str,
    location: str,
    max_results: int = 20,
) -> List[Dict]:
    """
    Search for businesses using Serper.dev (Google Search API).

    Returns a list of dicts with keys:
        business_name, website, description, location
    """
    serper_api_key = _serper_api_key()
    if not serper_api_key:
        raise ValueError(
            "SERPER_API_KEY must be configured as an environment variable. "
            "Get a free key at serper.dev (2500 queries/month free)."
        )

    search_query = f"{query} {location} business contact"
    results: List[Dict] = []
    page = 1

    while len(results) < max_results:
        try:
            data = None
            for attempt in range(3):
                resp = requests.post(
                    "https://google.serper.dev/search",
                    headers={
                        "X-API-KEY": serper_api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "q": search_query,
                        "num": min(10, max_results - len(results)),
                        "page": page,
                    },
                    timeout=10,
                )
                if resp.status_code < 500 and resp.status_code != 429:
                    resp.raise_for_status()
                    data = resp.json()
                    break
                if attempt < 2:
                    time.sleep(0.4 * (attempt + 1))
            if data is None:
                resp.raise_for_status()
        except requests.RequestException as exc:
            logger.error("Serper.dev API error: %s", exc)
            break

        items = data.get("organic", [])
        if not items:
            break

        for item in items:
            raw_title = item.get("title", "")
            business_name = re.split(r"\s[-|–]\s", raw_title)[0].strip()
            website = item.get("link")
            domain = normalize_domain(website)
            if is_junk_domain(domain):
                continue
            results.append(
                {
                    "business_name": business_name,
                    "website": website,
                    "description": item.get("snippet", ""),
                    "location": location,
                }
            )

        page += 1
        if page > 10:   # Serper supports up to 100 results (10 pages × 10)
            break

    return results[:max_results]


def extract_emails_from_website(url: str) -> List[str]:
    """
    Fetch a website's homepage, /contact, and /about pages and extract
    email addresses using a regex.  Returns a de-duplicated list, sorted
    so that 'preferred' addresses (contact@, info@, …) come first.
    """
    if not url:
        return []

    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return []
        domain = parsed.netloc.replace("www.", "")
        if domain in _BLACKLISTED_EMAIL_DOMAINS or is_junk_domain(domain):
            return []
    except Exception:
        return []

    email_re = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
    noise_fragments = (
        "example", "yourdomain", "domain.com", "testuser",
        "noreply", "no-reply", "unsubscribe", "privacy",
    )

    base = url.rstrip("/")
    pages_to_try = [base, f"{base}/contact", f"{base}/about"]
    headers = {"User-Agent": "Mozilla/5.0 (compatible; ColdMailBot/1.0)"}
    found: set = set()

    for page_url in pages_to_try:
        try:
            r = requests.get(page_url, headers=headers, timeout=8, allow_redirects=True)
            if r.status_code == 200:
                for addr in email_re.findall(r.text):
                    addr_lower = addr.lower()
                    if not any(frag in addr_lower for frag in noise_fragments):
                        # Discard addresses whose domain is blacklisted
                        addr_domain = addr_lower.split("@")[-1]
                        if addr_domain not in _BLACKLISTED_EMAIL_DOMAINS:
                            found.add(addr_lower)
        except Exception:
            continue

    # Sort: preferred prefixes first, then alphabetical
    def _sort_key(addr: str) -> int:
        local = addr.split("@")[0]
        for i, prefix in enumerate(_PREFERRED_EMAIL_PREFIXES):
            if local.startswith(prefix):
                return i
        return len(_PREFERRED_EMAIL_PREFIXES)

    return sorted(found, key=_sort_key)


def _find_email_via_hunter(domain: str) -> Optional[str]:
    """
    Query Hunter.io domain-search endpoint.
    Returns the highest-confidence email found, or None.
    """
    hunter_api_key = _hunter_api_key()
    if not hunter_api_key:
        return None
    try:
        resp = requests.get(
            "https://api.hunter.io/v2/domain-search",
            params={"domain": domain, "api_key": hunter_api_key, "limit": 5},
            timeout=10,
        )
        resp.raise_for_status()
        emails = resp.json().get("data", {}).get("emails", [])
        if emails:
            emails.sort(key=lambda x: x.get("confidence", 0), reverse=True)
            return emails[0].get("value")
    except Exception as exc:
        logger.warning("Hunter.io lookup failed for %s: %s", domain, exc)
    return None


def enrich_prospect_email(prospect: Dict) -> Dict:
    """
    Attempt to fill in a contact email for a prospect dict.

    Strategy (in order):
      1. Hunter.io domain search (if API key is provided)
      2. Website scraping (homepage / /contact / /about)

    Modifies and returns the prospect dict in-place.
    """
    website = prospect.get("website")
    if not website:
        return prospect

    try:
        parsed = urlparse(website)
        domain = parsed.netloc.replace("www.", "")
    except Exception:
        return prospect

    # 1️⃣ Hunter.io (more reliable, rate-limited on free tier)
    email = _find_email_via_hunter(domain)

    # 2️⃣ Website scraping fallback
    if not email:
        candidates = extract_emails_from_website(website)
        if candidates:
            email = candidates[0]

    if email:
        prospect["email"] = email

    return prospect
