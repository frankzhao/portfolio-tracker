from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import engine, Base
import models  # noqa: F401 — ensure models are registered before create_all

from routers import assets, snapshots, cashflows, transactions, dashboard, fx, categories, export

# Create tables on startup (use Alembic for production migrations)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Portfolio Tracker", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets.router,       prefix="/api")
app.include_router(snapshots.router,    prefix="/api")
app.include_router(cashflows.router,    prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(dashboard.router,    prefix="/api")
app.include_router(fx.router,           prefix="/api")
app.include_router(categories.router,   prefix="/api")
app.include_router(export.router,       prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve built frontend when present (demo / production container)
_static = Path(__file__).parent / "static"
if _static.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_static / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404)
        return FileResponse(str(_static / "index.html"))
