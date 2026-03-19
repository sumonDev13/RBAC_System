import { configureStore } from "@reduxjs/toolkit";
import { authReducer } from "./slices/authSlice";
import permissionReducer from "./slices/permissionSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    permissions: permissionReducer,
  },
});