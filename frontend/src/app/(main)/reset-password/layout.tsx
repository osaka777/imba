import { makeMetadata } from "~/shared/lib";

export const metadata = makeMetadata("Сброс пароля", { noIndex: true });

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
