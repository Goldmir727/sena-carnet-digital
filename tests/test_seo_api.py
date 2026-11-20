from fastapi.testclient import TestClient

from main import app


def test_api_responses_are_not_indexable():
    # Sin lifespan: estas rutas no necesitan conexiones a PostgreSQL ni Redis.
    client = TestClient(app)
    for path in ("/docs", "/openapi.json", "/api/openapi.json", "/no-existe"):
        response = client.get(path)
        assert response.headers["x-robots-tag"] == "noindex, nofollow"


def test_protected_routes_still_require_authentication():
    response = TestClient(app).get("/users/")
    assert response.status_code in (401, 403)
    assert response.headers["x-robots-tag"] == "noindex, nofollow"


def test_api_robots_allows_reading_noindex_headers():
    client = TestClient(app)
    for path in ("/robots.txt", "/api/robots.txt"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/plain")
        assert response.text == "User-agent: *\nAllow: /\n"
        assert response.headers["x-robots-tag"] == "noindex, nofollow"


def test_unhandled_errors_are_not_indexable():
    from fastapi import FastAPI

    from core.seo import ApiNoIndexMiddleware
    from main import unhandled_exception_handler

    test_app = FastAPI()
    test_app.add_middleware(ApiNoIndexMiddleware)
    test_app.add_exception_handler(Exception, unhandled_exception_handler)

    @test_app.get("/error")
    async def error():
        raise RuntimeError("Fallo de prueba")

    response = TestClient(test_app, raise_server_exceptions=False).get("/error")
    assert response.status_code == 500
    assert response.headers["x-robots-tag"] == "noindex, nofollow"
