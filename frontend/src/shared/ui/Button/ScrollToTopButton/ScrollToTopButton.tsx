"use client";

import React from "react";

import { ArrowUpIcon } from "~/shared/assets";

import styles from "./ScrollToTopButton.module.css";

export const ScrollToTopButton = () => {
  const scrollToTop = () => {
    window.scrollTo({
      behavior: "smooth",
      top: 0,
    });
  };

  return (
    <button
      className={`${styles.button} ${styles.darkGradient} ${styles.ChangeLanguageSection_button}`}
      onClick={scrollToTop}
    >
      <ArrowUpIcon height="15" loading="lazy" width="20" />
    </button>
  );
};
