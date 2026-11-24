import { useState } from 'react';

export const PAGE_SIZE = 20;

/**
 * Paginación local sobre listas ya filtradas/ordenadas.
 * Cambiar `resetKey` (filtro o búsqueda) devuelve la página a 1.
 * La página se limita al total vigente para evitar páginas vacías.
 */
export function usePagination(items, resetKey = '') {
  const [state, setState] = useState({ key: resetKey, page: 1 });

  const total = Array.isArray(items) ? items.length : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = state.key === resetKey ? Math.min(state.page, totalPages) : 1;

  // Ajustar estado derivado durante el render evita efectos con setState y
  // mantiene el reinicio aunque el filtro vuelva a un valor anterior.
  if (state.key !== resetKey || state.page !== page) {
    setState({ key: resetKey, page });
  }

  const start = (page - 1) * PAGE_SIZE;
  const pageRows = (Array.isArray(items) ? items : []).slice(start, start + PAGE_SIZE);
  const setPage = (next) => setState({ key: resetKey, page: next });

  return { page, totalPages, total, pageRows, setPage, start };
}
