import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/lib/axios";
import type { RootState } from "@/redux/store";

export type AuditRow = {
  id: string;
  action: string;
  metadata: any;
  ip_address?: string | null;
  created_at: string;
  actor_email?: string | null;
  actor_first?: string | null;
  actor_last?: string | null;
  target_first?: string | null;
  target_last?: string | null;
};

type AuditState = {
  items: AuditRow[];
  status: "idle" | "loading" | "error";
  error: string | null;
};

const initialState: AuditState = {
  items: [],
  status: "idle",
  error: null,
};

export const fetchAuditThunk = createAsyncThunk<AuditRow[], void, { rejectValue: string; state: RootState }>(
  "audit/fetch",
  async (_payload, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.accessToken;
      const res = await api.get("/audit", token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
      return (res.data?.logs ?? []) as AuditRow[];
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message ?? "Failed to load audit logs");
    }
  }
);

const auditSlice = createSlice({
  name: "audit",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchAuditThunk.fulfilled, (state, action) => {
        state.status = "idle";
        state.items = action.payload;
      })
      .addCase(fetchAuditThunk.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload ?? "Failed to load audit logs";
      });
  },
});

export default auditSlice.reducer;

