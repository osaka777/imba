"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CYBER_SPORTS } from "~/entities/cybersport/lib/cyberSportsList";
import { cn } from "~/shared/lib";

import styles from "./CybersportMenu.module.css";

type CybersportMenuProps = {
  sport?: string;
  mode: "live" | "line";
};

export function CybersportMenu({ sport, mode }: CybersportMenuProps) {
  const pathname = usePathname();
  const base = mode === "live" ? "/cybersport/live" : "/cybersport/line";

  return (
    <div className={styles.menu}>
      {CYBER_SPORTS.map(({ Icon, label, name }) => {
        const href = mode === "live" ? `${base}?sport=${encodeURIComponent(name)}` : `${base}/${name}`;
        const active = sport === name || (mode === "line" && pathname.endsWith(`/${name}`));

        return (
          <Link
            className={cn(styles.item, active && styles.item_active)}
            href={href}
            key={name}
          >
            <Icon className={styles.icon} />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
