import clsx from "clsx";
import React from "react";

import styles from "./Input.module.css";

export type InputProps = {
  label?: string;
  icon?: React.ReactNode;
  variant?: "default" | "pill";
} & React.ComponentPropsWithRef<"input">;

export const Input = React.memo(React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, icon, variant = "default", className, ...props }, ref) => {
    const isPill = variant === "pill";

    return (
      <div className={styles.wrapper}>
        {label && !isPill ? (
          <label className={styles.label} htmlFor={props.name}>
            {label}
          </label>
        ) : null}
        <div
          className={clsx(
            styles.inputWrapper,
            isPill && styles.inputWrapperPill,
          )}
        >
          {icon ? <span className={styles.icon}>{icon}</span> : null}
          <input
            {...props}
            ref={ref}
            className={clsx(styles.Input, isPill && styles.InputPill, className)}
          />
        </div>
      </div>
    );
  },
));

Input.displayName = "Input";
