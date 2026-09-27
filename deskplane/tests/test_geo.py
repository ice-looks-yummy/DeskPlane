import pytest

from app.utils.geo import haversine_distance_km, initial_bearing


def test_haversine_zero_and_known_distance():
    assert haversine_distance_km(0, 0, 0, 0) == 0
    assert haversine_distance_km(0, 0, 0, 1) == pytest.approx(111.195, rel=0.001)


def test_initial_bearing():
    assert initial_bearing(0, 0, 1, 0) == pytest.approx(0)
    assert initial_bearing(0, 0, 0, 1) == pytest.approx(90)
