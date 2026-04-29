# تقرير كامل — إضافة Slot Machine & Scratch Card إلى Wheelluck

---

## المشكلة الأصلية

المشروع كان يدعم **لعبة واحدة فقط** وهي عجلة الحظ (Wheel)، رغم أن الكود كان مُعدّاً مسبقاً لاستقبال ألعاب إضافية لكن لم تُكتمل.

---

## ما كان موجوداً (ولم يحتج تعديل)

| الملف | ما كان موجوداً |
|-------|----------------|
| `apps/promotion/static/utils/game-theme-utils.js` | `LEGACY_DEFAULT_GAME_ID` يحتوي على IDs محجوزة مسبقاً: slot=2, scratchcard=3 |
| `apps/promotion/static/managers/game-manager.js` | `validGameTypes` يحتوي على `['wheel', 'slot', 'scratchcard', 'silverwheel']` |
| `apps/promotion/models.py` | `theme JSONField` مرن بما يكفي، لا يحتاج تعديل |
| `apps/promotion/views.py` | `apply_template_to_theme()` يتعامل مع `gameID` تلقائياً |

---

## ما كان ناقصاً وما تم عمله بالضبط

### 1. `apps/promotion/static/utils/game-svgs.js` — 3 تعديلات

**المشكلة:** `games[]` كانت تحتوي فقط على الـ Wheel، و`nameToId` لم يكن يعرف slot أو scratchcard.

#### SVG الـ Slot Machine (`slotMachineSVG`) — viewBox 400×500

- ثلاث بكرات (reels) بـ emoji مع `font-size="42"` حتى يجدها الـ JS
- زر SPIN بـ `ry="28"` و`width="200"` فوق حدود الاكتشاف
- عداد Credits=100 و Wins=0 يتحدثان أثناء اللعب
- خط الفوز (win line) أفقي وسط البكرات
- جميع الألوان عبر CSS Variables: `--slot-bg`, `--slot-btn`, إلخ

#### SVG الـ Scratch Card (`scratchCardSVG`) — viewBox 400×480

- شبكة 3×2 من صناديق الجوائز بـ emoji
- طبقة الورق الفضي (foil) بـ `fill="url(#scratchPattern)"` حتى يكشفها الـ JS
- صندوق "20% OFF" في المنتصف
- زر SCRATCH NOW بـ `ry="26"`, `width="240"`, `y="382"`
- CSS Variables: `--scratch-bg`, `--scratch-btn`, إلخ

#### إدخالان جديدان في `games[]`

- **id: 2** — name: `slot` مع 11 reward وكامل الـ gameColors
- **id: 3** — name: `scratchcard` مع 9 rewards وكامل الـ gameColors

#### تحديث `nameToId` داخل `resolveGameRowForDefaultSvgs`

```js
// كان:
const nameToId = { wheel: 1 };

// أصبح:
const nameToId = {
  wheel: 1,
  slot: 2,
  slotmachine: 2,
  scratchcard: 3,
  scratch: 3,
};
```

---

### 2. `apps/promotion/templates/promotion.html`

**المشكلة:** الـ dropdown يحتوي على خيار واحد فقط.

```html
<!-- كان: -->
<select id="gameTypeSelect" class="form-select">
  <option value="wheel" selected>Wheel</option>
</select>

<!-- أصبح: -->
<select id="gameTypeSelect" class="form-select">
  <option value="wheel">🎡 Wheel</option>
  <option value="slot">🎰 Slot Machine</option>
  <option value="scratchcard">🪙 Scratch Card</option>
</select>
```

---

### 3. `apps/promotion/static/templates.js`

**المشكلة:** لا يوجد أي template للألعاب الجديدة في الـ template picker.

#### Template 201 — "Slot Machine — Dark Neon"

| الخاصية | القيمة |
|---------|--------|
| `gameID` | 2 |
| `background` | `#1a1a2e` |
| `box-shadow` | `0 0 0 2px #533483` |
| `headline color` | `#f5a623` (ذهبي) |
| `categories` | Modern, Dark |
| `layout` | split / left |
| `game flex` | 55% |

#### Template 301 — "Scratch Card — Steam Blue"

| الخاصية | القيمة |
|---------|--------|
| `gameID` | 3 |
| `background` | `#1b2838` |
| `box-shadow` | `0 0 0 2px #4c6b8a` |
| `headline color` | `#66c0f4` (أزرق) |
| `categories` | Modern, Colorful |
| `layout` | split / left |
| `game flex` | 50% |

---

### 4. `apps/promotion/static/template-selector.js` — تعديلان

**المشكلة 1:** الـ templates تُقطع عند 3 فقط.

