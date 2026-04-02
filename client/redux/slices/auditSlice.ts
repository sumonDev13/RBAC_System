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
  total: number;
  page: number;
  status: "idle" | "loading" | "error";
  error: string | null;
};

const initialState: AuditState = {
  items: [],
  total: 0,
  page: 1,
  status: "idle",
  error: null,
};

export const fetchAuditThunk = createAsyncThunk<
  { logs: AuditRow[]; total: number; page: number },
  { page?: number; action?: string },
  { rejectValue: string; state: RootState }
>(
  "audit/fetch",
  async (params, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.accessToken;
      const res = await api.get("/audit", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        params: {
          page: params.page || 1,
          limit: 20,
          action: params.action || undefined,
        },
      });
      return {
        logs: res.data?.logs ?? [],
        total: res.data?.total ?? 0,
        page: res.data?.page ?? 1,
      };
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
        state.items = action.payload.logs;
        state.total = action.payload.total;
        state.page = action.payload.page;
      })
      .addCase(fetchAuditThunk.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload ?? "Failed to load audit logs";
      });
  },
});

export default auditSlice.reducer;
