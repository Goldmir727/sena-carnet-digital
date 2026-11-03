from pydantic import BaseModel, Field


class QRCarnetResponse(BaseModel):
    qr_token: str
    expires_at: str
    qr_image_url: str


class QRClaseRequest(BaseModel):
    grupo_id: int = Field(gt=0)


class QRClaseResponse(BaseModel):
    sesion_id: int
    qr_token: str
    expires_at: str
    grupo: str
    docente: str
