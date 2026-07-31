"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { ToggleIcon } from "~/shared/assets";
import { getUser } from "~/entities/user/api";
import { UserAvatar } from "~/entities/user/ui/UserAvatar/UserAvatar";
import { Button } from "~/shared/ui";
import { Dialog, DialogContent } from "~/shared/ui/Dialog";
import { deleteSessionClient } from "~/entities/user";
import { scheduleDialogOpen, useDialogOutsideGuard } from "~/shared/lib/openDialogSafe";
import { MQ_PHONE } from "~/shared/lib/layoutBreakpoints";
import {
  LazyDepositForm,
  MODAL_BY_ID,
} from "~/shared/lib/lazyModals";
import { useLocale } from "~/shared/model/useLocale";
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
  const [headerDepositCurrency, setHeaderDepositCurrency] = useState<string | undefined>();
  const { armGuard, blockIfArmed } = useDialogOutsideGuard();
  const { t } = useLocale();
  const router = useRouter();
  const { data: userData } = useQuery({
    queryKey: ["user"],
    queryFn: getUser,
    enabled: isAuth,
  });

  const openHeaderDeposit = useCallback((currencyCode?: string) => {
    armGuard();
    setHeaderDepositCurrency(currencyCode);
    scheduleDialogOpen(setHeaderDepositOpen);
  }, [armGuard]);

  const MENU_ORDER = [
    { id: "voucher", name: t("menu.voucher") },
    { id: "withdraw", name: t("menu.withdraw") },
    { id: "history", name: t("menu.betsHistory") },
    { id: "bonus-history", name: t("menu.bonusHistory") },
    { id: "settings", name: t("menu.settings") },
    { id: "details", name: t("menu.details") },
    { id: "logout", name: t("menu.logout") },
  ];

  useEffect(() => {
    const mediaQuery = window.matchMedia(MQ_PHONE);

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
    if (!Modal) return <div>{t("common.unknownModal")}</div>;
    return <Modal onClose={closeModal} />;
  };

  return (
    <>
      <List />
      {isAuth ? (
        <div className={styles.actionsDesctop}>
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
                    <UserAvatar
                      email={userData?.email}
                      name={userData?.telegramUsername || userData?.email}
                      preset={userData?.avatarPreset}
                      src={
                        (userData as { avatarUrl?: string | null } | undefined)
                          ?.avatarUrl
                      }
                      userId={userData?.id}
                      size={32}
                    />
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
        <div className={styles.actionsDesctop}>
          <Auth />
        </div>
      )}

      {typeof document !== "undefined" &&
        modalContent &&
        createPortal(
          <div
            className={styles.modalOverlay}
            onClick={closeModal}
            role="presentation"
          >
            {renderModalContent()}
          </div>,
          document.body,
        )}

      <Dialog
        open={headerDepositOpen}
        onOpenChange={(open) => {
          setHeaderDepositOpen(open);
          if (!open) setHeaderDepositCurrency(undefined);
        }}
      >
        <DialogContent
          className={depositStyles.dialog}
          title={t("deposit.title")}
          onInteractOutside={blockIfArmed}
          onPointerDownOutside={blockIfArmed}
        >
          {headerDepositOpen ? (
            <LazyDepositForm forceCurrency={headerDepositCurrency} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};