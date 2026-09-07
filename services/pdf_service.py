from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image
from services.qr_service import generate_qr_image


def generar_carnet_pdf(user: dict, carnet: dict, qr_token: str) -> BytesIO:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    c.setStrokeColor(HexColor("#1a365d"))
    c.setLineWidth(2)
    c.rect(20*mm, height - 55*mm, 170*mm, 45*mm)

    c.setFillColor(HexColor("#1a365d"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(25*mm, height - 30*mm, "CARNET INSTITUCIONAL")

    c.setFillColor(HexColor("#000000"))
    c.setFont("Helvetica", 10)
    y = height - 45*mm
    c.drawString(25*mm, y, f"Nombre: {user.get('nombres', '')} {user.get('apellidos', '')}")
    c.drawString(25*mm, y - 5*mm, f"Documento: {user.get('tipo_documento', '')} {user.get('numero_documento', '')}")
    c.drawString(25*mm, y - 10*mm, f"Email: {user.get('email', '')}")
    c.drawString(25*mm, y - 15*mm, f"UUID: {carnet.get('uuid', '')}")
    c.drawString(25*mm, y - 20*mm, f"Válido hasta: {carnet.get('fecha_vencimiento', '')}")

    qr_img = generate_qr_image(qr_token)
    c.drawImage(ImageReader(qr_img), 140*mm, y - 25*mm, width=25*mm, height=25*mm)

    foto = (user.get('foto_perfil') or '').replace("\\", "/")
    if foto:
        try:
            with Image.open(foto) as photo:
                photo.load()
                c.drawImage(
                    ImageReader(photo.convert("RGB")),
                    112*mm, y - 25*mm,
                    width=22*mm, height=25*mm,
                    preserveAspectRatio=True,
                    anchor='c',
                )
            c.setStrokeColor(HexColor("#cbd5e1"))
            c.setLineWidth(0.75)
            c.rect(112*mm, y - 25*mm, 22*mm, 25*mm)
        except Exception:
            pass

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
