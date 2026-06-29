"use client";

import { ToastContainer } from "react-toastify";

import { ToastCloseButton } from "./ToastCloseButton";

export const AppToastContainer = () => (
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
