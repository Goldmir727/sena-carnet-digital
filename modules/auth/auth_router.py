from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.rate_limit import rate_limiter, get_client_ip
from core.config import settings
from modules.auth.auth_service import AuthService
from modules.auth.auth_schema import RefreshRequest, ForgotPasswordRequest, PasswordResetRequest

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", status_code=status.HTTP_200_OK)
async def sign_in(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    client_ip = get_client_ip(request)
    rate_limiter.check(f"login:{client_ip}", settings.RATE_LIMIT_REQUESTS, settings.RATE_LIMIT_WINDOW_SECONDS)

    service = AuthService(db)
    return await service.login(form_data.username, form_data.password, request)


@router.post("/refresh", status_code=status.HTTP_200_OK)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.refresh(body.refresh_token)


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(body: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    client_ip = get_client_ip(request)
    rate_limiter.check(f"forgot:{client_ip}", 3, 300)
    service = AuthService(db)
    return await service.forgot_password(body.email)


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(body: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.reset_password(body.token, body.new_password)
