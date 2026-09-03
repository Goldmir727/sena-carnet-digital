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
}

export function hardLogout() {
  clearSession();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}
