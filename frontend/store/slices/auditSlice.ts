import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/lib/api';

export interface AuditLog {
  id: string;
  action: string;
  metadata: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
  actor_first: string;
  actor_last: string;
  actor_email: string;
  target_first: string;
  target_last: string;
}

interface AuditState {
  logs:      AuditLog[];
  isLoading: boolean;
  error:     string | null;
  page:      number;
}

const initialState: AuditState = {
  logs:      [],
  isLoading: false,
  error:     null,
  page:      1,
};

export const fetchAuditLogsThunk = createAsyncThunk(
  'audit/fetchLogs',
  async (params: { page?: number; action?: string; actor_id?: string } = {}, { rejectWithValue }) => {
    try {
      const q = new URLSearchParams();
      q.set('limit', '30');
      if (params.page)     q.set('page',     String(params.page));
      if (params.action)   q.set('action',   params.action);
      if (params.actor_id) q.set('actor_id', params.actor_id);
      const { data } = await api.get(`/audit?${q.toString()}`);
      return data;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || 'Failed to fetch audit logs');
    }
  }
);

const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditLogsThunk.pending,   (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchAuditLogsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.logs = action.payload.logs;
        state.page = action.payload.page ?? 1;
      })
      .addCase(fetchAuditLogsThunk.rejected,  (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export default auditSlice.reducer;