'use client';
import React, { useState } from 'react';
import styles from './LuckyDriveBanner.module.css';
import { LuckyDriveModal } from './LuckyDriveModal';
import { LambImage, LiveIcon } from '~/shared/assets';
import Image from 'next/image';
import { Button } from '~/shared/ui';
// import { BonusBibikaBanner } from '~/entities/bet/ui/Coupon/components/BonusBibikaBanner';
// import { BonusBonusBanner } from '~/entities/bet/ui/Coupon/components/BonusBonusBanner';

export const LuckyDriveBanner = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsModalOpen(true);
    };
  

    return (
        <>
            <Button className={styles.root} onClick={openModal}>
                <div className={styles.content}>
                    <div className={styles.titleContainer}>
                        <p className={styles.title}> Lucky Drive</p>
                        <div className={styles.titleBadge}>
                            <LiveIcon className={styles.icon} />
                        </div>
                    </div>
                    <p className={styles.subtitle}>Дарим спорткары и призы от Apple</p>
                    <Image src={LambImage} alt="Lucky_Drive" className={styles.image} priority />
                </div>
            </Button>
            {/* <div className={styles.mobilePromos}>
                    <BonusBibikaBanner />
                    <BonusBonusBanner />
            </div> */}
            <LuckyDriveModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
};