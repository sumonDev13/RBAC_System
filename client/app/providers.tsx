"use client";

import { Provider } from "react-redux";
import { store } from "@/redux/store";
import { useEffect } from "react";
import { refreshThunk, meThunk } from "@/redux/slices/authSlice";

function BootstrapAuth() {
  useEffect(() => {
    (async () => {
      // Only try refresh if not already authenticated
      if (store.getState().auth.status === "authenticated") return;
      
      const refresh = await store.dispatch(refreshThunk());
      if (refresh.meta.requestStatus === "fulfilled") {
        await store.dispatch(meThunk());
      }
    })();
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <BootstrapAuth />
      {children}
    </Provider>
  );
}
