import React from "react";
import header from "@/widgets/ProfileHeader/header.module.css";
import { LogoIcon } from "@/shared/assets";
import { Exit, UserIcon } from "@/shared/assets/icons";
import { ProfileNavigation } from "@/widgets/ProfileNavigation/ProfileNavigation";
import { SignOut } from "@/entities/user/ui/SignOut/SignOut";
import { getUser } from "@/entities/user/api";
import { verifySession } from "@/entities/user";
import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { Balance } from "@/widgets/ProfileHeader/Balance";
import { UserModal } from "@/widgets/UserModal/UserModal";

export const ProfileHeader = async () => {
    const user = await verifySession()
    if(!user) return redirect("/")
    return (
        <header className={header.header}>
            <div className={header.wrapper}>
                <div className={header.logo}>
                    <LogoIcon />
                </div>
                <div className={header.actions}>
                    <UserModal />
                    <div className={header.data}>
                        <div className={header.data_item}>
                            {user.affilator.type}: {user.affilator.percent}%
                        </div>
                        <Balance />
                    </div>
                    <SignOut />
                </div>
            </div>
            <ProfileNavigation />

        </header>
    );
};