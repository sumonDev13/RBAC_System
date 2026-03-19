import { createSlice } from "@reduxjs/toolkit";

const permissionSlice = createSlice({
  name: "permissions",
  initialState: {
    list: [],
  },
  reducers: {
    setPermissions: (state, action) => {
      state.list = action.payload;
    },
  },
});

export const { setPermissions } = permissionSlice.actions;
export default permissionSlice.reducer;