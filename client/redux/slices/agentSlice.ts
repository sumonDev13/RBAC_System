import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "@/lib/axios";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolCall {
  name: string;
  args: any;
  result: any;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  provider?: string;
  model?: string;
  timestamp: number;
}

interface AgentState {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
}

// ── Thunk ─────────────────────────────────────────────────────────────────────

export const sendMessageThunk = createAsyncThunk(
  "agent/sendMessage",
  async (message: string, { getState, rejectWithValue }) => {
    const token = (getState() as any).auth.accessToken as string;
    try {
      const { data } = await api.post(
        "/agent/chat",
        { message },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return { question: message, ...data } as {
        question: string;
        answer: string;
        toolCalls: ToolCall[];
        provider: string;
        model: string;
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Agent request failed");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

let _id = 0;
const uid = () => `msg-${++_id}-${Date.now()}`;

const agentSlice = createSlice({
  name: "agent",
  initialState: {
    messages: [],
    loading: false,
    error: null,
  } as AgentState,
  reducers: {
    clearChat(state) {
      state.messages = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessageThunk.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.messages.push({
          id: uid(),
          role: "user",
          content: action.meta.arg,
          timestamp: Date.now(),
        });
      })
      .addCase(sendMessageThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.messages.push({
          id: uid(),
          role: "assistant",
          content: action.payload.answer,
          toolCalls: action.payload.toolCalls,
          provider: action.payload.provider,
          model: action.payload.model,
          timestamp: Date.now(),
        });
      })
      .addCase(sendMessageThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Something went wrong";
        state.messages.push({
          id: uid(),
          role: "assistant",
          content: `Error: ${(action.payload as string) || "Something went wrong"}`,
          timestamp: Date.now(),
        });
      });
  },
});

export const { clearChat } = agentSlice.actions;
export default agentSlice.reducer;
