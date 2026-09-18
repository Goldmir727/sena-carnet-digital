import time
from collections import defaultdict
from fastapi import Request, HTTPException, status


class InMemoryRateLimiter:
    """Fallback local cuando Redis no está disponible."""

    def __init__(self):
        self._attempts: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.time()
        window_start = now - window_seconds
        self._attempts[key] = [t for t in self._attempts[key] if t > window_start]
        if len(self._attempts[key]) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiadas solicitudes. Intente nuevamente en unos segundos."
            )
        self._attempts[key].append(now)

    def reset(self, key: str) -> None:
        self._attempts.pop(key, None)


rate_limiter = InMemoryRateLimiter()


async def acheck_rate_limit(key: str, max_requests: int, window_seconds: int) -> None:
    """Rate-limit distribuido con Redis + fallback en memoria."""
    try:
        from core.redis_client import incr_with_expire
        count = await incr_with_expire(f"rl:{key}", window_seconds)
        if count > max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiadas solicitudes. Intente nuevamente en unos segundos."
            )
    except HTTPException:
        raise
    except Exception:
        rate_limiter.check(key, max_requests, window_seconds)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
