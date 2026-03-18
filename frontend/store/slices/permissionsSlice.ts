import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/lib/api';

export interface Permission {
  id: string;
  atom: string;
  label: string;
  module: string;
  description?: string;
}

export interface UserPermission extends Permission {
  granted: boolean;
  granted_by?: string;
  override_at?: string;
}

interface PermissionsState {
  allPermissions:  Permission[];        // all atoms in the system
  userPermissions: UserPermission[];    // resolved for the selected user
  isLoading:       boolean;
  isSaving:        string | null;       // permission id being saved
  error:           string | null;
  targetUserId:    string | null;
}

const initialState: PermissionsState = {
  allPermissions:  [],
  userPermissions: [],
  isLoading:       false,
  isSaving:        null,
  error:           null,
  targetUserId:    null,
};

// Fetch all available atoms
export const fetchAllPermissionsThunk = createAsyncThunk(
  'permissions/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/permissions');
      return data.permissions as Permission[];
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || 'Failed to load permissions');
    }
  }
);

// Fetch resolved permissions for a specific user
export const fetchUserPermissionsThunk = createAsyncThunk(
  'permissions/fetchForUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/users/${userId}/permissions`);
      return { userId, permissions: data.permissions as UserPermission[] };
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || 'Failed to fetch user permissions');
    }
  }
);

// Toggle a single permission atom for a user
export const togglePermissionThunk = createAsyncThunk(
  'permissions/toggle',
  async (
    { userId, permissionId, granted }: { userId: string; permissionId: string; granted: boolean },
    { rejectWithValue }
  ) => {
    try {
      await api.put(`/users/${userId}/permissions`, {
        permissions: [{ permission_id: permissionId, granted }],
      });
      return { permissionId, granted };
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || 'Failed to update permission');
    }
  }
);

const permissionsSlice = createSlice({
  name: 'permissions',
  initialState,
  reducers: {
    optimisticToggle(state, action: PayloadAction<{ permissionId: string; granted: boolean }>) {
      const p = state.userPermissions.find(p => p.id === action.payload.permissionId);
      if (p) p.granted = action.payload.granted;
    },
    clearPermissionsError(state) { state.error = null; },
    clearUserPermissions(state) {
      state.userPermissions = [];
      state.targetUserId    = null;
    },
  },
  extraReducers: (builder) => {
    // all permissions
    builder
      .addCase(fetchAllPermissionsThunk.fulfilled, (state, action) => {
        state.allPermissions = action.payload;
      });

    // user permissions
    builder
      .addCase(fetchUserPermissionsThunk.pending, (state) => {
        state.isLoading = true; state.error = null;
      })
      .addCase(fetchUserPermissionsThunk.fulfilled, (state, action) => {
        state.isLoading       = false;
        state.userPermissions = action.payload.permissions;
        state.targetUserId    = action.payload.userId;
      })
      .addCase(fetchUserPermissionsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error     = action.payload as string;
      });

    // toggle
    builder
      .addCase(togglePermissionThunk.pending, (state, action) => {
        state.isSaving = action.meta.arg.permissionId;
      })
      .addCase(togglePermissionThunk.fulfilled, (state, action) => {
        state.isSaving = null;
        const p = state.userPermissions.find(p => p.id === action.payload.permissionId);
        if (p) p.granted = action.payload.granted;
      })
      .addCase(togglePermissionThunk.rejected, (state, action) => {
        state.isSaving = null;
        state.error    = action.payload as string;
      });
  },
});

export const { optimisticToggle, clearPermissionsError, clearUserPermissions } = permissionsSlice.actions;
export default permissionsSlice.reducer;