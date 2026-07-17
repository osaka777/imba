"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";

import { AuthForm } from "~/entities/user";
import type { BroadcastAuthMode } from "~/entities/wc-odds/lib/wcBroadcastAuth";
import { PlusIcon } from "~/shared/assets";
import { useLocale } from "~/shared/model/useLocale";
import { Button } from "~/shared/ui";
import { Dialog, DialogContent } from "~/shared/ui/Dialog";

import styles from "./Auth.module.css";

export const Auth = () => {
  const { t } = useLocale();
  const [authModalType, setAuthModalType] = useState<
    "closed" | "login" | "register"
  >("closed");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const auth = params.get("auth");
      if (auth === "register" || auth === "login") {
        setAuthModalType(auth);
      }
    } catch (_) {
      // noop
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onOpenAuth = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: BroadcastAuthMode }>).detail?.mode;
      setAuthModalType(mode === "login" ? "login" : "register");
    };

    window.addEventListener("imba:open-auth", onOpenAuth);
    return () => window.removeEventListener("imba:open-auth", onOpenAuth);
  }, []);

  const openAuthModal =
    (authType: "login" | "register") =>
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setAuthModalType(authType);
    };
  const closeModal = (open: boolean) => {
    if (!open) setAuthModalType("closed");
  };

  const preventCloseOnRegistrationPicker = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-registration-submodal]")) {
      event.preventDefault();
    }
  };

  return (
    <div className={styles.Auth}>
      <Button
        className={clsx(styles.authButton, styles.authLogin)}
        onClick={openAuthModal("login")}
      >
        {t("auth.login")}
      </Button>

      <Button
        className={clsx(styles.authButton, styles.authSignIn)}
        onClick={openAuthModal("register")}
      >
        <span className={styles.icon_wrapper}>
          <PlusIcon className={styles.authSignInIcon} />
        </span>
        {t("auth.register")}
      </Button>

      <Dialog onOpenChange={closeModal} open={authModalType !== "closed"}>
        <DialogContent
          className={styles.authDialog}
          title={
            authModalType === "login"
              ? t("auth.loginTitle")
              : t("auth.registerTitle")
          }
          onInteractOutside={preventCloseOnRegistrationPicker}
          onPointerDownOutside={preventCloseOnRegistrationPicker}
        >
          <AuthForm
            authVariant={authModalType as "login" | "register"}
            className={styles.authForm}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
