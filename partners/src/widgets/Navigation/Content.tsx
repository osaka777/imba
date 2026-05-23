"use client";

import { CloseIcon, MenuIcon } from "@/shared/assets";
import { Button } from "@/shared/UI";
import { useEffect, useState } from "react";
import { Auth } from "./Auth";
import styles from "./Content.module.css";
import { List } from "./List";

type ContentProps = {
    isAuth: boolean;
};

export const Content: React.FC<ContentProps> = ({ isAuth }) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [width, setWidth] = useState<number>(global.innerWidth);

    useEffect(() => {
        window.addEventListener("resize", () => setWidth(global.innerWidth));

        if (isOpen && width <= 768) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
            setIsOpen(false);
        }

        return () => {
            document.body.style.overflow = "unset";
            window.removeEventListener("resize", () => setWidth(global.innerWidth));
        };
    }, [isOpen, width]);

    const open = () => setIsOpen(true);
    const close = () => setIsOpen(false);

    return (
        <>
            <Button onClick={open} className={styles.trigger}>
                <MenuIcon className={styles.triggerIcon} />
            </Button>
            <div className={`${styles.contentWrapper} ${isOpen && styles.contentWrapper_opened}`}>
                <div className={styles.content}>
                    <Button onClick={close} className={styles.close}>
                        <CloseIcon className={styles.closeIcon} />
                    </Button>
                    <List linksOnClick={close} />
                    {isAuth ? (
                        <Button
                            onClick={close}
                            className={styles.myProfile}
                            elementType="link"
                            href={"/profile/dashboard"}
                        >{`Мой профиль`}</Button>
                    ) : (
                        <Auth />
                    )}
                </div>
            </div>
        </>
    );
};
