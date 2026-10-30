import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    # CRÍTICO en producción: debe venir de variable de entorno real.
    # No se usa valor por defecto útil; el entorno debe configurarlo.
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    QR_SECRET: str = os.getenv("QR_SECRET", "")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "1"))
    RESET_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "10"))
    MAX_LOGIN_ATTEMPTS: int = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
    BLOCK_DURATION_MINUTES: int = int(os.getenv("BLOCK_DURATION_MINUTES", "15"))
    RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "20"))
    RATE_LIMIT_WINDOW_SECONDS: int = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "noreply@sena.edu.co")
    VERIFICATION_CODE_EXPIRE_MINUTES: int = int(os.getenv("VERIFICATION_CODE_EXPIRE_MINUTES", "5"))
    TWO_FA_MAX_ATTEMPTS: int = int(os.getenv("TWO_FA_MAX_ATTEMPTS", "5"))
    QR_CARNET_EXPIRE_MINUTES: int = int(os.getenv("QR_CARNET_EXPIRE_MINUTES", "15"))
    QR_CLASE_EXPIRE_MINUTES: int = int(os.getenv("QR_CLASE_EXPIRE_MINUTES", "15"))
    CARNET_DURATION_DAYS: int = int(os.getenv("CARNET_DURATION_DAYS", "365"))
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads/fotos")
    # Debe ser independiente de SECRET_KEY en producción.
    # Si no está configurado, se deja explícito como vacío para que el entorno
    # lo provea; no se deriva automáticamente de SECRET_KEY.
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    CACHE_TTL_REPORTS: int = int(os.getenv("CACHE_TTL_REPORTS", "60"))
    CACHE_TTL_GRUPOS: int = int(os.getenv("CACHE_TTL_GRUPOS", "30"))
    CACHE_TTL_CARNETS: int = int(os.getenv("CACHE_TTL_CARNETS", "30"))

    def __init__(self) -> None:
        if not self.DATABASE_URL:
            raise ValueError("CRÍTICO: La variable DATABASE_URL no está configurada en el .env")

        # En producción estas claves deben venir de secretos reales.
        if not self.SECRET_KEY:
            raise ValueError("CRÍTICO: La variable SECRET_KEY no está configurada en el .env")
        if not self.QR_SECRET:
            raise ValueError("CRÍTICO: La variable QR_SECRET no está configurada en el .env")


settings = Settings()
