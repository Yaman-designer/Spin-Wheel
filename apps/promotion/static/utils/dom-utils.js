import { getTemplateById } from '../templates.js';
import {
  normalizeGameBackgroundOpacityPercent,
  solidColorToRgbaForGameBackground,
  stripHexAlphaChannel,
} from './color-utils.js';

/**
 * Promotion editoru yalnizca gaming kabugunu kullanir.
 */
export function isUnifiedPopupShellTheme(theme) {
  const t = String(theme?.popup_type || '').trim().toLowerCase();
  if (!t) return true;
  return t === 'gaming';
}

/**
 * Metin ve formların taşıyıcısı; split düzende dikey hizaya yardımcı olur.
 * Eski/kısmi DOM’da yoksa mevcut #wheelluckContent çocuklarını sarıp ekler.
 */
export function ensureWheelluckContentInner() {
  if (typeof document === 'undefined') return null;
  const shell = document.getElementById('wheelluckContent');
  if (!shell) return null;
  let inner = document.getElementById('wheelluckContentInner');
  if (inner) return inner;
  inner = document.createElement('div');
  inner.id = 'wheelluckContentInner';
  applyStyleString(
    inner,
    'margin: 0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 18px;'
  );
  while (shell.firstChild) {
    inner.appendChild(shell.firstChild);
  }
  shell.appendChild(inner);
  return inner;
}

/**
 * Metin alanındaki Submit ile senkron: önce form gönderen birincil buton, yoksa ilk widget.
 */
export function getPrimarySubmitButtonElement() {
  if (typeof document === 'undefined') return null;
  return (
    document.querySelector('#additionalInputFields .submit-button-widget[data-action="submit_form"]') ||
    document.querySelector('#additionalInputFields .submit-button-widget') ||
    document.getElementById('submit_button')
  );
}

/** Kapat / "şansım yok" — `input_fields` içindeki `close_form` buton widget'ı. */
export function getCloseFormButtonElement() {
  if (typeof document === 'undefined') return null;
  return document.querySelector(
    '#additionalInputFields .submit-button-widget[data-action="close_form"]'
  );
}

/**
 * Light/gaming kabukta kapat metni yalnızca `additionalInputFields` içindeki `close_form` widget'ında olmalı.
 * Eski şablon / preview HTML'den kalan `#close_link` tekrarını kaldırır.
 */
export function removeLegacyCloseLinkIfUnified(theme) {
  if (typeof document === 'undefined' || !isUnifiedPopupShellTheme(theme)) return;
  const legacy = document.getElementById('close_link');
  if (!legacy) return;
  if (legacy.closest('#additionalInputFields')) return;
  legacy.remove();
}

/** Submit widget: önizlemede `<input type="button">`; metin `value` ile (button ise textContent). */
export function getSubmitWidgetText(el) {
  if (!el) return '';
  const tag = el.tagName;
  const type = (el.type || '').toLowerCase();
  if (tag === 'INPUT' && (type === 'button' || type === 'submit' || type === 'reset')) {
    return el.value != null ? String(el.value) : '';
  }
  return el.textContent != null ? String(el.textContent) : '';
}

export function setSubmitWidgetText(el, text) {
  if (!el) return;
  const s = text != null ? String(text) : '';
  const tag = el.tagName;
  const type = (el.type || '').toLowerCase();
  if (tag === 'INPUT' && (type === 'button' || type === 'submit' || type === 'reset')) {
    el.value = s;
    return;
  }
  el.textContent = s;
}

export function getResponsivePopupDirection(box) {
  const rect = box.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (rect.left < 200) return 'right';
  if (vw - rect.right < 200) return 'left';
  if (rect.top < 200) return 'bottom';
  if (vh - rect.bottom < 200) return 'top';
  return 'bottom';
}

/** İnce ayar paneli (.picker_wrapper.popup) ile uyumlu tahmini boyutlar (promotion-desktop.css). */
const PROMOTION_COLOR_PICKER_EST_W = 210;
const PROMOTION_COLOR_PICKER_EST_H = 280;
const PROMOTION_COLOR_PICKER_GAP = 8;

/**
 * Renk paletinin taşmaması için `popup` yönü (vanilla-picker: top|bottom|left|right).
 * Önce `[data-color-picker-boundary]` / `#accordionExample` ile sınırlanan alan ve viewport kesişimi kullanılır.
 */
