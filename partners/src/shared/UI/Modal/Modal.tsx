"use client";

import React, { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "../Button";
import styles from "./Modal.module.css";

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
};

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
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
            document.body.style.maxHeight = "100svh";
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.body.style.maxHeight = "unset";
            document.body.style.overflow = "auto";
            window.removeEventListener("keydown", handleEscape);
            window.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <>
            {createPortal(
                <div className={styles.modalOverlay}>
                    <div className={styles.modal} ref={modalRef}>
                        <Button className={styles.closeButton} onClick={onClose}>
                            x
                        </Button>
                        <div className={styles.modalContent}>{children}</div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
};
