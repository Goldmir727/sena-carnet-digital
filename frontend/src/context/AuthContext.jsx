import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import * as authApi from '../api/auth';
import {
  setSession,
  clearSession,
  getStoredUser,
  setStoredUser,
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
} from '../utils/session';
import { decodeJwt } from '../utils/jwt';
import { ROLE_ID_NAME } from '../constants/roles';
import { AuthContext } from './contexts';

function buildUserFromToken(token) {
  const payload = decodeJwt(token);
  if (!payload) return null;
  return {
    id: payload.user_id,
    username: payload.sub,
    role_id: payload.role_id,
    role_name: ROLE_ID_NAME[payload.role_id] || 'Desconocido',
  };
}

function initialToken() {
  const t = getAccessToken();
  // Si el token guardado ya expiró, no cuenta como sesión válida.
  if (!t || isTokenExpired(t)) return null;
  return t;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const t = initialToken();
    return t ? getStoredUser() : null;
  });
  const [accessToken, setAccessToken] = useState(initialToken);
  const [preauthToken, setPreauthToken] = useState(null);
  const [step, setStep] = useState('login'); // 'login' | '2fa'
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const resetAll = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setPreauthToken(null);
    setStep('login');
  }, []);

  // Sincroniza logouts disparados fuera de React (interceptor 401, otra pestaña).
  useEffect(() => {
    const onToken = (e) => setAccessToken(e.detail);
    const onLogout = () => resetAll();
    const onStorage = (e) => {
      if (e.key === 'access_token' && !e.newValue) resetAll();
    };
    window.addEventListener('session:token', onToken);
    window.addEventListener('session:logout', onLogout);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('session:token', onToken);
      window.removeEventListener('session:logout', onLogout);
      window.removeEventListener('storage', onStorage);
    };
  }, [resetAll]);

  // Arranque: limpia restos expirados e intenta refresh silencioso una vez.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = getAccessToken();
      if (stored && isTokenExpired(stored)) clearSession();
      const valid = getAccessToken();
      if (!valid) {
        const refresh = getRefreshToken();
        if (refresh) {
          try {
            const data = await api.post('/auth/refresh', { refresh_token: refresh }).then((r) => r.data);
            if (!cancelled && data?.access_token) {
              setSession(data);
              setAccessToken(data.access_token);
              const u = buildUserFromToken(data.access_token);
              setUser(u);
              setStoredUser(u);
            }
          } catch {
            if (!cancelled) {
              clearSession();
              resetAll();
            }
          }
        } else {
          clearSession();
          resetAll();
        }
      } else if (!getStoredUser()) {
        const u = buildUserFromToken(valid);
        setUser(u);
        setStoredUser(u);
      }
      if (!cancelled) setAuthReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [resetAll]);

  const buildUser = useCallback((token) => buildUserFromToken(token), []);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const data = await authApi.login(username, password);
      setPreauthToken(data.preauth_token);
      setStep('2fa');
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyCode = useCallback(
    async (code) => {
      if (!preauthToken) throw new Error('Tu sesión de verificación expiró. Inicia sesión de nuevo.');
      setLoading(true);
      try {
        const data = await authApi.verify2fa(preauthToken, code);
        setSession(data);
        setAccessToken(data.access_token);
        const u = buildUser(data.access_token);
        setUser(u);
        setStoredUser(u);
        setStep('login');
        setPreauthToken(null);
        return u;
      } finally {
        setLoading(false);
      }
    },
    [preauthToken, buildUser]
  );

  const resendCode = useCallback(async () => {
    if (!preauthToken) return null;
    const data = await authApi.resend2fa(preauthToken);
    setPreauthToken(data.preauth_token);
    return data;
  }, [preauthToken]);

  const logout = useCallback(() => {
    clearSession();
    resetAll();
  }, [resetAll]);

  const isAuthenticated = Boolean(accessToken && user && !isTokenExpired(accessToken));

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        step,
        authReady,
        isAuthenticated,
        login,
        verifyCode,
        resendCode,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
