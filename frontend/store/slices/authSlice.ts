import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'agent' | 'customer';
  status: string;
}

export interface PermissionAtom {
  atom: string;
  label: string;
  module: string;
}

export interface AuthState {
  user:        AuthUser | null;
  accessToken: string | null;
  permissions: PermissionAtom[];
  isLoading:   boolean;
  isInitialized: boolean;
  error:       string | null;
}

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState: AuthState = {
  user:          null,
  accessToken:   null,
  permissions:   [],
  isLoading:     false,
  isInitialized: false,
  error:         null,
};

// ── Async thunks ──────────────────────────────────────────────────────────────

export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      // Persist access token in memory + cookies for middleware
      setTokenCookies(data.accessToken, []);

      const meRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      });

      const atoms = meRes.data.permissions.map((p: PermissionAtom) => p.atom);
      setTokenCookies(data.accessToken, atoms);

      return {
        user:        data.user,
        accessToken: data.accessToken,
        permissions: meRes.data.permissions,
      };
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || 'Login failed');
    }
  }
);

export const fetchMeThunk = createAsyncThunk(
  'auth/fetchMe',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await api.get('/auth/me');
      const atoms = data.permissions.map((p: PermissionAtom) => p.atom);

      // Refresh cookie-stored atoms for middleware
      const state = (getState() as { auth: AuthState }).auth;
      if (state.accessToken) {
        setTokenCookies(state.accessToken, atoms);
      }

      return { user: data.user, permissions: data.permissions };
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || 'Failed to fetch user');
    }
  }
);

export const refreshTokenThunk = createAsyncThunk(
  'auth/refresh',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/refresh');
      return { accessToken: data.accessToken };
    } catch (err: any) {
      return rejectWithValue('Session expired');
    }
  }
);

export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await api.post('/auth/logout');
    } catch { /* always clear locally */ }
    clearTokenCookies();
  }
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function setTokenCookies(token: string, atoms: string[]) {
  if (typeof document === 'undefined') return;
  document.cookie = `access_token=${token}; path=/; max-age=900; SameSite=Strict`;
  document.cookie = `user_permissions=${JSON.stringify(atoms)}; path=/; max-age=900; SameSite=Strict`;
}

function clearTokenCookies() {
  if (typeof document === 'undefined') return;
  document.cookie = 'access_token=; path=/; max-age=0';
  document.cookie = 'user_permissions=; path=/; max-age=0';
}

// ── Slice ─────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
      setTokenCookies(action.payload, state.permissions.map(p => p.atom));
    },
    clearAuth(state) {
      state.user        = null;
      state.accessToken = null;
      state.permissions = [];
      state.error       = null;
      clearTokenCookies();
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // login
    builder
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.error     = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading     = false;
        state.isInitialized = true;
        state.user          = action.payload.user;
        state.accessToken   = action.payload.accessToken;
        state.permissions   = action.payload.permissions;
        state.error         = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error     = action.payload as string;
      });

    // fetchMe
    builder
      .addCase(fetchMeThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchMeThunk.fulfilled, (state, action) => {
        state.isLoading     = false;
        state.isInitialized = true;
        state.user          = action.payload.user;
        state.permissions   = action.payload.permissions;
      })
      .addCase(fetchMeThunk.rejected, (state) => {
        state.isLoading     = false;
        state.isInitialized = true;
        state.user          = null;
        state.accessToken   = null;
        state.permissions   = [];
      });

    // refresh
    builder
      .addCase(refreshTokenThunk.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        setTokenCookies(action.payload.accessToken, state.permissions.map(p => p.atom));
      })
      .addCase(refreshTokenThunk.rejected, (state) => {
        state.user        = null;
        state.accessToken = null;
        state.permissions = [];
        clearTokenCookies();
      });

    // logout
    builder.addCase(logoutThunk.fulfilled, (state) => {
      state.user        = null;
      state.accessToken = null;
      state.permissions = [];
      state.error       = null;
    });
  },
});

export const { setAccessToken, clearAuth, clearError } = authSlice.actions;
export default authSlice.reducer;