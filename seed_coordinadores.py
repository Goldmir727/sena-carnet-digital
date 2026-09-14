"""
Siembra los 5 roles del sistema y crea los usuarios coordinadores.

Idempotente: puede ejecutarse varias veces sin duplicar.
    python seed_coordinadores.py
"""
import asyncio
from datetime import datetime, timezone
from sqlalchemy import text
from core.database import AsyncSessionLocal
from core.security import hash_password

ROLES = [
    (1, "Coordinador", "Administrador del sistema, gestiona grupos, usuarios y carnets"),
    (2, "Docente", "Instructor asignado a grupos, genera QR de clase"),
    (3, "Aprendiz", "Estudiante, escanea QR de clase, tiene carnet digital"),
    (4, "Funcionario", "Trabajador de planta, tiene carnet digital, sin grupo"),
    (5, "Validador", "Guardia de acceso, escanea QR de carnets"),
]

COORDINADORES = [
    {
        "email": "yedisontapasco@gmail.com",
        "name": "Yedison",
        "last_name": "Tapasco",
        "document_type": "CC",
        "document": "1000000001",
    },
    {
        "email": "jostigrivar10@gmail.com",
        "name": "Jostin",
        "last_name": "Rivar",
        "document_type": "CC",
        "document": "1000000002",
    },
    {
        "email": "largovaleriaramirez@gmail.com",
        "name": "Valeria",
        "last_name": "Ramirez",
        "document_type": "CC",
        "document": "1000000003",
    },
]

PASSWORD = "Sena123456"
ROLE_ID_COORDINADOR = 1


async def main():
    async with AsyncSessionLocal() as db:
        for rid, name, desc in ROLES:
            await db.execute(text(
                "INSERT INTO roles (id, name, description) VALUES (:id, :name, :desc) "
                "ON CONFLICT (id) DO UPDATE SET name = :name2, description = :desc2;"
            ), {"id": rid, "name": name, "desc": desc, "name2": name, "desc2": desc})
        await db.commit()

        r = await db.execute(text("SELECT id, name FROM roles ORDER BY id;"))
        print("=== ROLES ===")
        for row in r.mappings().all():
            print(dict(row))

        password_hash = hash_password(PASSWORD)
        now = datetime.now(timezone.utc)
        print("\n=== COORDINADORES ===")
        for c in COORDINADORES:
            await db.execute(text("""
                INSERT INTO users (name, last_name, document_type, document, email,
                                   password_hash, user_status, role_id, registration_date)
                VALUES (:name, :last_name, :document_type, :document, :email,
                        :password_hash, 'ACTIVE', :role_id, :registration_date)
                ON CONFLICT (email) DO UPDATE
                    SET role_id = :role_id,
                        user_status = 'ACTIVE',
                        password_hash = :password_hash,
                        name = :name,
                        last_name = :last_name;
            """), {
                "name": c["name"],
                "last_name": c["last_name"],
                "document_type": c["document_type"],
                "document": c["document"],
                "email": c["email"],
                "password_hash": password_hash,
                "role_id": ROLE_ID_COORDINADOR,
                "registration_date": now,
            })
        await db.commit()

        u = await db.execute(text("""
            SELECT u.email, u.name, u.last_name, u.user_status, u.role_id, r.name AS rol
            FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.email = ANY(:emails);
        """), {"emails": [c["email"] for c in COORDINADORES]})
        for row in u.mappings().all():
            print(dict(row))

        print(f"\nPassword para todos: {PASSWORD}")
        print("Login con el EMAIL como usuario.")


asyncio.run(main())