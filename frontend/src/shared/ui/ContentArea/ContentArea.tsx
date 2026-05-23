import { Category } from "./ContentArea.d";
import styles from "./ContentArea.module.css";

interface ContentAreaProps {
  selectedCategory: Category | null;
}

const ContentArea: React.FC<ContentAreaProps> = ({ selectedCategory }) => {
  return (
    <div className={styles.wrapper}>
      {selectedCategory ? (
        <div className={styles.text}>
          <div className={styles.title}> {selectedCategory.name}</div>
          <div className={styles.content}>{selectedCategory.content}</div>
        </div>
      ) : (
        <p>Выберите категорию для отображения информации.</p>
      )}
    </div>
  );
};

export default ContentArea;
