# Despliegue en Hostinger VPS con Coolify

Guía operativa para desplegar este repositorio en un VPS de Hostinger usando
Coolify. Está basada en los archivos reales del repositorio y en una validación
local del stack completo.

## 1. Qué se va a desplegar

```text
Internet
  │  80/443
  ▼
Coolify (Traefik en el host)
  │
  ▼
web (Nginx)  ── sirve la SPA React
  │
  └── /api/ ──► api (FastAPI :8000)
                    ├── db (PostgreSQL :5432)
                    └── redis (Redis :6379)
```

- Un solo dominio público: el frontend y la API comparten origen.
- `web` es el único servicio con dominio asignado en Coolify.
- `db`, `redis` y `api` quedan en la red interna, sin puertos publicados.
- Los datos de PostgreSQL y las fotos se guardan en volúmenes.

## 2. Archivos que se agregaron

| Archivo | Para qué sirve |
|---|---|
| `docker-compose.coolify.yml` | Stack completo: `db`, `redis`, `api` y `web`. |
| `frontend/Dockerfile` | Build multi-stage de la SPA y servidor Nginx. |
| `frontend/nginx.conf` | Sirve la SPA y proxya `/api/` hacia `api:8000`. |
| `.dockerignore` | Evita copiar `.env`, `venv`, `uploads`, `base.sql`, etc. a la imagen de la API. |
| `frontend/.dockerignore` | Evita copiar `node_modules`, `dist` y `.env` al build del frontend. |

No uses el `docker-compose.yml` existente para Coolify: solo tiene Redis y API,
no incluye PostgreSQL ni el frontend, y su `REDIS_URL` está mal formada.

Estos archivos deben estar commiteados y publicados en la rama que Coolify
clona. Si los dejas solo en el working tree local, Coolify no los verá.

## 3. Requisitos

### VPS

- Ubuntu 24.04 LTS (o Debian 12) limpio.
- Mínimo de Coolify: 2 vCPU, 2 GB RAM, 10 GB de disco.
- Recomendado para este proyecto: **2+ vCPU, 4 GB RAM, 40+ GB NVMe**.
  El build de Vite puede quedarse sin memoria en un VPS de 2 GB; si usas 2 GB,
  agrega swap antes de desplegar.
- Acceso SSH como `root` o un usuario con `sudo`.
- Puertos abiertos: `22`, `80`, `443`. El `8000` solo hace falta para la
  instalación inicial de Coolify.

### Dominio

- Un dominio o subdominio, por ejemplo `carnets.tudominio.com`.
- Registro DNS `A` apuntando a la IPv4 del VPS.
- Si no tienes dominio, para pruebas puedes usar un nombre tipo
  `carnets.TU_IP.nip.io`; para producción usa un dominio propio.
- Si usas Cloudflare, durante la primera emisión del certificado conviene
  desactivar el proxy naranja o usar el modo SSL/TLS `Full (strict)`.

### Repositorio

- El repositorio debe estar en GitHub/GitLab y Coolify debe poder clonarlo.
- Si es privado, configura una deploy key o una GitHub App en Coolify.
- La rama de despliegue es `main`.

## 4. Instalar Coolify en el VPS

Conéctate por SSH:

```bash
ssh root@TU_IP
```

Actualiza el sistema e instala Coolify:

```bash
apt update && apt upgrade -y
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

El instalador crea Docker, la red de Coolify, Traefik y el panel. Al terminar,
abre:

```text
http://TU_IP:8000
```

Crea la cuenta de administrador. El primer usuario que se registra queda como
administrador. Guarda esas credenciales en un gestor de contraseñas.

Comprueba en **Servers** que `localhost` esté validado y que el proxy esté
corriendo. Si no, usa **Validate** o **Start Proxy**.

### Firewall

Si Hostinger ya gestiona el firewall desde hPanel, aplica las mismas reglas
allí. Si usas UFW en el VPS, permite solo lo necesario:

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp   # solo durante la configuración inicial
ufw enable
```

Cuando Coolify tenga un dominio HTTPS propio, cierra el `8000`:

```bash
ufw delete allow 8000/tcp
```

