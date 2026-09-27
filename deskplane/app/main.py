from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings


def create_app() -> FastAPI:
    app = FastAPI(title="DeskPlane API", description="Phase 1 live aircraft tracking backend")
    app.state.settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(router)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"name": "DeskPlane", "status": "online"}

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
