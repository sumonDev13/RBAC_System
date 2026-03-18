import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from './index';

// Use throughout the app instead of plain useDispatch / useSelector
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// ── Convenience selectors ─────────────────────────────────────────────────────

export const selectAuth        = (s: RootState) => s.auth;
export const selectUser        = (s: RootState) => s.auth.user;
export const selectAccessToken = (s: RootState) => s.auth.accessToken;
export const selectPermissions = (s: RootState) => s.auth.permissions;
export const selectIsLoading   = (s: RootState) => s.auth.isLoading;
export const selectAuthError   = (s: RootState) => s.auth.error;

export const selectUsers       = (s: RootState) => s.users.list;
export const selectUsersLoading = (s: RootState) => s.users.isLoading;
export const selectUsersError  = (s: RootState) => s.users.error;
export const selectSelectedUser = (s: RootState) => s.users.selectedUser;

export const selectAllPermissions  = (s: RootState) => s.permissions.allPermissions;
export const selectUserPermissions = (s: RootState) => s.permissions.userPermissions;
export const selectPermsSaving     = (s: RootState) => s.permissions.isSaving;
export const selectPermsLoading    = (s: RootState) => s.permissions.isLoading;

export const selectAuditLogs    = (s: RootState) => s.audit.logs;
export const selectAuditLoading = (s: RootState) => s.audit.isLoading;

// ── hasPermission helper ──────────────────────────────────────────────────────
export const selectHasPermission = (atom: string) => (s: RootState) =>
  s.auth.permissions.some(p => p.atom === atom);