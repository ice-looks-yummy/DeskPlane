import httpx
import math

from fastapi import APIRouter, HTTPException, Query, Request

from app.core.config import SUPPORTED_RADIUS_KM
from app.models.aircraft import AircraftResponse
from app.services.flight_service import OpenSkyAPIError, OpenSkyConnectionError, get_nearby_aircraft

router = APIRouter()


@router.get("/api/aircraft", response_model=AircraftResponse)
async def aircraft(request: Request, radius_km: str | None = Query(default=None, description="Monitoring range in kilometers: 50, 100, 200, 500, or 1000")) -> AircraftResponse:
    selected_radius = request.app.state.settings.deskplane_radius_km
    if radius_km is not None:
        try:
            requested_radius = float(radius_km)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={"error": "invalid_radius", "message": f"radius_km must be one of {', '.join(map(str, SUPPORTED_RADIUS_KM))}"},
            ) from exc
        if not math.isfinite(requested_radius) or requested_radius not in SUPPORTED_RADIUS_KM:
            raise HTTPException(
                status_code=400,
                detail={"error": "invalid_radius", "message": f"radius_km must be one of {', '.join(map(str, SUPPORTED_RADIUS_KM))}"},
            )
        selected_radius = requested_radius
    try:
        result = await get_nearby_aircraft(request.app.state.settings, selected_radius if radius_km is not None else None)
        return AircraftResponse(**result)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail={"error": "opensky_timeout", "message": "OpenSky request timed out"}) from exc
    except OpenSkyConnectionError as exc:
        raise HTTPException(status_code=502, detail={"error": "opensky_connection_error", "message": str(exc)}) from exc
    except OpenSkyAPIError as exc:
        raise HTTPException(status_code=502, detail={"error": "opensky_error", "message": str(exc)}) from exc
