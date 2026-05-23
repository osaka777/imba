"use client"
import React from "react";
import header from "./profileNavigation.module.css";
import { usePathname, useRouter } from "next/navigation";


export const ProfileNavigation = () => {

    const router = useRouter();
    const pathName = usePathname()

    return (
        <nav className={header.nav}>
            <div onClick={e => router.push("/profile/dashboard")}
                 className={`${header.nav_item} ${pathName === "/profile/dashboard" ? header.nav_item_active : ""}`}>
                Dashboard
            </div>
            <div
                onClick={e => router.push("/profile/withdrawal")}
                className={`${header.nav_item} ${pathName === "/profile/withdrawal" ? header.nav_item_active : ""}`}>
                Выводы
            </div>
            <div
                onClick={e => router.push("/profile/contacts")}
                className={`${header.nav_item} ${pathName === "/profile/contacts" ? header.nav_item_active : ""}`}>
                Контакты
            </div>
        </nav>
    );
};