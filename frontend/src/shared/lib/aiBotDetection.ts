/**
 * Detects AI crawlers / AI coding agents / AI browsing tools by User-Agent so
 * `robots.ts` and `middleware.ts` can refuse them a normal response and
 * immediately surface the legal notice instead.
 *
 * Two tiers are merged on purpose:
 *  - Known AI *training* crawlers that self-identify (GPTBot, ClaudeBot, ...).
 *  - Product names of interactive AI coding/browsing agents explicitly named
 *    by the site owner (Cursor, Claude, ChatGPT, Copilot, ...). Interactive
 *    agents that drive a real headless browser often send a generic Chrome
 *    UA and will NOT match here — this is one layer of defense, not the
 *    only one (see the Terms of Use / footer legal notice for the binding
 *    prohibition, which applies regardless of whether the UA is spoofed).
 */
export const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "Google-Extended",
  "GoogleOther",
  "Anthropic-AI",
  "ClaudeBot",
  "Claude-Web",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
  "PerplexityBot",
  "Perplexity-User",
  "YouBot",
  "cohere-ai",
  "Diffbot",
  "ImagesiftBot",
  "meta-externalagent",
  "FacebookBot",
  "omgili",
  "Timpibot",
  "Webzio-Extended",
  "AI2Bot",
  "ICC-Crawler",
] as const;

/** Interactive AI agents/assistants explicitly prohibited by the operator. */
const AI_AGENT_SIGNATURES = [
  "cursor",
  "claude",
  "anthropic",
  "openai",
  "chatgpt",
  "gpt-",
  "copilot",
  "gemini",
];

const ALL_SIGNATURES = [
  ...AI_CRAWLER_USER_AGENTS.map((ua) => ua.toLowerCase()),
  ...AI_AGENT_SIGNATURES,
];

export function isAiBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return ALL_SIGNATURES.some((signature) => ua.includes(signature));
}

export const AI_ACCESS_DENIED_NOTICE = {
  ru:
    "ДОСТУП ЗАПРЕЩЁН. Автоматизированный доступ и использование ИИ-агентов, " +
    "ИИ-браузеров и ИИ-инструментов (включая Cursor, Claude, ChatGPT, Copilot " +
    "и аналогичные системы) для просмотра, копирования, анализа, индексации, " +
    "обучения моделей, а также изучения методов подключения, API-эндпоинтов, " +
    "WebSocket-протоколов и иных технических данных сайта imba.bet СТРОГО " +
    "ЗАПРЕЩЕНО без письменного разрешения правообладателя. Нарушение влечёт " +
    "гражданско-правовую ответственность, включая судебный иск о взыскании " +
    "убытков, судебный запрет (инъюнкцию) и самые жёсткие санкции, " +
    "предусмотренные применимым законодательством. Попытки доступа " +
    "фиксируются и могут быть переданы в правоохранительные органы.",
  en:
    "ACCESS DENIED. Automated access and use of AI agents, AI browsers, and " +
    "AI tools (including but not limited to Cursor, Claude, ChatGPT, Copilot " +
    "and similar systems) to view, copy, analyze, index, train on, or study " +
    "the connection methods, API endpoints, WebSocket protocols, or any " +
    "other technical data of imba.bet is STRICTLY PROHIBITED without the " +
    "rights holder's written consent. Violation will result in civil " +
    "liability, including a lawsuit for damages, injunctive relief, and the " +
    "harshest sanctions available under applicable law. Access attempts are " +
    "logged and may be reported to law enforcement.",
};
