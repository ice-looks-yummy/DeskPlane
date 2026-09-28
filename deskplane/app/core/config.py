from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

SUPPORTED_RADIUS_KM = (50, 100, 200, 500, 1000)
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Required DeskPlane location and optional OpenSky credentials."""

    opensky_client_id: str | None = None
    opensky_client_secret: str | None = None
    deskplane_latitude: float = Field(ge=-90, le=90)
    deskplane_longitude: float = Field(ge=-180, le=180)
    deskplane_radius_km: float = Field(gt=0)

    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")


def get_settings() -> Settings:
    """Load and validate required environment configuration."""
    return Settings()
