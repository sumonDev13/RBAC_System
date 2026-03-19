"use client";

import { Provider } from "react-redux";
import { store } from "@/redux/store";
import { useEffect } from "react";
import { refreshThunk, meThunk } from "@/redux/slices/authSlice";

function BootstrapAuth() {
  useEffect(() => {
    (async () => {
      const refresh = await store.dispatch(refreshThunk());
      if (refresh.meta.requestStatus === "fulfilled") {
        const token = (refresh.payload as any).accessToken as string;
        await store.dispatch(meThunk({ token }));
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
