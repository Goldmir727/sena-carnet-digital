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
        return data.get("uuid")
    except (ValueError, json.JSONDecodeError, Exception):
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
