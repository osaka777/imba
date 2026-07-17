"use client";

import React, { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

type ModalSize = "sm" | "md" | "lg";

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    size?: ModalSize;
    /** id for aria-labelledby when the child provides a heading */
    labelledBy?: string;
};

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    children,
    size = "md",
    labelledBy,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener("keydown", handleEscape);
            window.addEventListener("mousedown", handleClickOutside);
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", handleEscape);
            window.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClass =
        size === "sm" ? styles.modal_sm : size === "lg" ? styles.modal_lg : styles.modal_md;

    return createPortal(
        <div className={styles.modalOverlay} role="presentation">
            <div
                className={`${styles.modal} ${sizeClass}`}
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
            >
                <button
                    type="button"
                    className={styles.closeButton}
                    onClick={onClose}
                    aria-label="Закрыть"
                >
                    ×
                </button>
                <div className={styles.modalContent}>{children}</div>
            </div>
        </div>,
        document.body,
    );
};
