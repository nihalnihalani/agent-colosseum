import os

def get_cors_origins():
    origins = os.getenv("CORS_ALLOW_ORIGINS", "")
    allowed_origins = [origin.strip() for origin in origins.split(",") if origin.strip()] or ["https://skinnova.beauty", "https://www.skinnova.beauty"]
    return allowed_origins