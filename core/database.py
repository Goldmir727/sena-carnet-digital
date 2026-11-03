from typing import AsyncGenerator
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from core.config import settings
from core.logger import logger


class Base(DeclarativeBase):
    pass


def _build_engine():
    parsed = urlparse(settings.DATABASE_URL)
    params = parse_qs(parsed.query)
    connect_args = {}

    sslmode = params.pop("sslmode", None)
    if sslmode:
        connect_args["ssl"] = sslmode[0]

    clean_url = urlunparse(parsed._replace(query=urlencode(params, doseq=True)))
    return create_async_engine(
        clean_url,
        echo=False,
        pool_pre_ping=True,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=settings.DB_POOL_RECYCLE,
        connect_args=connect_args,
    )


engine = _build_engine()

AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Error en la sesión de DB: {str(e)}")
            await session.rollback()
            raise e
        finally:
            await session.close()
