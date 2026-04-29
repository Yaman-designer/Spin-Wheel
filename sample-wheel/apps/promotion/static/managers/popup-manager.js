import { getTemplateById } from '../templates.js';
import {
  applyPopupBackgroundImage,
  containerStyleValue,
  isUnifiedPopupShellTheme,
  mergeBackgroundImage,
} from '../utils/dom-utils.js';
import { getGameTypeName } from '../utils/game-theme-utils.js';
import { updateSize } from '../utils/popup-settings-utils.js';
import { preserveBackgroundColor, preserveBackgroundImage, updateGradientLastColor } from '../utils/color-utils.js';
import { isGradient, getButtonBackground } from '../utils/picker-utils.js';

/** Kupon çubuğu kopya ikonu — Bootstrap Icons (font; ekran/kupon metniyle birlikte ölçeklenir) */
const COUPON_BAR_COPY_ICON_HTML = '<i class="bi bi-copy" aria-hidden="true"></i>';

/** Düzenleyicide canlı geri sayım yok; süre metni valid_time dakikasına göre statik (theme-manager._startCountdown ile aynı biçim). */
function formatCountdownLabelFromMinutes(validMinutes) {
  const totalSeconds = Math.max(0, Math.floor(Number(validMinutes) * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Popup Settings → Reset: DB değil, `theme.template` kataloğu + bu sistem varsayılanları. Konum grid’i her zaman orta merkez. */
const POPUP_SETTINGS_SYS_DEFAULTS = {
  popup_position: 'left',
  popup_position_grid: 'middle_center',
  popup_size: 'medium',
  popup_opening_effect: 'fade_in_scale',
  popup_opening_effect_duration: 700,
};

function templateDefForPopupSettingsReset(theme) {
  const tid = theme?.template;
  if (tid == null || String(tid).trim() === '') return {};
  return getTemplateById(tid) || {};
}

function toPxString(value) {
  const n = typeof value === 'number' ? value : parseInt(String(value).replace(/px$/i, '').trim(), 10);
  return Number.isNaN(n) ? '0px' : `${n}px`;
}

function parsePopupDimensionNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const n = parseInt(String(value).replace(/px$/i, '').trim(), 10);
  return Number.isNaN(n) ? fallback : n;
}

/** DB’deki `theme.containerStyle` ve şablon `containerStyle`; yoksa varsayılan px. */
function resolvePopupContainerDimensions(theme) {
  const cs = theme?.containerStyle;
  const cw = containerStyleValue(cs, 'width');
  const ch =
    containerStyleValue(cs, 'height') || containerStyleValue(cs, 'max-height');
  if (parsePopupDimensionNumber(cw, 0) > 0 && parsePopupDimensionNumber(ch, 0) > 0) {
    return {
      w: parsePopupDimensionNumber(cw, 480),
      h: parsePopupDimensionNumber(ch, 450),
    };
  }
  const ps = theme?.popup_settings;
  const pw = ps?.popup_width;
  const ph = ps?.popup_height;
  if (parsePopupDimensionNumber(pw, 0) > 0 && parsePopupDimensionNumber(ph, 0) > 0) {
    return {
      w: parsePopupDimensionNumber(pw, 480),
      h: parsePopupDimensionNumber(ph, 450),
    };
  }
  const tid = theme?.template;
  const template =
    (tid && getTemplateById(tid)) || getTemplateById(101);
  const tw = containerStyleValue(template?.containerStyle, 'width');
  const th =
    containerStyleValue(template?.containerStyle, 'height') ||
    containerStyleValue(template?.containerStyle, 'max-height');
  return {
    w: parsePopupDimensionNumber(tw, 480),
    h: parsePopupDimensionNumber(th, 450),
  };
}

export class PopupManager {
  constructor(themeManager) {
    this.themeManager = themeManager;
    this._popupSizeHandler = null;
    this._popupWidthHandler = null;
    this._popupHeightHandler = null;
    this._popupClickHandler = null;
    this._countdownPhonePreviewTimer = null;
    this._countdownCopyFeedbackTimer = null;
    this._countdownPhonePreviewOverlay = null;
    this._onCountdownCollapseShown = null;
    this._onCountdownCollapseHidden = null;
  }

  get theme() {
    return this.themeManager.theme;
  }

  set theme(value) {
    this.themeManager.theme = value;
  }

  updateCirclePinVisibility() {
    const unifiedShell =
      this.theme?.popup_type === 'gaming' ||
      this.theme?.popup_type == null ||
      this.theme?.popup_type === '';
    let shouldShowGameColors = true;
    if (unifiedShell) {
      const gameTypeSelect = document.getElementById('gameTypeSelect');
      const hasGameSelected = gameTypeSelect && gameTypeSelect.value && gameTypeSelect.value.trim() !== '';
      const hasGameInTheme = Boolean(getGameTypeName(this.theme));
      shouldShowGameColors = hasGameSelected || hasGameInTheme;
    }
    const sliceColorsSection = document.getElementById('slice-colors-section');
    if (sliceColorsSection) {
      sliceColorsSection.style.display = shouldShowGameColors ? '' : 'none';
    }
    const circlePinRows = document.querySelectorAll('.game-popup-hide');
    const gameTypeSelectForPin = document.getElementById('gameTypeSelect');
    const gameTypeForPin = gameTypeSelectForPin?.value || getGameTypeName(this.theme) || '';
    const normalizedGameTypeForPin = gameTypeForPin.toLowerCase().trim();
    const shouldShowPin = normalizedGameTypeForPin !== '' && normalizedGameTypeForPin !== 'scratchcard';
    circlePinRows.forEach(row => {
      const isPinRow = row.querySelector('#pin_bg_color_box');
      if (isPinRow) {
        row.style.display = (shouldShowGameColors && shouldShowPin) ? '' : 'none';
      } else {
        row.style.display = shouldShowGameColors ? '' : 'none';
      }
    });
  }

  applyPopupPosition(position) {
    const wheelPopup = document.getElementById("wheelluckContainer");

    wheelPopup.classList.remove("popup-position-left", "popup-position-right");
    wheelPopup.classList.add(position === "right" ? "popup-position-right" : "popup-position-left");

    this.theme.popup_settings.popup_position = position;
  }

  /**
   * #wheelluckContainer gerçek boyutunu Popup Settings (genişlik / yükseklik) alanlarına ve temaya yazar.
   * Görsel konumu (sol-sağ) ile değişen önizleme boyutunu forma yansıtmak için kullanılır.
   */
  syncPopupSizeInputsFromDom() {
    const el = document.getElementById('wheelluckContainer');
    const widthInput = document.getElementById('popup_width');
    const heightInput = document.getElementById('popup_height');
    if (!el || !widthInput || !heightInput) return;

    const w = Math.round(el.offsetWidth);
    const h = Math.round(el.offsetHeight);
    if (w <= 0 || h <= 0) return;

    widthInput.value = String(w);
    heightInput.value = String(h);

    const width = toPxString(w);
    const height = toPxString(h);

    if (!this.theme.popup_settings) this.theme.popup_settings = {};
    this.theme.popup_settings.popup_width = width;
    this.theme.popup_settings.popup_height = height;

    if (this.theme.width !== undefined) this.theme.width = width;
    if (this.theme.height !== undefined) this.theme.height = height;
  }

  syncPresetPopupSize(size) {
    const SCALE_MAP = { small: 0.85, medium: 1, large: 1.15 };
    const wheelPopup = document.getElementById("wheelluckContainer");
    if (!wheelPopup) return;

    wheelPopup.classList.remove('popup-size-small', 'popup-size-medium', 'popup-size-large');
    wheelPopup.classList.add(`popup-size-${size}`);

    const scale = SCALE_MAP[size] || 1;
    wheelPopup.dataset.promotionPresetScale = String(scale);
    this.theme.popup_settings.popup_size = size;
    this.themeManager?.scheduleDesktopPreviewFit?.();
  }

  applyLightPopupGridPosition(gridPosition) {
    const wheelPopup = document.getElementById("wheelluckContainer");

    const normalizedPosition = gridPosition.replace(/-/g, '_');
    const positionClass = `popup-grid-${normalizedPosition}`;

    wheelPopup.classList.remove('d-flex', 'align-items-center', 'justify-content-center');
    const gridPositionClasses = [
      'popup-grid-top_left', 'popup-grid-top_center', 'popup-grid-top_right',
      'popup-grid-middle_left', 'popup-grid-middle_center', 'popup-grid-middle_right',
      'popup-grid-bottom_left', 'popup-grid-bottom_center', 'popup-grid-bottom_right',
      'popup-position-left', 'popup-position-right'
    ];
    wheelPopup.classList.remove(...gridPositionClasses);
    wheelPopup.classList.add(positionClass);

    this.theme.popup_settings.popup_position_grid = gridPosition;
  }

  initPopupSettings(resetForNewTemplate = false) {
    this.theme.popup_settings = this.theme.popup_settings || {};
    if (resetForNewTemplate) {
      Object.assign(this.theme.popup_settings, {
        popup_position: 'left',
        popup_position_grid: 'middle_center',
        popup_size: 'medium',
        popup_width: '',
        popup_height: '',
      });
    }

    const popupSettings = this.theme.popup_settings;

    const widthInput = document.getElementById('popup_width');
    const heightInput = document.getElementById('popup_height');

    if (!widthInput || !heightInput) {
      const savedGridPosition =
        this.theme.popup_settings.popup_position_grid ||
        this.theme.options?.popup_position_grid ||
        'middle_center';
      this.applyLightPopupGridPosition(savedGridPosition);

      const { w: baseW, h: baseH } = resolvePopupContainerDimensions(this.theme);
      const wPx = toPxString(baseW);
      const hPx = toPxString(baseH);
      if (document.getElementById('wheelluckContainer')) {
        updateSize('wheelluckContainer', wPx, hPx);
      }
      this.theme.popup_settings.popup_width = wPx;
      this.theme.popup_settings.popup_height = hPx;

      const resetBtn = document.getElementById('resetPopupSettingsBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => this.resetPopupSettings());
      }

      this.setupCountdownPhonePreview();
      return;
    }

    widthInput.removeEventListener('input', this._popupWidthHandler);
    heightInput.removeEventListener('input', this._popupHeightHandler);

    this._popupWidthHandler = (e) => {
      const rawW = e.target.value;
      const rawH = heightInput.value;

      if (rawW === '' || rawH === '') return;

      const w = parseInt(rawW, 10);
      const h = parseInt(rawH, 10);

      if (Number.isNaN(w) || w <= 0 || Number.isNaN(h) || h <= 0) return;

      const width = toPxString(w);
      const height = toPxString(h);

      updateSize('wheelluckContainer', width, height);

      this.theme.popup_settings.popup_width = width;
      this.theme.popup_settings.popup_height = height;
      this.themeManager?.scheduleDesktopPreviewFit?.();
    };

    this._popupHeightHandler = (e) => {
      const rawW = widthInput.value;
      const rawH = e.target.value;

      if (rawW === '' || rawH === '') return;

      const w = parseInt(rawW, 10);
      const h = parseInt(rawH, 10);

      if (Number.isNaN(w) || w <= 0 || Number.isNaN(h) || h <= 0) return;

      const width = toPxString(w);
      const height = toPxString(h);

      updateSize('wheelluckContainer', width, height);

      this.theme.popup_settings.popup_width = width;
      this.theme.popup_settings.popup_height = height;
      this.themeManager?.scheduleDesktopPreviewFit?.();
    };

    widthInput.addEventListener('input', this._popupWidthHandler);
    heightInput.addEventListener('input', this._popupHeightHandler);
    

    const sizeRadios = document.querySelectorAll('input[name="popup_size"]');
    sizeRadios.forEach((radio) => {
      radio.removeEventListener('change', this._popupSizeHandler);
      radio.disabled = false;
    });

    this._popupSizeHandler = (e) => {
      this.syncPresetPopupSize(e.target.value);
    };

    sizeRadios.forEach((radio) => {
      radio.addEventListener('change', this._popupSizeHandler);
    });

    const preset = popupSettings.popup_size || 'medium';
    const presetRadio =
      document.querySelector(`input[name="popup_size"][value="${preset}"]`) ||
      document.querySelector('input[name="popup_size"][value="medium"]');
    presetRadio.checked = true;

    const { w: baseW, h: baseH } = resolvePopupContainerDimensions(this.theme);
    widthInput.value = String(baseW);
    heightInput.value = String(baseH);
    const wPx = toPxString(baseW);
    const hPx = toPxString(baseH);
    updateSize('wheelluckContainer', wPx, hPx);
    this.theme.popup_settings.popup_width = wPx;
    this.theme.popup_settings.popup_height = hPx;

    this.syncPresetPopupSize(preset);

    const positionGridRadios = document.querySelectorAll('input[name="popup_position_grid"]');
    positionGridRadios.forEach(radio => {
      radio.disabled = false;
    });

    const currentPosition =
      this.theme.popup_settings.popup_position || this.theme.options?.popup_position || 'left';
    const positionRadio = document.querySelector(`input[name="popup_position"][value="${currentPosition}"]`);
    if (positionRadio) {
      positionRadio.checked = true;
    }
    this.updatePopupPositionGrid(currentPosition);

    const savedGridPosition =
      this.theme.popup_settings.popup_position_grid ||
      this.theme.options?.popup_position_grid ||
      'middle_center';
    this.applyLightPopupGridPosition(savedGridPosition);

    const gridPositionRadio = document.querySelector(
      `input[name="popup_position_grid"][value="${savedGridPosition}"]`
    );
    if (gridPositionRadio) {
      gridPositionRadio.checked = true;
    } else {
      const middleCenterRadio = document.querySelector(
        'input[name="popup_position_grid"][value="middle_center"]'
      );
      if (middleCenterRadio) middleCenterRadio.checked = true;
    }

    const resetBtn = document.getElementById('resetPopupSettingsBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetPopupSettings());
    }

    this.setupCountdownPhonePreview();
  }

  /**
   * Countdown accordion açılınca sol önizlemede kupon + geri sayım çubuğu (canlı önizleme);
   * oyun alanı görünür kalır, çubuk üstte bindirilir.
   */
  setupCountdownPhonePreview() {
    const collapse = document.getElementById('collapseCountdown');
    if (!collapse || collapse.dataset.countdownPhonePreviewBound === '1') return;
    collapse.dataset.countdownPhonePreviewBound = '1';

    this._onCountdownCollapseShown = () => this._mountCountdownPhonePreview();
    this._onCountdownCollapseHidden = () => this._teardownCountdownPhonePreview(false);

    collapse.addEventListener('shown.bs.collapse', this._onCountdownCollapseShown);
    collapse.addEventListener('hidden.bs.collapse', this._onCountdownCollapseHidden);
  }

  /**
   * Countdown accordion açıkken "Display countdown reminder" veya süre değişince sol önizleme kupon barını günceller.
   */
  refreshCountdownPhonePreviewIfMounted() {
    if (!this._countdownPhonePreviewOverlay) return;
    this._mountCountdownPhonePreview();
  }

  _clearCountdownPhonePreviewTimer() {
    if (this._countdownPhonePreviewTimer) {
      window.clearInterval(this._countdownPhonePreviewTimer);
      this._countdownPhonePreviewTimer = null;
    }
  }

  _teardownCountdownPhonePreview(collapseAccordion = false) {
    this._clearCountdownPhonePreviewTimer();
    if (this._countdownCopyFeedbackTimer) {
      window.clearTimeout(this._countdownCopyFeedbackTimer);
      this._countdownCopyFeedbackTimer = null;
    }

    const popupContainer = document.getElementById('popupContainer');
    if (popupContainer) {
      popupContainer.classList.remove('promotion-countdown-phone-preview');
    }

    if (this._countdownPhonePreviewOverlay?.parentNode) {
      this._countdownPhonePreviewOverlay.parentNode.removeChild(this._countdownPhonePreviewOverlay);
    }
    this._countdownPhonePreviewOverlay = null;

    if (collapseAccordion) {
      const el = document.getElementById('collapseCountdown');
      const inst = typeof bootstrap !== 'undefined' && bootstrap?.Collapse?.getInstance?.(el);
      if (inst) {
        inst.hide();
      }
    }
  }

  _mountCountdownPhonePreview() {
    this._teardownCountdownPhonePreview(false);

    const popupContainer = document.getElementById('popupContainer');
    const sourcePanel = document.getElementById('promotionCouponBarCapturePanel');
    const shell = document.getElementById('wheelluckContainer');
    if (!popupContainer || !sourcePanel || !shell) return;

    popupContainer.classList.add('promotion-countdown-phone-preview');

    const overlay = document.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.classList.add('promotion-phone-coupon-overlay');

    const panel = sourcePanel.cloneNode(true);
    panel.removeAttribute('id');
    panel.removeAttribute('hidden');
    panel.classList.remove('promotion-coupon-bar-capture-source');
    panel.classList.add('promotion-phone-coupon-clone');

    const bgInput = document.getElementById('countdown_bg_color');
    const textInput = document.getElementById('countdown_text_color');
    const bg =
      bgInput?.value?.trim() || this.theme?.countdown?.colors?.background || '';
    const fg = textInput?.value?.trim() || this.theme?.countdown?.colors?.text || '';
    if (bg) panel.style.backgroundColor = bg;
    if (fg) {
      panel.style.color = fg;
      panel.querySelectorAll('.close-btn').forEach((b) => {
        b.style.color = fg;
      });
    }

    const couponEl = panel.querySelector('.coupon-code');
    if (couponEl) {
      const copyBtn = couponEl.querySelector('.copy-btn');
      couponEl.replaceChildren();
      const codeText = document.createElement('span');
      codeText.className = 'coupon-code-text';
      codeText.textContent = 'SAVE20';
      codeText.style.minWidth = '0';
      codeText.style.overflow = 'hidden';
      codeText.style.textOverflow = 'ellipsis';
      codeText.style.whiteSpace = 'nowrap';
      couponEl.appendChild(codeText);
      if (copyBtn) {
        couponEl.appendChild(copyBtn);
      } else {
        const span = document.createElement('span');
        span.className = 'copy-btn';
        span.setAttribute('aria-label', 'Copy code');
        span.title = 'Copy code';
        span.innerHTML = COUPON_BAR_COPY_ICON_HTML;
        couponEl.appendChild(span);
      }
    }

    const countdownActive = document.querySelector('input[name="display_countdown_reminder"]')?.checked;
    const validTimeInput = document.querySelector('input[name="valid_time"]');
    let validMinutes = Number(validTimeInput?.value);
    if (!Number.isFinite(validMinutes) || validMinutes <= 0) {
      validMinutes = Number(this.theme?.countdown?.valid_time) || 15;
    }

    const countdownSpan = panel.querySelector('.countdown');
    if (countdownSpan) {
      if (!countdownActive) {
        countdownSpan.style.display = 'none';
      } else {
        countdownSpan.style.display = '';
        countdownSpan.textContent = formatCountdownLabelFromMinutes(validMinutes);
      }
    }

    const closeBtn = panel.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._teardownCountdownPhonePreview(true);
      });
    }

    const copyBtnEl = panel.querySelector('.coupon-code .copy-btn');
    if (copyBtnEl && couponEl) {
      copyBtnEl.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fromSpan = couponEl.querySelector('.coupon-code-text')?.textContent?.trim();
        let code = fromSpan || '';
        if (!code) {
          for (const node of couponEl.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) code += node.textContent;
          }
          code = code.trim();
        }
        code = code || 'SAVE20';
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          /* ignore */
        }
        // Inline geri bildirim: CSS'e bağımlı değil.
        copyBtnEl.style.opacity = '0.65';
        window.clearTimeout(this._countdownCopyFeedbackTimer);
        this._countdownCopyFeedbackTimer = window.setTimeout(() => {
          copyBtnEl.style.opacity = '';
          this._countdownCopyFeedbackTimer = null;
        }, 1200);
      });
    }

    overlay.appendChild(panel);
    popupContainer.appendChild(overlay);
    this._countdownPhonePreviewOverlay = overlay;

    panel.style.bottom = '-72px';
    panel.style.opacity = '0.96';
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        panel.classList.add('show');
        panel.style.bottom = '';
        panel.style.opacity = '';
        this.themeManager?.scheduleDesktopPreviewFit?.();
      });
    });
  }

  setupPopupClickHandler() {
    const wheelPopup = document.getElementById("wheelluckContainer");

    wheelPopup.removeEventListener('click', this._popupClickHandler);

    this._popupClickHandler = (e) => {
      if (e.target.closest(
        'button, a, input, select, textarea, label, [role="button"], .submit-button-widget'
      )) {
        return;
      }

      const collapseEl = document.getElementById('collapsePopupSettings');
      if (!collapseEl) return;

      this.closeAllAccordionsExcept('collapsePopupSettings');

      const isClosed =
        collapseEl.classList.contains('collapse') && !collapseEl.classList.contains('show');
      if (!isClosed) return;

      if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
        bootstrap.Collapse.getOrCreateInstance(collapseEl).show();
      } else {
        collapseEl.classList.add('show');
        const btn = document.querySelector('[data-bs-target="#collapsePopupSettings"]');
        btn?.classList.remove('collapsed');
        btn?.setAttribute('aria-expanded', 'true');
      }
    };

    wheelPopup.addEventListener('click', this._popupClickHandler);

    const accordionIds = [
      'collapsePopupSettings',
      'collapseText',
      'collapseInput',
      'collapseImage',
      'collapseSchedule',
      'collapseThree',
      'collapseOne',
      'collapseGameType',
      'collapseCountdown',
    ];

    accordionIds.forEach((accordionId) => {
      const el = document.getElementById(accordionId);
      el?.addEventListener('show.bs.collapse', () => {
        this.closeAllAccordionsExcept(accordionId);
      });
      el?.addEventListener('shown.bs.collapse', () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.scrollPopupToTop(accordionId);
            if (accordionId === 'collapseInput') {
              this.themeManager?.inputFieldsManager?.resyncOpenConsentEditorColors?.();
            }
          });
        });
      });
    });

    setTimeout(() => {
      const openId = accordionIds.find((id) =>
        document.getElementById(id)?.classList.contains('show')
      );
      if (openId) this.scrollPopupToTop(openId);
    }, 500);
  }
  
  scrollPopupToTop(accordionId = null) {
    /* Sağ kolon accordion’u sabit yükseklik + overflow:auto; kaydırma window değil bu konteynerde olmalı. */
    const accordionContainer = document.querySelector('.accordion.accordionContainer');
    if (!accordionContainer) return;

    const ids = [
      'collapsePopupSettings',
      'collapseText',
      'collapseInput',
      'collapseImage',
      'collapseSchedule',
      'collapseThree',
      'collapseOne',
      'collapseGameType',
      'collapseCountdown',
    ];
    const isOpen = (el) => el?.classList.contains('show');

    let target = accordionId ? document.getElementById(accordionId) : null;
    if (!isOpen(target)) {
      target = ids.map((id) => document.getElementById(id)).find(isOpen);
    }

    let scrollTargetEl = null;
    if (target && isOpen(target)) {
      const item = target.closest('.accordion-item');
      scrollTargetEl =
        item?.querySelector(':scope > .accordion-header .accordion-button') ||
        document.querySelector(`[data-bs-target="#${target.id}"]`) ||
        target;
    }

    if (!scrollTargetEl) return;

    const tRect = scrollTargetEl.getBoundingClientRect();
    if (tRect.height === 0) return;

    const cRect = accordionContainer.getBoundingClientRect();

    /* Pop-up Settings zaten accordion görünür alanındaysa tekrar kaydırma. */
    if (
      accordionId === 'collapsePopupSettings' &&
      tRect.bottom > cRect.top + 24 &&
      tRect.top < cRect.bottom - 24
    ) {
      return;
    }

    const pad = 8;
    const delta = tRect.top - cRect.top - pad;
    if (Math.abs(delta) < 4) return;

    const maxTop = Math.max(
      0,
      accordionContainer.scrollHeight - accordionContainer.clientHeight,
    );
    const nextTop = Math.max(
      0,
      Math.min(accordionContainer.scrollTop + delta, maxTop),
    );
    const scrollBehavior =
      accordionId === 'collapsePopupSettings' || accordionId === 'collapseInput'
        ? 'auto'
        : 'smooth';
    try {
      accordionContainer.scrollTo({ top: nextTop, behavior: scrollBehavior });
    } catch (_) {
      accordionContainer.scrollTop = nextTop;
    }
  }
  
  closeAllAccordionsExcept(exceptId) {
    const accordionIds = [
      'collapsePopupSettings',
      'collapseText',
      'collapseInput',
      'collapseImage',
      'collapseSchedule',
      'collapseThree',
      'collapseOne',
      'collapseGameType',
      'collapseCountdown',
    ];
    const hasBootstrap = typeof bootstrap !== 'undefined' && bootstrap.Collapse;

    accordionIds.forEach((accordionId) => {
      if (accordionId === exceptId) return;
      const el = document.getElementById(accordionId);
      if (!el?.classList.contains('show')) return;

      const instance = hasBootstrap && bootstrap.Collapse.getInstance(el);
      if (instance) {
        instance.hide();
        return;
      }

      el.classList.remove('show');
      const btn = document.querySelector(`[data-bs-target="#${accordionId}"]`);
      btn?.classList.add('collapsed');
      btn?.setAttribute('aria-expanded', 'false');
    });
  }


  updatePopupPositionGrid(position, savedGridPosition = null) {
    const positionGridRadios = document.querySelectorAll('input[name="popup_position_grid"]');
    const popupType = this.theme.popup_type;
    const unifiedShell = popupType === 'gaming';

    positionGridRadios.forEach((radio) => {
      radio.checked = false;
    });

    positionGridRadios.forEach((radio) => {
      const gridPosition = radio.getAttribute('data-position');
      const isCenter = gridPosition === 'center';
      radio.disabled = unifiedShell
        ? false
        : isCenter
          ? true
          : gridPosition !== position;
    });

    if (unifiedShell) {
      const targetPosition =
        savedGridPosition ||
        this.theme.popup_settings?.popup_position_grid ||
        this.theme.options?.popup_position_grid ||
        'middle_center';
      const targetRadio = Array.from(positionGridRadios).find(
        (radio) =>
          (radio.getAttribute('data-grid-position') === targetPosition ||
            radio.value === targetPosition) &&
          !radio.disabled
      );
      if (targetRadio) {
        targetRadio.checked = true;
        this.applyLightPopupGridPosition(targetPosition);
      }
    } else {
      const first = Array.from(positionGridRadios).find(
        (radio) =>
          radio.getAttribute('data-position') === position && !radio.disabled
      );
      if (first) {
        first.checked = true;
        first.classList.add('group-selected');
      }
    }
  }

  applyPopupModeFromTheme() {
    const popupType = this.theme.popup_type || 'gaming';
    const wheelPopup = document.querySelector('#wheelluckContainer');

    if (wheelPopup) {
      wheelPopup.classList.forEach(cls => {
        if (cls.endsWith('-popup-mode')) wheelPopup.classList.remove(cls);
      });
      wheelPopup.classList.add(`${popupType}-popup-mode`);
    }
  }


  showchanceColorsWarning() {
    const colorInputs = document.querySelectorAll('input[type="hidden"][name*="_color"]');

    this.updateCirclePinVisibility();

    colorInputs.forEach((input) => {
      input.disabled = false;
      const colorBox = document.getElementById(input.id.replace('_color', '_color_box'));
      if (!colorBox) return;

      colorBox.style.opacity = '1';
      if (colorBox.getAttribute('data-bs-toggle') !== 'tooltip') return;

      global.bootstrap?.Tooltip?.getInstance?.(colorBox)?.dispose?.();
      colorBox.removeAttribute('data-bs-toggle');
      colorBox.removeAttribute('data-bs-placement');
      colorBox.removeAttribute('data-bs-title');
    });
  }

  changeContainerBackgroundColor(value) {
    const popupMain = document.getElementById("wheelluckContainer");
    if (!popupMain) return;

    const containerBgInput = document.querySelector('input[name="container_bg_color"]');
    const currentBg =
      containerBgInput?.value ||
      containerStyleValue(this.theme?.containerStyle, 'background') ||
      popupMain.style.background ||
      '';

    if (value && (value.includes('linear-gradient') || value.includes('radial-gradient'))) {
      popupMain.style.setProperty('background', value, 'important');
      if (containerBgInput) {
        containerBgInput.value = value;
      }
      this._updateContainerBgInTheme(value);
      return;
    }

    if (currentBg && (currentBg.includes('linear-gradient') || currentBg.includes('radial-gradient'))) {
      const updatedGradient = updateGradientLastColor(currentBg, value);

      if (containerBgInput) {
        containerBgInput.value = updatedGradient;
      }

      this._updateContainerBgInTheme(updatedGradient);

      popupMain.style.setProperty('background', updatedGradient, 'important');
    } else {
      const colorProperty = (value && (value.includes('linear-gradient') || value.includes('radial-gradient') || value.includes('url(')))
        ? 'background'
        : 'backgroundColor';
      preserveBackgroundImage(popupMain, value, colorProperty);

      this._updateContainerBgInTheme(value);
    }
  }

  _updateContainerBgInTheme(value) {
    const theme = this.theme;
    if (theme) {
      if (!theme.containerStyle) theme.containerStyle = {};
      theme.containerStyle.background = value;
      delete theme.containerStyle['background-color'];
    }
  }

  changeButtonBackgroundColor(value) {
    const raw = value != null ? String(value).trim() : '';
    if (!raw) {
      return;
    }

    const theme = this.theme;
    const unifiedShell = theme?.popup_type === 'gaming';
    const hasGradient = isGradient(value);

    if (theme && Array.isArray(theme.input_fields)) {
      const idx = theme.input_fields.findIndex(
        (f) =>
          f &&
          (f.type === 'submit_button' || f.type === 'button') &&
          f.action === 'submit_form'
      );
      if (idx !== -1) {
        const f = theme.input_fields[idx];
        if (!f.style) f.style = {};
        if (hasGradient) {
          f.style.background = value;
          f.style['background-image'] = value;
          delete f.style['background-color'];
        } else {
          f.style.background = value;
          delete f.style['background-color'];
          delete f.style['background-image'];
        }
      }
    }

    if (this.themeManager && typeof this.themeManager.renderInputFieldsInWidget === 'function') {
      this.themeManager.renderInputFieldsInWidget(this.theme.input_fields || []);
      return;
    }

    const buttons = document.querySelectorAll('#additionalInputFields .submit-button-widget, #submit_button');
    buttons.forEach((button) => {
      if (hasGradient) {
        button.style.setProperty('background', value, 'important');
      } else if (unifiedShell) {
        button.style.setProperty('background', value, 'important');
      } else {
        button.style.setProperty('background', value, 'important');
      }
    });
  }

  resetPopupSettings() {
    const tpl = templateDefForPopupSettingsReset(this.theme);
    const tplPs =
      tpl.popup_settings && typeof tpl.popup_settings === 'object' ? { ...tpl.popup_settings } : {};
    const popupSettings = {
      ...POPUP_SETTINGS_SYS_DEFAULTS,
      ...tplPs,
      popup_position_grid: 'middle_center',
    };

    const containerBg = containerStyleValue(tpl.containerStyle, 'background') || '';
    if (!this.theme.containerStyle) this.theme.containerStyle = {};
    if (containerBg) {
      this.theme.containerStyle.background = containerBg;
      delete this.theme.containerStyle['background-color'];
      this.changeContainerBackgroundColor(containerBg);
      this.themeManager.colorManager.updateColorInputAndBox('container_bg_color', containerBg);
    }

    const resetSubmit =
      (Array.isArray(tpl.input_fields) &&
        tpl.input_fields.find(
          (f) =>
            f &&
            (f.type === 'submit_button' || f.type === 'button') &&
            f.action === 'submit_form'
        )?.style) ||
      {};
    const buttonBg = getButtonBackground(resetSubmit);
    if (buttonBg) {
      this.changeButtonBackgroundColor(buttonBg);
    }

    const defaultSize = popupSettings.popup_size || 'medium';
    const sizeRadio = document.querySelector(`input[name="popup_size"][value="${defaultSize}"]`);
    if (sizeRadio) {
      sizeRadio.checked = true;
      this.syncPresetPopupSize(defaultSize);
    }

    const widthInput = document.getElementById('popup_width');
    const heightInput = document.getElementById('popup_height');
    let rw = parsePopupDimensionNumber(popupSettings.popup_width, 0);
    let rh = parsePopupDimensionNumber(popupSettings.popup_height, 0);
    if (rw <= 0 || rh <= 0) {
      rw = parsePopupDimensionNumber(containerStyleValue(tpl.containerStyle, 'width'), 480);
      rh = parsePopupDimensionNumber(containerStyleValue(tpl.containerStyle, 'height'), 450);
    }
    if (widthInput && heightInput) {
      widthInput.value = String(rw);
      heightInput.value = String(rh);
    }
    const widthPx = toPxString(rw);
    const heightPx = toPxString(rh);
    updateSize('wheelluckContainer', widthPx, heightPx);

    const wheelPopup = document.getElementById('wheelluckContainer');
    const tplCs = tpl.containerStyle;
    const tplMaxH = containerStyleValue(tplCs, 'max-height');
    if (wheelPopup && tplMaxH !== undefined && tplMaxH !== null && tplMaxH !== '') {
      const m = tplMaxH;
      const mh = typeof m === 'number' ? `${m}px` : String(m);
      wheelPopup.style.setProperty('max-height', mh, 'important');
    } else if (wheelPopup) {
      wheelPopup.style.removeProperty('max-height');
    }

    const defaultPosition = popupSettings.popup_position || 'left';
    const defaultGrid = popupSettings.popup_position_grid;
    this.updatePopupPositionGrid(defaultPosition, defaultGrid);
    const gridRadio = document.getElementById(`popup_position_grid_${defaultGrid}`);
    if (gridRadio) gridRadio.checked = true;
    const posRadio = document.getElementById(`popup_position_${defaultPosition}`);
    if (posRadio) posRadio.checked = true;

    if (!this.theme.popup_settings) this.theme.popup_settings = {};
    this.theme.popup_settings.popup_position = defaultPosition;
    this.theme.popup_settings.popup_position_grid = defaultGrid;
    this.theme.popup_settings.popup_size = defaultSize;
    this.theme.popup_settings.popup_width = widthPx;
    this.theme.popup_settings.popup_height = heightPx;
    this.theme.popup_settings.popup_opening_effect =
      popupSettings.popup_opening_effect || POPUP_SETTINGS_SYS_DEFAULTS.popup_opening_effect;
    const durParsed = parseInt(String(popupSettings.popup_opening_effect_duration ?? ''), 10);
    this.theme.popup_settings.popup_opening_effect_duration = Number.isNaN(durParsed)
      ? POPUP_SETTINGS_SYS_DEFAULTS.popup_opening_effect_duration
      : durParsed;

    const openingEffectSelect = document.getElementById('popup_opening_effect');
    if (openingEffectSelect && !openingEffectSelect.disabled) {
      openingEffectSelect.value = this.theme.popup_settings.popup_opening_effect;
    }
    const openingEffectDuration = document.getElementById('popup_opening_effect_duration');
    if (openingEffectDuration && !openingEffectDuration.disabled) {
      openingEffectDuration.value = String(this.theme.popup_settings.popup_opening_effect_duration);
    }

    if (!this.theme.containerStyle) this.theme.containerStyle = {};
    this.theme.containerStyle.width = widthPx;
    this.theme.containerStyle.height = heightPx;
    if (tplMaxH !== undefined && tplMaxH !== null && tplMaxH !== '') {
      const m = tplMaxH;
      this.theme.containerStyle['max-height'] = typeof m === 'number' ? `${m}px` : String(m);
    } else if (this.theme.containerStyle['max-height'] !== undefined) {
      delete this.theme.containerStyle['max-height'];
    }

    this.themeManager.initPickers(this.theme);

    const im = window.wheelApp?.imageManager;
    if (im && isUnifiedPopupShellTheme(this.theme)) {
      const resetBg = tpl.background_image;
      const pathFromTpl = String(resetBg?.path ?? '').trim();
      const styleFromTpl = String(resetBg?.style ?? '').trim();

      if (!this.theme.background_image) this.theme.background_image = { path: '', style: '' };
      this.theme.background_image.path = pathFromTpl;
      this.theme.background_image.style = styleFromTpl;

      if (this.themeManager.theme !== this.theme) {
        if (!this.themeManager.theme.background_image) {
          this.themeManager.theme.background_image = { path: '', style: '' };
        }
        this.themeManager.theme.background_image.path = this.theme.background_image.path;
        this.themeManager.theme.background_image.style = this.theme.background_image.style;
      }
      this.themeManager.resetBackground = !pathFromTpl;

      im.ensurePopupBackgroundTemplateItem();
      im.setInitialPopupBackgroundSelection();
      const shell = document.getElementById('wheelluckContainer');
      const merged = mergeBackgroundImage(this.theme, tpl);
      if (shell) {
        if (merged) {
          applyPopupBackgroundImage(shell, merged);
        } else {
          preserveBackgroundColor(shell, '');
        }
      }
    }

    this.themeManager?.scheduleDesktopPreviewFit?.();
  }
}



