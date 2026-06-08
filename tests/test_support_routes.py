# tests/test_support_routes.py
import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.routers import support_routes as sr


def build_client():
    app = FastAPI()
    app.include_router(sr.router)
    return TestClient(app)


def sample_item(
    place_id=1,
    name="Clinic A",
    lat="32.0853",
    lon="34.7818",
    city="Haifa",
    road="Herzl",
    house_number="10",
    phone="04-1234567",
    website="https://clinic.example.com",
):
    return {
        "place_id": place_id,
        "lat": lat,
        "lon": lon,
        "name": name,
        "display_name": f"{name}, {city}, Israel",
        "address": {
            "city": city,
            "road": road,
            "house_number": house_number,
        },
        "extratags": {
            "phone": phone,
            "website": website,
        },
    }


# =====================
# Basic helpers
# =====================

def test_haversine_zero_distance():
    assert sr.haversine_km(32.0, 35.0, 32.0, 35.0) == 0


def test_haversine_known_distance_is_positive():
    assert sr.haversine_km(32.08, 34.78, 32.32, 34.86) > 0


def test_build_search_fallbacks_returns_google_maps_links():
    results = sr.build_search_fallbacks("Tel Aviv")

    assert len(results) == 3
    assert results[0].id == 9001
    assert results[0].city == "Tel Aviv"
    assert "psychologist+in+Tel+Aviv+Israel" in results[0].website
    assert "mental+health+clinic+in+Tel+Aviv+Israel" in results[1].website
    assert "therapist+in+Tel+Aviv+Israel" in results[2].website


def test_convert_nominatim_result_success_full_data():
    item = sample_item()

    loc = sr.convert_nominatim_result(item, origin_lat=32.0, origin_lng=34.7)

    assert loc is not None
    assert loc.id == 1
    assert loc.name == "Clinic A"
    assert loc.address == "Herzl 10, Haifa"
    assert loc.phone == "04-1234567"
    assert loc.website == "https://clinic.example.com"
    assert loc.city == "Haifa"
    assert loc.distanceKm is not None


def test_convert_nominatim_result_uses_display_name_when_fields_missing():
    item = {
        "place_id": 2,
        "lat": "32.1",
        "lon": "34.8",
        "display_name": "Fallback Clinic, Israel",
        "address": {},
        "extratags": {},
    }

    loc = sr.convert_nominatim_result(item)

    assert loc is not None
    assert loc.id == 2
    assert loc.name == "Fallback Clinic"
    assert loc.address == "Fallback Clinic, Israel"
    assert loc.phone is None
    assert loc.website is None
    assert loc.distanceKm is None


def test_convert_nominatim_result_uses_town_village_or_municipality():
    item_town = sample_item(city=None)
    item_town["address"] = {"town": "TownName", "road": "Main"}
    loc_town = sr.convert_nominatim_result(item_town)
    assert loc_town.city == "TownName"
    assert loc_town.address == "Main, TownName"

    item_village = sample_item(city=None)
    item_village["address"] = {"village": "VillageName"}
    loc_village = sr.convert_nominatim_result(item_village)
    assert loc_village.city == "VillageName"

    item_municipality = sample_item(city=None)
    item_municipality["address"] = {"municipality": "MunicipalityName"}
    loc_municipality = sr.convert_nominatim_result(item_municipality)
    assert loc_municipality.city == "MunicipalityName"


def test_convert_nominatim_result_uses_contact_phone_and_url_fields():
    item = sample_item(phone=None, website=None)
    item["extratags"] = {
        "contact:phone": "050-1111111",
        "contact:website": "https://contact.example.com",
    }

    loc = sr.convert_nominatim_result(item)

    assert loc.phone == "050-1111111"
    assert loc.website == "https://contact.example.com"

    item2 = sample_item(phone=None, website=None)
    item2["extratags"] = {
        "mobile": "052-2222222",
        "url": "https://url.example.com",
    }

    loc2 = sr.convert_nominatim_result(item2)

    assert loc2.phone == "052-2222222"
    assert loc2.website == "https://url.example.com"


def test_convert_nominatim_result_returns_none_on_bad_item():
    assert sr.convert_nominatim_result({"lat": "bad", "lon": "34.7"}) is None
    assert sr.convert_nominatim_result({"lat": "32.0"}) is None


# =====================
# Nominatim / geocode
# =====================

