import httpx
from fastapi import APIRouter, HTTPException, Request

from app.models.aircraft import AircraftResponse
from app.services.flight_service import OpenSkyAPIError, OpenSkyConnectionError, get_nearby_aircraft

router = APIRouter()


@router.get("/api/aircraft", response_model=AircraftResponse)
async def aircraft(request: Request) -> AircraftResponse:
    try:
        result = await get_nearby_aircraft(request.app.state.settings)
        return AircraftResponse(**result)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail={"error": "opensky_timeout", "message": "OpenSky request timed out"}) from exc
    except OpenSkyConnectionError as exc:
        raise HTTPException(status_code=502, detail={"error": "opensky_connection_error", "message": str(exc)}) from exc
    except OpenSkyAPIError as exc:
        raise HTTPException(status_code=502, detail={"error": "opensky_error", "message": str(exc)}) from exc
