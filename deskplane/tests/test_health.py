from fastapi.testclient import TestClient

from app.main import app


def test_root_and_health():
    client = TestClient(app)
    assert client.get("/").json() == {"name": "DeskPlane", "status": "online"}
    assert client.get("/health").json() == {"status": "ok"}
