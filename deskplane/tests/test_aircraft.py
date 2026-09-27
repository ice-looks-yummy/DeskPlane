import math

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import app
from app.services import flight_service
from app.services.flight_service import calculate_status, get_nearby_aircraft, parse_opensky_state


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


def test_nullable_fields():
    aircraft = parse_opensky_state(state(callsign=None, altitude=None, speed=None, heading=None, vertical_rate=None))
    assert aircraft.callsign is None
    assert aircraft.altitude_ft is None
    assert aircraft.speed_kmh is None
    assert aircraft.heading is None
    assert aircraft.vertical_rate_ms is None


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
