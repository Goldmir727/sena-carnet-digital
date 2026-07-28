"""
Test de envio de correo electronico con Mailtrap.

Requisito previo:
    Agrega al .env:
        MAILTRAP_API_KEY=tu_api_key
        MAILTRAP_SENDER_EMAIL=hello@demomailtrap.co
        MAILTRAP_SENDER_NAME=Sistema de Gestion de Carnets

    IMPORTANTE: Con el dominio demo (demomailtrap.co) solo puedes
    enviar correos a tu propio email de Mailtrap.
    Para enviar a cualquier destinatario necesitas un dominio verificado.

Uso:
    python test_email.py                     # test con admin@test.com
    python test_email.py TU_CORREO@gmail.com # test con tu correo real
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
    print("  TEST DE ENVIO DE CORREO (Mailtrap)")
    print(SEP)

    configured = bool(settings.MAILTRAP_API_KEY and settings.MAILTRAP_SENDER_EMAIL)

    print(f"\n  Configuracion Mailtrap:")
    if settings.MAILTRAP_API_KEY:
        print(f"    API_KEY:      ***{settings.MAILTRAP_API_KEY[-4:]}")
    else:
        print(f"    API_KEY:      (vacio)")
    print(f"    SENDER_EMAIL: {settings.MAILTRAP_SENDER_EMAIL or '(vacio)'}")
    print(f"    SENDER_NAME:  {settings.MAILTRAP_SENDER_NAME}")
    print(f"    Destinatario: {to_email}")

    if not configured:
        print(f"\n  {SEP}")
        print("  MAILTRAP NO CONFIGURADO - MODO SIMULACION")
        print(f"  {SEP}")
        print(f"\n  Para enviar correos reales:")
        print(f"    1. Crea cuenta en https://mailtrap.io")
        print(f"    2. Ve a Settings -> API Tokens, copia tu API Key")
        print(f"    3. Agrega al .env:")
        print(f"         MAILTRAP_API_KEY=tu_api_key")
        print(f"         MAILTRAP_SENDER_EMAIL=hello@demomailtrap.co")
        print(f"    4. Reinicia el servidor")
        print(f"\n  Mientras, el envio se SIMULA en logs.")
        print()

        result = await send_verification_code(to_email, "Usuario", "482917")
        if result:
            print(ok("Simulacion OK. El codigo aparece en los logs del servidor."))
        else:
            print(fail("Fallo la simulacion"))

    else:
        print(f"\n{SEP}")
        print("  MAILTRAP CONFIGURADO - enviando correos...")
        print(SEP)

        print(f"\n  1. Codigo de verificacion a: {to_email}")
        result = await send_verification_code(to_email, "Usuario", "482917")
        if result:
            print(ok("Enviado. Revisa tu bandeja de entrada (y spam)."))
        else:
            print(fail(f"No se pudo enviar a {to_email}"))
            print(info("Si ves 'Demo domains can only be used...' significa que"))
            print(info("necesitas usar tu propio email como destinatario:"))
            print(f"       python test_email.py TU_CORREO@gmail.com")
            print(info("O verifica un dominio propio en Mailtrap para enviar a cualquiera."))

        print(f"\n  2. Alerta de seguridad...")
        await send_security_alert(to_email, "Usuario")
        print(ok("Procesado (verifica en dashboard Mailtrap)."))

        print(f"\n  3. Correo simple...")
        result = await send_email(to_email, "Correo de prueba",
                                  "Este es un mensaje de prueba desde Mailtrap API.")
        if result:
            print(ok("Procesado."))
        else:
            print(fail("Fallo."))

        print(f"\n  Dashboard: https://mailtrap.io/email-log")

    print(f"\n{SEP}")
    print()


if __name__ == "__main__":
    to = sys.argv[1] if len(sys.argv) > 1 else "admin@test.com"
    asyncio.run(test_email(to))
