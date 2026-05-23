# Admin Panel - Next.js + Feature-Sliced Design

Современная административная панель для управления системой, построенная на Next.js 15 с архитектурой Feature-Sliced Design (FSD).

## 🏗️ Архитектура

Проект использует Feature-Sliced Design (FSD) архитектуру:

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Корневой layout с провайдерами и Header
│   ├── page.tsx           # Главная страница Dashboard
│   ├── login/             # Страница авторизации
│   ├── bonuses/           # Управление бонусами
│   ├── games/             # Управление играми
│   ├── withdrawals/       # Управление выводами
│   ├── priorities/        # Управление приоритетами
│   ├── promos/            # Управление промо
│   └── topup/             # Управление пополнениями
├── features/              # Бизнес-логика
│   ├── auth/              # Аутентификация
│   ├── games/             # Управление играми
│   └── bonuses/           # Управление бонусами
├── entities/               # Бизнес-сущности
│   ├── user/              # Пользователи
│   ├── game/              # Игры
│   ├── bonus/             # Бонусы
│   ├── withdrawal/        # Выводы
│   └── promo/             # Промо-акции
├── widgets/                # Композитные компоненты
│   └── Header/            # Навигационный заголовок
└── shared/                 # Общие утилиты и конфигурации
    ├── api/                # API клиент
    └── lib/                # Утилиты
```

## 🚀 Быстрый старт

### Предварительные требования
- Node.js 18+ 
- pnpm 8+

### Установка зависимостей
```bash
pnpm install
```

### Создание .env.local
Создайте файл `.env.local` в корне проекта:
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=Admin Panel
```

### Запуск в режиме разработки
```bash
pnpm dev
```

Приложение будет доступно по адресу: http://localhost:9000

### Сборка для продакшена
```bash
pnpm build
pnpm start
```

## 🛠️ Доступные команды

- `pnpm dev` - Запуск в режиме разработки на порту 9000
- `pnpm build` - Сборка проекта
- `pnpm start` - Запуск собранного проекта
- `pnpm lint` - Проверка и исправление линтером
- `pnpm format` - Форматирование кода Prettier
- `pnpm typecheck` - Проверка типов TypeScript

## 🔧 Технологии

- **Next.js 15** - React фреймворк с App Router
- **React 19** - Библиотека для создания пользовательских интерфейсов
- **TypeScript** - Типизированный JavaScript
- **Tailwind CSS** - Utility-first CSS фреймворк
- **TanStack Query** - Библиотека для управления состоянием сервера
- **React Hook Form** - Библиотека для работы с формами
- **React Toastify** - Уведомления
- **Axios** - HTTP клиент

## 📱 Функциональность

### ✅ Реализовано
- Базовая структура Next.js с FSD
- Роутинг между разделами админ-панели
- Страница авторизации с демо-режимом
- Провайдеры React Query и Toastify
- Tailwind CSS стилизация
- Header с навигацией
- Middleware для защиты роутов
- API клиент с интерцепторами
- Типизированные сущности и API

### 🚧 В разработке
- Интеграция с backend API
- Управление играми (полный функционал)
- Управление бонусами (полный функционал)
- Управление выводами (полный функционал)
- Управление приоритетами (полный функционал)
- Управление промо (полный функционал)
- Управление пополнениями (полный функционал)

## 🔐 Аутентификация

### Текущая реализация
- Демо-аутентификация (любые логин/пароль)
- Middleware защищает все роуты кроме `/login`
- Токен сохраняется в localStorage

### Для продакшена
1. Настроить API endpoints для авторизации
2. Заменить демо-логику в `features/auth`
3. Настроить JWT токены и refresh логику
4. Добавить роли и права доступа

## 🌐 API Интеграция

### Backend endpoints
- `POST /auth/admin/login` - Вход администратора
- `GET /admin/games` - Список игр
- `PATCH /game/{eventId}` - Обновление игры
- `POST /admin/force-finish-game/{eventId}` - Принудительное завершение
- `GET /admin/bonus-balance/{userId}` - Баланс бонусов
- `POST /admin/bonus-balance/add` - Начисление бонуса
- `GET /admin/withdrawals` - Список выводов
- `POST /admin/withdrawals/{id}/status` - Обновление статуса

### Конфигурация
API URL настраивается через переменную окружения `NEXT_PUBLIC_API_URL`

## 📁 Структура файлов

```
admin-panel/
├── src/
│   ├── app/               # Next.js App Router
│   ├── features/          # Бизнес-логика
│   ├── entities/          # Бизнес-сущности
│   ├── widgets/           # Композитные компоненты
│   ├── shared/            # Общие утилиты
│   └── middleware.ts      # Защита роутов
├── public/                # Статические файлы
├── .env.local             # Переменные окружения
├── tailwind.config.js     # Конфигурация Tailwind CSS
├── postcss.config.js      # Конфигурация PostCSS
├── next.config.js         # Конфигурация Next.js
├── tsconfig.json          # Конфигурация TypeScript
└── package.json           # Зависимости проекта
```

## 🚀 Развертывание

### Локальная разработка
```bash
pnpm dev
```

### Docker (планируется)
```bash
# Сборка образа
docker build -t admin-panel .

# Запуск контейнера
docker run -p 9000:9000 admin-panel
```

### Vercel/Netlify
Проект готов к развертыванию на Vercel или Netlify благодаря Next.js.

## 🔧 Разработка

### Добавление новой страницы
1. Создать папку в `src/app/`
2. Добавить `page.tsx`
3. Обновить навигацию в `widgets/Header`

### Добавление новой сущности
1. Создать папку в `src/entities/`
2. Определить интерфейсы
3. Создать API в `src/features/`

### Добавление нового API
1. Создать файл в `src/features/`
2. Использовать `src/shared/api`
3. Добавить типизацию

## 🐛 Устранение неполадок

### Ошибка "Module not found"
```bash
pnpm install
```

### Проблемы с TypeScript
```bash
pnpm typecheck
```

### Проблемы с линтером
```bash
pnpm lint
```

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

Проект разработан для внутреннего использования.#   a d m i n - p a n e l  
 