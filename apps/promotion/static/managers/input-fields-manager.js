import { setupPicker } from '../utils/picker-utils.js';
import {
  getPromotionColorPickerPopupDirection,
  applyStyleObject,
  getPrimarySubmitButtonElement,
  setSubmitWidgetText,
  removeLegacyCloseLinkIfUnified,
} from '../utils/dom-utils.js';
import {
  getPrimarySubmitFieldStyle,
  getPrimaryCloseFieldStyle,
} from '../utils/text-utils.js';
import {
  applyConsentFieldToConsentBox,
  normalizeConsentPolicyUrlForSave,
  isValidConsentPolicyUrlNormalized,
  CONSENT_LEGACY_BOX_STYLE_KEYS,
  sanitizeConsentBoxInlineStyle,
} from '../utils/consent-field-utils.js';
import { getTemplateById } from '../templates.js';

const SUBMIT_BUTTON_TEXT_MAX_LEN = 30;

function normalizeSubmitButtonTextInput(s) {
  return String(s ?? '')
    .trim()
    .slice(0, SUBMIT_BUTTON_TEXT_MAX_LEN);
}

const BUTTON_EDITOR_WIDTH_PCT_MIN = 1;
const BUTTON_EDITOR_WIDTH_PCT_MAX = 100;
const BUTTON_EDITOR_HEIGHT_PX_MIN = 16;
const BUTTON_EDITOR_HEIGHT_PX_MAX = 200;

