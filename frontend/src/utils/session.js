import { decodeJwt } from './jwt';

export const ACCESS_KEY = 'access_token';
export const REFRESH_KEY = 'refresh_token';
export const USER_KEY = 'sena_user';

export function setSession({ access_token, refresh_token }) {
  if (access_token) setAccessToken(access_token);
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
}

export function setAccessToken(token) {
  localStorage.setItem(ACCESS_KEY, token);
  window.dispatchEvent(new CustomEvent('session:token', { detail: token }));
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent('session:logout'));
}

export function hardLogout() {
  // Solo limpia el storage y avisa: AuthContext resetea el estado React
  // y ProtectedRoute redirige a /login de forma declarativa (sin reload,
  // que en la PWA instalada dejaba pantallas inconsistentes).
  clearSession();
}

/** true si el JWT ya expiró (o es inválido). leewaySec da margen en segundos. */
export function isTokenExpired(token, leewaySec = 30) {
  if (!token) return true;
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return true;
  return payload.exp * 1000 <= Date.now() + leewaySec * 1000;
}
