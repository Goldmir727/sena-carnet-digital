from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.database import get_db
from core.security import get_admin_user

from modules.auth.auth_router import router as auth_router
from modules.roles.role_router import router as role_router
from modules.users.user_router import router as user_router
from modules.carnet.carnet_router import router as carnet_router
from modules.validation.validation_router import router as validation_router
from modules.attendance.attendance_router import router as attendance_router
from modules.attendance.asistencia_router import router as asistencia_router
from modules.reports.reports_router import router as reports_router
from modules.reports.reportes_alias_router import router as reportes_alias_router
from modules.grupos.grupo_router import router as grupo_router
from modules.qr.qr_router import router as qr_router
from modules.centros.centro_router import router as centro_router
from modules.sesiones.sesion_router import router as sesion_router
from modules.programas.programa_router import router as programa_router
from modules.regionales.regional_router import router as regional_router
from modules.eventos.evento_router import router as eventos_router
from core.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("==========================================================")
    logger.info("  Sistema de Gestión de Carnets - API Inicializada")
    logger.info("  Documentación interactiva: http://127.0.0.1:8000/docs")
    logger.info("==========================================================")
    try:
        from core.redis_client import get_client
        r = await get_client()
        if r is not None:
            logger.info("  Caché Redis: ACTIVO")
        else:
            logger.info("  Caché Redis: MEMORIA LOCAL (REDIS_URL no configurado)")
    except Exception as e:
        logger.warning(f"  Redis: no disponible ({e})")
    # RF-21: vencimiento automático best-effort al arrancar
    try:
        from core.database import AsyncSessionLocal
        from modules.carnet.carnet_service import CarnetService
        async with AsyncSessionLocal() as session:
            n = await CarnetService(session).check_expired()
            if n:
                logger.info(f"Carnets vencidos automáticamente: {n}")
    except Exception as e:
        logger.warning(f"No se pudo ejecutar check_expired al arranque: {e}")
    yield
    try:
        from core.redis_client import close_client
        await close_client()
    except Exception:
        pass
    logger.info("Cerrando recursos de la API de forma segura.")


class StripApiPrefixMiddleware:
    """Acepta peticiones con prefijo /api además de las rutas raíz.

    Vercel Services entrega al servicio la ruta original de la petición. Si
    el transform request.path no se aplica, FastAPI recibe /api/auth/login
    y responde 404. Este middleware elimina el prefijo para que funcionen
    tanto /api/auth/login como /auth/login.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            path = scope.get("path", "")
            if path == "/api" or path.startswith("/api/"):
                new_path = path[4:] or "/"
                scope = dict(scope)
                scope["path"] = new_path
                scope["raw_path"] = new_path.encode("utf-8")
        await self.app(scope, receive, send)


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
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(StripApiPrefixMiddleware)


@app.get("/health", tags=["Sistema"])
async def health_check():
    from core.redis_client import cache_stats
    return {"status": "ok", "service": "carnets-api", "cache": await cache_stats()}


@app.get("/cache/stats", tags=["Sistema"])
async def cache_statistics(current_user: dict = Depends(get_admin_user)):
    from core.redis_client import cache_stats
    return await cache_stats()


@app.delete("/cache", tags=["Sistema"], status_code=200)
async def cache_clear(
    pattern: str = "*",
    current_user: dict = Depends(get_admin_user),
):
    from core.redis_client import cache_delete
    n = await cache_delete(f"*{pattern}*" if not pattern.startswith("*") else pattern)
    return {"cleared": n, "pattern": pattern}


app.include_router(auth_router)
app.include_router(role_router)
app.include_router(user_router)
app.include_router(carnet_router)
app.include_router(validation_router)
app.include_router(attendance_router)
app.include_router(asistencia_router)
app.include_router(reports_router)
app.include_router(reportes_alias_router)
app.include_router(grupo_router)
app.include_router(qr_router)
app.include_router(centro_router)
app.include_router(sesion_router)
app.include_router(programa_router)
app.include_router(regional_router)
app.include_router(eventos_router)

from core.config import settings

# La fotografía de perfil ya no se sirve por montaje estático público.
# Las lecturas de foto pasan por el endpoint autorizado GET /users/{user_id}/foto.