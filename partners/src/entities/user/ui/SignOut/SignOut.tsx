"use client"

import React from "react";
import { exit } from "@/entities/user";
import { useRouter } from "next/navigation";
import header from "@/widgets/ProfileHeader/header.module.css";
import { Exit } from "@/shared/assets/icons";

export const SignOut = () => {
    const router = useRouter();

    const signOut = async () => {
        await exit();
        router.push("/");
    };

    return (
        <div onClick={signOut} className={header.icon}>
            <Exit />
        </div>
    );
};