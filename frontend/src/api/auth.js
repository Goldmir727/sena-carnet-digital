import api from './client';

export function login(username, password) {
  const body = new URLSearchParams();
  body.append('username', username);
  body.append('password', password);
  return api
    .post('/auth/login', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    .then((r) => r.data);
}

export function verify2fa(preauthToken, code) {
  return api
    .post('/auth/verify-2fa', { preauth_token: preauthToken, code })
    .then((r) => r.data);
}

export function resend2fa(preauthToken) {
  return api
    .post('/auth/resend-2fa', { preauth_token: preauthToken })
    .then((r) => r.data);
}

export function forgotPassword(email) {
  return api.post('/auth/forgot-password', { email }).then((r) => r.data);
}

export function resetPassword(token, newPassword) {
  return api
    .post('/auth/reset-password', { token, new_password: newPassword })
    .then((r) => r.data);
}
