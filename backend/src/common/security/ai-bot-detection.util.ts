/**
 * Detects AI crawlers / AI coding agents / AI browsing tools by User-Agent so
 * we can immediately refuse them access to the API and WebSocket layer
 * (connection methods, endpoints, payload shapes, protocols, etc.).
 *
 * Two tiers are merged on purpose:
 *  - Known AI *training* crawlers that self-identify (GPTBot, ClaudeBot, ...).
 *  - Product names of interactive AI coding/browsing agents explicitly named
 *    by the site owner (Cursor, Claude, ChatGPT, Copilot, ...). Interactive
 *    agents that drive a real headless browser often use a generic Chrome
 *    UA and will NOT match here — this list only catches agents/tools that
 *    identify themselves honestly. It is one layer of defense, not the only
 *    one (see Terms of Use / legal notice for the binding prohibition).
 */
const AI_BOT_SIGNATURES = [
  'gptbot',
  'chatgpt-user',
  'oai-searchbot',
  'google-extended',
  'googleother',
  'anthropic-ai',
  'claudebot',
  'claude-web',
  'ccbot',
  'bytespider',
  'amazonbot',
  'applebot-extended',
  'perplexitybot',
  'perplexity-user',
  'youbot',
  'cohere-ai',
  'diffbot',
  'imagesiftbot',
  'meta-externalagent',
  'facebookbot',
  'omgili',
  'timpibot',
  'webzio-extended',
  'ai2bot',
  'icc-crawler',
  // Interactive AI agents / assistants explicitly prohibited by the operator.
  'cursor',
  'claude',
  'anthropic',
  'openai',
  'chatgpt',
  'gpt-',
  'copilot',
  'gemini',
  'llama',
];

export function isAiBotUserAgent(userAgent: string | undefined | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return AI_BOT_SIGNATURES.some((signature) => ua.includes(signature));
}

export const AI_ACCESS_DENIED_NOTICE = {
  ru:
    'ДОСТУП ЗАПРЕЩЁН. Автоматизированный доступ и использование ИИ-агентов, ' +
    'ИИ-браузеров и ИИ-инструментов (включая Cursor, Claude, ChatGPT, Copilot ' +
    'и аналогичные системы) для просмотра, копирования, анализа, индексации, ' +
    'обучения моделей, а также изучения методов подключения, API-эндпоинтов, ' +
    'WebSocket-протоколов и иных технических данных imba.bet СТРОГО ЗАПРЕЩЕНО ' +
    'без письменного разрешения правообладателя. Нарушение влечёт гражданско-' +
    'правовую ответственность, включая судебный иск о взыскании убытков, ' +
    'судебный запрет (инъюнкцию) и самые жёсткие санкции, предусмотренные ' +
    'применимым законодательством. Попытки доступа фиксируются и могут быть ' +
    'переданы в правоохранительные органы.',
  en:
    'ACCESS DENIED. Automated access and use of AI agents, AI browsers, and ' +
    'AI tools (including but not limited to Cursor, Claude, ChatGPT, Copilot ' +
    'and similar systems) to view, copy, analyze, index, train on, or study ' +
    'the connection methods, API endpoints, WebSocket protocols, or any other ' +
    "technical data of imba.bet is STRICTLY PROHIBITED without the rights " +
    "holder's written consent. Violation will result in civil liability, " +
    'including a lawsuit for damages, injunctive relief, and the harshest ' +
    'sanctions available under applicable law. Access attempts are logged ' +
    'and may be reported to law enforcement.',
};
