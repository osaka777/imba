"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

import { components } from "~/shared/api";
import { useLocale } from "~/shared/model/useLocale";
import { Button, Input, LoadingSpinner } from "~/shared/ui";

import { changePassword } from "../../api";
import styles from "./ChangePasswordForm.module.css";

type UpdatePasswordDto = components["schemas"]["UpdatePasswordDto"];

export const ChangePasswordForm = () => {
  const router = useRouter();
  const { t } = useLocale();

  const { isPending, isSuccess, mutateAsync } = useMutation({
    mutationFn: changePassword,
    mutationKey: ["update-password"],
    onError: () => {
      toast(t("auth.oldPasswordWrong"));
    },
    onSuccess: () => {
      toast(t("auth.passwordChangedOk"));
      router.push("/");
    },
  });

  const { handleSubmit, register } = useForm<UpdatePasswordDto>({
    defaultValues: { newPassword: "", oldPassword: "" },
  });

  const onSubmit = async (data: UpdatePasswordDto) => {
    await mutateAsync(data);
  };

  return (
    <form
      className={styles.ChangePasswordForm}
      onSubmit={handleSubmit(onSubmit)}
    >
      <h2 className={styles.heading}>{t("auth.changePasswordTitle")}</h2>
      <Input
        className={styles.input}
        label={t("auth.oldPassword")}
        placeholder={t("auth.oldPasswordPlaceholder")}
        type="password"
        {...register("oldPassword", { required: true })}
      />
      <Input
        className={styles.input}
        label={t("auth.newPasswordField")}
        placeholder={t("auth.newPasswordFieldPlaceholder")}
        type="password"
        {...register("newPassword", { required: true })}
      />
      <Button
        className={styles.submit}
        disabled={isPending || isSuccess}
        type="submit"
      >
        {t("auth.changePasswordSubmit")}
        {(isPending || isSuccess) && (
          <LoadingSpinner className={styles.loading} />
        )}
      </Button>
    </form>
  );
};
