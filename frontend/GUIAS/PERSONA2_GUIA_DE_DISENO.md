# GUÍA VISUAL PARA PERSONA 2 — PLATAFORMA DE IDENTIDAD DIGITAL SENA

## Versión 5 (Navegación con todos los módulos)

Este documento define el sistema visual **compartido** de la plataforma. La Persona 1 ya implementó los componentes, los tokens y el layout. Tu trabajo: construir los **módulos** con exactamente este mismo lenguaje —entendiendo el sistema como **producto de identidad digital**, no como un CRUD— y mostrando únicamente datos que vengan de los hooks reales.

---

## 0. Filosofía (leer 2 veces)

> "El usuario debe sentir que **está dentro de una plataforma digital de identidad institucional**, no dentro de un CRUD."

Principios:
- **Composición sobre colección de cards.** Nunca apiles 4+ cajas blancas idénticas. Alterna superficies, tamaños y jerarquías.
- **Verde como identidad y acento**, nunca como relleno absoluto. El fondo del sistema es un *canvas* profundo y neutro.
- **Variedad de superficies** (raised / tint / sunken / canvas / dark) para dar profundidad sin ruido.
- **Móvil primero.** Cada pantalla se diseña desde 360px.
- **Movimiento mínimo e intencional.** Nada parpadea.

---

## 0.1 REGLA ABSOLUTA — SOLO DATOS REALES

> "Si no existe en el backend, no existe en el frontend."

- Todo número, etiqueta o estado visible debe venir de un hook de `src/api/*.js` (los hay para auth, users, roles, carnets, attendance, reports, validacion). NUNCA pongas valores hardcodeados ("8 módulos", "Vigente", "Actividad reciente" de relleno).
- Cada endpoint debe estar **registrado y respondiendo en `main.py`** para poder usarse (ver sección 0.2).
- **QR solo real:** usa `carnetQrUrl(id)` / `qrImageUrl(token)` cuando exista dato real. NUNCA pongas QR decorativos/falsos ni motivos de código de barras inventados.
- Sin carnet real → muestra estados reales: `404` de `/carnets/me` → "sin carnet asignado"; `LoadingState`/`ErrorState` correspondientes.

---

## 0.2 Estado real del backend (módulos registrados en `main.py`)

| Módulo frontend | Router backend | Registrado | Hook de datos |
|---|---|---|---|
| `/mi-carnet` | `/carnets/*` | Sí | `useMiCarnet`, `carnetQrUrl`, `carnetPdfUrl` |
| `/usuarios` | `/users/*` | Sí | `useUsers`, `useCreateUser`, etc. |
| `/carnets` | `/carnets/*` | Sí | `useCarnets`, `useGenerarCarnet`, etc. |
| `/reportes` | `/reports/*` | Sí (Coordinador) | `useReporte*`, `exportReporte` |
| `/validar` | `/validate/*` | Sí | `useValidarQr`, `useValidarUuid` |
| `/grupos` | `/grupos/*` | **Pendiente** | `useGrupos`, etc. |
| `/asistencia` | `/asistencia/*` | **Pendiente** | `useAsistenciaGrupo`, etc. |
| `/escanear-clase` | `/asistencia/*`, `/qr/*` | **Pendiente** | `useEscanearAsistencia` |
| `/qr-clase` | `/qr/*` | **Pendiente** | — (fuera de tu scope) |

- **La navegación muestra TODOS los módulos** (dock + accesos rápidos). Son los módulos planeados que el front necesita; sus hooks de datos ya existen en `src/api/*.js`.
- Los módulos **pendientes** tienen hooks y routers como código, pero su router todavía no está registrado en `main.py` (tarea de backend, no del front). Construye su UI igualmente; el backend debe registrar los routers para que respondan de verdad.
- Los datos que muestres siempre deben venir de los hooks existentes. Si el endpoint de un módulo pendiente aún no responde, la UI debe manejar su `LoadingState`/`ErrorState` sin datos inventados.

---

## 1. Tokens — colores (SOLO estos, vía clases utilitarias)

