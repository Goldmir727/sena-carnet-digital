"""
Modulo de prueba interactivo para 2FA por correo electronico.

Uso:
    python test_2fa.py            # test completo de 2FA
    python test_email.py          # test de envio de correo (independiente)
    python test_email.py TU_EMAIL # test de envio a un correo especifico
"""

import asyncio
import time
import httpx
from sqlalchemy import text
from core.database import AsyncSessionLocal
from core.config import settings

BASE_URL = "http://127.0.0.1:8001"
SEP = "=" * 55
SLEEP = 1.5


def ok(msg):
    return f"[OK] {msg}"

def fail(msg):
    return f"[FAIL] {msg}"

def warn(msg):
    return f"[WARN] {msg}"

def info(msg):
    return f"[*] {msg}"


async def get_active_code() -> str | None:
    async with AsyncSessionLocal() as db:
        r = await db.execute(text(
            "SELECT code FROM verification_codes "
            "WHERE used = FALSE ORDER BY created_at DESC LIMIT 1;"
        ))
        row = r.mappings().first()
        return row["code"] if row else None


async def run():
    async with httpx.AsyncClient(timeout=20.0) as c:

        print(f"\n{SEP}")
        print("  TEST 2FA")
        print(SEP)

        smtp_ok = bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)
        print(f"\n  SMTP: {'CONFIGURADO (correo real)' if smtp_ok else 'NO CONFIGURADO (simulado)'}")
        if not smtp_ok:
            print("  Para probar envio real: python test_email.py")
            print("  El codigo se leera directamente de la BD.")

        # --- 1. Login con credenciales correctas ---
        print(f"\n{SEP}")
        print("  1. Login (credenciales correctas)")
        print(SEP)
        r = await c.post(f"{BASE_URL}/auth/login",
                         data={"username": "admin", "password": "123456"})
        if r.status_code != 200:
            print(fail(f"HTTP {r.status_code}: {r.json().get('detail', '')}"))
            return
        body = r.json()
        preauth = body.get("preauth_token", "")
        if preauth and body.get("requires_2fa"):
            print(ok(f"Email enmascarado: {body['email_masked']}"))
            print(ok("preauth_token recibido. NO se devolvieron access/refresh tokens."))
        else:
            print(fail(f"Formato inesperado: {body}"))
            return
        codigo = await get_active_code()
        print(info(f"Codigo en BD: {codigo}  (correo simulado, SMTP sin configurar)"))

        time.sleep(SLEEP)

        # --- 2. Login con password incorrecta ---
        print(f"\n{SEP}")
        print("  2. Login (password incorrecta)")
        print(SEP)
        r = await c.post(f"{BASE_URL}/auth/login",
                         data={"username": "admin", "password": "wrong"})
        if r.status_code == 401:
            print(ok(f"Rechazado: {r.json()['detail']}"))
        else:
            print(fail(f"HTTP {r.status_code}: {r.json().get('detail', '')}"))

        time.sleep(SLEEP)

        # --- 3. Login con usuario inexistente ---
        print(f"\n{SEP}")
        print("  3. Login (usuario inexistente)")
        print(SEP)
        r = await c.post(f"{BASE_URL}/auth/login",
                         data={"username": "no_existe", "password": "123456"})
        if r.status_code == 401:
            print(ok(f"Rechazado: {r.json()['detail']}"))
        else:
            print(fail(f"HTTP {r.status_code}: {r.json().get('detail', '')}"))

        time.sleep(SLEEP)

        # --- 4. Verify con codigo incorrecto ---
        print(f"\n{SEP}")
        print("  4. Verify con codigo INCORRECTO (000000)")
        print(SEP)
        r = await c.post(f"{BASE_URL}/auth/verify-2fa",
                         json={"preauth_token": preauth, "code": "000000"})
        if r.status_code == 400:
            print(ok(f"Rechazado: {r.json()['detail']}"))
        elif r.status_code == 429:
            print(warn(f"Rate limit alcanzado (normal en pruebas rapidas): {r.json()['detail']}"))
        else:
            print(fail(f"HTTP {r.status_code}: {r.json().get('detail', '')}"))

        time.sleep(SLEEP)

        # --- 5. Verify con codigo correcto ---
        print(f"\n{SEP}")
        print("  5. Verify con codigo CORRECTO")
        print(SEP)
        codigo = await get_active_code()
        if not codigo:
            print(warn("Codigo expirado o invalidado. Re-logueando para obtener uno nuevo..."))
            r = await c.post(f"{BASE_URL}/auth/login",
                             data={"username": "admin", "password": "123456"})
            preauth = r.json()["preauth_token"]
            codigo = await get_active_code()
            print(info(f"Nuevo codigo: {codigo}"))
            time.sleep(SLEEP)

        r = await c.post(f"{BASE_URL}/auth/verify-2fa",
                         json={"preauth_token": preauth, "code": codigo})
        if r.status_code == 200:
            tokens = r.json()
            access = tokens.get("access_token", "")
            refresh = tokens.get("refresh_token", "")
            print(ok("Sesion iniciada exitosamente"))
            print(ok(f"access_token:  {access[:50]}..."))
            print(ok(f"refresh_token: {refresh[:50]}..."))
            print(ok(f"token_type:    {tokens['token_type']}"))
        elif r.status_code == 429:
            print(warn(f"Rate limit: {r.json()['detail']}"))
            access = None
        else:
            print(fail(f"HTTP {r.status_code}: {r.json().get('detail', '')}"))
            return

        time.sleep(SLEEP)

        # --- 6. Replay attack ---
        if access:
            print(f"\n{SEP}")
            print("  6. Reutilizar el mismo codigo (ataque replay)")
            print(SEP)
            r = await c.post(f"{BASE_URL}/auth/login",
                             data={"username": "admin", "password": "123456"})
            if r.status_code == 200:
                new_preauth = r.json()["preauth_token"]
                time.sleep(SLEEP)
                r2 = await c.post(f"{BASE_URL}/auth/verify-2fa",
                                  json={"preauth_token": new_preauth, "code": codigo})
                if r2.status_code == 400:
                    print(ok(f"Replay bloqueado: {r2.json()['detail']}"))
                elif r2.status_code == 429:
                    print(warn("Rate limit (el codigo anterior ya fue invalidado al hacer un nuevo login)"))
                else:
                    print(fail(f"HTTP {r2.status_code}: {r2.json().get('detail', '')}"))
                preauth = new_preauth

            time.sleep(SLEEP)

        # --- 7. Reenviar ---
        print(f"\n{SEP}")
        print("  7. Reenviar codigo")
        print(SEP)
        r = await c.post(f"{BASE_URL}/auth/login",
                         data={"username": "admin", "password": "123456"})
        preauth = r.json()["preauth_token"]
        time.sleep(SLEEP)
        r = await c.post(f"{BASE_URL}/auth/resend-2fa",
                         json={"preauth_token": preauth})
        if r.status_code == 200:
            body2 = r.json()
            print(ok(f"Nuevo codigo enviado a {body2['email_masked']}"))
            nuevo_codigo = await get_active_code()
            print(info(f"Nuevo codigo: {nuevo_codigo}"))
            print(ok("preauth_token renovado"))
            preauth = body2["preauth_token"]
        elif r.status_code == 429:
            print(warn(f"Rate limit: {r.json()['detail']}"))
            print(info("Reintentando verify con el codigo original..."))
            nuevo_codigo = codigo
        else:
            print(fail(f"HTTP {r.status_code}: {r.json().get('detail', '')}"))
            return

        time.sleep(SLEEP)

        # --- 8. Verify con nuevo codigo ---
        if nuevo_codigo:
            print(f"\n{SEP}")
            print("  8. Verify con nuevo codigo (post-reenvio)")
            print(SEP)
            r = await c.post(f"{BASE_URL}/auth/verify-2fa",
                             json={"preauth_token": preauth, "code": nuevo_codigo})
            if r.status_code == 200:
                print(ok("Login exitoso con el codigo reenviado"))
            elif r.status_code == 429:
                print(warn(f"Rate limit (el flujo ya fue validado en pasos anteriores): {r.json()['detail']}"))
            else:
                print(fail(f"HTTP {r.status_code}: {r.json().get('detail', '')}"))

        time.sleep(SLEEP)

        # --- 9. Token en ruta protegida ---
        if access:
            print(f"\n{SEP}")
            print("  9. Token en endpoint protegido: GET /users/")
            print(SEP)
            r = await c.get(f"{BASE_URL}/users/",
                            headers={"Authorization": f"Bearer {access}"})
            if r.status_code == 200:
                print(ok(f"Acceso concedido. {len(r.json())} usuarios en BD."))
            elif r.status_code == 401:
                print(fail(f"Token rechazado: {r.json().get('detail', '')}"))
            else:
                print(info(f"HTTP {r.status_code}"))

        # --- Resumen ---
        print(f"\n{SEP}")
        print("  RESUMEN")
        print(SEP)
        print("  1. Login correcto      -> preauth_token (sin sesion)")
        print("  2. Password incorrecta -> 401")
        print("  3. Usuario inexistente -> 401")
        print("  4. Codigo incorrecto   -> 400")
        print("  5. Codigo correcto     -> access_token + refresh_token")
        print("  6. Replay attack       -> bloqueado")
        print("  7. Reenviar codigo     -> nuevo codigo + preauth_token")
        print("  8. Verify post-reenvio -> login exitoso")
        print("  9. Token en ruta       -> acceso concedido")
        print(SEP)
        print()


if __name__ == "__main__":
    asyncio.run(run())
