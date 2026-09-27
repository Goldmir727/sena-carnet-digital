from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image
from services.qr_service import generate_qr_image


def _txt(value) -> str:
    """Valor neutro para datos faltantes sin romper la generación."""
    text = "" if value is None else str(value).strip()
    return text if text else "—"


def _fit(c, text: str, max_width: float, font: str, size: float) -> str:
    """Recorta con elipsis si el texto excede el ancho disponible."""
    text = _txt(text)
    if c.stringWidth(text, font, size) <= max_width:
        return text
    while text and c.stringWidth(text + "…", font, size) > max_width:
        text = text[:-1]
    return (text + "…") if text else "—"


def _fmt_fecha(value) -> str:
    if not value:
        return "—"
    text = str(value).strip()
    parts = text.split("-")
    if len(parts) == 3 and len(parts[0]) == 4:
        return f"{parts[2]}/{parts[1]}/{parts[0]}"
    return text


def generar_carnet_pdf(user: dict, carnet: dict, qr_token: str) -> BytesIO:
    """
    Carnet institucional tamaño tarjeta CR80 (85.6 x 53.98 mm, horizontal),
    fondo blanco orientado a impresión: foto, datos, tipo de sangre,
    centro de formación, vigencia/estado y QR del sistema.
    """
    buffer = BytesIO()
    PAGE_W = 85.6 * mm
    PAGE_H = 53.98 * mm
    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))

    GREEN = HexColor("#0F7A4D")
    GREEN_DARK = HexColor("#0A5A39")
    YELLOW = HexColor("#F2B43A")
    INK = HexColor("#17212B")
    MUTED = HexColor("#8A99A6")
    BORDER = HexColor("#CDE8DA")

    # Fondo blanco.
    c.setFillColor(HexColor("#FFFFFF"))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Banda institucional superior.
    band_h = 11 * mm
    band_y = PAGE_H - band_h
    c.setFillColor(GREEN)
    c.rect(0, band_y, PAGE_W, band_h, fill=1, stroke=0)
    c.setFillColor(GREEN_DARK)
    c.rect(0, PAGE_H - 2 * mm, PAGE_W, 2 * mm, fill=1, stroke=0)
    c.setFillColor(YELLOW)
    c.rect(0, band_y, PAGE_W, 0.8 * mm, fill=1, stroke=0)

    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(4 * mm, band_y + 4.6 * mm, "SENA")
    c.setFont("Helvetica", 5)
    c.drawString(4 * mm, band_y + 1.9 * mm, "Servicio Nacional de Aprendizaje")
    estado = _txt(carnet.get("estado") or user.get("estado")).upper()
    c.setFont("Helvetica-Bold", 5.5)
    c.drawRightString(PAGE_W - 4 * mm, band_y + 4.6 * mm, "CARNET INSTITUCIONAL")
    c.setFont("Helvetica-Bold", 5)
    c.drawRightString(PAGE_W - 4 * mm, band_y + 1.9 * mm, f"ESTADO: {estado}")

    # Fotografía.
    foto_x, foto_y, foto_w, foto_h = 4 * mm, 6 * mm, 15 * mm, 19 * mm
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.rect(foto_x, foto_y, foto_w, foto_h, fill=0, stroke=1)
    foto = (user.get("foto_perfil") or "").replace("\\", "/")
    if foto and foto != "—":
        try:
            with Image.open(foto) as photo:
                photo.load()
                c.drawImage(
                    ImageReader(photo.convert("RGB")),
                    foto_x + 0.6 * mm, foto_y + 0.6 * mm,
                    width=foto_w - 1.2 * mm, height=foto_h - 1.2 * mm,
                    preserveAspectRatio=True,
                    anchor="c",
                )
        except Exception:
            pass

    # Datos del titular.
    dx = 21.5 * mm
    dw = 35 * mm
    nombre = f"{_txt(user.get('nombres'))} {_txt(user.get('apellidos'))}".strip()
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(dx, 37 * mm, _fit(c, nombre, dw, "Helvetica-Bold", 7.5))
    c.setFillColor(YELLOW)
    c.rect(dx, 36 * mm, 12 * mm, 0.5 * mm, fill=1, stroke=0)

    c.setFont("Helvetica", 5.5)
    y = 32.5 * mm
    filas = [
        f"{_txt(user.get('tipo_documento'))} {_txt(user.get('numero_documento'))}",
        f"Sangre: {_txt(user.get('tipo_sangre'))}",
        f"Vigente hasta: {_fmt_fecha(carnet.get('fecha_vencimiento'))}",
    ]
    for fila in filas:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 5.5)
        c.drawString(dx, y, _fit(c, fila, dw, "Helvetica", 5.5))
        y -= 3.4 * mm
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 5)
    centro = _txt(user.get("centro_nombre"))
    c.drawString(dx, y + 0.4 * mm, _fit(c, centro, dw, "Helvetica", 5))

    # QR del sistema.
    qr_x, qr_y, qr_s = 60 * mm, 6.5 * mm, 19 * mm
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.rect(qr_x, qr_y, qr_s, qr_s, fill=0, stroke=1)
    try:
        qr_img = generate_qr_image(qr_token)
        c.drawImage(
            ImageReader(qr_img),
            qr_x + 1 * mm, qr_y + 1 * mm,
            width=qr_s - 2 * mm, height=qr_s - 2 * mm,
        )
    except Exception:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 4.5)
        c.drawCentredString(qr_x + qr_s / 2, qr_y + qr_s / 2, "QR no disponible")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 4)
    c.drawCentredString(qr_x + qr_s / 2, qr_y - 2.2 * mm, "Escanea para validar")

    # Pie con código único.
    c.setFillColor(MUTED)
    c.setFont("Courier", 4)
    c.drawString(4 * mm, 2.6 * mm, _fit(c, f"UUID: {_txt(carnet.get('uuid'))}", 52 * mm, "Courier", 4))

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def generar_reporte_pdf(data: list[dict], titulo: str) -> BytesIO:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(20*mm, height - 20*mm, titulo)

    c.setFont("Helvetica", 9)
    y = height - 35*mm
    for item in data:
        if y < 20*mm:
            c.showPage()
            c.setFont("Helvetica", 9)
            y = height - 20*mm
        line = " | ".join(str(v) for v in item.values())
        c.drawString(15*mm, y, line[:120])
        y -= 5*mm

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
