from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import global_exception_handler
from app.core.logging import setup_logging, logger
from app.db.mongo import db_manager
from app.routes.task_routes import router as task_router
from app.routes.auth_routes import router as auth_router
from app.routes.calendar_routes import router as calendar_router
from app.routes.goal_routes import router as goal_router
from app.routes.project_routes import router as project_router
from app.routes.note_routes import router as note_router
from app.routes.habit_routes import router as habit_router
from app.routes.focus_routes import router as focus_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Starting up application...")
    await db_manager.connect_to_storage()
    yield
    logger.info("Shutting down application...")
    await db_manager.close_storage_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
)

app.add_exception_handler(Exception, global_exception_handler)

if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


app.include_router(task_router, prefix=f"{settings.API_V1_STR}/tasks")
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth")
app.include_router(calendar_router, prefix=f"{settings.API_V1_STR}/calendar")
app.include_router(goal_router, prefix=f"{settings.API_V1_STR}/goals")
app.include_router(project_router, prefix=f"{settings.API_V1_STR}/projects")
app.include_router(note_router, prefix=f"{settings.API_V1_STR}/notes")
app.include_router(habit_router, prefix=f"{settings.API_V1_STR}/habits")
app.include_router(focus_router, prefix=f"{settings.API_V1_STR}/focus")

@app.get("/")
async def root():
    return {
        "message": "Welcome to the Planner Agent API",
        "docs": f"{settings.API_V1_STR}/docs",
        "version": settings.VERSION
    }
