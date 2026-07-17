# Olimpbet → Imba.bet Cybersport: отчёт по данным API

Дата: 2026-07-04  
База: `https://olimpbet.kz/api` (публичный, без auth для чтения)  
Sport IDs: **1040** CS2, **1041** Dota 2, **1042** Valorant

---

## 1. Эндпоинты

| Endpoint | Назначение | Используем сейчас |
|----------|------------|-------------------|
| `GET /v2/events?sport-ids={id}&page-size=&locale=ru&platform=web-desktop` | Список live/line | ✅ cybersport (но не все поля) |
| `GET /v2/events?...&live=true` | Live-лист | ✅ |
| `GET /events/{id}?locale=ru` | Деталь матча | ✅ cybersport + WC bridge |
| `GET /v2/tournaments?sport-ids={id}&page-size=&locale=ru` | Турниры дисциплины | ❌ |
| `GET /markets?locale=ru` | Справочник рынков | ✅ WC catalog |
| `GET /market-categories?locale=ru` | Категории рынков | ✅ WC catalog |
| `GET /events/{id}/statistics?locale=ru` | Структурная статистика | ⚠️ WC (для футбола), для esports часто 404/ошибка |
| Competitor logos API | Логотипы команд | ✅ cybersport-markets + WC |

---

## 2. Что отдаёт `/v2/events` (лист) — богаче, чем мы используем

Каждый `item` содержит **полный снимок**, не только id/дату:

```
id, eventDate, live, status, statusUpdatedAt
competitors[], homeCompetitorIds[]
tournament { id, name, sportId, tags, countryId, groupId, ... }
probabilities { markets[] }   ← коэффициенты прямо в листе
statistics[]                  ← score, scores_by_periods, match_phase
score, fullStatistics
tags[], weights, outcomesCount
broadcastAvailability, broadcastAvailabilityStatus
linkedEvents[], integrations[]
eventType, comment, comments
paginationKeyForward / Backward
```

### Пример live CS2 (id 8308276)

| Поле | Значение |
|------|----------|
| `statistics[score]` | `1:1` |
| `statistics[scores_by_periods]` | `13:9, 8:13, 3:1` (раунды по картам) |
| `statistics[match_phase]` | `28` |
| `probabilities.markets` | 25 рынков в **detail**, в **list** часто пустые `probabilities` |

### Вывод

- **Prematch line**: list уже содержит trading probabilities → можно не делать N×`fetchEventDetail` на каждый матч.
- **Live**: счёт и фаза есть в list; коэффициенты в list часто **пустые** → нужен detail или WC `fetchMatchSnapshot`.

---

## 3. Что отдаёт `/events/{id}` (деталь)

| Блок | Данные | Интеграция |
|------|--------|------------|
| `competitors` | id, name, type | ✅ команды + логотипы |
| `tournament` | id, name, sportId | ⚠️ в UI маскируем, в WC leagueName |
| `probabilities.markets` | marketId + outcomes (odd, tradingStatus, parameters) | ✅ WC parser → все рынки; cybersport → только WIN |
| `statistics` | score, scores_by_periods, match_phase | ✅ parsedScore в cybersport |
| `linkedEvents` | подыгры / связанные события | ❌ не используем (WC умеет для футбола) |
| `broadcastAvailability*` | трансляция | ❌ для esports обычно null |
| `integrations` | headToHeadId и др. | ❌ |
| `tags` | приоритет (SuperTop/Top) | ❌ в cybersport (WC использует) |
| `outcomesCount` | число исходов | ⚠️ показываем как `+N` в списке |

### Пример prematch CS2 (8308549)

- Турнир: **AR3NA Open** (tournament.id=44356)
- Рынки: `1001` (MATCH_WINNER, 2 исхода), `1022` (карты, 6 исходов)
- После WC-bridge на feed: `1X2`, `1-я карта`, `2-я карта`, `3-я карта` — **ставки работают**

### Пример live CS2 (8308276)

- 25 marketId в detail, но **trading probs = 0** на большинстве → live odds часто недоступны в источнике

---

## 4. Турниры `/v2/tournaments?sport-ids=1040`

Пример CS2 (9 турниров):

- BB Streamers Battle, XSE Pro League, CCT EU Challengers, European Pro League, AR3NA Open…

Поля: `id`, `name`, `sportId`, `liveEventCount`, `lineEventCount`, `tags`

