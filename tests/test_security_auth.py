from main import app


def test_openapi_exposes_http_bearer_scheme():
    schema = app.openapi()
    security_schemes = schema.get("components", {}).get("securitySchemes", {})

    assert "HTTPBearer" in security_schemes
    assert security_schemes["HTTPBearer"]["type"] == "http"
    assert security_schemes["HTTPBearer"]["scheme"] == "bearer"
