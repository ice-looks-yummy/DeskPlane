import math

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import app
from app.services import flight_service
from app.services.flight_service import calculate_status, get_nearby_aircraft, parse_opensky_state
from app.utils.geo import EARTH_RADIUS_KM


def state(*, latitude=20.31, longitude=85.82, callsign=" IGO927 ", altitude=10000,
          speed=100, heading=361, vertical_rate=0, on_ground=False):
    return ["abc123", callsign, "India", 1234567890, 1234567890, longitude, latitude,
            altitude, on_ground, speed, heading, vertical_rate, [1, 2], 10700, None,
            False, 0, 0]


def test_state_parsing_and_conversions():
    aircraft = parse_opensky_state(state())
    assert aircraft.icao24 == "abc123"
    assert aircraft.callsign == "IGO927"
    assert aircraft.altitude_ft == pytest.approx(32808.4)
    assert aircraft.speed_kmh == 360
    assert aircraft.heading == 1
    assert aircraft.vertical_rate_ms == 0
    assert aircraft.geo_altitude_m == 10700
    assert aircraft.registration is aircraft.aircraft_model is aircraft.airline is None


def test_state_parsing_accepts_vector_without_optional_category():
    aircraft = parse_opensky_state(state()[:17])
    assert aircraft.icao24 == "abc123"
    assert aircraft.latitude == 20.31
    assert aircraft.longitude == 85.82


def test_state_parsing_rejects_vector_missing_required_position_source():
    with pytest.raises(ValueError, match="at least 17 fields"):
        parse_opensky_state(state()[:16])


def test_nullable_fields():
    aircraft = parse_opensky_state(state(callsign=None, altitude=None, speed=None, heading=None, vertical_rate=None))
    assert aircraft.callsign is None
    assert aircraft.altitude_ft is None
    assert aircraft.speed_kmh is None
    assert aircraft.heading is None
    assert aircraft.vertical_rate_ms is None


@pytest.mark.asyncio
async def test_opensky_client_bypasses_environment_proxy_and_uses_oauth(monkeypatch):
    settings = Settings(
        opensky_client_id="test-client-id",
        opensky_client_secret="test-client-secret",
        deskplane_latitude=0,
        deskplane_longitude=0,
        deskplane_radius_km=50,
    )
    client_options = {}
    requests = []

    class FakeResponse:
        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self.payload

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            client_options.update(kwargs)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, *, data):
            requests.append(("POST", url))
            assert data["grant_type"] == "client_credentials"
            assert data["client_id"] == "test-client-id"
            assert data["client_secret"] == "test-client-secret"
            return FakeResponse({"access_token": "test-access-token"})

        async def get(self, url, *, headers):
            requests.append(("GET", url))
            assert headers["Authorization"] == "Bearer test-access-token"
            return FakeResponse({"time": 123, "states": []})

    monkeypatch.setattr(flight_service.httpx, "AsyncClient", FakeAsyncClient)

    payload = await flight_service.fetch_opensky_data(settings)

    assert client_options == {"timeout": 20.0, "trust_env": False}
    assert requests == [
        ("POST", flight_service.OPENSKY_TOKEN_URL),
        ("GET", flight_service.OPENSKY_STATES_URL),
    ]
    assert payload == {"time": 123, "states": []}


@pytest.mark.parametrize("value", [None, [], ["a"]])
def test_malformed_and_short_state(value):
    with pytest.raises(ValueError):
        parse_opensky_state(value)


@pytest.mark.parametrize(("on_ground", "rate", "expected"), [
    (True, 8, "GROUND"), (False, 1, "CLIMB"), (False, 0, "CRUISE"),
    (False, -1, "DESCENT"), (None, None, "UNKNOWN"),
])
def test_status(on_ground, rate, expected):
    assert calculate_status(on_ground, rate) == expected


@pytest.mark.parametrize(("field", "value"), [
    ("deskplane_latitude", 91), ("deskplane_longitude", 181), ("deskplane_radius_km", 0),
])
def test_invalid_location_settings(field, value):
    values = {"deskplane_latitude": 0, "deskplane_longitude": 0, "deskplane_radius_km": 1}
    values[field] = value
    with pytest.raises(ValidationError):
        Settings(**values)


