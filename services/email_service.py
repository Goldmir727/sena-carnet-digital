import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from core.config import settings
from core.logger import logger


async def send_email(to: str, subject: str, body: str) -> bool:
    if not settings.SMTP_HOST:
        logger.warning(f"SMTP no configurado. Simulando envío a {to}: {subject}")
        return True

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to, msg.as_string())

        logger.info(f"Correo enviado a {to}")
        return True
    except Exception as e:
        logger.error(f"Error al enviar correo a {to}: {str(e)}")
        return False


async def send_security_alert(email: str, username: str) -> None:
    subject = "Alerta de Seguridad - Intento de Acceso Sospechoso"
    body = (
        f"Hola {username},\n\n"
        f"Se ha detectado actividad sospechosa en tu cuenta.\n"
        f"Tu cuenta ha sido bloqueada temporalmente por 15 minutos debido a múltiples intentos fallidos.\n\n"
        f"Si no reconoces esta actividad, contacta al administrador.\n\n"
        f"Saludos,\nSistema de Gestión de Carnets"
    )
    await send_email(email, subject, body)
