# server/routers/support_routes.py
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
import math
import httpx
import logging

router = APIRouter(
    prefix="/api",
    tags=["support"],
)

log = logging.getLogger("mendly.support")

MAX_RADIUS_KM = 30.0
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

HEADERS = {
    "User-Agent": "MendlyApp/1.0 support-location-search"
}


class SupportLocation(BaseModel):
    id: int
    name: str
    address: str
    phone: Optional[str] = None
    website: Optional[str] = None
    distanceKm: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: Optional[str] = None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

def build_search_fallbacks(city: str) -> List[SupportLocation]:
    clean_city = city.strip()

    return [
        SupportLocation(
            id=9001,
            name=f"Psychologists in {clean_city}",
            address=f"Search real psychologists and clinics in {clean_city}",
            phone=None,
            website=f"https://www.google.com/maps/search/psychologist+in+{clean_city.replace(' ', '+')}+Israel",
            distanceKm=None,
            lat=None,
            lng=None,
            city=clean_city,
        ),
        SupportLocation(
            id=9002,
            name=f"Mental health clinics in {clean_city}",
            address=f"Search real mental health clinics in {clean_city}",
            phone=None,
            website=f"https://www.google.com/maps/search/mental+health+clinic+in+{clean_city.replace(' ', '+')}+Israel",
            distanceKm=None,
            lat=None,
            lng=None,
            city=clean_city,
        ),
        SupportLocation(
            id=9003,
            name=f"Therapists in {clean_city}",
            address=f"Search real therapists in {clean_city}",
            phone=None,
            website=f"https://www.google.com/maps/search/therapist+in+{clean_city.replace(' ', '+')}+Israel",
            distanceKm=None,
            lat=None,
            lng=None,
            city=clean_city,
        ),
    ]

async def nominatim_search(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    params = {
        "q": query,
        "format": "json",
        "limit": limit,
        "addressdetails": 1,
        "extratags": 1,
    }

    async with httpx.AsyncClient(timeout=15.0, headers=HEADERS) as client:
        response = await client.get(NOMINATIM_URL, params=params)
        response.raise_for_status()
        return response.json()


async def geocode_city(city: str) -> Optional[Dict[str, float]]:
    data = await nominatim_search(f"{city}, Israel", limit=1)

    if not data:
        return None

    first = data[0]

    return {
        "lat": float(first["lat"]),
        "lng": float(first["lon"]),
    }


def convert_nominatim_result(
    item: Dict[str, Any],
    origin_lat: Optional[float] = None,
    origin_lng: Optional[float] = None,
) -> Optional[SupportLocation]:
    try:
        lat = float(item["lat"])
        lng = float(item["lon"])

        display_name = item.get("display_name", "Psychology / Mental Health Support")
        address_data = item.get("address", {})
        extratags = item.get("extratags", {})

        name = (
            item.get("name")
            or extratags.get("name")
            or display_name.split(",")[0]
            or "Psychology / Mental Health Support"
        )

        city = (
            address_data.get("city")
            or address_data.get("town")
            or address_data.get("village")
            or address_data.get("municipality")
        )

        road = address_data.get("road")
        house_number = address_data.get("house_number")

        address_parts = []

        if road:
            if house_number:
                address_parts.append(f"{road} {house_number}")
            else:
                address_parts.append(road)

        if city:
            address_parts.append(city)

        address = ", ".join(address_parts) if address_parts else display_name

        phone = (
            extratags.get("phone")
            or extratags.get("contact:phone")
            or extratags.get("mobile")
        )

        website = (
            extratags.get("website")
            or extratags.get("contact:website")
            or extratags.get("url")
        )

        distance = None

        if origin_lat is not None and origin_lng is not None:
            distance = round(haversine_km(origin_lat, origin_lng, lat, lng), 1)

        return SupportLocation(
            id=int(item.get("place_id", 0)),
            name=name,
            address=address,
            phone=phone,
            website=website,
            distanceKm=distance,
            lat=lat,
            lng=lng,
            city=city,
        )

    except Exception:
        return None


async def search_support_by_city(city: str) -> List[SupportLocation]:
    """
    Search real public OpenStreetMap/Nominatim data by city.
    This is more stable than Overpass for your current setup.
    """
    coords = await geocode_city(city)

    if coords is None:
        return []

    queries = [
        f"psychologist in {city}, Israel",
        f"psychotherapist in {city}, Israel",
        f"therapy clinic in {city}, Israel",
        f"mental health clinic in {city}, Israel",
        f"פסיכולוג {city}",
        f"מרפאה לבריאות הנפש {city}",
    ]

    results: List[SupportLocation] = []
    seen = set()

    for q in queries:
        try:
            log.info("Nominatim support search: %s", q)
            data = await nominatim_search(q, limit=10)

            for item in data:
                loc = convert_nominatim_result(
                    item,
                    origin_lat=coords["lat"],
                    origin_lng=coords["lng"],
                )

                if loc is None:
                    continue

                if loc.distanceKm is not None and loc.distanceKm > MAX_RADIUS_KM:
                    continue

                key = (
                    loc.name.strip().lower(),
                    round(loc.lat or 0, 5),
                    round(loc.lng or 0, 5),
                )

                if key in seen:
                    continue

                seen.add(key)
                results.append(loc)

        except Exception as e:
            log.warning("Nominatim query failed: %s error=%s", q, str(e))
            continue

    results.sort(key=lambda x: x.distanceKm if x.distanceKm is not None else 9999)

    return results[:20]


async def search_support_near_location(lat: float, lng: float) -> List[SupportLocation]:
    """
    Search around current location using a reverse style query.
    Since Nominatim does not support radius like Overpass, we search general
    mental-health terms and then filter by distance.
    """
    queries = [
        "psychologist Israel",
        "psychotherapist Israel",
        "mental health clinic Israel",
        "therapy clinic Israel",
        "פסיכולוג ישראל",
        "מרפאה לבריאות הנפש ישראל",
    ]

    results: List[SupportLocation] = []
    seen = set()

    for q in queries:
        try:
            log.info("Nominatim nearby support search: %s", q)
            data = await nominatim_search(q, limit=30)

            for item in data:
                loc = convert_nominatim_result(
                    item,
                    origin_lat=lat,
                    origin_lng=lng,
                )

                if loc is None:
                    continue

                if loc.distanceKm is not None and loc.distanceKm > MAX_RADIUS_KM:
                    continue

                key = (
                    loc.name.strip().lower(),
                    round(loc.lat or 0, 5),
                    round(loc.lng or 0, 5),
                )

                if key in seen:
                    continue

                seen.add(key)
                results.append(loc)

        except Exception as e:
            log.warning("Nominatim nearby query failed: %s error=%s", q, str(e))
            continue

    results.sort(key=lambda x: x.distanceKm if x.distanceKm is not None else 9999)

    return results[:20]


@router.get("/support-locations", response_model=List[SupportLocation])
async def get_support_locations(
    city: Optional[str] = Query(
        None,
        description="City name, for example Haifa, Tel Aviv, Jerusalem.",
    ),
    lat: Optional[float] = Query(
        None,
        description="Latitude for current-location search.",
    ),
    lng: Optional[float] = Query(
        None,
        description="Longitude for current-location search.",
    ),
):
    try:
        if city:
            city = city.strip()

            if not city:
                return []

            results = await search_support_by_city(city)

            if results:
                return results

            return build_search_fallbacks(city)

        if lat is not None and lng is not None:
            return await search_support_near_location(lat, lng)

        return []

    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Could not fetch real support locations right now: {str(e)}",
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Support location search failed: {str(e)}",
        )