```js
// كان:
this.templates = [...(templates || [])].slice(0, 3);

// أصبح:
this.templates = [...(templates || [])];
```

**المشكلة 2:** `getGameInfo()` كانت ترمي `throw Error` إذا لم تجد الـ gameID — وهذا كان سيكسر الـ picker بالكامل.

```js
// كان:
if (!rec) {
  throw new Error(`Template ${t?.id} has invalid gameID: ${t?.gameID}`);
}

// أصبح:
if (!rec) {
  const fallback = getGameRecordById(1);
  return { gameType: 'wheel', gameId: 1, svg: fallback?.game || '', category: 'wheel' };
}
```

---

### 5. `apps/promotion/static/managers/mini-game-engine.js` — ملف جديد

**المشكلة:** لا يوجد أي تفاعل داخل الـ preview بعد اختيار اللعبة.

الملف يوفر محرك ألعاب خفيف يعمل على الـ SVG مباشرة:

#### Slot Machine Engine

- يكتشف زر SPIN بالبحث عن `rect` ذو `ry >= 20` و`width >= 180`
- يكتشف البكرات بالبحث عن `text[font-size="42"]`
- يشغّل animation دوران عشوائي ثم يثبّت النتيجة
- يحسب الفوز بنظام **weighted random** حسب الـ `weight` في كل reward
- يُحدّث عداد Credits و Wins داخل الـ SVG مباشرة

#### Scratch Card Engine

- يكتشف طبقة الـ foil بالبحث عن `fill` يحتوي على `scratchPattern`
- يدعم **click** و**drag** (أكثر من 12 pixel حركة)
- يدعم **touch** على الموبايل
- يخفي الـ foil بـ CSS transition ثم يكشف الجائزة
- يُحدّث نص الجائزة وزر الـ CTA

```js
// واجهة الاستخدام:
MiniGameEngine.boot(containerEl, gameId, rewards, onResult);
```

---

### 6. `apps/promotion/static/managers/game-manager.js` — 3 إضافات

```js
// 1. Import في أعلى الملف
import { MiniGameEngine } from './mini-game-engine.js';

// 2. Method جديد بعد _loadInitialRewards()
_bootMiniGamePreview() {
  if (typeof document === 'undefined') return;
  const gameId = this.theme?.gameID;
  if (!gameId || gameId === 1) return; // Wheel له محرك منفصل

  const container = document.querySelector('.game-svg-container');
  if (!container) return;

  const savedRewards = this.theme?.rewards;
  const rewards = Array.isArray(savedRewards) && savedRewards.length
    ? savedRewards
    : (getGameRecordById(gameId)?.gameRewards || []);

  MiniGameEngine.boot(container, gameId, rewards, (reward) => {
    console.info('[MiniGameEngine] result:', reward?.text || 'no reward');
  });
}

// 3. استدعاء في initDOMElements() مباشرة بعد _loadInitialRewards()
this._loadInitialRewards();
this._bootMiniGamePreview(); // ← تمت الإضافة هنا
```

---

## ملخص الأرقام

| | قبل | بعد |
|--|:---:|:---:|
| عدد الألعاب المدعومة | 1 | 3 |
| عدد الـ Templates | 8 | 10 |
| Templates ظاهرة في الـ Picker | 3 | كل الـ 10 |
| خيارات الـ Dropdown | 1 | 3 |
| ملفات جديدة | 0 | 1 |
| ملفات معدّلة | 0 | 5 |

---

## جدول الملفات المعدّلة

| الملف | نوع التعديل |
|-------|-------------|
| `apps/promotion/static/utils/game-svgs.js` | إضافة SVGs + game entries + nameToId |
| `apps/promotion/templates/promotion.html` | إضافة خيارات الـ dropdown |
| `apps/promotion/static/templates.js` | إضافة Template 201 و 301 |
| `apps/promotion/static/template-selector.js` | إزالة slice(0,3) + إصلاح getGameInfo |
| `apps/promotion/static/managers/game-manager.js` | import + method + استدعاء |
| `apps/promotion/static/managers/mini-game-engine.js` | **ملف جديد** — محرك الألعاب التفاعلية |

---

## كيفية التشغيل

```bash
cd /Users/mohammedelkasim/Downloads/sample-wheel
source .venv/bin/activate
DJANGO_SETTINGS_MODULE=wheel.settings.development python manage.py runserver
```

ثم افتح في المتصفح:

- **Template Picker:** `http://localhost:8000/promotion/select-template?name=test&website=example.com`
- **Edit Panel:** `http://localhost:8000/promotion/1/edit`
