import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/redux/slices/authSlice";
import permissionsReducer from "@/redux/slices/permissionSlice";
import usersReducer from "@/redux/slices/usersSlice";
import auditReducer from "@/redux/slices/auditSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    permissions: permissionsReducer,
    users: usersReducer,
    audit: auditReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;