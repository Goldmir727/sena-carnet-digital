"""
Test de envio de correo electronico via SMTP Gmail.

Requisito previo:
    .env debe tener SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM

Uso:
    python test_email.py                     # test con admin@test.com
    python test_email.py TU_CORREO@gmail.com # test con un correo especifico
"""

import asyncio
import sys
from services.email_service import send_email, send_verification_code, send_security_alert
from core.config import settings


SEP = "=" * 60


def ok(s): return f"[OK] {s}"
def fail(s): return f"[FAIL] {s}"
def info(s): return f"[*] {s}"


async def test_email(to_email: str):
    print(f"\n{SEP}")
    print("  TEST DE ENVIO DE CORREO (SMTP)")
    print(SEP)

    configured = bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)

    print(f"\n  Configuracion SMTP:")
    print(f"    SMTP_HOST:     {settings.SMTP_HOST or '(vacio)'}")
    print(f"    SMTP_PORT:     {settings.SMTP_PORT}")
    print(f"    SMTP_USER:     {settings.SMTP_USER or '(vacio)'}")
    print(f"    SMTP_PASSWORD: {'***' if settings.SMTP_PASSWORD else '(vacio)'}")
    print(f"    SMTP_FROM:     {settings.SMTP_FROM}")
    print(f"    Destinatario:  {to_email}")

    if not configured:
        print(f"\n  {SEP}")
        print("  SMTP NO CONFIGURADO - MODO SIMULACION")
        print(f"  {SEP}")
        print(f"\n  Para enviar correos reales con Gmail:")
        print(f"    1. Activa 2FA en tu cuenta Gmail")
        print(f"    2. Ve a: https://myaccount.google.com/apppasswords")
        print(f"    3. Genera un App Password (16 caracteres)")
        print(f"    4. Agrega al .env:")
        print(f"         SMTP_USER=tu_correo@gmail.com")
        print(f"         SMTP_PASSWORD=el_app_password_generado")
        print(f"    5. Reinicia el servidor")
        print()

        result = await send_verification_code(to_email, "Usuario", "482917")
        if result:
            print(ok("Simulacion OK. El codigo aparece en los logs del servidor."))
        else:
            print(fail("Fallo la simulacion"))
    else:
        print(f"\n{SEP}")
        print("  SMTP CONFIGURADO - enviando correos reales...")
        print(SEP)

        print(f"\n  1. Codigo de verificacion a: {to_email}")
        result = await send_verification_code(to_email, "Usuario", "482917")
        if result:
            print(ok("Enviado. Revisa tu bandeja de entrada (y spam)."))
        else:
            print(fail(f"Error al enviar a {to_email}"))
            print(info("Revisa que SMTP_USER y SMTP_PASSWORD sean correctos"))
            print(info("y que estes usando un App Password de Gmail."))

        print(f"\n  2. Alerta de seguridad...")
        await send_security_alert(to_email, "Usuario")
        print(ok("Procesado."))

        print(f"\n  3. Correo simple...")
        result = await send_email(to_email, "Correo de prueba",
                                  "Este es un mensaje de prueba desde SMTP Gmail.")
        if result:
            print(ok("Enviado."))
        else:
            print(fail("Fallo."))

    print(f"\n{SEP}")
    print()


if __name__ == "__main__":
    to = sys.argv[1] if len(sys.argv) > 1 else "admin@test.com"
    asyncio.run(test_email(to))
