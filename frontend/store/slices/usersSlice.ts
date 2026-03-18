import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/lib/api';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  manager_id: string | null;
  created_at: string;
}

interface UsersState {
  list:        User[];
  isLoading:   boolean;
  error:       string | null;
  total:       number;
  page:        number;
  selectedUser: User | null;
}

const initialState: UsersState = {
  list:         [],
  isLoading:    false,
  error:        null,
  total:        0,
  page:         1,
  selectedUser: null,
};

export const fetchUsersThunk = createAsyncThunk(
  'users/fetchAll',
  async (params: { page?: number; role?: string; status?: string } = {}, { rejectWithValue }) => {
    try {
      const q = new URLSearchParams();
      if (params.page)   q.set('page',   String(params.page));
      if (params.role)   q.set('role',   params.role);
      if (params.status) q.set('status', params.status);
      const { data } = await api.get(`/users?${q.toString()}`);
      return data;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || 'Failed to fetch users');
    }
  }
);

export const createUserThunk = createAsyncThunk(
  'users/create',
  async (payload: { email: string; password: string; first_name: string; last_name: string; role: string; manager_id?: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/users', payload);
      return data.user as User;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || 'Failed to create user');
    }
  }
);

export const updateUserThunk = createAsyncThunk(
  'users/update',
  async ({ id, payload }: { id: string; payload: Partial<User> }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/users/${id}`, payload);
      return data.user as User;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || 'Failed to update user');
    }
  }
);

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    setSelectedUser(state, action: PayloadAction<User | null>) {
      state.selectedUser = action.payload;
    },
    clearUsersError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsersThunk.pending,   (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchUsersThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list  = action.payload.users;
        state.total = action.payload.total ?? action.payload.users.length;
        state.page  = action.payload.page  ?? 1;
      })
      .addCase(fetchUsersThunk.rejected,  (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(createUserThunk.pending,   (state) => { state.isLoading = true; state.error = null; })
      .addCase(createUserThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.list.unshift(action.payload);
      })
      .addCase(createUserThunk.rejected,  (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    builder
      .addCase(updateUserThunk.fulfilled, (state, action) => {
        const idx = state.list.findIndex(u => u.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export const { setSelectedUser, clearUsersError } = usersSlice.actions;
export default usersSlice.reducer;