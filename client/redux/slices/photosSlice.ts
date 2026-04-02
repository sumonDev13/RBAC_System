import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "@/lib/axios";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Photo {
  id: string;
  user_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  cloudinary_url: string;
  cloudinary_public_id: string;
  created_at: string;
  owner_email?: string;
  owner_first_name?: string;
  owner_last_name?: string;
}

interface PhotosState {
  items: Photo[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
}

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchMyPhotosThunk = createAsyncThunk(
  "photos/fetchMine",
  async (_, { getState, rejectWithValue }) => {
    const token = (getState() as any).auth.accessToken as string;
    try {
      const { data } = await api.get("/photos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data.photos as Photo[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Failed to load photos");
    }
  }
);

export const uploadPhotosThunk = createAsyncThunk(
  "photos/upload",
  async (files: File[], { getState, rejectWithValue }) => {
    const token = (getState() as any).auth.accessToken as string;
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("photos", file);
      }
      const { data } = await api.post("/photos/upload", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      return data.photos as Photo[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Upload failed");
    }
  }
);

export const deletePhotoThunk = createAsyncThunk(
  "photos/delete",
  async (photoId: string, { getState, rejectWithValue }) => {
    const token = (getState() as any).auth.accessToken as string;
    try {
      await api.delete(`/photos/${photoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return photoId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || "Delete failed");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const photosSlice = createSlice({
  name: "photos",
  initialState: {
    items: [],
    loading: false,
    uploading: false,
    error: null,
  } as PhotosState,
  reducers: {
    clearPhotos(state) {
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchMyPhotosThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMyPhotosThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchMyPhotosThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to load";
      })
      // Upload
      .addCase(uploadPhotosThunk.pending, (state) => {
        state.uploading = true;
        state.error = null;
      })
      .addCase(uploadPhotosThunk.fulfilled, (state, action) => {
        state.uploading = false;
        state.items = [...action.payload, ...state.items];
      })
      .addCase(uploadPhotosThunk.rejected, (state, action) => {
        state.uploading = false;
        state.error = (action.payload as string) || "Upload failed";
      })
      // Delete
      .addCase(deletePhotoThunk.fulfilled, (state, action) => {
        state.items = state.items.filter((p) => p.id !== action.payload);
      });
  },
});

export const { clearPhotos } = photosSlice.actions;
export default photosSlice.reducer;
