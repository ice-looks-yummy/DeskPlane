# DeskPlane Local Dashboard

DeskPlane Phase 1 is the FastAPI service that reads current aircraft state vectors from OpenSky, normalizes them, and filters by the configured location and radius. Phase 2 adds this local React dashboard. It reads the backend's real `/api/aircraft` response and shows the aircraft on a range-scaled radar, in a track register, and in a selectable detail panel.

## Local architecture

```text
OpenSky → FastAPI backend → GET /api/aircraft → React dashboard
                                      ↑
                            GET /health status check
```

The backend listens at `http://127.0.0.1:8000`. Vite serves the frontend at `http://127.0.0.1:5173`. Both services need to be running. The dashboard checks backend health and polls aircraft data on a fixed five-second interval, with overlapping requests prevented. A separate local clock updates once per second; the last successful data receipt and the backend's source timestamp are shown separately. The dashboard range selector supports **50, 100, 200, 500, and 1000 km**. Choosing a range immediately requests `GET /api/aircraft?radius_km=<value>`; without that parameter, the backend uses `DESKPLANE_RADIUS_KM` from its environment configuration. The radar is drawn locally in SVG and does not use a map provider. It uses the backend coordinates, distance, bearing, and returned radius; an empty response displays “NO AIRCRAFT DETECTED.”

## Project structure

- `deskplane/`: existing Python FastAPI backend and its tests.
- `frontend/src/services/api.ts`: the single frontend API access layer.
- `frontend/src/components/`: dashboard header, summary, radar, aircraft list, and details.
- `frontend/src/utils/radar.ts`: coordinate-to-radar positioning.
- `frontend/src/App.test.tsx` and `frontend/src/components/Radar.test.ts`: mocked frontend tests.

## Configure and run the backend (Windows PowerShell)

In a first PowerShell window:

```powershell
cd C:\DeskPlane\deskplane
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `deskplane\.env` and set your DeskPlane latitude, longitude, and radius. Add OpenSky client credentials if needed. The backend has no location defaults and validates these values at startup.

Then start the backend:

```powershell
uvicorn app.main:app --reload
```

The backend permits browser requests from the local Vite origins `http://localhost:5173` and `http://127.0.0.1:5173`.

## Install and run the frontend

In a second PowerShell window:

```powershell
cd C:\DeskPlane\frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Vite prints the local URL; with the provided command it is `http://127.0.0.1:5173`. The frontend API base URL is configured in `frontend\.env.local` as `VITE_API_BASE_URL=http://127.0.0.1:8000`. This local settings file is Git-ignored. Do not put credentials in frontend configuration.

## Verification

Run backend tests from `C:\DeskPlane\deskplane`:

```powershell
pytest
```

Run frontend tests from `C:\DeskPlane\frontend`:

```powershell
npm test
```

Create an optimized local build with:

```powershell
npm run build
```

The dashboard header checks `GET /health`. Aircraft and the source timestamp come from `GET /api/aircraft`; it does not generate substitute aircraft data. Provider/API errors and backend connection failures are shown in the dashboard.
