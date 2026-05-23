"use client";

import React from "react";
import { ArrowUpIcon } from "@/shared/assets";
import styles from "./ScrollToTopButton.module.css";

export const ScrollToTopButton = () => {
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    return (
        <button
            onClick={scrollToTop}
            className={`${styles.button} ${styles.darkGradient} ${styles.ChangeLanguageSection_button}`}
        >
            <ArrowUpIcon loading="lazy" height="15" width="20" />
        </button>
    );
};