También puedes configurar el dominio del panel en Coolify para no depender del
puerto 8000.

## 5. Crear el recurso en Coolify

1. Crea un proyecto, por ejemplo `sena-carnets`.
2. Entra al entorno `production`.
3. Selecciona **+ New** → **Git Repository** (o el proveedor que uses).
4. Si Coolify pide servidor/destino, elige el servidor `localhost` que instalaste.
5. Pega la URL del repositorio y selecciona la rama `main`.
6. En **Build strategy** elige **Compose**.
7. Configura:
   - **Base Directory:** `/`
   - **Docker Compose Location:** `/docker-compose.coolify.yml`
8. Guarda y revisa que Coolify detecte los cuatro servicios: `db`, `redis`,
   `api` y `web`.

No asignes dominio a `db`, `redis` ni `api`. Solo a `web`.

## 6. Variables de entorno

En el recurso, abre **Environment Variables** y carga los valores. Coolify
detecta las variables declaradas con `${...}` en el Compose; las que usan
`:?` quedan marcadas como obligatorias.

### Obligatorias

| Variable | Ejemplo / regla |
|---|---|
| `POSTGRES_DB` | `carnets` |
| `POSTGRES_USER` | `carnets` |
| `POSTGRES_PASSWORD` | Secreto largo, solo letras y números. |
| `DATABASE_URL` | `postgresql+asyncpg://carnets:TU_PASSWORD@db:5432/carnets` |
| `REDIS_URL` | `redis://redis:6379/0` (sin contraseña; ver nota abajo) |
| `SECRET_KEY` | Secreto largo y aleatorio. |
| `QR_SECRET` | **Distinto** de `SECRET_KEY`. |

`DATABASE_URL` debe usar exactamente el mismo usuario, contraseña y base que
`POSTGRES_*`. Usa una contraseña alfanumérica para no tener que codificar
caracteres especiales en la URL.

Redis se despliega **sin contraseña**: el Compose ya no declara
`REDIS_PASSWORD` ni arranca con `--requirepass`. No hay ninguna credencial de
Redis que recuperar del proyecto; el valor de `REDIS_URL` es simplemente
`redis://redis:6379/0`. Esto es aceptable porque el contenedor no publica
puertos y solo es alcanzable desde la red interna del stack. Si en el futuro
agregas otros servicios a esa red, vuelve a activar `--requirepass` en
`docker-compose.coolify.yml` y usa `redis://:TU_PASSWORD@redis:6379/0`.

Genera secretos con:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

### SMTP (necesario para 2FA real)

| Variable | Ejemplo |
|---|---|
| `SMTP_HOST` | `smtp.tuproveedor.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `usuario@tudominio.com` |
| `SMTP_PASSWORD` | Contraseña o app password. |
| `SMTP_FROM` | `noreply@tudominio.com` |

El código usa `smtplib.SMTP` con STARTTLS, por eso el puerto `587` es el
adecuado. Si dejas SMTP vacío, el código 2FA se imprime en los logs; eso no es
aceptable en producción.

### Opcionales

Las demás variables del Compose tienen valores por defecto y no necesitas
tocarlas: expiración de tokens, límites de login, duración de carnets, etc.
Puedes cambiarlas si tu operación lo requiere.

`VITE_API_URL` también tiene valor por defecto `/api`. Solo cámbiala si el
frontend va a llamar a la API en otro dominio; en ese caso también hay que
ajustar CORS en `main.py`.

### Ejemplo para pegar en bloque

```dotenv
POSTGRES_DB=carnets
POSTGRES_USER=carnets
POSTGRES_PASSWORD=CAMBIA_ESTE_SECRETO
DATABASE_URL=postgresql+asyncpg://carnets:CAMBIA_ESTE_SECRETO@db:5432/carnets
REDIS_URL=redis://redis:6379/0
SECRET_KEY=CAMBIA_POR_UN_SECRETO_LARGO
QR_SECRET=CAMBIA_POR_OTRO_SECRETO_DISTINTO
VITE_API_URL=/api
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@sena.edu.co
```

## 7. Asignar el dominio

1. En el recurso, abre **Domains**.
2. **Add domain**.
3. Servicio: `web`.
4. Dominio: `https://carnets.tudominio.com`.
5. Puerto interno: `80` (si la interfaz lo pide).
6. Guarda y espera a que Coolify emita el certificado Let's Encrypt.

