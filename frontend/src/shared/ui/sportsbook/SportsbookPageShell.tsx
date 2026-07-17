import type { ReactNode } from "react";
import { cn } from "~/shared/lib";
import styles from "./sportsbook.module.css";

type SportsbookPageShellProps = {
  children: ReactNode;
  className?: string;
};

export function SportsbookPageShell({ children, className }: SportsbookPageShellProps) {
  return <div className={cn(styles.pageShell, className)}>{children}</div>;
}
