import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage/session'; // sessionStorage — clears on tab close

import authReducer       from './slices/authSlice';
import usersReducer      from './slices/usersSlice';
import permissionsReducer from './slices/permissionsSlice';
import auditReducer      from './slices/auditSlice';

// Only persist auth (access token + user) across page refreshes within session
const authPersistConfig = {
  key:       'auth',
  storage,
  whitelist: ['user', 'accessToken', 'permissions'], // never persist sensitive state beyond this
};

const rootReducer = combineReducers({
  auth:        persistReducer(authPersistConfig, authReducer),
  users:       usersReducer,
  permissions: permissionsReducer,
  audit:       auditReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // redux-persist dispatches these non-serializable actions internally
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export const persistor = persistStore(store);

// ── Types ────────────────────────────────────────────────────────────────────
export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;