import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import api from "@/lib/axios";
import { clearPermissions, setPermissions } from "@/redux/slices/permissionSlice";
import type { RootState } from "@/redux/store";

export type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
};

type AuthState = {
  user: User | null;
  accessToken: string | null;
  status: "idle" | "loading" | "authenticated" | "error";
  error: string | null;
};

function setAccessTokenCookie(token: string | null) {
  if (typeof document === "undefined") return;
  if (!token) {
    document.cookie = "accessToken=; path=/; max-age=0";
    return;
  }
  document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; max-age=${15 * 60}`;
}

export const loginThunk = createAsyncThunk<
  { user: User; accessToken: string },
  { email: string; password: string },
  { rejectValue: string }
>("auth/login", async (payload, { rejectWithValue }) => {
  try {
    const res = await api.post("/auth/login", payload);
    const { accessToken, user } = res.data as { accessToken: string; user: User };
    setAccessTokenCookie(accessToken);
    return { user, accessToken };
  } catch (err: any) {
    return rejectWithValue(err?.response?.data?.message ?? "Login failed");
  }
});

export const refreshThunk = createAsyncThunk<{ accessToken: string }, void, { rejectValue: string }>(
  "auth/refresh",
  async (_payload, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/refresh");
      const { accessToken } = res.data as { accessToken: string };
      setAccessTokenCookie(accessToken);
      return { accessToken };
    } catch (err: any) {
      setAccessTokenCookie(null);
      return rejectWithValue(err?.response?.data?.message ?? "Refresh failed");
    }
  }
);

export const meThunk = createAsyncThunk<
  { user: User; permissions: { atom: string }[] },
  { token?: string } | void,
  { rejectValue: string; state: RootState }
>("auth/me", async (payload, { rejectWithValue, dispatch, getState }) => {
  try {
    const token = (payload as any)?.token ?? getState().auth.accessToken;
    const res = await api.get("/auth/me", token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    const { user, permissions } = res.data as { user: User; permissions: { atom: string }[] };
    dispatch(setPermissions(permissions.map((p) => p.atom)));
    return { user, permissions };
  } catch (err: any) {
    return rejectWithValue(err?.response?.data?.message ?? "Failed to load session");
  }
});

export const logoutThunk = createAsyncThunk<void, void, { rejectValue: string; state: RootState }>(
  "auth/logout",
  async (_payload, { rejectWithValue, getState, dispatch }) => {
    try {
      const token = getState().auth.accessToken;
      await api.post("/auth/logout", {}, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      setAccessTokenCookie(null);
      dispatch(clearPermissions());
    } catch (err: any) {
      setAccessTokenCookie(null);
      dispatch(clearPermissions());
      return rejectWithValue(err?.response?.data?.message ?? "Logout failed");
    }
  }
);

const initialState: AuthState = {
  user: null,
  accessToken: null,
  status: "idle",
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<{ user: User; token: string }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.token;
      state.status = "authenticated";
      state.error = null;
      setAccessTokenCookie(action.payload.token);
    },
    clearAuth(state) {
      state.user = null;
      state.accessToken = null;
      state.status = "idle";
      state.error = null;
      setAccessTokenCookie(null);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.status = "authenticated";
        state.error = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload ?? "Login failed";
      })
      .addCase(refreshThunk.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        if (state.status === "idle") state.status = "loading";
      })
      .addCase(refreshThunk.rejected, (state) => {
        state.user = null;
        state.accessToken = null;
        state.status = "idle";
      })
      .addCase(meThunk.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.status = "authenticated";
        state.error = null;
      })
      .addCase(meThunk.rejected, (state) => {
        state.user = null;
        state.accessToken = null;
        state.status = "idle";
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.status = "idle";
        state.error = null;
      });
  },
});

export const { setAuth, clearAuth } = authSlice.actions;
export default authSlice.reducer;