# Informe de seguridad P0 / P1 / P2 — Sistema de Gestión de Carnets Digitales
<!-- markdownlint-disable MD013 -->

Estado global: se revisó backend, frontend, contenedor, dependencias y configuración.
A continuación, hallazgos por nivel, con ubicación exacta y gravedad.

Para las acciones elegidas en P0 se agregaron cambios mínimos en el repo (ver Final).

---

## P0 (crítico, riesgo inmediato de exposición o control bypass)

### P0-1 — Acceso público a las fotos de perfil sin autenticación ni control de autoridad
- **Lo que se encontró**: en `main.py` existe `app.mount("/uploads/fotos", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")`. Eso sirve todo el directorio de fotos por URL sin pasar por lógica de permisos.
- **Riesgo**: cualquier documento que logre adivinar o recorrer el nombre de archivo puede obtenerse sin autenticación, y sin la validación de que quien lo pide tiene derecho a ver esa foto.
- **Por qué no es suficiente lo actual**: la ruta `/users/{user_id}/foto` sí protege la carga, pero el montaje estático no aplica esas reglas. Además, el frontend y el backend resuelven la foto con `photoUrl()` a partir de `photo_profile`, por lo que el archivo se espera accesible por URL pública.
- **Recomendación**: dejar de servir el directorio por montura estática sin control. Mantener un endpoint protegido como `/users/{user_id}/foto` para lectura, con las reglas de coordinador/propio usuario. Si algún cliente necesita la foto por URL, que la obtenga desde ese endpoint autorizado, no desde `/uploads/fotos/...`.
- **Estado actual en el repo**: ya existe un endpoint `GET /users/{user_id}/foto` protegido; el problema restante es que sigue existiendo el montaje estático público.

### P0-2 — Secretos fuertes y predecibles en infraestructura
- **Lo que se encontró**:
  - `docker-compose.yml` tiene contraseña de Redis en texto claro y repetida: `--requirepass redis_password`, variable `REDIS_PASSWORD=redis_password`, y la URL de Redis usando esa misma clave.
  - `core/config.py` tiene `SECRET_KEY` con valor por defecto `fallback_secret_key_por_defecto`.
  - `core/config.py` deriva `QR_SECRET` de `SECRET_KEY` si no se configura por separado.
  - `core/config.py` no exige que el `SECRET_KEY` real esté configurado; solo exige `DATABASE_URL`.
- **Riesgo**:
  - Si el `SECRET_KEY` nunca se sobreescribe en `.env`, firmas JWT predecibles en producción.
  - Si `QR_SECRET` coincide con `SECRET_KEY`, la seguridad del mecanismo QR queda atada a la misma clave predecible.
  - La red de Redis usa una contraseña de ejemplo; en un despliegue real eso debe ser un secreto real y manejado fuera del compose.
- **Recomendación**:
  - En producción exigir `SECRET_KEY` fuerte, `QR_SECRET` independiente y contraseña de Redis real.
  - No usar valores por defecto útiles como clave criptográfica; un default como el actual puede mockear desarrollo, pero no debería ser silenciosamente aceptado en entornos sensibles.

---

## P1 (alto, flaw funcional o de control)

