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

export const Input: React.FC<InputProps> = (props) => {
    return props.label ? (
        <label className={styles.label} htmlFor={props.name} title={props.label}>
            <span className={styles.labelText}>{props.label}</span>
            <input {...props} className={styles.Input} />
        </label>
    ) : (
        <input {...props} className={styles.Input} />
    );
};