@pytest.mark.asyncio
async def test_nominatim_search_calls_httpx(monkeypatch):
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            captured["raised"] = True

        def json(self):
            return [{"ok": True}]

    class FakeAsyncClient:
        def __init__(self, timeout, headers):
            captured["timeout"] = timeout
            captured["headers"] = headers

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, params):
            captured["url"] = url
            captured["params"] = params
            return FakeResponse()

    monkeypatch.setattr(sr.httpx, "AsyncClient", FakeAsyncClient)

    data = await sr.nominatim_search("psychologist Haifa", limit=5)

    assert data == [{"ok": True}]
    assert captured["url"] == sr.NOMINATIM_URL
    assert captured["params"]["q"] == "psychologist Haifa"
    assert captured["params"]["limit"] == 5
    assert captured["headers"] == sr.HEADERS
    assert captured["raised"] is True


@pytest.mark.asyncio
async def test_geocode_city_returns_none_when_no_data(monkeypatch):
    async def fake_search(query, limit=10):
        return []

    monkeypatch.setattr(sr, "nominatim_search", fake_search)

    result = await sr.geocode_city("Haifa")

    assert result is None


@pytest.mark.asyncio
async def test_geocode_city_returns_coords(monkeypatch):
    async def fake_search(query, limit=10):
        assert query == "Haifa, Israel"
        assert limit == 1
        return [{"lat": "32.0853", "lon": "34.7818"}]

    monkeypatch.setattr(sr, "nominatim_search", fake_search)

    result = await sr.geocode_city("Haifa")

    assert result == {"lat": 32.0853, "lng": 34.7818}


# =====================
# search_support_by_city
# =====================

@pytest.mark.asyncio
async def test_search_support_by_city_returns_sorted_deduplicated_results(monkeypatch):
    async def fake_geocode(city):
        return {"lat": 32.0853, "lng": 34.7818}

    calls = {"count": 0}

    async def fake_search(query, limit=10):
        calls["count"] += 1
        return [
            sample_item(place_id=1, name="Clinic A", lat="32.0853", lon="34.7818"),
            sample_item(place_id=2, name="Clinic A", lat="32.0853001", lon="34.7818001"),
            sample_item(place_id=3, name="Clinic B", lat="32.09", lon="34.79"),
        ]

    monkeypatch.setattr(sr, "geocode_city", fake_geocode)
    monkeypatch.setattr(sr, "nominatim_search", fake_search)

    results = await sr.search_support_by_city("Haifa")

    assert len(results) == 2
    assert results[0].distanceKm <= results[1].distanceKm
    assert {r.name for r in results} == {"Clinic A", "Clinic B"}
    assert calls["count"] == 6


@pytest.mark.asyncio
async def test_search_support_by_city_returns_empty_when_geocode_missing(monkeypatch):
    async def fake_geocode(city):
        return None

    monkeypatch.setattr(sr, "geocode_city", fake_geocode)

    results = await sr.search_support_by_city("MissingCity")

    assert results == []


@pytest.mark.asyncio
async def test_search_support_by_city_skips_far_and_invalid_results(monkeypatch):
    async def fake_geocode(city):
        return {"lat": 32.0853, "lng": 34.7818}

    async def fake_search(query, limit=10):
        return [
            sample_item(place_id=1, name="Far Clinic", lat="29.0", lon="35.0"),
            {"lat": "bad", "lon": "bad"},
            sample_item(place_id=2, name="Near Clinic", lat="32.086", lon="34.782"),
        ]

    monkeypatch.setattr(sr, "geocode_city", fake_geocode)
    monkeypatch.setattr(sr, "nominatim_search", fake_search)

    results = await sr.search_support_by_city("Haifa")

    assert len(results) == 1
    assert results[0].name == "Near Clinic"


@pytest.mark.asyncio
async def test_search_support_by_city_continues_when_one_query_fails(monkeypatch):
    async def fake_geocode(city):
        return {"lat": 32.0853, "lng": 34.7818}

    calls = {"count": 0}

    async def fake_search(query, limit=10):
        calls["count"] += 1
        if calls["count"] == 1:
            raise RuntimeError("query failed")
        return [sample_item(place_id=calls["count"], name=f"Clinic {calls['count']}")]

    monkeypatch.setattr(sr, "geocode_city", fake_geocode)
    monkeypatch.setattr(sr, "nominatim_search", fake_search)

    results = await sr.search_support_by_city("Haifa")

    assert len(results) >= 1
    assert calls["count"] == 6


# =====================
# search_support_near_location
# =====================

