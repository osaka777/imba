"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";

import { AuthForm } from "~/entities/user";
import { PlusIcon } from "~/shared/assets";
import { Button } from "~/shared/ui";
import { Dialog, DialogContent } from "~/shared/ui/Dialog";

import styles from "./Auth.module.css";

export const Auth = () => {
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
      >{`Вход`}</Button>

      <Button
        className={clsx(styles.authButton, styles.authSignIn)}
        onClick={openAuthModal("register")}
      >
        <span className={styles.icon_wrapper}>
          <PlusIcon className={styles.authSignInIcon} />
        </span>
        {`Регистрация`}
      </Button>

      <Dialog onOpenChange={closeModal} open={authModalType !== "closed"}>
        <DialogContent
          className={styles.authDialog}
          title={authModalType === "login" ? "Вход в систему" : "Регистрация"}
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
