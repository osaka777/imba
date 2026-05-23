import { LogoWhiteIcon } from "@/shared/assets";
import Image from "next/image";
import { Content } from "./Content";
import styles from "./Navigation.module.css";
import { verifySession } from "@/entities/user";

export const Navigation = async () => {
    const user = await verifySession();
    const isAuth = !!user;

    return (
        <nav className={styles.Navigation}>
            <div className={styles.logo}>
                <Image src={LogoWhiteIcon} alt="" width={100} height={15} />
            </div>
            <Content isAuth={isAuth} />
        </nav>
    );
};
