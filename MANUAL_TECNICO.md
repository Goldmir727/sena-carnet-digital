# Manual técnico — Sistema de Gestión de Carnets Digitales (SENA)

- **Versión del documento:** 1.0
- **Fecha:** 30 de octubre de 2026
- **Repositorio:** `https://github.com/Goldmir727/sena-carnet-digital`
- **Rama:** `main`
- **Commit de referencia:** `51ced4d` — `corrige rutas /api para login en Vercel`
- **Fuente:** código, configuración y migraciones realmente presentes en el repositorio.

> Este manual describe la implementación existente. No describe el anteproyecto PHP/Laravel/Flutter/MinIO porque ese stack no está implementado en este repositorio. Cuando un elemento no existe, está incompleto o no pudo verificarse, se indica explícitamente.

---

## 1. Resumen ejecutivo

El sistema gestiona usuarios institucionales, roles, carnets digitales, códigos QR, validación de acceso, asistencia a sesiones de formación y reportes. La autenticación es mediante correo o documento + contraseña, seguida obligatoriamente de un segundo factor (2FA) enviado por correo electrónico.

| Componente | Tecnología observada |
|---|---|
| Backend | Python 3.13, FastAPI 0.136.3, Uvicorn 0.49.0 |
| Acceso a datos | SQLAlchemy 2.0 en modo asíncrono, `asyncpg`, consultas SQL con `text()` |
| Base de datos | PostgreSQL externa; no hay contenedor de PostgreSQL en el repositorio |
| Caché / datos temporales | Redis opcional (`redis==5.2.1`), con fallback en memoria |
| Frontend | React 19, Vite 8, React Router 7, Axios, TanStack Query, Tailwind CSS 4 |
| Generación de documentos | ReportLab (PDF), openpyxl (Excel), qrcode (PNG) |
| Contenedores | Dockerfile para la API y `docker-compose.yml` con Redis + API |
| Despliegue web | Vercel Services: un servicio FastAPI en `/api` y un servicio Vite en `/` |
| Pruebas automatizadas | `pytest`; actualmente una sola prueba en `tests/test_security_auth.py` |

### 1.1 Estado verificado en este repositorio

| Verificación | Resultado |
|---|---|
| `GET /health` local | 200 |
| `GET /api/health` local (middleware de prefijo) | 200 |
| `POST /auth/login` con credenciales inválidas | 401, no 404 |
| `POST /api/auth/login` con credenciales inválidas | 401, no 404 |
| `pytest tests -q` | 1 prueba aprobada |
| `npm run build` local | No verificado: Node terminó con `FATAL ERROR: Zone Allocation failed - process out of memory` |
| Despliegue real en Vercel | No verificado desde este entorno: no hay Vercel CLI, enlace `.vercel` ni credenciales |

La corrección de rutas `/api` está comprometida y publicada en `origin/main`, pero la causa exacta del 404 de producción no pudo confirmarse sin acceso al panel de Vercel. En la sección 10.6 se incluye un árbol de diagnóstico.

---

## 2. Alcance, fuentes y convenciones

### 2.1 Fuente de verdad

Se tomó como fuente de verdad el código del repositorio, en este orden:

1. `main.py` y los routers de `modules/`.
2. Servicios de `modules/` y `services/`.
3. Modelos de `models/` y migraciones de `alembic/versions/`.
4. Configuración: `core/config.py`, `.env.example`, `vercel.json`, `Dockerfile`, `docker-compose.yml`.
5. Frontend: `frontend/src/`.
6. Scripts operativos: `seed_*.py`, `test_2fa.py`, `test_email.py`.
7. Documentos históricos: `SECURITY_AUDIT_P0P1P2.md`, que se contrastó con el código actual.

`README.md` contiene únicamente el título `# sena-carnet-digital`; `frontend/README.md` es la plantilla por defecto de Vite. Por eso este manual reemplaza a esos archivos como documentación operativa.

### 2.2 Qué está implementado y qué no

| Elemento | Estado |
|---|---|
| API FastAPI modular | Implementado |
| Frontend React/Vite | Implementado |
| Autenticación con contraseña + 2FA | Implementado |
| Roles y permisos básicos | Implementado |
| Carnets y QR | Implementado con limitaciones de esquema |
| Asistencia por QR de clase | Implementado |
| Reportes PDF/Excel | Implementado |
| PostgreSQL | Requerido, externo al repositorio |
| Redis | Opcional, con fallback en memoria |
| Docker para API + Redis | Implementado |
| Docker para PostgreSQL | No implementado |
| Blueprint PHP/Laravel/Flutter/MinIO | No implementado; no hay archivos de ese stack |
| Almacenamiento durable de fotos | No implementado; `uploads/` es local/efímero |
| CI/CD en el repositorio | No implementado; no existe `.github/` |
| Pruebas de frontend | No implementadas |
| Cobertura amplia de pruebas backend | No implementada; solo una prueba |

### 2.3 Convenciones

- **Implementado:** existe y es ejecutable según el código.
- **Parcial:** existe, pero tiene una limitación funcional o de esquema.
- **No implementado:** no existe en el repositorio.
- **No verificado:** no se ejecutó en este entorno; no se afirma que funcione en producción.
- Las rutas se muestran tal como las declara FastAPI, incluyendo prefijos y barras finales.
- No se reproducen valores de `.env` ni contraseñas. Los ejemplos usan marcadores.

---

## 3. Arquitectura

