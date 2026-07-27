from io import BytesIO
from openpyxl import Workbook


def generar_reporte_excel(data: list[dict], sheet_name: str) -> BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name[:31]

    if not data:
        ws.append(["No hay datos"])
    else:
        headers = list(data[0].keys())
        ws.append(headers)
        for row in data:
            ws.append([str(v) if v is not None else "" for v in row.values()])

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
