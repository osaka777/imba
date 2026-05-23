"use client";
import Image from "next/image";
import { LogoWhiteIcon } from "~/shared/assets";
import { Button } from "~/shared/ui";
import { Content } from "./Content";
import styles from "./Navigation.module.css";
import { useAuth } from "~/app/providers/AuthProvider";

export const Navigation = () => {
  const { isAuth } = useAuth();

  return (
    <nav className={styles.Navigation}>
      <Button elementType="link" href="/">
        <Image
          alt="Go to home page"
          className={styles.logo}
          height={15}
          src={LogoWhiteIcon}
          width={100}
        />
      </Button>

      <Content isAuth={isAuth} />
    </nav>
  );
};
