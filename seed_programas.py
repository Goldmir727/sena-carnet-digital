"""
Siembra programas de formación de prueba en programa_formacion.

Idempotente: puede ejecutarse varias veces sin duplicar
(verifica por nombre antes de insertar).

    python seed_programas.py
"""
import asyncio
from sqlalchemy import text
from core.database import AsyncSessionLocal

PROGRAMAS = [
    {
        "name": "ADSO - Análisis y Desarrollo de Software (PRUEBA)",
        "modality": "presencial",
        "duration": 24,
        "level": "Tecnólogo",
        "description": "Programa de prueba para la creación de fichas.",
    },
    {
        "name": "Contabilidad y Finanzas (PRUEBA)",
        "modality": "virtual",
        "duration": 18,
        "level": "Técnico",
        "description": "Programa de prueba para la creación de fichas.",
    },
    {
        "name": "Mecatrónica Industrial (PRUEBA)",
        "modality": "presencial",
        "duration": 30,
        "level": "Tecnólogo",
        "description": "Programa de prueba para la creación de fichas.",
    },
]


async def main():
    async with AsyncSessionLocal() as db:
        for p in PROGRAMAS:
            existe = await db.execute(
                text("SELECT 1 FROM programa_formacion WHERE name = :name;"),
                {"name": p["name"]},
            )
            if existe.first() is not None:
                print(f"Ya existe, se omite: {p['name']}")
                continue
            await db.execute(
                text("""
                    INSERT INTO programa_formacion (name, modality, duration, level, description)
                    VALUES (:name, :modality, :duration, :level, :description);
                """),
                p,
            )
            print(f"Insertado: {p['name']}")
        await db.commit()

        r = await db.execute(
            text("SELECT id, name, modality, duration, level FROM programa_formacion ORDER BY id;")
        )
        print("\n=== PROGRAMAS ===")
        for row in r.mappings().all():
            print(dict(row))


asyncio.run(main())
