import clsx from "clsx";
import React from "react";

import { CheckIcon } from "~/shared/assets";

import styles from "./Checkbox.module.css";

export type CheckboxProps = {
  children?: React.ReactNode;
  classNames?: {
    Checkbox?: string;
    icon?: string;
    iconBox?: string;
    iconBox_checked?: string;
    input?: string;
    text?: string;
  };
} & React.ComponentPropsWithRef<"input">;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ children, classNames, ...props }, ref) => {
    return (
      <label className={clsx(styles.Checkbox, classNames?.Checkbox)}>
        <input
          className={clsx(styles.input, classNames?.input)}
          type="checkbox"
          {...props}
          ref={ref}
        />
        <div
          className={clsx(
            styles.iconBox,
            classNames?.iconBox,
            props.checked && styles.iconBox_checked,
            props.checked && classNames?.iconBox_checked,
          )}
        >
          {props.checked && (
            <CheckIcon className={clsx(styles.icon, classNames?.icon)} />
          )}
        </div>
        <span className={clsx(styles.text, classNames?.text)}>{children}</span>
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
