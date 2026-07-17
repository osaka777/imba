'use client';
import React, { useState } from "react";
import header from "@/widgets/ProfileHeader/header.module.css";
import { UserIcon } from "@/shared/assets/icons";
import { Modal } from "@/shared/UI";
import { ProfileForm } from "@/entities/user/ui/ProfileForm/ProfileForm";

export const UserModal = () => {

    const [isOpen, setIsOpen] = useState(false)
    return (
        <>
            <div onClick={() => setIsOpen(true)} className={header.icon}>
                <UserIcon />
            </div>
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="lg" labelledBy="profile-modal-title">
                <ProfileForm onClose={() => setIsOpen(false)} />
            </Modal>
        </>
    );
};