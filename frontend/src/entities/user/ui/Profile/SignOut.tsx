"use client";

import { useRouter } from "next-nprogress-bar";

import { deleteSessionClient } from "~/entities/user";
import { deleteSession } from "~/entities/user/lib/deleteSession";

import styles from "./SignOut.module.css";

export const SignOut = () => {
  const router = useRouter();

  const signOut = async () => {
    deleteSessionClient();
    await deleteSession();
    router.push("/");
    window.location.reload();
  };

  return (
    <button type="button" className={styles.signOutButton} onClick={signOut}>
      <img src="/exit.svg" alt="" className={styles.signOutIcon} />
      <span className={styles.signOutText}>Выйти</span>
    </button>
  );
};
