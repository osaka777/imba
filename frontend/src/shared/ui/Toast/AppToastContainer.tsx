"use client";

import { useEffect } from "react";
import { ToastContainer } from "react-toastify";

import { applyNativeViewportInsets, isNativeApp } from "~/entities/push/lib/nativeApp";

import { ToastCloseButton } from "./ToastCloseButton";

export const AppToastContainer = () => {
  useEffect(() => {
    const syncInsets = () => {
      if (!isNativeApp()) return;
      applyNativeViewportInsets(window.__IMBA_APP__?.statusBarHeight);
    };

    syncInsets();
    window.addEventListener("imba:app-ready", syncInsets);
    return () => window.removeEventListener("imba:app-ready", syncInsets);
  }, []);

  return (
    <ToastContainer
      autoClose={5000}
      closeButton={ToastCloseButton}
      closeOnClick
      draggable
      hideProgressBar={false}
      icon={false}
      limit={4}
      newestOnTop
      pauseOnFocusLoss
      pauseOnHover
      position="top-right"
      progressClassName="custom-progress"
      rtl={false}
      style={{ zIndex: 99999 }}
      theme="dark"
      toastClassName="custom-toast"
    />
  );
};
