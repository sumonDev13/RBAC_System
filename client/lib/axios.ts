// lib/axios.ts
import { store } from "@/redux/store";
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

// attach access token
api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// refresh logic
api.interceptors.response.use(
  res => res,
  async (error) => {
    if (error.response.status === 401) {
      await store.dispatch(refreshTokenThunk());
    }
    return Promise.reject(error);
  }
);

function refreshTokenThunk(): any {
    throw new Error("Function not implemented.");
}
