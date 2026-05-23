"use client";

import { FiLogOut } from "react-icons/fi";
import { useRouter } from "next-nprogress-bar";

import { deleteSessionClient } from "~/entities/user";
import { deleteSession } from "~/entities/user/lib/deleteSession";
import { Button } from "~/shared/ui";

import styles from "./SignOut.module.css";

export const SignOut = () => {
  const router = useRouter();

  const signOut = async () => {
    // Очищаем токен из localStorage и cookies на клиенте
    deleteSessionClient();
    
    // Очищаем токен из cookies на сервере
    await deleteSession();
    
    router.push("/");
    window.location.reload();
  };

  return (
    <Button className={styles.SignOutButton} onClick={signOut}>
      <img src="/exit.svg" alt="exit" className={styles.SignOutIcon} />
      <span className={styles.SignOutText}>Выйти</span>
    </Button>
  );
};
