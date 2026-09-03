import { useCallback, useEffect, useState } from 'react';
import * as authApi from '../api/auth';
import {
  setSession,
  clearSession,
  getStoredUser,
  setStoredUser,
  getAccessToken,
} from '../utils/session';
import { decodeJwt } from '../utils/jwt';
import { ROLE_ID_NAME } from '../constants/roles';
import { AuthContext } from './contexts';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [accessToken, setAccessToken] = useState(() => getAccessToken());
  const [preauthToken, setPreauthToken] = useState(null);
  const [step, setStep] = useState('login'); // 'login' | '2fa'
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onToken = (e) => setAccessToken(e.detail);
    window.addEventListener('session:token', onToken);
    return () => window.removeEventListener('session:token', onToken);
  }, []);

  const buildUser = useCallback((token) => {
    const payload = decodeJwt(token);
    if (!payload) return null;
    return {
      id: payload.user_id,
      username: payload.sub,
      role_id: payload.role_id,
      role_name: ROLE_ID_NAME[payload.role_id] || 'Desconocido',
    };
  }, []);

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
    setUser(null);
    setAccessToken(null);
    setPreauthToken(null);
    setStep('login');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        step,
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

