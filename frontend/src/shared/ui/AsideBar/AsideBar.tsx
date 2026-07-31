"use client";

import Image from "next/image";

import { Support } from "~/shared/assets";
import { useLocale } from "~/shared/model/useLocale";

import { Button } from "../Button";
import { Category } from "./AsideBar.d";
import styles from "./AsideBar.module.css";

interface AsideBarProps {
  categories: Category[];
  onCategorySelect: (category: Category) => void;
  selectedCategory: Category | null;
}

const AsideBar: React.FC<AsideBarProps> = ({
  categories,
  onCategorySelect,
  selectedCategory,
}) => {
  const { t } = useLocale();

  return (
    <div className={styles.wrapper}>
      <div className={styles.support}>
        <h3>{t("support.247")}</h3>
        <p>{t("info.contactHint")}</p>
        <Image alt="" className={styles.support_img} src={Support} />
      </div>
      <aside className={styles.asideBar}>
        <h2 className={styles.title}>{t("info.rulesHeading")}</h2>
        <ul className={styles.categoryList} style={{ position: "relative" }}>
          {categories.map((category) => (
            <li
              className={`${styles.category} ${selectedCategory?.id === category.id ? styles.active : ""}`}
              key={category.id}
              onClick={() => onCategorySelect(category)}
            >
              <Button className={styles.categoryButton}>{category.name}</Button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
};

export default AsideBar;