@pytest.mark.asyncio
async def test_radius_inside_boundary_outside_and_missing_coordinates(monkeypatch):
    settings = Settings(deskplane_latitude=0, deskplane_longitude=0, deskplane_radius_km=100)
    boundary_lon = math.degrees(100 / 6371.0088)
    vectors = [state(latitude=0, longitude=0), state(latitude=0, longitude=boundary_lon),
               state(latitude=0, longitude=1.1), state(latitude=None), state(longitude=None), ["bad"]]
    async def fetch(_):
        return {"time": 1750000000, "states": vectors}
    monkeypatch.setattr(flight_service, "fetch_opensky_data", fetch)
    result = await get_nearby_aircraft(settings)
    assert result["timestamp"] == 1750000000
    assert result["count"] == 2
    assert result["aircraft"][1].distance_km == pytest.approx(100)


@pytest.mark.asyncio
async def test_zero_aircraft(monkeypatch):
    async def fetch(_):
        return {"time": 1, "states": []}
    monkeypatch.setattr(flight_service, "fetch_opensky_data", fetch)
    result = await get_nearby_aircraft(Settings(deskplane_latitude=0, deskplane_longitude=0, deskplane_radius_km=2))
    assert result["count"] == 0 and result["aircraft"] == []


@pytest.mark.parametrize("payload", [{}, {"states": "bad"}, {"states": []}])
def test_malformed_provider_payload_returns_502(monkeypatch, payload):
    async def fetch(_):
        if payload == {"states": []}:
            raise flight_service.OpenSkyAPIError("OpenSky response is missing the states field")
        raise flight_service.OpenSkyAPIError("bad response")
    monkeypatch.setattr(flight_service, "fetch_opensky_data", fetch)
    response = TestClient(app).get("/api/aircraft")
    assert response.status_code == 502


def test_api_zero_aircraft_response(monkeypatch):
    async def fetch(_):
        return {"time": 42, "states": []}
    monkeypatch.setattr(flight_service, "fetch_opensky_data", fetch)
    response = TestClient(app).get("/api/aircraft")
    assert response.status_code == 200
    assert response.json()["count"] == 0


@pytest.mark.parametrize(("error", "status"), [(httpx.TimeoutException("slow"), 504),
    (flight_service.OpenSkyConnectionError("offline"), 502), (flight_service.OpenSkyAPIError("bad"), 502)])
def test_provider_errors_are_http_errors(monkeypatch, error, status):
    async def fetch(_):
        raise error
    monkeypatch.setattr(flight_service, "fetch_opensky_data", fetch)
    response = TestClient(app).get("/api/aircraft")
    assert response.status_code == status


def vector_at_distance(distance_km):
    return state(latitude=0, longitude=math.degrees(distance_km / EARTH_RADIUS_KM))


@pytest.mark.parametrize(("radius", "expected_count"), [(50, 0), (100, 2), (200, 2), (500, 3), (1000, 5)])
def test_requested_radius_filters_and_is_returned(monkeypatch, radius, expected_count):
    monkeypatch.setattr(app.state, "settings", Settings(deskplane_latitude=0, deskplane_longitude=0, deskplane_radius_km=50))

    async def fetch(_):
        return {"time": 1750000000, "states": [vector_at_distance(km) for km in (75, 100, 250, 750, 1000)]}

    monkeypatch.setattr(flight_service, "fetch_opensky_data", fetch)
    response = TestClient(app).get(f"/api/aircraft?radius_km={radius}")
    assert response.status_code == 200
    assert response.json()["radius_km"] == radius
    assert response.json()["count"] == expected_count
    assert all(item["distance_km"] <= radius for item in response.json()["aircraft"])


def test_configured_radius_is_used_when_query_is_absent(monkeypatch):
    monkeypatch.setattr(app.state, "settings", Settings(deskplane_latitude=0, deskplane_longitude=0, deskplane_radius_km=50))

    async def fetch(_):
        return {"time": 1, "states": [vector_at_distance(49), vector_at_distance(51)]}

    monkeypatch.setattr(flight_service, "fetch_opensky_data", fetch)
    response = TestClient(app).get("/api/aircraft")
    assert response.status_code == 200
    assert response.json()["radius_km"] == 50
    assert response.json()["count"] == 1


@pytest.mark.parametrize("radius", ["-50", "0", "300", "100000", "NaN", "Infinity", "abc", ""])
def test_invalid_requested_radius_returns_400_without_fetching(monkeypatch, radius):
    async def should_not_fetch(_):
        raise AssertionError("invalid radius should be rejected before OpenSky is called")

    monkeypatch.setattr(flight_service, "fetch_opensky_data", should_not_fetch)
    response = TestClient(app).get(f"/api/aircraft?radius_km={radius}")
    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "invalid_radius"
