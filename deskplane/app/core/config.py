from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Required DeskPlane location and optional OpenSky credentials."""

    opensky_client_id: str | None = None
    opensky_client_secret: str | None = None
    deskplane_latitude: float = Field(ge=-90, le=90)
    deskplane_longitude: float = Field(ge=-180, le=180)
    deskplane_radius_km: float = Field(gt=0)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


def get_settings() -> Settings:
    """Load and validate required environment configuration."""
    return Settings()
