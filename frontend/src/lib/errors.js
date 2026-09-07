export function getErr(err) {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    const mensajes = detail.map((d) => {
      if (!d) return '';
      if (typeof d === 'string') return d;
      const msg = d.msg || d.message || 'Dato inválido';
      return d.loc ? `${msg} (campo: ${d.loc.join('.')})` : msg;
    });
    return mensajes.filter(Boolean).join(' · ') || 'Datos inválidos';
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || detail.detail || 'Error del servidor';
  }
  return detail || err?.message || 'Error de conexión con el servidor';
}