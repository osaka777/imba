"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";

import { components } from "~/shared/api";
import { Button, Input, LoadingSpinner } from "~/shared/ui";

import { changePassword } from "../../api";
import styles from "./ChangePasswordForm.module.css";

type UpdatePasswordDto = components["schemas"]["UpdatePasswordDto"];

export const ChangePasswordForm = () => {
  const router = useRouter();

  const { isPending, isSuccess, mutateAsync } = useMutation({
    mutationFn: changePassword,
    mutationKey: ["update-password"],
    onError: () => {
      toast("❌ Старый пароль введён неверно");
    },
    onSuccess: () => {
      toast("✅ Пароль успешно изменён");
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
      <h2 className={styles.heading}>{`Смена пароля`}</h2>
      <Input
        className={styles.input}
        label="Старый пароль"
        placeholder="Введите старый пароль..."
        type="password"
        {...register("oldPassword", { required: true })}
      />
      <Input
        className={styles.input}
        label="Новый пароль"
        placeholder="Введите новый пароль..."
        type="password"
        {...register("newPassword", { required: true })}
      />
      <Button
        className={styles.submit}
        disabled={isPending || isSuccess}
        type="submit"
      >
        {`Сменить пароль`}
        {(isPending || isSuccess) && (
          <LoadingSpinner className={styles.loading} />
        )}
      </Button>
    </form>
  );
};
