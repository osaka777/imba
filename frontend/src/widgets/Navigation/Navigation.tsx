"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogoWhiteIcon } from "~/shared/assets";
import { Button } from "~/shared/ui";
import { cn } from "~/shared/lib";
import { Content } from "./Content";
import styles from "./Navigation.module.css";
import { useAuth } from "~/app/providers/AuthProvider";

type NavigationProps = {
  className?: string;
};

export const Navigation = ({ className }: NavigationProps) => {
  const { isAuth } = useAuth();
  const pathname = usePathname();
  const isCybersport = pathname?.startsWith("/cybersport");

  return (
    <nav className={cn(styles.Navigation, isCybersport && "Navigation_cyber", className)}>
      <Button elementType="link" href="/">
        <Image
          alt="Go to home page"
          className={styles.logo}
          height={20}
          src={LogoWhiteIcon}
          width={130}
        />
      </Button>

      <Content isAuth={isAuth} />
    </nav>
  );
};
