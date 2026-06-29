"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { ToggleIcon, UserIcon } from "~/shared/assets";
import { Button } from "~/shared/ui";
import { Dialog, DialogContent } from "~/shared/ui/Dialog";
import { deleteSessionClient } from "~/entities/user";
import { scheduleDialogOpen, useDialogOutsideGuard } from "~/shared/lib/openDialogSafe";
import {
  LazyDepositForm,
  MODAL_BY_ID,
} from "~/shared/lib/lazyModals";
import { Auth } from "./Auth";
import styles from "./Content.module.css";
import depositStyles from "./Deposit.module.css";
import { Deposit } from "./Deposit";
import { NotificationsBell } from "./NotificationsBell";
import { List } from "./List";

export const Content: React.FC<{ isAuth: boolean }> = ({ isAuth }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalContent, setModalContent] = useState<string | null>(null);
  const [headerDepositOpen, setHeaderDepositOpen] = useState(false);
  const { armGuard, blockIfArmed } = useDialogOutsideGuard();
  const router = useRouter();

  const openHeaderDeposit = useCallback(() => {
    armGuard();
    scheduleDialogOpen(setHeaderDepositOpen);
  }, [armGuard]);

  const MENU_ORDER = [
    { id: "voucher", name: "Ваучер" },
    { id: "withdraw", name: "Вывод средств" },
    { id: "history", name: "История ставок" },
    { id: "bonus-history", name: "История бонусов" },
    { id: "settings", name: "Настройки" },
    { id: "details", name: "Детализация" },
    { id: "logout", name: "Выйти" }
  ];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    handleChange(mediaQuery);

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);


  const handleProfileClick = () => {
    if (isMobile) {
      router.push("/profile");
    } else {
      setMenuOpen((prev) => !prev);
    }
  };

  const handleLink = async (link?: string, id?: string) => {
    try {
      if (id === "logout") {
        deleteSessionClient();
        router.push("/");
        window.location.reload();
        return;
      }

      if (modalContent === id) {
        setModalContent(null);
        setMenuOpen(false);
        return;
      }

      setModalContent(id || "default");
      setMenuOpen(false);
    } catch (error) {
      console.error("Ошибка при обработке меню:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        menuRef.current?.contains(target) ||
        (document.querySelector(`.${styles.user_wrapper}`)?.contains(target))
      ) {
        return;
      }

      setMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  const closeModal = () => {
    setModalContent(null);
  };

  const renderModalContent = () => {
    if (!modalContent) return null;
    const Modal = MODAL_BY_ID[modalContent];
    if (!Modal) return <div>Неизвестный тип модального окна</div>;
    return <Modal onClose={closeModal} />;
  };

  return (
    <>
      <List />
      {isAuth ? (
        <div className={styles.actionsDesctop}>
          {/* <div className={styles.telegram}>
            <a
              href="https://t.me/thelattafa"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity duration-200"
              title="Связаться в Telegram"
            >
              <TelegramSvgrepoIcon
                width="24"
                height="24"
                className="hover:scale-110 transition-transform duration-200"
              />
            </a>
          </div> */}
          <Deposit onOpenDeposit={openHeaderDeposit} />
          <NotificationsBell />
          <div className={styles.profile_wrapper}>
            <Button
              className={styles.user_wrapper}
              onClick={handleProfileClick}
            >
              <span className={styles.user_line}>
                <span className={styles.userRound_wrapper}>
                  <span className={styles.userRound}>
                    <UserIcon />
                  </span>
                </span>
                <div className={styles.menu_toggle}>
                  <ToggleIcon />
                </div>
              </span>
            </Button>

            <div
              className={`${styles.profileMenu} ${menuOpen ? styles.open : ""}`}
              ref={menuRef}
            >
              {MENU_ORDER.map((item) => (
                <div
                  key={item.id}
                  className={styles.dropdown}
                  onClick={() => handleLink(undefined, item.id)}
                >
                  <span className={styles.dropdownItem}>
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.actionsDesctop} >
          {/* <div className={styles.telegram}>
            <a
              href="https://t.me/thelattafa"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity duration-200"
              title="Связаться в Telegram"
            >
              <TelegramSvgrepoIcon
                width="24"
                height="24"
                className="hover:scale-110 transition-transform duration-200"
              />
            </a>
          </div> */}
          <Auth />
        </div>
      )}

      {modalContent && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          {renderModalContent()}
        </div>
      )}

      <Dialog open={headerDepositOpen} onOpenChange={setHeaderDepositOpen}>
        <DialogContent
          className={depositStyles.dialog}
          title="Пополнение счета"
          onInteractOutside={blockIfArmed}
          onPointerDownOutside={blockIfArmed}
        >
          {headerDepositOpen ? <LazyDepositForm /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
};