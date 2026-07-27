from fastapi import HTTPException, status


class NotFoundError(HTTPException):
    def __init__(self, detail: str = "Recurso no encontrado"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class DuplicateError(HTTPException):
    def __init__(self, detail: str = "El recurso ya existe"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class ForbiddenError(HTTPException):
    def __init__(self, detail: str = "Acceso denegado"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class UnauthorizedError(HTTPException):
    def __init__(self, detail: str = "No autenticado"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class AccountBlockedError(HTTPException):
    def __init__(self, detail: str = "Cuenta bloqueada temporalmente por intentos fallidos"):
        super().__init__(status_code=status.HTTP_423_LOCKED, detail=detail)


class InvalidStateTransitionError(HTTPException):
    def __init__(self, detail: str = "Transición de estado no válida"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