@pytest.mark.asyncio
async def test_search_support_near_location_returns_sorted_deduplicated_results(monkeypatch):
    async def fake_search(query, limit=10):
        return [
            sample_item(place_id=1, name="Nearby A", lat="32.0853", lon="34.7818"),
            sample_item(place_id=2, name="Nearby A", lat="32.0853001", lon="34.7818001"),
            sample_item(place_id=3, name="Nearby B", lat="32.09", lon="34.79"),
        ]

    monkeypatch.setattr(sr, "nominatim_search", fake_search)

    results = await sr.search_support_near_location(32.0853, 34.7818)

    assert len(results) == 2
    assert results[0].distanceKm <= results[1].distanceKm
    assert {r.name for r in results} == {"Nearby A", "Nearby B"}


@pytest.mark.asyncio
async def test_search_support_near_location_skips_far_invalid_and_failed_query(monkeypatch):
    calls = {"count": 0}

    async def fake_search(query, limit=10):
        calls["count"] += 1

        if calls["count"] == 1:
            raise RuntimeError("nearby query failed")

        return [
            sample_item(place_id=1, name="Far Clinic", lat="29.0", lon="35.0"),
            {"lat": "bad", "lon": "bad"},
            sample_item(place_id=2, name="Near Clinic", lat="32.086", lon="34.782"),
        ]

    monkeypatch.setattr(sr, "nominatim_search", fake_search)

    results = await sr.search_support_near_location(32.0853, 34.7818)

    assert len(results) == 1
    assert results[0].name == "Near Clinic"
    assert calls["count"] == 6


# =====================
# Route tests
# =====================

def test_support_locations_by_city(monkeypatch):
    async def fake_city_search(city):
        return [
            sr.SupportLocation(
                id=1,
                name="Clinic A",
                address=f"{city} address",
                city=city,
                distanceKm=1.2,
                lat=32.0,
                lng=34.0,
            )
        ]

    monkeypatch.setattr(sr, "search_support_by_city", fake_city_search)

    client = build_client()
    res = client.get("/api/support-locations", params={"city": "haifa"})

    assert res.status_code == 200
    data = res.json()

    assert len(data) == 1
    assert data[0]["name"] == "Clinic A"
    assert data[0]["city"] == "haifa"


def test_support_locations_city_returns_fallback_when_no_results(monkeypatch):
    async def fake_city_search(city):
        return []

    monkeypatch.setattr(sr, "search_support_by_city", fake_city_search)

    client = build_client()
    res = client.get("/api/support-locations", params={"city": "Beer Sheva"})

    assert res.status_code == 200
    data = res.json()

    assert len(data) == 3
    assert data[0]["id"] == 9001
    assert data[0]["city"] == "Beer Sheva"


def test_support_locations_blank_city_returns_empty(monkeypatch):
    called = {"value": False}

    async def fake_city_search(city):
        called["value"] = True
        return []

    monkeypatch.setattr(sr, "search_support_by_city", fake_city_search)

    client = build_client()
    res = client.get("/api/support-locations", params={"city": "   "})

    assert res.status_code == 200
    assert res.json() == []
    assert called["value"] is False


def test_support_locations_by_coordinates(monkeypatch):
    async def fake_near_search(lat, lng):
        return [
            sr.SupportLocation(
                id=1,
                name="Nearby Clinic",
                address="Nearby address",
                distanceKm=2.5,
                lat=lat,
                lng=lng,
            )
        ]

    monkeypatch.setattr(sr, "search_support_near_location", fake_near_search)

    client = build_client()
    res = client.get("/api/support-locations", params={"lat": 32.0853, "lng": 34.7818})

    assert res.status_code == 200
    data = res.json()

    assert isinstance(data, list)
    assert data[0]["distanceKm"] == 2.5


def test_support_locations_no_params_returns_empty():
    client = build_client()

    res = client.get("/api/support-locations")

    assert res.status_code == 200
    assert res.json() == []


def test_support_locations_http_error_returns_502(monkeypatch):
    async def fake_city_search(city):
        raise httpx.HTTPError("network down")

    monkeypatch.setattr(sr, "search_support_by_city", fake_city_search)

    client = build_client()
    res = client.get("/api/support-locations", params={"city": "Haifa"})

    assert res.status_code == 502
    assert "Could not fetch real support locations" in res.text


def test_support_locations_unexpected_error_returns_500(monkeypatch):
    async def fake_near_search(lat, lng):
        raise RuntimeError("boom")

    monkeypatch.setattr(sr, "search_support_near_location", fake_near_search)

    client = build_client()
    res = client.get("/api/support-locations", params={"lat": 32.0, "lng": 34.0})

    assert res.status_code == 500
    assert "Support location search failed" in res.text