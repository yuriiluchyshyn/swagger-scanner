# OpenAPI Scanner Chrome Extension

Chrome extension для відкриття OpenAPI Scanner у модальному вікні на будь-якій веб-сторінці.

## Встановлення

1. Відкрийте Chrome і перейдіть до `chrome://extensions/`
2. Увімкніть "Developer mode" (режим розробника) у правому верхньому куті
3. Натисніть "Load unpacked" (завантажити розпаковане)
4. Виберіть папку `chrome-extension` з цього проєкту
5. Extension з'явиться у списку та на панелі інструментів

## Використання

1. Переконайтеся, що OpenAPI Scanner запущений на `http://localhost:4444`
2. Натисніть на іконку extension у панелі інструментів Chrome
3. Натисніть кнопку "Open Scanner"
4. Модальне вікно з OpenAPI Scanner відкриється поверх поточної сторінки

## Функції

- Модальне вікно з повним інтерфейсом OpenAPI Scanner
- **Auto-fill**: Автоматичне заповнення Global Params з localStorage `portal_profile`
- **Drag & Drop**: Перетягуйте модальне вікно за заголовок
- **Resize**: Змінюйте розмір вікна за допомогою ручки в правому нижньому куті
- **Fullscreen**: Кнопка для переключення в повноекранний режим
- Адаптивний дизайн (працює на мобільних пристроях)
- Закриття через ESC, кнопку X або клік поза модальним вікном
- Високий z-index для відображення поверх будь-якого контенту
- Автоматичне утримання вікна в межах екрану при перетягуванні/зміні розміру

## Налаштування

Якщо ваш OpenAPI Scanner запущений на іншому порті, змініть URL у файлі `content.js`:

```javascript
src="http://localhost:ВАШІ_ПОРТ"
```

## Керування модальним вікном

- **Auto-fill**: Кнопка 🔄 для автозаповнення з portal_profile
- **Перетягування**: Клікніть і тягніть за заголовок вікна
- **Зміна розміру**: Тягніть за ручку в правому нижньому куті
- **Повний екран**: Натисніть кнопку ⛶ в заголовку
- **Закриття**: ESC, кнопка ×, або клік поза вікном

На мобільних пристроях модальне вікно автоматично займає весь екран.

## Auto-fill функціональність

Extension автоматично шукає в localStorage ключ `portal_profile` та заповнює Global Params:

- `Authorization` - з access_token, auth_token або jwt_token
- `tenant_id` - з user.tenant_id
- `tenant_code` - з user.tenant_code  
- `principal_id` - з user.principal_id
- `subscription_id` - з user.principal_data.subscriptions[0].subscription_id

**Додаткові можливості:**
- **Показ невикористаних параметрів** - відображає список всіх параметрів з portal_profile, які не використовуються в Global Params
- **Auto-suggestions** - при заповненні параметрів endpoints показує підказки з доступних значень
- **Smart matching** - знаходить відповідні параметри за назвою (exact match та partial match)

Якщо дані знайдені, вони автоматично заповнюються в Global Params OpenAPI Scanner та стають доступними для auto-population в endpoints.