Coolify enruta el dominio al puerto 80 del contenedor `web`. No agregues
`ports: "80:80"` en el Compose: chocaría con Traefik.

## 8. Desplegar

Pulsa **Deploy** y revisa **Deployment Logs**. El orden esperado es:

1. Se construyen las imágenes de `api` y `web`.
2. Arranca `db` y `redis`; ambos deben quedar `healthy`.
3. Arranca `api`; debe quedar `healthy`.
4. Arranca `web`; debe quedar `healthy`.
5. Coolify publica el dominio.

Si `api` no arranca, revisa **Runtime Logs**. Las causas más comunes son:

- Falta `DATABASE_URL`, `SECRET_KEY` o `QR_SECRET`.
- `DATABASE_URL` no coincide con `POSTGRES_*`.
- `REDIS_URL` tiene el formato incorrecto o conserva una contraseña que Redis
  ya no usa (debe ser `redis://redis:6379/0`).
- La base no tiene esquema (ver sección 9).

## 9. Inicializar la base de datos

El contenedor de la API **no ejecuta migraciones automáticamente**. Hay dos
caminos. Elige uno antes de usar la aplicación.

### Opción A: base nueva con Alembic (recomendada para producción)

Abre una terminal del servicio `api` en Coolify (o usa `docker exec`) y ejecuta:

```bash
alembic upgrade head
```

Eso crea las tablas de las revisiones `001`, `004`, `005` y `006`. Las
migraciones actuales **no crean** `users.blood_type`; agrégala a mano:

```bash
# En el servicio db
psql -U carnets -d carnets -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_type VARCHAR(5);"
```

Verifica:

```bash
psql -U carnets -d carnets -c "SELECT version_num FROM alembic_version;"
psql -U carnets -d carnets -c "\d users"
```

Debe aparecer `006` y la columna `blood_type`.

`qr_carnets` y `access_logs` no son obligatorias: el código las usa de forma
defensiva y continúa si no existen. Si las necesitas para auditoría, créalas
con una migración nueva; no las inventes en producción sin revisar el código.

### Opción B: restaurar `base.sql` (si necesitas los datos locales)

`base.sql` es un volcado custom de PostgreSQL 18 y está ignorado por Git. Súbelo
al VPS:

```bash
scp base.sql root@TU_IP:/root/base.sql
```

Copia el archivo al contenedor de PostgreSQL:

```bash
docker ps --format '{{.Names}}' | grep db
docker cp /root/base.sql NOMBRE_CONTENEDOR_DB:/tmp/base.sql
docker exec -i NOMBRE_CONTENEDOR_DB \
  pg_restore -U carnets -d carnets --no-owner --no-privileges /tmp/base.sql
```

El volcado ya trae `users.blood_type` y `password_reset_tokens`, pero su
`alembic_version` dice `001_initial_schema`. **No ejecutes `alembic upgrade head`
directamente**: la revisión `004` intentaría crear `password_reset_tokens` y
fallaría porque ya existe. Haz esto:

```bash
# En el servicio api
alembic stamp 004
alembic upgrade head
```

Eso aplica `005` (teléfono y RH) y `006` (campos QR de eventos). Si tu volcado
trae otra revisión en `alembic_version`, ajusta el `stamp` a la revisión que
corresponda antes de ejecutar `upgrade head`. Comprueba:

```bash
psql -U carnets -d carnets -c "SELECT version_num FROM alembic_version;"
psql -U carnets -d carnets -c "\d users"
psql -U carnets -d carnets -c "\d eventos"
```

### Datos semilla

Con la base creada, ejecuta desde la terminal del servicio `api`:

```bash
python seed_roles.py
python seed_programas.py
```

`seed_roles.py` inserta los cinco roles y luego falla en un `UPDATE` porque
`users.username` no existe; los roles ya quedaron confirmados. Es un bug
conocido del script.

