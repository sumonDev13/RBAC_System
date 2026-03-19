import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/axios";
import type { RootState } from "@/redux/store";

export type UserRow = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  status?: string;
  manager_id?: string | null;
  created_at?: string;
};

type UsersState = {
  items: UserRow[];
  status: "idle" | "loading" | "error";
  error: string | null;
};

const initialState: UsersState = {
  items: [],
  status: "idle",
  error: null,
};

export const fetchUsersThunk = createAsyncThunk<UserRow[], void, { rejectValue: string; state: RootState }>(
  "users/fetch",
  async (_payload, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.accessToken;
      const res = await api.get("/users", token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      return (res.data?.users ?? []) as UserRow[];
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message ?? "Failed to load users");
    }
  }
);

export const createUserThunk = createAsyncThunk<
  UserRow,
  { email: string; password: string; first_name?: string; last_name?: string; role: string; manager_id?: string },
  { rejectValue: string; state: RootState }
>("users/create", async (payload, { rejectWithValue, getState }) => {
  try {
    const token = getState().auth.accessToken;
    const res = await api.post("/users", payload, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    return res.data.user as UserRow;
  } catch (err: any) {
    return rejectWithValue(err?.response?.data?.message ?? "Failed to create user");
  }
});

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsersThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchUsersThunk.fulfilled, (state, action) => {
        state.status = "idle";
        state.items = action.payload;
      })
      .addCase(fetchUsersThunk.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload ?? "Failed to load users";
      })
      .addCase(createUserThunk.fulfilled, (state, action) => {
        state.items = [action.payload, ...state.items];
      });
  },
});

export default usersSlice.reducer;

