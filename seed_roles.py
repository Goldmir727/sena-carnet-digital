"""
Siembra los 5 roles del sistema y actualiza el usuario admin a Coordinador.
Ejecutar una sola vez: python seed_roles.py
"""
import asyncio
from sqlalchemy import text
from core.database import AsyncSessionLocal

ROLES = [
    (1, "Coordinador", "Administrador del sistema, gestiona grupos, usuarios y carnets"),
    (2, "Docente", "Instructor asignado a grupos, genera QR de clase"),
    (3, "Aprendiz", "Estudiante, escanea QR de clase, tiene carnet digital"),
    (4, "Funcionario", "Trabajador de planta, tiene carnet digital, sin grupo"),
    (5, "Validador", "Guardia de acceso, escanea QR de carnets"),
]


async def main():
    async with AsyncSessionLocal() as db:
        for rid, name, desc in ROLES:
            await db.execute(text(
                "INSERT INTO roles (id, name, description) VALUES (:id, :name, :desc) "
                "ON CONFLICT (id) DO UPDATE SET name = :name2, description = :desc2;"
            ), {"id": rid, "name": name, "desc": desc, "name2": name, "desc2": desc})
        await db.commit()

        r = await db.execute(text("SELECT id, name, description FROM roles ORDER BY id;"))
        print("=== ROLES ===")
        for row in r.mappings().all():
            print(dict(row))

        await db.execute(text(
            "UPDATE users SET role_id = 1 WHERE username = 'willi';"
        ))
        await db.commit()

        u = await db.execute(text("SELECT username, role_id FROM users WHERE username = 'willi';"))
        print("\n=== ADMIN ===")
        print(dict(u.mappings().first()))

asyncio.run(main())
