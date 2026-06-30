import { HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute } from "react";
import styles from "./Input.module.css";

export type InputProps = React.HTMLAttributes<HTMLInputElement> & {
    type?: HTMLInputTypeAttribute;
    autoComplete?: HTMLInputAutoCompleteAttribute;
    name?: string;
    placeholder?: string;
    value?: string;
    label?: string;
    required?: boolean;
};

export const Input: React.FC<InputProps> = ({ className, label, ...props }) => {
    const inputClassName = [styles.Input, className].filter(Boolean).join(" ");

    return label ? (
        <label className={styles.label} htmlFor={props.name} title={label}>
            <span className={styles.labelText}>{label}</span>
            <input {...props} className={inputClassName} />
        </label>
    ) : (
        <input {...props} className={inputClassName} />
    );
};
