# DeskPlane Phase 1 Backend

DeskPlane is a physical desktop live-aircraft tracking device. Phase 1 implements only the Python backend: it fetches OpenSky state vectors, normalizes aircraft data, calculates distance and bearing from a configured location, filters by radius, and serves JSON over FastAPI. It does not include display hardware, a frontend, a database, or WebSockets.

## Architecture

`OpenSky → asynchronous HTTP client → state parser → Aircraft model → distance/bearing/status → radius filter → FastAPI`

## Project structure

- `app/main.py`: FastAPI application and root/health routes.
- `app/api/routes.py`: aircraft API route and provider error responses.
- `app/services/flight_service.py`: OpenSky requests, state parsing, status and filtering.
- `app/models/aircraft.py`: normalized Pydantic response models.
- `app/core/config.py`: validated environment settings.
- `app/utils/geo.py`: Haversine distance and initial bearing.
- `tests/`: offline automated tests; tests do not contact OpenSky.

## OpenSky integration and state-vector mapping

The backend requests `GET https://opensky-network.org/api/states/all`. It reads each state's documented positions:

| Index | OpenSky field | DeskPlane use |
|---:|---|---|
| 0 | icao24 | `icao24` |
| 1 | callsign | `callsign`, trimmed |
| 2 | origin_country | `origin_country` |
| 3 | time_position | `time_position` |
| 4 | last_contact | `last_contact` |
| 5 | longitude | `longitude` |
| 6 | latitude | `latitude` |
| 7 | baro_altitude | `altitude_ft`, meters converted to feet |
| 8 | on_ground | `on_ground` |
| 9 | velocity | `speed_kmh`, m/s converted to km/h |
| 10 | true_track | `heading`, normalized to 0–<360 degrees |
| 11 | vertical_rate | `vertical_rate_ms` |
| 12 | sensors | retained only by the raw provider data |
| 13 | geo_altitude | `geo_altitude_m`, meters |
| 14 | squawk | `squawk` |
| 15 | spi | `spi` |
| 16 | position_source | `position_source` (0 ADS-B, 1 ASTERIX, 2 MLAT, 3 FLARM) |
| 17 | category | not treated as aircraft model/type |

Registration, aircraft model, and airline are always `null`: state vectors do not provide those values, and DeskPlane does not infer them. Aircraft without either coordinate are skipped. Invalid individual vectors are skipped without discarding valid aircraft.

When both `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` are configured, the client obtains an OAuth2 client-credentials token. It does not use username/password Basic Authentication. Credentials and tokens are not returned by the API.

## Location, radius, distance, bearing, and status

Create a local `.env` from `.env.example` and supply `DESKPLANE_LATITUDE`, `DESKPLANE_LONGITUDE`, and `DESKPLANE_RADIUS_KM`. There are no location defaults. Latitude must be -90 through 90, longitude -180 through 180, and radius greater than zero. Invalid or missing required values prevent the application from starting.

Distance is the great-circle Haversine distance in kilometers from the configured center to an aircraft. Bearing is the initial direction in degrees from the configured center to the aircraft (`0 <= bearing < 360`). `heading` is separate: it is the aircraft's direction of travel from OpenSky true_track.

Aircraft are included when `distance_km <= DESKPLANE_RADIUS_KM`; the exact boundary is included. Status is DeskPlane's heuristic: ground aircraft are `GROUND`; airborne aircraft with vertical rate above 0.5 m/s are `CLIMB`, below -0.5 m/s are `DESCENT`, otherwise `CRUISE`. Missing ground/rate data can produce `UNKNOWN`. This is not an official OpenSky classification.

## API

- `GET /` returns `{"name":"DeskPlane","status":"online"}`.
- `GET /health` returns `{"status":"ok"}`.
- `GET /api/aircraft` fetches current state vectors and returns only aircraft inside the configured radius. An empty nearby set is HTTP 200 with `count: 0` and an empty `aircraft` array. The top-level timestamp comes from OpenSky's `time` when valid.

Example response (values are illustrative):

```json
{
  "timestamp": 1750000000,
  "center": {"latitude": 20.2961, "longitude": 85.8245},
  "radius_km": 50,
  "count": 1,
  "aircraft": [{
    "icao24": "abc123", "callsign": "IGO927", "origin_country": "India",
    "latitude": 20.31, "longitude": 85.82, "altitude_ft": 35200,
    "geo_altitude_m": 10700, "speed_kmh": 842, "heading": 61,
    "vertical_rate_ms": 0, "on_ground": false, "status": "CRUISE",
    "distance_km": 1.6, "bearing": 345,
    "registration": null, "aircraft_model": null, "airline": null,
    "squawk": null, "position_source": 0, "spi": false,
    "time_position": 1234567890, "last_contact": 1234567890
  }]
}
```

Units: `altitude_ft` is feet; `geo_altitude_m` and `vertical_rate_ms` are meters and meters/second; `speed_kmh` is kilometers/hour; `distance_km` is kilometers; `heading` and `bearing` are degrees.

OpenSky timeouts return HTTP 504. Connection failures, provider HTTP/authentication errors, and malformed provider responses return HTTP 502 with a useful error code and message. These errors are not converted into empty aircraft results.

## Install and run (Windows PowerShell)

From the `deskplane` directory:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` and enter your own location and, if required, OpenSky client credentials. Then start the server:

```powershell
uvicorn app.main:app --reload
```

Alternatively, run `python run.py`. The interactive Swagger documentation is at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs); ReDoc is at [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc).

## Tests

Tests use mocked provider data and make no live OpenSky calls:

```powershell
pytest
```