`seed_coordinadores.py` **no se debe ejecutar tal cual en producción**: tiene
una contraseña hardcodeada (`Sena123456`) y correos personales. Si lo usas,
edita antes la contraseña y los correos, y cámbiala después del primer login.
Para producción es mejor crear el primer usuario administrador con una
contraseña propia.

## 10. Verificar el despliegue

Desde tu equipo:

```bash
curl -I https://carnets.tudominio.com/
curl https://carnets.tudominio.com/api/health
curl -I https://carnets.tudominio.com/api/docs
```

Resultados esperados:

- `/` → `200` y HTML de la SPA.
- `/api/health` → `200` con `{"status":"ok","service":"carnets-api",...}`.
- `/api/docs` → `200` con Swagger UI.
- Login desde el navegador → flujo de 2FA; si SMTP está configurado, llega el
  correo. Si no, el código aparece en los logs de `api`.

También puedes comprobar los contenedores:

```bash
docker ps
```

Los cuatro servicios deben estar `Up` y los que tienen healthcheck deben estar
`healthy`.

## 11. Actualizaciones y respaldos

### Actualizar la aplicación

- Si Coolify tiene el webhook de Git configurado, un `git push` a `main`
  dispara el redeploy.
- Si no, usa **Deploy** manualmente.
- Si el cambio incluye migraciones nuevas, ejecuta `alembic upgrade head` en la
  terminal de `api` después del despliegue.

### Respaldo de PostgreSQL

El PostgreSQL de este Compose es un volumen gestionado por Compose, no una base
gestionada por Coolify. Configura un respaldo propio:

```bash
docker exec NOMBRE_CONTENEDOR_DB \
  pg_dump -U carnets -d carnets -Fc -f /tmp/carnets_$(date +%F).dump
docker cp NOMBRE_CONTENEDOR_DB:/tmp/carnets_$(date +%F).dump ./
```

Guarda los respaldos fuera del VPS. Para las fotos, respalda el volumen
`uploads` o usa almacenamiento externo.

## 12. Limitaciones conocidas de este repositorio

- **Migraciones incompletas:** `alembic upgrade head` no crea
  `users.blood_type`; `qr_carnets` y `access_logs` no existen en ninguna
  revisión. La guía indica el ajuste manual.
- **`base.sql` no es reproducible desde Git:** está ignorado y es un volcado
  local. Para producción conviene completar las migraciones.
- **Fotos:** las rutas de foto del backend están incompletas y el frontend
  construye URLs de `/uploads/...`; es probable que algunas fotos devuelvan
  404. No es un problema de Coolify, sino del código.
- **2FA:** sin SMTP real, el código se registra en logs. Configura SMTP antes de
  abrir el sistema a usuarios.
- **Seeds:** `seed_coordinadores.py` contiene credenciales y datos personales.
- **Un solo worker de API:** el `Dockerfile` arranca un único proceso Uvicorn.
  Para más carga, ajusta workers y revisa los límites en memoria de Redis.
- **Backups:** no vienen configurados. El volumen de PostgreSQL no se respalda
  solo por desplegar en Coolify.

## 13. Validación realizada

En este entorno se comprobó:

- `docker compose -f docker-compose.coolify.yml config` con variables de prueba:
  sintaxis válida.
- Build de `frontend/Dockerfile`: correcto; Vite genera `dist/`.
- Build del `Dockerfile` de la API: correcto.
- Stack completo con PostgreSQL 18, Redis, API y Nginx: los cuatro servicios
  arrancan y quedan `healthy`.
- `GET /` devuelve la SPA.
- `GET /api/health` y `GET /health` devuelven `200` con Redis conectado.
- `GET /api/docs` devuelve `200`.
- Tras `alembic upgrade head` + `ALTER TABLE users ADD COLUMN blood_type`, el
  login responde `401` para un usuario inexistente (la ruta y el esquema
  funcionan).

No se pudo probar contra un VPS real ni contra el dominio de producción porque
este entorno no tiene acceso a Hostinger, Coolify ni al DNS.

## 14. Dominio dedicado para la API (`api.carnetisena.com`)

Variante con dos dominios: el frontend en su propio dominio y la API en un
subdominio independiente, sin el prefijo `/api`.