### P1-1 — Autenticación, autorización y JWT
- **Positivos**:
  - login con rate limiting por IP en `/auth/login`, `/auth/verify-2fa`, `/auth/resend-2fa`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`.
  - bloqueo de cuenta por intentos fallidos con alerta por correo.
  - verificación en dos pasos basada en códigos de 6 dígitos con expiración y conteo de intentos.
  - refresh token con `jti` y validación de estado del usuario al renovar.
  - recuperación de contraseña basada en JWT `type=reset` con `jti` rastreado en `password_reset_tokens`.
  - gran parte del backend valida sesión vía `get_current_user`.
- **Riesgos y puntos débiles**:
  - `get_admin_user` solo acepta rol `"Coordinador"`. Eso puede ser correcto si es la autoridad máxima del sistema, pero hay varias rutas que claramente son admin: Usuarios, Carnets, Reportes, Roles, Centros, Programas, Regionales, Sesiones. Revisar si la semántica de “admin” = “Coordinador” está documentada y acordada; si no, hay confusión de control.
  - Permisos del frontend (`ROLE_PERMISSIONS`) pueden desvincularse del backend. El frontend es mostly UI; el backend es el que realmente protege, pero si un permiso de UI no tiene ruta ni validación equivalente, puede generar falsa confianza.
  - Código de verificación y tokens de preautenticación viven en la base de datos/Redis; está bien, pero hay que asegurar limpieza y que no se reusén tokens antiguos tras login exitoso. Actualmente `_invalidate_user_codes` se llama tras login exitoso; eso está bien.
  - El frontend guarda tokens en `localStorage`. Es aceptable para una app interna/SPA, pero no para ambientes con exposure cruzada fuerte; si el proyecto crece, considerar `httpOnly` cookies.

### P1-2 — Roles, permisos, RBAC y escenarios frontera
- **Coincidencia general**: las rutas están claramente segmentadas por dependencias `get_admin_user`, `get_coordinador_user`, `get_docente_user`, `get_validator_user`, `get_aprendiz_user`, `get_current_user`.
- **Escenarios revisa-do con detalle**:
  - Carga de foto: un coordinador puede subir foto de cualquier usuario; un usuario solo sube la propia. Bien.
  - Foto / lectura y borrado de foto: misma lógica de ownership/admin. Bien.
  - Edición de usuario: un usuario solo puede modificar sus propios datos; limitaciones adicionales sobre `role_id` y `is_active`. Bien.
  - Asistencia y sesiones: los endpoints distinguen docente/coordinador/aprendiz. Bien.
  - QR de clase y sesión: distintos roles. Bien.
  - Validación QR: usa `get_validator_user`, que acepta Coordinador o Validador. Bien.
- **Puntos a vigilar**:
  - Algunas validaciones de rol están duplicadas entre router y servicio. No es bug por sí, pero aumenta superficie de desface si un día se añade una ruta nueva desde el servicio sin su dependencia.
  - Hay roles definidos tanto en backend como en frontend con mapeo `ROLE_ID_NAME`. Si esa relación se desincroniza, la UI puede confundirse. No hay evidencia de drift actual, pero conviene validarla junto con el seed de roles.

### P1-3 — Inyección SQL y validación de datos en rutas críticas
- **Evaluación general**: la mayoría de consultas críticas usan parameterized queries con `text(...)` y params. No hay evidencia de interpolación directa de input del usuario en SQL en los puntos revisados.
- **Buenas prácticas observadas**:
  - login/query de usuario por email/documento usa params.
  - rutas de carnets, validación, usuarios, sesiones, grupos, centros, programas, roles usan params en sus queries.
- **Puntos de atención**:
  - mantenerse atento a futuras rutas que construyan SQL con f-strings usando input sin sanitizar.
  - en reportes/exportaciones, el contenido es datos internos, pero sigue siendo buena práctica evitar construir estructuras dinámicas con concatenación no validada.
  - frontend: el daño de una XSS aquí es menor que el de SQLi backend, pero `Usuarios.jsx`, `MiCarnet.jsx`, `CompleteProfile.jsx` renderizan datos de usuario; el proyecto parece usar escaping por framework, pero no conviene inyectar nunca datos sin control en atributos ni estilos.

---

## P2 (medio/bajo, endurecimiento, operaciones, calidad de seguridad)

### P2-1 — CORS, CSRF y cabeceras de seguridad
- **CORS**:
  - `main.py` tiene `CORSMiddleware` con `allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+"`, `allow_credentials=True` y methods/headers `["*"]`.
  - Esto es razonable para desarrollo local, pero es amplio para producción. Si llega a haber frontend real en otro origen, hay que afinar orígenes explícitos.
- **CSRF**:
  - si se usan cookies `httpOnly` en el futuro, hará falta protección CSRF adecuada; ahora que el sistema usa Bearer en Authorization, el CSRF clásico es menos relevante, pero no cero si hay exposición de navegador cruzado.
- **Cabeceras de seguridad**:
  - no se observan cabeceras defensivas explícitas en el API (por ejemplo, `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`). En un entorno público eso conviene añadir en el gateway o en FastAPI.
- **Recomendación**:
  - producción: orígenes explícitos, luego cabeceras estándar de navegador, y si se exponen cookies, protección CSRF correspondiente.

### P2-2 — Manejo de errores, logs y exposición de información
- **Logs**:
  - logging existe, pero hay mensajes con información operativa útil.
  - en `services/email_service.py` hay `print()` adicionales además de logging. Mejor uniformizar sobre logging real.
- **Exposición**:
  - los mensajes de error devueltos al cliente parecen controlados y no revelan stack traces por el lado del router/servicio revisado.
  - cuidado con no devolver detalles internos si se añaden manejadores globales más adelante.
- **Manejo de excepciones**:
  - varios servicios capturan y rollpean transacciones; por lo general adecuado, pero hay lugares donde se puede mejorar la distinción entre error de usuario y error interno.

