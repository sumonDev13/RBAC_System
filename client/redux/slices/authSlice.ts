import { createSlice } from "@reduxjs/toolkit";

 const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    accessToken: null,
  },
  reducers: {
    setAuth: (state: { user: any; accessToken: any; }, action: { payload: { user: any; token: any; }; }) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.token;
    },
    logout: (state: { user: null; accessToken: null; }) => {
      state.user = null;
      state.accessToken = null;
    },
  },
});

export const { setAuth, logout } = authSlice.actions;
export const authReducer = authSlice.reducer;