**Потенциал:** страницы `/cybersport/cs2/tournament/{slug}`, фильтр линии по турниру (`tournament-ids` в `/v2/events` — параметр уже есть в `OlimpbetWcService`).

---

## 5. Справочник рынков (`/markets` + `/market-categories`)

Используется `olimpbet-wc-catalog.ts`:

- `marketId` → имя (`MATCH_WINNER`, `WINNER_MAP`, …)
- `outcomeTypeId` → код (`П1`, `П2`, map number parameters)

Cybersport `cybersport-markets.util.ts` берёт **только MATCH_WINNER** без map scope.  
WC `parseOlimpbetFullEvent` — **все** рынки → поэтому ставки на карты идут через WC-bridge.

---

## 6. Матрица: что тянуть дальше

| Данные | Источник | Приоритет | Куда |
|--------|----------|-----------|------|
| Счёт live, раунды по картам | list/detail `statistics` | P0 | Уже в parsedScore; улучшить UI ScoreBoard для CS2 |
| Все рынки (карты, тоталы) | detail probabilities + catalog | P0 | ✅ через WC-bridge / WcOddsSection |
| Турниры + фильтр | `/v2/tournaments` | P1 | `/cybersport/cs2/line?league=` |
| Логотипы команд | competitor logos util | P1 | ✅ есть |
| Приоритет SuperTop/Top | `tags`, `tournament.tags` | P2 | Карточки на главной, сортировка |
| Трансляция | `broadcastAvailability` | P3 | Для esports редко |
| Head2Head / integrations | `integrations.headToHeadId` | P3 | Статистика матчапа |
| List без N+1 detail | `probabilities` в list item | P1 | Оптимизация `CybersportService.mapListItems` |
| Live odds fallback | detail poll 5s | P1 | CyberMatchPage + WC stream |
| Счётчики по дисциплине | свой `counts()` | P1 | ✅ `/api/cybersport/counts` + UI |

---

## 7. Текущая архитектура интеграции

```
Olimpbet /v2/events + /events/{id}
        │
        ├─► CybersportService (display, WIN-only mapping)
        │         └─► CybersportWcBridgeService → wc_odds_events
        │
        └─► OlimpbetWcService (WC sync, full markets, settlement)
                  └─► placeBet, feed, cashout
```

**BetAPI не используется** для кибера.

---

## 8. Известные ограничения источника

1. **Live probabilities** часто пустые в API — не баг Imba, а данные Olimpbet.
2. **statistics API** `/events/{id}/statistics` для esports возвращает CLIENT_ERROR.
3. **Брендинг** Olimpbet в названиях турниров — маскируем в UI.
4. **Нет auth** — при блокировке IP/UA нужен fallback или прокси.

---

## 9. Рекомендуемый backlog интеграции

### Спринт A (данные + perf)

- [ ] Парсить `probabilities` из list response (убрать лишние detail-fetch)
- [ ] Подтянуть `tournament.name` в leagueName WC-записи
- [ ] Теги приоритета в сортировку списков

### Спринт B (навигация — в работе)

- [x] Страницы `/cybersport/cs2`, `/dota-2`, `/valorant`
- [ ] `/cybersport/{discipline}/tournaments` из `/v2/tournaments`
- [ ] Фильтр `/v2/events?tournament-ids=`

### Спринт C (UX матча)

- [ ] ScoreBoard: карты/раунды из `scores_by_periods`
- [ ] Live indicator + фаза (`match_phase`)
- [ ] Breadcrumb: Киберспорт → CS2 → AR3NA Open → Матч

---

## 10. Быстрые curl-проверки

```bash
# CS2 line
curl -s "https://olimpbet.kz/api/v2/events?sport-ids=1040&page-size=3&locale=ru&platform=web-desktop"

# CS2 live
curl -s "https://olimpbet.kz/api/v2/events?sport-ids=1040&live=true&page-size=3&locale=ru&platform=web-desktop"

# Деталь матча
curl -s "https://olimpbet.kz/api/events/8308549?locale=ru"

# Турниры CS2
curl -s "https://olimpbet.kz/api/v2/tournaments?sport-ids=1040&page-size=20&locale=ru"

# Imba cybersport + WC meta
curl -s "https://imba.bet/api/cybersport/line?sport=esports.cs&limit=2"
curl -s "https://imba.bet/api/cybersport/counts"
```

---

*Файл для внутреннего использования командой Imba.bet / onex. Обновлять при изменении Olimpbet API или интеграции.*
