import importlib
import os
import uuid

import pytest
from fastapi.testclient import TestClient
from jose import jwt


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "campaign_test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
    monkeypatch.setenv("GOOGLE_API_KEY", "dummy")
    monkeypatch.setenv("SERPER_API_KEY", "dummy")
    monkeypatch.setenv("SMTP_HOST", "smtp.test.local")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "sender@test.local")
    monkeypatch.setenv("SMTP_PASSWORD", "app-pass")
    monkeypatch.setenv("EMAIL_FROM_NAME", "Sender")
    monkeypatch.setenv("EMAIL_FROM_ADDRESS", "sender@test.local")
    monkeypatch.setenv("SMTP_ENCRYPTION_KEY", "encryption-test-key")

    import embeddings_util

    embeddings_util.DATABASE_URL = os.environ["DATABASE_URL"]
    embeddings_util._engine = None

    import app.main
    import app.services.campaign_service as campaign_service_module

    importlib.reload(app.main)

    # Stub external network/LLM side effects.
    monkeypatch.setattr(
        app.main.campaign_service.email_gen,
        "generate_cold_email",
        lambda sender_profile, prospect, campaign_context: {
            "subject": f"Intro for {prospect.get('business_name', 'Prospect')}",
            "body": "Hello, this is a short introduction.",
        },
    )

    monkeypatch.setattr(
        campaign_service_module,
        "search_businesses",
        lambda query, location, max_results: [
            {
                "business_name": "Atlas Cafe",
                "website": "https://atlascafe.example",
                "description": "Cafe business",
                "location": location,
            },
            {
                "business_name": "Atlas Cafe Duplicate Domain",
                "website": "https://www.atlascafe.example/about",
                "description": "Duplicate domain should be deduped",
                "location": location,
            },
            {
                "business_name": "Beacon Studio",
                "website": "https://beaconstudio.example",
                "description": "Design studio",
                "location": location,
            },
        ],
    )

    def fake_enrich(p):
        if "atlas" in (p.get("website") or ""):
            p["email"] = "hello@atlascafe.example"
        if "beacon" in (p.get("website") or ""):
            p["email"] = "contact@beaconstudio.example"
        return p

    monkeypatch.setattr(campaign_service_module, "enrich_prospect_email", fake_enrich)

    monkeypatch.setattr(
        app.main.campaign_service.email_send,
        "validate_smtp_config",
        lambda profile=None: (True, ""),
    )

    monkeypatch.setattr(
        app.main.campaign_service.email_send,
        "send_email",
        lambda to_email, subject, body, profile=None: (True, f"<{uuid.uuid4()}@mail.test>", ""),
    )

    monkeypatch.setattr(
        app.main.campaign_service.email_send,
        "check_replies",
        lambda sent_message_ids, profile=None, days_back=30: [
            {
                "in_reply_to": sent_message_ids[0],
                "from_email": "prospect@atlascafe.example",
                "subject": "Re: Intro",
                "body": "Thanks, interested to learn more.",
                "received_at": "Fri, 20 Mar 2026 10:00:00 +0000",
            }
        ]
        if sent_message_ids
        else [],
    )

    return TestClient(app.main.app)


def _auth_headers(user_id="user-1"):
    token = jwt.encode({"sub": user_id}, "test-secret", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def _create_profile_and_campaign(client: TestClient, headers):
    profile_resp = client.post(
        "/campaigns/profiles",
        headers=headers,
        json={
            "name": "Acme Growth",
            "type": "agency",
            "area_of_work": "lead generation",
            "location": "Colombo",
            "website": "https://acme.example",
            "description": "B2B growth partner",
            "contact_email": "owner@acme.example",
            "contact_name": "Ava",
        },
    )
    assert profile_resp.status_code == 201
    profile_id = profile_resp.json()["id"]

    campaign_resp = client.post(
        "/campaigns",
        headers=headers,
        json={
            "business_profile_id": profile_id,
            "name": "Cafe Outreach",
            "target_industry": "cafes",
            "target_location": "Colombo",
            "target_keywords": "coffee, brunch",
        },
    )
    assert campaign_resp.status_code == 201
    return profile_id, campaign_resp.json()["id"]


def test_campaign_endpoints_happy_path_and_guards(client: TestClient):
    headers = _auth_headers()

    # 1) POST /campaigns/profiles creates valid sender profile.
    _, campaign_id = _create_profile_and_campaign(client, headers)

    # 2) POST /campaigns rejects invalid profile linkage.
    bad_campaign = client.post(
        "/campaigns",
        headers=headers,
        json={
            "business_profile_id": "missing-profile-id",
            "name": "Invalid Campaign",
            "target_industry": "saas",
            "target_location": "Lahore",
            "target_keywords": "b2b, sales",
        },
    )
    assert bad_campaign.status_code == 400

    # 3) POST /campaigns/{id}/discover returns prospects with consistent statuses.
    discover = client.post(
        f"/campaigns/{campaign_id}/discover",
        headers=headers,
        json={"max_results": 10},
    )
    assert discover.status_code == 200
    discovered = discover.json()
    assert len(discovered) == 2
    assert all(p["status"] in {"discovered", "email_found"} for p in discovered)

    # 4) PATCH /campaigns/{id}/prospects/{pid} validates and persists manual email.
    target = discovered[0]
    invalid_patch = client.patch(
        f"/campaigns/{campaign_id}/prospects/{target['id']}",
        headers=headers,
        json={"email": "not-an-email"},
    )
    assert invalid_patch.status_code == 422

    valid_patch = client.patch(
        f"/campaigns/{campaign_id}/prospects/{target['id']}",
        headers=headers,
        json={"email": "owner@atlascafe.example"},
    )
    assert valid_patch.status_code == 200
    assert valid_patch.json()["email"] == "owner@atlascafe.example"

    # 5) POST /campaigns/{id}/generate-emails creates only missing drafts.
    generated_once = client.post(f"/campaigns/{campaign_id}/generate-emails", headers=headers)
    assert generated_once.status_code == 200
    first_drafts = generated_once.json()
    assert len(first_drafts) >= 1

    generated_twice = client.post(f"/campaigns/{campaign_id}/generate-emails", headers=headers)
    assert generated_twice.status_code == 200
    assert generated_twice.json() == []

    # 6) POST /campaigns/{id}/send updates sent/failed counts correctly.
    send_once = client.post(f"/campaigns/{campaign_id}/send", headers=headers)
    assert send_once.status_code == 200
    send_data = send_once.json()
    assert send_data["sent"] >= 1
    assert send_data["failed"] == 0

    send_twice = client.post(f"/campaigns/{campaign_id}/send", headers=headers)
    assert send_twice.status_code == 200
    assert send_twice.json()["sent"] == 0

    # 7) POST /campaigns/{id}/check-replies records new replies once.
    replies_once = client.post(f"/campaigns/{campaign_id}/check-replies", headers=headers)
    assert replies_once.status_code == 200
    assert replies_once.json()["replies_found"] == 1

    replies_twice = client.post(f"/campaigns/{campaign_id}/check-replies", headers=headers)
    assert replies_twice.status_code == 200
    assert replies_twice.json()["replies_found"] == 0

    # 8) GET /campaigns/{id}/analytics matches database truth.
    analytics = client.get(f"/campaigns/{campaign_id}/analytics", headers=headers)
    assert analytics.status_code == 200
    payload = analytics.json()
    assert payload["prospects"]["total"] == 2
    assert payload["emails"]["sent"] >= 1
    assert payload["engagement"]["replied"] == 1
    assert "summary" in payload
