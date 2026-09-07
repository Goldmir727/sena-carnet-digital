import hashlib
import hmac
import json
import base64
import qrcode
from io import BytesIO
from core.config import settings


def generate_qr_token(user_uuid: str) -> str:
    message = json.dumps({"uuid": user_uuid, "type": "carnet"}).encode("utf-8")
    signature = hmac.new(
        settings.QR_SECRET.encode("utf-8"),
        message,
        hashlib.sha256
    ).hexdigest()
    payload = base64.urlsafe_b64encode(message).decode("utf-8")
    return f"{payload}.{signature}"


def verify_qr_token(token: str) -> str | None:
    try:
        payload_b64, signature = token.split(".", 1)
        message = base64.urlsafe_b64decode(payload_b64)
        expected_sig = hmac.new(
            settings.QR_SECRET.encode("utf-8"),
            message,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_sig):
            return None

        data = json.loads(message.decode("utf-8"))
        # Soporta tokens de carnet nuevos (user_id) y legacy (uuid),
        # y tokens de clase (grupo_id/docente_id).
        return data.get("uuid") or (
            str(data.get("user_id")) if data.get("user_id") is not None else None
        ) or (
            str(data.get("grupo_id")) if data.get("type") == "clase" else None
        )
    except (ValueError, json.JSONDecodeError, Exception):
        return None


def decode_qr_payload(token: str) -> dict | None:
    """Verifica firma HMAC y retorna el payload completo, o None si inválido."""
    try:
        payload_b64, signature = token.split(".", 1)
        message = base64.urlsafe_b64decode(payload_b64)
        expected_sig = hmac.new(
            settings.QR_SECRET.encode("utf-8"),
            message,
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
        return json.loads(message.decode("utf-8"))
    except Exception:
        return None


def generate_qr_image(token: str) -> BytesIO:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(token)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer
