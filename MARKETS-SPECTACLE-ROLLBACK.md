# Imba Markets spectacle — rollback

Branch: `feature/imba-markets-spectacle`

## Soft kill (без git)

Файл: `frontend/src/entities/prediction/lib/spectacleFlags.ts`

- `MARKETS_SPECTACLE_MASTER = false` — выключить всё
- или отдельные флаги: `featuredBanner`, `activityFeed`, `portfolioBookmarks`, `sparklines`, `priceFlash`, `leaderboard`, `globalTape`, `urgencyTags`, `settleDrama`

## Hard rollback (git)

```bash
cd /root/onex
git log --oneline feature/imba-markets-spectacle -15
# откатить один коммит:
git revert <sha>
# или вернуться на предыдущую ветку:
git checkout feature/imba-sportsbook-redesign
bash /home/kendall-stack/scripts/deploy-target.sh imba
```

## Что добавлено

1. Featured video hero на `/markets`
2. Activity feed на странице маркета
3. `/markets/portfolio` + `/markets/bookmarks`
4. Sparklines + flash на карточках
5. Leaderboard + live tape
6. Hot / closing / new теги + settle overlay
