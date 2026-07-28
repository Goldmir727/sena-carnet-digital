import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "fallback_secret_key_por_defecto")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    RESET_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "10"))
    MAX_LOGIN_ATTEMPTS: int = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
    BLOCK_DURATION_MINUTES: int = int(os.getenv("BLOCK_DURATION_MINUTES", "15"))
    RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "20"))
    RATE_LIMIT_WINDOW_SECONDS: int = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
    MAILTRAP_API_KEY: str = os.getenv("MAILTRAP_API_KEY", "")
    MAILTRAP_SENDER_EMAIL: str = os.getenv("MAILTRAP_SENDER_EMAIL", "")
    MAILTRAP_SENDER_NAME: str = os.getenv("MAILTRAP_SENDER_NAME", "Sistema de Gestion de Carnets")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    MAILTRAP_API_KEY: str = os.getenv("MAILTRAP_API_KEY", os.getenv("MAILTRAP_TOKEN", ""))
    MAILTRAP_TOKEN: str = MAILTRAP_API_KEY
    MAILTRAP_SENDER_EMAIL: str = os.getenv("MAILTRAP_SENDER_EMAIL", os.getenv("SMTP_FROM", ""))
    MAILTRAP_SENDER_NAME: str = os.getenv("MAILTRAP_SENDER_NAME", "Sistema de Gestión de Carnets")
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "noreply@institucion.edu")
    VERIFICATION_CODE_EXPIRE_MINUTES: int = int(os.getenv("VERIFICATION_CODE_EXPIRE_MINUTES", "5"))
    TWO_FA_MAX_ATTEMPTS: int = int(os.getenv("TWO_FA_MAX_ATTEMPTS", "5"))
    CARNET_DURATION_DAYS: int = int(os.getenv("CARNET_DURATION_DAYS", "365"))
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads/fotos")
    QR_SECRET: str = os.getenv("QR_SECRET", SECRET_KEY)

    def __init__(self) -> None:
        if not self.DATABASE_URL:
            raise ValueError("CRÍTICO: La variable DATABASE_URL no está configurada en el .env")


settings = Settings()
