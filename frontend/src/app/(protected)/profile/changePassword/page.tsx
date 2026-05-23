import { Metadata } from "next";

import { ChangePasswordForm } from "~/entities/user";
import { makeMetadata } from "~/shared/lib";

import styles from "./ChangePasswordPage.module.css";

export const metadata: Metadata = makeMetadata("Изменить пароль");

export default async function ChangePasswordPage() {
  return (
    <div className={styles.ChangePasswordPage}>
      <ChangePasswordForm />
    </div>
  );
}
