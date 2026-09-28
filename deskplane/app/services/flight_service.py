import logging
import math
from typing import Any

import httpx

from app.core.config import Settings
from app.models.aircraft import Aircraft
from app.utils.geo import haversine_distance_km, initial_bearing

logger = logging.getLogger(__name__)
OPENSKY_STATES_URL = "https://opensky-network.org/api/states/all"
OPENSKY_TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
CLIMB_THRESHOLD_MS = 0.5
DESCENT_THRESHOLD_MS = -0.5


def _number(value: Any, field: str) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"Invalid numeric value for {field}")
    return float(value)


def parse_opensky_state(state: list[Any]) -> Aircraft:
    """Parse one OpenSky state vector using its documented positional indexes."""
    # OpenSky may omit the optional category at index 17. Fields 0 through 16
    # contain all values needed by DeskPlane's normalized aircraft model.
    if not isinstance(state, list) or len(state) < 17:
        raise ValueError("OpenSky state vector must contain at least 17 fields")
    if not isinstance(state[0], str) or not state[0].strip():
        raise ValueError("OpenSky state vector has no valid icao24")
    latitude = _number(state[6], "latitude")
    longitude = _number(state[5], "longitude")
    if latitude is None or longitude is None:
        raise ValueError("OpenSky state vector has no coordinates")
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise ValueError("OpenSky coordinates are out of range")
    callsign = state[1].strip() if isinstance(state[1], str) else None
    if not callsign:
        callsign = None
    heading = _number(state[10], "true_track")
    if heading is not None:
        heading %= 360
    on_ground = state[8] if isinstance(state[8], bool) else None
    spi = state[15] if isinstance(state[15], bool) else None
    altitude = _number(state[7], "baro_altitude")
    velocity = _number(state[9], "velocity")
    vertical_rate = _number(state[11], "vertical_rate")
    return Aircraft(
        icao24=state[0].strip().lower(), callsign=callsign,
        origin_country=state[2] if isinstance(state[2], str) else None,
        latitude=latitude, longitude=longitude,
        altitude_ft=altitude * 3.28084 if altitude is not None else None,
        geo_altitude_m=_number(state[13], "geo_altitude"),
        speed_kmh=velocity * 3.6 if velocity is not None else None,
        heading=heading, vertical_rate_ms=vertical_rate, on_ground=on_ground,
        status="UNKNOWN", distance_km=None, bearing=None,
        registration=None, aircraft_model=None, airline=None,
        squawk=state[14] if isinstance(state[14], str) else None,
        position_source=state[16] if isinstance(state[16], int) and not isinstance(state[16], bool) else None,
        spi=spi,
        time_position=state[3] if isinstance(state[3], int) and not isinstance(state[3], bool) else None,
        last_contact=state[4] if isinstance(state[4], int) and not isinstance(state[4], bool) else None,
    )


def calculate_status(on_ground: bool | None, vertical_rate_ms: float | None) -> str:
    if on_ground is True:
        return "GROUND"
    if vertical_rate_ms is not None:
        if vertical_rate_ms > CLIMB_THRESHOLD_MS:
            return "CLIMB"
        if vertical_rate_ms < DESCENT_THRESHOLD_MS:
            return "DESCENT"
    if on_ground is False:
        return "CRUISE"
    return "UNKNOWN"


async def fetch_opensky_data(settings: Settings) -> dict[str, Any]:
    """Fetch current state vectors, using OAuth2 client credentials when configured."""
    async with httpx.AsyncClient(timeout=20.0, trust_env=False) as client:
        headers: dict[str, str] = {}
        if settings.opensky_client_id and settings.opensky_client_secret:
            try:
                token_response = await client.post(
                    OPENSKY_TOKEN_URL,
                    data={"grant_type": "client_credentials", "client_id": settings.opensky_client_id,
                          "client_secret": settings.opensky_client_secret},
                )
                token_response.raise_for_status()
                token_payload = token_response.json()
                token = token_payload.get("access_token") if isinstance(token_payload, dict) else None
                if not token:
                    raise ValueError("OpenSky token response did not contain an access token")
                headers["Authorization"] = f"Bearer {token}"
            except httpx.TimeoutException:
                raise
            except httpx.HTTPStatusError as exc:
                raise OpenSkyAPIError(f"OpenSky authentication returned HTTP {exc.response.status_code}") from exc
            except httpx.HTTPError as exc:
                raise OpenSkyConnectionError("Could not connect to OpenSky authentication service") from exc
            except ValueError as exc:
                raise OpenSkyAPIError("OpenSky authentication failed") from exc
        try:
            response = await client.get(OPENSKY_STATES_URL, headers=headers)
            response.raise_for_status()
            payload = response.json()
        except httpx.TimeoutException:
            raise
        except httpx.HTTPStatusError as exc:
            raise OpenSkyAPIError(f"OpenSky returned HTTP {exc.response.status_code}") from exc
        except httpx.HTTPError as exc:
            raise OpenSkyConnectionError("Could not connect to OpenSky") from exc
        except ValueError as exc:
            raise OpenSkyAPIError("OpenSky returned invalid JSON") from exc
    if not isinstance(payload, dict) or "states" not in payload:
        raise OpenSkyAPIError("OpenSky response is missing the states field")
    if payload["states"] is not None and not isinstance(payload["states"], list):
        raise OpenSkyAPIError("OpenSky states field must be a list or null")
    return payload


class OpenSkyAPIError(Exception):
    pass


class OpenSkyConnectionError(Exception):
    pass


async def get_nearby_aircraft(settings: Settings, radius_km: float | None = None) -> dict[str, Any]:
    payload = await fetch_opensky_data(settings)
    selected_radius = settings.deskplane_radius_km if radius_km is None else radius_km
    nearby: list[Aircraft] = []
    for state in payload["states"] or []:
        try:
            aircraft = parse_opensky_state(state)
        except (ValueError, TypeError) as exc:
            logger.debug("Skipping malformed OpenSky state: %s", exc)
            continue
        distance = haversine_distance_km(settings.deskplane_latitude, settings.deskplane_longitude,
                                         aircraft.latitude, aircraft.longitude)
        if distance > selected_radius:
            continue
        bearing = initial_bearing(settings.deskplane_latitude, settings.deskplane_longitude,
                                  aircraft.latitude, aircraft.longitude)
        aircraft.distance_km = distance
        aircraft.bearing = bearing
        aircraft.status = calculate_status(aircraft.on_ground, aircraft.vertical_rate_ms)
        nearby.append(aircraft)
    timestamp = payload.get("time")
    if isinstance(timestamp, bool) or not isinstance(timestamp, int):
        timestamp = None
    return {"timestamp": timestamp,
            "center": {"latitude": settings.deskplane_latitude, "longitude": settings.deskplane_longitude},
            "radius_km": selected_radius, "count": len(nearby), "aircraft": nearby}
