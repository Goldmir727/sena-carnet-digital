import asyncio
from logging.config import fileConfig
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

from core.config import settings
from core.database import Base

import models

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _get_clean_url_and_connect_args(url: str) -> tuple[str, dict]:
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    connect_args = {}

    sslmode = params.pop("sslmode", None)
    if sslmode:
        connect_args["ssl"] = sslmode[0]

    clean_url = urlunparse(parsed._replace(query=urlencode(params, doseq=True)))
    return clean_url, connect_args


def run_migrations_offline() -> None:
    url, _ = _get_clean_url_and_connect_args(settings.DATABASE_URL)
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    url, connect_args = _get_clean_url_and_connect_args(settings.DATABASE_URL)
    connectable = create_async_engine(url, poolclass=pool.NullPool, connect_args=connect_args)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