export function getPromotionColorPickerPopupDirection(box) {
  if (typeof document === 'undefined' || !box || typeof box.getBoundingClientRect !== 'function') {
    return 'bottom';
  }

  const boundary =
    (typeof box.closest === 'function' && box.closest('[data-color-picker-boundary]')) ||
    document.getElementById('accordionExample') ||
    document.querySelector('.accordion.accordionContainer');

  const r = box.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let clipLeft = 0;
  let clipTop = 0;
  let clipRight = vw;
  let clipBottom = vh;

  if (boundary && typeof boundary.getBoundingClientRect === 'function') {
    const b = boundary.getBoundingClientRect();
    clipLeft = Math.max(clipLeft, b.left);
    clipTop = Math.max(clipTop, b.top);
    clipRight = Math.min(clipRight, b.right);
    clipBottom = Math.min(clipBottom, b.bottom);
  }

  const spaceRight = clipRight - r.right - PROMOTION_COLOR_PICKER_GAP;
  const spaceLeft = r.left - clipLeft - PROMOTION_COLOR_PICKER_GAP;
  const spaceBelow = clipBottom - r.bottom - PROMOTION_COLOR_PICKER_GAP;
  const spaceAbove = r.top - clipTop - PROMOTION_COLOR_PICKER_GAP;

  // Sağdaki ayar sütunu: sağda palet sığmıyorsa ama solda sığıyorsa yatay taşmayı kesin önle.
  if (spaceRight < PROMOTION_COLOR_PICKER_EST_W && spaceLeft >= PROMOTION_COLOR_PICKER_EST_W) {
    return 'left';
  }
  if (spaceLeft < PROMOTION_COLOR_PICKER_EST_W && spaceRight >= PROMOTION_COLOR_PICKER_EST_W) {
    return 'right';
  }

  const candidates = [
    { dir: 'left', space: spaceLeft, need: PROMOTION_COLOR_PICKER_EST_W },
    { dir: 'right', space: spaceRight, need: PROMOTION_COLOR_PICKER_EST_W },
    { dir: 'bottom', space: spaceBelow, need: PROMOTION_COLOR_PICKER_EST_H },
    { dir: 'top', space: spaceAbove, need: PROMOTION_COLOR_PICKER_EST_H },
  ];

  const fitting = candidates.filter((c) => c.space >= c.need);
  if (fitting.length) {
    fitting.sort((a, b) => {
      if (b.space !== a.space) return b.space - a.space;
      const order = { left: 4, right: 3, bottom: 2, top: 1 };
      return (order[b.dir] || 0) - (order[a.dir] || 0);
    });
    return fitting[0].dir;
  }

  candidates.sort((a, b) => b.space - a.space);
  return candidates[0].dir;
}

export function toggleElementVisibility(selector, isVisible) {
  const element = document.querySelector(selector);
  if (element && element.parentElement) {
    element.parentElement.style.display = isVisible ? 'flex' : 'none';
  }
}

export function applyStyleString(element, styleString) {
  if (!element || !styleString) return;
  const declarations = styleString.split(';').filter(s => s.trim());
  const styleParts = [];
  declarations.forEach(decl => {
    const colonIndex = decl.indexOf(':');
    if (colonIndex === -1) return;
    const property = decl.slice(0, colonIndex).trim();
    const value = decl.slice(colonIndex + 1).trim();
    if (property && value) {
      const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
      const cleanValue = value.replace(/\s*!important\s*$/gi, '').trim();
      styleParts.push(`${cssProperty}: ${cleanValue} !important`);
    }
  });
  if (styleParts.length > 0) {
    element.style.cssText = styleParts.join('; ') + ';';
  }
}

/**
 * Oyun alanı rengi `game_styles.gameBackground` ile yönetilsin diye bucket satırından
 * `background` / `background-color` bildirimlerini çıkarır (layout vb. kalır).
 */
export function styleStringWithoutGameAreaBackground(styleString) {
  if (!styleString || typeof styleString !== 'string') return styleString;
  const declarations = styleString.split(';').filter((s) => s.trim());
  const kept = declarations.filter((decl) => {
    const colonIndex = decl.indexOf(':');
    if (colonIndex === -1) return true;
    const property = decl.slice(0, colonIndex).trim().toLowerCase();
    return property !== 'background' && property !== 'background-color';
  });
  if (kept.length === 0) return '';
  return (
    kept
      .map((d) => d.trim())
      .filter(Boolean)
      .join('; ') + '; '
  );
}