Canónicos SENA (NO cambies ni agregues HEX en componentes):
- `sena-green`, `sena-green-dark`, `sena-green-light`, `sena-yellow`, `sena-bg`, `sena-ink`

Derivados del sistema (ya definidos en `index.css`):
- `canvas` (#F3F6F4) — **fondo base** de la app.
- `sena-tint-50/100/200/300/400` — verdes suaves mezclados sobre neutros (para superficies, iconos, badges).
- `ink-soft` — texto secundario institucional.
- `surface`, `surface-muted`.

Neutros complementarios permitidos: `slate-50` a `slate-700`, `white`.

**Regla absoluta:** en `.jsx` SOLO clases tipo `bg-sena-green`, `text-sena-ink`, `border-sena-tint-200`. PROHIBIDO `bg-[#0F7A4D]` o `text-[#17212B]`.

---

## 2. Tokens — formas

| Token | Valor | Uso |
|---|---|---|
| `rounded-md` | 0.875rem | inputs, botones, chips |
| `rounded-xl` | 1.125rem | superficies pequeñas, iconos |
| `rounded-2xl` | 1.75rem | **superficies de contenido** |
| `rounded-3xl` | 2.25rem | zonas protagonistas (hero) |
| `rounded-pill` | 9999px | badges, avatares |

Sombras (ya en tokens): `shadow-xs`, `shadow-soft`, `shadow-card`, `shadow-raised`, `shadow-overlay`, `shadow-glow`. Regla: **1 sombra por superficie**; usalas suaves. No apiles.

---

## 3. Superficies — jerarquía (rompe el "todo card")

El sistema expone **dos contenedores**:

### `Zone` (para secciones / composición)
Import: `import { Zone } from '../components/ui';`

Variantes:
- `raised` — blanco suave + `shadow-card` (superficie destacada).
- `bordered` — transparente con borde claro (se integra al canvas).
- `tint` — fondo verde Tenue `sena-tint-50` + borde `sena-tint-200` (módulos informativos).
- `sunken` — superficie hundida (lectura, tablas en zonas oscuras).
- `ghost` — sin tratamiento (contenido nativo sobre canvas).
- `dark` — gradiente institucional (hero, zonas protagonistas).

Props: `variant`, `className`, `bleed`.

### `Card` (para contenido aislado / islas)
Import: `import { Card } from '../components/ui';`

Variantes: `default`, `elevated`, `interactive`, `accent` (hero oscuro), `tint`, `flat`, `canvas`, `overlay`.
Props: `title`, `description`, `icon`, `actions`, `padding={false}`.

**Regla de composición:** Usa `Zone` para las secciones de la página y `Card` solo cuando hay contenido que destacar o agrupar de verdad (una tabla, un formulario, un detalle). Nunca todo blanco + borde.

---

## 4. Estadísticas — StatCard

`import { StatCard } from '../components/ui';`

- Forma por defecto: superficie compacta con icono + valor.
- Prop `featured`: versión **protagonista** (fondo institucional oscuro, valor grande) — ÚSALA para un KPI principal, y acompaña con 2–3 compactas. **NUNCA** muestres 4 StatCards idénticas seguidas.
- `accent`: `green | yellow | blue | red | dark | slate`.
- `trend` + `delta` para variación.

---

## 5. Jerarquía tipográfica (escala)

- **Página**: `PageHeader` — `eyebrow` (uppercase tracking `text-sena-green`), `title` (`text-2xl md:text-3xl font-extrabold tracking-tight`), `description` (`text-sm text-slate-500`).
- **Sección**: `SectionTitle` — `title` (`text-base md:text-lg font-bold`), `description`.
- **Valor destacado**: `text-5xl font-extrabold tabular-nums`.
- **Body**: `text-sm text-slate-500/600`.
- **Captions/metadatos**: `text-xs text-slate-400`.

Usa `tracking-tight` en títulos, `italic` nunca. Inter es la única fuente.

---

## 6. Página tipo — plantilla obligatoria para cada módulo

```jsx
import { Plus } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  PageHeader, Zone, Card, SectionTitle, Button, Input, Select, Table,
  StatusBadge, EmptyState, LoadingState, ErrorState, Modal, ConfirmDialog,
  StatCard, useModal, SearchInput,
} from '../components/ui';
import Can from '../components/common/Can';
import * as api from '../api/<modulo>';

export default function Modulo() {
  const { data, isLoading, isError, refetch } = api.useX();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="<Módulo> · Identidad digital"
        title="<Título claro>"
        description="<contexto de producto, no relleno>"
        icon={<Icon />}
        actions={<Can permission="..."><Button icon={Plus} onClick={...}>Nuevo</Button></Can>}
      />

      {/* Resumen: un featured + compactas (no todas iguales) */}
      <Zone variant="raised" className="p-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <StatCard featured icon={...} label="KPI principal" value={...} />
          <StatCard icon={...} label="..." value={...} />
          <StatCard icon={...} label="..." value={...} />
        </div>
      </Zone>

      {/* Cuerpo */}
      <SectionTitle title="Listado" description="..." actions={<SearchInput />} />
      {isLoading
        ? <LoadingState label="Cargando…" />
        : isError
          ? <ErrorState onRetry={refetch} />
          : <Table columns={...} rows={data} emptyTitle="..." emptyMessage="..." emptyIcon={...} />}
    </div>
  );
}
```

**Estados obligatorios** en cada listado: `LoadingState` / `ErrorState(onRetry)` / `Table` con `emptyTitle` + `emptyMessage` (+ botón de acción) / datos / permisos.

**Barra de herramientas (búsqueda nunca estrecha):**
```jsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <SectionTitle title="Listado" description="..." />
  <div className="flex w-full items-center gap-2 sm:w-auto">
    <SearchInput className="w-full sm:w-72 md:w-96" />
    <Can permission="..."><Button icon={Plus}>Nuevo</Button></Can>
  </div>
</div>
```
Regla: la búsqueda usa `w-full` en móvil y mínimo `sm:w-72 / md:w-96` en desktop. Prohibido dejar el buscador en 1/3 del ancho junto a botones apiñados.

---

## 7. Botones

`import { Button } from '../components/ui';`

- `variant`: `primary` (verde, acción principal), `secondary` (blanco+Borde, acción neutra), `ghost` (secundaria), `outline`, `danger`, `dangerGhost`, `success`.
- `size`: `xs | sm | md | lg | icon`.
- `loading`, `disabled`, `icon`, `fullWidth`.
- Hover ya definido en el componente (elevación suave, sin efectos raros).
- Nunca dos `primary` en una misma línea de acciones; uno primario, el resto secundarios.

---

## 8. Formularios

- `Input`, `Select`, `Textarea` con `label` SIEMPRE visible.
- Campo con `error` muestra mensaje rojo bajo el input.
- Agrupación: `grid grid-cols-1 md:grid-cols-2 gap-4` dentro de un `Zone raised` o `Card`.
- Acciones: `Cancelar` (secondary) + `Guardar` (primary, `loading`).
- Placeholders: descriptivos, no reemplazan a labels.
- Errores generales: `toast.error(detail)`; éxito: `toast.success(...)`.

---

## 9. Tablas

`import { Table } from '../components/ui';`

- `columns`: `{ key, label, render(row), align }`.
- `rows`, `keyField`, `onRowClick`, `hover`, `footer`.
- Columna de estado → `StatusBadge` (`activo`, `pendiente`, `emitido`, `presente`, `ausente`, etc.).
- Columna de acciones → `Dropdown` (items con `{label, icon, onClick, danger}`).
- Roles → `Badge variant="green|yellow|slate"` o `StatusBadge`.
- **Móvil:** si la tabla tiene >4 columnas, muestra **cards apiladas** en móvil (grid `sm:grid-cols-2`) en lugar de hacer scroll infinito. O usa `overflow-x-auto` solo para tablas de hasta ~5 columnas en tablets.

---

## 10. Modales y confirmaciones

- Crear/editar: `Modal` (`size="md|lg"`, `title`, `description`, `footer` con acciones).
- Destructiva: `ConfirmDialog` (`destructive`, `loading`).
- `useModal(initial)` devuelve `{ isOpen, open, close, toggle }`.

---

## 11. Estados vacíos, carga, error

- Vacío: `EmptyState` (`title`, `message`, `icon`, `action`). Debe ser útil, NUNCA parecer error.
- Carga: `LoadingState` o `Skeleton` (filas de pulso suave).
- Error: `ErrorState` (`onRetry`).
- Permisos: envolver acciones con `<Can permission="...">`.

---

## 12. Animación y microinteracciones

**Permitido (clases del sistema):**
- `animate-fade-up`, `animate-fade-in`, `animate-scale-in`, `animate-slide-in-right`.
- `hover:-translate-y-0.5`, `hover:shadow-card`, `transition-all duration-200`.
- `animate-float-soft` (muy lenta, decorativa), `pulse-calm` (3s, indicador de estado).

**PROHIBIDO:**
- `animate-ping`, `animate-bounce`, parpadeos, cambios de opacidad agresivos.
- Animaciones en hover de elementos con información importante (que no desaparezcan).

---

## 13. Responsive (reglas fijas)

- Contenedor de página: `mx-auto max-w-7xl space-y-8`.
- Grids: `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-3/4`.
- Botonera: tamaños `md`/`lg`, altura ≥ h-9/h-10.
- Formularios: 1 columna móvil → 2 desde `md`.
- Modal del sistema ya se ancla abajo en móvil y centra en desktop.
- **Prohibido overflow horizontal:** revisa a 360px (decora sin salir; usa `overflow-hidden` en zonas con decorativos).

### Navegación — barra flotante inferior (dock, ya implementado)

- La navegación es **`DockNav`**: una píldora alargada, redondeada y oscura (gradiente institucional `bg-sena-dock`) que flota fija abajo-centro. Agrupa los módulos del usuario según sus permisos (los toma de `MENU_ITEMS`).
- Persona 2 **NO** modifica `DockNav` ni `AppLayout`: los módulos aparecen solos en el dock al crear su página y ruta. El dock muestra todos los módulos de `menu.js` según el permiso del usuario.
- Por eso: **no hay sidebar** ni botón hamburguesa. No reproduzcas ningún menú lateral.
- El contenido ocupa **todo el ancho** (`max-w-7xl`) y lleva `pb-32` para que el dock nunca tape botones ni tablas.
- En móvil el dock hace scroll horizontal propio (`scrollbar-none`) — no agregues otra navegación.

---

## 14. Los módulos

> Todas las rutas de los módulos se muestran en la navegación. Los backends de `/mi-carnet`, `/usuarios`, `/carnets`, `/reportes`, `/validar` ya responden y los construyes completos. Los de `/grupos`, `/asistencia`, `/escanear-clase` usan hooks existentes; si su router aún no responde, la página usa `LoadingState`/`ErrorState` reales (tarea de backend: registrar el router en `main.py`).

### 1) `/mi-carnet` → `src/pages/MiCarnet.jsx`
- `useMiCarnet()` de `src/api/carnets.js`.
- Composición: `PageHeader` + grid `lg:grid-cols-5`:
  - Columna grande (col-span-3): la **credencial** como zona protagonista (`Zone dark` o `Card accent`) con monograma, nombre, documento, rol con `StatusBadge`, detalle institucional (líneas finas), y footer con fecha de emisión.
  - Columna lateral (col-span-2): panel del **QR** (`Zone tint`) con `carnetQrUrl(id)` o `qrImageUrl(token)`, botones de descarga PDF/QR, y estado (`StatusBadge`).
- Sin carnet → `EmptyState` + explicación (el coordinador lo emite).

### 2) `/usuarios` → `src/pages/Usuarios.jsx`
- `useUsers()`. `PageHeader` + `SearchInput` + botón "Nuevo usuario" (`<Can users.write>`).
- Tabla: usuario, email, rol (`Badge`), estado (`StatusBadge`), acciones (`Dropdown`).
- `Modal` crear/editar (+ `Select` de rol). `ConfirmDialog` para desactivar.
- Resumen: `StatCard featured` (total) + compactas (activos) — no 4 iguales.

### 3) `/grupos` → `src/pages/Grupos.jsx`
- `useGrupos()`. Card-list o tabla con acciones.
- Detalle en `Modal`: pestañas/secciones Estudiantes + Docentes usando `useGrupoEstudiantes`, `useGrupoDocentes`.
- Asignar/quitar con `useAsignarEstudiantes`, `useQuitarEstudiante`, `useAsignarDocentes`, `useQuitarDocente`.
- Docente: prioriza `useMisGrupos()`.

### 4) `/carnets` → `src/pages/Carnets.jsx`
- `useCarnets(filter)`. Filtro por estado (`Select`).
- Acciones por fila: generar/regenerar (`useGenerarCarnet`/`useRegenerarCarnet`), cambiar estado (`useCambiarEstadoCarnet`), ver QR (`carnetQrUrl(id)` en `Modal`), PDF (`carnetPdfUrl(id)`).
- `StatCard featured` + compactas para el resumen de emisión.

### 5) `/asistencia` → `src/pages/Asistencia.jsx`
- Selector de grupo + `useAsistenciaGrupo(grupoId, range)` y `useAsistenciaStats(grupoId)`.
- `StatCard`s (presentes/ausentes/tarde). Tabla con `StatusBadge`.
- Rango: inputs `type="date"`. Subir Excel: `useSubirExcel({grupo_id, file})`.

### 6) `/escanear-clase` → `src/pages/RegistrarAsistencia.jsx`
- `useEscanearAsistencia()` (mutation).
- **Estados muy visibles:** lectura → éxito (banda verde con `CheckCircle2`) / error (banda roja con icono + `detail`).
- Zona protagonista para el scanner (`Zone dark` con patrón sutil y glow) — se siente como un **dispositivo de validación**, no un formulario.

### 7) `/reportes` → `src/pages/Reportes.jsx`
- `useReporteEstadisticas`, `useReporteUsuarios`, `useReporteCarnets(filter)`, `useReporteAsistencias`.
- `StatCard featured` para KPI principal + compactas.
- Exportar: `exportReporte(tipo, formato)` con botones (PDF/XLSX).
- `EmptyState` / `ErrorState` según corresponda.

### 8) `/validar` → `src/pages/Validar.jsx`
- `useValidarQr()` / `useValidarUuid()` de `src/api/validacion.js`.
- Input de token + `ubicacion` opcional (`X-Ubicacion`).
- Panel protagonista de resultado: éxito (verde, datos del carnet) / inválido (rojo) — clara jerarquía.

> La ruta `/qr-clase` NO está en tu scope (queda con `ModulePlaceholder`).

---

## 15. Prohibido (lista de control)

- HEX sueltos en componentes.
- `fetch()`, `axios.create()`, cliente paralelo.
- Duplicar componentes de `src/components/ui` o `src/hooks/useModal`.
- 4+ cards idénticas en fila.
- `animate-ping` / rebotes / parpadeos.
- Tablas ilegibles en móvil sin alternativa.
- Romper `client.js`, `AuthContext`, `ProtectedRoute`, `PermissionRoute`, `permissions`, `roles`, `session`, `jwt`, `AppRouter`.
- Crear hooks de datos que ya existen en `src/api/`.
- Modificar `AppLayout`, `DockNav`, `Navbar`, `Footer`, `Login`, `Dashboard`.
- **QR decorativos/falsos y motivos de código inventados**: el QR solo se muestra cuando viene de un endpoint real (`carnetQrUrl`, `qrImageUrl`).

---

## 16. Verificación antes de terminar

- `npm run build` ✓ · `npm run lint` ✓.
- Prueba manual en 360px (móvil) y desktop.
- Cada módulo: loading / error / vacío / datos / permisos / responsive / tokens.
- Consistencia: `PageHeader` siempre, `Zone` para secciones, `StatCard featured` para KPI principal, `StatusBadge` para estados.
- Sin scrollbar horizontal y sin UI que parpadee.