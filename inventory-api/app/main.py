from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.routers import raw_materials, jewelry, orders, low_stock, insights, security, auth
from app.config import settings
from app.database import get_supabase
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")

app = FastAPI(
    title="Jewelry & Raw Material Inventory API",
    description="BOM accounting, atomic stock deductions, and role-based cost privacy system.",
    version="1.0.0"
)

# Configure CORS Origins
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]
if settings.FRONTEND_URL and settings.FRONTEND_URL not in allowed_origins:
    allowed_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if settings.ENV == "production" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# Include Routers
app.include_router(auth.router)
app.include_router(raw_materials.router)
app.include_router(jewelry.router)
app.include_router(orders.router)
app.include_router(low_stock.router)
app.include_router(insights.router)
app.include_router(security.router)

@app.get("/", tags=["Health"])
async def root_index():
    return {
        "status": "online",
        "message": "Jewelry & Raw Material Inventory API is running.",
        "health": "/health",
        "db_health": "/health/db",
        "docs": "/docs"
    }

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "env": settings.ENV}

@app.get("/health/db", tags=["Health"])
async def db_health_check():
    """Verifies backend connectivity to Supabase PostgreSQL database."""
    try:
        supabase = get_supabase()
        res = supabase.table("raw_materials").select("count", count="exact").execute()
        return {
            "status": "connected",
            "database": "supabase_postgresql",
            "raw_materials_count": res.count if hasattr(res, "count") else len(res.data or [])
        }
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": str(e)}
        )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred.", "error": str(exc)}
    )
