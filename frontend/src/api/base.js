// Base de la API para el frontend.
//
// En desarrollo se usa el backend local. En producción se usa /api, que es
// el prefijo público que Vercel redirige al servicio FastAPI. VITE_API_URL
// puede sobrescribir este valor si se necesita apuntar a otro dominio.
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api');

export default API_BASE;
