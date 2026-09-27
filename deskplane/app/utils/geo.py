import math

EARTH_RADIUS_KM = 6371.0088


def haversine_distance_km(latitude1: float, longitude1: float, latitude2: float, longitude2: float) -> float:
    """Return the great-circle distance between two coordinates in kilometers."""
    lat1, lat2 = math.radians(latitude1), math.radians(latitude2)
    delta_lat = math.radians(latitude2 - latitude1)
    delta_lon = math.radians(longitude2 - longitude1)
    value = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(min(1.0, value)))


def initial_bearing(latitude1: float, longitude1: float, latitude2: float, longitude2: float) -> float:
    """Return the initial bearing from the first coordinate to the second."""
    lat1, lat2 = math.radians(latitude1), math.radians(latitude2)
    delta_lon = math.radians(longitude2 - longitude1)
    y = math.sin(delta_lon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(delta_lon)
    return (math.degrees(math.atan2(y, x)) + 360) % 360
