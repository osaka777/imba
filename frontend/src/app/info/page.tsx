"use client";

import { useState } from "react";

import { useLocale } from "~/shared/model/useLocale";
import AsideBar from "~/shared/ui/AsideBar/AsideBar";
import ContentArea from "~/shared/ui/ContentArea/ContentArea";

import { getInfoHtml, INFO_SECTIONS, type InfoSlug } from "./content";
import styles from "./info.module.css";

type Category = {
  content: React.ReactNode;
  id: number;
  name: string;
};

const InfoPage: React.FC = () => {
  const { t, locale } = useLocale();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const categories: Category[] = INFO_SECTIONS.map((section) => ({
    id: section.id,
    name: t(section.nameKey as `info.${string}`),
    content: (
      <div
        className={styles.legalBody}
        dangerouslySetInnerHTML={{
          __html: getInfoHtml(locale, section.slug as InfoSlug),
        }}
      />
    ),
  }));

  const selectedCategory = categories.find((c) => c.id === selectedId) ?? null;

  return (
    <div className={styles.pageContainer}>
      <AsideBar
        categories={categories}
        onCategorySelect={(category) => setSelectedId(category.id)}
        selectedCategory={selectedCategory}
      />
      <ContentArea emptyText={t("common.selectCategory")} selectedCategory={selectedCategory} />
    </div>
  );
};

export default InfoPage;
