/**
 * Consent checkbox as `input_fields` item (`type: 'consent'`).
 * `.consent-box` markup; konum `#additionalInputFields` içinde `input_fields` sırasına göre belirlenir.
 */

export function findConsentField(inputFields) {
  if (!Array.isArray(inputFields)) return null;
  const f = inputFields.find((x) => x && x.type === 'consent');
  return f || null;
}

/** Eski çoklu `box-*` alanları — kayıtta temizlenir, okumada `box-style` metnine dönüştürülür. */
export const CONSENT_LEGACY_BOX_STYLE_KEYS = [
  'box-background',
  'box-border-width',
  'box-border-color',
  'box-border-radius',
  'box-padding-x',
  'box-padding-y',
  'box-margin',
  'box-min-height',
  'box-font-size',
  'box-backdrop-filter',
];

/** Boş `box-style` iken kullanılan varsayılan (eski .consent-box CSS ile aynı). */
export const CONSENT_BOX_INLINE_STYLE_DEFAULT =
  'background-color: #ffffff1a; border: 1px solid #ffffff20; border-radius: 5px; padding: 0 5px; margin: 10px; min-height: 56px; font-size: 0.8rem; backdrop-filter: blur(10px) saturate(120%); -webkit-backdrop-filter: blur(10px) saturate(120%);';

