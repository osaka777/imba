import { AI_ACCESS_DENIED_NOTICE } from "~/shared/lib/aiBotDetection";

/** Branded 403 HTML for AI agents / automation (middleware + static fallback). */
export function buildAiAccessDeniedHtml(): string {
  const logoUrl = "/icons/imba-logo-white.png";

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow, noai, noimageai" />
<meta name="theme-color" content="#090F1E" />
<title>Access denied — imba.bet</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet" />
<style>
  :root {
    --bg: #090f1e;
    --panel: #0d1526;
    --text: #e7ecf3;
    --muted: #8b97ad;
    --line: rgba(177, 209, 255, 0.12);
    --green: #61da84;
    --green-soft: rgba(97, 218, 132, 0.12);
    --blue: #108de7;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px 18px;
    color: var(--text);
    font-family: Manrope, system-ui, sans-serif;
    background:
      radial-gradient(ellipse 90% 70% at 88% -8%, rgba(16, 141, 231, 0.28) 0%, transparent 55%),
      radial-gradient(ellipse 70% 60% at -12% 108%, rgba(8, 85, 196, 0.32) 0%, transparent 58%),
      radial-gradient(ellipse 50% 40% at 50% 50%, rgba(97, 218, 132, 0.05) 0%, transparent 70%),
      linear-gradient(165deg, #11182b 0%, var(--bg) 48%, #070b14 100%);
  }
  .shell {
    width: min(640px, 100%);
    position: relative;
  }
  .shell::before {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: 28px;
    background: linear-gradient(135deg, rgba(16, 141, 231, 0.45), rgba(97, 218, 132, 0.25), rgba(16, 141, 231, 0.08));
    opacity: 0.55;
    z-index: 0;
    pointer-events: none;
  }
  .card {
    position: relative;
    z-index: 1;
    margin: 1px;
    padding: 40px 36px 32px;
    border-radius: 27px;
    background:
      radial-gradient(ellipse 80% 60% at 100% 0%, rgba(16, 141, 231, 0.16) 0%, transparent 55%),
      linear-gradient(165deg, #121a2e 0%, var(--panel) 100%);
    border: 1px solid var(--line);
    box-shadow:
      0 28px 80px rgba(0, 0, 0, 0.55),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    text-align: center;
  }
  .logo {
    height: 36px;
    width: auto;
    margin: 0 auto 22px;
    display: block;
    user-select: none;
    -webkit-user-drag: none;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0 auto 18px;
    padding: 7px 14px 7px 12px;
    border-radius: 999px;
    background: var(--green-soft);
    border: 1px solid rgba(97, 218, 132, 0.28);
    color: #7ee49a;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 0 4px rgba(97, 218, 132, 0.18);
  }
  h1 {
    margin: 0 0 10px;
    font-size: clamp(26px, 5vw, 34px);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.15;
    color: #fff;
  }
  .lead {
    margin: 0 auto 28px;
    max-width: 34em;
    font-size: 15px;
    line-height: 1.55;
    color: var(--muted);
    font-weight: 500;
  }
  .divider {
    height: 1px;
    margin: 0 0 24px;
    background: linear-gradient(90deg, transparent, var(--line), transparent);
    border: 0;
  }
  .notice {
    text-align: left;
    margin: 0 0 18px;
    padding: 16px 18px;
    border-radius: 16px;
    background: rgba(0, 0, 0, 0.22);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }
  .notice-label {
    display: block;
    margin-bottom: 8px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--blue);
  }
  .notice p {
    margin: 0;
    font-size: 13px;
    line-height: 1.65;
    color: #c5cddc;
    font-weight: 500;
  }
  .notice.en p { color: var(--muted); font-size: 12.5px; }
  .foot {
    margin-top: 22px;
    font-size: 12px;
    color: var(--muted);
  }
  .foot a {
    color: #87a2da;
    text-decoration: none;
    font-weight: 700;
  }
  .foot a:hover { color: #b1d1ff; }
  @media (max-width: 520px) {
    .card { padding: 32px 22px 26px; border-radius: 22px; }
    .shell::before { border-radius: 23px; }
    .logo { height: 30px; }
  }
</style>
</head>
<body>
  <div class="shell">
    <div class="card">
      <img class="logo" src="${logoUrl}" width="168" height="40" alt="Imba.bet" />
      <div class="badge"><span class="badge-dot" aria-hidden="true"></span>Access denied</div>
      <h1>Доступ закрыт</h1>
      <p class="lead">Автоматизированный доступ и ИИ-агенты к imba.bet запрещены.</p>
      <hr class="divider" />
      <div class="notice">
        <span class="notice-label">RU</span>
        <p>${AI_ACCESS_DENIED_NOTICE.ru}</p>
      </div>
      <div class="notice en">
        <span class="notice-label">EN</span>
        <p>${AI_ACCESS_DENIED_NOTICE.en}</p>
      </div>
      <p class="foot">Официальный сайт: <a href="https://imba.bet/">imba.bet</a></p>
    </div>
  </div>
</body>
</html>`;
}
