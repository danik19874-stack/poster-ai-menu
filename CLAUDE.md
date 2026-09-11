# poster-ai-menu

ИИ-меню для маркетплейса Poster POS. Дизайн: `docs/superpowers/specs/2026-09-10-poster-ai-menu-design.md`.

TDD: on — сетевой многопользовательский продукт, обрабатывает чужие заказы и деньги (комиссия через агентский договор Poster). Зафиксировано 10.09.2026 по стандарту `~/.claude/skills/tdd/SKILL.md`, без отдельного вопроса владельцу — категория однозначно попадает в режим ON (сервер/API, чужие деньги).

11.09.2026 — гостевой флоу заказа (категории, `?table=`, корзина, оформление) прогнан вручную в браузере против реального подключённого аккаунта Poster: добавление в корзину, живой пересчёт, реальная отправка заказа (получен настоящий `incomingOrderId`), очистка корзины после отправки, и оба защитных состояния (стол не определён, корзина пуста) — все проверены визуально, не только по зелёным тестам. План: `docs/superpowers/plans/2026-09-11-guest-ordering-ui.md`.

11.09.2026 — админка (`/admin`) и пул ключей Gemini прогнаны вручную в браузере: вход без пароля редиректит на логин, неверный пароль показывает ошибку, верный пароль пускает и ставит cookie, добавление/выключение/включение ключа работает и сразу видно в таблице, `POST /api/admin/keys` без cookie реально возвращает 401. Отдельно подтверждено сквозным тестом: реальный гостевой заказ (через уже работающий флоу из плана выше) действительно попадает в `activity_log`, и админка сразу показывает актуальные «Заказов сегодня»/«Активны за 30 дней» — не только по зелёным тестам. `ADMIN_PASSWORD` в `.env.local` сейчас dev-заглушка (`changeme-dev-only`) — заменить на реальный пароль перед любым использованием вне локальной разработки. Найден (не исправлен в рамках этого плана, отдельная забота) хрупкий паттерн в уже существующем `app/menu-preview/[restaurantId]/cart/page.tsx` — React предупреждает про обновление состояния до монтирования компонента при резолве `params`; сам заказ прошёл корректно, но паттерн стоит переделать на `useEffect`. План: `docs/superpowers/plans/2026-09-11-gemini-key-pool-admin.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
