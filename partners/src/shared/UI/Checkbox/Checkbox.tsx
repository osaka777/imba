import { CheckIcon } from "@/shared/assets";
import styles from "./Checkbox.module.css";

export type CheckboxProps = {
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    checked?: boolean;
    children?: string;
    value?: string;
    classNames?: {
        Checkbox?: string;
        input?: string;
        iconBox?: string;
        iconBox_checked?: string;
        icon?: string;
        text?: string;
    };
};

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, children, classNames, value }) => {
    return (
        <label className={`${styles.Checkbox} ${classNames?.Checkbox}`}>
            <input
                value={value}
                className={`${styles.input} ${classNames?.input}`}
                type="checkbox"
                checked={checked}
                onChange={onChange}
            />
            <div
                className={`${styles.iconBox} ${classNames?.iconBox} ${checked && `${styles.iconBox_checked} ${classNames?.iconBox_checked}`}`}
            >
                {checked ? <CheckIcon className={`${styles.icon} ${classNames?.icon}`} /> : ""}
            </div>
            <span className={`${styles.text} ${classNames?.text}`}>{children}</span>
        </label>
    );
};
