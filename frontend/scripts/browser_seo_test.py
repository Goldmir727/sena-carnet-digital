"""Pruebas opcionales con Playwright y Chrome instalado; ejecutar tras el build.

Arrancar `npm run preview -- --host 127.0.0.1 --port 4173` antes de ejecutar.
No se usan credenciales ni se envían datos al backend de producción.
"""

import base64
import json
import os
from pathlib import Path
import tempfile
import time
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("SEO_TEST_URL", "http://127.0.0.1:4173")
ARTIFACTS = Path(os.environ.get("SEO_ARTIFACTS", Path(tempfile.gettempdir()) / "opencode" / "seo-browser"))
ARTIFACTS.mkdir(parents=True, exist_ok=True)


def metadata(page, canonical=None):
    assert page.locator("h1").count() == 1
    assert page.locator('meta[name="description"]').get_attribute("content")
    if canonical:
        assert page.locator('link[rel="canonical"]').get_attribute("href") == canonical
        assert page.locator('meta[name="robots"]').get_attribute("content") == "index, follow"
    else:
        assert page.locator('link[rel="canonical"]').count() == 0
        assert "noindex" in page.locator('meta[name="robots"]').get_attribute("content")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome", headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    # Cualquier llamada accidental al backend real falla cerrada durante la prueba.
    context.route("https://api.carnetisena.com/**", lambda route: route.abort())
    page = context.new_page()
    errors = []
    requests = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: requests.append(request.url))

    for path in ("/", "/guia"):
        response = page.goto(BASE_URL + path)
        page.wait_for_load_state("networkidle")
        assert response.status == 200
        metadata(page, "https://carnetisena.com" + path)
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
    page.get_by_text("¿Cómo consigo una cuenta?", exact=True).click()
    assert page.get_by_text("Las cuentas las gestiona la coordinación.", exact=False).is_visible()
    assert not any("PrivateApp-" in url or "api.carnetisena.com" in url for url in requests)
    assert not errors, errors

    response = page.goto(BASE_URL + "/login")
    page.wait_for_load_state("networkidle")
    assert response.headers["x-robots-tag"] == "noindex, follow"
    assert page.get_by_role("heading", name="Iniciar sesión").is_visible()
    metadata(page)
    page.get_by_role("link", name="Volver a la presentación de CarnetiSENA").filter(visible=True).click()
    page.wait_for_url(BASE_URL + "/")
    metadata(page, "https://carnetisena.com/")

    page.goto(BASE_URL + "/panel")
    page.wait_for_url(BASE_URL + "/login")
    page.get_by_role("heading", name="Iniciar sesión").wait_for()
    metadata(page)

    # Login y 2FA simulados: valida el cambio de destino a /panel sin cuentas reales.
    payload = {"user_id": 999999, "sub": "seo-prueba", "role_id": 3, "exp": int(time.time()) + 3600}
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    fake_token = f"e30.{encoded}.firma-de-prueba"

    def mock_api(route):
        headers = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"}
        path = urlparse(route.request.url).path
        if route.request.method == "OPTIONS":
            route.fulfill(status=204, headers={**headers, "Access-Control-Allow-Methods": "GET, POST, OPTIONS"})
        elif path == "/auth/login":
            route.fulfill(json={"preauth_token": "solo-prueba", "email_masked": "p***@example.invalid"}, headers=headers)
        elif path == "/auth/verify-2fa":
            route.fulfill(json={"access_token": fake_token, "refresh_token": "solo-prueba"}, headers=headers)
        else:
            route.fulfill(status=404, json={"detail": "Sin datos en esta prueba"}, headers=headers)

    context.unroute("https://api.carnetisena.com/**")
    context.route("https://api.carnetisena.com/**", mock_api)
    page.get_by_label("Usuario", exact=True).fill("seo-prueba")
    page.get_by_label("Contraseña", exact=True).fill("solo-para-pruebas")
    page.get_by_role("button", name="Continuar", exact=True).click()
    page.get_by_role("heading", name="Verificación en dos pasos").wait_for()
    page.get_by_label("Código de verificación", exact=True).fill("000000")
    page.get_by_role("button", name="Verificar y entrar", exact=True).click()
    page.wait_for_url(BASE_URL + "/panel")
    page.get_by_role("heading", name="Hola, seo-prueba.").wait_for()
    metadata(page)
    assert page.get_by_role("link", name="Inicio", exact=True).first.get_attribute("href") == "/panel"
    page.get_by_role("button", name="Cerrar sesión").click()
    page.wait_for_url(BASE_URL + "/login")

    response = page.goto(BASE_URL + "/no-existe-esta-pagina")
    assert response.status == 404
    assert page.get_by_role("heading", name="Página no encontrada").is_visible()
    metadata(page)

    for width in (360, 375, 768):
        page.set_viewport_size({"width": width, "height": 900})
        for path in ("/", "/guia"):
            page.goto(BASE_URL + path)
            page.wait_for_load_state("networkidle")
            assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (width, path)
            assert page.get_by_role("link", name="Iniciar sesión", exact=True).first.is_visible()
        if width == 375:
            page.goto(BASE_URL + "/")
            page.wait_for_load_state("networkidle")
            page.screenshot(path=str(ARTIFACTS / "portada-movil.png"), full_page=True)

    # Los buscadores y visitantes sin JS reciben el mismo contenido público.
    no_js = browser.new_context(java_script_enabled=False)
    static_page = no_js.new_page()
    for path in ("/", "/guia"):
        response = static_page.goto(BASE_URL + path)
        assert response.status == 200
        metadata(static_page, "https://carnetisena.com" + path)
        assert static_page.get_by_role("link", name="Iniciar sesión", exact=True).first.is_visible()
    no_js.close()
    assert not errors, errors
    context.close()
    browser.close()
    print("OK: SEO público, login/2FA simulado, acceso privado, 404, sin JS y reflow a 360/375/768 px.")
    print("Capturas:", ARTIFACTS)
