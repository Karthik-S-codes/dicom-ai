const TOKEN_KEY = 'dicom_ai_auth_token';
const USER_KEY = 'dicom_ai_user';

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getAuthUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token || '');
  localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