function clampNum(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/** Tema/CSS width → yüzde (1–100); Edit Button genişlik alanı için. */
function parseButtonStyleWidthPercent(raw, fallback = 100) {
  if (raw == null || raw === '') return fallback;
  const s = String(raw).trim().toLowerCase();
  if (s === 'auto') return fallback;
  let m = s.match(/([\d.]+)\s*%/);
  if (m) {
    return clampNum(
      Math.round(parseFloat(m[1])),
      BUTTON_EDITOR_WIDTH_PCT_MIN,
      BUTTON_EDITOR_WIDTH_PCT_MAX,
    );
  }
  m = s.match(/^([\d.]+)\s*$/);
  if (m) {
    return clampNum(
      Math.round(parseFloat(m[1])),
      BUTTON_EDITOR_WIDTH_PCT_MIN,
      BUTTON_EDITOR_WIDTH_PCT_MAX,
    );
  }
  m = s.match(/([\d.]+)\s*px/i);
  if (m) {
    return clampNum(
      Math.round(parseFloat(m[1])),
      BUTTON_EDITOR_WIDTH_PCT_MIN,
      BUTTON_EDITOR_WIDTH_PCT_MAX,
    );
  }
  return fallback;
}

/** Tema/CSS height → px; Edit Button yükseklik alanı için. */
function parseButtonStyleHeightPx(raw, fallback = 40) {
  if (raw == null || raw === '') return fallback;
  const s = String(raw).trim().toLowerCase();
  if (s === 'auto') return fallback;
  let m = s.match(/([\d.]+)\s*px/i);
  if (m) {
    return clampNum(
      Math.round(parseFloat(m[1])),
      BUTTON_EDITOR_HEIGHT_PX_MIN,
      BUTTON_EDITOR_HEIGHT_PX_MAX,
    );
  }
  m = s.match(/^([\d.]+)\s*$/);
  if (m) {
    return clampNum(
      Math.round(parseFloat(m[1])),
      BUTTON_EDITOR_HEIGHT_PX_MIN,
      BUTTON_EDITOR_HEIGHT_PX_MAX,
    );
  }
  return fallback;
}

const BUTTON_EDITOR_BORDER_RADIUS_PX_MIN = 0;
const BUTTON_EDITOR_BORDER_RADIUS_PX_MAX = 200;

/** border-radius string → px sayısı (Edit Button köşe yuvarlaklığı). */
function parseButtonBorderRadiusPx(raw, fallback = 30) {
  if (raw == null || raw === '') return fallback;
  const s = String(raw).trim();
  const m = s.match(/^([\d.]+)/);
  if (m) {
    return clampNum(
      Math.round(parseFloat(m[1])),
      BUTTON_EDITOR_BORDER_RADIUS_PX_MIN,
      BUTTON_EDITOR_BORDER_RADIUS_PX_MAX,
    );
  }
  return fallback;
}

function isStarRatingField(input) {
  const t = String(input?.type || '').toLowerCase();
  return t === 'star' || t === 'rating';
}

/**
 * Tarih alanı (şema): `type === 'date'` veya eski `name === 'birth_date'`.
 * Promotion önizlemesinde native `type=date` kullanılmaz; metin alanı gibi gösterilir (özel takvim UI için).
 */
function isDateInputField(input) {
  const t = String(input?.type || '').toLowerCase();
  return t === 'date' || String(input?.name || '') === 'birth_date';
}

/** Tema `border-radius`: "12", "12px", "50%" → geçerli CSS (birimsiz sayı → px). */
function normalizeBorderRadiusCssValue(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (/^\d+(\.\d+)?%$/.test(s)) return s;
  if (/[a-z%]/i.test(s)) return s;
  const n = parseFloat(s);
  return Number.isFinite(n) ? `${n}px` : s;
}

/** `input_fields` metin alanı stilleri: yalnızca kebab-case anahtarlar. */
function fieldStyleProp(style, kebabKey) {
  if (!style || typeof style !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(style, kebabKey)) return style[kebabKey];
  return undefined;
}

/**
 * Şablondan eklenen email / metin / tel / adres / tarih alanları için varsayılan stil
 * (`fieldStyleProp` ile uyumlu kebab-case). `max-width: 100%` önizlemede her zaman kodla set edilir.
 */
const DEFAULT_TEXT_INPUT_FIELD_STYLE = {
  'border-color': '#dee2e6',
  'border-width': '1',
  'border-radius': '12',
  height: '40',
  padding: '12',
  width: '100',
  alignment: 'center',
  color: '#000000',
  background: '#ffffff',
  'placeholder-color': '#6c757d',
};

function isTextLikeInputTemplateType(templateType) {
  return (
    templateType === 'email' ||
    templateType === 'full_name' ||
    templateType === 'phone' ||
    templateType === 'address' ||
    templateType === 'birth_date'
  );
}

/**
 * Önizleme: kayıtta stil boş olan ek butonlar, editör açılınca olduğu gibi birincil CTA / close stiline otursun.
 */
function resolveButtonWidgetPreviewStyle(theme, input) {
  const own = input.style && typeof input.style === 'object' ? { ...input.style } : {};
  const action = input.action || 'submit_form';
  const base =
    action === 'close_form'
      ? getPrimaryCloseFieldStyle(theme)
      : getPrimarySubmitFieldStyle(theme);
  if (base && typeof base === 'object' && Object.keys(base).length > 0) {
    return { ...base, ...own };
  }
  return own;
}

function applyWlFormControlBoxSizing(el) {
  if (el && el.style) el.style.boxSizing = 'border-box';
}

export class InputFieldsManager {
  constructor(themeManager) {
    this.themeManager = themeManager;
    this.inputFieldsSortable = null;
    this._inputFieldPickerOpen = false;
    this._isInputFieldPickerMobile = false;
    this._onInputFieldPickerKeydown = (e) => {
      if (e.key === 'Escape' && this._inputFieldPickerOpen) {
        e.preventDefault();
        this.closeInputFieldPicker();
      }
    };
    this._onInputFieldPickerOutsideClick = (e) => {
      if (!this._inputFieldPickerOpen || this._isInputFieldPickerMobile) return;
      const dialog = document.getElementById('inputFieldPickerDialog');
      const trigger = document.getElementById('inputFieldPickerTrigger');
      if (!dialog || !trigger) return;
      if (dialog.contains(e.target) || trigger.contains(e.target)) {
        return;
      }
      this.closeInputFieldPicker();
    };
    this._onInputFieldPickerViewportChange = () => {
      if (!this._inputFieldPickerOpen || this._isInputFieldPickerMobile) return;
      this.positionInputFieldPickerDialog();
    };
    this._buttonEditorLiveTimer = null;
    this._consentEditorLiveTimer = null;
    this._inlineFieldEditorLiveTimer = null;
    /** Renk paleti sürüklemesinde debounce yerine kare başına bir canlı önizleme */
    this._liveApplyRaf = null;
  }

  get theme() {
    return this.themeManager.theme;
  }

  set theme(value) {
    this.themeManager.theme = value;
  }

  isButtonFieldType(t) {
    return t === 'button' || t === 'submit_button';
  }

  /** Liste satırı: "Try your luck (Button)" — metin + parantez içinde label */
  formatButtonListTitle(text, label) {
    const t = String(text != null ? text : '').trim() || 'Submit';
    const l = String(label != null ? label : '').trim() || 'Button';
    return `${t} (${l})`;
  }

  normalizeHexForColorInput(val) {
    if (!val || typeof val !== 'string') return '';
    const s = val.trim();
    if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^#[0-9A-Fa-f]{3}$/i.test(s)) {
      return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
    }
    if (/^#[0-9A-Fa-f]{8}$/i.test(s)) return s.slice(0, 7).toLowerCase();
    const rgb = s.match(
      /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+\s*)?\s*\)$/i,
    );
    if (rgb) {
      const r = Math.min(255, Math.max(0, parseInt(rgb[1], 10)));
      const g = Math.min(255, Math.max(0, parseInt(rgb[2], 10)));
      const b = Math.min(255, Math.max(0, parseInt(rgb[3], 10)));
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
    return '';
  }

  parseBorderWidthFromStyle(style) {
    if (!style || typeof style !== 'object') return 0;
    const w = style['border-width'];
    if (w) {
      const n = parseInt(String(w).replace(/px/gi, '').trim(), 10);
      return Number.isNaN(n) ? 0 : n;
    }
    const b = style.border;
    if (b && b !== 'none' && typeof b === 'string') {
      const m = b.match(/^(\d+)px/i);
      if (m) return parseInt(m[1], 10);
    }
    return 0;
  }

  _inferButtonUseBackground(style) {
    const st = style && typeof style === 'object' ? style : {};
    const bg = st.background ?? st['background-color'];
    if (bg && typeof bg === 'string') {
      const s = bg.toLowerCase();
      if (s.includes('gradient') || s.includes('url(')) return true;
      if (s === 'transparent' || s === 'none') return false;
      if (/^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(s)) return false;
    }
    return true;
  }

  _syncButtonEditorSections(editorDiv) {
    const useBg = editorDiv.querySelector('.edit-button-use-bg')?.checked !== false;
    const useBd = editorDiv.querySelector('.edit-button-use-border')?.checked !== false;
    const bgFs = editorDiv.querySelector('.edit-button-bg-fieldset');
    const bdFs = editorDiv.querySelector('.edit-button-border-color-fieldset');
    const bdExtrasFs = editorDiv.querySelector('.edit-button-border-extras-fieldset');
    if (bgFs) bgFs.disabled = !useBg;
    if (bdFs) bdFs.disabled = !useBd;
    if (bdExtrasFs) bdExtrasFs.disabled = !useBd;
    if (useBd) {
      const bwInput = editorDiv.querySelector('.edit-button-style-border-w');
      const n = parseInt(bwInput?.value, 10);
      if (bwInput && (Number.isNaN(n) || n <= 0)) {
        bwInput.value = '1';
      }
    }
  }

  _scheduleButtonEditorLiveApply(editorDiv) {
    if (this._buttonEditorLiveTimer) {
      clearTimeout(this._buttonEditorLiveTimer);
    }
    this._buttonEditorLiveTimer = setTimeout(() => {
      this._buttonEditorLiveTimer = null;
      if (!editorDiv || !document.body.contains(editorDiv)) return;
      this.applyInputFieldChanges({ closeEditor: false, showToast: false });
    }, 90);
  }

  _scheduleConsentEditorLiveApply(editorDiv) {
    if (this._consentEditorLiveTimer) {
      clearTimeout(this._consentEditorLiveTimer);
    }
    this._consentEditorLiveTimer = setTimeout(() => {
      this._consentEditorLiveTimer = null;
      if (!editorDiv || !document.body.contains(editorDiv)) return;
      this.applyInputFieldChanges({ closeEditor: false, showToast: false });
    }, 90);
  }

  /**
   * Vanilla Picker onChange sırasında: debounce kullanma (sürüklerken hiç uygulanmıyordu).
   * requestAnimationFrame ile kare başına en fazla bir tam önizleme güncellemesi.
   */
  _requestImmediateLiveApply(editorDiv) {
    if (!editorDiv || !document.body.contains(editorDiv)) return;
    if (this._liveApplyRaf != null) {
      cancelAnimationFrame(this._liveApplyRaf);
    }
    this._liveApplyRaf = requestAnimationFrame(() => {
      this._liveApplyRaf = null;
      if (!editorDiv || !document.body.contains(editorDiv)) return;
      this.applyInputFieldChanges({ closeEditor: false, showToast: false });
    });
  }

  _cancelLiveApplyRaf() {
    if (this._liveApplyRaf != null) {
      cancelAnimationFrame(this._liveApplyRaf);
      this._liveApplyRaf = null;
    }
  }

  fillButtonStyleEditorInputs(editorDiv, style) {
    const st = style && typeof style === 'object' ? style : {};
    const widthEl = editorDiv.querySelector('.edit-button-style-width');
    const heightEl = editorDiv.querySelector('.edit-button-style-height');
    const bgEl = editorDiv.querySelector('.edit-button-style-bg');
    const colorEl = editorDiv.querySelector('.edit-button-style-color');
    const bwEl = editorDiv.querySelector('.edit-button-style-border-w');
    const bcEl = editorDiv.querySelector('.edit-button-style-border-c');
    const brEl = editorDiv.querySelector('.edit-button-style-radius');
    const useBgEl = editorDiv.querySelector('.edit-button-use-bg');
    const useBdEl = editorDiv.querySelector('.edit-button-use-border');
    const alignEl = editorDiv.querySelector('.edit-button-style-alignment');
    const textAlignEl = editorDiv.querySelector('.edit-button-style-text-align');
    const fontFamEl = editorDiv.querySelector('.edit-button-style-font-family');
    const fontSizeEl = editorDiv.querySelector('.edit-button-style-font-size');
    const boldEl = editorDiv.querySelector('.edit-button-style-bold');
    const italicEl = editorDiv.querySelector('.edit-button-style-italic');
    const underlineEl = editorDiv.querySelector('.edit-button-style-underline');

    // Kanonik: `background` (düz renk #hex). Eski temalar için `background-color` yedek okunur.
    const bg = this.normalizeHexForColorInput(st.background || st['background-color']);
    const fg = this.normalizeHexForColorInput(st.color);
    const bc = this.normalizeHexForColorInput(st['border-color']);
    const bw = this.parseBorderWidthFromStyle(st);
    const brPx = parseButtonBorderRadiusPx(st['border-radius'], 30);

    if (useBgEl) useBgEl.checked = this._inferButtonUseBackground(st);
    if (useBdEl) useBdEl.checked = bw > 0;

    if (bgEl) bgEl.value = bg || '#fc8289';
    if (colorEl) colorEl.value = fg || '#000000';
    if (bwEl) bwEl.value = String(useBdEl?.checked ? Math.max(bw, 1) : bw || 0);
    if (bcEl) bcEl.value = bc || '#000000';
    if (brEl) brEl.value = String(brPx);

    if (widthEl) {
      widthEl.value = String(parseButtonStyleWidthPercent(st.width, 100));
    }
    if (heightEl) {
      heightEl.value = String(parseButtonStyleHeightPx(st.height, 40));
    }

    const al = st.alignment;
    if (alignEl) {
      alignEl.value = al === 'center' || al === 'right' ? al : 'left';
    }
    const ta = (st['text-align'] || 'center').toString().toLowerCase();
    if (textAlignEl) {
      textAlignEl.value = ta === 'left' || ta === 'right' ? ta : 'center';
    }

    let ff = (st['font-family'] || 'Arial').toString().replace(/^["']|["']$/g, '').trim();
    if (fontFamEl) {
      fontFamEl.value = ff;
      const match = Array.from(fontFamEl.options).some((o) => o.value === fontFamEl.value);
      if (!match && ff) {
        const opt = document.createElement('option');
        opt.value = ff;
        opt.textContent = ff.length > 28 ? `${ff.slice(0, 26)}…` : ff;
        fontFamEl.appendChild(opt);
        fontFamEl.value = ff;
      }
    }

    let fs = (st['font-size'] || '16px').toString().trim();
    if (fontSizeEl) {
      fontSizeEl.value = fs.replace(/px$/i, '') || '16';
    }

    const fw = String(st['font-weight'] || '').toLowerCase();
    if (boldEl) {
      boldEl.checked = fw === 'bold' || fw === 'bolder' || parseInt(fw, 10) >= 600;
    }
    if (italicEl) {
      italicEl.checked = String(st['font-style'] || '').toLowerCase() === 'italic';
    }
    const td = String(st['text-decoration'] || '').toLowerCase();
    if (underlineEl) {
      underlineEl.checked = td.includes('underline');
    }

    this._syncButtonEditorSections(editorDiv);
    this._syncButtonEditorPickerSwatches(editorDiv);
  }

  /** Vanilla Picker swatch kutularını gizli hex inputlarıyla eşitler (buton editörü). */
  _syncButtonEditorPickerSwatches(editorDiv) {
    if (!editorDiv) return;
    const pairs = [
      ['.edit-button-style-color', '[data-wl-picker="btn-text"]'],
      ['.edit-button-style-bg', '[data-wl-picker="btn-bg"]'],
      ['.edit-button-style-border-c', '[data-wl-picker="btn-border"]'],
    ];
    for (const [inpSel, boxSel] of pairs) {
      const inp = editorDiv.querySelector(inpSel);
      const box = editorDiv.querySelector(boxSel);
      if (!inp || !box) continue;
      const v = String(inp.value || '').trim();
      if (v) box.style.setProperty('background', v, 'important');
      else box.style.removeProperty('background');
    }
  }

  /**
   * Buton stil editöründe text / arka plan / çerçeve renkleri için picker-utils.setupPicker (diğer alanlarla aynı).
   */
  _bindButtonEditorColorPickers(editorDiv, inputId) {
    if (!editorDiv || inputId == null) return;
    const safeId = String(inputId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const textColorBox = editorDiv.querySelector('[data-wl-picker="btn-text"]');
    const textColorInput = editorDiv.querySelector('.edit-button-style-color');
    const bgColorBox = editorDiv.querySelector('[data-wl-picker="btn-bg"]');
    const bgColorInput = editorDiv.querySelector('.edit-button-style-bg');
    const borderColorBox = editorDiv.querySelector('[data-wl-picker="btn-border"]');
    const borderColorInput = editorDiv.querySelector('.edit-button-style-border-c');
    if (textColorBox && textColorInput) {
      textColorBox.id = `editBtnTextBox_${safeId}`;
      textColorInput.id = `editBtnText_${safeId}`;
    }
    if (bgColorBox && bgColorInput) {
      bgColorBox.id = `editBtnBgBox_${safeId}`;
      bgColorInput.id = `editBtnBg_${safeId}`;
    }
    if (borderColorBox && borderColorInput) {
      borderColorBox.id = `editBtnBdBox_${safeId}`;
      borderColorInput.id = `editBtnBd_${safeId}`;
    }

    const live = () => this._scheduleButtonEditorLiveApply(editorDiv);
    const liveFromPicker = () => this._requestImmediateLiveApply(editorDiv);
    setTimeout(() => {
      if (!document.body.contains(editorDiv)) return;
      if (textColorBox?.id && textColorInput?.id) {
        setupPicker(
          textColorBox.id,
          textColorInput.id,
          textColorInput.value || '#000000',
          null,
          null,
          () => liveFromPicker(),
        );
      }
      if (bgColorBox?.id && bgColorInput?.id) {
        setupPicker(
          bgColorBox.id,
          bgColorInput.id,
          bgColorInput.value || '#fc8289',
          null,
          null,
          () => liveFromPicker(),
        );
      }
      if (borderColorBox?.id && borderColorInput?.id) {
        setupPicker(
          borderColorBox.id,
          borderColorInput.id,
          borderColorInput.value || '#000000',
          null,
          null,
          () => liveFromPicker(),
        );
      }
    }, 10);
  }

  readButtonStyleFromEditor(editorDiv, prevStyle = {}) {
    this._syncButtonEditorSections(editorDiv);
    const out = { ...(prevStyle && typeof prevStyle === 'object' ? prevStyle : {}) };
    const useBg = editorDiv.querySelector('.edit-button-use-bg')?.checked !== false;
    const useBorder = editorDiv.querySelector('.edit-button-use-border')?.checked !== false;

    const bg = editorDiv.querySelector('.edit-button-style-bg')?.value?.trim();
    const fg = editorDiv.querySelector('.edit-button-style-color')?.value?.trim();
    const bw = parseInt(editorDiv.querySelector('.edit-button-style-border-w')?.value, 10);
    const bc = editorDiv.querySelector('.edit-button-style-border-c')?.value?.trim();
    const radiusRaw = editorDiv.querySelector('.edit-button-style-radius')?.value;
    const radiusTrim = radiusRaw != null ? String(radiusRaw).trim() : '';

    // Düz renk: yalnızca `background` (şablon + DB tek anahtar). Eski `background-color` satırı silinir.
    if (useBg) {
      if (bg) {
        out.background = bg;
        delete out['background-color'];
        delete out['background-image'];
      }
    } else {
      delete out['background-color'];
      delete out.background;
      delete out['background-image'];
      out.background = 'transparent';
    }

    if (fg) {
      out.color = fg;
    }

    let effBw = Number.isNaN(bw) ? 0 : bw;
    if (useBorder && effBw <= 0) effBw = 1;
    if (useBorder && effBw > 0 && bc) {
      out['border-width'] = `${effBw}px`;
      out['border-style'] = 'solid';
      out['border-color'] = bc;
      delete out.border;
    } else {
      delete out['border-width'];
      delete out['border-style'];
      delete out['border-color'];
      out.border = 'none';
    }

    if (radiusTrim === '') {
      delete out['border-radius'];
    } else {
      const rn = parseInt(radiusTrim, 10);
      if (Number.isFinite(rn)) {
        out['border-radius'] = `${clampNum(
          rn,
          BUTTON_EDITOR_BORDER_RADIUS_PX_MIN,
          BUTTON_EDITOR_BORDER_RADIUS_PX_MAX,
        )}px`;
      } else {
        delete out['border-radius'];
      }
    }

    const align = editorDiv.querySelector('.edit-button-style-alignment')?.value || 'left';
    out.alignment = align;

    const textAlign = editorDiv.querySelector('.edit-button-style-text-align')?.value || 'center';
    out['text-align'] = textAlign;

    const widthRaw = editorDiv.querySelector('.edit-button-style-width')?.value;
    const widthTrim = widthRaw != null ? String(widthRaw).trim() : '';
    if (widthTrim === '') {
      delete out.width;
    } else {
      const wn = parseInt(widthTrim, 10);
      if (Number.isFinite(wn)) {
        out.width = `${clampNum(wn, BUTTON_EDITOR_WIDTH_PCT_MIN, BUTTON_EDITOR_WIDTH_PCT_MAX)}%`;
      } else {
        delete out.width;
      }
    }

    const heightRaw = editorDiv.querySelector('.edit-button-style-height')?.value;
    const heightTrim = heightRaw != null ? String(heightRaw).trim() : '';
    if (heightTrim === '') {
      delete out.height;
    } else {
      const hn = parseInt(heightTrim, 10);
      if (Number.isFinite(hn)) {
        out.height = `${clampNum(hn, BUTTON_EDITOR_HEIGHT_PX_MIN, BUTTON_EDITOR_HEIGHT_PX_MAX)}px`;
      } else {
        delete out.height;
      }
    }

    const ff = editorDiv.querySelector('.edit-button-style-font-family')?.value?.trim();
    if (ff) {
      out['font-family'] = ff.includes(' ') && !/^["']/.test(ff) ? `'${ff}'` : ff;
    } else {
      delete out['font-family'];
    }

    let fs = editorDiv.querySelector('.edit-button-style-font-size')?.value?.trim();
    if (fs) {
      if (/^\d+(\.\d+)?$/.test(fs)) fs = `${fs}px`;
      out['font-size'] = fs;
    }

    const bold = editorDiv.querySelector('.edit-button-style-bold')?.checked;
    out['font-weight'] = bold ? 'bold' : 'normal';

    const italic = editorDiv.querySelector('.edit-button-style-italic')?.checked;
    out['font-style'] = italic ? 'italic' : 'normal';

    const underline = editorDiv.querySelector('.edit-button-style-underline')?.checked;
    out['text-decoration'] = underline ? 'underline' : 'none';

    return out;
  }

  fillInlineFieldStyleEditor(editorDiv, style) {
    const st = style && typeof style === 'object' ? style : {};
    const bwEl = editorDiv.querySelector('.edit-style-borderWidth');
    const brEl = editorDiv.querySelector('.edit-style-borderRadius');
    const bcEl = editorDiv.querySelector('.edit-style-borderColor');
    const phEl = editorDiv.querySelector('.edit-style-placeholderColor');
    const wEl = editorDiv.querySelector('.edit-style-width');
    const hEl = editorDiv.querySelector('.edit-style-height');

    const bw = this.parseBorderWidthFromStyle(st);
    if (bwEl) bwEl.value = String(Math.min(20, Math.max(0, bw || 0)));

    let brRaw = fieldStyleProp(st, 'border-radius') || '4';
    brRaw = String(brRaw).replace(/px$/i, '').trim();
    const brn = parseInt(brRaw, 10);
    if (brEl) brEl.value = String(Math.min(50, Math.max(0, Number.isNaN(brn) ? 4 : brn)));

    const bc =
      this.normalizeHexForColorInput(fieldStyleProp(st, 'border-color')) || '#dee2e6';
    if (bcEl) bcEl.value = bc;

    const ph =
      this.normalizeHexForColorInput(fieldStyleProp(st, 'placeholder-color')) || '#6c757d';
    if (phEl) phEl.value = ph;

    let wRaw = fieldStyleProp(st, 'width');
    wRaw = wRaw != null ? String(wRaw).replace(/%$/, '').trim() : '100';
    const wn = parseInt(wRaw, 10);
    if (wEl) wEl.value = String(Math.min(100, Math.max(50, Number.isNaN(wn) ? 100 : wn)));

    const hVal = fieldStyleProp(st, 'height');
    if (hEl) {
      if (hVal == null || String(hVal).trim() === '') {
        hEl.value = '';
      } else {
        const hn = parseInt(String(hVal).replace(/px$/i, '').trim(), 10);
        hEl.value = Number.isNaN(hn) || hn <= 0 ? '' : String(Math.min(200, hn));
      }
    }

    const al = fieldStyleProp(st, 'alignment') || 'center';
    editorDiv.querySelectorAll('.edit-style-alignment').forEach((radio) => {
      radio.checked = radio.value === al;
    });

    const bcBox = editorDiv.querySelector('.edit-style-borderColor-box');
    const phBox = editorDiv.querySelector('.edit-style-placeholderColor-box');
    const syncInlineColorBox = (box, hex) => {
      if (!box) return;
      if (hex) {
        box.style.setProperty('background', hex, 'important');
      } else {
        box.style.removeProperty('background');
      }
      if (box.picker && typeof box.picker.setColor === 'function') {
        try {
          box.picker.setColor(hex || '#9ca3af', false);
        } catch (e) {
          /* ignore */
        }
      }
    };
    syncInlineColorBox(bcBox, bcEl?.value?.trim() || '');
    syncInlineColorBox(phBox, phEl?.value?.trim() || '');
  }

  readInlineFieldStyleFromEditor(editorDiv, prevStyle = {}) {
    const out = { ...(prevStyle && typeof prevStyle === 'object' ? prevStyle : {}) };

    const bwIn = editorDiv.querySelector('.edit-style-borderWidth')?.value?.trim();
    if (bwIn !== undefined && bwIn !== '') {
      let n = parseInt(bwIn, 10);
      if (!Number.isNaN(n)) {
        n = Math.min(20, Math.max(0, n));
        out['border-width'] = String(n);
      }
    }

    const brIn = editorDiv.querySelector('.edit-style-borderRadius')?.value?.trim();
    if (brIn !== undefined && brIn !== '') {
      let n = parseInt(brIn, 10);
      if (!Number.isNaN(n)) {
        n = Math.min(50, Math.max(0, n));
        out['border-radius'] = `${n}px`;
      }
    }

    const bcIn = editorDiv.querySelector('.edit-style-borderColor')?.value?.trim();
    if (bcIn) {
      const hx = this.normalizeHexForColorInput(bcIn);
      if (hx) out['border-color'] = hx;
    }

    const phIn = editorDiv.querySelector('.edit-style-placeholderColor')?.value?.trim();
    if (phIn) {
      const hx = this.normalizeHexForColorInput(phIn);
      if (hx) out['placeholder-color'] = hx;
    }

    const wIn = editorDiv.querySelector('.edit-style-width')?.value?.trim();
    if (wIn !== undefined && wIn !== '') {
      let n = parseInt(wIn, 10);
      if (!Number.isNaN(n)) {
        n = Math.min(100, Math.max(50, n));
        out.width = String(n);
      }
    }

    const heightRaw = editorDiv.querySelector('.edit-style-height')?.value;
    const heightTrim = heightRaw != null ? String(heightRaw).trim() : '';
    if (heightTrim === '') {
      out.height = '';
    } else {
      const hn = parseInt(heightTrim, 10);
      if (!Number.isNaN(hn)) {
        out.height = hn <= 0 ? '' : String(Math.min(200, hn));
      }
    }

    const alignEl = editorDiv.querySelector('.edit-style-alignment:checked');
    const al = alignEl?.value;
    if (al === 'left' || al === 'right' || al === 'center') {
      out.alignment = al;
    }

    return out;
  }

  _scheduleInlineFieldEditorLiveApply(editorDiv) {
    if (
      !editorDiv ||
      editorDiv.querySelector('.edit-button-field-id') ||
      editorDiv.querySelector('.edit-consent-field-id')
    ) {
      return;
    }
    if (this._inlineFieldEditorLiveTimer) {
      clearTimeout(this._inlineFieldEditorLiveTimer);
    }
    this._inlineFieldEditorLiveTimer = setTimeout(() => {
      this._inlineFieldEditorLiveTimer = null;
      if (!editorDiv || !document.body.contains(editorDiv)) return;
      this.applyInputFieldChanges({ closeEditor: false, showToast: false });
    }, 90);
  }

  setupInputFieldsEvents() {
    const trigger = document.getElementById('inputFieldPickerTrigger');
    if (trigger && !trigger.dataset.inputPickerBound) {
      trigger.dataset.inputPickerBound = '1';
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this._inputFieldPickerOpen) {
          this.closeInputFieldPicker();
        } else {
          this.openInputFieldPicker();
        }
      });
    }

    // Legacy native <select> (unit tests / old markup)
    const legacySelect = document.getElementById('inputFieldSelect');
    if (legacySelect && !legacySelect.dataset.inputPickerBound) {
      legacySelect.dataset.inputPickerBound = '1';
      legacySelect.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        if (selectedValue) {
          this.addInputFieldFromTemplate(selectedValue);
          e.target.value = '';
        }
      });
      legacySelect.addEventListener('focus', () => {
        this.updateDropdownOptionsStyle();
      });
      legacySelect.addEventListener('click', () => {
        this.updateDropdownOptionsStyle();
      });
    }

    const container = document.getElementById('inputFieldsContainer');
    const listSection = document.getElementById('inputFieldsListSection');
    
    // Accordion açma fonksiyonu (Bootstrap Collapse API kullanarak)
    const openInputAccordion = () => {
      const accordionButton = document.querySelector('.accordion-button[aria-controls="collapseInput"]');
      const accordionContent = document.getElementById('collapseInput');
      
      if (accordionButton && accordionContent) {
        const wasOpen = accordionContent.classList.contains('show');
        const collapseInstance = bootstrap.Collapse.getOrCreateInstance(accordionContent, {
          toggle: false
        });
        if (!wasOpen) {
          accordionContent.addEventListener(
            'shown.bs.collapse',
            () => this._scheduleScrollInputAccordionAfterLayout(),
            { once: true }
          );
        }
        collapseInstance.show();
        if (wasOpen) {
          this._scheduleScrollInputAccordionAfterLayout();
        }
      }
    };
    
    // inputFieldsListSection içinde herhangi bir yere tıklandığında accordion aç
    // Select, button ve container içindeki özel butonlar hariç
    if (listSection) {
      // Label'a da tıklama listener ekle
      const label = listSection.querySelector('label.form-label');
      if (label) {
        label.style.cursor = 'pointer';
        label.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openInputAccordion();
        });
      }
      
      listSection.addEventListener('click', (e) => {
        // Özel butonlara tıklanmadığında accordion'u aç
        const isSpecialButton = 
          e.target.closest('#inputFieldPickerTrigger') ||
          e.target.closest('#inputFieldPickerDialog') ||
          e.target.closest('#inputFieldPickerBackdrop') ||
          e.target.closest('.input-field-picker-option') ||
          e.target.closest('#inputFieldSelect') ||
          e.target.closest('#toggleInputFieldsStyle') ||  // Style Settings button
          e.target.closest('.remove-input-field-btn') || 
          e.target.closest('.edit-input-field-btn') || 
          e.target.closest('.reset-edit-input-field') ||
          e.target.closest('.inline-input-field-editor .btn-close') ||
          e.target.closest('.inline-input-field-editor') ||
          e.target.closest('.drag-handle') ||
          e.target.closest('label');  // Label'ı özel buton olarak işaretle (yukarıda ayrı handler var)
        
        // Özel butonlara tıklanmadıysa accordion'u aç
        if (!isSpecialButton) {
          openInputAccordion();
        }
      });
    }
    
    // Container içindeki item'lara click listener ekle (text editor'daki gibi)
    if (container) {
      // Event delegation kullanarak container'a tek listener ekle
      container.addEventListener('click', (e) => {
        // Özel butonlar için event handlers
        if (e.target.closest('.remove-input-field-btn')) {
          const btn = e.target.closest('.remove-input-field-btn');
          const inputId = btn.getAttribute('data-input-id');
          this.removeInputField(inputId);
          return;
        } else if (e.target.closest('.edit-input-field-btn')) {
          const btn = e.target.closest('.edit-input-field-btn');
          const inputId = btn.getAttribute('data-input-id');
          this.editInputField(inputId);
          return;
        } else if (e.target.closest('.reset-edit-input-field')) {
          this.resetInputFieldEditor();
          return;
        } else if (e.target.closest('.inline-input-field-editor .btn-close')) {
          this.closeInputFieldEditor();
          return;
        }
        
        // Drag handle'a tıklanmadıysa accordion'u aç
        const item = e.target.closest('.custom-input-item');
        if (item && !e.target.closest('.drag-handle') && !e.target.closest('.custom-input-item-actions')) {
          e.preventDefault();
          e.stopPropagation();
          openInputAccordion();
        }
      });
    }

    // Reset Input Fields Styles button
    const resetButton = document.getElementById('resetInputFieldsStyles');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        this.resetInputFieldsStyles();
      });
    }
    
    // Toggle between input fields list and style settings
    const toggleStyleButton = document.getElementById('toggleInputFieldsStyle');
    const toggleBackButton = document.getElementById('toggleBackToInputFields');
    
    if (toggleStyleButton) {
      toggleStyleButton.addEventListener('click', () => {
        this.showStyleSettings();
      });
    }
    
    if (toggleBackButton) {
      toggleBackButton.addEventListener('click', () => {
        this.showInputFieldsList();
      });
    }
    
    // Initialize color pickers for common input field styles
    // Delay to ensure DOM is ready
    setTimeout(() => {
      this.initCommonInputFieldStylePickers();
    }, 100);
    
    // Show/hide style settings based on input fields count
    this.updateStyleSettingsVisibility();
  }
  
  showStyleSettings() {
    const listSection = document.getElementById('inputFieldsListSection');
    const styleSettings = document.getElementById('inputFieldsStyleSettings');
    
    if (listSection && styleSettings) {
      listSection.style.display = 'none';
      styleSettings.style.display = 'block';
      
      // Scroll to style settings
      setTimeout(() => {
        styleSettings.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }
  
  showInputFieldsList() {
    const listSection = document.getElementById('inputFieldsListSection');
    const styleSettings = document.getElementById('inputFieldsStyleSettings');
    
    if (listSection && styleSettings) {
      listSection.style.display = 'block';
      styleSettings.style.display = 'none';
      
      // Scroll to input fields list
      setTimeout(() => {
        listSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }
  
  initCommonInputFieldStylePickers() {
    let savedStyle = this.theme.input_fields_style;
    if (!savedStyle || Object.keys(savedStyle).length === 0) {
      const firstText = (this.theme.input_fields || []).find(
        (f) =>
          f &&
          f.style &&
          typeof f.style === 'object' &&
          f.type !== 'submit_button' &&
          f.type !== 'button' &&
          !isStarRatingField(f)
      );
      savedStyle = firstText?.style ? { ...firstText.style } : {};
    }
    
    // Border color picker for common styles
    const borderColorBox = document.getElementById('inputFieldsBorderColorBox');
    const borderColorInput = document.getElementById('inputFieldsBorderColor');
    if (borderColorBox && borderColorInput) {
      // Set saved value or default - MUST set before setupPicker
      const borderColor = fieldStyleProp(savedStyle, 'border-color') || '';
      borderColorInput.value = borderColor;
      if (borderColor) {
        borderColorBox.style.setProperty('background', borderColor, 'important');
      } else {
        borderColorBox.style.removeProperty('background');
        borderColorBox.style.removeProperty('background-color');
      }
      
      // Small delay to ensure value is set before setupPicker reads it
      setTimeout(() => {
        if (typeof setupPicker === 'function') {
          setupPicker('inputFieldsBorderColorBox', 'inputFieldsBorderColor', borderColor, null, null, (color) => {
            borderColorBox.style.backgroundColor = color;
            borderColorBox.style.setProperty('background', color, 'important');
            this.saveCommonInputFieldStyles();
            this.updateStylePreview();
          });
        } else if (typeof Picker !== 'undefined') {
          borderColorBox.addEventListener('click', () => {
            const picker = new Picker({
              parent: borderColorBox,
              popup: getPromotionColorPickerPopupDirection
                ? getPromotionColorPickerPopupDirection(borderColorBox)
                : 'bottom',
              color: borderColorInput.value || borderColor,
              alpha: false,
              onChange: (color) => {
                borderColorBox.style.backgroundColor = color.hex;
                borderColorBox.style.setProperty('background', color.hex, 'important');
                borderColorInput.value = color.hex;
                this.saveCommonInputFieldStyles();
                this.updateStylePreview();
              }
            });
          });
        }
      }, 10);
    }
    
    // Border width
    const borderWidthInput = document.getElementById('inputFieldsBorderWidth');
    if (borderWidthInput) {
      const borderWidth =
        fieldStyleProp(savedStyle, 'border-width') || '1';
      borderWidthInput.value = borderWidth;
      // Remove existing listeners to avoid duplicates
      const newInput = borderWidthInput.cloneNode(true);
      borderWidthInput.parentNode.replaceChild(newInput, borderWidthInput);
      const clampBorderWidth = () => {
        const rawValue = newInput.value;
        if (rawValue === '') return;
        const parsed = parseInt(rawValue, 10);
        if (Number.isNaN(parsed)) {
          newInput.value = '1';
          return;
        }
        const clamped = Math.min(20, Math.max(0, parsed));
        newInput.value = clamped.toString();
      };
      newInput.addEventListener('input', () => {
        if (newInput.value === '') {
          return;
        }
        clampBorderWidth();
        this.saveCommonInputFieldStyles();
      });
      newInput.addEventListener('change', () => {
        clampBorderWidth();
        this.saveCommonInputFieldStyles();
      });
    }
    
    // Border radius
    const borderRadiusInput = document.getElementById('inputFieldsBorderRadius');
    if (borderRadiusInput) {
      const borderRadius =
        fieldStyleProp(savedStyle, 'border-radius') || '4';
      borderRadiusInput.value = borderRadius;
      // Remove existing listeners to avoid duplicates
      const newInput = borderRadiusInput.cloneNode(true);
      borderRadiusInput.parentNode.replaceChild(newInput, borderRadiusInput);
      newInput.addEventListener('change', () => {
        this.saveCommonInputFieldStyles();
        this.updateStylePreview();
      });
    }
    
    // Width
    const widthInput = document.getElementById('inputFieldsWidth');
    if (widthInput) {
      const width = fieldStyleProp(savedStyle, 'width') || '100';
      widthInput.value = width;
      // Remove existing listeners to avoid duplicates
      const newInput = widthInput.cloneNode(true);
      widthInput.parentNode.replaceChild(newInput, widthInput);
      newInput.addEventListener('change', () => {
        this.saveCommonInputFieldStyles();
        this.updateStylePreview();
      });
    }
    
    // Height
    const heightInput = document.getElementById('inputFieldsHeight');
    if (heightInput) {
      let height = '';
      if (Object.prototype.hasOwnProperty.call(savedStyle, 'height')) {
        const rawHeight = fieldStyleProp(savedStyle, 'height');
        if (rawHeight === 'auto' || rawHeight === '' || rawHeight == null) {
          height = '';
        } else {
          const parsed = parseInt(rawHeight, 10);
          height = (!isNaN(parsed) && parsed > 0) ? parsed.toString() : '';
        }
      }
      heightInput.value = height;
      // Remove existing listeners to avoid duplicates
      const newInput = heightInput.cloneNode(true);
      heightInput.parentNode.replaceChild(newInput, heightInput);
      newInput.addEventListener('change', () => {
        this.saveCommonInputFieldStyles();
        this.updateStylePreview();
      });
      newInput.addEventListener('input', () => {
        this.saveCommonInputFieldStyles();
        this.updateStylePreview();
      });
    }
    
    // Alignment - Radio buttons
    const alignmentLeft = document.getElementById('inputFieldsAlignmentLeft');
    const alignmentCenter = document.getElementById('inputFieldsAlignmentCenter');
    const alignmentRight = document.getElementById('inputFieldsAlignmentRight');
    const alignment =
      fieldStyleProp(savedStyle, 'alignment') || 'center';
    
    if (alignmentLeft && alignmentCenter && alignmentRight) {
      // Set the checked state
      alignmentLeft.checked = alignment === 'left';
      alignmentCenter.checked = alignment === 'center';
      alignmentRight.checked = alignment === 'right';
      
      // Add event listeners to all radio buttons
      [alignmentLeft, alignmentCenter, alignmentRight].forEach(radio => {
        radio.addEventListener('change', () => {
          if (radio.checked) {
            this.saveCommonInputFieldStyles();
            this.updateStylePreview();
          }
        });
      });
    }
    
    // Placeholder color picker for common styles
    const placeholderColorBox = document.getElementById('inputFieldsPlaceholderColorBox');
    const placeholderColorInput = document.getElementById('inputFieldsPlaceholderColor');
    if (placeholderColorBox && placeholderColorInput) {
      // Set saved value or default - MUST set before setupPicker
      const placeholderColor = fieldStyleProp(savedStyle, 'placeholder-color') || '';
      placeholderColorInput.value = placeholderColor;
      if (placeholderColor) {
        placeholderColorBox.style.setProperty('background', placeholderColor, 'important');
      } else {
        placeholderColorBox.style.removeProperty('background');
        placeholderColorBox.style.removeProperty('background-color');
      }
      
      // Small delay to ensure value is set before setupPicker reads it
      setTimeout(() => {
        if (typeof setupPicker === 'function') {
          setupPicker('inputFieldsPlaceholderColorBox', 'inputFieldsPlaceholderColor', placeholderColor, null, null, (color) => {
            placeholderColorBox.style.backgroundColor = color;
            placeholderColorBox.style.setProperty('background', color, 'important');
            this.saveCommonInputFieldStyles();
            this.updateStylePreview();
          });
        } else if (typeof Picker !== 'undefined') {
          placeholderColorBox.addEventListener('click', () => {
            const picker = new Picker({
              parent: placeholderColorBox,
              popup: getPromotionColorPickerPopupDirection
                ? getPromotionColorPickerPopupDirection(placeholderColorBox)
                : 'bottom',
              color: placeholderColorInput.value || placeholderColor,
              alpha: false,
              onChange: (color) => {
                placeholderColorBox.style.backgroundColor = color.hex;
                placeholderColorBox.style.setProperty('background', color.hex, 'important');
                placeholderColorInput.value = color.hex;
                this.saveCommonInputFieldStyles();
                this.updateStylePreview();
              }
            });
          });
        }
      }, 10);
    }
  }
  
  saveCommonInputFieldStyles() {
    const borderColorInput = document.getElementById('inputFieldsBorderColor');
    let borderColor =
      borderColorInput && borderColorInput.value != null
        ? borderColorInput.value.trim()
        : fieldStyleProp(this.theme.input_fields_style, 'border-color') || '';
    const borderWidthInput = document.getElementById('inputFieldsBorderWidth');
    let borderWidth = borderWidthInput?.value || '1';
    if (borderWidthInput) {
      if (borderWidthInput.value.trim() === '') {
        borderWidth =
          fieldStyleProp(this.theme.input_fields_style, 'border-width') ||
          '1';
      } else {
      const parsedBorderWidth = parseInt(borderWidth, 10);
      if (Number.isNaN(parsedBorderWidth)) {
        borderWidth = '1';
      } else {
        const clamped = Math.min(20, Math.max(0, parsedBorderWidth));
        borderWidth = clamped.toString();
      }
      borderWidthInput.value = borderWidth;
      }
    }
    const borderRadius = document.getElementById('inputFieldsBorderRadius')?.value || '4';
    const placeholderColorInput = document.getElementById('inputFieldsPlaceholderColor');
    let placeholderColor =
      placeholderColorInput && placeholderColorInput.value != null
        ? placeholderColorInput.value.trim()
        : fieldStyleProp(this.theme.input_fields_style, 'placeholder-color') || '';
    const width = document.getElementById('inputFieldsWidth')?.value || '100';
    const heightInput = document.getElementById('inputFieldsHeight');
    // Get height value - handle empty string as valid value
    const height = heightInput?.value !== undefined && heightInput.value !== null ? heightInput.value.toString().trim() : '';
    
    // Get alignment from radio buttons
    const alignmentLeft = document.getElementById('inputFieldsAlignmentLeft');
    const alignmentCenter = document.getElementById('inputFieldsAlignmentCenter');
    const alignmentRight = document.getElementById('inputFieldsAlignmentRight');
    let alignment = 'center';
    if (alignmentLeft?.checked) {
      alignment = 'left';
    } else if (alignmentCenter?.checked) {
      alignment = 'center';
    } else if (alignmentRight?.checked) {
      alignment = 'right';
    }
    
    if (!this.theme.input_fields_style) {
      this.theme.input_fields_style = {};
    }
    
    const preservedTextColor = fieldStyleProp(this.theme.input_fields_style, 'color');

    this.theme.input_fields_style = {
      'border-color': borderColor,
      'border-width': borderWidth,
      'border-radius': borderRadius,
      'placeholder-color': placeholderColor,
      width: width,
      height: height,
      alignment: alignment,
      ...(preservedTextColor ? { color: preservedTextColor } : {}),
    };

    const common = { ...this.theme.input_fields_style };
    if (Array.isArray(this.theme.input_fields)) {
      this.theme.input_fields = this.theme.input_fields.map((f) => {
        if (
          !f ||
          f.type === 'submit_button' ||
          f.type === 'button' ||
          f.type === 'consent' ||
          isStarRatingField(f)
        ) {
          return f;
        }
        return { ...f, style: { ...(f.style || {}), ...common } };
      });
    }
    
    // Apply styles to preview (tema `input_fields` güncel kopyayı taşır)
    this.renderInputFieldsInWidget(this.theme.input_fields);
    
    // Update style preview
    this.updateStylePreview();
  }
  
  updateStylePreview() {
    const previewContainer = document.getElementById('inputFieldsStylePreview');
    if (!previewContainer) return;
    
    const previewInputs = previewContainer.querySelectorAll('.preview-input-field');
    if (previewInputs.length === 0) return;
    
    const style = this.theme.input_fields_style || {};
    
    previewInputs.forEach((input) => {
      applyWlFormControlBoxSizing(input);
      // Apply border styles
      const bc = fieldStyleProp(style, 'border-color');
      if (bc) {
        input.style.borderColor = bc;
      }
      const bw = fieldStyleProp(style, 'border-width');
      if (bw) {
        input.style.borderWidth = `${bw}px`;
      }
      const brCss = normalizeBorderRadiusCssValue(fieldStyleProp(style, 'border-radius'));
      if (brCss) {
        input.style.borderRadius = brCss;
      }
      input.style.borderStyle = 'solid';
      
      // Apply width
      const sw = fieldStyleProp(style, 'width');
      if (sw) {
        input.style.width = `${sw}%`;
      }
      
      // Apply height (even if empty string, remove height style)
      const sh = fieldStyleProp(style, 'height');
      if (sh != null && String(sh).trim() !== '') {
        const hs = String(sh).trim();
        if (hs === 'auto') {
          input.style.height = 'auto';
        } else {
          input.style.height = /px|em|rem|%|vh|vw/i.test(hs) ? hs : `${hs}px`;
        }
      } else {
        input.style.height = '';
      }
      
      // Apply placeholder color
      const ph = fieldStyleProp(style, 'placeholder-color');
      if (ph) {
        const styleId = 'input-fields-preview-placeholder-style';
        let styleElement = document.getElementById(styleId);
        if (!styleElement) {
          styleElement = document.createElement('style');
          styleElement.id = styleId;
          document.head.appendChild(styleElement);
        }
        styleElement.textContent = `
          #inputFieldsStylePreview .preview-input-field::placeholder {
            color: ${ph} !important;
          }
          #inputFieldsStylePreview .preview-input-field::-webkit-input-placeholder {
            color: ${ph} !important;
          }
          #inputFieldsStylePreview .preview-input-field::-moz-placeholder {
            color: ${ph} !important;
            opacity: 1;
          }
          #inputFieldsStylePreview .preview-input-field:-ms-input-placeholder {
            color: ${ph} !important;
          }
        `;
      }
      
      // Apply alignment to wrapper
      const wrapper = input.closest('.preview-input-wrapper');
      const alignVal = fieldStyleProp(style, 'alignment');
      if (wrapper && alignVal) {
        const alignment = alignVal;
        if (alignment === 'center') {
          wrapper.style.display = 'flex';
          wrapper.style.justifyContent = 'center';
        } else if (alignment === 'right') {
          wrapper.style.display = 'flex';
          wrapper.style.justifyContent = 'flex-end';
        } else {
          // left (default)
          wrapper.style.display = 'flex';
          wrapper.style.justifyContent = 'flex-start';
        }
      }
    });
  }
  
  updateStyleSettingsVisibility() {
    const styleSettings = document.getElementById('inputFieldsStyleSettings');
    const container = document.getElementById('inputFieldsContainer');
    const toggleStyleButton = document.getElementById('toggleInputFieldsStyle');
    
    if (styleSettings && container && toggleStyleButton) {
      const items = container.querySelectorAll('.custom-input-item');
      const hasNonRatingFields = Array.from(items).some(item => {
        const inputName = item.getAttribute('data-input-name');
        return inputName !== 'rating';
      });
      
      // Show/hide toggle button based on whether there are non-rating fields
      toggleStyleButton.style.display = hasNonRatingFields ? 'inline-block' : 'none';
      
      // Don't auto-show style settings, let user toggle manually
      // styleSettings.style.display = hasNonRatingFields ? 'block' : 'none';
    }
  }

  /**
   * Custom picker (same UX on Samsung Internet, Chrome, Safari, desktop).
   * Mounted once on body when the trigger exists.
   */
  ensureInputFieldPickerMounted() {
    if (document.getElementById('inputFieldPickerDialog')) {
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.id = 'inputFieldPickerBackdrop';
    backdrop.className = 'input-field-picker-backdrop';
    backdrop.hidden = true;
    backdrop.setAttribute('aria-hidden', 'true');

    const dialog = document.createElement('div');
    dialog.id = 'inputFieldPickerDialog';
    dialog.className = 'input-field-picker-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'inputFieldPickerDialogTitle');
    dialog.hidden = true;

    const header = document.createElement('div');
    header.className = 'input-field-picker-dialog-header';

    const title = document.createElement('h6');
    title.id = 'inputFieldPickerDialogTitle';
    title.className = '';
    title.style.marginBottom = '0';
    title.textContent = 'Add input field';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.id = 'inputFieldPickerClose';
    closeBtn.setAttribute('aria-label', 'Close');

    header.appendChild(title);
    header.appendChild(closeBtn);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'input-field-picker-dialog-body';

    const list = document.createElement('div');
    list.id = 'inputFieldPickerList';
    list.className = 'input-field-picker-list';
    list.setAttribute('role', 'listbox');

    const order = ['full_name', 'phone', 'address', 'birth_date', 'rating', 'email', 'consent', 'button'];
    order.forEach((type) => {
      const t = this.getInputFieldTemplate(type);
      if (!t) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'input-field-picker-option';
      btn.setAttribute('data-field-type', type);
      btn.setAttribute('data-base-label', t.label);
      btn.setAttribute('role', 'option');
      btn.textContent = t.label;
      list.appendChild(btn);
    });

    bodyEl.appendChild(list);
    dialog.appendChild(header);
    dialog.appendChild(bodyEl);

    document.body.appendChild(backdrop);
    document.body.appendChild(dialog);

    backdrop.addEventListener('click', () => this.closeInputFieldPicker());
    closeBtn.addEventListener('click', () => this.closeInputFieldPicker());
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('.input-field-picker-option');
      if (!btn || btn.disabled) return;
      const type = btn.getAttribute('data-field-type');
      if (!type) return;
      const added = this.addInputFieldFromTemplate(type);
      if (added) {
        this.closeInputFieldPicker();
      }
    });
  }

  openInputFieldPicker() {
    if (!document.getElementById('inputFieldPickerTrigger')) {
      return;
    }
    this.ensureInputFieldPickerMounted();
    const backdrop = document.getElementById('inputFieldPickerBackdrop');
    const dialog = document.getElementById('inputFieldPickerDialog');
    const trigger = document.getElementById('inputFieldPickerTrigger');
    if (!backdrop || !dialog) return;

    this.updateDropdownOptionsStyle();
    this._isInputFieldPickerMobile = this.isMobileInputFieldPicker();
    backdrop.hidden = !this._isInputFieldPickerMobile;
    backdrop.setAttribute('aria-hidden', this._isInputFieldPickerMobile ? 'false' : 'true');
    dialog.hidden = false;
    this._inputFieldPickerOpen = true;
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }
    if (this._isInputFieldPickerMobile) {
      document.body.classList.add('input-field-picker-open');
    } else {
      this.positionInputFieldPickerDialog();
      document.addEventListener('mousedown', this._onInputFieldPickerOutsideClick);
      window.addEventListener('resize', this._onInputFieldPickerViewportChange);
      window.addEventListener('scroll', this._onInputFieldPickerViewportChange, true);
    }
    document.addEventListener('keydown', this._onInputFieldPickerKeydown);

    const first = dialog.querySelector('.input-field-picker-option:not([disabled])');
    if (first && typeof first.focus === 'function') {
      first.focus();
    }
  }

  closeInputFieldPicker() {
    const backdrop = document.getElementById('inputFieldPickerBackdrop');
    const dialog = document.getElementById('inputFieldPickerDialog');
    const trigger = document.getElementById('inputFieldPickerTrigger');

    if (backdrop) {
      backdrop.hidden = true;
      backdrop.setAttribute('aria-hidden', 'true');
    }
    if (dialog) {
      dialog.hidden = true;
    }
    this._inputFieldPickerOpen = false;
    this._isInputFieldPickerMobile = false;
    dialog?.style.removeProperty('left');
    dialog?.style.removeProperty('top');
    dialog?.style.removeProperty('width');
    dialog?.style.removeProperty('max-height');
    dialog?.style.removeProperty('position');
    document.body.classList.remove('input-field-picker-open');
    document.removeEventListener('keydown', this._onInputFieldPickerKeydown);
    document.removeEventListener('mousedown', this._onInputFieldPickerOutsideClick);
    window.removeEventListener('resize', this._onInputFieldPickerViewportChange);
    window.removeEventListener('scroll', this._onInputFieldPickerViewportChange, true);

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      if (typeof trigger.focus === 'function') {
        trigger.focus();
      }
    }
  }

  isMobileInputFieldPicker() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }
    const mql = window.matchMedia('(max-width: 767px)');
    return !!(mql && typeof mql.matches === 'boolean' && mql.matches);
  }

  positionInputFieldPickerDialog() {
    const dialog = document.getElementById('inputFieldPickerDialog');
    const trigger = document.getElementById('inputFieldPickerTrigger');
    if (!dialog || !trigger || typeof trigger.getBoundingClientRect !== 'function') return;

    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const spaceBelow = viewportHeight - rect.bottom - 12;
    const maxHeight = Math.max(220, Math.min(380, spaceBelow));

    dialog.style.position = 'fixed';
    dialog.style.left = `${Math.max(8, rect.left)}px`;
    dialog.style.top = `${rect.bottom + 6}px`;
    dialog.style.width = `${Math.max(220, rect.width)}px`;
    dialog.style.maxHeight = `${maxHeight}px`;
  }
  
  updateDropdownOptionsStyle() {
    const hasTrigger = !!document.getElementById('inputFieldPickerTrigger');
    if (hasTrigger) {
      this.ensureInputFieldPickerMounted();
    }

    const list = document.getElementById('inputFieldPickerList');
    const selectBox = document.getElementById('inputFieldSelect');

    if (!list && !selectBox) {
      return;
    }

    const container = document.getElementById('inputFieldsContainer');
    if (!container) return;
    
    // Eklenmiş olan input field'ları bul (button birden fazla eklenebilir — picker'da devre dışı bırakılmaz)
    const addedFields = new Set();
    const items = container.querySelectorAll('.custom-input-item');
    items.forEach(item => {
      if (item.getAttribute('data-input-type') === 'consent') {
        addedFields.add('consent');
      }
      const inputName = item.getAttribute('data-input-name');
      if (inputName) {
        const templateTypes = ['email', 'full_name', 'phone', 'address', 'birth_date', 'rating'];
        for (let type of templateTypes) {
          const template = this.getInputFieldTemplate(type);
          if (template && template.name === inputName) {
            addedFields.add(type);
            break;
          }
        }
      }
    });

    if (list) {
      list.querySelectorAll('.input-field-picker-option[data-field-type]').forEach((btn) => {
        const value = btn.getAttribute('data-field-type');
        const base = btn.getAttribute('data-base-label') || (btn.textContent || '').trim();
        if (value === 'button') {
          btn.disabled = false;
          btn.classList.remove('input-field-added');
          btn.textContent = base;
          return;
        }
        if (value === 'consent') {
          if (addedFields.has('consent')) {
            btn.disabled = true;
            btn.classList.add('input-field-added');
            btn.textContent = `Added — ${base}`;
          } else {
            btn.disabled = false;
            btn.classList.remove('input-field-added');
            btn.textContent = base;
          }
          return;
        }
        if (value && addedFields.has(value)) {
          btn.disabled = true;
          btn.classList.add('input-field-added');
          btn.textContent = `Added — ${base}`;
        } else if (value) {
          btn.disabled = false;
          btn.classList.remove('input-field-added');
          btn.textContent = base;
        }
      });
    }

    if (selectBox) {
      const options = selectBox.querySelectorAll('option');
      options.forEach(option => {
        const value = option.value;
        if (value && addedFields.has(value)) {
          option.style.color = '#9ca3af';
          option.style.opacity = '0.7';
          option.classList.add('input-field-added');
        } else {
          option.style.color = '';
          option.style.opacity = '';
          option.classList.remove('input-field-added');
        }
      });
    }
  }

  getInputFieldTemplate(type) {
    const templates = {
      'email': {
        label: 'Email',
        name: 'email',
        type: 'email',
        placeholder: 'Enter your email address'
      },
      'full_name': {
        label: 'Full Name',
        name: 'full_name',
        type: 'text',
        placeholder: 'Enter your full name'
      },
      'phone': {
        label: 'Phone Number',
        name: 'phone',
        type: 'tel',
        placeholder: 'Enter your phone number'
      },
      'address': {
        label: 'Address',
        name: 'address',
        type: 'text',
        placeholder: 'Enter your address'
      },
      'birth_date': {
        label: 'Date',
        name: 'birth_date',
        type: 'date',
        placeholder: 'Enter date',
      },
      'rating': {
        label: 'Rating',
        name: 'rating',
        type: 'star',
        placeholder: 'Rate from 1 to 5',
        min: 1,
        max: 5
      },
      consent: {
        label: 'Consent checkbox',
        name: 'policy',
        type: 'consent',
        policy_url: '',
        text_before: "I agree and I've read ",
        link_text: 'Terms and Privacy Policy',
        required: true,
      },
      'submit_button': {
        label: 'Submit Button',
        name: 'submit_button',
        type: 'submit_button',
        text: 'Submit',
        action: 'submit_form',
        action_url: ''
      },
      button: {
        label: 'Button',
        name: 'button',
        type: 'submit_button',
        text: 'Submit',
        action: 'submit_form',
        action_url: ''
      }
    };
    return templates[type] || null;
  }

  addInputFieldFromTemplate(templateType) {
    const template = this.getInputFieldTemplate(templateType);
    if (!template) return false;

    const container = document.getElementById('inputFieldsContainer');
    if (!container) return false;

    if (templateType === 'consent') {
      const existingConsent = container.querySelector('[data-input-type="consent"]');
      if (existingConsent) {
        if (typeof toastr !== 'undefined') {
          toastr.warning('Only one consent checkbox can be added.');
        } else {
          console.warn('Only one consent checkbox can be added.');
        }
        return false;
      }
    }

    if (templateType !== 'button' && templateType !== 'submit_button' && templateType !== 'consent') {
      const existingInputs = container.querySelectorAll(`[data-input-name="${template.name}"]`);
      if (existingInputs.length > 0) {
        if (typeof toastr !== 'undefined') {
          toastr.warning('This input field has already been added.');
        } else {
          console.warn('This input field has already been added.');
        }
        return false;
      }
    }

    const uniqueName =
      templateType === 'button' || templateType === 'submit_button'
        ? `submit_button_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        : template.name;

    const baseStyle =
      (templateType === 'button' || templateType === 'submit_button') &&
      getPrimarySubmitFieldStyle(this.theme)
        ? { ...getPrimarySubmitFieldStyle(this.theme) }
        : undefined;

    const inputData = {
      id: this.generateInputFieldId(),
      ...template,
      name: uniqueName,
      required:
        templateType === 'email'
          ? true
          : templateType === 'consent'
            ? template.required !== false
            : false,
    };
    if ((templateType === 'button' || templateType === 'submit_button') && baseStyle && !inputData.style) {
      inputData.style = baseStyle;
    }
    if (templateType === 'consent' && !inputData.style) {
      inputData.style = {
        'font-family': 'Arial, Helvetica, sans-serif',
        color: '',
        'link-color': '',
        'checkbox-scale': '1.3',
        alignment: 'center',
      };
    }

    const insertTextBeforeButtons =
      templateType !== 'button' &&
      templateType !== 'submit_button' &&
      templateType !== 'consent';
    this.renderInputFieldItem(inputData, { insertTextBeforeButtons });
    
    this.initInputFieldsSortable();
    
    let inputFields = this.getInputFieldsData();
    if (isTextLikeInputTemplateType(templateType)) {
      const newId = inputData.id;
      inputFields = inputFields.map((f) => {
        if (!f || f.id !== newId) return f;
        const fromDom =
          f.style && typeof f.style === 'object' ? { ...f.style } : {};
        return {
          ...f,
          style: {
            ...DEFAULT_TEXT_INPUT_FIELD_STYLE,
            ...fromDom,
          },
        };
      });
    }
    this.renderInputFieldsInWidget(inputFields);
    
    if (this.theme) {
      this.theme.input_fields = inputFields;
    }
    
    // Update style settings visibility
    this.updateStyleSettingsVisibility();
    
    // Update dropdown options style
    this.updateDropdownOptionsStyle();
    return true;
  }

  generateInputFieldId() {
    return 'input_field_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Sidebar (#inputFieldsContainer) satırı. Metin alanları ilk butondan önce eklenir;
   * böylece Full Name vb. email ile CTA butonları arasında kalır (sıra Sortable ile değiştirilebilir).
   */
  _appendInputFieldsListRow(container, rowEl, insertBeforeFirstButton) {
    if (insertBeforeFirstButton) {
      const firstBtn = container.querySelector(
        '.custom-input-item[data-input-type="submit_button"]',
      );
      if (firstBtn) {
        container.insertBefore(rowEl, firstBtn);
        return;
      }
    }
    container.appendChild(rowEl);
  }

  renderInputFieldItem(inputData, options = {}) {
    const container = document.getElementById('inputFieldsContainer');
    if (!container) return;

    const insertTextBeforeButtons = Boolean(options.insertTextBeforeButtons);

    const itemId = inputData.id || this.generateInputFieldId();
    const itemDiv = document.createElement('div');
    itemDiv.className = 'custom-input-item';
    itemDiv.setAttribute('data-input-id', itemId);
    itemDiv.setAttribute('data-input-name', inputData.name);

    if (this.isButtonFieldType(inputData.type)) {
      const label = inputData.label || 'Button';
      let text =
        inputData.text != null ? String(inputData.text) : 'Submit';
      text = normalizeSubmitButtonTextInput(text);
      if (inputData.text == null && text === '') text = 'Submit';
      const action = inputData.action || 'submit_form';
      const actionUrl = inputData.action_url || '';
      itemDiv.setAttribute('data-input-type', 'submit_button');
      itemDiv.setAttribute('data-field-label', label);
      itemDiv.setAttribute('data-button-text', text);
      itemDiv.setAttribute('data-button-action', action);
      itemDiv.setAttribute('data-button-action-url', actionUrl);

      setTimeout(() => {
        this.updateStyleSettingsVisibility();
      }, 100);

      itemDiv.innerHTML = `
      <span class="drag-handle" style="cursor: move; color: #6c757d; margin-right: 8px; font-size: 1.2rem;" title="Drag to reorder">
        <i class="bi bi-grip-vertical"></i>
      </span>
      <span class="custom-input-item-title">${this.escapeHtml(this.formatButtonListTitle(text, label))}</span>
      <div class="custom-input-item-actions" style="display:flex; align-items:center; gap:12px;">
        <button type="button" class="btn btn-sm btn-link text-secondary p-0 edit-input-field-btn" data-input-id="${itemId}" title="Edit" style="text-decoration: none;">
          <i class="bi bi-pencil"></i>
        </button>
        <button type="button" class="btn btn-sm btn-link text-danger p-0 remove-input-field-btn" data-input-id="${itemId}" title="Delete" style="text-decoration: none;">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;

      this._appendInputFieldsListRow(container, itemDiv, false);
      return;
    }

    if (inputData.type === 'consent') {
      const payload = {
        policy_url: inputData.policy_url || '',
        text_before:
          inputData.text_before != null
            ? inputData.text_before
            : "I agree and I've read ",
        link_text:
          inputData.link_text != null ? inputData.link_text : 'Terms and Privacy Policy',
        required: inputData.required !== false,
      };
      itemDiv.setAttribute('data-input-type', 'consent');
      itemDiv.setAttribute('data-input-name', 'policy');
      itemDiv.setAttribute('data-consent-fields', JSON.stringify(payload));
      setTimeout(() => {
        this.updateStyleSettingsVisibility();
      }, 100);
      itemDiv.innerHTML = `
      <span class="drag-handle" style="cursor: move; color: #6c757d; margin-right: 8px; font-size: 1.2rem;" title="Drag to reorder">
        <i class="bi bi-grip-vertical"></i>
      </span>
      <span class="custom-input-item-title">${this.escapeHtml(inputData.label || 'Consent checkbox')}</span>
      <div class="custom-input-item-actions" style="display:flex; align-items:center; gap:12px;">
        <button type="button" class="btn btn-sm btn-link text-secondary p-0 edit-input-field-btn" data-input-id="${itemId}" title="Edit" style="text-decoration: none;">
          <i class="bi bi-pencil"></i>
        </button>
        <button type="button" class="btn btn-sm btn-link text-danger p-0 remove-input-field-btn" data-input-id="${itemId}" title="Delete" style="text-decoration: none;">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
      this._appendInputFieldsListRow(container, itemDiv, false);
      return;
    }

    const isRequired = Boolean(inputData.required);
    const placeholder = inputData.placeholder || '';
    const templateTypes = ['email', 'full_name', 'phone', 'address', 'birth_date', 'rating'];
    let template = null;
    for (let type of templateTypes) {
      const t = this.getInputFieldTemplate(type);
      if (t && t.name === inputData.name) {
        template = t;
        break;
      }
    }
    const defaultPlaceholder = template ? (template.placeholder || '') : placeholder;
    const defaultOriginalRequired = template
      ? (template.name === 'email')
      : isRequired;
    const originalPlaceholder = inputData.original_placeholder ?? defaultPlaceholder;
    const originalRequired = inputData.original_required ?? defaultOriginalRequired;
    
    itemDiv.setAttribute('data-placeholder', placeholder);
    itemDiv.setAttribute('data-required', isRequired);
    itemDiv.setAttribute('data-original-placeholder', originalPlaceholder);
    itemDiv.setAttribute('data-original-required', originalRequired);
    itemDiv.setAttribute(
      'data-input-type',
      template ? template.type : (inputData.type || 'text')
    );

    if (inputData.original_placeholder === undefined) {
      inputData.original_placeholder = originalPlaceholder;
    }
    if (inputData.original_required === undefined) {
      inputData.original_required = originalRequired;
    }
    
    // Update style settings visibility after adding field
    setTimeout(() => {
      this.updateStyleSettingsVisibility();
    }, 100);
    
    itemDiv.innerHTML = `
      <span class="drag-handle" style="cursor: move; color: #6c757d; margin-right: 8px; font-size: 1.2rem;" title="Drag to reorder">
        <i class="bi bi-grip-vertical"></i>
      </span>
      <span class="custom-input-item-title">${this.escapeHtml(inputData.label)}</span>
      <div class="custom-input-item-actions" style="display:flex; align-items:center; gap:12px;">
        <button type="button" class="btn btn-sm btn-link text-secondary p-0 edit-input-field-btn" data-input-id="${itemId}" title="Edit" style="text-decoration: none;">
          <i class="bi bi-pencil"></i>
        </button>
        <button type="button" class="btn btn-sm btn-link text-danger p-0 remove-input-field-btn" data-input-id="${itemId}" title="Delete" style="text-decoration: none;">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;

    this._appendInputFieldsListRow(container, itemDiv, insertTextBeforeButtons);
  }

  removeInputField(inputId) {
    const item = document.querySelector(`[data-input-id="${inputId}"]`);
    if (item) {
      if (item.getAttribute('data-input-type') === 'submit_button') {
        const container = document.getElementById('inputFieldsContainer');
        const btnCount = container
          ? container.querySelectorAll('.custom-input-item[data-input-type="submit_button"]').length
          : 0;
        if (btnCount <= 1) {
          if (typeof toastr !== 'undefined') {
            toastr.warning('At least one button is required.');
          }
          return;
        }
      }
      // Close editor if open for this field
      const editor = item.nextElementSibling;
      if (editor && editor.classList.contains('inline-input-field-editor')) {
        editor.remove();
      }
      
      item.remove();
      
      this.initInputFieldsSortable();
      
      const inputFields = this.getInputFieldsData();
      this.renderInputFieldsInWidget(inputFields);
      
      if (this.theme) {
        this.theme.input_fields = inputFields;
      }
      
      // Update style settings visibility
      this.updateStyleSettingsVisibility();
      
      // Update dropdown options style
      this.updateDropdownOptionsStyle();
    }
  }

  loadInputFields(inputFields) {
    const container = document.getElementById('inputFieldsContainer');
    if (!container) {
      console.warn('inputFieldsContainer not found in DOM');
      return;
    }

    container.innerHTML = '';

    if (!inputFields || inputFields.length === 0) {
      return;
    }

    inputFields.forEach((input) => {
      if (input && input.type === 'button') {
        input.type = 'submit_button';
      }
      this.renderInputFieldItem(input);
    });
    
    this.initInputFieldsSortable();
    
    // Update style settings visibility
    this.updateStyleSettingsVisibility();
    
    // Update dropdown options style
    this.updateDropdownOptionsStyle();
  }
  
  initInputFieldsSortable() {
    const container = document.getElementById('inputFieldsContainer');
    if (!container) return;
    
    if (this.inputFieldsSortable) {
      this.inputFieldsSortable.destroy();
    }
    
    this.inputFieldsSortable = new Sortable(container, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onEnd: (evt) => {
        const inputFields = this.getInputFieldsData();
        if (this.theme) {
          this.theme.input_fields = inputFields;
        }
        this.renderInputFieldsInWidget(inputFields);
        this.updateStyleSettingsVisibility();
      }
    });
  }

  renderInputFieldsInWidget(inputFields) {
    const previewContainer = document.getElementById('additionalInputFields');
    if (previewContainer) {
      previewContainer.innerHTML = '';
      
      if (inputFields && inputFields.length > 0) {
        let primarySubmitIdAssigned = false;
        inputFields.forEach((input) => {
          if (input && input.type === 'consent') {
            const wrap = document.createElement('div');
            wrap.className = 'additional-input-field';
            wrap.style.marginBottom = '1rem';
            const box = document.createElement('div');
            box.className = 'consent-box';
            if (input.id) box.setAttribute('data-consent-field-id', String(input.id));
            box.style.width = '100%';
            box.style.maxWidth = '100%';
            const wheelluckContent = document.getElementById('wheelluckContent');
            const linkFallback =
              wheelluckContent && wheelluckContent.style && wheelluckContent.style.color
                ? wheelluckContent.style.color
                : '';
            applyConsentFieldToConsentBox(box, input, { linkColorFallback: linkFallback });
            const consentAlign = fieldStyleProp(input.style, 'alignment');
            if (consentAlign === 'center') {
              wrap.style.display = 'flex';
              wrap.style.justifyContent = 'center';
            } else if (consentAlign === 'right') {
              wrap.style.display = 'flex';
              wrap.style.justifyContent = 'flex-end';
            } else {
              wrap.style.display = 'flex';
              wrap.style.justifyContent = 'flex-start';
            }
            wrap.appendChild(box);
            wrap.addEventListener('click', (e) => {
              if (e.target && e.target.closest && e.target.closest('a[href]')) return;
              e.preventDefault();
              e.stopPropagation();
              this.openInputAccordionFromPreview();
            });
            previewContainer.appendChild(wrap);
            return;
          }
          const inputDiv = document.createElement('div');
          inputDiv.className = 'additional-input-field';
          inputDiv.style.marginBottom = '1rem';
          
          let inputElement;
          
          if (this.isButtonFieldType(input.type)) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'submit-button-widget';
            setSubmitWidgetText(btn, input.text != null ? String(input.text) : '');
            const action = input.action || 'submit_form';
            btn.setAttribute('data-action', action);
            btn.setAttribute('data-action-url', input.action_url || '');
            btn.setAttribute('data-field-type', 'submit_button');
            btn.setAttribute('data-field-name', input.name || '');
            btn.setAttribute('title', 'Open Input fields');
            const mergedBtnStyle = resolveButtonWidgetPreviewStyle(this.theme, input);
            if (mergedBtnStyle && Object.keys(mergedBtnStyle).length > 0) {
              applyStyleObject(btn, mergedBtnStyle, {
                important: true,
                exclude: ['htmlContent', 'alignment'],
              });
            }
            applyWlFormControlBoxSizing(btn);
            if (action === 'submit_form' && !primarySubmitIdAssigned) {
              btn.id = 'submit_button';
              primarySubmitIdAssigned = true;
            }
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.openInputAccordionFromPreview();
            });
            const btnAlign = fieldStyleProp(input.style, 'alignment');
            if (btnAlign) {
              const alignment = btnAlign;
              if (alignment === 'center') {
                inputDiv.style.display = 'flex';
                inputDiv.style.justifyContent = 'center';
              } else if (alignment === 'right') {
                inputDiv.style.display = 'flex';
                inputDiv.style.justifyContent = 'flex-end';
              } else {
                inputDiv.style.display = 'flex';
                inputDiv.style.justifyContent = 'flex-start';
              }
            }
            inputDiv.appendChild(btn);
            previewContainer.appendChild(inputDiv);
            return;
          }

          if (isStarRatingField(input)) {
            const starContainer = document.createElement('div');
            starContainer.className = 'star-rating-widget';
            starContainer.setAttribute('data-field-name', `wheel-${input.name}`);
            starContainer.style.display = 'flex';
            starContainer.style.gap = '0.75rem';
            starContainer.style.justifyContent = 'center';
            starContainer.style.alignItems = 'center';
            
            // Apply width to starContainer (same as inputElement for other fields)
            const starW = fieldStyleProp(input.style, 'width');
            if (starW) {
              starContainer.style.width = `${starW}%`;
            }
            
            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = `wheel-${input.name}`;
            hiddenInput.id = `star-rating-${input.name}`;
            hiddenInput.value = '';
            if (input.required) {
              hiddenInput.required = true;
            }
            applyWlFormControlBoxSizing(hiddenInput);

            for (let i = 1; i <= 5; i++) {
              const star = document.createElement('span');
              star.className = 'star-rating-star';
              star.innerHTML = '★';
              star.style.fontSize = '28px';
              star.style.color = '#ffffff';
              star.style.textShadow = '0 0 2px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.35)';
              star.style.cursor = 'pointer';
              star.style.transition = 'color 0.2s';
              star.style.userSelect = 'none';
              star.setAttribute('data-rating', i);
              starContainer.appendChild(star);
            }
            
            inputDiv.appendChild(hiddenInput);
            inputDiv.appendChild(starContainer);
            
            // Apply alignment to inputDiv (same as other input fields)
            const starAlign = fieldStyleProp(input.style, 'alignment');
            if (starAlign) {
              const alignment = starAlign;
              if (alignment === 'center') {
                inputDiv.style.display = 'flex';
                inputDiv.style.justifyContent = 'center';
              } else if (alignment === 'right') {
                inputDiv.style.display = 'flex';
                inputDiv.style.justifyContent = 'flex-end';
              } else {
                // left (default)
                inputDiv.style.display = 'flex';
                inputDiv.style.justifyContent = 'flex-start';
              }
            }
            
            setTimeout(() => {
              this.initStarRatingForContainer(starContainer, hiddenInput);
            }, 100);
          } else {
            inputElement = document.createElement('input');
            const dateField = isDateInputField(input);
            // Önizlemede tarih = diğer metin alanları (native date picker / ikon yok); canlı widget’ta özel takvim bağlanır.
            inputElement.type = 'text';
            inputElement.name = `wheel-${input.name}`;
            inputElement.placeholder =
              (input.placeholder != null && String(input.placeholder).trim() !== '')
                ? input.placeholder
                : dateField
                  ? input.label || 'Enter date'
                  : input.label || '';
            if (dateField) {
              inputElement.setAttribute('data-wl-input-kind', 'date');
              inputElement.setAttribute('autocomplete', 'off');
            }
            inputElement.className = 'form-control';
            inputElement.value = '';
            applyWlFormControlBoxSizing(inputElement);

            const fieldBg =
              fieldStyleProp(input.style, 'background') ??
              fieldStyleProp(input.style, 'background-color');
            if (fieldBg) {
              inputElement.style.setProperty('background', fieldBg, 'important');
            } else {
              inputElement.style.backgroundColor = '#f8f9fa';
            }
            const textColor = fieldStyleProp(input.style, 'color');
            if (textColor) {
              inputElement.style.setProperty('color', textColor, 'important');
            }

            inputElement.setAttribute('readonly', 'readonly');
            inputElement.style.cursor = 'pointer';
            inputElement.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.openInputAccordionFromPreview();
            });
            inputElement.addEventListener('keydown', (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.openInputAccordionFromPreview();
            });
            inputElement.addEventListener('focus', (e) => {
              e.preventDefault();
              e.stopPropagation();
              inputElement.blur();
            });

            // Apply common style (star/rating ayrı dallarda)
            if (!isStarRatingField(input) && input.style) {
              const s = input.style;
              const bc = fieldStyleProp(s, 'border-color');
              if (bc) inputElement.style.borderColor = bc;
              const bw = fieldStyleProp(s, 'border-width');
              if (bw != null && String(bw).trim() !== '') {
                inputElement.style.borderWidth = /px|em|rem|%$/i.test(String(bw).trim())
                  ? String(bw).trim()
                  : `${bw}px`;
              }
              const br = fieldStyleProp(s, 'border-radius');
              const brCss = normalizeBorderRadiusCssValue(br);
              if (brCss) {
                inputElement.style.setProperty('border-radius', brCss, 'important');
              }
              const hVal = fieldStyleProp(s, 'height');
              if (hVal != null && String(hVal).trim() !== '') {
                const hs = String(hVal).trim();
                if (hs === 'auto') {
                  inputElement.style.height = 'auto';
                } else {
                  inputElement.style.height = /px|em|rem|%|vh|vw/i.test(hs) ? hs : `${hs}px`;
                }
              }
              inputElement.style.borderStyle = 'solid';

              const pad = fieldStyleProp(s, 'padding');
              if (pad != null && pad !== '') {
                const p = String(pad);
                inputElement.style.padding = /px|em|rem|%|vh|vw/i.test(p) ? p : `${p}px`;
              }

              const alignIn = fieldStyleProp(s, 'alignment');
              if (alignIn) {
                const alignment = alignIn;
                if (alignment === 'center') {
                  inputDiv.style.display = 'flex';
                  inputDiv.style.justifyContent = 'center';
                } else if (alignment === 'right') {
                  inputDiv.style.display = 'flex';
                  inputDiv.style.justifyContent = 'flex-end';
                } else {
                  // left (default)
                  inputDiv.style.display = 'flex';
                  inputDiv.style.justifyContent = 'flex-start';
                }
              }
              
              const phCol = fieldStyleProp(s, 'placeholder-color');
              if (phCol) {
                const styleId = `input-style-${input.id || input.name}`;
                let styleElement = document.getElementById(styleId);
                if (!styleElement) {
                  styleElement = document.createElement('style');
                  styleElement.id = styleId;
                  document.head.appendChild(styleElement);
                }
                styleElement.textContent = `
                  input[name="wheel-${input.name}"]::placeholder {
                    color: ${phCol} !important;
                  }
                  input[name="wheel-${input.name}"]::-webkit-input-placeholder {
                    color: ${phCol} !important;
                  }
                  input[name="wheel-${input.name}"]::-moz-placeholder {
                    color: ${phCol} !important;
                    opacity: 1;
                  }
                  input[name="wheel-${input.name}"]:-ms-input-placeholder {
                    color: ${phCol} !important;
                  }
                `;
              }
            }
            
            if (input.type === 'number') {
              if (input.min !== undefined) {
                inputElement.min = input.min;
              }
              if (input.max !== undefined) {
                inputElement.max = input.max;
              }
            }
            
            if (input.required) {
              inputElement.required = true;
            }
            const sw = input.style ? fieldStyleProp(input.style, 'width') : undefined;
            const wTrim = sw != null ? String(sw).trim() : '';
            if (wTrim) {
              const wNum = wTrim.replace(/%$/, '').trim();
              const wn = parseFloat(wNum);
              inputElement.style.width = Number.isFinite(wn) ? `${wn}%` : '100%';
            } else {
              inputElement.style.width = '100%';
            }
            inputElement.style.maxWidth = '100%';

            inputDiv.appendChild(inputElement);
          }

          previewContainer.appendChild(inputDiv);
        });
      }
    }
    
    if (this.theme) {
      this.theme.input_fields = inputFields || [];
    }

    removeLegacyCloseLinkIfUnified(this.theme);
    this.themeManager?.textEditorManager?.bindInputFieldPreviewWidgets?.();
  }

  /** Sağ kolon accordion layout oturduktan sonra Input bölümünü üste kaydırır. */
  _scheduleScrollInputAccordionAfterLayout() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.themeManager?.popupManager?.scrollPopupToTop?.('collapseInput');
      });
    });
  }

  /**
   * Preview'daki input field'a tıklandığında Input accordion'unu aç
   */
  openInputAccordionFromPreview() {
    const accordionButton = document.querySelector('.accordion-button[aria-controls="collapseInput"]');
    const accordionContent = document.getElementById('collapseInput');
    
    if (accordionButton && accordionContent) {
      const wasOpen = accordionContent.classList.contains('show');
      const collapseInstance = bootstrap.Collapse.getOrCreateInstance(accordionContent, {
        toggle: false
      });
      if (!wasOpen) {
        accordionContent.addEventListener(
          'shown.bs.collapse',
          () => this._scheduleScrollInputAccordionAfterLayout(),
          { once: true }
        );
      }
      collapseInstance.show();
      if (wasOpen) {
        this._scheduleScrollInputAccordionAfterLayout();
      }
    }
  }

  initStarRatingForContainer(container, hiddenInput) {
    if (container.getAttribute('data-initialized') === 'true') {
      return;
    }
    
    container.setAttribute('data-initialized', 'true');
    const stars = container.querySelectorAll('.star-rating-star');
    let currentRating = 0;
    
    function updateStars(starElements, rating) {
      starElements.forEach((star, index) => {
        if (index < rating) {
          star.style.color = '#ffd700';
        } else {
          star.style.color = '#ffffff';
        }
      });
    }
    
    stars.forEach((star, index) => {
      const rating = index + 1;
      
      star.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        currentRating = rating;
        updateStars(stars, currentRating);
        if (hiddenInput) {
          hiddenInput.value = currentRating;
          hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      
      star.addEventListener('mouseenter', function() {
        updateStars(stars, rating);
      });
    });
    
    container.addEventListener('mouseleave', function() {
      updateStars(stars, currentRating);
    });
  }

  getInputFieldsData() {
    const container = document.getElementById('inputFieldsContainer');
    if (!container) return [];

    const items = container.querySelectorAll('.custom-input-item');
    const inputs = [];

    items.forEach((item) => {
      const inputId = item.getAttribute('data-input-id');
      const inputName = item.getAttribute('data-input-name');
      const titleElement = item.querySelector('.custom-input-item-title');
      const fieldType = item.getAttribute('data-input-type');

      if (this.isButtonFieldType(fieldType) && inputName) {
        const rawLabel =
          item.getAttribute('data-field-label') ||
          (titleElement ? titleElement.textContent : '') ||
          'Button';
        const label = String(rawLabel).replace(/\s+/g, ' ').trim();
        const prev =
          Array.isArray(this.theme?.input_fields) && inputId
            ? this.theme.input_fields.find((f) => f.id === inputId)
            : null;
        const style = prev && prev.style && typeof prev.style === 'object' ? { ...prev.style } : {};
        inputs.push({
          id: inputId,
          label: label || 'Button',
          name: inputName,
          type: 'submit_button',
          text: item.getAttribute('data-button-text') || '',
          action: item.getAttribute('data-button-action') || 'submit_form',
          action_url: item.getAttribute('data-button-action-url') || '',
          style
        });
        return;
      }

      if (fieldType === 'consent') {
        let payload = {};
        try {
          payload = JSON.parse(item.getAttribute('data-consent-fields') || '{}');
        } catch (_) {
          payload = {};
        }
        const prev =
          Array.isArray(this.theme?.input_fields) && inputId
            ? this.theme.input_fields.find((f) => f && f.id === inputId && f.type === 'consent')
            : null;
        const style =
          prev && prev.style && typeof prev.style === 'object' ? { ...prev.style } : {};
        const policyFromDom = String(payload.policy_url ?? '').trim();
        const policyFromPrev = String(prev?.policy_url ?? '').trim();
        const policy_url = policyFromDom || policyFromPrev || '';
        const text_before =
          payload.text_before != null
            ? payload.text_before
            : prev?.text_before != null
              ? prev.text_before
              : '';
        const link_text =
          payload.link_text != null
            ? payload.link_text
            : prev?.link_text != null
              ? prev.link_text
              : 'Terms and Privacy Policy';
        const required =
          payload.required !== undefined ? payload.required !== false : prev?.required !== false;
        inputs.push({
          id: inputId,
          label: (titleElement && titleElement.textContent.trim()) || 'Consent checkbox',
          name: 'policy',
          type: 'consent',
          policy_url,
          text_before,
          link_text,
          required,
          style,
        });
        return;
      }

      if (inputName && titleElement) {
        const templateTypes = ['email','full_name', 'phone', 'address', 'birth_date', 'rating'];
        let template = null;
        for (let type of templateTypes) {
          const t = this.getInputFieldTemplate(type);
          if (t && t.name === inputName) {
            template = t;
            break;
          }
        }
        
        if (template) {
          const storedPlaceholder = item.getAttribute('data-placeholder');
          const placeholder = storedPlaceholder !== null ? storedPlaceholder : (template.placeholder || '');
          
          const storedRequired = item.getAttribute('data-required');
          const required = storedRequired === 'true' || storedRequired === true;
          
          const storedOriginalPlaceholder = item.getAttribute('data-original-placeholder');
          const originalPlaceholder = storedOriginalPlaceholder !== null ? storedOriginalPlaceholder : (template.placeholder || '');
          
          const storedOriginalRequired = item.getAttribute('data-original-required');
          const defaultOriginalRequired = template.name === 'email';
          const originalRequired = storedOriginalRequired !== null
            ? (storedOriginalRequired === 'true' || storedOriginalRequired === true)
            : defaultOriginalRequired;
          
          const inputData = {
            id: inputId,
            label: titleElement.textContent || template.label,
            name: template.name,
            type: template.type,
            placeholder: placeholder,
            required: required,
            original_placeholder: originalPlaceholder,
            original_required: originalRequired
          };
          
          if (template.min !== undefined) {
            inputData.min = template.min;
          }
          if (template.max !== undefined) {
            inputData.max = template.max;
          }
          
          const prev =
            Array.isArray(this.theme?.input_fields) && inputId
              ? this.theme.input_fields.find((f) => f.id === inputId)
              : null;
          let style = {};
          if (prev?.style && typeof prev.style === 'object' && Object.keys(prev.style).length > 0) {
            style = { ...prev.style };
          } else if (
            this.theme.input_fields_style &&
            Object.keys(this.theme.input_fields_style).length > 0
          ) {
            style = { ...this.theme.input_fields_style };
          }
          inputData.style = style;
          
          inputs.push(inputData);
        }
      }
    });

    return inputs;
  }

  editInputField(inputId) {
    // Close any existing editor
    this.closeInputFieldEditor();
    
    const item = document.querySelector(`[data-input-id="${inputId}"]`);
    if (!item) return;

    const inputName = item.getAttribute('data-input-name');
    const fieldType = item.getAttribute('data-input-type');

    if (this.isButtonFieldType(fieldType)) {
      this.editButtonInputField(inputId);
      return;
    }

    if (fieldType === 'consent') {
      this.editConsentInputField(inputId);
      return;
    }

    if (!inputName) return;

    const templateTypes = ['full_name', 'phone', 'address', 'birth_date', 'rating', 'email'];
    let template = null;
    for (let type of templateTypes) {
      const t = this.getInputFieldTemplate(type);
      if (t && t.name === inputName) {
        template = t;
        break;
      }
    }

    if (!template) return;

    const showPlaceholder = template.name !== 'rating';
    
    const storedPlaceholder = item.getAttribute('data-placeholder');
    const storedOriginalPlaceholder = item.getAttribute('data-original-placeholder');
    const inputFields = this.getInputFieldsData();
    const currentInput = inputFields.find(f => f.id === inputId);
    const currentPlaceholder = showPlaceholder ? (storedPlaceholder || (currentInput ? currentInput.placeholder : template.placeholder)) : '';
    
    const storedRequired = item.getAttribute('data-required');
    const storedOriginalRequired = item.getAttribute('data-original-required');
    const currentRequired = storedRequired === 'true' || storedRequired === true;

    // Get template
    const templateElement = document.getElementById('inlineInputFieldEditorTemplate');
    if (!templateElement) return;
    
    // Clone template
    const editorElement = templateElement.content.cloneNode(true);
    const editorDiv = editorElement.querySelector('.inline-input-field-editor');
    
    // Fill in values
    editorDiv.querySelector('.edit-input-field-id').value = inputId;
    editorDiv.querySelector('.edit-input-field-name').value = template.name;
    editorDiv.querySelector('.edit-input-field-type').value = template.type;
    const placeholderInput = editorDiv.querySelector('.edit-input-field-placeholder');
    const requiredToggle = editorDiv.querySelector('.edit-input-field-required');
    if (placeholderInput) {
      placeholderInput.value = currentPlaceholder || '';
      const originalPlaceholder = storedOriginalPlaceholder !== null ? storedOriginalPlaceholder : (template.placeholder || '');
      placeholderInput.setAttribute('data-original-value', originalPlaceholder);
    }
    if (requiredToggle) {
      requiredToggle.checked = currentRequired;
      const defaultOriginalRequired = template.name === 'email';
      const originalRequired = storedOriginalRequired !== null
        ? storedOriginalRequired === 'true'
        : defaultOriginalRequired;
      requiredToggle.setAttribute('data-original-value', originalRequired ? 'true' : 'false');
    }
    
    const placeholderCol = editorDiv.querySelector('.edit-inline-placeholder-col');
    if (placeholderCol) {
      placeholderCol.style.display = showPlaceholder ? '' : 'none';
    }

    const initialStyle =
      currentInput && currentInput.style && typeof currentInput.style === 'object'
        ? { ...currentInput.style }
        : {};
    editorDiv.dataset.initialInlineFieldStyle = JSON.stringify(initialStyle);

    const safeId = String(inputId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const bcBoxEl = editorDiv.querySelector('.edit-style-borderColor-box');
    const bcInputEl = editorDiv.querySelector('.edit-style-borderColor');
    const phBoxEl = editorDiv.querySelector('.edit-style-placeholderColor-box');
    const phInputEl = editorDiv.querySelector('.edit-style-placeholderColor');
    if (bcBoxEl && bcInputEl) {
      bcBoxEl.id = `inlineFieldBcBox_${safeId}`;
      bcInputEl.id = `inlineFieldBc_${safeId}`;
    }
    if (phBoxEl && phInputEl) {
      phBoxEl.id = `inlineFieldPhBox_${safeId}`;
      phInputEl.id = `inlineFieldPh_${safeId}`;
    }

    this.fillInlineFieldStyleEditor(editorDiv, initialStyle);

    // Insert after the item
    item.insertAdjacentElement('afterend', editorDiv);

    // Scroll into view
    editorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const live = () => this._scheduleInlineFieldEditorLiveApply(editorDiv);

    if (placeholderInput) {
      placeholderInput.addEventListener('input', live);
    }
    if (requiredToggle) {
      requiredToggle.addEventListener('change', live);
    }
    editorDiv.querySelectorAll('.per-field-style-section input').forEach((el) => {
      el.addEventListener('input', live);
      el.addEventListener('change', live);
    });
    editorDiv.querySelectorAll('.edit-style-alignment').forEach((el) => {
      el.addEventListener('change', live);
    });

    const liveFromPicker = () => this._requestImmediateLiveApply(editorDiv);
    setTimeout(() => {
      if (!document.body.contains(editorDiv)) return;
      if (bcBoxEl && bcInputEl && bcBoxEl.id && bcInputEl.id) {
        setupPicker(
          bcBoxEl.id,
          bcInputEl.id,
          bcInputEl.value || '#dee2e6',
          null,
          null,
          () => liveFromPicker(),
        );
      }
      if (phBoxEl && phInputEl && phBoxEl.id && phInputEl.id) {
        setupPicker(
          phBoxEl.id,
          phInputEl.id,
          phInputEl.value || '#6c757d',
          null,
          null,
          () => liveFromPicker(),
        );
      }
    }, 10);

    this._scheduleInlineFieldEditorLiveApply(editorDiv);
  }

  editButtonInputField(inputId) {
    const item = document.querySelector(`[data-input-id="${inputId}"]`);
    if (!item) return;

    const inputFields = this.getInputFieldsData();
    const current = inputFields.find((f) => f.id === inputId);
    const text = normalizeSubmitButtonTextInput(
      (current && current.text != null ? String(current.text) : null) ||
        item.getAttribute('data-button-text') ||
        '',
    );
    const action = (current && current.action) || item.getAttribute('data-button-action') || 'submit_form';
    const actionUrl = (current && current.action_url) || item.getAttribute('data-button-action-url') || '';
    const label =
      item.getAttribute('data-field-label') ||
      (item.querySelector('.custom-input-item-title')?.textContent || '').replace(/\s+/g, ' ').trim() ||
      'Button';

    const editorDiv = document.createElement('div');
    editorDiv.className =
      'inline-input-field-editor card shadow-sm border-0 rounded-3 p-3';
    editorDiv.style.marginTop = '0.5rem';
    editorDiv.innerHTML = `
      <input type="hidden" class="edit-button-field-id" />
      <div class="d-flex justify-content-between align-items-center pb-2 border-bottom border-secondary" style="margin-bottom:1rem;">
        <div>
          <h6 class="fw-semibold" style="margin-bottom:0;">Edit Button</h6>
          <span class="small text-muted">Preview updates as you edit</span>
        </div>
        <button type="button" class="btn-close inline-button-editor-close" aria-label="Close"></button>
      </div>
      <div class="row g-3">
        <input type="hidden" class="edit-button-field-label" />
        <div class="col-12">
          <label class="form-label small fw-semibold" style="margin-bottom:0.5rem;">Button text &amp; action</label>
          <div class="rounded-3 border bg-body-secondary bg-opacity-10 p-3">
            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Button text</label>
                <input type="text" class="form-control form-control-sm edit-button-field-text rounded-2" maxlength="${SUBMIT_BUTTON_TEXT_MAX_LEN}">
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Action</label>
                <select class="form-select form-select-sm edit-button-field-action rounded-2">
                  <option value="submit_form">Submit Form</option>
                  <option value="go_to_url">Go to URL</option>
                  <option value="close_form">Close Form</option>
                </select>
              </div>
              <div class="col-12 edit-button-url-wrap" style="display:none;">
                <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">URL</label>
                <input type="url" class="form-control form-control-sm edit-button-field-url rounded-2" placeholder="https://">
              </div>
            </div>
          </div>
        </div>

        <div class="col-12">
          <label class="form-label small fw-semibold" style="margin-bottom:0.5rem;">Layout</label>
          <div class="rounded-3 border bg-body-secondary bg-opacity-10 p-3">
            <div class="row g-2">
              <div class="col-12 col-md-4">
                <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Button position</label>
                <select class="form-select form-select-sm edit-button-style-alignment rounded-2">
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div class="col-12 col-md-4">
                <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Width</label>
                <input type="number" class="form-control form-control-sm edit-button-style-width rounded-2" min="${BUTTON_EDITOR_WIDTH_PCT_MIN}" max="${BUTTON_EDITOR_WIDTH_PCT_MAX}" step="1" value="100" inputmode="numeric" autocomplete="off">
              </div>
              <div class="col-12 col-md-4">
                <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Height</label>
                <input type="number" class="form-control form-control-sm edit-button-style-height rounded-2" min="${BUTTON_EDITOR_HEIGHT_PX_MIN}" max="${BUTTON_EDITOR_HEIGHT_PX_MAX}" step="1" value="40" inputmode="numeric" autocomplete="off">
              </div>
            </div>
          </div>
        </div>

        <div class="col-12">
          <label class="form-label small fw-semibold" style="margin-bottom:0.5rem;">Text style</label>
          <div class="rounded-3 border bg-body-secondary bg-opacity-10 p-3">
            <div class="row g-2 align-items-end">
              <div class="col-12 col-md-4">
                <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Font</label>
                <select class="form-select form-select-sm edit-button-style-font-family rounded-2">
                  <option value="Arial">Arial</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Trebuchet MS">Trebuchet MS</option>
                  <option value="Segoe UI">Segoe UI</option>
                  <option value="system-ui">System UI</option>
                  <option value="inherit">Inherit</option>
                </select>
              </div>
              <div class="col-6 col-md-2">
                <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Size (px)</label>
                <input type="number" class="form-control form-control-sm edit-button-style-font-size rounded-2" min="8" max="48" step="1" value="16">
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label small text-secondary d-block" style="margin-bottom:0.25rem;">Style</label>
                <div class="btn-group btn-group-sm" role="group">
                  <input type="checkbox" class="btn-check edit-button-style-bold" id="edit-btn-bold-${inputId}" autocomplete="off">
                  <label class="btn btn-outline-secondary" for="edit-btn-bold-${inputId}" title="Bold"><strong>B</strong></label>
                  <input type="checkbox" class="btn-check edit-button-style-italic" id="edit-btn-italic-${inputId}" autocomplete="off">
                  <label class="btn btn-outline-secondary" for="edit-btn-italic-${inputId}" title="Italic"><em>I</em></label>
                  <input type="checkbox" class="btn-check edit-button-style-underline" id="edit-btn-ul-${inputId}" autocomplete="off">
                  <label class="btn btn-outline-secondary" for="edit-btn-ul-${inputId}" title="Underline"><u>U</u></label>
                </div>
              </div>
              <div class="col-12 col-md-6" style="margin-top:0.5rem;">
                <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Text alignment</label>
                <select class="form-select form-select-sm edit-button-style-text-align rounded-2">
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div class="col-12 col-md-6" style="margin-top:0.5rem;">
                <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Text color</label>
                <div class="d-flex align-items-center gap-1 flex-wrap">
                  <div class="flex-shrink-0 promotion-color-swatch-frame">
                    <div class="color-box edit-button-picker-swatch" data-wl-picker="btn-text" title="Text color" role="button" tabindex="0" aria-label="Text color"></div>
                  </div>
                  <input type="hidden" class="edit-button-style-color" autocomplete="off">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12">
          <label class="form-label small fw-semibold" style="margin-bottom:0.5rem;">Fill &amp; border</label>
          <div class="rounded-3 border bg-body-secondary bg-opacity-10 p-3">
            <div class="d-flex gap-2 align-items-center flex-wrap">
              <div class="d-flex align-items-center flex-shrink-0 inline-input-field-editor-fill-toggle-col">
                <div class="form-check form-switch" style="margin-bottom:0;">
                  <input class="form-check-input edit-button-use-bg" type="checkbox" role="switch" id="edit-btn-usebg-${inputId}" checked>
                  <label class="form-check-label small text-nowrap" for="edit-btn-usebg-${inputId}">Background</label>
                </div>
              </div>
              <fieldset class="edit-button-bg-fieldset border-0 p-0 m-0 flex-shrink-0 d-flex align-items-center gap-1">
                <legend class="visually-hidden">Background color</legend>
                <div class="flex-shrink-0 promotion-color-swatch-frame">
                  <div class="color-box edit-button-picker-swatch" data-wl-picker="btn-bg" title="Background" role="button" tabindex="0" aria-label="Background color"></div>
                </div>
                <input type="hidden" class="edit-button-style-bg" autocomplete="off">
              </fieldset>
            </div>

            <div class="pt-3 border-top border-secondary" style="margin-top:1rem;">
              <div class="d-flex flex-wrap align-items-end column-gap-2 row-gap-2">
                <div class="d-flex align-items-center flex-shrink-0 inline-input-field-editor-fill-toggle-col align-self-end">
                  <div class="form-check form-switch" style="margin-bottom:0;">
                    <input class="form-check-input edit-button-use-border" type="checkbox" role="switch" id="edit-btn-usebd-${inputId}">
                    <label class="form-check-label small text-nowrap" for="edit-btn-usebd-${inputId}">Border</label>
                  </div>
                </div>
                <fieldset class="edit-button-border-color-fieldset border-0 p-0 m-0 flex-shrink-0 align-self-end d-flex align-items-center gap-1">
                  <legend class="visually-hidden">Border color</legend>
                  <div class="flex-shrink-0 promotion-color-swatch-frame">
                    <div class="color-box edit-button-picker-swatch" data-wl-picker="btn-border" title="Border color" role="button" tabindex="0" aria-label="Border color"></div>
                  </div>
                  <input type="hidden" class="edit-button-style-border-c" autocomplete="off">
                </fieldset>
                <fieldset class="edit-button-border-extras-fieldset border-0 p-0 m-0 flex-grow-1" style="min-width: 12rem;">
                  <legend class="visually-hidden">Border size and radius</legend>
                  <div class="d-flex flex-wrap align-items-end gap-2">
                    <div class="flex-shrink-0" style="width: 5.5rem;">
                      <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Width (px)</label>
                      <input type="number" class="form-control form-control-sm edit-button-style-border-w rounded-2" min="0" max="24" step="1" value="0">
                    </div>
                    <div class="flex-shrink-0" style="width: 6rem;">
                      <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Corner radius</label>
                      <input type="number" class="form-control form-control-sm edit-button-style-radius rounded-2" min="${BUTTON_EDITOR_BORDER_RADIUS_PX_MIN}" max="${BUTTON_EDITOR_BORDER_RADIUS_PX_MAX}" step="1" value="30" inputmode="numeric" autocomplete="off">
                    </div>
                  </div>
                </fieldset>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-12">
          <div class="d-flex flex-wrap justify-content-end align-items-center gap-2 pt-2 border-top" style="margin-top:0.25rem;">
            <button type="button" class="btn btn-outline-secondary btn-sm reset-edit-input-field rounded-2" title="Reset"><i class="bi bi-arrow-counterclockwise"></i></button>
          </div>
        </div>
      </div>
    `;

    const idHidden = editorDiv.querySelector('.edit-button-field-id');
    if (idHidden) idHidden.value = inputId;

    const labelInputEl = editorDiv.querySelector('.edit-button-field-label');
    const textInputEl = editorDiv.querySelector('.edit-button-field-text');
    if (labelInputEl) labelInputEl.value = label;
    if (textInputEl) textInputEl.value = text;

    const actionSelect = editorDiv.querySelector('.edit-button-field-action');
    const urlWrap = editorDiv.querySelector('.edit-button-url-wrap');
    const urlInput = editorDiv.querySelector('.edit-button-field-url');
    if (actionSelect) {
      actionSelect.value = action;
      const toggleUrl = () => {
        const show = actionSelect.value === 'go_to_url';
        if (urlWrap) urlWrap.style.display = show ? 'block' : 'none';
      };
      actionSelect.addEventListener('change', () => {
        toggleUrl();
        this._scheduleButtonEditorLiveApply(editorDiv);
      });
      toggleUrl();
    }
    if (urlInput) {
      urlInput.value = actionUrl;
    }

    const initialStyle = JSON.parse(JSON.stringify((current && current.style) || {}));
    editorDiv.dataset.initialButtonStyle = JSON.stringify(initialStyle);
    this.fillButtonStyleEditorInputs(editorDiv, initialStyle);

    editorDiv.querySelectorAll('input, select, textarea').forEach((el) => applyWlFormControlBoxSizing(el));

    item.insertAdjacentElement('afterend', editorDiv);
    editorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const live = () => this._scheduleButtonEditorLiveApply(editorDiv);
    editorDiv.querySelectorAll('input:not(.btn-check), select, textarea').forEach((el) => {
      el.addEventListener('input', live);
      el.addEventListener('change', live);
    });
    editorDiv.querySelectorAll('.btn-check').forEach((el) => {
      el.addEventListener('change', live);
    });

    this._bindButtonEditorColorPickers(editorDiv, inputId);

    const closeBtnEditor = () => {
      if (this._buttonEditorLiveTimer) {
        clearTimeout(this._buttonEditorLiveTimer);
        this._buttonEditorLiveTimer = null;
      }
      this._cancelLiveApplyRaf();
      editorDiv.querySelectorAll('[data-wl-picker^="btn-"]').forEach((box) => {
        if (box.picker && typeof box.picker.destroy === 'function') {
          try {
            box.picker.destroy();
          } catch (_) {
            /* ignore */
          }
          box.picker = null;
        }
      });
      editorDiv.remove();
    };
    editorDiv.querySelector('.inline-button-editor-close')?.addEventListener('click', closeBtnEditor);

    this._scheduleButtonEditorLiveApply(editorDiv);
  }

  fillConsentStyleEditor(editorDiv, style) {
    const st = style && typeof style === 'object' ? style : {};
    const ff = st['font-family'] || 'Arial, Helvetica, sans-serif';
    const fontEl = editorDiv.querySelector('.edit-consent-style-font-family');
    if (fontEl) {
      let has = Array.from(fontEl.options).some((o) => o.value === ff);
      if (!has) {
        const opt = document.createElement('option');
        opt.value = ff;
        opt.textContent = ff.length > 28 ? `${ff.slice(0, 26)}…` : ff;
        fontEl.appendChild(opt);
      }
      fontEl.value = ff;
    }
    const tc = this.normalizeHexForColorInput(st.color);
    const lc = this.normalizeHexForColorInput(st['link-color'] || st.linkColor);
    const tcIn = editorDiv.querySelector('.edit-consent-style-text-color');
    const lcIn = editorDiv.querySelector('.edit-consent-style-link-color');
    if (tcIn) tcIn.value = tc || '';
    if (lcIn) lcIn.value = lc || '';
    const scaleEl = editorDiv.querySelector('.edit-consent-style-checkbox-scale');
    const scaleRaw = String(st['checkbox-scale'] != null ? st['checkbox-scale'] : '1.3').replace(
      ',',
      '.',
    );
    const scale = parseFloat(scaleRaw);
    if (scaleEl) {
      const n = Number.isFinite(scale) ? Math.min(3, Math.max(0.5, scale)) : 1.3;
      scaleEl.value = String(n);
    }
    const al = st.alignment || 'center';
    const alignEl = editorDiv.querySelector('.edit-consent-style-alignment');
    if (alignEl) {
      alignEl.value = al === 'center' || al === 'right' ? al : 'left';
    }

    this._syncConsentEditorPickerSwatches(editorDiv);
  }

  readConsentStyleFromEditor(editorDiv, prevStyle = {}) {
    const out = { ...(prevStyle && typeof prevStyle === 'object' ? prevStyle : {}) };
    const ff = editorDiv.querySelector('.edit-consent-style-font-family')?.value?.trim();
    out['font-family'] = ff || 'Arial, Helvetica, sans-serif';
    const tc = editorDiv.querySelector('.edit-consent-style-text-color')?.value?.trim();
    const lc = editorDiv.querySelector('.edit-consent-style-link-color')?.value?.trim();
    if (tc) out.color = tc;
    if (lc) out['link-color'] = lc;
    const scRaw = String(editorDiv.querySelector('.edit-consent-style-checkbox-scale')?.value ?? '').replace(
      ',',
      '.',
    );
    const n = parseFloat(scRaw);
    out['checkbox-scale'] =
      Number.isFinite(n) ? String(Math.min(3, Math.max(0.5, n))) : '1.3';
    const al = editorDiv.querySelector('.edit-consent-style-alignment')?.value;
    out.alignment = al === 'center' || al === 'right' ? al : 'left';

    const boxTa = editorDiv.querySelector('.edit-consent-box-inline-style');
    if (boxTa) {
      CONSENT_LEGACY_BOX_STYLE_KEYS.forEach((k) => {
        delete out[k];
      });
      const boxRaw = boxTa.value?.trim() ?? '';
      out['box-style'] = boxRaw ? sanitizeConsentBoxInlineStyle(boxRaw) : '';
    }

    return out;
  }

  /** Input accordion tekrar açılınca consent renk swatch’larını gizli input değerleriyle hizala (kaydedilmemiş düzenlemeyi sıfırlamamak için yalnızca swatch). */
  resyncOpenConsentEditorColors() {
    const idEl = document.querySelector('.inline-input-field-editor .edit-consent-field-id');
    const ed = idEl?.closest('.inline-input-field-editor');
    if (!ed || !document.body.contains(ed)) return;
    this._syncConsentEditorPickerSwatches(ed);
  }

  _findConsentPreviewBox(inputId) {
    const id = inputId != null ? String(inputId) : '';
    if (id) {
      const esc =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(id)
          : id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const el = document.querySelector(
        `#additionalInputFields .consent-box[data-consent-field-id="${esc}"]`,
      );
      if (el) return el;
    }
    const nodes = document.querySelectorAll('#additionalInputFields .consent-box');
    return nodes.length === 1 ? nodes[0] : null;
  }

  /**
   * Tema `style`’da renk / hiza yoksa önizlemeden oku (applyConsentFieldToConsentBox + sarmalayıcı flex).
   */
  _mergeConsentStyleWithPreviewComputed(style, inputId) {
    const out = { ...(style && typeof style === 'object' ? style : {}) };
    const box = this._findConsentPreviewBox(inputId);
    if (!box || typeof window.getComputedStyle !== 'function') return out;
    const label = box.querySelector('label');
    const link = box.querySelector('a');

    const textMissing = out.color == null || String(out.color).trim() === '';
    if (label && textMissing) {
      const hx = this.normalizeHexForColorInput(window.getComputedStyle(label).color);
      if (hx) out.color = hx;
    }

    const linkRaw = out['link-color'] ?? out.linkColor;
    const linkMissing = linkRaw == null || String(linkRaw).trim() === '';
    if (link && linkMissing) {
      const hx = this.normalizeHexForColorInput(window.getComputedStyle(link).color);
      if (hx) out['link-color'] = hx;
    }

    const alignMissing = out.alignment == null || String(out.alignment).trim() === '';
    if (alignMissing) {
      const wrap = box.parentElement;
      if (wrap && wrap.classList.contains('additional-input-field')) {
        const inline = String(wrap.style?.justifyContent || '').trim().toLowerCase();
        const jc = inline || String(window.getComputedStyle(wrap).justifyContent || '').trim().toLowerCase();
        if (jc === 'center' || jc === 'safe center') {
          out.alignment = 'center';
        } else if (jc === 'flex-end' || jc === 'end' || jc.endsWith(' end')) {
          out.alignment = 'right';
        } else {
          out.alignment = 'left';
        }
      }
    }
    return out;
  }

  _syncConsentEditorPickerSwatches(editorDiv) {
    if (!editorDiv) return;
    const pairs = [
      ['.edit-consent-style-text-color', '[data-wl-picker="consent-text"]'],
      ['.edit-consent-style-link-color', '[data-wl-picker="consent-link"]'],
    ];
    for (const [inpSel, boxSel] of pairs) {
      const inp = editorDiv.querySelector(inpSel);
      const box = editorDiv.querySelector(boxSel);
      if (!inp || !box) continue;
      const v = String(inp.value || '').trim();
      if (v) box.style.setProperty('background', v, 'important');
    }
  }

  _bindConsentEditorColorPickers(editorDiv, inputId) {
    if (!editorDiv || inputId == null) return;
    const safeId = String(inputId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const textBox = editorDiv.querySelector('[data-wl-picker="consent-text"]');
    const textIn = editorDiv.querySelector('.edit-consent-style-text-color');
    const linkBox = editorDiv.querySelector('[data-wl-picker="consent-link"]');
    const linkIn = editorDiv.querySelector('.edit-consent-style-link-color');
    if (textBox && textIn) {
      textBox.id = `editConsentTextBox_${safeId}`;
      textIn.id = `editConsentText_${safeId}`;
    }
    if (linkBox && linkIn) {
      linkBox.id = `editConsentLinkBox_${safeId}`;
      linkIn.id = `editConsentLink_${safeId}`;
    }
    const liveFromPicker = () => this._requestImmediateLiveApply(editorDiv);
    setTimeout(() => {
      if (!document.body.contains(editorDiv)) return;
      if (textBox?.id && textIn?.id) {
        setupPicker(
          textBox.id,
          textIn.id,
          textIn.value || '#ffffff',
          null,
          null,
          () => liveFromPicker(),
        );
      }
      if (linkBox?.id && linkIn?.id) {
        setupPicker(
          linkBox.id,
          linkIn.id,
          linkIn.value || '#ffffff',
          null,
          null,
          () => liveFromPicker(),
        );
      }
      this._syncConsentEditorPickerSwatches(editorDiv);
    }, 10);
  }

  editConsentInputField(inputId) {
    this.closeInputFieldEditor();
    const item = document.querySelector(`[data-input-id="${inputId}"]`);
    if (!item) return;

    const fromTheme = Array.isArray(this.theme?.input_fields)
      ? this.theme.input_fields.find((f) => f && f.id === inputId && f.type === 'consent')
      : null;

    let payload = {};
    try {
      payload = JSON.parse(item.getAttribute('data-consent-fields') || '{}');
    } catch (_) {
      payload = {};
    }
    if (fromTheme) {
      if (!String(payload.policy_url ?? '').trim() && String(fromTheme.policy_url || '').trim()) {
        payload.policy_url = fromTheme.policy_url;
      }
      if (payload.text_before == null && fromTheme.text_before != null) {
        payload.text_before = fromTheme.text_before;
      }
      if (
        (payload.link_text == null || String(payload.link_text).trim() === '') &&
        fromTheme.link_text != null
      ) {
        payload.link_text = fromTheme.link_text;
      }
      if (payload.required === undefined) {
        payload.required = fromTheme.required !== false;
      }
      item.setAttribute('data-consent-fields', JSON.stringify(payload));
    }

    const style =
      fromTheme && fromTheme.style && typeof fromTheme.style === 'object'
        ? { ...fromTheme.style }
        : {};

    const editorDiv = document.createElement('div');
    editorDiv.className =
      'inline-input-field-editor card shadow-sm border-0 rounded-3 p-3';
    editorDiv.style.marginTop = '0.5rem';
    editorDiv.innerHTML = `
    <input type="hidden" class="edit-consent-field-id" />
    <div class="d-flex justify-content-between align-items-center pb-2 border-bottom border-secondary" style="margin-bottom:1rem;">
      <div>
        <h6 class="fw-semibold" style="margin-bottom:0;">Consent checkbox</h6>
        <span class="small text-muted">Preview updates as you edit</span>
      </div>
      <button type="button" class="btn-close inline-consent-editor-close" aria-label="Close"></button>
    </div>

    <div class="row g-3">
      <div class="col-12">
        <label class="form-label small fw-semibold" style="margin-bottom:0.5rem;">List label</label>
        <input type="text" class="form-control form-control-sm rounded-2 edit-consent-list-label" maxlength="120" />
      </div>
      <div class="col-12">
        <label class="form-label small fw-semibold" style="margin-bottom:0.5rem;">Content</label>
        <div class="rounded-3 border bg-body-secondary bg-opacity-10 p-3">
          <div class="row g-2">
            <div class="col-12">
              <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Privacy / policy URL</label>
              <input type="text" class="form-control form-control-sm rounded-2 edit-consent-policy-url" placeholder="https://example.com/privacy" autocomplete="off" />
              <div class="invalid-feedback d-none edit-consent-policy-url-feedback" role="alert"></div>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Text before link</label>
              <input type="text" class="form-control form-control-sm rounded-2 edit-consent-text-before" />
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Link label</label>
              <input type="text" class="form-control form-control-sm rounded-2 edit-consent-link-text" />
            </div>
            <div class="col-12">
              <div class="form-check form-switch" style="margin-bottom:0;">
                <input class="form-check-input edit-consent-required" type="checkbox" id="edit-consent-req-${String(inputId).replace(/[^a-zA-Z0-9_-]/g, '_')}" />
                <label class="form-check-label small" for="edit-consent-req-${String(inputId).replace(/[^a-zA-Z0-9_-]/g, '_')}">Required</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12">
        <label class="form-label small fw-semibold" style="margin-bottom:0.5rem;">Design</label>
        <div class="rounded-3 border bg-body-secondary bg-opacity-10 p-3">
          <div class="row g-2 align-items-end">
            <div class="col-12 col-md-4">
              <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Font</label>
              <select class="form-select form-select-sm edit-consent-style-font-family rounded-2">
                <option value="Arial, Helvetica, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value="Trebuchet MS, sans-serif">Trebuchet MS</option>
                <option value="Segoe UI, system-ui, sans-serif">Segoe UI</option>
                <option value="system-ui, sans-serif">System UI</option>
                <option value="inherit">Inherit</option>
              </select>
            </div>
            <div class="col-6 col-md-2">
              <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Checkbox scale</label>
              <input type="number" class="form-control form-control-sm edit-consent-style-checkbox-scale rounded-2" min="0.5" max="3" step="0.1" value="1.3" />
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Alignment</label>
              <select class="form-select form-select-sm edit-consent-style-alignment rounded-2">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Text color</label>
              <div class="d-flex align-items-center gap-1 flex-wrap">
                <div class="flex-shrink-0 promotion-color-swatch-frame">
                  <div class="color-box" data-wl-picker="consent-text" title="Text color" role="button" tabindex="0" aria-label="Text color"></div>
                </div>
                <input type="hidden" class="edit-consent-style-text-color" autocomplete="off" />
              </div>
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label small text-secondary" style="margin-bottom:0.25rem;">Link color</label>
              <div class="d-flex align-items-center gap-1 flex-wrap">
                <div class="flex-shrink-0 promotion-color-swatch-frame">
                  <div class="color-box" data-wl-picker="consent-link" title="Link color" role="button" tabindex="0" aria-label="Link color"></div>
                </div>
                <input type="hidden" class="edit-consent-style-link-color" autocomplete="off" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-12">
        <div class="d-flex flex-wrap justify-content-end align-items-center gap-2 pt-2 border-top" style="margin-top:0.25rem;">
          <button type="button" class="btn btn-outline-secondary btn-sm reset-edit-input-field rounded-2" title="Reset"><i class="bi bi-arrow-counterclockwise"></i></button>
        </div>
      </div>
    </div>
    `;

    const idInput = editorDiv.querySelector('.edit-consent-field-id');
    if (idInput) idInput.value = inputId;

    const listLabel =
      item.querySelector('.custom-input-item-title')?.textContent?.trim() || 'Consent checkbox';
    editorDiv.dataset.initialConsentListLabel = listLabel;
    editorDiv.querySelector('.edit-consent-list-label').value = listLabel;
    editorDiv.querySelector('.edit-consent-policy-url').value = payload.policy_url || '';
    editorDiv.querySelector('.edit-consent-text-before').value =
      payload.text_before != null ? payload.text_before : "I agree and I've read ";
    editorDiv.querySelector('.edit-consent-link-text').value =
      payload.link_text != null ? payload.link_text : 'Terms and Privacy Policy';
    editorDiv.querySelector('.edit-consent-required').checked = payload.required !== false;

    this.clearConsentPolicyUrlValidationUI(editorDiv);
    const policyUrlInput = editorDiv.querySelector('.edit-consent-policy-url');
    if (policyUrlInput) {
      policyUrlInput.addEventListener('input', () => {
        this.clearConsentPolicyUrlValidationUI(editorDiv);
      });
    }

    const initialStyle = JSON.parse(JSON.stringify(style));
    editorDiv.dataset.initialConsentStyle = JSON.stringify(initialStyle);
    editorDiv.dataset.initialConsentPayload = JSON.stringify(payload);

    const displayStyle = this._mergeConsentStyleWithPreviewComputed(initialStyle, inputId);
    this.fillConsentStyleEditor(editorDiv, displayStyle);

    editorDiv.querySelectorAll('input, select, textarea').forEach((el) => applyWlFormControlBoxSizing(el));

    item.insertAdjacentElement('afterend', editorDiv);
    editorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const live = () => this._scheduleConsentEditorLiveApply(editorDiv);
    editorDiv.querySelectorAll('input:not(.btn-check), select, textarea').forEach((el) => {
      el.addEventListener('input', live);
      el.addEventListener('change', live);
    });
    editorDiv.querySelectorAll('.btn-check').forEach((el) => {
      el.addEventListener('change', live);
    });

    this._bindConsentEditorColorPickers(editorDiv, inputId);

    const closeEditor = () => {
      if (this._consentEditorLiveTimer) {
        clearTimeout(this._consentEditorLiveTimer);
        this._consentEditorLiveTimer = null;
      }
      this._cancelLiveApplyRaf();
      editorDiv.querySelectorAll('[data-wl-picker^="consent-"]').forEach((box) => {
        if (box.picker && typeof box.picker.destroy === 'function') {
          try {
            box.picker.destroy();
          } catch (_) {
            /* ignore */
          }
          box.picker = null;
        }
      });
      editorDiv.remove();
    };
    editorDiv.querySelector('.inline-consent-editor-close')?.addEventListener('click', closeEditor);

    this._scheduleConsentEditorLiveApply(editorDiv);
  }

  clearConsentPolicyUrlValidationUI(scope) {
    const root =
      scope && typeof scope.querySelector === 'function' && document.body.contains(scope)
        ? scope
        : document;
    const inp = root.querySelector('.edit-consent-policy-url');
    const fb = root.querySelector('.edit-consent-policy-url-feedback');
    if (inp) {
      inp.classList.remove('is-invalid');
      inp.removeAttribute('aria-invalid');
    }
    if (fb) {
      fb.textContent = '';
      fb.classList.add('d-none');
    }
  }

  focusConsentPolicyUrlError(message) {
    this.openInputAccordionFromPreview();
    const item = document.querySelector(
      '#inputFieldsContainer .custom-input-item[data-input-type="consent"]',
    );
    if (!item) return;
    const id = item.getAttribute('data-input-id');
    if (!id) return;
    this.clearConsentPolicyUrlValidationUI(document);
    this.editConsentInputField(id);
    const showInvalid = () => {
      const editor = document.querySelector('.inline-input-field-editor');
      const inp = editor?.querySelector('.edit-consent-policy-url');
      const fb = editor?.querySelector('.edit-consent-policy-url-feedback');
      if (!inp || !fb) return;
      inp.classList.add('is-invalid');
      inp.setAttribute('aria-invalid', 'true');
      fb.textContent = message || '';
      fb.classList.remove('d-none');
      try {
        inp.focus({ preventScroll: false });
      } catch (_) {
        inp.focus();
      }
      inp.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    requestAnimationFrame(() => requestAnimationFrame(showInvalid));
  }

  /**
   * Kaydetmeden önce consent policy URL; boş/geçersizse null dönmez.
   * Geçerliyse şemasız URL’leri normalize edip DOM + theme’e yazar.
   */
  validateConsentPolicyUrlForSave() {
    const item = document.querySelector(
      '#inputFieldsContainer .custom-input-item[data-input-type="consent"]',
    );
    if (!item) return null;
    let payload = {};
    try {
      payload = JSON.parse(item.getAttribute('data-consent-fields') || '{}');
    } catch (_) {
      payload = {};
    }
    const fid = item.getAttribute('data-input-id');
    const fromTheme =
      Array.isArray(this.theme?.input_fields) && fid
        ? this.theme.input_fields.find((x) => x && x.id === fid && x.type === 'consent')
        : null;
    const raw =
      String(payload.policy_url || '').trim() ||
      String(fromTheme?.policy_url || '').trim();
    if (raw === '') {
      return {
        code: 'consent_policy_url_blank',
        message:
          'Privacy / policy URL cannot be empty when the consent checkbox is enabled.',
      };
    }
    const norm = normalizeConsentPolicyUrlForSave(raw);
    if (!isValidConsentPolicyUrlNormalized(norm)) {
      return {
        code: 'consent_policy_url_invalid',
        message: 'Enter a valid URL (for example https://example.com/privacy).',
      };
    }
    if (norm !== String(payload.policy_url || '').trim()) {
      payload.policy_url = norm;
      item.setAttribute('data-consent-fields', JSON.stringify(payload));
      if (Array.isArray(this.theme?.input_fields)) {
        const f = this.theme.input_fields.find((x) => x && x.id === fid);
        if (f) f.policy_url = norm;
      }
    }
    return null;
  }
  
  /**
   * Serialized tema (DB) degil; aktif sablon + `theme.template` icin templates katalogu.
   * Per-field reset, kayitli degil sablonun orijinal `input_fields` satirina doner.
   */
  _getCatalogTemplateRecord() {
    const tm = this.themeManager;
    if (!tm?.theme) return null;
    const seen = new Set();
    const tryId = (rawId) => {
      if (rawId == null || rawId === '') return null;
      const id =
        typeof rawId === 'number' && Number.isFinite(rawId)
          ? rawId
          : parseInt(String(rawId), 10);
      if (!Number.isFinite(id) || id < 1) return null;
      const key = String(id);
      if (seen.has(key)) return null;
      seen.add(key);
      let rec = getTemplateById(id);
      if (rec && Array.isArray(rec.input_fields) && rec.input_fields.length) return rec;
      rec = getTemplateById(id);
      if (rec && Array.isArray(rec.input_fields) && rec.input_fields.length) return rec;
      return null;
    };
    if (tm.activeTemplateId != null) {
      const r = tryId(tm.activeTemplateId);
      if (r) return r;
    }
    if (tm.theme.template != null) {
      const r = tryId(tm.theme.template);
      if (r) return r;
    }
    return null;
  }

  _getCatalogInputFieldById(inputId) {
    if (!inputId) return null;
    const tpl = this._getCatalogTemplateRecord();
    const list = tpl?.input_fields;
    if (!Array.isArray(list)) return null;
    return list.find((f) => f && f.id === inputId) || null;
  }

  /** Reset: prefer catalog row, else current theme field (IDs may differ from template defaults). */
  _getInputFieldDefForReset(inputId) {
    const fromCatalog = this._getCatalogInputFieldById(inputId);
    if (fromCatalog) return fromCatalog;
    const fields = this.themeManager?.theme?.input_fields;
    if (!Array.isArray(fields) || !inputId) return null;
    return fields.find((f) => f && f.id === inputId) || null;
  }

  closeInputFieldEditor() {
    if (this._buttonEditorLiveTimer) {
      clearTimeout(this._buttonEditorLiveTimer);
      this._buttonEditorLiveTimer = null;
    }
    if (this._consentEditorLiveTimer) {
      clearTimeout(this._consentEditorLiveTimer);
      this._consentEditorLiveTimer = null;
    }
    this._cancelLiveApplyRaf();
    if (this._inlineFieldEditorLiveTimer) {
      clearTimeout(this._inlineFieldEditorLiveTimer);
      this._inlineFieldEditorLiveTimer = null;
    }
    const existingEditor = document.querySelector('.inline-input-field-editor');
    if (existingEditor) {
      existingEditor
        .querySelectorAll(
          '.edit-style-borderColor-box, .edit-style-placeholderColor-box, [data-wl-picker^="btn-"], [data-wl-picker^="consent-"]',
        )
        .forEach((box) => {
          if (box.picker && typeof box.picker.destroy === 'function') {
            try {
              box.picker.destroy();
            } catch (e) {
              /* ignore */
            }
            box.picker = null;
          }
        });
      existingEditor.remove();
    }
  }

  resetInputFieldEditor() {
    const editorElement = document.querySelector('.inline-input-field-editor');
    if (!editorElement) return;

    if (editorElement.querySelector('.edit-button-field-id')) {
      const inputId = editorElement.querySelector('.edit-button-field-id')?.value;
      const item = inputId ? document.querySelector(`[data-input-id="${inputId}"]`) : null;
      if (!item) return;

      const cat = this._getInputFieldDefForReset(inputId);
      const fromCat = cat && (cat.type === 'submit_button' || cat.type === 'button');
      const label =
        fromCat && cat.label != null && String(cat.label).trim() !== ''
          ? String(cat.label).trim()
          : 'Button';
      const text = fromCat
        ? normalizeSubmitButtonTextInput(cat.text != null ? String(cat.text) : '')
        : '';
      const action = fromCat ? cat.action || 'submit_form' : 'submit_form';
      const actionUrl = fromCat && cat.action_url != null ? String(cat.action_url).trim() : '';
      editorElement.querySelector('.edit-button-field-label').value = label;
      editorElement.querySelector('.edit-button-field-text').value = text;
      editorElement.querySelector('.edit-button-field-action').value = action;
      editorElement.querySelector('.edit-button-field-url').value = actionUrl;
      editorElement.querySelector('.edit-button-field-action')?.dispatchEvent(new Event('change'));
      const st =
        fromCat && cat.style && typeof cat.style === 'object'
          ? JSON.parse(JSON.stringify(cat.style))
          : {};
      this.fillButtonStyleEditorInputs(editorElement, st);
      this._bindButtonEditorColorPickers(editorElement, inputId);
      this.applyInputFieldChanges({ closeEditor: false, showToast: false });
      return;
    }

    if (editorElement.querySelector('.edit-consent-field-id')) {
      const inputId = editorElement.querySelector('.edit-consent-field-id')?.value;
      if (!inputId) return;

      const cat = this._getInputFieldDefForReset(inputId);
      const fromCat = cat && cat.type === 'consent';
      const payload = fromCat
        ? {
            policy_url: String(cat.policy_url || '').trim(),
            text_before:
              cat.text_before != null ? String(cat.text_before) : "I agree and I've read ",
            link_text:
              cat.link_text != null && String(cat.link_text).trim() !== ''
                ? String(cat.link_text).trim()
                : 'Terms and Privacy Policy',
            required: cat.required !== false,
          }
        : {
            policy_url: '',
            text_before: '',
            link_text: '',
            required: false,
          };
      const listLab =
        fromCat && cat.label != null && String(cat.label).trim() !== ''
          ? String(cat.label).trim()
          : 'Consent checkbox';
      editorElement.querySelector('.edit-consent-list-label').value = listLab;
      editorElement.querySelector('.edit-consent-policy-url').value = payload.policy_url;
      editorElement.querySelector('.edit-consent-text-before').value = payload.text_before;
      editorElement.querySelector('.edit-consent-link-text').value = payload.link_text;
      editorElement.querySelector('.edit-consent-required').checked = payload.required !== false;
      const st =
        fromCat && cat.style && typeof cat.style === 'object'
          ? JSON.parse(JSON.stringify(cat.style))
          : {};
      this.fillConsentStyleEditor(editorElement, st);
      this._bindConsentEditorColorPickers(editorElement, inputId);
      this.applyInputFieldChanges({ closeEditor: false, showToast: false });
      return;
    }

    const inputIdInline = editorElement.querySelector('.edit-input-field-id')?.value;
    const catInline = inputIdInline ? this._getInputFieldDefForReset(inputIdInline) : null;
    const placeholderInput = editorElement.querySelector('.edit-input-field-placeholder');
    const requiredToggle = editorElement.querySelector('.edit-input-field-required');
    const templateName = editorElement.querySelector('.edit-input-field-name')?.value;
    const showPlaceholder = templateName !== 'rating';
    const fromCat = !!catInline;

    if (placeholderInput) {
      if (showPlaceholder) {
        const ph = fromCat ? String(catInline.placeholder || '').trim() : '';
        placeholderInput.value = ph;
        placeholderInput.setAttribute('data-original-value', ph);
      }
    }
    if (requiredToggle) {
      const defReq = templateName === 'email';
      requiredToggle.checked =
        fromCat && catInline.required !== undefined && catInline.required !== null
          ? !!catInline.required
          : defReq;
      requiredToggle.setAttribute(
        'data-original-value',
        requiredToggle.checked ? 'true' : 'false',
      );
    }
    const st =
      fromCat && catInline.style && typeof catInline.style === 'object'
        ? JSON.parse(JSON.stringify(catInline.style))
        : {};
    this.fillInlineFieldStyleEditor(editorElement, st);

    this.applyInputFieldChanges({ closeEditor: false, showToast: false });
  }

  applyInputFieldChanges({ closeEditor = true, showToast = true } = {}) {
    const editorElement = document.querySelector('.inline-input-field-editor');
    if (!editorElement) return;

    if (editorElement.querySelector('.edit-consent-field-id')) {
      const inputId = editorElement.querySelector('.edit-consent-field-id')?.value;
      if (!inputId) return;
      const item = document.querySelector(`[data-input-id="${inputId}"]`);
      if (!item) return;

      const listLabel =
        editorElement.querySelector('.edit-consent-list-label')?.value?.trim() || 'Consent checkbox';
      const titleEl = item.querySelector('.custom-input-item-title');
      if (titleEl) titleEl.textContent = listLabel;

      const payload = {
        policy_url: editorElement.querySelector('.edit-consent-policy-url')?.value?.trim() || '',
        text_before: editorElement.querySelector('.edit-consent-text-before')?.value ?? '',
        link_text:
          editorElement.querySelector('.edit-consent-link-text')?.value?.trim() ||
          'Terms and Privacy Policy',
        required: editorElement.querySelector('.edit-consent-required')?.checked !== false,
      };
      item.setAttribute('data-consent-fields', JSON.stringify(payload));

      let inputFieldsConsent = this.getInputFieldsData();
      const cidx = inputFieldsConsent.findIndex((f) => f.id === inputId);
      if (cidx !== -1) {
        const prevStyleC = inputFieldsConsent[cidx].style || {};
        const mergedStyleC = this.readConsentStyleFromEditor(editorElement, prevStyleC);
        inputFieldsConsent[cidx] = {
          ...inputFieldsConsent[cidx],
          label: listLabel,
          policy_url: payload.policy_url,
          text_before: payload.text_before,
          link_text: payload.link_text,
          required: payload.required,
          style: mergedStyleC,
        };
      }

      if (this.theme) {
        this.theme.input_fields = inputFieldsConsent;
      }

      this.renderInputFieldsInWidget(inputFieldsConsent);
      this.clearConsentPolicyUrlValidationUI(editorElement);
      if (closeEditor) {
        this.closeInputFieldEditor();
      }
      if (showToast && typeof toastr !== 'undefined') {
        toastr.success('Changes applied successfully.');
      }
      return;
    }

    if (editorElement.querySelector('.edit-button-field-id')) {
      const inputId = editorElement.querySelector('.edit-button-field-id')?.value;
      if (!inputId) return;
      const item = document.querySelector(`[data-input-id="${inputId}"]`);
      if (!item) return;

      const label = editorElement.querySelector('.edit-button-field-label')?.value?.trim() || 'Button';
      const text = normalizeSubmitButtonTextInput(
        editorElement.querySelector('.edit-button-field-text')?.value || '',
      );
      const action = editorElement.querySelector('.edit-button-field-action')?.value || 'submit_form';
      const actionUrl = editorElement.querySelector('.edit-button-field-url')?.value?.trim() || '';

      item.setAttribute('data-field-label', label);
      item.setAttribute('data-button-text', text);
      item.setAttribute('data-button-action', action);
      item.setAttribute('data-button-action-url', actionUrl);

      const titleEl = item.querySelector('.custom-input-item-title');
      if (titleEl) {
        titleEl.textContent = this.formatButtonListTitle(text, label);
      }

      let inputFields = this.getInputFieldsData();
      const idx = inputFields.findIndex((f) => f.id === inputId);
      if (idx !== -1) {
        const prevStyle = inputFields[idx].style || {};
        const mergedStyle = this.readButtonStyleFromEditor(editorElement, prevStyle);
        inputFields[idx] = {
          ...inputFields[idx],
          label,
          text,
          action,
          action_url: actionUrl,
          style: mergedStyle
        };
      }

      if (this.theme) {
        this.theme.input_fields = inputFields;
      }

      this.renderInputFieldsInWidget(inputFields);
      if (closeEditor) {
        this.closeInputFieldEditor();
      }
      if (showToast && typeof toastr !== 'undefined') {
        toastr.success('Changes applied successfully.');
      }
      return;
    }
    
    const inputId = editorElement.querySelector('.edit-input-field-id')?.value;
    const inputName = editorElement.querySelector('.edit-input-field-name')?.value;
    const placeholder = editorElement.querySelector('.edit-input-field-placeholder')?.value.trim();
    const required = editorElement.querySelector('.edit-input-field-required')?.checked;

    if (!inputId) return;

    const item = document.querySelector(`[data-input-id="${inputId}"]`);
    if (!item) return;

    const showPlaceholder = inputName !== 'rating';
    
    if (showPlaceholder) {
      item.setAttribute('data-placeholder', placeholder);
    } else {
      item.setAttribute('data-placeholder', '');
    }
    item.setAttribute('data-required', required);

    const inputFields = this.getInputFieldsData();
    const fieldIndex = inputFields.findIndex(f => f.id === inputId);
    if (fieldIndex !== -1) {
      if (showPlaceholder) {
        inputFields[fieldIndex].placeholder = placeholder;
      } else {
        inputFields[fieldIndex].placeholder = '';
      }
      inputFields[fieldIndex].required = required;

      const prevStyle =
        inputFields[fieldIndex].style && typeof inputFields[fieldIndex].style === 'object'
          ? { ...inputFields[fieldIndex].style }
          : {};
      const mergedStyle = this.readInlineFieldStyleFromEditor(editorElement, prevStyle);
      inputFields[fieldIndex].style = mergedStyle;
    }

    if (this.theme) {
      this.theme.input_fields = inputFields;
    }

    this.renderInputFieldsInWidget(inputFields);
    if (closeEditor) {
      this.closeInputFieldEditor();
    }

    if (showToast && typeof toastr !== 'undefined') {
      toastr.success('Changes applied successfully.');
    }
  }

  saveInputFieldChanges() {
    this.applyInputFieldChanges({ closeEditor: true, showToast: true });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  resetInputFieldsStyles() {
    const resetData = this.themeManager.getResetSource();

    this.theme.input_fields_style = JSON.parse(JSON.stringify(resetData?.input_fields_style || {}));

    this.initCommonInputFieldStylePickers();
    this.renderInputFieldsInWidget(this.getInputFieldsData());
    this.updateStylePreview();
  }
}




