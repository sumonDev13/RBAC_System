import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type PermissionState = {
  atoms: string[];
};

const initialState: PermissionState = {
  atoms: [],
};

const permissionSlice = createSlice({
  name: "permissions",
  initialState,
  reducers: {
    setPermissions(state, action: PayloadAction<string[]>) {
      state.atoms = action.payload;
    },
    clearPermissions(state) {
      state.atoms = [];
    },
  },
});

export const { setPermissions, clearPermissions } = permissionSlice.actions;
export default permissionSlice.reducer;