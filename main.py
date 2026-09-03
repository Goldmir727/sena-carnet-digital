from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from modules.auth.auth_router import router as auth_router
from modules.roles.role_router import router as role_router
from modules.users.user_router import router as user_router
from modules.carnet.carnet_router import router as carnet_router
from modules.validation.validation_router import router as validation_router
from modules.attendance.attendance_router import router as attendance_router
from modules.reports.reports_router import router as reports_router
from modules.grupos.grupo_router import router as grupo_router
from modules.qr.qr_router import router as qr_router
from modules.asistencia.asistencia_router import router as asistencia_router
from core.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("==========================================================")
    logger.info("  Sistema de Gestión de Carnets - API Inicializada")
    logger.info("  Documentación interactiva: http://127.0.0.1:8000/docs")
    logger.info("==========================================================")
    yield
    logger.info("Cerrando recursos de la API de forma segura.")


app = FastAPI(
    title="Sistema de Gestión de Carnets Digitales",
    version="4.0.0",
    description="API modular para emisión, validación y trazabilidad de carnets institucionales",
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(role_router)
app.include_router(user_router)
app.include_router(carnet_router)
app.include_router(validation_router)
app.include_router(attendance_router)
app.include_router(reports_router)
app.include_router(grupo_router)
app.include_router(qr_router)
app.include_router(asistencia_router)

import os
from core.config import settings
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")