```text
https://carnetisena.com      -> web:80   (SPA React)
https://api.carnetisena.com  -> api:8000 (FastAPI)
```

### DNS

En el registrador del dominio crea:

| Tipo | Nombre | Valor |
|---|---|---|
| `A` | `api` | `93.127.217.129` |
| `A` | `@` (o `www`) | IP del frontend (VPS o Vercel) |

### Coolify

1. En el recurso del stack, **Domains**:
   - `https://api.carnetisena.com` → servicio `api`, puerto interno `8000`.
   - `https://carnetisena.com` → servicio `web`, puerto interno `80` (solo si
     el frontend se sirve desde el VPS; si está en Vercel, no agregues este
     dominio al stack).
2. Deploy y espera el certificado de `api.carnetisena.com`.

### Código

- Frontend: `VITE_API_URL=https://api.carnetisena.com` (build de Vite). El
  valor por defecto en `frontend/src/api/base.js` y `frontend/Dockerfile` ya
  apunta ahí.
- Flutter: `AppConstants._prodApiBaseUrl` usa
  `https://api.carnetisena.com` en builds release. En debug se sigue usando
  `10.0.2.2:8000` (emulador) o `localhost:8000`.
- CORS: `main.py` permite `https://carnetisena.com`,
  `https://www.carnetisena.com` y cualquier subdominio de `carnetisena.com`.
  Si el frontend vive en otro dominio (por ejemplo Vercel), agrégalo a
  `allow_origins` o a `allow_origin_regex`.

### Verificación

```bash
curl https://api.carnetisena.com/health
curl -I https://api.carnetisena.com/docs
curl -X POST https://api.carnetisena.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@tudominio.com","password":"..."}'
```

`/docs` y `/health` deben responder `200`. El login debe devolver `401` para
credenciales incorrectas y el flujo 2FA para las correctas.

El proxy `/api/` de `frontend/nginx.conf` se conserva como compatibilidad para
el esquema de un solo dominio, pero con el subdominio dedicado el frontend ya
no lo usa.

## 15. SEO, páginas públicas e indexación

### Rutas y contenido

- `/`: presentación pública de CarnetiSENA.
- `/guia`: ayuda pública de acceso, carnet y asistencia, sin datos personales.
- `/login`: inicio de sesión, excluido de indexación.
- `/panel`: panel autenticado (antes estaba en `/`). El acceso, el menú Inicio
  y las migas de navegación ya apuntan a `/panel`.
- Las demás rutas privadas conservan sus direcciones y sus permisos.

`npm run build`, dentro de `frontend/`, ejecuta Vite y luego prerenderiza
únicamente las dos páginas públicas. El resultado contiene:

| Archivo de `dist/` | Uso |
|---|---|
| `index.html` | Presentación con contenido legible sin JavaScript |
| `guia/index.html` | Guía pública prerenderizada |
| `app.html` | Shell de las rutas privadas, vacío de datos y con `noindex` |
| `404.html` | Página de error estática con `noindex` |
| `robots.txt` | Permite rastrear y anuncia el sitemap |
| `sitemap.xml` | Solo `https://carnetisena.com/` y `/guia` |

Los metadatos se mantienen en `frontend/src/seo/site.mjs`: título,
descripción, canonical individual, Open Graph, Twitter y datos `WebSite` de
la portada. No se atribuye al proyecto el carácter de portal oficial del SENA.
No se incluyen tokens, identificadores de carnets ni consultas de URL en los
metadatos. El favicon `frontend/public/favicon-sena.png` es una copia derivada
del logo existente, cuadrada de 96 px y con fondo blanco. Para regenerarlo,
con Pillow instalado: `python scripts/generate-favicon.py` desde `frontend/`.

### Despliegue y dominio preferido

1. Reconstruye y despliega **web y api** desde `docker-compose.coolify.yml`.
   No basta reiniciar contenedores anteriores. No requiere migraciones de BD
   ni recompilar Flutter.
2. Mantén `VITE_API_URL=https://api.carnetisena.com` en el build de `web`.
   Las variables `VITE_*` locales pueden sobrescribir el valor por defecto;
   no utilices un `.env` de desarrollo al publicar manualmente `dist/`.
