from fastapi import APIRouter, Depends, status, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user, get_admin_user
from core.config import settings
from modules.users.user_schema import UserCreate, UserUpdate, UserResponse
from modules.users.user_service import UserService
import os
import shutil

router = APIRouter(prefix="/users", tags=["Usuarios"])


@router.get("/", response_model=list[UserResponse], status_code=status.HTTP_200_OK)
async def read_users(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = UserService(db)
    return await service.get_all_users()


@router.get("/search", response_model=list[UserResponse], status_code=status.HTTP_200_OK)
async def search_users(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = UserService(db)
    return await service.search_users(q)


@router.get("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def read_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    service = UserService(db)
    return await service.get_user_by_id(user_id)


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def add_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = UserService(db)
    return await service.create_user(user_in)


@router.put("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def update_existing_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    service = UserService(db)
    return await service.update_user(user_id, user_data, current_user)


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
async def deactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    service = UserService(db)
    return await service.soft_delete_user(user_id)


@router.post("/{user_id}/foto", status_code=status.HTTP_200_OK)
async def upload_foto(
    user_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_admin_user)
):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"user_{user_id}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    service = UserService(db)
    return await service.update_foto(user_id, filepath)
