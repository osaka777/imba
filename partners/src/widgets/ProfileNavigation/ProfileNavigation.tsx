"use client"
import React from "react";
import header from "./profileNavigation.module.css";
import { usePathname, useRouter } from "next/navigation";


export const ProfileNavigation = () => {

    const router = useRouter();
    const pathName = usePathname()

    return (
        <nav className={header.navWrap}>
            <div onClick={e => router.push("/profile/dashboard")}
                 className={`${header.nav_item} ${pathName === "/profile/dashboard" ? header.nav_item_active : ""}`}>
                Dashboard
            </div>
            <div
                onClick={e => router.push("/profile/referrals")}
                className={`${header.nav_item} ${pathName === "/profile/referrals" ? header.nav_item_active : ""}`}>
                Рефералы
            </div>
            <div
                onClick={e => router.push("/profile/commissions")}
                className={`${header.nav_item} ${pathName === "/profile/commissions" ? header.nav_item_active : ""}`}>
                Комиссии
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