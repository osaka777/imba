'use client';

import Image from "next/image";
import {
  AccessIcon,
  IconMobileIcon,
  RuIcon,
  LiveIcon,
  TicketIcon,
} from "~/shared/assets/icons";
import { LambImage } from "~/shared/assets/images";
import { Button } from "~/shared/ui";

import styles from "./HeaderLineTop.module.css";
import { LuckyDriveModal } from "~/entities/game/ui/LuckyDrive/LuckyDriveModal";
import { useState } from "react";

export const HeaderLineTop = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsModalOpen(true);
  };

  return (
    <div className={styles.headerLineTop}>
      <div className={styles.headerLineLeft}>
        <div className={styles.levelItem}>
          <Button
            className={`${styles.Button} ${styles.miniIcon} ${styles.themeDefault} ${styles.ttn} ${styles.headerButton}`}
            disabled
          >
            <AccessIcon className={`${styles.icon} ${styles.mobileIcon}`}/>
          </Button>
          <Button
            className={`${styles.Button} ${styles.dfAicJcc} ${styles.miniIcon} ${styles.themeDefault} ${styles.ttn} ${styles.headerButton}`}
            disabled
          >
            <IconMobileIcon className={`${styles.icon} ${styles.mobileIcon}`} />
          </Button>
        </div>
        <div className={styles.divider}></div>
        <div className={styles.FreeMoneyLink_root_sudSD} onClick={openModal}>
          <div className={styles.FreeMoneyLink_wrapper}>
            <span className={styles.FreeMoneyLink_prefix}>
              <TicketIcon />
            </span>
            <div className={styles.FreeMoneyLink_text_wrapper}>
              <span className={styles.FreeMoneyLink_text}>Imba Lucky</span>
              <span className={styles.FreeMoneyLink_liveIcon_wrapper}>
                <LiveIcon className={styles.FreeMoneyLink_liveIcon} />
              </span>
            </div>
          </div>
          <Image
            alt="lamb"
            className={styles.FreeMoneyLink_image}
            src={LambImage}
          />
        </div>
      </div>
      <div className={styles.headerLineRight}>
        <Button className={styles.ChangeLanguage_button}>
          <span className={styles.ChangeLanguage_ButtonTitle_eh_mm}>RU</span>
          <RuIcon className={styles.ruIcon} />
        </Button>
      </div>
      <LuckyDriveModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
