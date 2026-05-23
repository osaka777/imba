import Image from "next/image";

import { Support } from "~/shared/assets";

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
  return (
    <div className={styles.wrapper}>
      <div className={styles.support}>
        <h3>Поддержка 24/7</h3>
        <p>Свяжитесь с нами, если у вас остались вопросы</p>
        <Image alt="" className={styles.support_img} src={Support} />
      </div>
      <aside className={styles.asideBar}>
        <h2 className={styles.title}>ПРАВИЛА</h2>
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