function inferGameAreaBackgroundFromGameStylesObject(gs) {
  if (!gs || typeof gs !== 'object') return '';
  for (const pos of ['top', 'left', 'right']) {
    const g = gs[pos]?.game;
    if (typeof g !== 'string') continue;
    const m = g.match(/\bbackground(?:-color)?\s*:\s*([^;]+)/i);
    if (m && m[1]) {
      const v = m[1].replace(/\s*!important\s*$/i, '').trim();
      if (v && !/^none$/i.test(v)) return v;
    }
  }
  return '';
}

function resolveTemplateByThemeId(theme) {
  const rawTid = theme?.template;
  const tid =
    typeof rawTid === 'number' && Number.isInteger(rawTid)
      ? rawTid
      : parseInt(String(rawTid ?? '').trim(), 10);
  if (!Number.isInteger(tid) || tid <= 0) return null;
  return getTemplateById(tid) || null;
}

function expandShortHex3(hex) {
  const h = String(hex || '').trim();
  if (/^#[0-9A-Fa-f]{3}$/i.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h;
}

/** Düz renk anahtarları için şablon–tema eşlemesi (hex kısaltma / büyük-küçük harf). */
function normalizeGameBackgroundColorKey(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  if (/^transparent$/i.test(t)) return 'transparent';
  if (/linear-gradient|radial-gradient|url\(/i.test(t)) return t;
  const hex = expandShortHex3(stripHexAlphaChannel(t));
  if (/^#[0-9A-Fa-f]{6}$/i.test(hex)) return hex.toLowerCase();
  return t.toLowerCase();
}

function getTemplateGameBackgroundForOpacityMatch(tpl) {
  if (!tpl) return '';
  const tplGs = tpl.game_styles;
  if (tplGs && typeof tplGs === 'object' && Object.prototype.hasOwnProperty.call(tplGs, 'gameBackground')) {
    return tplGs.gameBackground == null ? '' : String(tplGs.gameBackground).trim();
  }
  if (tpl.gameBackground != null) return String(tpl.gameBackground).trim();
  return '';
}

function getTemplateGameOpacityRaw(tpl) {
  if (!tpl) return undefined;
  const tplGs = tpl.game_styles;
  if (tplGs && typeof tplGs === 'object' && Object.prototype.hasOwnProperty.call(tplGs, 'gameOpacity')) {
    return tplGs.gameOpacity;
  }
  if (Object.prototype.hasOwnProperty.call(tpl, 'gameOpacity')) return tpl.gameOpacity;
  return undefined;
}

/**
 * Tema kaydında `gameOpacity` yokken, çözümlenen arka plan rengi şablondakiyle aynıysa
 * şablondaki `gameOpacity` kullanılır (eski kayıtlar + şablon 101’deki %0 şeffaflık).
 */
function getInheritedGameOpacityFromTemplateIfAny(theme) {
  if (!theme || typeof theme !== 'object') return null;
  const gs = theme.game_styles;
  if (gs && typeof gs === 'object' && Object.prototype.hasOwnProperty.call(gs, 'gameOpacity')) return null;
  if (Object.prototype.hasOwnProperty.call(theme, 'gameBackgroundOpacity')) return null;
  const tpl = resolveTemplateByThemeId(theme);
  const tplOpRaw = getTemplateGameOpacityRaw(tpl);
  if (tplOpRaw === undefined) return null;
  const resolvedBg = resolveGameAreaBackgroundCss(theme);
  const tplBg = getTemplateGameBackgroundForOpacityMatch(tpl);
  if (
    /linear-gradient|radial-gradient|url\(/i.test(String(resolvedBg)) ||
    /linear-gradient|radial-gradient|url\(/i.test(String(tplBg))
  ) {
    return null;
  }
  const a = normalizeGameBackgroundColorKey(resolvedBg);
  const b = normalizeGameBackgroundColorKey(tplBg);
  if (!a || !b || a !== b) return null;
  return normalizeGameBackgroundOpacityPercent(tplOpRaw);
}

/**
 * Oyun alanı opaklığı (%): tema alanları + şablondan eksik anahtar için yedek.
 */
export function resolveGameAreaOpacityPercent(theme) {
  if (!theme || typeof theme !== 'object') return 100;
  const gs = theme.game_styles;
  if (gs && typeof gs === 'object' && Object.prototype.hasOwnProperty.call(gs, 'gameOpacity')) {
    return normalizeGameBackgroundOpacityPercent(gs.gameOpacity);
  }
  if (Object.prototype.hasOwnProperty.call(theme, 'gameBackgroundOpacity')) {
    return normalizeGameBackgroundOpacityPercent(theme.gameBackgroundOpacity);
  }
  const inherited = getInheritedGameOpacityFromTemplateIfAny(theme);
  if (inherited !== null) return inherited;
  return 100;
}

/**
 * Kayıtta `gameOpacity` yoksa ve şablonla renk eşleşiyorsa, `game_styles.gameOpacity` yazılır
 * (bir sonraki kayıtta aynı davranış korunur).
 */
export function syncMissingGameOpacityFromTemplate(theme) {
  const inherited = getInheritedGameOpacityFromTemplateIfAny(theme);
  if (inherited === null) return;
  if (!theme.game_styles || typeof theme.game_styles !== 'object') theme.game_styles = {};
  if (inherited >= 100) delete theme.game_styles.gameOpacity;
  else theme.game_styles.gameOpacity = inherited;
}

/**
 * `.game-svg-container` arka planı — yönetim `theme.game_styles.gameBackground` üzerinden:
 * 1) `game_styles.gameBackground` (boş string = şeffaf)
 * 2) Eski kayıt: tema kökü `gameBackground`
 * 3) Şablon `game_styles.gameBackground` veya kök `gameBackground`
 * 4) Yedek: `game_styles.*.game` içindeki background
 */
export function resolveGameAreaBackgroundCss(theme) {
  if (!theme || typeof theme !== 'object') return '';
  const gs = theme.game_styles;
  if (gs && typeof gs === 'object' && Object.prototype.hasOwnProperty.call(gs, 'gameBackground')) {
    const v = gs.gameBackground;
    return v == null ? '' : String(v).trim();
  }
  if (Object.prototype.hasOwnProperty.call(theme, 'gameBackground')) {
    const v = theme.gameBackground;
    return v == null ? '' : String(v).trim();
  }
  const tpl = resolveTemplateByThemeId(theme);
  const tplGs = tpl?.game_styles;
  if (tplGs && typeof tplGs === 'object' && Object.prototype.hasOwnProperty.call(tplGs, 'gameBackground')) {
    return tplGs.gameBackground == null ? '' : String(tplGs.gameBackground).trim();
  }
  if (tpl?.gameBackground != null) {
    const fromTplRoot = String(tpl.gameBackground).trim();
    if (fromTplRoot) return fromTplRoot;
  }
  const fromThemeGs = inferGameAreaBackgroundFromGameStylesObject(theme.game_styles);
  if (fromThemeGs) return fromThemeGs;
  if (tpl) {
    const fromTplGs = inferGameAreaBackgroundFromGameStylesObject(tpl.game_styles);
    if (fromTplGs) return fromTplGs;
  }
  return '';
}

/**
 * `game_styles.gameBackground` + `game_styles.gameOpacity` (0–100; eski kök `gameBackgroundOpacity`) → CSS `background`.
 * Renk yokken %0 opaklık → şeffaf; gradient / url’de opaklık kaydırıcısı yok sayılır.
 */
export function resolveGameAreaBackgroundForDom(theme) {
  if (!theme || typeof theme !== 'object') return '';
  const base = resolveGameAreaBackgroundCss(theme);
  const opPct = resolveGameAreaOpacityPercent(theme);

  if (!base || !String(base).trim()) {
    if (opPct <= 0) return 'transparent';
    return '';
  }
  if (/linear-gradient|radial-gradient|url\(/i.test(base)) {
    return base;
  }
  return solidColorToRgbaForGameBackground(base, opPct) || base;
}

/**
 * Çözülen oyun alanı arka planını `.game-svg-container` üzerine yazar.
 */
export function applyGameAreaBackgroundFromTheme(theme) {
  if (typeof document === 'undefined') return;
  const el = document.querySelector('.game-svg-container');
  if (!el) return;
  const raw = resolveGameAreaBackgroundForDom(theme);
  if (!raw) {
    el.style.removeProperty('background');
    return;
  }
  el.style.setProperty('background', raw, 'important');
}

/**
 * Mevcut inline stilleri silmeden bildirimleri setProperty ile uygular.
 * SVG kökünde mergeGameColorsIntoSvgMarkup ile gelen --slice-color-* vb. korunur (resize / layout yenilemede).
 */
export function mergeStyleStringIntoElement(element, styleString) {
  if (!element || !styleString) return;
  const declarations = styleString.split(';').filter((s) => s.trim());
  declarations.forEach((decl) => {
    const colonIndex = decl.indexOf(':');
    if (colonIndex === -1) return;
    const property = decl.slice(0, colonIndex).trim();
    const value = decl.slice(colonIndex + 1).trim();
    if (!property || !value) return;
    const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
    const cleanValue = value.replace(/\s*!important\s*$/gi, '').trim();
    element.style.setProperty(cssProperty, cleanValue, 'important');
  });
}

export function applyStyleObject(element, styleObj, { important = false, exclude = [] } = {}) {
  if (!element || !styleObj || typeof styleObj !== 'object') return;
  Object.entries(styleObj).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (exclude.length && exclude.includes(key)) return;
    const cssKey = key.includes('-') ? key : key.replace(/([A-Z])/g, '-$1').toLowerCase();
    element.style.setProperty(cssKey, String(value).trim(), important ? 'important' : '');
  });
}

function kebabToCamelCase(kebab) {
  return String(kebab).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}


export function containerStyleValue(cs, kebabKey) {
  if (!cs || typeof cs !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(cs, kebabKey)) return cs[kebabKey];
  const camelKey = kebabToCamelCase(kebabKey);
  if (camelKey !== kebabKey && Object.prototype.hasOwnProperty.call(cs, camelKey)) return cs[camelKey];
  // Eski DB: düz renk `background-color` ile kayıtlıysa `background` okurken yedekle
  if (kebabKey === 'background' && Object.prototype.hasOwnProperty.call(cs, 'background-color')) {
    return cs['background-color'];
  }
  return undefined;
}


export function mergeDecorativeImage(theme, template, key) {
  const t = theme?.[key];
  const p = template?.[key];
  if (!t && !p) return null;
  const path = String(t?.path ?? p?.path ?? '').trim();
  const style = String(t?.style ?? p?.style ?? '').trim();
  const position = String(t?.position ?? p?.position ?? '').trim();
  if (!path && !style) return null;
  return { path, style, position };
}


export function normalizeThemeAssetUrl(path) {
  if (!path) return '';
  const p = String(path).trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p) || p.startsWith('//') || p.startsWith('data:')) return p;
  if (p.startsWith('/')) return p;
  return `/${p.replace(/^\/+/, '')}`;
}

export function mergeBackgroundImage(theme, template) {
  const t = theme?.background_image;
  const p = template?.background_image;
  if (!t && !p) return null;
  const path = String(t?.path ?? p?.path ?? '').trim();
  const style = String(t?.style ?? p?.style ?? '').trim();
  if (!path && !style) return null;
  return { path, style };
}

export function applyPopupBackgroundImage(element, backgroundImage) {
  const path = normalizeThemeAssetUrl(String(backgroundImage.path || '').trim());
  if (path) {
    element.style.backgroundImage = `url("${path}")`;
  }

  const declarations = (backgroundImage.style || '').split(';').filter(s => s.trim());
  declarations.forEach(decl => {
    const colonIndex = decl.indexOf(':');
    if (colonIndex === -1) return;
    const prop = decl.slice(0, colonIndex).trim().replace(/([A-Z])/g, '-$1').toLowerCase();
    const val = decl.slice(colonIndex + 1).trim().replace(/\s*!important\s*$/i, '');
    if (prop && val) {
      element.style.setProperty(prop, val);
    }
  });
}

export function clearPopupBackgroundImageStyles(element) {
  if (!element) return;
  element.style.backgroundImage = '';
  element.style.backgroundColor = '';
  element.style.removeProperty('background-size');
  element.style.removeProperty('background-position');
  element.style.removeProperty('background-repeat');
}


export function clearImageSelections(
  classes = ['selectedWheelBG', 'selectedLightBG', 'selectedTopImage', 'selectedPopupBackground']
) {
  document.querySelectorAll('.image-item').forEach(item => {
    classes.forEach(className => {
      item.classList.remove(className);
    });
  });
}

export function setRewardInputsDisabled(rewardNumbers, isDisabled, disableLabel = true) {
  rewardNumbers.forEach(num => {
    const labelInput = document.querySelector(`input[name='reward_${num}_label']`);
    const codeInput = document.querySelector(`input[name='reward_${num}_code']`);
    const weightInput = document.querySelector(`input[name='reward_${num}_weight']`);

    if (labelInput) labelInput.disabled = disableLabel ? isDisabled : false;
    if (codeInput) codeInput.disabled = isDisabled;
    if (weightInput) weightInput.disabled = isDisabled;
  });
}
