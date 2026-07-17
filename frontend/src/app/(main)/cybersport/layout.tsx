import { CybersportLayoutChrome } from "./CybersportLayoutChrome";
import { CybersportThemeScope } from "./CybersportThemeScope";
import "./cybersport-theme.global.css";
import "./cybersport-odds.global.css";

export default function CybersportLayout({ children }: { children: React.ReactNode }) {
  return (
    <CybersportThemeScope>
      <CybersportLayoutChrome>{children}</CybersportLayoutChrome>
    </CybersportThemeScope>
  );
}
