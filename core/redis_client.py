"""Redis para caché y datos temporales, con fallback en memoria.

Si REDIS_URL no está configurado o Redis cae, todo sigue funcionando
con un store en memoria (útil en desarrollo / sin infraestructura).
"""
import json
import time
import asyncio
from typing import Any
from core.config import settings
from core.logger import logger

_client = None
_client_lock = asyncio.Lock()
_redis_available: bool | None = None

# Fallback en memoria: {key: (value_json, expire_ts|None)}
_mem_store: dict[str, tuple[str, float | None]] = {}
_mem_lock = asyncio.Lock()


def _now() -> float:
    return time.time()


async def _mem_get(key: str) -> str | None:
    async with _mem_lock:
        item = _mem_store.get(key)
        if not item:
            return None
        val, exp = item
        if exp is not None and _now() > exp:
            _mem_store.pop(key, None)
            return None
        return val


async def _mem_set(key: str, value: str, ex: int | None = None) -> None:
    async with _mem_lock:
        _mem_store[key] = (value, (_now() + ex) if ex else None)


async def _mem_delete(*keys: str) -> int:
    n = 0
    async with _mem_lock:
        for k in keys:
            if k in _mem_store:
                del _mem_store[k]
                n += 1
        # soporte de prefijo "pref:*"
        for k in list(_mem_store.keys()):
            for pat in keys:
                if pat.endswith("*") and k.startswith(pat[:-1]) and k not in keys:
                    del _mem_store[k]
                    n += 1
    return n


async def get_client():
    """Retorna cliente redis.asyncio o None si no hay Redis."""
    global _client, _redis_available
    if not settings.REDIS_URL:
        return None
    if _client is not None:
        return _client
    async with _client_lock:
        if _client is not None:
            return _client
        try:
            import redis.asyncio as aioredis
            _client = aioredis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
            await _client.ping()
            _redis_available = True
            logger.info("Redis conectado para caché/datos temporales.")
        except Exception as e:
            logger.warning(f"Redis no disponible, usando memoria local: {e}")
            _client = None
            _redis_available = False
        return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        try:
            await _client.close()
        except Exception:
            pass
        _client = None


async def is_redis_up() -> bool:
    c = await get_client()
    if c is None:
        return False
    try:
        await c.ping()
        return True
    except Exception:
        return False


def _dump(value: Any) -> str:
    return json.dumps(value, default=str)


def _load(raw: str | None) -> Any:
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return raw


async def cache_get(key: str) -> Any:
    c = await get_client()
    if c is not None:
        try:
            return _load(await c.get(key))
        except Exception:
            pass
    return _load(await _mem_get(key))


async def cache_set(key: str, value: Any, ex: int | None = 60) -> None:
    raw = _dump(value)
    c = await get_client()
    if c is not None:
        try:
            await c.set(key, raw, ex=ex)
            return
        except Exception:
            pass
    await _mem_set(key, raw, ex)


async def cache_delete(*keys_or_patterns: str) -> int:
    total = 0
    c = await get_client()
    if c is not None:
        try:
            for pat in keys_or_patterns:
                if pat.endswith("*"):
                    found = [k async for k in c.scan_iter(match=pat, count=200)]
                    if found:
                        total += await c.delete(*found)
                else:
                    total += await c.delete(pat)
        except Exception:
            pass
    total += await _mem_delete(*keys_or_patterns)
    return total


async def incr_with_expire(key: str, window_seconds: int) -> int:
    """Incrementa contador con TTL. Retorna el conteo actual. Para rate-limit."""
    c = await get_client()
    if c is not None:
        try:
            pipe = c.pipeline()
            pipe.incr(key)
            pipe.expire(key, window_seconds)
            res = await pipe.execute()
            return int(res[0])
        except Exception:
            pass
    # Fallback memoria: lista de timestamps serializada
    raw = await _mem_get(key)
    now = _now()
    try:
        stamps: list[float] = json.loads(raw) if raw else []
    except Exception:
        stamps = []
    stamps = [t for t in stamps if t > now - window_seconds]
    stamps.append(now)
    await _mem_set(key, json.dumps(stamps), window_seconds)
    return len(stamps)


async def get_ttl_remaining(key: str) -> int:
    c = await get_client()
    if c is not None:
        try:
            ttl = await c.ttl(key)
            return int(ttl)
        except Exception:
            pass
    raw = await _mem_get(key)
    return 0 if raw is None else -1


async def set_flag(key: str, value: Any = "1", ex: int | None = None) -> None:
    await cache_set(key, value, ex=ex)


async def has_flag(key: str) -> bool:
    return (await cache_get(key)) is not None


async def sadd(key: str, member: str, ex: int | None = None) -> None:
    """Set distribuido (usado para QR/jti de un solo uso)."""
    c = await get_client()
    if c is not None:
        try:
            await c.sadd(key, member)
            if ex:
                await c.expire(key, ex)
            return
        except Exception:
            pass
    raw = await _mem_get(key)
    try:
        items = set(json.loads(raw)) if raw else set()
    except Exception:
        items = set()
    items.add(member)
    await _mem_set(key, json.dumps(sorted(items)), ex)


async def sismember(key: str, member: str) -> bool:
    c = await get_client()
    if c is not None:
        try:
            return bool(await c.sismember(key, member))
        except Exception:
            pass
    raw = await _mem_get(key)
    try:
        return member in (set(json.loads(raw)) if raw else set())
    except Exception:
        return False


async def cache_stats() -> dict:
    c = await get_client()
    info: dict = {"backend": "redis" if c is not None else "memory", "redis_up": False, "mem_keys": len(_mem_store)}
    if c is not None:
        try:
            await c.ping()
            info["redis_up"] = True
            info["dbsize"] = await c.dbsize()
        except Exception as e:
            info["redis_up"] = False
            info["error"] = str(e)[:200]
    return info
