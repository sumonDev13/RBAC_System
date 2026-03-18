import axios from 'axios';
import { store } from '@/store';
import { setAccessToken, clearAuth } from '@/store/slices/authSlice';
import { refreshTokenThunk } from '@/store/slices/authSlice';

const api = axios.create({
  baseURL:         process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // sends httpOnly refresh cookie automatically
  timeout:         15000,
});

// ── Request: attach access token from Redux store ─────────────────────────────
api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: auto-refresh on 401 ────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else       p.resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      isRefreshing = true;

      try {
        const result = await store.dispatch(refreshTokenThunk());
        if (refreshTokenThunk.fulfilled.match(result)) {
          const newToken = result.payload.accessToken;
          store.dispatch(setAccessToken(newToken));
          processQueue(null, newToken);
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        } else {
          throw new Error('Refresh failed');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        store.dispatch(clearAuth());
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;