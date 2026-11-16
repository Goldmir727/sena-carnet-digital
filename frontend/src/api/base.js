// Base de la API para el frontend.
//
// En desarrollo se usa el backend local. En producción se usa el subdominio
// dedicado de la API; VITE_API_URL puede sobrescribir este valor.
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://127.0.0.1:8000'
    : 'https://api.carnetisena.com');

export default API_BASE;
