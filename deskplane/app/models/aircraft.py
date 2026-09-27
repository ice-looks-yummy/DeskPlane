from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


FlightStatus = Literal["GROUND", "CLIMB", "CRUISE", "DESCENT", "UNKNOWN"]


class Aircraft(BaseModel):
    """Normalized aircraft data. Altitudes use feet/meters as named; speed is km/h."""

    model_config = ConfigDict(extra="forbid")

    icao24: str
    callsign: str | None = None
    origin_country: str | None = None
    latitude: float
    longitude: float
    altitude_ft: float | None = None
    geo_altitude_m: float | None = None
    speed_kmh: float | None = None
    heading: float | None = Field(default=None, ge=0, lt=360)
    vertical_rate_ms: float | None = None
    on_ground: bool | None = None
    status: FlightStatus = "UNKNOWN"
    distance_km: float | None = None
    bearing: float | None = Field(default=None, ge=0, lt=360)
    registration: str | None = None
    aircraft_model: str | None = None
    airline: str | None = None
    squawk: str | None = None
    position_source: int | None = None
    spi: bool | None = None
    time_position: int | None = None
    last_contact: int | None = None


class Center(BaseModel):
    latitude: float
    longitude: float


class AircraftResponse(BaseModel):
    timestamp: int | None
    center: Center
    radius_km: float
    count: int
    aircraft: list[Aircraft]
