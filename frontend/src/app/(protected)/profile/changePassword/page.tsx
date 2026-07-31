import { Metadata } from "next";

import { ChangePasswordForm } from "~/entities/user";
import { makeSeoMetadata } from "~/shared/i18n/seo-metadata";

import styles from "./ChangePasswordPage.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return makeSeoMetadata("common.seoChangePassword");
}

export default async function ChangePasswordPage() {
  return (
    <div className={styles.ChangePasswordPage}>
      <ChangePasswordForm />
    </div>
  );
}
