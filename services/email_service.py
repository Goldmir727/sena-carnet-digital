import asyncio
import re

import mailtrap as mt

from core.config import settings
from core.logger import logger


async def send_email(
    to: str,
    subject: str,
    text_body: str = "",
    html_body: str = "",
) -> bool:
    if not settings.MAILTRAP_API_KEY:
        logger.warning(f"Mailtrap no configurado. Simulando envio a {to}: {subject}")
        _log_simulated_code(subject, text_body or html_body)
        return True

    sender_email = settings.MAILTRAP_SENDER_EMAIL
    if not sender_email:
        logger.error("MAILTRAP_SENDER_EMAIL no configurado en .env")
        return False

    try:
        kwargs = {
            "sender": mt.Address(email=sender_email, name=settings.MAILTRAP_SENDER_NAME),
            "to": [mt.Address(email=to)],
            "subject": subject,
            "text": text_body,
        }
        if html_body:
            kwargs["html"] = html_body

        mail = mt.Mail(**kwargs)
        client = mt.MailtrapClient(token=settings.MAILTRAP_API_KEY)
        response = await asyncio.to_thread(client.send, mail)

        logger.info(f"Correo enviado a {to} via Mailtrap: message_id={response}")
        return True
    except Exception as e:
        logger.error(f"Error al enviar correo via Mailtrap a {to}: {str(e)}")
        return False


def _log_simulated_code(subject: str, body: str) -> None:
    if "verificacion" in subject.lower() or "codigo" in subject.lower():
        codes = re.findall(r"\b(\d{6})\b", body)
        if codes:
            logger.info(f"  >> CODIGO SIMULADO: {codes[0]} <<")


SENA_GREEN = "#39A900"
FOOTER = (
    f'<div style="margin-top:30px;padding-top:15px;border-top:1px solid #ddd;'
    f'font-size:12px;color:#999;text-align:center;">'
    f'SENA - Servicio Nacional de Aprendizaje<br>'
    f'Sistema de Gestion de Carnets Digitales<br>'
    f'Este es un correo automatico. No responda a este mensaje.'
    f'</div>'
)

HEADER = (
    f'<div style="background-color:{SENA_GREEN};padding:20px;text-align:center;border-radius:8px 8px 0 0;">'
    f'<h1 style="color:#fff;margin:0;font-size:22px;font-family:Arial,sans-serif;">SENA</h1>'
    f'<p style="color:#e8f5e0;margin:5px 0 0;font-size:13px;font-family:Arial,sans-serif;">'
    f'Sistema de Gestion de Carnets Digitales</p>'
    f'</div>'
)


def _build_html(title: str, content: str) -> str:
    return (
        f'<div style="max-width:520px;margin:0 auto;font-family:Arial,sans-serif;'
        f'background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">'
        f'{HEADER}'
        f'<div style="padding:30px 25px;">'
        f'<h2 style="color:#333;font-size:18px;margin:0 0 15px;">{title}</h2>'
        f'{content}'
        f'</div>'
        f'{FOOTER}'
        f'</div>'
    )


async def send_verification_code(email: str, username: str, code: str) -> bool:
    subject = "Codigo de verificacion - SENA Carnet Digital"
    text_body = (
        f"Hola {username},\n\n"
        f"Tu codigo de verificacion es: {code}\n\n"
        f"Este codigo expirara en 5 minutos.\n\n"
        f"Si no solicitaste este acceso, ignora este mensaje.\n\n"
        f"SENA - Sistema de Gestion de Carnets Digitales"
    )

    code_digits = "&nbsp;".join(list(code))
    html_body = _build_html(
        title=f"Hola, {username}",
        content=(
            f'<p style="color:#555;font-size:14px;line-height:1.6;">'
            f'Has iniciado sesion en el sistema. Para completar la autenticacion, '
            f'ingresa el siguiente codigo de verificacion:</p>'
            f'<div style="background:#f5fdf2;border:2px dashed {SENA_GREEN};border-radius:8px;'
            f'padding:20px;text-align:center;margin:20px 0;">'
            f'<p style="color:#888;font-size:11px;margin:0 0 8px;text-transform:uppercase;'
            f'letter-spacing:2px;">Codigo de verificacion</p>'
            f'<p style="font-size:36px;font-weight:bold;letter-spacing:8px;'
            f'color:#333;margin:0;font-family:Courier New,monospace;">{code_digits}</p>'
            f'<p style="color:#999;font-size:11px;margin:8px 0 0;">Expira en 5 minutos</p>'
            f'</div>'
            f'<p style="color:#888;font-size:13px;line-height:1.5;">'
            f'Servicio Nacional de Aprendizaje<br>'
            f'Sistema de Gestion de Carnets Digitales</p>'
        ),
    )

    return await send_email(to=email, subject=subject, text_body=text_body, html_body=html_body)


async def send_security_alert(email: str, username: str) -> None:
    subject = "Alerta de Seguridad - SENA Carnet Digital"

    text_body = (
        f"Hola {username},\n\n"
        f"Se ha detectado actividad sospechosa en tu cuenta.\n"
        f"Tu cuenta ha sido bloqueada temporalmente por 15 minutos "
        f"debido a multiples intentos fallidos.\n\n"
        f"Si no reconoces esta actividad, contacta al administrador.\n\n"
        f"SENA - Sistema de Gestion de Carnets Digitales"
    )

    html_body = _build_html(
        title="Alerta de Seguridad",
        content=(
            f'<p style="color:#555;font-size:14px;line-height:1.6;">'
            f'Hola <strong>{username}</strong>,</p>'
            f'<div style="background:#fff3f3;border-left:4px solid #e74c3c;'
            f'padding:15px;margin:20px 0;border-radius:4px;">'
            f'<p style="color:#c0392b;font-size:14px;margin:0;">'
            f'Se ha detectado actividad sospechosa en tu cuenta. '
            f'Tu cuenta ha sido <strong>bloqueada temporalmente por 15 minutos</strong> '
            f'debido a multiples intentos fallidos de inicio de sesion.</p>'
            f'</div>'
            f'<p style="color:#888;font-size:13px;line-height:1.5;">'
            f'Si no reconoces esta actividad, contacta inmediatamente al administrador '
            f'del sistema.<br>'
            f'Servicio Nacional de Aprendizaje</p>'
        ),
    )

    await send_email(to=email, subject=subject, text_body=text_body, html_body=html_body)