export function sanitizeConsentBoxInlineStyle(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(/url\s*\(/gi, '');
  s = s.replace(/expression\s*\(/gi, '');
  s = s.replace(/@import/gi, '');
  s = s.replace(/<\/style/gi, '');
  if (s.length > 800) s = s.slice(0, 800);
  return s;
}

function px(raw, min, max, fallback) {
  const n = parseInt(String(raw ?? '').replace(/px/gi, '').trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cssColor(raw, fallback) {
  const s = String(raw || '').trim();
  if (!s) return fallback;
  if (/[;{}]/.test(s)) return fallback;
  if (/^rgba?\(\s*[\d.]+\s*,/i.test(s)) return s;
  if (/^#[0-9A-Fa-f]{3,8}$/i.test(s)) return s;
  return fallback;
}

function fontSizeSafe(raw, fallback) {
  const s = String(raw || '').trim();
  if (!s) return fallback;
  if (/[;{}<>]/.test(s) || s.length > 24) return fallback;
  return s;
}

function backdropSafe(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (/url\s*\(/i.test(t) || /[;{}]/.test(t) || t.length > 120) return '';
  return t;
}

/** Eski `box-*` kayıtlarından tek satır CSS (yalnızca geçiş). */
function legacyBoxKeysToCss(st) {
  if (!st || typeof st !== 'object') return '';
  const has = CONSENT_LEGACY_BOX_STYLE_KEYS.some((k) => st[k] != null && String(st[k]).trim() !== '');
  if (!has) return '';
  const bg = cssColor(st['box-background'], '#ffffff1a');
  const bc = cssColor(st['box-border-color'], '#ffffff20');
  const bw = px(st['box-border-width'], 0, 8, 1);
  const br = px(st['box-border-radius'], 0, 48, 5);
  const pxv = px(st['box-padding-x'], 0, 48, 5);
  const py = px(st['box-padding-y'], 0, 48, 0);
  const m = px(st['box-margin'], 0, 48, 10);
  const mh = px(st['box-min-height'], 32, 200, 56);
  const fs = fontSizeSafe(st['box-font-size'], '0.8rem');
  const bf = backdropSafe(st['box-backdrop-filter']);
  const border = bw > 0 ? `${bw}px solid ${bc}` : 'none';
  let out = `background-color: ${bg}; border: ${border}; border-radius: ${br}px; padding: ${py}px ${pxv}px; margin: ${m}px; min-height: ${mh}px; font-size: ${fs};`;
  if (bf) {
    out += ` backdrop-filter: ${bf}; -webkit-backdrop-filter: ${bf};`;
  }
  return out.trim();
}

export function resolveConsentBoxDecorationCss(style) {
  const st = style && typeof style === 'object' ? style : {};
  let deco = String(st['box-style'] || '').trim();
  if (!deco) deco = legacyBoxKeysToCss(st);
  if (!deco) deco = CONSENT_BOX_INLINE_STYLE_DEFAULT;
  return sanitizeConsentBoxInlineStyle(deco);
}

/** Editör textarea: özel `box-style` veya eski alanlardan üretilmiş metin; yoksa boş (placeholder varsayılanı gösterir). */
export function getConsentBoxStyleForEditor(style) {
  const st = style && typeof style === 'object' ? style : {};
  const custom = String(st['box-style'] || '').trim();
  if (custom) return custom;
  return legacyBoxKeysToCss(st);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function escapeAttr(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/** Mutates `theme.input_fields` when legacy options had consent enabled. */
export function migrateLegacyConsentIntoInputFields(theme) {
  if (!theme || typeof theme !== 'object') return;
  if (!Array.isArray(theme.input_fields)) theme.input_fields = [];
  const hasConsent = theme.input_fields.some((f) => f && f.type === 'consent');
  if (hasConsent) return;
  if (!theme.options || !theme.options.display_consent) return;
  const link = String(theme.options.consent_link || '').trim();
  theme.input_fields.push({
    id: `input_field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    label: 'Consent checkbox',
    name: 'policy',
    type: 'consent',
    policy_url: link,
    text_before: "I agree and I've read ",
    link_text: 'Terms and Privacy Policy',
    required: true,
    style: {
      'font-family': 'Arial, Helvetica, sans-serif',
      color: '',
      'link-color': '',
      'checkbox-scale': '1.3',
      alignment: 'left',
    },
  });
  if (theme.options && typeof theme.options === 'object') {
    delete theme.options.display_consent;
    delete theme.options.consent_link;
  }
}

/** Kayıt öncesi: şema yoksa `https://` ekle (örn. www.site.com). */
export function normalizeConsentPolicyUrlForSave(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return s;
  return `https://${s}`;
}

/** normalizeConsentPolicyUrlForSave sonrası http/https geçerli mi? */
export function isValidConsentPolicyUrlNormalized(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

/** Allow only http(s) URLs for href; otherwise `#`. */
export function sanitizeConsentPolicyUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '#';
  try {
    const u = new URL(s);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch (_) {
    /* ignore */
  }
  return '#';
}

function sanitizeCheckboxScale(raw) {
  const n = parseFloat(String(raw == null ? '' : raw).trim());
  if (!Number.isFinite(n) || n <= 0 || n > 3) return '1.3';
  return String(Math.round(n * 100) / 100);
}

function sanitizeFontFamilyForInline(ff) {
  return String(ff || 'Arial, Helvetica, sans-serif').replace(/[;{}<>]/g, '');
}

function sanitizeCssColorFragment(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/[;{}]/.test(s)) return '';
  return s;
}

function applyConsentBoxInline(consentBoxEl, fieldStyle) {
  const st = fieldStyle && typeof fieldStyle === 'object' ? fieldStyle : {};
  const deco = resolveConsentBoxDecorationCss(st);
  consentBoxEl.style.cssText = deco;
  consentBoxEl.style.display = 'flex';
  consentBoxEl.style.alignItems = 'center';
  consentBoxEl.style.boxSizing = 'border-box';
  consentBoxEl.style.width = '100%';
  consentBoxEl.style.maxWidth = '100%';
  const align = st.alignment || 'center';
  let justify = 'center';
  if (align === 'left') justify = 'flex-start';
  else if (align === 'right') justify = 'flex-end';
  consentBoxEl.style.justifyContent = justify;
}

/**
 * @param {HTMLElement | null} consentBoxEl
 * @param {object | null} field
 * @param {{ linkColorFallback?: string }} [opts]
 */
export function applyConsentFieldToConsentBox(consentBoxEl, field, { linkColorFallback = '' } = {}) {
  if (!consentBoxEl) return;
  if (!field || field.type !== 'consent') {
    consentBoxEl.style.display = 'none';
    consentBoxEl.innerHTML = '';
    return;
  }

  const url = sanitizeConsentPolicyUrl(field.policy_url);
  const style = field.style && typeof field.style === 'object' ? field.style : {};
  const scale = sanitizeCheckboxScale(style['checkbox-scale']);
  const ff = sanitizeFontFamilyForInline(style['font-family'] || 'Arial, Helvetica, sans-serif');
  const color = sanitizeCssColorFragment(style.color);
  let linkColor = sanitizeCssColorFragment(style['link-color'] || style.linkColor);
  if (!linkColor && linkColorFallback) {
    linkColor = sanitizeCssColorFragment(linkColorFallback);
  }

  const beforeEsc = escapeHtml(field.text_before != null ? field.text_before : '');
  const ltEsc = escapeHtml(
    field.link_text != null ? field.link_text : 'Terms and Privacy Policy',
  );
  const hrefEsc = escapeAttr(url);

  applyConsentBoxInline(consentBoxEl, style);

  const req = field.required ? ' required' : '';
  const colorPart = color ? ` color: ${escapeAttr(color)};` : '';
  const linkColorPart = linkColor ? ` color: ${escapeAttr(linkColor)};` : '';

  consentBoxEl.innerHTML =
    `<input type="checkbox" id="policy" name="policy" value="policy"${req} style="box-sizing: border-box; margin-right: 10px; scale: ${escapeAttr(scale)}" />` +
    `<label for="policy" style="font-family: ${escapeAttr(ff)};${colorPart}">${beforeEsc}<a href="${hrefEsc}" target="_blank" rel="noopener noreferrer" style="font-family: inherit;${linkColorPart} text-decoration: underline;">${ltEsc}</a></label>`;
}

export { legacyBoxKeysToCss, escapeHtml, escapeAttr, applyConsentBoxInline, sanitizeFontFamilyForInline };