### 3.1 Vista general

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Navegador / PWA                                                     │
│ React 19 + Vite + React Router + Axios + TanStack Query             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Vercel                                                              │
│  ┌──────────────────────────┐      ┌──────────────────────────────┐  │
│  │ Servicio "frontend"      │      │ Servicio "app"               │  │
│  │ root: frontend           │      │ root: .                      │  │
│  │ Vite → dist/             │      │ FastAPI: main:app            │  │
│  │ SPA fallback → index.html│      │ recibe /api/*                │  │
│  └──────────────────────────┘      └──────────────┬───────────────┘  │
└───────────────────────────────────────────────────┼─────────────────┘
                                                    │
                    ┌───────────────────────────────┼───────────────────────────────┐
                    ▼                               ▼                               ▼
          ┌──────────────────┐          ┌────────────────────┐          ┌──────────────────┐
          │ PostgreSQL       │          │ Redis (opcional)   │          │ SMTP (opcional)  │
          │ externo, asyncpg │          │ caché / locks / QR │          │ código 2FA       │
          └──────────────────┘          └────────────────────┘          └──────────────────┘
                                                    │
                                                    ▼
                                          ┌──────────────────┐
                                          │ uploads/ local   │
                                          │ efímero en Vercel│
                                          └──────────────────┘
```

En local, el navegador llama directamente a `http://127.0.0.1:8000`; en producción, el frontend llama a `/api` en el mismo origen y Vercel enruta al servicio FastAPI.

### 3.2 Capas del backend

```text
HTTP
  │
  ▼
StripApiPrefixMiddleware   ← elimina /api si Vercel no aplicó el transform
  │
  ▼
CORSMiddleware
  │
  ▼
Router del módulo         ← valida parámetros y aplica dependencias de auth
  │
  ▼
Dependencias de seguridad ← get_current_user / get_admin_user / ...
  │
  ▼
Servicio del módulo       ← reglas de negocio
  │
  ▼
SQLAlchemy AsyncSession   ← text() con parámetros vinculados
  │
  ▼
PostgreSQL
```

Los modelos ORM de `models/` se usan principalmente para:

- declarar el metadata que consume Alembic;
- documentar las tablas;
- relaciones ORM declarativas.

La mayoría de los servicios no usan el ORM para consultar: ejecutan SQL directo con `text()`. Esto es importante para leer el código y para entender por qué el esquema real (`base.sql`) manda sobre los modelos en varios puntos.

### 3.3 Flujo de una petición

**Local:**

1. El frontend corre en `http://localhost:5173` o `http://127.0.0.1:5173`.
2. `frontend/src/api/base.js` usa `http://127.0.0.1:8000` cuando `import.meta.env.DEV` es verdadero.
3. Axios agrega `Authorization: Bearer <access_token>` si hay token.
4. FastAPI recibe la ruta sin prefijo `/api` (por ejemplo, `/auth/login`).
5. El router valida, el servicio consulta PostgreSQL y responde JSON.

**Producción en Vercel:**

1. El frontend se sirve desde `/`.
2. `frontend/src/api/base.js` usa `/api` si `VITE_API_URL` no está definido.
3. El navegador llama a `https://<dominio>/api/auth/login`.
4. La regla superior de `vercel.json` envía `/api/(.*)` al servicio `app`.
5. La regla `routes` del servicio `app` transforma `request.path` de `/api/auth/login` a `/auth/login`.
6. Si el transform no se aplica, `StripApiPrefixMiddleware` elimina `/api` antes del routing de FastAPI.
7. FastAPI responde; el navegador recibe JSON del mismo origen, por lo que no hay CORS.

### 3.4 Decisiones de diseño observadas

- **API monolítica modular**, no microservicios: un solo proceso FastAPI incluye todos los routers.
- **Sesión stateless** con JWT: el servidor no guarda sesiones; el cliente guarda tokens en `localStorage`.
- **2FA obligatorio** para todos los usuarios, no configurable por rol.
- **QR con HMAC-SHA256** y secreto independiente (`QR_SECRET`).
- **Caché opcional**: si Redis no está disponible, el sistema sigue funcionando con un almacén en memoria del proceso.
- **Compatibilidad defensiva con dos esquemas**: varios servicios intentan usar tablas opcionales (`qr_carnets`, `access_logs`) y, si no existen, caen a `audit_logs`, Redis o lógica stateless.
- **SQL directo**: facilita adaptarse a `base.sql`, pero acopla los servicios a nombres de columnas y hace que las migraciones incompletas fallen en tiempo de ejecución.

---

## 4. Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `main.py` | Creación de `FastAPI`, lifespan, CORS, middleware `/api`, rutas de sistema e inclusión de routers |
| `core/` | Configuración, base de datos, seguridad JWT/roles, Redis, rate limit, logging, excepciones |
| `models/` | Modelos SQLAlchemy declarativos de las tablas |
| `modules/` | Módulos funcionales: auth, roles, users, carnet, qr, validation, attendance, asistencia, grupos, sesiones, centros, programas, regionales, reports |
| `services/` | Servicios transversales: correo, Excel, PDF, QR |
| `alembic/` | Configuración de migraciones y versiones `001`, `004`, `005` |
| `tests/` | `test_security_auth.py` |
| `frontend/` | Aplicación React/Vite |
| `frontend/src/api/` | Clientes Axios y hooks de TanStack Query |
| `frontend/src/pages/` | Pantallas de la aplicación |
| `frontend/src/routes/` | Router, `ProtectedRoute`, `PermissionRoute` |
| `frontend/src/constants/` | Roles, permisos y menú |
| `uploads/` | Directorio local de fotos; ignorado por Git |
| `base.sql` | Volcado binario PostgreSQL (`PGDMP`), ignorado por Git; referencia local del esquema físico |
| `vercel.json` | Configuración de los dos servicios de Vercel y rewrites |
| `Dockerfile` | Imagen de la API |
| `docker-compose.yml` | Redis + API; no incluye PostgreSQL |
| `.env.example` | Plantilla de variables de entorno, sin secretos reales |
| `.gitignore` | Ignora `.env*` (excepto `.env.example`), `uploads/`, `base.sql`, `frontend/dist`, `*.xlsx`, etc. |
| `seed_roles.py` | Siembra de roles; contiene una referencia inválida a `users.username` |
| `seed_coordinadores.py` | Siembra de roles y coordinadores con contraseña por defecto hardcodeada |
| `seed_programas.py` | Siembra de programas de prueba |
| `test_2fa.py` | Script manual del flujo 2FA |
| `test_email.py` | Script manual de envío SMTP |
| `SECURITY_AUDIT_P0P1P2.md` | Auditoría histórica; algunas afirmaciones ya no coinciden con el código |
| `README.md` | Solo el título del proyecto |
| `frontend/README.md` | Plantilla por defecto de Vite |

---

## 5. Backend

### 5.1 Arranque y ciclo de vida

`main.py` crea la aplicación con:

```python
app = FastAPI(
    title="Sistema de Gestión de Carnets Digitales",
    version="4.0.0",
    description="API modular para emisión, validación y trazabilidad de carnets institucionales",
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True},
)
```

El `lifespan`:

1. Registra el inicio de la API.
2. Intenta conectar con Redis y reporta si está activo o si se usa memoria local.
3. Ejecuta `CarnetService.check_expired()` al arrancar. En el esquema actual ese método retorna `0` porque el estado del carnet se deriva de `expiration_date`; no hay columna `status` que actualizar.
4. Al cerrar, cierra el cliente Redis y registra el cierre.

### 5.2 Middleware `/api`

`StripApiPrefixMiddleware` existe para que FastAPI acepte tanto rutas con prefijo como sin prefijo:

- `/api/auth/login` → se reescribe a `/auth/login`.
- `/api/health` → se reescribe a `/health`.
- `/api` exacto → se reescribe a `/`.

Solo modifica `scope["path"]` y `scope["raw_path"]`; no modifica query string, headers ni body. Es un fallback para Vercel Services: el transform de `vercel.json` debería entregar ya la ruta sin `/api`, pero el middleware evita un 404 si el transform no se aplica.

### 5.3 CORS

La configuración actual permite:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:8000`
- `http://127.0.0.1:8000`
- cualquier origen que cumpla `http://(localhost|127\.0\.0\.1):\d+`

No incluye dominios de producción. En Vercel, como el frontend y la API comparten origen (`/api`), CORS no interviene. Si se configura `VITE_API_URL` con un dominio distinto, el navegador bloqueará las peticiones hasta agregar ese origen a `allow_origins`.

### 5.4 Rutas de sistema

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| GET | `/health` | Público | Estado de la API y estadísticas de caché |
| GET | `/cache/stats` | Coordinador | Estadísticas de caché |
| DELETE | `/cache?pattern=*` | Coordinador | Limpia claves de caché |

En Vercel solo `/api/*` se enruta al servicio FastAPI. Por eso el health check público debe ser `GET /api/health`; `GET /health` en el dominio de Vercel cae en el servicio frontend y devuelve la SPA, no la API.

### 5.5 Configuración

`core/config.py` carga `.env` con `python-dotenv` y exige tres variables al importar el módulo:

| Variable | Obligatoria | Valor por defecto | Uso |
|---|---|---|---|
| `DATABASE_URL` | Sí | — | URL de PostgreSQL con driver `asyncpg` |
| `SECRET_KEY` | Sí | — | Firma de JWT de acceso, refresh, preauth y reset |
| `QR_SECRET` | Sí | — | Firma HMAC de los QR; debe ser distinto de `SECRET_KEY` |
| `ALGORITHM` | No | `HS256` | Algoritmo JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `15` | Vigencia del access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `1` | Vigencia del refresh token |
| `RESET_TOKEN_EXPIRE_MINUTES` | No | `10` | Vigencia del token de recuperación |
| `MAX_LOGIN_ATTEMPTS` | No | `5` | Intentos fallidos antes de bloquear |
| `BLOCK_DURATION_MINUTES` | No | `15` | Duración del bloqueo |
| `RATE_LIMIT_REQUESTS` | No | `20` | Límite de login por IP |
| `RATE_LIMIT_WINDOW_SECONDS` | No | `60` | Ventana del rate limit |
| `SMTP_HOST` | No | vacío | Servidor SMTP |
| `SMTP_PORT` | No | `587` | Puerto SMTP |
| `SMTP_USER` | No | vacío | Usuario SMTP |
| `SMTP_PASSWORD` | No | vacío | Contraseña SMTP |
| `SMTP_FROM` | No | `noreply@sena.edu.co` | Remitente |
| `VERIFICATION_CODE_EXPIRE_MINUTES` | No | `5` | Vigencia del código 2FA |
| `TWO_FA_MAX_ATTEMPTS` | No | `5` | Intentos máximos del código 2FA |
| `QR_CARNET_EXPIRE_MINUTES` | No | `15` | Vigencia del QR dinámico de carnet |
| `QR_CLASE_EXPIRE_MINUTES` | No | `15` | Vigencia del QR de clase |
| `CARNET_DURATION_DAYS` | No | `365` | Duración del carnet generado |
| `UPLOAD_DIR` | No | `uploads/fotos` | Directorio local de fotos |
| `REDIS_URL` | No | vacío | Redis; si está vacío se usa memoria local |
| `CACHE_TTL_REPORTS` | No | `60` | TTL de reportes |
| `CACHE_TTL_GRUPOS` | No | `30` | TTL de grupos |
| `CACHE_TTL_CARNETS` | No | `30` | TTL de carnets |

#### Validación al arranque

Si falta `DATABASE_URL`, `SECRET_KEY` o `QR_SECRET`, la aplicación lanza `ValueError` y no arranca. No hay valores por defecto útiles para esas tres variables.

`QR_SECRET` no se deriva de `SECRET_KEY`. Esto es intencional: rotar uno no debe invalidar el otro. Consecuencias:

- Rotar `SECRET_KEY` invalida todos los JWT emitidos.
- Rotar `QR_SECRET` invalida todos los QR emitidos (impresos y dinámicos).

#### `DATABASE_URL` y SSL

`core/database.py` y `alembic/env.py` procesan la URL:

- Esperan el driver `postgresql+asyncpg://`.
- Extraen `sslmode` de la query string y lo pasan como `connect_args={"ssl": ...}`.
- El resto de parámetros se conserva.

Ejemplo de forma, sin credenciales reales:

```text
postgresql+asyncpg://usuario:password@host:5432/nombre_db?sslmode=require
```

En Vercel, la base debe ser accesible desde internet y aceptar SSL si el proveedor lo exige.

### 5.6 Autenticación y sesión

#### Flujo completo

```text
POST /auth/login
  ├─ rate limit por IP
  ├─ buscar usuario por email o document
  ├─ verificar contraseña con bcrypt
  ├─ si falla: incrementar contador; a los 5 fallos bloquear 15 min
  ├─ si está inactivo: 403
  ├─ invalidar códigos 2FA anteriores
  ├─ generar código de 6 dígitos
  ├─ guardar en verification_codes
  ├─ enviar correo SMTP (o simular si no hay SMTP)
  └─ devolver preauth_token + requires_2fa + email enmascarado

POST /auth/verify-2fa
  ├─ rate limit por IP
  ├─ decodificar preauth_token (tipo 2fa_preauth)
  ├─ buscar el último código no usado
  ├─ validar intentos, expiración y código
  ├─ marcar código como usado
  ├─ emitir access_token (15 min) + refresh_token (1 día)
  └─ devolver tokens

POST /auth/refresh
  ├─ decodificar refresh_token (tipo refresh)
  ├─ verificar que el usuario siga activo
  └─ emitir solo un nuevo access_token
```

#### Endpoints de autenticación

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| POST | `/auth/login` | Público | `application/x-www-form-urlencoded`, campos `username` y `password`; devuelve preauth, no tokens finales |
| POST | `/auth/verify-2fa` | Público con preauth | JSON `{preauth_token, code}`; devuelve access y refresh |
| POST | `/auth/resend-2fa` | Público con preauth | JSON `{preauth_token}`; genera y envía un código nuevo |
| POST | `/auth/refresh` | Público con refresh | JSON `{refresh_token}`; devuelve un access nuevo |
| POST | `/auth/forgot-password` | Público | JSON `{email}`; respuesta genérica exista o no el correo |
| POST | `/auth/reset-password` | Público con token | JSON `{token, new_password}` |

#### Tipos de token

| Token | `type` | Vigencia | Contenido | Uso |
|---|---|---|---|---|
| Preauth | `2fa_preauth` | La del código 2FA | `sub`, `user_id`, `email` | Solo para verificar 2FA o reenviar código |
| Access | `access` | 15 min por defecto | `sub`, `user_id`, `role_id` | Autorización de endpoints |
| Refresh | `refresh` | 1 día por defecto | `sub`, `user_id` | Renovar access |
| Reset | `reset` | 10 min por defecto | `sub`, `user_id`, `jti` | Restablecer contraseña |

#### Contraseñas y 2FA

- Hash de contraseña: bcrypt con `rounds=12`.
- Código 2FA: 6 dígitos generados con `secrets.randbelow`.
- Código 2FA almacenado en `verification_codes.code` en texto plano.
- Intentos máximos del código: `TWO_FA_MAX_ATTEMPTS` (5 por defecto).
- El código se marca como usado después de una verificación exitosa.
- Si el código falla, se incrementa `attempts`; al llegar al máximo se marca como usado y se responde 429.
- Si el código expira, se responde 400 y se debe solicitar uno nuevo.

#### Bloqueo y rate limiting

| Acción | Clave | Límite observado |
|---|---|---|
| Login | IP | `RATE_LIMIT_REQUESTS` (20) por `RATE_LIMIT_WINDOW_SECONDS` (60 s) |
| Login fallido | usuario | 5 fallos → bloqueo 15 min |
| Verify 2FA | IP | 5 por 60 s |
| Resend 2FA | IP | 3 por 120 s |
| Refresh | IP | 10 por 60 s |
| Forgot password | IP | 3 por 300 s |
| Reset password | IP | 5 por 60 s |

El rate limit usa Redis si está disponible. Si no, usa `InMemoryRateLimiter`, que es por proceso. En Vercel con varias instancias, los límites no son globales.

#### Correo y 2FA

- Si `SMTP_HOST`, `SMTP_USER` y `SMTP_PASSWORD` están configurados, se intenta enviar el correo real.
- Si no están configurados, `send_email` registra el código simulado en el log (`>> CODIGO SIMULADO: ... <<`) y retorna `True`.
- Si SMTP está configurado pero falla, retorna `False` y el login responde con `email_sent: false`.

Esto significa que en un entorno sin SMTP el flujo 2FA “funciona” leyendo el código en los logs. No es aceptable para producción: los logs de Vercel podrían exponer códigos de acceso.

#### Recuperación de contraseña

1. `POST /auth/forgot-password` busca el usuario por email.
2. Si no existe, responde igualmente un mensaje genérico.
3. Si existe, crea un JWT tipo `reset` con un `jti` UUID.
4. Guarda `hash_jti(jti)` en `password_reset_tokens`, no el token completo.
5. Marca como usados los tokens anteriores no usados del usuario.
6. Envía el token completo por correo.
7. `POST /auth/reset-password` valida el JWT, el `jti_hash`, la expiración y que no esté usado; luego actualiza el hash y marca el token como usado.

#### Logout

No existe endpoint de logout en el backend. El frontend elimina los tokens de `localStorage` y dispara un evento `session:logout`. El refresh token sigue siendo válido hasta su expiración si alguien lo conserva.

### 5.7 Autorización

#### Dependencias de seguridad

| Dependencia | Regla | Uso |
|---|---|---|
| `get_current_user` | Cualquier usuario activo con access token válido | Endpoints autenticados |
| `get_admin_user` | `role_name == "Coordinador"` | Administración |
| `get_coordinador_user` | `role_name == "Coordinador"` | Igual que el anterior |
| `get_docente_user` | `role_name == "Docente"` | Gestión docente |
| `get_aprendiz_user` | `role_name == "Aprendiz"` | Escaneo de asistencia |
| `get_validator_user` | `Coordinador` o `Validador` | Validación de QR |
| `get_funcionario_user` | `role_name == "Funcionario"` | Definida pero no usada por ningún router |

`get_admin_user` y `get_coordinador_user` son funcionalmente idénticas. No existe un rol “Administrador” separado; el rol administrador del sistema es `Coordinador`.

#### Roles del sistema

| ID asumido | Nombre | Uso funcional |
|---|---|---|
| 1 | Coordinador | Administración general, usuarios, grupos, carnets, reportes |
| 2 | Docente | Grupos asignados, sesiones, QR de clase, asistencia |
| 3 | Aprendiz | Carnet propio, escaneo de QR de clase |
| 4 | Funcionario | Carnet propio; sin grupo |
| 5 | Validador | Validación de QR de acceso |

Los IDs 1–5 se asumen en `seed_roles.py`, `seed_coordinadores.py`, `frontend/src/constants/roles.js` y varios servicios. La tabla `roles` no impone esos IDs; si se cargan roles con otros IDs, el frontend y los seeds pueden quedar inconsistentes.

#### Matriz de permisos del frontend

`frontend/src/constants/permissions.js` define:

| Rol | Permisos |
|---|---|
| Coordinador | `dashboard.view`, `users.read`, `users.write`, `grupos.read`, `grupos.write`, `centros.read`, `centros.write`, `programas.read`, `carnet.view`, `carnet.write`, `qr.carnet`, `reports.view`, `asistencia.grupo.read`, `asistencia.excel`, `validar.qr` |
| Docente | `dashboard.view`, `grupos.mine`, `qr.clase`, `asistencia.grupo.read`, `asistencia.excel`, `carnet.view`, `qr.carnet` |
| Aprendiz | `dashboard.view`, `carnet.view`, `qr.carnet`, `asistencia.escanear` |
| Funcionario | `dashboard.view`, `carnet.view`, `qr.carnet` |
| Validador | `dashboard.view`, `validar.qr` |

Estos permisos son de interfaz. La autorización real la aplica el backend con las dependencias anteriores.

### 5.8 Módulos

| Módulo | Prefijo | Responsabilidad | Archivos principales |
|---|---|---|---|
| `auth` | `/auth` | Login, 2FA, refresh, recuperación de contraseña | `auth_router.py`, `auth_service.py`, `auth_schema.py` |
| `roles` | `/roles` | CRUD de roles | `role_router.py`, `role_service.py`, `role_schema.py` |
| `users` | `/users` | CRUD de usuarios, importación Excel, fotos, estados masivos | `user_router.py`, `user_service.py`, `user_schema.py`, `user_constants.py` |
| `carnet` | `/carnets` | Generación, consulta, PDF, QR y cambio de estado | `carnet_router.py`, `carnet_service.py`, `carnet_schema.py` |
| `qr` | `/qr` | QR dinámico de carnet y QR de clase | `qr_router.py`, `qr_service.py`, `qr_schema.py` |
| `validation` | `/validate` | Validación de QR de carnet y consulta de estado | `validation_router.py`, `validation_service.py`, `validation_schema.py` |
| `attendance` | `/attendance` | Consultas de asistencia, tardanzas, inasistencias, estadísticas | `attendance_router.py`, `attendance_service.py`, `attendance_schema.py` |
| `attendance` | `/asistencia` | Escaneo de QR de clase, asistencia por grupo, importación Excel | `asistencia_router.py`, `asistencia_service.py` |
| `grupos` | `/grupos` | Grupos basados en `fichas`; estudiantes y docentes | `grupo_router.py`, `grupo_service.py`, `grupo_schema.py` |
| `sesiones` | `/sesiones` | Sesiones de clase, QR de sesión, registro manual | `sesion_router.py`, `sesion_service.py`, `sesion_schema.py` |
| `centros` | `/centros` | Centros de formación | `centro_router.py`, `centro_service.py`, `centro_schema.py` |
| `programas` | `/programas` | Programas de formación | `programa_router.py`, `programa_service.py`, `programa_schema.py` |
| `regionales` | `/regionales` | Regiones derivadas de `centros_formacion.regional` | `regional_router.py` |
| `reports` | `/reports` | Reportes y exportaciones PDF/Excel | `reports_router.py`, `reports_service.py` |
| `reports` | `/reportes` | Alias en español de reportes | `reportes_alias_router.py` |

### 5.9 Inventario de endpoints

La API tiene **84 rutas declaradas en routers de módulos** y **3 rutas de sistema en `main.py`**, para un total de **87 operaciones HTTP**.

#### Sistema

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| GET | `/health` | Público | Estado de la API y caché |
| GET | `/cache/stats` | Coordinador | Estadísticas de caché |
| DELETE | `/cache` | Coordinador | Limpia caché por patrón |

#### Autenticación

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| POST | `/auth/login` | Público | Inicio de sesión; devuelve preauth 2FA |
| POST | `/auth/verify-2fa` | Público + preauth | Verifica código y devuelve tokens |
| POST | `/auth/resend-2fa` | Público + preauth | Reenvía código 2FA |
| POST | `/auth/refresh` | Público + refresh | Renueva access token |
| POST | `/auth/forgot-password` | Público | Solicita recuperación |
| POST | `/auth/reset-password` | Público + reset | Cambia contraseña |

#### Roles

Todas las rutas exigen `get_current_user` y verifican dentro del handler que el rol sea `Coordinador`.

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| GET | `/roles/` | Coordinador | Lista roles |
| GET | `/roles/get_by_name` | Coordinador | Busca por nombre (`nom`) |
| GET | `/roles/get_by_id` | Coordinador | Busca por ID (`id`) |
| POST | `/roles/` | Coordinador | Crea rol |
| DELETE | `/roles/{role_id}` | Coordinador | Elimina rol |

#### Usuarios

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| GET | `/users/` | Coordinador | Lista usuarios (`estado=activos\|suspendidos\|todos`) |
| GET | `/users/search` | Coordinador | Busca por texto (`q`) y estado |
| GET | `/users/import-template` | Coordinador | Descarga plantilla Excel; `ficha` opcional |
| POST | `/users/bulk-status` | Coordinador | Suspende/reactiva varios usuarios |
| POST | `/users/import-excel` | Coordinador | Importa usuarios desde `.xlsx` |
| GET | `/users/{user_id}` | Autenticado | Consulta un usuario |
| POST | `/users/` | Coordinador | Crea usuario |
| PUT | `/users/{user_id}` | Autenticado (propio) / Coordinador | Actualiza usuario |
| DELETE | `/users/{user_id}` | Coordinador | Baja lógica (`INACTIVE`) |
| POST | `/users/{user_id}/foto` | Autenticado (propio) / Coordinador | Sube foto |
| GET | `/users{user_id}/foto` | Autenticado (propio) / Coordinador | **Ruta malformada**; falta `/` antes de `{user_id}` |
| DELETE | `/users{user_id}/foto` | Autenticado (propio) / Coordinador | **Ruta malformada**; falta `/` antes de `{user_id}` |

#### Carnets

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| POST | `/carnets/generate/{user_id}` | Coordinador | Genera carnet |
| POST | `/carnets/regenerate/{user_id}` | Coordinador | Regenera carnet |
| GET | `/carnets/me` | Autenticado | Carnet del usuario actual |
| GET | `/carnets/` | Coordinador | Lista carnets (`estado`) |
| GET | `/carnets/{carnet_id}` | Autenticado | Consulta carnet |
| PATCH | `/carnets/{carnet_id}/estado` | Coordinador | Cambia estado |
| GET | `/carnets/{carnet_id}/qr` | Autenticado | PNG del QR |
| GET | `/carnets/{carnet_id}/pdf` | Autenticado | PDF del carnet |

#### QR

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| POST | `/qr/carnet` | Autenticado | Genera QR dinámico de carnet |
| POST | `/qr/clase` | Docente | Genera QR de clase y sesión |
| GET | `/qr/carnet/image` | Autenticado | PNG de un token de carnet (`token`) |
| GET | `/qr/clase/image` | Autenticado | PNG de un token de clase (`token`) |

#### Validación

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| POST | `/validate/qr` | Coordinador o Validador | Valida token; header opcional `X-Ubicacion` |
| GET | `/validate/check/{codigo}` | Coordinador o Validador | Consulta por ID numérico o UUID |

#### Asistencias (`/attendance`)

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| GET | `/attendance/` | Coordinador | Lista asistencias (`limit`, `offset`) |
| GET | `/attendance/user/{user_id}` | Coordinador | Asistencias de un usuario |
| GET | `/attendance/stats` | Coordinador | Estadísticas |
| GET | `/attendance/range` | Coordinador | Rango `desde`/`hasta` ISO |
| GET | `/attendance/llegadas-tarde` | Docente o Coordinador | Tardanzas |
| GET | `/attendance/inasistencias` | Docente o Coordinador | Inasistencias |

#### Asistencia QR (`/asistencia`)

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| POST | `/asistencia/escanear` | Aprendiz | Registra asistencia con QR de clase |
| GET | `/asistencia/grupo/{grupo_id}` | Docente o Coordinador | Asistencia del grupo (`fecha`) |
| GET | `/asistencia/grupo/{grupo_id}/stats` | Docente o Coordinador | Estadísticas del grupo |
| POST | `/asistencia/excel` | Docente | Importa asistencia desde `.xlsx` |

#### Grupos

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| GET | `/grupos/` | Coordinador | Lista grupos |
| GET | `/grupos/mis-grupos` | Docente | Grupos del docente |
| POST | `/grupos/` | Coordinador | Crea grupo |
| GET | `/grupos/{grupo_id}` | Coordinador | Detalle |
| PUT | `/grupos/{grupo_id}` | Coordinador | Actualiza |
| DELETE | `/grupos/{grupo_id}` | Coordinador | Elimina |
| GET | `/grupos/{grupo_id}/estudiantes` | Coordinador | Lista estudiantes |
| POST | `/grupos/{grupo_id}/estudiantes` | Coordinador | Asigna estudiantes |
| DELETE | `/grupos/{grupo_id}/estudiantes/{user_id}` | Coordinador | Remueve estudiante |
| GET | `/grupos/{grupo_id}/docentes` | Coordinador | Lista docentes |
| POST | `/grupos/{grupo_id}/docentes` | Coordinador | Asigna docentes |
| DELETE | `/grupos/{grupo_id}/docentes/{user_id}` | Coordinador | Remueve docente |

#### Sesiones

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| GET | `/sesiones/` | Docente o Coordinador | Lista sesiones (`ficha_id`) |
| POST | `/sesiones/` | Docente o Coordinador | Crea sesión |
| GET | `/sesiones/docente/mias` | Docente | Sesiones propias |
| GET | `/sesiones/{sesion_id}` | Docente o Coordinador | Detalle |
| PUT | `/sesiones/{sesion_id}` | Docente o Coordinador | Actualiza |
| DELETE | `/sesiones/{sesion_id}` | Docente o Coordinador | Elimina |
| POST | `/sesiones/{sesion_id}/qr` | Docente o Coordinador | Genera/rota QR de sesión |
| GET | `/sesiones/{sesion_id}/asistencias` | Docente o Coordinador | Asistencias en vivo |
| POST | `/sesiones/{sesion_id}/asistencias` | Docente | Registro manual |

#### Centros, programas y regionales

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| GET | `/centros/` | Coordinador | Lista centros (`regional`) |
| POST | `/centros/` | Coordinador | Crea centro |
| PUT | `/centros/{centro_id}` | Coordinador | Actualiza centro |
| GET | `/programas/` | Coordinador | Lista programas |
| POST | `/programas/` | Coordinador | Crea programa |
| PUT | `/programas/{programa_id}` | Coordinador | Actualiza programa |
| GET | `/regionales/` | Coordinador | Lista regionales distintas |

#### Reportes

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| GET | `/reports/usuarios` | Coordinador | Reporte de usuarios |
| GET | `/reports/carnets` | Coordinador | Reporte de carnets (`estado`) |
| GET | `/reports/asistencias` | Coordinador | Reporte de asistencias (`grupo_id`, `desde`, `hasta`) |
| GET | `/reports/estadisticas` | Coordinador | Estadísticas |
| GET | `/reports/export/pdf` | Coordinador | PDF (`tipo=usuarios\|carnets\|asistencias`) |
| GET | `/reports/export/excel` | Coordinador | Excel (`tipo=usuarios\|carnets\|asistencias`) |
| GET | `/reportes/asistencia` | Coordinador | Alias de asistencias |
| GET | `/reportes/asistencia/export/excel` | Coordinador | Alias de exportación Excel |
| GET | `/reportes/estadisticas` | Coordinador | Alias de estadísticas |

### 5.10 Errores y respuestas

| Código | Cuándo aparece | Cuerpo típico |
|---|---|---|
| 400 | Datos inválidos, código 2FA expirado, estado no soportado | `{"detail": "..."}` |
| 401 | Token ausente/inválido/expirado, credenciales inválidas | `{"detail": "..."}` |
| 403 | Rol insuficiente, usuario inactivo, recurso ajeno | `{"detail": "..."}` |
| 404 | Recurso no encontrado o ruta inexistente | `{"detail": "..."}` |
| 409 | Conflicto, por ejemplo carnet activo duplicado | `{"detail": "..."}` |
| 413 | Archivo demasiado grande | `{"detail": "..."}` |
| 422 | Validación automática de Pydantic/FastAPI | `{"detail": [...]}` |
| 423 | Cuenta bloqueada por intentos fallidos | `{"detail": "..."}` |
| 429 | Rate limit o demasiados intentos 2FA | `{"detail": "..."}` |
| 500 | Error interno, fallo de correo, fallo de base | `{"detail": "..."}` |

`InvalidStateTransitionError` se usa para transiciones de estado de carnet no permitidas y responde 409.

### 5.11 Caché y Redis

`core/redis_client.py` implementa un wrapper con fallback:

- Si `REDIS_URL` está vacío o Redis no responde, usa `_mem_store` en memoria.
- Si Redis está disponible, usa `redis.asyncio`.
- Las operaciones principales son `cache_get`, `cache_set`, `cache_delete`, `incr_with_expire`, `sadd`, `sismember`.

Claves observadas:

| Clave / patrón | Uso |
|---|---|
| `carnets:user:{user_id}` | Detalle de carnet por usuario |
| `carnets:all:{estado}` | Listado de carnets |
| `carnets:all*` | Invalidación de listados |
| `reports:*` | Reportes |
| `grupos:all` | Listado de grupos |
| `grupos:{id}` | Detalle de grupo |
| `grupos:{id}:estudiantes` | Estudiantes del grupo |
| `grupos:{id}:docentes` | Docentes del grupo |
| `grupos:mis:*` | Grupos de docentes |
| `login:fail:{usuario}` | Contador de fallos |
| `login:block:{usuario}` | Bloqueo temporal |
| `rl:{acción}:{ip}` | Rate limit |
| `qr:used` | Set de QR dinámicos ya usados |

TTL por defecto: reportes 60 s, grupos 30 s, carnets 30 s. Los TTL se configuran por variables de entorno.

Limitaciones:

- El fallback en memoria no se comparte entre procesos ni instancias.
- En Vercel, cada instancia puede tener su propio `qr:used` y sus propios contadores de login.
- Si Redis se cae después de haber estado activo, algunas operaciones caen al store en memoria, pero el estado previo de Redis no se replica.

### 5.12 QR

Hay tres tipos de token, todos con el formato:

```text
<base64url(payload_json)>.<hmac_sha256_hex>
```

La firma se calcula con `QR_SECRET`. `decode_qr_payload` verifica la firma y devuelve el JSON; `verify_qr_token` devuelve un identificador.

| Tipo | Payload | Dónde se guarda | Vigencia | Uso |
|---|---|---|---|---|
| Carnet impreso | `{"uuid": "...", "type": "carnet"}` | `carnets.qr_code` | La del carnet | QR fijo impreso; se valida contra el token exacto |
| Carnet dinámico | `{"type": "carnet", "user_id": ..., "timestamp": ...}` | `qr_carnets` si existe; si no, stateless | 15 min | Acceso temporal; un solo uso |
| Clase | `{"type": "clase", "docente_id": ..., "grupo_id": ..., "timestamp": ...}` | `sesiones.qr_token` | 15 min | Asistencia de aprendices |

#### Validación de QR de carnet

1. Se decodifica y verifica la firma.
2. Si el payload no tiene `user_id`, se trata como QR impreso: se busca el token exacto en `carnets.qr_code`.
3. Si el payload tiene `user_id`, se intenta usar `qr_carnets`.
4. Si `qr_carnets` no existe, se valida el timestamp (15 min) y se consulta el set `qr:used` en Redis.
5. Se busca el carnet del usuario y se calcula el estado: `Vencido` si `expiration_date < CURRENT_DATE`, si no `Activo`.
6. Se registra el intento en `access_logs` si existe; si no, en `audit_logs`; si ninguno existe, se omite.

#### Validación de QR de clase

1. Se decodifica y verifica la firma.
2. Se busca la sesión por `qr_token`.
3. Se valida que el aprendiz pertenezca a la ficha y que el QR no haya expirado.
4. Se registra la asistencia en `asistencias`.
5. Se evita duplicado para la misma sesión/usuario.

### 5.13 Reportes y archivos

- PDF: `services/pdf_service.py` con ReportLab; incluye carnet y reportes.
- Excel: `services/excel_service.py` con openpyxl; exporta listas de diccionarios.
- QR PNG: `services/qr_service.py` con `qrcode`.
- Fotos: se guardan en `UPLOAD_DIR` (`uploads/fotos` por defecto) con nombre `user_{id}{ext}`.
- No hay montaje estático `/uploads`; la lectura debería pasar por `GET /users/{user_id}/foto`, pero esa ruta está mal declarada (ver limitaciones).

---

## 6. Modelo de datos

### 6.1 Tablas declaradas en los modelos

#### `roles`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | Autoincremental |
| `name` | String(100) | Nombre del rol |
| `description` | Text | Opcional |

#### `centros_formacion`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | |
| `codigo` | String(20) | Único |
| `nombre` | String(150) | |
| `regional` | String(100) | |
| `ciudad` | String(100) | |
| `direccion` | String(200) | Opcional |
| `telefono` | String(30) | Opcional |
| `email` | String(150) | Opcional |
| `status` | String(20) | Default `activo` |

#### `programa_formacion`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | |
| `name` | String(200) | |
| `modality` | String(50) | Opcional |
| `duration` | Integer | Opcional |
| `level` | String(50) | Opcional |
| `description` | Text | Opcional |

#### `users`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | |
| `name` | String(100) | |
| `last_name` | String(100) | |
| `document_type` | String(20) | |
| `document` | String(30) | Único |
| `email` | String(255) | Único; se usa como `username` lógico |
| `sex` | String(20) | Opcional |
| `blood_type` | String(5) | Opcional; **no está en las migraciones Alembic actuales** |
| `telefono` | String(30) | Opcional; agregado por migración `005` |
| `rh` | String(5) | Opcional; agregado por migración `005` |
| `password_hash` | String(255) | bcrypt |
| `photo_profile` | String(500) | Ruta local, por ejemplo `uploads/fotos/user_1.jpg` |
| `user_status` | String(20) | `ACTIVE`, `INACTIVE`, `ACTIVO`, etc. |
| `role_id` | Integer FK `roles.id` | |
| `registration_date` | DateTime(timezone=True) | |

No existe columna `username`. El login acepta email o documento.

#### `fichas`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | |
| `programa_id` | Integer FK `programa_formacion.id` | |
| `number` | String(50) | Número de ficha |
| `director_id` | Integer FK `users.id` | Opcional |
| `centro_id` | Integer FK `centros_formacion.id` | Opcional, `ON DELETE CASCADE` |
| `start_date` | Date | Opcional |
| `end_date` | Date | Opcional |

#### `matriculas`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | |
| `user_id` | Integer FK `users.id` | `ON DELETE CASCADE` |
| `ficha_id` | Integer FK `fichas.id` | `ON DELETE CASCADE` |
| `status` | String(20) | Default `activa` |
| `registration_date` | DateTime(timezone=True) | Default `CURRENT_TIMESTAMP` |
| `withdrawal_date` | DateTime(timezone=True) | Opcional |
| — | Unique | `(user_id, ficha_id)` |

#### `sesiones`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | |
| `ficha_id` | Integer FK `fichas.id` | |
| `instructor_id` | Integer FK `users.id` | |
| `description` | Text | Opcional |
| `session_date` | Date | |
| `start_time` | Time | |
| `end_time` | Time | |
| `status` | String(20) | Por ejemplo `en_curso` |
| `qr_token` | String(255) | Opcional |
| `qr_expires_at` | DateTime(timezone=True) | Opcional |

#### `eventos`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | |
| `name` | String(200) | |
| `description` | Text | Opcional |
| `date` | Date | |
| `time` | Time | |
| `capacity_people` | Integer | Opcional |

#### `asistencias`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | |
| `session_id` | Integer FK `sesiones.id` | Opcional |
| `event_id` | Integer FK `eventos.id` | Opcional |
| `user_id` | Integer FK `users.id` | |
| `status` | String(20) | |
| `time` | DateTime(timezone=True) | |
| `observations` | Text | Opcional |

#### `audit_logs`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | |
| `user_id` | Integer FK `users.id` | No nulo |
| `accion` | String(100) | |
| `detalles` | Text | Opcional |
| `created_at` | DateTime(timezone=True) | |

#### `verification_codes`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | |
| `user_id` | Integer FK `users.id` | |
| `code` | String(6) | Código 2FA en texto plano |
| `expires_at` | DateTime(timezone=True) | |
| `used` | Boolean | Default `false` |
| `attempts` | Integer | Default `0` |
| `created_at` | DateTime(timezone=True) | |

#### `carnets`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | |
| `user_id` | Integer FK `users.id` | |
| `qr_code` | String(500) | Token QR impreso |
| `issue_date` | Date | |
| `expiration_date` | Date | |

No existe columna `status`. El estado se deriva de `expiration_date`.

#### `password_reset_tokens`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | Integer PK | |
| `user_id` | Integer FK `users.id` | `ON DELETE CASCADE` |
| `jti_hash` | String(64) | Hash del `jti`, no el token |
| `expires_at` | DateTime(timezone=True) | |
| `used` | Boolean | Default `false` |
| `created_at` | DateTime(timezone=True) | |

### 6.2 Relaciones principales

```text
roles 1 ─── N users
users 1 ─── N matriculas N ─── 1 fichas N ─── 1 programa_formacion
fichas N ─── 1 centros_formacion
users 1 ─── N sesiones (instructor)
fichas 1 ─── N sesiones
sesiones 1 ─── N asistencias
eventos 1 ─── N asistencias
users 1 ─── N asistencias
users 1 ─── N carnets
users 1 ─── N verification_codes
users 1 ─── N password_reset_tokens
users 1 ─── N audit_logs
```

### 6.3 Migraciones Alembic

| Revisión | Archivo | `down_revision` | Contenido |
|---|---|---|---|
| `001_initial_schema` | `001_initial_schema.py` | `None` | 12 tablas base: roles, centros, programas, users, fichas, matriculas, sesiones, eventos, asistencias, audit_logs, verification_codes, carnets |
| `004` | `004_add_password_reset_tokens.py` | `001_initial_schema` | `password_reset_tokens` |
| `005` | `005_add_telefono_rh_users.py` | `004` | Agrega `telefono` y `rh` a `users` |

Observaciones:

- No existen revisiones `002` ni `003` en el repositorio, aunque el código menciona “migración 003” para `qr_carnets`.
- `001` no crea `users.blood_type`, pero los modelos, `UserService`, `CarnetService` y varios reportes consultan esa columna.
- `qr_carnets` y `access_logs` no están en ninguna migración; el código las usa de forma defensiva.
- `alembic upgrade head` sobre una base vacía no reproduce el esquema que espera el código. Para desarrollo local se usa `base.sql` como referencia física, pero es un volcado binario ignorado por Git.

### 6.4 `base.sql`

`base.sql` es un volcado de PostgreSQL en formato custom (`PGDMP`), no SQL de texto ejecutable directamente. Su cabecera corresponde a PostgreSQL 18.x. Está ignorado por `.gitignore`, por lo que no se distribuye con el repositorio y no sirve como fuente reproducible para un clon nuevo.

Para restaurarlo se necesita `pg_restore`:

```powershell
pg_restore -d <nombre_db> --no-owner --no-privileges base.sql
```

Si no se dispone de `base.sql`, hay que crear la base con Alembic y aplicar los ajustes manuales indicados en la sección 8.3.

### 6.5 Datos semilla

| Script | Qué hace | Estado |
|---|---|---|
| `seed_roles.py` | Inserta/actualiza los 5 roles y luego intenta `UPDATE users ... WHERE username = 'willi'` | **Falla en la última parte**: `users.username` no existe |
| `seed_coordinadores.py` | Inserta/actualiza roles y 3 coordinadores; usa una contraseña por defecto hardcodeada | Funciona, pero contiene datos personales y credenciales por defecto |
| `seed_programas.py` | Inserta programas de prueba de forma idempotente | Funciona |

Los seeds asumen IDs de rol 1–5. La contraseña por defecto de `seed_coordinadores.py` debe rotarse antes de cualquier despliegue real; el archivo está versionado en Git.

---

## 7. Frontend

### 7.1 Stack

| Dependencia | Versión observada |
|---|---|
| React | `^19.2.8` |
| React DOM | `^19.2.8` |
| React Router DOM | `^7.18.3` |
| Axios | `^1.20.0` |
| TanStack Query | `^5.102.8` |
| Tailwind CSS | `^4.3.3` |
| Vite | `^8.2.2` |
| ESLint | `^10.9.0` |
| lucide-react | `^1.39.0` |
| jsPDF / autotable | `^4.2.1` / `^5.0.8` |
| exceljs | `^4.4.0` |
| canvg | `^4.0.3` |
| react-hot-toast | `^2.6.0` |

### 7.2 Estructura

| Ruta | Contenido |
|---|---|
| `frontend/src/main.jsx` | Punto de entrada; `BrowserRouter`, `QueryClientProvider`, `AuthProvider` |
| `frontend/src/routes/AppRouter.jsx` | Rutas y guards |
| `frontend/src/routes/ProtectedRoute.jsx` | Exige sesión |
| `frontend/src/routes/PermissionRoute.jsx` | Exige permiso |
| `frontend/src/context/AuthContext.jsx` | Estado de autenticación, login, 2FA, refresh silencioso |
| `frontend/src/api/base.js` | Base de API según entorno |
| `frontend/src/api/client.js` | Axios + interceptor de refresh |
| `frontend/src/api/*.js` | Hooks de usuarios, roles, carnets, QR, reportes, etc. |
| `frontend/src/pages/` | Pantallas |
| `frontend/src/components/` | Layout, UI, formularios |
| `frontend/src/constants/roles.js` | Nombres y estilos de roles |
| `frontend/src/constants/permissions.js` | Matriz de permisos |
| `frontend/src/constants/menu.js` | Elementos del menú |
| `frontend/src/utils/session.js` | `localStorage`, expiración, logout |
| `frontend/src/utils/jwt.js` | Decodificación de JWT |
| `frontend/src/lib/carnetMedia.js` | QR/foto para PDF del carnet |

### 7.3 Rutas de la SPA

| Ruta | Componente | Guard / permiso |
|---|---|---|
| `/login` | `Login` | Pública |
| `/forgot-password` | `ForgotPassword` | Pública |
| `/reset-password` | `ResetPassword` | Pública |
| `/` | `Dashboard` | `ProtectedRoute` (sin `PermissionRoute`) |
| `/mi-carnet` | `MiCarnet` | `carnet.view` |
| `/usuarios` | `Usuarios` | `users.read` |
| `/grupos` | `Grupos` | `grupos.read` |
| `/centros` | `Centros` | `centros.read` |
| `/programas` | `Programas` | `programas.read` |
| `/carnets` | `Carnets` | `carnet.write` |
| `/asistencia` | `Asistencia` | `asistencia.grupo.read` |
| `/escanear-clase` | `RegistrarAsistencia` | `asistencia.escanear` |
| `/qr-clase` | `QrClase` | `qr.clase` |
| `/reportes` | `Reportes` | `reports.view` |
| `/validar` | `Validar` | `validar.qr` |
| `*` | `NotFound` | Pública |

`ProtectedRoute` espera `authReady`, exige `isAuthenticated` y redirige a `/login` si no hay sesión. `PermissionRoute` usa `hasPermission(roleName, permission)` y redirige a `/` si el rol no tiene el permiso.

### 7.4 Autenticación en el cliente

1. `Login` llama a `authApi.login(username, password)`.
2. El backend responde `preauth_token`; el contexto pasa a `step = '2fa'`.
3. `Login` muestra el formulario de código; `verifyCode` llama a `verify2fa`.
4. Al recibir tokens, `setSession` guarda `access_token` y `refresh_token` en `localStorage`.
5. `buildUserFromToken` decodifica el access token y arma `{id, username, role_id, role_name}`.
6. El usuario se guarda en `localStorage` bajo `sena_user`.
7. En cada petición, el interceptor agrega `Authorization: Bearer <access_token>`.
8. Si una petición no-auth recibe 401, el interceptor intenta `POST /auth/refresh` una vez; si falla, `hardLogout`.
9. Al arrancar, si el access token está expirado pero hay refresh token, intenta refresh silencioso.
10. `logout` limpia `localStorage` y el estado React; no llama al backend.

### 7.5 Base de API y build

`frontend/src/api/base.js`:

```js
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api');
```

| Entorno | Base usada |
|---|---|
| `npm run dev` | `http://127.0.0.1:8000` |
| Build de producción sin `VITE_API_URL` | `/api` |
| Build con `VITE_API_URL` | El valor configurado |

`VITE_API_URL` se incrusta en el bundle en tiempo de build. Cambiarlo exige volver a construir y desplegar. Si se apunta a un dominio distinto al del frontend, hay que agregar ese dominio a CORS en el backend.

Build local:

```powershell
cd frontend
npm ci
npm run build
```

Salida: `frontend/dist/`. Vite no tiene proxy configurado en `vite.config.js`; el frontend usa la URL absoluta del backend en desarrollo.

### 7.6 Pantallas y funciones

| Pantalla | Función |
|---|---|
| `Login` | Login + 2FA |
| `ForgotPassword` / `ResetPassword` | Recuperación de contraseña |
| `Dashboard` | Resumen según rol |
| `MiCarnet` | Carnet propio, QR, PDF, onboarding de perfil |
| `Usuarios` | Listado, búsqueda, creación, edición, importación Excel, fotos, estados masivos |
| `Grupos` | Fichas/grupos, estudiantes, docentes |
| `Centros` | CRUD de centros |
| `Programas` | CRUD de programas |
| `Carnets` | Listado, generación, regeneración, PDF |
| `Asistencia` | Consulta de asistencia, tardanzas, inasistencias, importación |
| `RegistrarAsistencia` | Escaneo de QR de clase (Aprendiz) |
| `QrClase` | Generación de QR de clase (Docente) |
| `Reportes` | Reportes y exportaciones |
| `Validar` | Validación de QR de carnet (Validador/Coordinador) |
| `NotFound` | 404 de la SPA |

### 7.7 Limitaciones del frontend

- Tokens en `localStorage` (riesgo ante XSS).
- Sin endpoint de logout en el backend.
- Sin pruebas automatizadas.
- El build no pudo verificarse localmente por falta de memoria de Node.
- Las fotos de perfil se muestran con una URL estática `${API_BASE}/uploads/...`, pero el backend ya no monta `/uploads` (ver limitaciones).
- El interceptor excluye las llamadas que contienen `/auth/` del refresh; si el refresh token expira, el usuario debe volver a iniciar sesión.

---

## 8. Operación local

### 8.1 Prerrequisitos

- Python 3.13 (el `Dockerfile` usa `python:3.13-slim`).
- PostgreSQL accesible; no hay servicio de PostgreSQL en `docker-compose.yml`.
- Node.js y npm para el frontend.
- Redis opcional; si no está, el backend usa memoria.
- SMTP opcional; si no está, el código 2FA se imprime en el log.

### 8.2 Variables de entorno

```powershell
Copy-Item .env.example .env
```

Completar en `.env`:

- `DATABASE_URL` con driver `postgresql+asyncpg://`.
- `SECRET_KEY` y `QR_SECRET` distintos, generados con `secrets.token_urlsafe(48)`.
- Opcionalmente `REDIS_URL`, SMTP y TTLs.

No commitear `.env`. `.gitignore` ya lo excluye.

### 8.3 Base de datos

#### Opción A: restaurar `base.sql`

Si se tiene el volcado local:

```powershell
pg_restore -d <nombre_db> --no-owner --no-privileges base.sql
```

Requiere `pg_restore` compatible con la versión del volcado (PostgreSQL 18.x en la cabecera observada).

#### Opción B: Alembic + ajustes

```powershell
venv\Scripts\activate
alembic upgrade head
```

Luego, si la base no tiene `blood_type` (porque las migraciones no la crean):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_type VARCHAR(5);
```

Si se van a usar validaciones con `qr_carnets` o auditoría con `access_logs`, crear esas tablas según el esquema que espere el código, o aceptar el fallback:

- Sin `qr_carnets`: QR dinámico stateless + Redis/memoria.
- Sin `access_logs`: auditoría en `audit_logs`.
- Sin `audit_logs`: se omite la auditoría.

#### Opción C: base existente

Si ya existe una base con el esquema de `base.sql`, no ejecutar `alembic upgrade head` a ciegas: primero comparar el estado de migraciones (`alembic current`) y las columnas reales.

### 8.4 Seeds

```powershell
python seed_coordinadores.py
python seed_programas.py
```

`seed_roles.py` no debe usarse tal cual: falla al final por `users.username`. `seed_coordinadores.py` ya inserta los roles.

Advertencia: `seed_coordinadores.py` contiene correos personales y una contraseña por defecto hardcodeada. Cambiar la contraseña después del seed y no usar ese script en producción sin revisarlo.

### 8.5 Backend

```powershell
venv\Scripts\activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Verificar:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

Documentación interactiva:

- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/api/docs` (el middleware elimina `/api`)

### 8.6 Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Abrir `http://localhost:5173`. El backend debe estar en `http://127.0.0.1:8000` o ajustar `VITE_API_URL` en `frontend/.env` (ignorado por Git).

### 8.7 Verificación de login local

El login usa `application/x-www-form-urlencoded`:

```powershell
$body = @{ username = "usuario@ejemplo.com"; password = "password" }
Invoke-WebRequest -Method Post -Uri http://127.0.0.1:8000/auth/login -Body $body -ContentType "application/x-www-form-urlencoded"
```

Resultados esperados:

- Credenciales válidas: 200 con `preauth_token`, `requires_2fa: true`.
- Credenciales inválidas: 401.
- Usuario inactivo: 403.
- Bloqueado: 423.
- Ruta inexistente: 404 JSON.

Para completar el flujo:

```powershell
# Reemplazar <PREAUTH> y <CODIGO>
$verify = @{ preauth_token = "<PREAUTH>"; code = "<CODIGO>" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/auth/verify-2fa -Body $verify -ContentType "application/json"
```

Si no hay SMTP, el código aparece en la consola del backend como `>> CODIGO SIMULADO: ... <<`.

### 8.8 Problemas comunes

| Síntoma | Causa probable | Acción |
|---|---|---|
| `ValueError: DATABASE_URL no está configurada` | Falta `.env` o variable en el proceso | Configurar `DATABASE_URL` |
| `ValueError: SECRET_KEY no está configurada` | Falta `SECRET_KEY` | Configurar un secreto real |
| `ValueError: QR_SECRET no está configurada` | Falta `QR_SECRET` | Configurar un secreto distinto de `SECRET_KEY` |
| `column users.blood_type does not exist` | Esquema creado solo con Alembic | Agregar `blood_type` o restaurar `base.sql` |
| Login responde 200 pero no llega correo | SMTP no configurado | Revisar log para código simulado o configurar SMTP |
| Fotos 404 | No hay montaje `/uploads` y la ruta GET está malformada | Ver limitaciones L-05/L-06 |
| Redis no conecta en Docker | URL con usuario en lugar de contraseña | Ver sección 9.3 |
| Frontend no conecta al backend | `VITE_API_URL` o CORS | Revisar `frontend/src/api/base.js` y CORS |

---

## 9. Docker

### 9.1 Dockerfile

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Observaciones:

- No hay `.dockerignore`. `COPY . .` copia `venv/`, `frontend/node_modules/`, `.env`, `uploads/`, `base.sql`, etc. Esto aumenta el tamaño de la imagen y puede incluir secretos locales.
- El contenedor corre como `root`; no hay `USER`.
- No hay `HEALTHCHECK`.
- La imagen no ejecuta el build del frontend ni lo sirve; el frontend se sirve aparte (Vercel) o se construye por separado.

### 9.2 `docker-compose.yml`

Servicios:

| Servicio | Imagen / build | Puertos | Notas |
|---|---|---|---|
| `redis` | `redis:7-alpine` | `6379:6379` | `--requirepass redis_password`; volumen `redis-data` |
| `api` | build `.` | `8000:8000` | `env_file: .env`; `REDIS_URL`; volumen `./uploads:/app/uploads` |

No hay servicio de PostgreSQL. La API usa la `DATABASE_URL` del `.env`, que debe apuntar a una base accesible desde el contenedor.

Si la base corre en el host, dentro del contenedor `localhost` no sirve; usar `host.docker.internal` (Windows/macOS) o el hostname de la red Docker.

### 9.3 Problema probable con la URL de Redis

El compose configura:

```yaml
environment:
  REDIS_URL: redis://redis_password@redis:6379/0
```

En una URL de Redis, la forma `redis://usuario:password@host:puerto/db` interpreta `redis_password` como **usuario**, no como contraseña. Con `requirepass`, lo habitual es:

```text
redis://:redis_password@redis:6379/0
```

Si la autenticación falla, `redis_client` cae al store en memoria y el sistema sigue funcionando, pero se pierden caché distribuida, bloqueos y el set de QR usados. Además, el servicio Redis declara `REDIS_PASSWORD=redis_password` pero el comando usa una contraseña hardcodeada; la variable no se consume.

### 9.4 Recomendaciones de Docker

- Agregar `.dockerignore` con `venv/`, `frontend/node_modules/`, `frontend/dist/`, `.env`, `uploads/`, `base.sql`, `__pycache__/`, `.pytest_cache/`.
- Ejecutar como usuario no root.
- No hornear `.env` en la imagen; usar variables de entorno o secretos.
- Agregar un servicio PostgreSQL o documentar explícitamente que es externo.
- Corregir la URL de Redis y no hardcodear la contraseña.
- Agregar healthcheck de la API.

---

## 10. Despliegue en Vercel

### 10.1 Modelo de despliegue

`vercel.json` define dos servicios:

| Servicio | `root` | Framework | Entrypoint / salida |
|---|---|---|---|
| `app` | `.` | `fastapi` | `main:app` |
| `frontend` | `frontend` | `vite` | `dist/` |

Y dos rewrites de nivel superior:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "app" } },
    { "source": "/(.*)", "destination": { "service": "frontend" } }
  ]
}
```

El servicio `app` además declara:

```json
{
  "routes": [
    {
      "src": "/api/(.*)",
      "transforms": [
        { "type": "request.path", "op": "set", "args": "/$1" }
      ]
    }
  ]
}
```

El servicio `frontend` declara un SPA fallback:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 10.2 Flujo de `/api`

```text
POST https://dominio/api/auth/login
  │
  ├─ rewrite superior: /api/(.*) → service app
  │
  ├─ service app route: src /api/(.*)
  │     transform request.path = /$1 → /auth/login
  │
  ├─ si el transform no se aplica: llega /api/auth/login
  │     StripApiPrefixMiddleware → /auth/login
  │
  └─ FastAPI router /auth/login
```

Ambas capas son necesarias para robustez:

- El transform es la vía prevista por Vercel Services.
- El middleware es el fallback si el servicio recibe la ruta original.

### 10.3 Variables de entorno en Vercel

Configurar en **Project Settings → Environment Variables** (Production, y Preview si se usa):

| Variable | Obligatoria | Notas |
|---|---|---|
| `DATABASE_URL` | Sí | PostgreSQL externa, `postgresql+asyncpg://`; SSL si aplica |
| `SECRET_KEY` | Sí | Secreto largo y aleatorio |
| `QR_SECRET` | Sí | Distinto de `SECRET_KEY` |
| `REDIS_URL` | No | Si se omite, memoria local por instancia |
| `SMTP_HOST` | No | Necesario para 2FA real |
| `SMTP_PORT` | No | 587 por defecto |
| `SMTP_USER` | No | |
| `SMTP_PASSWORD` | No | |
| `SMTP_FROM` | No | Remitente |
| `UPLOAD_DIR` | No | En Vercel el FS es efímero; no usar para persistencia |
| `VITE_API_URL` | No | Build-time del frontend; `/api` o sin definir |

`VITE_API_URL` no debe apuntar a un dominio del backend si CORS no incluye ese dominio. Lo más simple es dejarlo sin definir para que el build use `/api` en el mismo origen.

En local se reprodujo un fallo de arranque por ausencia de `QR_SECRET`: `core/config.py` lanza `ValueError` al importar y el servicio no inicia. Asegurar esa variable en Vercel y redesplegar es parte de la corrección, aunque la causa exacta del 404 de producción sigue sin confirmarse.

### 10.4 Root Directory y build

En Vercel, el **Root Directory del proyecto debe ser la raíz del repositorio** (`.`), no `frontend`. Si se configura `frontend`, Vercel no verá `vercel.json` en la raíz ni el servicio `app`.

El servicio `frontend` tiene su propio `root: "frontend"` dentro de `vercel.json`; eso es distinto del Root Directory del proyecto.

### 10.5 Checklist de despliegue

1. Confirmar que el commit desplegado es `51ced4d` o posterior.
2. Confirmar que el Root Directory del proyecto es `.`.
3. Confirmar que `DATABASE_URL`, `SECRET_KEY` y `QR_SECRET` existen en Production.
4. Confirmar que `QR_SECRET` no es igual a `SECRET_KEY`.
5. Confirmar que `VITE_API_URL` está vacío o vale `/api`.
6. Redesplegar después de cambiar variables (Vite las incrusta en build).
7. Verificar `GET https://<dominio>/api/health`.
8. Verificar `POST https://<dominio>/api/auth/login`.
9. Revisar Runtime Logs del servicio `app` si algo falla.

### 10.6 Verificación

#### Health check

```powershell
curl.exe -i https://<dominio>/api/health
```

Esperado:

```http
HTTP/2 200
content-type: application/json

{"status":"ok","service":"carnets-api","cache":{...}}
```

`GET https://<dominio>/health` probablemente devuelve `index.html` (200 HTML) porque el rewrite superior manda todo lo que no es `/api` al frontend. No usarlo para verificar la API.

#### Login

```powershell
curl.exe -i -X POST https://<dominio>/api/auth/login `
  -H "Content-Type: application/x-www-form-urlencoded" `
  --data "username=usuario@ejemplo.com&password=password"
```

Interpretación:

| Respuesta | Significado |
|---|---|
| 200 JSON con `preauth_token` | Ruta correcta y credenciales válidas; sigue 2FA |
| 401 JSON `Credenciales inválidas` | Ruta correcta; credenciales incorrectas |
| 403 JSON `Usuario inactivo` | Ruta correcta; usuario inactivo |
| 423 JSON | Ruta correcta; cuenta bloqueada |
| 404 JSON `{"detail":"Not Found"}` | FastAPI recibió la petición pero la ruta no coincide |
| 404 HTML | Vercel no encontró el servicio/rewrite, o el deployment falló |
| 500 JSON | La ruta existe; fallo de configuración, base de datos o código |

#### Diagnóstico de un 404

1. **Mirar el `content-type`:**
   - `application/json` + `{"detail":"Not Found"}` → 404 de FastAPI.
   - `text/html` + página de Vercel → 404 del edge/servicio.
2. **Confirmar el deployment:** ¿el commit desplegado incluye `51ced4d`?
3. **Confirmar el Root Directory:** debe ser `.`.
4. **Confirmar que el servicio `app` existe** en el panel de Vercel Services.
5. **Confirmar `vercel.json`:** que el rewrite `/api/(.*)` y el transform `request.path` estén presentes.
6. **Probar `/api/health`:** si también da 404 HTML, el problema es de enrutamiento/servicio, no de login.
7. **Revisar Runtime Logs del servicio `app`:** si no hay logs, la petición no llegó al servicio.
8. **Probar la URL directa del servicio** si Vercel la expone: sirve para separar edge de FastAPI.
9. **Revisar variables de entorno:** si falta `QR_SECRET`, el servicio no arranca y Vercel puede devolver 404/500.
10. **Redesplegar** después de corregir; un deployment fallido puede quedar sirviendo una versión anterior.

La causa exacta del 404 de producción no se pudo confirmar desde este entorno. La corrección de código y configuración está en `51ced4d`; la verificación requiere acceso al panel de Vercel.

### 10.7 Limitaciones de Vercel

| Limitación | Impacto |
|---|---|
| Sistema de archivos efímero | Las fotos en `uploads/` se pierden entre despliegues/instancias |
| Sin volumen persistente | No usar `UPLOAD_DIR` para archivos durables |
| Múltiples instancias | Rate limit, bloqueos y `qr:used` en memoria no son globales |
| Redis opcional | Sin Redis externo, la caché y los locks no se comparten |
| CORS solo localhost | Si el frontend y la API quedan en dominios distintos, falla |
| `services` es una función de Vercel | Requiere que el proyecto tenga el soporte habilitado; no es un `vercel.json` clásico |
| `VITE_API_URL` es build-time | Cambiarla exige nuevo build |
| `/health` no está expuesto en el dominio | Usar `/api/health` |
| Sin SMTP real | El código 2FA se imprime en logs; no usar en producción |

---

## 11. Seguridad

### 11.1 Secretos

- `SECRET_KEY`, `QR_SECRET` y `DATABASE_URL` son obligatorios y se validan al importar.
- `.env` está ignorado por Git; `.env.example` no contiene secretos reales.
- `QR_SECRET` es independiente de `SECRET_KEY`.
- En Vercel, usar variables de entorno del proyecto, no `.env`.
- `seed_coordinadores.py` contiene una contraseña por defecto hardcodeada y correos personales; está versionado. Es un hallazgo a corregir.

### 11.2 Contraseñas y tokens

- bcrypt con 12 rounds.
- JWT HS256 con `SECRET_KEY`.
- Access token de 15 minutos; refresh de 1 día.
- El refresh no se rota: `POST /auth/refresh` devuelve solo un access nuevo.
- No hay revocación de access tokens; un token robado es válido hasta expirar.
- No hay endpoint de logout; el cliente solo borra tokens.
- Los tokens se guardan en `localStorage`, lo que los expone a XSS.

### 11.3 2FA

- Código de 6 dígitos, 5 minutos, máximo 5 intentos.
- Se almacena en texto plano en `verification_codes.code`.
- Si no hay SMTP, el código se registra en el log.
- El preauth token permite verificar o reenviar el código; no permite acceder a endpoints protegidos.
- El código se invalida al usarse y al solicitar uno nuevo.

### 11.4 QR

- HMAC-SHA256 con `QR_SECRET`.
- El QR impreso no expira por tiempo; su vigencia es la del carnet.
- El QR dinámico expira a los 15 minutos y es de un solo uso.
- El “un solo uso” depende de `qr_carnets` o de Redis; sin Redis, el set en memoria es por instancia.
- Si se rota `QR_SECRET`, todos los QR emitidos dejan de validar.

### 11.5 Autorización

- RBAC en backend con dependencias.
- El frontend también aplica permisos, pero no es la única defensa.
- `get_admin_user` y `get_coordinador_user` son iguales; no hay rol Administrador separado.
- `get_funcionario_user` existe pero no se usa.
- Varias rutas de `roles` validan el rol dentro del handler en lugar de usar una dependencia específica; el resultado es equivalente, pero es inconsistente.
- `GET /users/{user_id}` permite a cualquier autenticado consultar cualquier usuario; no hay restricción de “solo el propio” en la lectura. Esto puede exponer datos personales. Revisar si es intencional.

### 11.6 Carga de fotos

- Extensiones permitidas: `.jpg`, `.jpeg`, `.png`, `.webp`.
- Tamaño máximo: 5 MB.
- Nombre determinista `user_{id}{ext}`.
- No se valida el contenido real de la imagen (MIME magic bytes), solo la extensión.
- No se re-encodea la imagen.
- La ruta de escritura es relativa al CWD (`UPLOAD_DIR`).
- El montaje estático público fue eliminado; la lectura debería ser autenticada, pero la ruta GET está malformada.
- En Vercel, el FS es efímero; las fotos no persisten.

### 11.7 CORS y headers

- CORS solo permite localhost.
- No se observan cabeceras de seguridad globales (HSTS, CSP, X-Content-Type-Options, etc.).
- Si el frontend y la API comparten origen, CORS no es el problema; si se separan, hay que configurarlo.

### 11.8 Logging

- `core/logger.py` usa `logging` a stdout.
- Se registran intentos de login con el nombre de usuario.
- `services/email_service.py` imprime bloques con `print` y registra códigos simulados.
- No se observa un sistema de auditoría centralizado; `audit_logs` y `access_logs` son opcionales.
- En producción, evitar registrar códigos 2FA, tokens o contraseñas.

### 11.9 Hallazgos y estado

| Hallazgo | Estado actual |
|---|---|
| Montaje público de `/uploads/fotos` | Eliminado de `main.py` |
| `SECRET_KEY` con default útil | Corregido: ahora es obligatorio |
| `QR_SECRET` derivado de `SECRET_KEY` | Corregido: ahora es obligatorio e independiente |
| Fotos sin control de acceso | Parcial: se eliminó el montaje, pero la ruta GET está malformada y el frontend usa URLs estáticas |
| Tokens en `localStorage` | Sin cambio |
| Sin logout/revocación | Sin cambio |
| Código 2FA en texto plano | Sin cambio |
| Código 2FA en logs si no hay SMTP | Sin cambio |
| Credenciales por defecto en seed | Sin cambio |
| CORS solo localhost | Sin cambio |
| Sin cabeceras de seguridad | Sin cambio |
| `SECURITY_AUDIT_P0P1P2.md` desactualizado | Parcial: describe cambios que ya no coinciden exactamente con el código |

La auditoría histórica `SECURITY_AUDIT_P0P1P2.md` afirma que `QR_SECRET` solo se exigía “cuando hay usuario logueado”; el código actual lo exige siempre al importar. También afirma que la foto se sirve por `GET /users/{user_id}/foto`, pero esa ruta no es la declarada. Usar este manual, no la auditoría, como estado actual.

### 11.10 Recomendaciones prioritarias

1. Rotar la contraseña por defecto de `seed_coordinadores.py` y sacar los correos personales del repositorio.
2. Corregir las rutas de foto a `/users/{user_id}/foto` y implementar almacenamiento durable (S3, R2, Supabase Storage, etc.).
3. Hash de códigos 2FA y no registrarlos en logs.
4. Agregar endpoint de logout y rotación/revocación de refresh tokens.
5. Evaluar cookies `httpOnly` + CSRF si se quiere reducir el riesgo de XSS.
6. Configurar CORS de producción si el frontend y la API no comparten origen.
7. Agregar cabeceras de seguridad en Vercel o en el backend.
8. Agregar `.dockerignore`, usuario no root y healthcheck.
9. Completar migraciones Alembic (`blood_type`, `qr_carnets`, `access_logs`, revisiones 002/003).
10. Agregar pruebas de integración y CI.

---

## 12. Pruebas y calidad

### 12.1 Pruebas automatizadas

```powershell
pytest tests -q
```

Resultado verificado: `1 passed`.

La única prueba, `tests/test_security_auth.py`, verifica que el esquema OpenAPI exponga `HTTPBearer`:

```python
def test_openapi_exposes_http_bearer_scheme():
    schema = app.openapi()
    security_schemes = schema.get("components", {}).get("securitySchemes", {})
    assert "HTTPBearer" in security_schemes
    assert security_schemes["HTTPBearer"]["type"] == "http"
    assert security_schemes["HTTPBearer"]["scheme"] == "bearer"
```

No cubre login, 2FA, RBAC, base de datos, QR, carnets ni reportes.

### 12.2 Scripts manuales

| Script | Requisitos | Qué prueba |
|---|---|---|
| `test_2fa.py` | API en `http://127.0.0.1:8000`, DB, usuario, SMTP o log | Flujo completo de login + 2FA + replay + reenvío |
| `test_email.py` | `.env` con SMTP | Envío de correo y alertas |

`test_2fa.py` lee el último código no usado directamente de `verification_codes`, por lo que requiere acceso a la base.

### 12.3 Smoke tests sugeridos

```powershell
# Salud
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/api/health

# OpenAPI
Invoke-RestMethod http://127.0.0.1:8000/openapi.json | Select-Object -ExpandProperty info

# Login inválido (debe ser 401, no 404)
try {
  Invoke-WebRequest -Method Post -Uri http://127.0.0.1:8000/auth/login `
    -Body @{ username = "noexiste@ejemplo.com"; password = "x" } `
    -ContentType "application/x-www-form-urlencoded"
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

### 12.4 Brechas de prueba

- Sin pruebas de frontend.
- Sin pruebas de integración con PostgreSQL real.
- Sin pruebas de migraciones.
- Sin pruebas de importación Excel.
- Sin pruebas de generación PDF/QR.
- Sin CI que ejecute `pytest`, `npm run build` o ESLint.
- El build de frontend no se pudo verificar localmente por OOM de Node.

---

## 13. Limitaciones e inconsistencias conocidas

| ID | Área | Descripción | Impacto | Recomendación |
|---|---|---|---|---|
| L-01 | Alcance | El blueprint PHP/Laravel/Flutter/MinIO no está implementado | Confusión documental | Usar este manual y el código real |
| L-02 | Documentación | `README.md` solo tiene el título; `frontend/README.md` es plantilla de Vite | Poca orientación | Mantener este manual |
| L-03 | Migraciones | Cadena `001 → 004 → 005`; faltan `002`/`003`; no hay `blood_type`, `qr_carnets` ni `access_logs` | `alembic upgrade head` no reproduce el esquema esperado | Completar migraciones y probar desde cero |
| L-04 | Esquema | `base.sql` es un volcado binario `PGDMP` ignorado por Git | No es reproducible en un clon nuevo | Versionar un esquema SQL textual o migraciones completas |
| L-05 | Fotos | `GET`/`DELETE` declaran `"{user_id}/foto"` sin `/` inicial | Las rutas reales son `/users{user_id}/foto`; `/users/{user_id}/foto` da 404 | Corregir a `"/{user_id}/foto"` |
| L-06 | Fotos | No hay montaje `/uploads`; el frontend arma `${API_BASE}/uploads/...` | Las fotos de perfil no se muestran | Servir por endpoint autenticado o almacenamiento externo, y ajustar el frontend |
| L-07 | Carnets | `carnets` no tiene `status`; `Suspendido` no se soporta | `PATCH .../estado` con `Suspendido` da 400; listados por `Suspendido`/`Inactivo` devuelven vacío | Agregar columna `status` o documentar el comportamiento |
| L-08 | Seeds | `seed_roles.py` usa `users.username`, que no existe | Falla al final del script | Eliminar esa parte o usar `email`/`document` |
| L-09 | Seguridad | `seed_coordinadores.py` tiene correos personales y contraseña por defecto | Credenciales y datos expuestos en Git | Rotar, parametrizar y sacar datos personales |
| L-10 | Docker | URL de Redis `redis://redis_password@...` interpreta usuario, no contraseña; no hay PostgreSQL en compose | Redis puede no autenticar y caer a memoria | Usar `redis://:password@...`; agregar PostgreSQL o documentar externo |
| L-11 | Docker | No hay `.dockerignore`; `COPY . .` incluye `.env`, `venv`, `node_modules` | Imagen grande y posible filtración de secretos | Agregar `.dockerignore` |
| L-12 | Vercel | FS efímero; `uploads/` no persiste | Fotos se pierden | Usar almacenamiento externo |
| L-13 | Redis | Fallback en memoria por instancia | Rate limit, bloqueos y QR de un solo uso no son globales | Redis externo en producción |
| L-14 | CORS | Solo localhost | API en dominio distinto falla | Agregar origen de producción |
| L-15 | 2FA | Código en texto plano; código simulado en logs si no hay SMTP | Riesgo de exposición | Hashear y no loguear |
| L-16 | Sesión | Tokens en `localStorage`; sin logout/revocación | Riesgo XSS y tokens válidos hasta expirar | Cookies httpOnly, logout, rotación |
| L-17 | Pruebas | Solo una prueba backend; sin frontend/CI | Regresiones no detectadas | Agregar pruebas y CI |
| L-18 | Build | `npm run build` no verificable localmente por OOM | No se confirmó el bundle | Probar en CI o máquina con más memoria |
| L-19 | Vercel | 404 de producción no confirmado | Puede seguir fallando | Verificar con el checklist 10.5–10.6 |
| L-20 | Roles | `get_admin_user` y `get_coordinador_user` son iguales; `get_funcionario_user` no se usa | Semántica confusa | Unificar o documentar |
| L-21 | Duplicación | `/attendance` y `/asistencia`, `/reports` y `/reportes` | Dos superficies para lo mismo | Consolidar o marcar alias |
| L-22 | Estado de usuario | Se mezclan `ACTIVE`, `ACTIVO` e `INACTIVE` en consultas y datos | Consultas inconsistentes | Normalizar estados |
| L-23 | Fotos | `UPLOAD_DIR` relativo al CWD; escritura sin verificar contenido real | Archivos en rutas inesperadas; validación débil | Ruta absoluta configurable y validación MIME |
| L-24 | API | `GET /users/{user_id}` permite a cualquier autenticado leer cualquier usuario | Exposición de datos personales | Restringir a propio/Coordinador |
| L-25 | Infra | No hay `.github/` ni pipeline | Sin validación automática | Agregar CI |
| L-26 | Documento | `SECURITY_AUDIT_P0P1P2.md` está parcialmente desactualizado | Conclusiones erróneas | Usar este manual como estado actual |

---

## 14. Próximos pasos recomendados

### Inmediatos (producción)

1. Verificar en Vercel:
   - commit desplegado = `51ced4d` o posterior;
   - Root Directory = `.`;
   - `DATABASE_URL`, `SECRET_KEY`, `QR_SECRET` presentes;
   - `VITE_API_URL` vacío o `/api`;
   - `GET /api/health` = 200 JSON;
   - `POST /api/auth/login` = 200/401, no 404.
2. Si el 404 continúa, capturar:
   - URL exacta;
   - status;
   - `content-type`;
   - cuerpo de respuesta;
   - Runtime Logs del servicio `app`.
3. Configurar SMTP real o aceptar que el 2FA no es utilizable en producción.
4. Rotar la contraseña por defecto de los coordinadores sembrados.

### Corto plazo

1. Corregir las rutas de foto y definir almacenamiento durable.
2. Completar migraciones (`blood_type`, `qr_carnets`, `access_logs`, 002/003).
3. Corregir `seed_roles.py`.
4. Agregar `.dockerignore`, usuario no root y healthcheck.
5. Corregir la URL de Redis del compose.
6. Agregar CORS de producción si hace falta.
7. Agregar pruebas de login/2FA/RBAC y CI.

### Mediano plazo

1. Hash de códigos 2FA y auditoría segura.
2. Logout y revocación/rotación de refresh tokens.
3. Evaluar cookies `httpOnly`.
4. Consolidar endpoints duplicados.
5. Documentar el esquema físico con SQL textual versionado.
6. Agregar cabeceras de seguridad.

---

## Apéndice A. Glosario

| Término | Significado |
|---|---|
| Access token | JWT de corta duración para autorizar peticiones |
| Refresh token | JWT de mayor duración para renovar el access |
| Preauth token | JWT temporal emitido tras validar contraseña, antes del 2FA |
| 2FA | Segundo factor de autenticación por código de correo |
| QR impreso | Token HMAC almacenado en `carnets.qr_code`, sin expiración temporal |
| QR dinámico | Token HMAC con `user_id` y timestamp, válido 15 minutos |
| QR de clase | Token HMAC con `grupo_id` y `docente_id`, válido 15 minutos |
| Ficha | Grupo de formación (`fichas`), usado como “grupo” en la API |
| Matrícula | Relación usuario–ficha (`matriculas`) |
| Coordinador | Rol administrador del sistema |
| Validador | Rol que valida QR de acceso |
| `base.sql` | Volcado binario PostgreSQL usado como referencia local |
| `PGDMP` | Formato custom de `pg_dump`; requiere `pg_restore` |

---

## Apéndice B. Archivos clave

| Archivo | Por qué importa |
|---|---|
| `main.py` | Punto de entrada, middleware `/api`, CORS, rutas de sistema |
| `core/config.py` | Validación de secretos y variables |
| `core/security.py` | JWT, bcrypt, dependencias de rol |
| `core/database.py` | Motor async, sesión, SSL |
| `core/redis_client.py` | Caché y fallback en memoria |
| `core/rate_limit.py` | Rate limit y bloqueo |
| `modules/auth/auth_service.py` | Login, 2FA, refresh, reset |
| `modules/users/user_router.py` | Usuarios, Excel, fotos (con rutas malformadas) |
| `modules/carnet/carnet_service.py` | Carnets, estados derivados |
| `modules/qr/qr_service.py` | QR dinámico y de clase |
| `modules/validation/validation_service.py` | Validación QR y auditoría opcional |
| `modules/attendance/asistencia_service.py` | Asistencia por QR de clase |
| `models/` | Esquema declarativo |
| `alembic/versions/` | Migraciones reales |
| `vercel.json` | Servicios y rewrites de producción |
| `docker-compose.yml` | Redis + API; PostgreSQL externo |
| `frontend/src/api/base.js` | URL de API por entorno |
| `frontend/src/routes/AppRouter.jsx` | Rutas y guards |
| `frontend/src/context/AuthContext.jsx` | Sesión, login, 2FA, refresh |
| `.env.example` | Variables necesarias, sin secretos |

---

**Fin del manual.**
