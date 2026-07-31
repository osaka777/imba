import { Category } from "./ContentArea.d";
import styles from "./ContentArea.module.css";

interface ContentAreaProps {
  selectedCategory: Category | null;
  emptyText?: string;
}

const ContentArea: React.FC<ContentAreaProps> = ({ selectedCategory, emptyText }) => {
  return (
    <div className={styles.wrapper}>
      {selectedCategory ? (
        <div className={styles.text}>
          <div className={styles.title}> {selectedCategory.name}</div>
          <div className={styles.content}>{selectedCategory.content}</div>
        </div>
      ) : (
        <p>{emptyText ?? "Выберите категорию для отображения информации."}</p>
      )}
    </div>
  );
};

export default ContentArea;