3. La URL preferida es `https://carnetisena.com`. Nginx redirige con `308`
   desde `www` y desde HTTP cuando recibe esos hosts. Los redirects de rutas
   son relativos para no degradar a HTTP detrás de Traefik.
4. En Coolify, ambos nombres (`carnetisena.com` y `www.carnetisena.com`) deben
   llegar a `web:80` y tener certificado TLS válido, incluso si `www` solo
   redirige. Un fallo de TLS ocurre antes de que Nginx pueda redirigir.
5. Si el proxy de Coolify intercepta HTTP con `307`, configura allí una
   redirección **permanente (301 o 308)**. La redirección del contenedor no
   sustituye la del proxy cuando este responde primero.

Se comprobó el 20/11/2026 que la raíz HTTPS respondía `200`, HTTP redirigía
con `307` y la petición a `https://www.carnetisena.com` fallaba por confianza
del certificado desde este equipo. Esas comprobaciones son previas al nuevo
despliegue y no certifican el estado posterior de producción.

La configuración alternativa de `vercel.json` también utiliza `app.html`
solo para las rutas privadas conocidas, sin un catch-all a la portada.
El despliegue real en Vercel queda por verificar; el sitio observado usa Nginx.

### Privacidad e indexación

- Las páginas privadas tienen `noindex` tanto en el HTML inicial como en
  `X-Robots-Tag`, y mantienen `noindex` al navegar sin recargar la página.
- La API agrega `X-Robots-Tag: noindex, nofollow` a sus respuestas, incluidos
  Swagger, OpenAPI, errores y rutas con el prefijo `/api`.
- No se bloquean esas URL con `Disallow`, para que un buscador pueda leer
  las instrucciones de no indexación si las había descubierto previamente.
- `robots.txt` y `noindex` **no son controles de acceso**. La protección real
  sigue siendo la autenticación y autorización existentes.
- Las URL desconocidas devuelven un `404` real en Nginx, no la portada con `200`.

### Verificación tras el despliegue

```bash
curl -I https://carnetisena.com/
curl -I https://carnetisena.com/guia
curl -I https://carnetisena.com/login
curl -I https://carnetisena.com/no-existe
curl -I https://api.carnetisena.com/docs
curl https://carnetisena.com/sitemap.xml
curl -I http://carnetisena.com/
curl -I https://www.carnetisena.com/
```

Esperado: `200` para páginas públicas; `200` con `X-Robots-Tag: noindex` en
login y docs; `404` para una URL inexistente; redirección permanente al dominio
preferido desde las variantes. Comprobar además que `/panel` exige sesión.

En Search Console, envía `https://carnetisena.com/sitemap.xml` e inspecciona
la raíz y `/guia`. Solicita indexación una vez publicado y verificado el
contenido. El título y el favicon de Google pueden tardar en actualizarse y
Google puede seleccionar otros textos para sus resultados.

### Pruebas locales

```bash
cd frontend
npm run build
npm run test:seo
npm run lint
npm run preview -- --host 127.0.0.1 --port 4173
```

Opcional, con Playwright para Python y Chrome instalados, en otra terminal
desde `frontend/`: `python scripts/browser_seo_test.py`. Esta prueba intercepta
la API para simular el acceso y el 2FA, no usa cuentas ni datos de producción.
Comprueba las páginas sin JS, las rutas privadas y anchos 360/375/768 px.
El build probado debe usar el dominio de API de producción indicado arriba.

La portada y la guía obtuvieron localmente **100/100 en SEO, accesibilidad y
buenas prácticas** con Lighthouse. Se verificaron también la configuración y
las respuestas de Nginx con un servidor temporal. Son validaciones locales:
no miden posiciones en Google ni los Core Web Vitals de usuarios reales.

La portada carga la aplicación privada de forma diferida y no consulta la
API. Los módulos de PDF/Excel siguen perteneciendo al panel; Vite advierte
todavía del tamaño de algunos de esos chunks. Tras publicar, mide LCP, INP y
CLS en PageSpeed Insights/Search Console antes de decidir más optimizaciones.