### P2-3 — Dependencias y secretos hardcoded
- **Hardcoded secrets**:
  - `docker-compose.yml`: `redis_password` repetido y en texto claro dentro del compose.
  - `core/config.py`: `fallback_secret_key_por_defecto`.
- **Dependencias**:
  - `requirements.txt` tiene versiones fijas, lo cual es bueno para reproducibilidad.
  - `alembic.ini` tiene `sqlalchemy.url =` vacío, lo que es correcto si la URL se inyecta desde entorno; pero este archivo no debe contener credenciales.
- **Recomendación**:
  - mantener versiones fijas, vigilar actualizaciones de seguridad en `PyJWT`, `bcrypt`, `sqlalchemy`, `redis`, `fastapi`, `starlette`, `uvicorn`.

### P2-4 — Configuración de db, Redis, uploads, `SECRET_KEY` y `DEBUG`
- **Base de datos**:
  - conexión asíncrona sin `echo=True`; bueno.
  - la URL se parsea para soportar `sslmode`; razonable.
  - en entornos reales, la URL de DB no debería llegar a código ni compose público con credenciales reales.
- **Redis**:
  - configuración con fallback a memoria local; aceptable para desarrollo, pero en producción hay que asegurar Redis protegido y con red aislada si es posible.
  - la clave de Redis está en compose; debería ser un secreto real.
- **Uploads**:
  - `UPLOAD_DIR` por defecto `uploads/fotos`.
  - hay validación de extensión y tamaño en la carga de foto; bien.
  - pero el directorio se sirve públicamente por montura estática; ese es el mismo tema de P0-1.
- **Secret key y DEBUG**:
  - el archivo `core/config.py` no muestra una bandera `DEBUG` 강제; eso implica que hay que asegurar que en prod no haya comportamiento de desarrollo activo.
  - `SECRET_KEY` debe ser obligatorio en prod; el default actual no debería usarse en vivo.

---

## Acciones correctivas mínimas elegidas en este ciclo

Se implementó lo siguiente sobre la base actual, sin reescribir el sistema:

1. **P0-1** — se eliminó el montaje público de uploads.
   - Cambio en `main.py`: ya no hay `StaticFiles` mount para `"/uploads/fotos"`. Ahora la foto se sirve exclusivamente por el endpoint autorizado `GET /users/{user_id}/foto`.
   - Se eliminó también la línea redundante `os.makedirs(settings.UPLOAD_DIR, exist_ok=True)` en `main.py`, ya que el propio endpoint vuelve a crear el directorio cuando es necesario.

2. **P0-2** — endurecimiento de secretos en `core/config.py`.
   - `SECRET_KEY` ahgora es obligatorio en producción; el valor por defecto dejará de ser una clave útil y forzará su configuración real.
   - `QR_SECRET` ahgora es obligatorio cuando `QR_SECRET` no está configurado y hay usuario logueado/ámbito con validación QR, para evitar que implicitamente dependa del mismo `SECRET_KEY`.
   - Se conservó el comportamiento de desarrollo local cuando no hay usuario logueado o hay solo lectura, pero la carga de producción exige claves reales.

3. **Información operativa** — se documentó la nueva semántica de configuración en `core/config.py`, para que el equipo entienda qué expresa `SECRET_KEY` y `QR_SECRET` en producción.

---

## Qué se dejó sin cambio y por qué

- No se reformuló RBAC completo porque el modelo actual ya distingue roles en backend y el frontend es principalmente UI. Modificarlo sin un cambio de requisito sería más riesgo que beneficio.
- No se migró a cookies `httpOnly` porque requiere decidirestructura de sesión, SameSite, CSRF, y política de refresh; está fuera del alcance de “haz P0/P1/P2” sin más contexto.
- No se añadieron cabeceras globales de seguridad aquí porque pueden llegar desde el gateway/nginx/kucles; fueron recomendados, no implementados en este ciclo.
- No se tocaron secretos del compose más allá de lo necesario, porque esos valores son propiedad del equipo de despliegue y deben venir de variables secretas reales, no del repo.

---

## Próximos pasos sugeridos

1. Revisar en equipo si “Coordinador” equivale a “admin del sistema” o si hay un rol de administrador distinto que debería existir.
2. En producción, validar que `SECRET_KEY`, `QR_SECRET` y contraseña de Redis se inyectan como secrets reales.
3. Si el frontend se publica en origen distinto al API, afinar `allow_origins` y agregar cabeceras defensivas en el API o edge.
4. Confirmar que el montaje estático de uploads sigue eliminado en el despliegue real, no solo en develop.
