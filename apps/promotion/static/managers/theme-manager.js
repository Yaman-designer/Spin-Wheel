import {
  getTemplateById,
  default_text,
} from "../templates.js";

import {
  toggleElementVisibility,
  applyPopupBackgroundImage,
  mergeBackgroundImage,
  isUnifiedPopupShellTheme,
  getPrimarySubmitButtonElement,
  getCloseFormButtonElement,
  setSubmitWidgetText,
  containerStyleValue,
  removeLegacyCloseLinkIfUnified,
  resolveGameAreaBackgroundCss,
  applyGameAreaBackgroundFromTheme,
  resolveGameAreaOpacityPercent,
  syncMissingGameOpacityFromTemplate,
} from "../utils/dom-utils.js";

import {
  preserveBackgroundImage,
  preserveBackgroundColor,
  getGradientLastColor,
  stripHexAlphaChannel,
  normalizeGameBackgroundOpacityPercent,
} from "../utils/color-utils.js";

import {
  applyTextStyles,
  applyTemplateTexts as applyTemplateTextsUtil,
  getInputFieldButtonText,
  getPrimarySubmitFieldStyle,
  getPrimarySubmitInputField,
  getPrimaryCloseFieldStyle,
  mergePrimarySubmitFieldStyle,
  mergePrimaryCloseFormFieldStyle,
} from "../utils/text-utils.js";

import { DefaultGameSvgs, getGameRecordById } from "../utils/game-svgs.js";
import {
  normalizeGameTheme,
  getGameTypeName,
  getGameSvgString,
  getGameHeightStyle,
  setGameHeightStyle,
  setGameTypeById,
  gameTypeNameToId,
  templateDefaultGameToTypeName,
  setGameSvgString,
  stripGameFieldsIfLightTemplateHasNoGame,
  hasActiveLightGame,
  LEGACY_THEME_ROOT_KEYS,
  purgeLegacyThemeRootKeys,
  resetLightGameThemeCompletely,
  mergeLightGameDesktopStyleFromTemplate,
  resolveAllowedGame,
  getEffectiveGameColors,
  templateDefaultGameToId,
} from "../utils/game-theme-utils.js";

import {
  isGradient,
  getButtonBackground,
  isCssPaintNone,
} from "../utils/picker-utils.js";
import { migrateLegacyConsentIntoInputFields } from "../utils/consent-field-utils.js";
import {
  getPreviewMobileAvailWidth,
  getPreviewMobileAvailHeight,
  computePreviewMobileShellDimensions,
  computePreviewMobileContainerScale,
} from "../utils/preview-mobile-shell-metrics.js";
import { ColorManager, installPromotionColorPickers } from "./color-manager.js";
import { TemplateManager, TEMPLATE_SVG_KEYS } from "./template-manager.js";
import { InputFieldsManager } from "./input-fields-manager.js";
import { TextEditorManager, DEFAULT_GAME_SVG_TEXT_SIZE } from "./text-editor-manager.js";
import { PopupManager } from "./popup-manager.js";
import {
  GameManager,
  syncGameSvgWithRewardInputs,
  truncateRewardLabel,
} from "./game-manager.js";

/**
 * Birleşik kabukta `theme.image` ile `theme.top_image` bazen ayrı kaydedilir; `??` boş string'de
 * yedeklemediği için `image.style: ""` iken `top_image.style` içindeki `height: …%` yok sayılıyordu.
 */
function pickUnifiedDecorativePath(imagePath, topImagePath) {
  const a = String(imagePath ?? '').trim();
  const b = String(topImagePath ?? '').trim();
  return a || b || '';
}

function pickUnifiedDecorativeStyle(imageStyle, topImageStyle) {
  const sa = String(imageStyle ?? '').trim();
  const sb = String(topImageStyle ?? '').trim();
  const hasHeightPct = (s) => /height:\s*[\d.]+%/i.test(s);
  if (hasHeightPct(sa)) return String(imageStyle ?? '');
  if (hasHeightPct(sb)) return String(topImageStyle ?? '');
  return sa || sb || '';
}

/** `apps.promotion.models.get_default_value_to_theme` — yeni promosyon varsayılanı ile aynı */
const COUNTDOWN_SYSTEM_DEFAULTS = {
  active: true,
  valid_time: '15',
  colors: {
    background: '#cee8e8',
    text: '#2C7A7B',
  },
};

class ThemeManager {
  constructor(theme, template) {
    this.theme = theme;
    this.selectedTemplateValue = theme.template;
    this.template = template;
    this.activeTemplateId = null;
    this.inputFieldsSortable = null;
    this.resetBackground = false;
    this.resetTopImage = false;
    this._gameColorsResetBaseline = null;
    this._gameSvgTextResetBaseline = null;
    this._textsResetBaseline = null;
    /** Şablon değişiminde kabuk yeni şablondan kurulduktan sonra no-game layout “onarımlarını” atla (inline stiller ezilmesin). */
    this._suppressNoGameLayoutMutations = false;
    this._suppressNoGameLayoutClearTimeout = null;
    this.colorManager = new ColorManager(this);
    this.templateManager = new TemplateManager(this);
    this.inputFieldsManager = new InputFieldsManager(this);
    this.textEditorManager = new TextEditorManager(this);
    this.popupManager = new PopupManager(this);
    this.gameManager = new GameManager(theme, this);
    this.gameManager.init(theme);
    this._desktopPreviewFitObserverBound = false;
    this._desktopFitRaf1 = 0;
    this._desktopFitRaf2 = 0;
    this._desktopPreviewFitTimeout = 0;
    this._desktopPreviewFitWinHandler = null;

    this._addEventListeners();

  }
 
  getResetSource() {
    if (this.activeTemplateId) {
      const template = getTemplateById(this.activeTemplateId);
      if (template) return template;
    }
    const themeInput = document.querySelector('input[name="theme"]');
    if (themeInput) {
      try { return JSON.parse(themeInput.value); } catch (e) { /* ignore */ }
    }
    return getTemplateById(this.theme?.template || 1) || {};
  }

  patchDecorativeImage(partial = {}) {
    const theme = this.theme;
    if (!theme) return;

    const unified = isUnifiedPopupShellTheme(theme);
    const basePath = unified
      ? pickUnifiedDecorativePath(theme.image?.path, theme.top_image?.path)
      : (theme.top_image?.path ?? '');
    const baseStyle = unified
      ? pickUnifiedDecorativeStyle(theme.image?.style, theme.top_image?.style)
      : (theme.top_image?.style ?? '');

    const next = {
      path: typeof basePath === 'string' ? basePath : String(basePath || ''),
      style: typeof baseStyle === 'string' ? baseStyle : String(baseStyle || ''),
    };

    if ('path' in partial) next.path = String(partial.path ?? '').trim();
    if ('style' in partial) next.style = partial.style != null ? String(partial.style) : '';

    if (unified) {
      const frozen = { path: next.path, style: next.style };
      theme.image = { ...frozen };
      theme.top_image = { ...frozen };
      delete theme.image.position;
      delete theme.top_image.position;
      try {
        window.wheelApp?.imageManager?.syncLightTopImageFormControlsVisibility?.();
      } catch {
        /* noop */
      }
      return;
    }

    let basePos = String(theme.top_image?.position ?? 'top').trim().toLowerCase();
    if (!['left', 'right', 'top'].includes(basePos)) basePos = 'top';
    const nextClassic = { ...next, position: basePos };
    if ('position' in partial) {
      const p = String(partial.position ?? '').trim().toLowerCase();
      if (['left', 'right', 'top'].includes(p)) {
        nextClassic.position = p;
      } else if (partial.position === '' || partial.position == null) {
        nextClassic.position = 'top';
      }
    }
    if (!theme.top_image || typeof theme.top_image !== 'object') theme.top_image = {};
    Object.assign(theme.top_image, nextClassic);
  }

  _getTemplateGameColorsForReset() {
    const candidateIds = [
      this.theme?.template,
      this.activeTemplateId,
    ];

    for (const rawId of candidateIds) {
      const parsedId = Number(rawId);
      const tid = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
      if (tid == null) continue;
      const tpl = getTemplateById(tid);
      if (
        tpl?.gameColors &&
        typeof tpl.gameColors === 'object' &&
        Object.keys(tpl.gameColors).length > 0
      ) {
        return tpl.gameColors;
      }
    }

    return null;
  }

  /**
   * Mevcut tema.gameColors anlık görüntüsü — düzenleme sayfası (DB) veya şablon değişiminden sonra güncellenir.
   */
  _updateGameColorsResetBaselineFromCurrentTheme() {
    if (!isUnifiedPopupShellTheme(this.theme)) {
      this._gameColorsResetBaseline = null;
      return;
    }
    const gc = this.theme?.gameColors;
    if (gc && typeof gc === 'object' && Object.keys(gc).length > 0) {
      this._gameColorsResetBaseline = JSON.parse(JSON.stringify(gc));
    } else {
      this._gameColorsResetBaseline = null;
    }
  }

  _updateGameSvgTextResetBaselineFromCurrentTheme() {
    if (!isUnifiedPopupShellTheme(this.theme)) {
      this._gameSvgTextResetBaseline = null;
      return;
    }
    const raw = this.theme?.game_styles?.game_svg_text;
    if (raw == null) {
      this._gameSvgTextResetBaseline = null;
      return;
    }
    if (typeof raw === 'string') {
      this._gameSvgTextResetBaseline = String(raw).trim() ? raw : null;
      return;
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const empty = Object.keys(raw).length === 0;
      this._gameSvgTextResetBaseline = empty ? null : JSON.parse(JSON.stringify(raw));
      return;
    }
    this._gameSvgTextResetBaseline = null;
  }

  _getTemplateGameSvgTextForReset() {
    const candidateIds = [this.theme?.template, this.activeTemplateId];
    for (const rawId of candidateIds) {
      const parsedId = Number(rawId);
      const tid = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
      if (tid == null) continue;
      const tpl = getTemplateById(tid);
      const gst = tpl?.game_styles?.game_svg_text;
      if (gst == null) continue;
      if (typeof gst === 'string' && String(gst).trim()) return gst;
      if (typeof gst === 'object' && !Array.isArray(gst) && Object.keys(gst).length > 0) {
        return JSON.parse(JSON.stringify(gst));
      }
    }
    return null;
  }

  /**
   * Reset game: font + size (.wheelText).
   * @param {boolean} [templateOnly] — true: şablon kataloğu → Arial/28px (DB / baseline yok).
   */
  _applyGameSvgTextResetFromBaselineOrTemplate(templateOnly = false) {
    if (!isUnifiedPopupShellTheme(this.theme)) {
      return;
    }
    if (!getGameTypeName(this.theme)) {
      return;
    }
    let next = null;
    if (!templateOnly && this._gameSvgTextResetBaseline != null) {
      if (typeof this._gameSvgTextResetBaseline === 'object') {
        next = JSON.parse(JSON.stringify(this._gameSvgTextResetBaseline));
      } else {
        next = this._gameSvgTextResetBaseline;
      }
    } else {
      next = this._getTemplateGameSvgTextForReset();
    }
    if (
      next == null ||
      (typeof next === 'string' && !String(next).trim()) ||
      (typeof next === 'object' && !Array.isArray(next) && Object.keys(next).length === 0)
    ) {
      next = { fontFamily: 'Arial', fontSize: DEFAULT_GAME_SVG_TEXT_SIZE };
    }
    const applyOne = (t) => {
      if (!t) return;
      t.game_styles = t.game_styles && typeof t.game_styles === 'object' ? t.game_styles : {};
      if (typeof next === 'object' && next !== null && !Array.isArray(next)) {
        t.game_styles.game_svg_text = JSON.parse(JSON.stringify(next));
      } else {
        t.game_styles.game_svg_text = next;
      }
    };
    applyOne(this.theme);
    if (this.gameManager) {
      this.gameManager.syncGameTextFontSelectFromTheme();
      this.gameManager.applyGameSvgTextStylesToActivePreview();
    }
  }

  /**
   * Mevcut texts / text_styles (ve varsa texts_fonts) anlık görüntüsü — DB veya son şablon uygulaması.
   */
  _updateTextsResetBaselineFromCurrentTheme() {
    if (!isUnifiedPopupShellTheme(this.theme)) {
      this._textsResetBaseline = null;
      return;
    }
    const texts = this.theme?.texts && typeof this.theme.texts === 'object'
      ? JSON.parse(JSON.stringify(this.theme.texts))
      : {};
    const text_styles = this.theme?.text_styles && typeof this.theme.text_styles === 'object'
      ? JSON.parse(JSON.stringify(this.theme.text_styles))
      : {};
    const hasTexts = Object.keys(texts).length > 0;
    const hasStyles = Object.keys(text_styles).length > 0;
    if (!hasTexts && !hasStyles) {
      this._textsResetBaseline = null;
      return;
    }
    const baseline = { texts, text_styles };
    baseline.texts_fonts =
      this.theme?.texts_fonts && typeof this.theme.texts_fonts === 'object'
        ? JSON.parse(JSON.stringify(this.theme.texts_fonts))
        : null;
    this._textsResetBaseline = baseline;
  }

  /** Baseline'daki metin + stilleri uygula (applyTemplateTexts `styles` anahtarını kullanır). */
  _applyTextsFromBaseline(baseline) {
    if (!baseline) return;
    const texts =
      baseline.texts && typeof baseline.texts === 'object'
        ? JSON.parse(JSON.stringify(baseline.texts))
        : {};
    const text_styles =
      baseline.text_styles && typeof baseline.text_styles === 'object'
        ? JSON.parse(JSON.stringify(baseline.text_styles))
        : {};
    if (baseline.texts_fonts) {
      this.theme.texts_fonts = JSON.parse(JSON.stringify(baseline.texts_fonts));
    } else {
      delete this.theme.texts_fonts;
    }
    const payload = { ...texts, styles: text_styles };
    applyTemplateTextsUtil(this.theme, payload);
  }

  _applyTemplateColorsFromStyles() {
    if (!this.theme.containerStyle) this.theme.containerStyle = {};
    if (!this.theme.text_styles) this.theme.text_styles = {};

    const containerBg = containerStyleValue(this.theme.containerStyle, 'background');
    if (containerBg) {
      const input = document.querySelector('input[name="container_bg_color"]');
      const box = document.getElementById('container_bg_color_box');
      if (input) input.value = containerBg;
      if (box) box.style.setProperty('background', containerBg, 'important');
      this.popupManager.changeContainerBackgroundColor(containerBg);
    }

    const buttonBg = getButtonBackground(getPrimarySubmitFieldStyle(this.theme));
    if (buttonBg) {
      this.popupManager.changeButtonBackgroundColor(buttonBg);
    }
  }

  _getTemplateById(templateId) {
    const template = getTemplateById(templateId);
    return { template, isLightPopupTemplate: false };
  }

  _finalizePreview() {
      this.updateColorControlsVisibility();
      this.renderInputFieldsInWidget(this.theme.input_fields || []);
      this.applyPopupModeFromTheme();
      
      setTimeout(() => {
        this.loadInputFields(this.theme.input_fields || []);
        this.initPopupSettings();
      if (this.theme.template === 101 || !this.theme.template) {
        this.setupPreviewClickListeners();
      }
      }, 200);
  }

  _syncPromotionPreviewAfterApply() {
    if (this.gameManager) {
      this.gameManager.updateTheme(this.theme);
      window.currentView = this.gameManager.getCurrentGameType();
    } else if (!window.currentView || !['wheel', 'slot', 'scratchcard', 'silverwheel'].includes(window.currentView)) {
      window.currentView = 'wheel';
    }

    const templateId = this.theme.template || 101;

    const { template } = this._getTemplateById(templateId);

    if (template) {
      const useSavedTheme = this.changeTemplate === false;

      let textsToApply = useSavedTheme ? (this.theme.texts || default_text) : (template.texts || default_text);
      if (
        !useSavedTheme &&
        !template.texts &&
        this.theme &&
        (this.theme.popup_type === 'gaming' ||
          this.theme.popup_type == null ||
          this.theme.popup_type === '')
      ) {
        textsToApply = JSON.parse(JSON.stringify(default_text));
        if (!this.theme.text_styles) this.theme.text_styles = {};
        if (this.theme.text_styles.headline) this.theme.text_styles.headline.color = '#ffffff';
        if (this.theme.text_styles.description) this.theme.text_styles.description.color = '#ffffff';
        if (this.theme.text_styles.disclaimer) this.theme.text_styles.disclaimer.color = '#ffffff';
        mergePrimaryCloseFormFieldStyle(this.theme, { color: '#ffffff' });
      }

      this.applyTemplateTexts(textsToApply);
      this._applyTemplateColorsFromStyles();
    }

    if (templateId === 101) {
      this.applyCurrentColors();
    }

    this._finalizePreview();
  }
      
  renderPromotionPreview(skipRefreshCheck = false) {
    const gamingRoot =
      document.querySelector('.game-svg-container') || document.querySelector('#wheelluckContainer .contentWrapper');
    const lightEditorRoot = document.getElementById('popupContainer');
    const unifiedShell = isUnifiedPopupShellTheme(this.theme);
    if (!gamingRoot && !unifiedShell && !lightEditorRoot) {
      return;
    }

    const templateId = this.theme.template || 101;

    const shouldChangeTemplate = !unifiedShell && !skipRefreshCheck;
    this.applyTemplate(templateId, shouldChangeTemplate);
    this._syncPromotionPreviewAfterApply();

    const gm = window.wheelApp?.gameManager || this.gameManager;
    if (this._isMobileView) {
      gm?.applyGamePositionLayout?.();
      gm?.refreshShellGameSvgLayoutAfterPreviewModeChange?.();
      this._applyMobilePreviewLayoutOverrides();
      this._recalcMobileScale();
    } else {
      // Mobil önizlemedeki gibi oyun kabuğu ve SVG düzeni güncellenir; ardından masaüstü sığdırma ölçeği.
      gm?.applyGamePositionLayout?.();
      gm?.refreshShellGameSvgLayoutAfterPreviewModeChange?.();
      this.scheduleDesktopPreviewFit();
    }
  }

  updateColorControlsVisibility() {
    return this.colorManager.updateColorControlsVisibility();
  }

  applyPopupModeFromTheme() {
    return this.popupManager.applyPopupModeFromTheme();
  }

  applyCurrentColors() {
    return this.colorManager.applyCurrentColors();
  }

  applyTemplateTexts(templateTexts) {
    applyTemplateTextsUtil(this.theme, templateTexts);
  }

  _startCountdown(validTime) {
    const countdownInCouponCode = document.querySelector(
      ".countDownWrapper .countdown"
    );
    let remainingSeconds = Number(validTime) * 60;

    updateCountdown();

    function updateCountdown() {
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;

      const formattedMinutes = minutes.toString().padStart(2, "0");
      const formattedSeconds = seconds.toString().padStart(2, "0");

      const countdownText =
        hours > 0
          ? `${hours
            .toString()
            .padStart(2, "0")}:${formattedMinutes}:${formattedSeconds}`
          : `${formattedMinutes}:${formattedSeconds}`;

      countdownInCouponCode.textContent = countdownText;
    }
  }

  initPickers(theme = this.theme) {
    this.theme = theme;
    this._ensureThemeStructure();
    installPromotionColorPickers(theme, this.colorManager, {
      popupManager: this.popupManager,
    });
  }

  _initTooltips() {
    document.querySelectorAll('.custom-tooltip-trigger-inline').forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        const wrapper = trigger.closest('.custom-tooltip-inline-wrapper');
        const tooltip = wrapper.querySelector('.custom-tooltip-inline');
        document.querySelectorAll('.custom-tooltip-inline.active').forEach(function (openTip) {
          if (openTip !== tooltip) openTip.classList.remove('active');
        });
        tooltip.classList.toggle('active');
      });
    });
    document.addEventListener('mousedown', function (e) {
      document.querySelectorAll('.custom-tooltip-inline.active').forEach(function (openTip) {
        const wrapper = openTip.closest('.custom-tooltip-inline-wrapper');
        const trigger = wrapper.querySelector('.custom-tooltip-trigger-inline');
        if (!openTip.contains(e.target) && !trigger.contains(e.target)) {
          openTip.classList.remove('active');
        }
      });
    });
  }

  _initHelpLinks() {
    document.querySelectorAll('.help-cloud-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = link.href;
      });
    });
  }

  _addEventListeners() {
    document
      .getElementById("reset_template")
      .addEventListener("click", () => this.resetGameOnly());
    
    const resetTextsButton = document.getElementById("resetTexts");
    if (resetTextsButton) {
      resetTextsButton.addEventListener("click", () => this.resetTexts());
    }

    document
      .getElementById("reset_wheel_popup_bg")
      .addEventListener("click", () => this._resetWheelPopupBg());
  }

  _loadColorInputs(theme) {
    const gs0 = theme?.game_styles && typeof theme.game_styles === 'object' ? theme.game_styles : null;
    const gbFromGs =
      gs0 && Object.prototype.hasOwnProperty.call(gs0, 'gameBackground')
        ? String(gs0.gameBackground ?? '').trim()
        : '';
    const gbFromRoot = String(theme?.gameBackground ?? '').trim();
    const gbRaw = gbFromGs || gbFromRoot;
    if (gbRaw && /linear-gradient|radial-gradient/i.test(gbRaw)) {
      const solidGb = getGradientLastColor(gbRaw);
      if (solidGb) {
        if (!theme.game_styles || typeof theme.game_styles !== 'object') {
          theme.game_styles = {};
        }
        theme.game_styles.gameBackground = solidGb;
        delete theme.gameBackground;
        if (this.theme && this.theme !== theme) {
          if (!this.theme.game_styles || typeof this.theme.game_styles !== 'object') {
            this.theme.game_styles = {};
          }
          this.theme.game_styles.gameBackground = solidGb;
          delete this.theme.gameBackground;
        }
      }
    }

    syncMissingGameOpacityFromTemplate(theme);
    if (this.theme && this.theme !== theme) {
      syncMissingGameOpacityFromTemplate(this.theme);
    }

    const colorMappings = [
      ['container_bg_color', stripHexAlphaChannel(containerStyleValue(theme.containerStyle, 'background'))],
      ['countdown_bg_color', stripHexAlphaChannel(theme.countdown?.colors?.background)],
      ['countdown_text_color', stripHexAlphaChannel(theme.countdown?.colors?.text)],
      ['slice_1_bg_color', ''],
      ['slice_1_text_color', ''],
      ['slice_2_bg_color', ''],
      ['slice_2_text_color', ''],
      ['slice_3_bg_color', ''],
      ['slice_3_text_color', ''],
      ['slice_4_bg_color', ''],
      ['slice_4_text_color', ''],
      ['circle_bg_color', ''],
      ['circle_text_color', ''],
      ['pin_bg_color', ''],
      ['pin_text_color', ''],
      ['game_area_bg_color', String(resolveGameAreaBackgroundCss(theme) || '').trim()],
    ];

    const applyPickerBox =
      this.colorManager && typeof this.colorManager.updateColorInputAndBox === 'function'
        ? (name, val) => this.colorManager.updateColorInputAndBox(name, val)
        : null;

    colorMappings.forEach(([name, value]) => {
      if (!applyPickerBox) return;
      if (name === 'game_area_bg_color') {
        applyPickerBox(name, value);
        return;
      }
      if (value) {
        applyPickerBox(name, value);
      }
    });

    const gameAreaOpEl = document.getElementById('game_area_bg_opacity');
    if (gameAreaOpEl) {
      let pct = resolveGameAreaOpacityPercent(theme);
      const resolvedBg = String(resolveGameAreaBackgroundCss(theme) || '').trim().toLowerCase();
      if (resolvedBg === 'transparent') {
        pct = 0;
        if (!theme.game_styles || typeof theme.game_styles !== 'object') {
          theme.game_styles = {};
        }
        theme.game_styles.gameOpacity = 0;
      }
      gameAreaOpEl.value = String(pct);
      const opLab = document.getElementById('game_area_bg_opacity_value');
      if (opLab) opLab.textContent = `${pct}%`;
    }

    if (
      theme.gameColors &&
      typeof theme.gameColors === 'object' &&
      Object.keys(theme.gameColors).length > 0
    ) {
      this.colorManager.applyGameColorsFromTemplate(theme.gameColors);
    } else {
      const fallbackGc = getEffectiveGameColors(theme);
      if (fallbackGc && Object.keys(fallbackGc).length > 0) {
        this.colorManager.applyGameColorsFromTemplate(fallbackGc);
      }
    }

    const countdownPanel = document.querySelector(".wheelCouponPanel");
    if (countdownPanel && theme.countdown?.colors) {
      countdownPanel.style.backgroundColor = theme.countdown.colors.background || '';
      countdownPanel.style.color = theme.countdown.colors.text || '';
    }
  }

  _loadFormFields(theme) {
    const fieldMappings = [
      ['schedule_checkbox', theme.schedule, 'checked'],
      ['prevent_dublicate', theme.options?.prevent_dublicate, 'checked'],
      ['show_on_mobile', theme.options?.show_on_mobile, 'checked'],
      ['start_delay_active', theme.options?.start_delay_active, 'checked'],
      ['start_delay', theme.options?.start_delay, 'value'],
      ['specific_items', theme.options?.specific_items, 'value'],
      ['specific_urls', theme.options?.specific_urls, 'value'],
      ['trigger_intent_leave', theme.options?.trigger_intent_leave, 'checked'],
      ['trigger_scroll_down', theme.options?.trigger_scroll_down, 'checked'],
      ['smart_reward', theme.options?.smart_reward === true, 'checked'],
      ['property_id', theme.options?.property_id ?? '', 'value']
    ];

    fieldMappings.forEach(([name, value, type]) => {
      const element = document.querySelector(`input[name="${name}"], textarea[name="${name}"]`);
      if (element && value !== undefined) {
        if (type === 'checked') {
          element.checked = value;
        } else {
          element.value = value || '';
        }
      }
    });
  }

  _loadTextFields(theme) {
    const textMappings = [
      ['headline', theme.texts?.headline || ''],
      ['description', theme.texts?.description || ''],
      ['disclaimer', theme.texts?.disclaimer || '']
    ];

    textMappings.forEach(([name, value]) => {
      const element = document.querySelector(`input[name="${name}"], textarea[name="${name}"]`);
      if (element) element.value = value;
    });
  }

  _loadCountdownSettings(theme) {
    const countdownActiveInput = document.querySelector('input[name="display_countdown_reminder"]');
    const validTimeInput = document.querySelector('input[name="valid_time"]');
    const countdownInCouponCode = document.querySelector(".countDownWrapper .countdown");
    
    if (countdownActiveInput) {
      countdownActiveInput.checked = theme.countdown?.active || false;
    }
    if (validTimeInput) {
      validTimeInput.value = theme.countdown?.valid_time || '';
    }
    if (countdownInCouponCode) {
      countdownInCouponCode.style.display = theme.countdown?.active ? 'block' : 'none';
    }
    if (theme.countdown?.active) {
      this._startCountdown(theme.countdown.valid_time);
    }
  }

  _applyThemeToDOM(theme) {
    removeLegacyCloseLinkIfUnified(theme);
    const popupMain = document.getElementById("wheelluckContainer");
    const popupContent = document.getElementById("wheelluckContent");
    const submit_button = getPrimarySubmitButtonElement();
    if (popupMain) {
      preserveBackgroundImage(popupMain, containerStyleValue(theme.containerStyle, 'background'), 'backgroundColor');
    }

    if (popupContent) {
      popupContent.style.color = theme.text_styles?.headline?.color || '';
    }

    if (submit_button) {
      const unifiedShell =
        isUnifiedPopupShellTheme(theme) || isUnifiedPopupShellTheme(this.theme);
      const btnStyles = getPrimarySubmitFieldStyle(theme);
      if (!unifiedShell) {
        const nb = getButtonBackground(btnStyles);
        if (nb) submit_button.style.setProperty('background', nb, 'important');
        submit_button.style.color = btnStyles?.color || '';
      } else {
        const btnBg = getButtonBackground(btnStyles);

        if (btnBg && isGradient(btnBg)) {
          submit_button.style.setProperty('background', btnBg, 'important');
        } else if (btnBg) {
          let buttonBgSolid = btnBg;
          if (buttonBgSolid.startsWith('#') && buttonBgSolid.length === 9) {
            buttonBgSolid = buttonBgSolid.substring(0, 7);
          }
          submit_button.style.setProperty('background', buttonBgSolid, 'important');
        }

        let buttonTextColor = btnStyles?.color;
        if (buttonTextColor) {
          if (buttonTextColor.startsWith('#') && buttonTextColor.length === 9) {
            buttonTextColor = buttonTextColor.substring(0, 7);
          }
          submit_button.style.setProperty('color', buttonTextColor, 'important');
        }
      }
    }

    const getTextStyles = (fieldName) => {
      if (theme.text_styles?.[fieldName]) {
        return theme.text_styles[fieldName];
      }
      if (theme.texts_fonts?.[fieldName]) {
        return theme.texts_fonts[fieldName];
      }
      return null;
    };

    const submitFieldStyles = getPrimarySubmitFieldStyle(theme);
    const closeFieldStyles = getPrimaryCloseFieldStyle(theme) || getTextStyles('close_link');

    const textElements = [
      { id: 'headline', text: theme.texts?.headline, styles: getTextStyles('headline') },
      { id: 'description', text: theme.texts?.description, styles: getTextStyles('description') },
      { id: 'disclaimer', text: theme.texts?.disclaimer, styles: getTextStyles('disclaimer') },
      {
        id: 'submit_button',
        text:
          getInputFieldButtonText(theme, 'submit_form') ||
          theme.texts?.submit_button ||
          '',
        styles: submitFieldStyles,
      },
      {
        id: 'close_link',
        text:
          getInputFieldButtonText(theme, 'close_form') ||
          theme.texts?.close_link ||
          '',
        styles: closeFieldStyles,
      }
    ];

    const unifiedShell =
      isUnifiedPopupShellTheme(theme) || isUnifiedPopupShellTheme(this.theme);

    textElements.forEach(({ id, selector, text, styles }) => {
      let element =
        id === 'submit_button'
          ? getPrimarySubmitButtonElement()
          : id === 'close_link'
            ? unifiedShell
              ? getCloseFormButtonElement()
              : document.getElementById('close_link')
          : id
            ? document.getElementById(id)
            : document.querySelector(selector);
      
      if (id === 'headline' && element) {
        const titleSpan = element.querySelector('span');
        if (titleSpan) {
          element = titleSpan;
        }
      }
      
      if (id === 'close_link' && element && text !== undefined) {
        if (element.classList?.contains('submit-button-widget')) {
          setSubmitWidgetText(element, text);
          if (styles) {
            applyTextStyles(element, styles);
          }
          return;
        }
        const textNode = element.querySelector('.text');
        if (textNode) {
          textNode.innerText = text;
          textNode.removeAttribute('style');
        } else {
          element.innerText = text;
        }
        if (styles) {
          applyTextStyles(element, styles);
        }
        return;
      }

      if (element && text !== undefined) {
        if (id === 'submit_button') {
          setSubmitWidgetText(element, text);
        } else {
          element.innerText = text;
        }
        if (styles) {
          if (unifiedShell && id === 'submit_button') {
          } else {
            applyTextStyles(element, styles);
            if (id === 'headline' && element.tagName === 'SPAN') {
              const parentElement = document.getElementById('headline');
              if (parentElement) {
                applyTextStyles(parentElement, styles);
              }
            }
          }
        }
      }
    });
  }

  _ensureThemeStructure() {
    if (!this.theme.containerStyle) {
      this.theme.containerStyle = {};
    }
    if (!this.theme.text_styles) {
      this.theme.text_styles = {};
    }
    delete this.theme.text_styles.submit_button;
    delete this.theme.text_styles.close_link;
    if (!this.theme.countdown) {
      this.theme.countdown = { colors: { background: '', text: '' } };
    } else {
      if (!this.theme.countdown.colors) {
        this.theme.countdown.colors = { background: '', text: '' };
      } else {
        if (!this.theme.countdown.colors.background) this.theme.countdown.colors.background = '';
        if (!this.theme.countdown.colors.text) this.theme.countdown.colors.text = '';
      }
    }
    normalizeGameTheme(this.theme);
  }

  initialPopup(theme, changeTemplate = false) {
    this.theme = JSON.parse(JSON.stringify(theme));
    this.changeTemplate = changeTemplate;
    this._ensureThemeStructure();
    
    const savedGameType = (getGameTypeName(this.theme) || '').toLowerCase().trim();
    if (
      savedGameType &&
      this.gameManager &&
      Array.isArray(this.gameManager.validGameTypes) &&
      this.gameManager.validGameTypes.includes(savedGameType)
    ) {
      this.gameManager.currentView = savedGameType;
      if (typeof window !== 'undefined') {
        window.currentView = savedGameType;
      }
    }

    this._loadColorInputs(this.theme);

    this.applyCurrentColors();

    const popupMain = document.getElementById("wheelluckContainer");
    const tplForBg =
      getTemplateById(theme.template);
    const bgMerged = mergeBackgroundImage(theme, tplForBg);
    if (popupMain && bgMerged && (bgMerged.path || bgMerged.style)) {
      applyPopupBackgroundImage(popupMain, bgMerged);
    }

    this._loadFormFields(theme);
    
    if (!changeTemplate) {
      this._loadTextFields(theme);
    }
    
    this._loadCountdownSettings(theme);

    if (!changeTemplate) {
      this._applyThemeToDOM(theme);
    }

    if (!this.gameManager) {
      this.gameManager = new GameManager(this.theme, this);
    } else {
      this.gameManager.updateTheme(this.theme);
    }
    this.gameManager.init(this.theme);
    
    if (isUnifiedPopupShellTheme(this.theme) && !getGameHeightStyle(this.theme)) {
      setGameHeightStyle(this.theme, 'height: 70%');
    }
    
    window.currentView = this.gameManager.getCurrentGameType();
    
    if (this.gameManager) {
      this.gameManager.initDOMElements();
    }
    
    const changeGameAccordion = document.getElementById('changeGameAccordion');
    if (changeGameAccordion) {
      if (isUnifiedPopupShellTheme(this.theme)) {
        changeGameAccordion.style.display = 'block';

        const gameTypeSelect = document.getElementById('gameTypeSelect');
        if (gameTypeSelect) {
          const validGameTypes = ['wheel', 'slot', 'scratchcard', 'silverwheel'];
          let gameType = (getGameTypeName(this.theme) || '').trim();
          if (!gameType || !validGameTypes.includes(gameType)) {
            const tpl =
              getTemplateById(this.theme.template) || {};
            gameType = (templateDefaultGameToTypeName(tpl) || 'wheel').trim();
            if (!validGameTypes.includes(gameType)) {
              gameType = 'wheel';
            }
            if (tpl.hasGame !== false) {
              setGameTypeById(this.theme, gameTypeNameToId(gameType));
            }
          }
          if (validGameTypes.includes(gameType)) {
            gameTypeSelect.value = gameType;
          }
        }
      } else {
        changeGameAccordion.style.display = 'none';
      }
    }

    if (theme.template && theme.template !== 101) {
      this.applyTemplate(theme.template, changeTemplate);
    } else {
      this.applyTemplate(101, changeTemplate);
    }

    // İlk yüklemede oyun renklerini seçilen template/tema üzerinden doğrudan uygula.
    // left-right değişimini beklemeden color input + SVG senkronu sağlanır.
    const selectedTemplateForColors =
      getTemplateById(this.theme.template);
    let selectedGameColors =
      this.theme?.gameColors &&
      typeof this.theme.gameColors === 'object' &&
      Object.keys(this.theme.gameColors).length > 0
        ? this.theme.gameColors
        : null;
    if (!selectedGameColors) {
      const gid = this.theme?.gameID;
      const rec =
        gid != null && gid !== '' ? getGameRecordById(gid) : null;
      if (rec?.gameColors && Object.keys(rec.gameColors).length > 0) {
        selectedGameColors = rec.gameColors;
      } else {
        selectedGameColors = selectedTemplateForColors?.gameColors;
      }
    }
    if (
      selectedGameColors &&
      typeof selectedGameColors === 'object' &&
      Object.keys(selectedGameColors).length > 0
    ) {
      this.theme.gameColors = { ...selectedGameColors };
      this.colorManager.applyGameColorsFromTemplate(selectedGameColors);
      requestAnimationFrame(() => {
        this.colorManager.applyGameColorsFromTemplate(selectedGameColors);
      });
      setTimeout(() => {
        this.colorManager.applyGameColorsFromTemplate(selectedGameColors);
      }, 120);
    }

    if (!changeTemplate) {
      const tplForGame = getTemplateById(this.theme.template);
      const noGameTypeName = !(getGameTypeName(this.theme) || '').trim();
      const savedSaysNoGame = this.theme.hasGame === false;
      const hasPersistedGameId =
        this.theme.gameID != null && String(this.theme.gameID).trim() !== '';
      const shouldRecoverGameFromTemplate =
        noGameTypeName && !savedSaysNoGame && hasPersistedGameId;
      if (tplForGame && tplForGame.hasGame !== false && shouldRecoverGameFromTemplate) {
        this.templateManager._syncGameFromTemplateAfterChange(tplForGame);
      }
    }

    if (
      this.theme?.gameColors &&
      typeof this.theme.gameColors === 'object' &&
      Object.keys(this.theme.gameColors).length > 0
    ) {
      this.colorManager.applyGameColorsFromTemplate(this.theme.gameColors);
    } else {
      const fallbackGc = getEffectiveGameColors(this.theme);
      if (fallbackGc && Object.keys(fallbackGc).length > 0) {
        this.colorManager.applyGameColorsFromTemplate(fallbackGc);
      }
    }

    const getTextStylesForReapply = (fieldName) => {
      if (fieldName === 'submit_button') {
        return getPrimarySubmitFieldStyle(theme) || theme.texts_fonts?.submit_button || null;
      }
      if (fieldName === 'close_link') {
        return getPrimaryCloseFieldStyle(theme) || theme.texts_fonts?.close_link || null;
      }
      if (theme.text_styles?.[fieldName]) {
        return theme.text_styles[fieldName];
      }
      if (theme.texts_fonts?.[fieldName]) {
        return theme.texts_fonts[fieldName];
      }
      return null;
    };

    if (!changeTemplate && (theme.text_styles || theme.texts_fonts)) {
      const textElements = [
        { id: 'headline', styles: getTextStylesForReapply('headline') },
        { id: 'description', styles: getTextStylesForReapply('description') },
        { id: 'disclaimer', styles: getTextStylesForReapply('disclaimer') },
        { id: 'submit_button', styles: getTextStylesForReapply('submit_button') },
        { id: 'close_link', styles: getTextStylesForReapply('close_link') },
      ];

      textElements.forEach(({ id, selector, styles }) => {
        let element;
        if (id === 'close_link') {
          element = isUnifiedPopupShellTheme(this.theme)
            ? getCloseFormButtonElement()
            : document.querySelector('#close_link .text') || document.getElementById('close_link');
        } else if (id) {
          element = document.getElementById(id);
        } else {
          element = document.querySelector(selector);
        }
        
        if (id === 'headline' && element) {
          const titleSpan = element.querySelector('span');
          if (titleSpan) {
            if (styles) {
              applyTextStyles(titleSpan, styles);
              applyTextStyles(element, styles);
            }
            return;
          }
        }
        
        if (element && styles) {
          const skipForUnifiedShellButton =
            isUnifiedPopupShellTheme(this.theme) && id === 'submit_button';
          if (!skipForUnifiedShellButton) {
            applyTextStyles(element, styles);
          }
        }
      });
    }
    
    this._showchanceColorsWarning(theme.template);

    // applyTemplate sonrası this.theme doğru input_fields'a sahip - template'de yoksa [] kullan
    migrateLegacyConsentIntoInputFields(this.theme);
    const inputFieldsToLoad = (this.theme?.input_fields || []).slice();
    this.loadInputFields(inputFieldsToLoad);
    
    if (!changeTemplate && theme.input_fields_style) {
      this.theme.input_fields_style = theme.input_fields_style;
    } else if (changeTemplate) {
      delete this.theme.input_fields_style;
    }
    setTimeout(() => {
      if (this.inputFieldsManager) {
        this.inputFieldsManager.initCommonInputFieldStylePickers();
      }
    }, 800);
    
    requestAnimationFrame(() => {
      const inputFieldsToRender = (this.theme?.input_fields || []).slice();
      this.renderInputFieldsInWidget(inputFieldsToRender);
      
      setTimeout(() => {
        this.applyCurrentColors();
      }, 400);
    });

    if (changeTemplate) {
      this._syncPromotionPreviewAfterApply();
    }

    this._updateGameColorsResetBaselineFromCurrentTheme();
    this._updateGameSvgTextResetBaselineFromCurrentTheme();
    this._updateTextsResetBaselineFromCurrentTheme();
  }


  setupInputFieldsEvents() {
    return this.inputFieldsManager.setupInputFieldsEvents();
  }

  getInputFieldTemplate(type) {
    return this.inputFieldsManager.getInputFieldTemplate(type);
  }

  addInputFieldFromTemplate(templateType) {
    return this.inputFieldsManager.addInputFieldFromTemplate(templateType);
  }

  generateInputFieldId() {
    return this.inputFieldsManager.generateInputFieldId();
  }

  renderInputFieldItem(inputData) {
    return this.inputFieldsManager.renderInputFieldItem(inputData);
  }

  removeInputField(inputId) {
    return this.inputFieldsManager.removeInputField(inputId);
  }

  loadInputFields(inputFields) {
    return this.inputFieldsManager.loadInputFields(inputFields);
  }
  
  initInputFieldsSortable() {
    return this.inputFieldsManager.initInputFieldsSortable();
  }

  renderInputFieldsInWidget(inputFields) {
    return this.inputFieldsManager.renderInputFieldsInWidget(inputFields);
  }

  initStarRatingForContainer(container, hiddenInput) {
    return this.inputFieldsManager.initStarRatingForContainer(container, hiddenInput);
  }

  getInputFieldsData() {
    return this.inputFieldsManager.getInputFieldsData();
  }

  editInputField(inputId) {
    return this.inputFieldsManager.editInputField(inputId);
  }

  saveInputFieldChanges() {
    return this.inputFieldsManager.saveInputFieldChanges();
  }

  initialEvents(theme) {
    const main = document.getElementById("wheelluckContainer");
    const tplForBg =
      getTemplateById(theme.template);
    const bgMerged = mergeBackgroundImage(theme, tplForBg);
    if (main && bgMerged && (bgMerged.path || bgMerged.style)) {
      applyPopupBackgroundImage(main, bgMerged);
    }

    const popupPositionRadios = document.querySelectorAll('input[name="popup_position"]');
    popupPositionRadios.forEach(radio => {
      radio.addEventListener("change", (event) => {
        this.applyPopupPosition(event.target.value);
        this.updatePopupPositionGrid(event.target.value);
      });
    });

    const positionGridRadios = document.querySelectorAll('input[name="popup_position_grid"]');
    positionGridRadios.forEach(radio => {
      radio.addEventListener("change", (event) => {
        const gridPosition = event.target.getAttribute('data-position');
        const popupType = this.theme.popup_type;
        const unifiedShell =
          popupType === 'gaming' || popupType == null || popupType === '';

        if (unifiedShell) {
          const gridPositionValue = event.target.getAttribute('data-grid-position') || event.target.value;
          if (gridPositionValue) {
            positionGridRadios.forEach(r => r.checked = (r === event.target));
            this.applyLightPopupGridPosition(gridPositionValue);
          }
        } else if (gridPosition === 'left') {
          document.getElementById('popup_position_left').checked = true;
          this.applyPopupPosition('left');
        } else if (gridPosition === 'right') {
          document.getElementById('popup_position_right').checked = true;
          this.applyPopupPosition('right');
        }
      });
    });
    
    document.querySelector('input[name="prevent_dublicate"]').addEventListener("input", (event) => {
      this.changePreventDublicate(event.target);
    });

    document
    .querySelector('input[name="start_delay_active"]').addEventListener("input", (event) => {
      this.changeStartDelay(event.target);
    });

     document.querySelector('input[name="schedule_checkbox"]').addEventListener("input", (event) => {
    this.changeSetSchedule(event.target);
    });

    toggleElementVisibility('input[name="start_delay"]', 
      document.querySelector('input[name="start_delay_active"]').checked);

    const startDelayInput = document.querySelector('input[name="start_delay"]');
    if (startDelayInput) {
      startDelayInput.addEventListener('input', (event) => {
        let value = event.target.value;
        value = value.replace(/[^0-9]/g, '');
        if (value.length > 5) {
          value = value.substring(0, 5);
        }
        if (value && parseInt(value) > 99999) {
          value = '99999';
        }
        event.target.value = value;
      });
      
      startDelayInput.addEventListener('paste', (event) => {
        event.preventDefault();
        const pastedText = (event.clipboardData || window.clipboardData).getData('text');
        let value = pastedText.replace(/[^0-9]/g, '');
        if (value.length > 5) {
          value = value.substring(0, 5);
        }
        if (value && parseInt(value) > 99999) {
          value = '99999';
        }
        startDelayInput.value = value;
      });
    }

    document.querySelector('input[name="show_on_mobile"]').addEventListener('input', (event) => {
      this.changeShowOnMobile(event.target);
    });

    const enforceCharLimit = (input, maxLength = 100) => {
      if (input.value.length > maxLength) {
        input.value = input.value.substring(0, maxLength);
      }
    };

    const addPasteListener = (input, maxLength = 100) => {
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text');
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const beforeText = input.value.substring(0, start);
        const afterText = input.value.substring(end);
        const newText = beforeText + paste + afterText;
        
        if (newText.length > maxLength) {
          const availableLength = maxLength - beforeText.length - afterText.length;
          if (availableLength > 0) {
            const truncatedPaste = paste.substring(0, availableLength);
            input.value = beforeText + truncatedPaste + afterText;
            input.setSelectionRange(start + truncatedPaste.length, start + truncatedPaste.length);
          }
        } else {
          input.value = newText;
          input.setSelectionRange(start + paste.length, start + paste.length);
        }
        
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };

    const headlineInput = document.querySelector('input[name="headline"]');
    if (headlineInput) {
      headlineInput.addEventListener("input", (event) => {
        enforceCharLimit(event.target, 100);
        document.getElementById('headline').innerText = event.target.value;
      });
      addPasteListener(headlineInput, 100);
    }
    toggleElementVisibility('input[name="start_delay"]', 
      document.querySelector('input[name="start_delay_active"]').checked);

    const descriptionTextarea = document.querySelector('textarea[name="description"]');
    if (descriptionTextarea) {
      descriptionTextarea.addEventListener("input", (event) => {
        enforceCharLimit(event.target, 100);
        document.getElementById('description').innerText = event.target.value;
      });
      addPasteListener(descriptionTextarea, 100);
    }

    const disclaimerTextarea = document.querySelector('textarea[name="disclaimer"]');
    if (disclaimerTextarea) {
      disclaimerTextarea.addEventListener("input", (event) => {
        enforceCharLimit(event.target, 100);
        document.getElementById('disclaimer').innerText = event.target.value;
      });
      addPasteListener(disclaimerTextarea, 100);
    }

    this.setupTextEditor();
    
    setTimeout(() => {
      this.setupPreviewClickListeners();
    }, 300);

    this.setupInputFieldsEvents();

    document.querySelector('input[name="display_countdown_reminder"]').addEventListener("input", (event) => {
      this.changeDisplayCountdownReminder(event.target);
    });

    document.querySelector('input[name="valid_time"]').addEventListener("input", (event) => {
      this._changeCountdownTime(event.target);
    });

    const resetCountdownBtn = document.getElementById('resetCountdownSettingsBtn');
    if (resetCountdownBtn) {
      resetCountdownBtn.addEventListener('click', () => this.resetCountdownToSystemDefaults());
    }

    document
      .querySelector('button[name="btnMobileView"]')
      .addEventListener("click", () => {
        this._showMobileView();
      });

    document
      .querySelector('button[name="btnDesktopView"]')
      .addEventListener("click", () => {
        this._showDesktopView();
      });

    document
      .querySelector('input[name="trigger_intent_leave"]')
      .addEventListener("change", (event) => {
        this._changeTriggerIntentLeave(event.target);
      });

    document
      .querySelector('input[name="trigger_scroll_down"]')
      .addEventListener("change", (event) => {
        this._changeTriggerScrollDown(event.target);
      });

    const smartRewardInput = document.querySelector('input[name="smart_reward"]');
    const propertyIdInput = document.querySelector('input[name="property_id"]');
    if (smartRewardInput && propertyIdInput) {
      toggleElementVisibility('input[name="property_id"]', smartRewardInput.checked);
    }
    if (smartRewardInput) {
      smartRewardInput.addEventListener("change", (event) => {
        if (propertyIdInput) {
          toggleElementVisibility('input[name="property_id"]', event.target.checked);
        }
        this.gameManager?.syncSmartRewardRewardsUi?.();
      });
    }

    document
      .querySelectorAll(
        "#headline, #description, #disclaimer, #close_link"
      )
      .forEach((item, i) => {
        item.addEventListener("click", () => {
          const accordionButton = document.querySelector(
            ".accordion-button[aria-controls^='collapseText']"
          );
          const accordionContent = document.querySelector("#collapseText");

          if (accordionButton && accordionContent) {
            const collapseInstance = bootstrap.Collapse.getOrCreateInstance(accordionContent, {
              toggle: false
            });
            collapseInstance.show();

            setTimeout(() => {
              this.popupManager?.scrollPopupToTop?.('collapseText');
            }, 100);
          }
        });
      });

    toggleElementVisibility('form[name="schedule_form"]', 
      document.querySelector('input[name="schedule_checkbox"]').checked);

    this._bindGameAreaBackgroundOpacitySlider();
  }

  _bindGameAreaBackgroundOpacitySlider() {
    const el = document.getElementById('game_area_bg_opacity');
    if (!el || el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    const label = document.getElementById('game_area_bg_opacity_value');
    const sync = () => {
      let v = parseInt(el.value, 10);
      if (!Number.isFinite(v)) v = 100;
      v = Math.min(100, Math.max(0, v));
      if (label) label.textContent = `${v}%`;
      const t = this.theme;
      if (t) {
        if (!t.game_styles || typeof t.game_styles !== 'object') t.game_styles = {};
        if (v >= 100) delete t.game_styles.gameOpacity;
        else t.game_styles.gameOpacity = v;
        delete t.gameBackgroundOpacity;
      }
      applyGameAreaBackgroundFromTheme(this.theme);
    };
    el.addEventListener('input', sync);
    el.addEventListener('change', sync);
  }

  setupTextEditor() {
    this.textEditorManager.initialize();
  }


  setupPreviewClickListeners() {
    return this.textEditorManager.setupPreviewClickListeners();
  }

  openEditorFromPreview(inputName) {
    return this.textEditorManager.openEditorFromPreview(inputName);
  }

  openTextEditor(inputElement) {
    return this.textEditorManager.openTextEditor(inputElement);
  }

  getCurrentStyles(element) {
    return this.textEditorManager.getCurrentStyles(element);
  }

  setupEditorControls(editorElement, savedStyles = {}) {
    return this.textEditorManager.setupEditorControls(editorElement, savedStyles);
  }

  updatePreviewRealTime(editorElement) {
    return this.textEditorManager.updatePreviewRealTime(editorElement);
  }

  executeFormatCommand(command, button, editorElement) {
    return this.textEditorManager.executeFormatCommand(command, button, editorElement);
  }

  updateAlignmentButtons(alignment, editorElement) {
    return this.textEditorManager.updateAlignmentButtons(alignment, editorElement);
  }

  updateFormatButtonStates(editorElement) {
    return this.textEditorManager.updateFormatButtonStates(editorElement);
  }

  updateFormatButtonStatesFromStyles(editorElement, styles) {
    return this.textEditorManager.updateFormatButtonStatesFromStyles(editorElement, styles);
  }

  closeTextEditor() {
    return this.textEditorManager.closeTextEditor();
  }

  _changeCountdownTime(item) {
    const value = parseInt(item.value, 10);
    if (value <= 0) {
      item.value = 1;
      item.setCustomValidity('Valid time must be greater than 0');
    } else {
      item.setCustomValidity('');
    }
    this._startCountdown(item.value);
    this.popupManager?.refreshCountdownPhonePreviewIfMounted?.();
  }

  /**
   * Aktif telefon mockup’ında “ekran deliği” boyutu (px). Bezel: phone.png oranına yakın.
   */
  _getPhoneFrameScreenAvailOrNull(phoneFrameEl) {
    const phoneFrame = phoneFrameEl || document.getElementById("mobilePhoneFrame");
    if (!phoneFrame?.classList?.contains("active")) return null;
    const img = phoneFrame.querySelector(".mobile-phone-img");
    if (!img) return null;
    const r = img.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return null;
    const insetXFrac = 0.088;
    const insetYFrac = 0.072;
    const pad = 8;
    const availW = Math.max(40, r.width * (1 - 2 * insetXFrac) - pad * 2);
    const availH = Math.max(40, r.height * (1 - 2 * insetYFrac) - pad * 2);
    return { availW, availH };
  }

  /**
   * phone.png çerçevesindeki görünür ekran alanına kabuğu sığdırmak için ölçek.
   * #popupContainer geniş olduğunda computePreviewMobileContainerScale genelde 1 döner; mockup içinde taşma olur.
   */
  _computeMobilePreviewScaleFromPhoneFrame(phoneFrame, shellW, shellH) {
    const inner = this._getPhoneFrameScreenAvailOrNull(phoneFrame);
    if (!inner) return null;
    const viewportFit = Math.min(1, inner.availW / shellW, inner.availH / shellH);
    /* Kenarlarda biraz boşluk: tam sınıra oturtmayı %6 yumuşat */
    const comfortShrink = 0.94;
    return Math.max(0.12, Math.min(3, viewportFit * comfortShrink));
  }

  _recalcMobileScale() {
    const phoneFrame = document.getElementById("mobilePhoneFrame");
    const popupMain = document.getElementById("wheelluckContainer");
    if (!phoneFrame || !popupMain) return;

    const shellW = popupMain.offsetWidth;
    const shellH = popupMain.offsetHeight;
    if (shellW <= 0 || shellH <= 0) return;

    let total = this._computeMobilePreviewScaleFromPhoneFrame(phoneFrame, shellW, shellH);
    if (total == null) {
      const wrap = document.getElementById("popupContainer");
      total = computePreviewMobileContainerScale(wrap, shellW, shellH);
    }
    if (total == null) return;
    popupMain.style.setProperty('--wheelluck-container-scale', String(total));
    const wrap = document.getElementById('popupContainer');
    const couponOverlay = wrap?.querySelector('.promotion-phone-coupon-overlay');
    if (couponOverlay) {
      couponOverlay.style.setProperty('--wheelluck-container-scale', String(total));
    }
  }

  /**
   * Masaüstü önizleme: sığdırma kutusu = #popupContainer boyutunun orantılı alt kümesi
   * (`--promotion-desktop-preview-max-fill`, varsayılan 0.92).
   */
  _getDesktopPreviewMaxFillRatio(popupContainer) {
    const fallback = 0.92;
    if (!popupContainer || typeof window === 'undefined' || !window.getComputedStyle) {
      return fallback;
    }
    try {
      const raw = window
        .getComputedStyle(popupContainer)
        .getPropertyValue('--promotion-desktop-preview-max-fill');
      const n = parseFloat(String(raw).trim());
      if (!Number.isFinite(n)) return fallback;
      return Math.min(1, Math.max(0.5, n));
    } catch (_) {
      return fallback;
    }
  }

  /**
   * Masaüstü önizlemede #wheelluckContainer, #popupContainer alanına sığacak şekilde
   * --wheelluck-container-scale ile ölçeklenir (Popup Size preset × viewport sığdırma).
   */
  _applyDesktopPreviewFitScale() {
    if (typeof document === 'undefined') return;
    if (this._isMobileView) return;
    const shell = document.getElementById('wheelluckContainer');
    const pc = document.getElementById('popupContainer');
    if (!shell || !pc) return;

    let preset = parseFloat(shell.dataset.promotionPresetScale || '1', 10);
    if (!Number.isFinite(preset) || preset <= 0) preset = 1;

    const pad = 24;
    const maxFill = this._getDesktopPreviewMaxFillRatio(pc);
    const boxW = Math.max(0, pc.clientWidth * maxFill);
    const boxH = Math.max(0, pc.clientHeight * maxFill);
    const aw = Math.max(80, boxW - pad);
    const ah = Math.max(80, boxH - pad);

    const rawW = shell.offsetWidth;
    const rawH = shell.offsetHeight;
    if (rawW <= 0 || rawH <= 0) return;

    const fitW = aw / rawW;
    const fitH = ah / rawH;
    const viewportFit = Math.min(1, fitW, fitH);
    const total = Math.max(0.12, Math.min(3, preset * viewportFit));
    shell.style.setProperty('--wheelluck-container-scale', String(total));
    const couponOverlay = pc.querySelector('.promotion-phone-coupon-overlay');
    if (couponOverlay) {
      couponOverlay.style.setProperty('--wheelluck-container-scale', String(total));
    }
  }

  scheduleDesktopPreviewFit() {
    if (typeof window === 'undefined') return;
    this._ensureDesktopPreviewFitObserver();
    window.cancelAnimationFrame(this._desktopFitRaf1);
    window.cancelAnimationFrame(this._desktopFitRaf2);
    this._desktopFitRaf1 = window.requestAnimationFrame(() => {
      this._desktopFitRaf2 = window.requestAnimationFrame(() => {
        this._applyDesktopPreviewFitScale();
      });
    });
  }

  _ensureDesktopPreviewFitObserver() {
    if (this._desktopPreviewFitObserverBound) return;
    const pc = document.getElementById('popupContainer');
    if (!pc) return;
    this._desktopPreviewFitObserverBound = true;
    if (typeof ResizeObserver !== 'undefined') {
      this._desktopPreviewFitObserver = new ResizeObserver(() => {
        if (this._isMobileView) return;
        window.clearTimeout(this._desktopPreviewFitTimeout);
        this._desktopPreviewFitTimeout = window.setTimeout(() => {
          this._applyDesktopPreviewFitScale();
        }, 80);
      });
      this._desktopPreviewFitObserver.observe(pc);
    }
    this._desktopPreviewFitWinHandler = () => {
      if (this._isMobileView) return;
      window.clearTimeout(this._desktopPreviewFitTimeout);
      this._desktopPreviewFitTimeout = window.setTimeout(() => {
        this._applyDesktopPreviewFitScale();
      }, 120);
    };
    window.addEventListener('resize', this._desktopPreviewFitWinHandler);
  }

  _getShellSizeSnapshotBeforeMobilePreview(popupMain) {
    if (!popupMain) {
      return { width: '', height: '', maxWidth: '', maxHeight: '', minHeight: '' };
    }
    const cs = this.theme?.containerStyle || {};
    const ps = this.theme?.popup_settings || {};
    const pick = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : '');

    let width = pick(popupMain.style.width);
    let height = pick(popupMain.style.height);
    if (!width) width = pick(ps.popup_width);
    if (!height) height = pick(ps.popup_height);
    if (!width) width = pick(containerStyleValue(cs, 'width'));
    if (!height) height = pick(containerStyleValue(cs, 'height'));
    if (!width || !height) {
      const r = popupMain.getBoundingClientRect();
      if (!width && r.width > 1) width = `${Math.round(r.width)}px`;
      if (!height && r.height > 1) height = `${Math.round(r.height)}px`;
    }

    const maxWidth = pick(popupMain.style.maxWidth) || pick(containerStyleValue(cs, 'max-width'));
    const maxHeight = pick(popupMain.style.maxHeight) || pick(containerStyleValue(cs, 'max-height'));
    const minHeight = pick(popupMain.style.minHeight) || pick(containerStyleValue(cs, 'min-height'));

    return { width, height, maxWidth, maxHeight, minHeight };
  }

  _setMobileLayoutPositionControlsDisabled(disabled) {
    document.querySelectorAll('input[name="game_position"]').forEach((inp) => {
      inp.disabled = !!disabled;
    });
    document.querySelectorAll('input[name="top_image_position"]').forEach((inp) => {
      inp.disabled = !!disabled;
    });
    document.querySelectorAll('input[name="popup_size"]').forEach((inp) => {
      inp.disabled = !!disabled;
    });
    const popupWidthEl = document.getElementById('popup_width');
    const popupHeightEl = document.getElementById('popup_height');
    if (popupWidthEl) popupWidthEl.disabled = !!disabled;
    if (popupHeightEl) popupHeightEl.disabled = !!disabled;

    const gameWrap = document.getElementById('gamePositionControls');
    if (gameWrap) {
      gameWrap.classList.toggle('opacity-50', !!disabled);
      gameWrap.style.pointerEvents = disabled ? 'none' : '';
    }
    const imgWrap = document.getElementById('lightImagePositionControls');
    if (imgWrap) {
      imgWrap.classList.toggle('opacity-50', !!disabled);
      imgWrap.style.pointerEvents = disabled ? 'none' : '';
    }
    const sizeWrap = document.getElementById('lightPopupSizeControls');
    if (sizeWrap) {
      sizeWrap.classList.toggle('opacity-50', !!disabled);
      sizeWrap.style.pointerEvents = disabled ? 'none' : '';
    }
  }

  _applyMobilePreviewLayoutOverrides() {
    const popupMain = document.getElementById("wheelluckContainer");
    if (!popupMain) return;

    const wrap = document.getElementById("popupContainer");
    const availW = getPreviewMobileAvailWidth(wrap);
    const { capW, capH } = computePreviewMobileShellDimensions(availW);

    const isGaming =
      this.theme?.popup_type === "gaming" ||
      popupMain.classList.contains("gaming-popup-mode");
    const phoneAvail = isGaming ? this._getPhoneFrameScreenAvailOrNull() : null;
    let shellW = capW;
    let shellH = capH;
    if (phoneAvail) {
      shellW = Math.max(40, Math.floor(phoneAvail.availW));
      shellH = Math.max(40, Math.floor(phoneAvail.availH));
    } else if (isGaming) {
      const availH = getPreviewMobileAvailHeight(wrap);
      shellH = Math.max(80, Math.floor(availH));
    }

    popupMain.style.setProperty('width', `${shellW}px`, 'important');
    popupMain.style.setProperty('height', `${shellH}px`, 'important');
    popupMain.style.setProperty('max-width', `${shellW}px`, 'important');
    popupMain.style.setProperty('max-height', `${shellH}px`, 'important');
    popupMain.style.setProperty('min-height', `${shellH}px`, 'important');

    const contentWrapper = document.querySelector('.contentWrapper');
    if (contentWrapper) {
      contentWrapper.style.setProperty('flex-direction', 'column', 'important');
      contentWrapper.style.setProperty('align-items', 'stretch', 'important');
      contentWrapper.style.setProperty('flex', '1 1 auto', 'important');
      contentWrapper.style.setProperty('min-height', '0', 'important');
      contentWrapper.style.setProperty('overflow-x', 'hidden', 'important');
      contentWrapper.style.setProperty('overflow-y', 'auto', 'important');
      contentWrapper.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
      contentWrapper.style.setProperty('scrollbar-width', 'none', 'important');
      contentWrapper.style.setProperty('-ms-overflow-style', 'none', 'important');
    }

    const content = document.getElementById('wheelluckContent');
    const gameContainer = document.querySelector('.game-svg-container');
    const imageContainer = document.querySelector('.image-container');

    const hasActiveGame =
      this.theme?.popup_type === 'gaming' ||
      (this.theme?.gameID != null && String(this.theme.gameID).trim() !== '');

    if (content) {
      content.style.setProperty('order', '2', 'important');
      content.style.setProperty('width', '100%', 'important');
      content.style.setProperty('max-width', '100%', 'important');
      content.style.setProperty('justify-content', 'flex-start', 'important');
      content.style.setProperty('padding-top', '16px', 'important');
      content.style.setProperty('flex', '0 0 auto', 'important');
      content.style.setProperty('overflow-x', 'hidden', 'important');
      content.style.setProperty('overflow-y', 'visible', 'important');
    }

    if (gameContainer && hasActiveGame) {
      gameContainer.style.setProperty('order', '1', 'important');
      gameContainer.style.setProperty('width', '100%', 'important');
      gameContainer.style.setProperty('max-width', '100%', 'important');
      gameContainer.style.setProperty('align-self', 'stretch', 'important');
      /* % yükseklik + iç scroll yerine: oyun doğal yükseklik, .contentWrapper tek kaydırma */
      gameContainer.style.setProperty('height', 'auto', 'important');
      gameContainer.style.setProperty('max-height', 'none', 'important');
      gameContainer.style.setProperty('min-height', '0', 'important');
      gameContainer.style.setProperty('flex', '0 0 auto', 'important');
      gameContainer.style.setProperty('flex-basis', 'auto', 'important');
      gameContainer.style.setProperty('overflow', 'visible', 'important');
      const gameInner = gameContainer.querySelector('.game-svg-inner');
      if (gameInner) {
        gameInner.style.setProperty('height', 'auto', 'important');
        gameInner.style.setProperty('max-height', 'none', 'important');
        gameInner.style.setProperty('min-height', '0', 'important');
        gameInner.style.setProperty('flex', '1 1 auto', 'important');
        gameInner.style.setProperty('overflow', 'visible', 'important');
      }
    }

    if (imageContainer) {
      // Oyun yokken (split dekor görsel) kabukta tek sıra: görsel üstte, form altta.
      const imageOrder = hasActiveGame ? '3' : '1';
      imageContainer.style.setProperty('order', imageOrder, 'important');
      imageContainer.style.setProperty('width', '100%', 'important');
      imageContainer.style.setProperty('max-width', '100%', 'important');
      imageContainer.style.setProperty('align-self', 'stretch', 'important');
    }

    this._setMobileLayoutPositionControlsDisabled(true);
  }

  _showMobileView() {
    this._isMobileView = true;

    const desktopBtn = document.querySelector('button[name="btnDesktopView"]');
    const mobileBtn = document.querySelector('button[name="btnMobileView"]');
    if (desktopBtn) { desktopBtn.classList.remove("btn-wheelluck"); desktopBtn.classList.add("btn-secondary"); }
    if (mobileBtn) { mobileBtn.classList.add("btn-wheelluck"); mobileBtn.classList.remove("btn-secondary"); }

    const phoneFrame = document.getElementById("mobilePhoneFrame");
    const popupMain = document.getElementById("wheelluckContainer");
    if (!phoneFrame || !popupMain) return;

    if (!popupMain.dataset.mobileShellSnapCaptured) {
      const snap = this._getShellSizeSnapshotBeforeMobilePreview(popupMain);
      popupMain.dataset.mobileShellSnapCaptured = '1';
      popupMain.dataset.mobilePrevWidth = snap.width || '';
      popupMain.dataset.mobilePrevHeight = snap.height || '';
      popupMain.dataset.mobilePrevMaxWidth = snap.maxWidth || '';
      popupMain.dataset.mobilePrevMaxHeight = snap.maxHeight || '';
      popupMain.dataset.mobilePrevMinHeight = snap.minHeight || '';
    }

    phoneFrame.classList.add("active");
    popupMain.classList.add("mobile-preview-mode");
    const gm = window.wheelApp?.gameManager || this.gameManager;
    gm?.applyGamePositionLayout?.();
    gm?.refreshShellGameSvgLayoutAfterPreviewModeChange?.();
    this._applyMobilePreviewLayoutOverrides();

    this._recalcMobileScale();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (this._isMobileView) this._recalcMobileScale();
      });
    });

    const phoneImg = phoneFrame.querySelector('.mobile-phone-img');
    if (phoneImg && !phoneImg.complete) {
      phoneImg.addEventListener(
        'load',
        () => {
          if (this._isMobileView) this._recalcMobileScale();
        },
        { once: true }
      );
    }

    if (!this._mobileResizeHandler) {
      this._mobileResizeHandler = () => {
        if (this._isMobileView) this._recalcMobileScale();
      };
      window.addEventListener('resize', this._mobileResizeHandler);
    }
  }

  _showDesktopView() {
    const wasMobile = this._isMobileView;
    this._isMobileView = false;

    const desktopBtn = document.querySelector('button[name="btnDesktopView"]');
    const mobileBtn = document.querySelector('button[name="btnMobileView"]');
    if (mobileBtn) { mobileBtn.classList.remove("btn-wheelluck"); mobileBtn.classList.add("btn-secondary"); }
    if (desktopBtn) { desktopBtn.classList.add("btn-wheelluck"); desktopBtn.classList.remove("btn-secondary"); }

    const phoneFrame = document.getElementById("mobilePhoneFrame");
    const popupMain = document.getElementById("wheelluckContainer");

    if (phoneFrame) phoneFrame.classList.remove("active");
    if (popupMain) {
      popupMain.classList.remove("mobile-preview-mode");
    }

    if (popupMain && wasMobile) {
      const prevWidth = popupMain.dataset.mobilePrevWidth ?? '';
      const prevHeight = popupMain.dataset.mobilePrevHeight ?? '';
      const prevMaxWidth = popupMain.dataset.mobilePrevMaxWidth ?? '';
      const prevMaxHeight = popupMain.dataset.mobilePrevMaxHeight ?? '';
      const prevMinHeight = popupMain.dataset.mobilePrevMinHeight ?? '';

      popupMain.style.removeProperty('width');
      popupMain.style.removeProperty('height');
      popupMain.style.removeProperty('max-width');
      popupMain.style.removeProperty('max-height');
      popupMain.style.removeProperty('min-height');

      if (prevWidth) popupMain.style.setProperty('width', prevWidth);
      if (prevHeight) popupMain.style.setProperty('height', prevHeight);
      if (prevMaxWidth) popupMain.style.setProperty('max-width', prevMaxWidth);
      if (prevMaxHeight) popupMain.style.setProperty('max-height', prevMaxHeight);
      if (prevMinHeight) popupMain.style.setProperty('min-height', prevMinHeight);

      delete popupMain.dataset.mobileShellSnapCaptured;
      delete popupMain.dataset.mobilePrevWidth;
      delete popupMain.dataset.mobilePrevHeight;
      delete popupMain.dataset.mobilePrevMaxWidth;
      delete popupMain.dataset.mobilePrevMaxHeight;
      delete popupMain.dataset.mobilePrevMinHeight;
    }

    if (wasMobile) {
      if (popupMain) {
        popupMain.style.removeProperty('display');
        popupMain.style.removeProperty('flex-direction');
        popupMain.style.removeProperty('overflow');
      }

      const contentWrapper = document.querySelector('.contentWrapper');
      if (contentWrapper) {
        contentWrapper.style.removeProperty('flex-direction');
        contentWrapper.style.removeProperty('align-items');
        contentWrapper.style.removeProperty('flex');
        contentWrapper.style.removeProperty('min-height');
        contentWrapper.style.removeProperty('width');
        contentWrapper.style.removeProperty('max-width');
        contentWrapper.style.removeProperty('overflow-x');
        contentWrapper.style.removeProperty('overflow-y');
        contentWrapper.style.removeProperty('-webkit-overflow-scrolling');
        contentWrapper.style.removeProperty('scrollbar-gutter');
        contentWrapper.style.removeProperty('scrollbar-width');
        contentWrapper.style.removeProperty('-ms-overflow-style');
      }

      const content = document.getElementById('wheelluckContent');
      if (content) {
        content.style.removeProperty('order');
        content.style.removeProperty('width');
        content.style.removeProperty('max-width');
        content.style.removeProperty('justify-content');
        content.style.removeProperty('padding-top');
        content.style.removeProperty('overflow-x');
        content.style.removeProperty('overflow-y');
        content.style.removeProperty('flex');
        content.style.removeProperty('min-height');
      }

      const gameContainer = document.querySelector('.game-svg-container');
      if (gameContainer) {
        gameContainer.style.removeProperty('order');
        gameContainer.style.removeProperty('width');
        gameContainer.style.removeProperty('max-width');
        gameContainer.style.removeProperty('max-height');
        gameContainer.style.removeProperty('align-self');
        gameContainer.style.removeProperty('height');
        gameContainer.style.removeProperty('min-height');
        gameContainer.style.removeProperty('flex-shrink');
        gameContainer.style.removeProperty('flex');
        gameContainer.style.removeProperty('flex-basis');
        gameContainer.style.removeProperty('overflow');
        const gameInner = gameContainer.querySelector('.game-svg-inner');
        if (gameInner) {
          gameInner.style.removeProperty('overflow');
          gameInner.style.removeProperty('width');
          gameInner.style.removeProperty('max-width');
          gameInner.style.removeProperty('height');
          gameInner.style.removeProperty('min-height');
          gameInner.style.removeProperty('flex');
          gameInner.style.removeProperty('display');
          gameInner.style.removeProperty('align-items');
          gameInner.style.removeProperty('justify-content');
        }
      }

      const imageContainer = document.querySelector('.image-container');
      if (imageContainer) {
        imageContainer.style.removeProperty('order');
        imageContainer.style.removeProperty('width');
        imageContainer.style.removeProperty('max-width');
        imageContainer.style.removeProperty('align-self');
        imageContainer.style.removeProperty('flex');
        imageContainer.style.removeProperty('flex-shrink');
        imageContainer.style.removeProperty('overflow');
      }

      this._setMobileLayoutPositionControlsDisabled(false);

      // Mobil setProperty ile width/padding üzerine yazıldı; removeProperty sadece kaldırır, bucket’taki
      // orijinal padding (% satır içi) geri gelmez. applySplitRowShellFromTheme oyun yokken no-op.
      const im = window.wheelApp?.imageManager;
      if (im?.applyImagePosition) {
        const pos = String(this.theme?.layout?.position ?? '').trim().toLowerCase();
        if (pos === 'left' || pos === 'right' || pos === 'top') {
          im.applyImagePosition(pos);
        }
      }

      if (window.wheelApp?.imageManager?.applySplitRowShellFromTheme) {
        window.wheelApp.imageManager.applySplitRowShellFromTheme();
      }
      if (window.wheelApp?.gameManager?.applyGamePositionLayout) {
        window.wheelApp.gameManager.applyGamePositionLayout();
      }
      window.wheelApp?.gameManager?.refreshShellGameSvgLayoutAfterPreviewModeChange?.();

      const currentSize = this.theme?.popup_settings?.popup_size || 'medium';
      if (this.popupManager) {
        this.popupManager.syncPresetPopupSize(currentSize);
      }
    }
    this.scheduleDesktopPreviewFit();
  }

  _changeTriggerIntentLeave(item) {
    document.querySelector('input[name="trigger_intent_leave"]').checked =
      item.checked;
  }

  _changeTriggerScrollDown(item) {
    document.querySelector('input[name="trigger_scroll_down"]').checked =
      item.checked;
  }

  _showchanceColorsWarning(templateId) {
    return this.popupManager.showchanceColorsWarning(templateId);
  }

  _applyGameColorResetFromTemplate(tplGc) {
    const gameName = getGameTypeName(this.theme);
    if (!gameName) {
      return;
    }

    // SVG'deki CSS değişken listesi (eksik anahtarlar için yedek); asıl reset kaynağı tplGc (DB/şablon).
    let svgContent = (DefaultGameSvgs.getGame(gameName)?.svg || '').trim();
    if (!svgContent) {
      svgContent = (getGameSvgString(this.theme) || '').trim();
    }
    if (!svgContent) {
      return;
    }

    const engineDefaults = this.getCSSVariablesFromSvg(svgContent) || {};
    const gc = { ...engineDefaults };
    if (tplGc && typeof tplGc === 'object') {
      for (const [k, v] of Object.entries(tplGc)) {
        if (v != null && String(v).trim() !== '') {
          gc[k] = v;
        }
      }
    }
    if (!gc || Object.keys(gc).length === 0) {
      return;
    }

    const tc = gc['--text-color'];
    if (tc && !gc['--text-color-1']) {
      gc['--text-color-1'] = tc;
      gc['--text-color-2'] = tc;
      gc['--text-color-3'] = tc;
      gc['--text-color-4'] = tc;
    }
    this.colorManager.applyColorsToSvg(gc);
    this.colorManager.syncColorsToInputs(gc);
    if (this.colorManager && typeof this.colorManager.updateTextColorsForAllViews === 'function') {
      this.colorManager.updateTextColorsForAllViews();
    }
    this.theme.gameColors = { ...gc };
  }

  /**
   * Reset game: şablondaki oyun konumu (sol/üst/sağ), SVG yüksekliği (game_svg_area) ve önizleme DOM’u.
   */
  _resetUnifiedGameLayoutAndSizeFromTemplate() {
    if (typeof document === 'undefined' || !isUnifiedPopupShellTheme(this.theme)) return;
    if (!getGameTypeName(this.theme)) return;

    const rawTid = this.theme?.template;
    const tid = typeof rawTid === 'number' ? rawTid : parseInt(String(rawTid ?? ''), 10);
    const tpl = Number.isInteger(tid) && tid > 0 ? getTemplateById(tid) : null;
    if (!tpl) return;

    const layout = tpl.layout && typeof tpl.layout === 'object' ? tpl.layout : {};
    const posRaw = String(layout.position ?? 'left').trim().toLowerCase();
    const pos = ['left', 'right', 'top'].includes(posRaw) ? posRaw : 'left';
    this.theme.layout = this.theme.layout || {};
    this.theme.layout.position = pos;
    this.theme.game_position = pos;

    const tplGs = tpl.game_styles;
    if (tplGs && typeof tplGs === 'object') {
      this.theme.game_styles = this.theme.game_styles || {};
      const area = String(tplGs.game_svg_area ?? '').trim();
      if (area) {
        this.theme.game_styles.game_svg_area = area;
      } else {
        delete this.theme.game_styles.game_svg_area;
      }
    }

    const gm = this.gameManager || (typeof window !== 'undefined' ? window.wheelApp?.gameManager : null);
    if (gm && typeof gm._syncGamePositionUi === 'function') {
      gm._syncGamePositionUi();
    }
    if (gm && typeof gm.applyGamePositionLayout === 'function') {
      gm.applyGamePositionLayout();
    }
    if (typeof window !== 'undefined' && window.wheelApp?.imageManager?.applySplitRowShellFromTheme) {
      window.wheelApp.imageManager.applySplitRowShellFromTheme();
    }

    const areaStr = String(getGameHeightStyle(this.theme) || '').trim();
    const m = areaStr.match(/height:\s*([\d.]+)%/i);
    let pct = m ? parseFloat(m[1]) : NaN;
    if (!Number.isFinite(pct)) {
      pct = gm?.gameSvgDefaultHeight ?? 70;
    }
    pct = Math.min(100, Math.max(10, Math.round(pct)));

    if (gm && typeof gm._applyGameSvgSizeWithContainer === 'function') {
      const shell = document.querySelector('.game-svg-container');
      if (shell) gm._applyGameSvgSizeWithContainer(pct, shell);
    }

    const heightInput = document.getElementById('lightPopupGameSvgHeight');
    const sizeLabel = document.getElementById('lightPopupGameSvgSizeValue');
    if (heightInput) heightInput.value = String(pct);
    if (sizeLabel) sizeLabel.textContent = `${pct}%`;

    if (typeof this.scheduleDesktopPreviewFit === 'function') {
      this.scheduleDesktopPreviewFit();
    }
  }

  /**
   * Reset game: oyun alanı arka planı şablon `game_styles.gameBackground` (veya kök) ile hizalanır; seçici ve `.game-svg-container` güncellenir.
   */
  _resetGameAreaBackgroundFromTemplate(tpl) {
    if (!tpl || typeof tpl !== 'object') return;

    const gm = this.gameManager || (typeof window !== 'undefined' ? window.wheelApp?.gameManager : null);
    const gsTpl = tpl.game_styles && typeof tpl.game_styles === 'object' ? tpl.game_styles : null;
    const raw =
      gsTpl && Object.prototype.hasOwnProperty.call(gsTpl, 'gameBackground')
        ? gsTpl.gameBackground
        : tpl.gameBackground;

    const applyToTheme = (t) => {
      if (!t || typeof t !== 'object') return;
      if (!t.game_styles || typeof t.game_styles !== 'object') t.game_styles = {};
      if (raw != null && String(raw).trim() !== '') {
        t.game_styles.gameBackground = String(raw).trim();
      } else {
        delete t.game_styles.gameBackground;
      }
      delete t.game_styles.gameOpacity;
      delete t.gameBackground;
      delete t.gameBackgroundOpacity;
    };

    if (gm && typeof gm._forEachLinkedTheme === 'function') {
      gm._forEachLinkedTheme(applyToTheme);
    } else {
      applyToTheme(this.theme);
    }

    const active =
      gm && typeof gm._activeTheme === 'function' ? gm._activeTheme() : this.theme;
    const css = resolveGameAreaBackgroundCss(active);
    if (this.colorManager && typeof this.colorManager.updateColorInputAndBox === 'function') {
      this.colorManager.updateColorInputAndBox('game_area_bg_color', css);
    }
    const opReset = document.getElementById('game_area_bg_opacity');
    if (opReset) {
      opReset.value = '100';
      const opLab = document.getElementById('game_area_bg_opacity_value');
      if (opLab) opLab.textContent = '100%';
    }
    applyGameAreaBackgroundFromTheme(active);
  }

  resetGameOnly() {
    const gm = this.gameManager || (typeof window !== 'undefined' ? window.wheelApp?.gameManager : null);

    if (isUnifiedPopupShellTheme(this.theme)) {
      const rawTid = this.theme?.template;
      const tid = typeof rawTid === 'number' ? rawTid : parseInt(String(rawTid ?? ''), 10);
      const tpl = Number.isInteger(tid) && tid > 0 ? getTemplateById(tid) : null;

      if (tpl && tpl.hasGame !== false && gm && typeof gm.changeGameType === 'function') {
        const rawTplGid = Number(tpl.gameID);
        const resolvedId =
          Number.isInteger(rawTplGid) && rawTplGid > 0
            ? rawTplGid
            : (templateDefaultGameToId(tpl) ?? 1);

        if (typeof gm._forEachLinkedTheme === 'function') {
          gm._forEachLinkedTheme((t) => setGameTypeById(t, resolvedId));
        } else {
          setGameTypeById(this.theme, resolvedId);
        }

        const gameTypeName = (
          getGameTypeName(this.theme) ||
          templateDefaultGameToTypeName(tpl) ||
          'wheel'
        ).trim();
        const validated =
          typeof gm._validateGameType === 'function'
            ? gm._validateGameType(gameTypeName)
            : gameTypeName;

        gm.changeGameType(validated || 'wheel', { skipPreviewUpdate: false, updateDOM: true });
      }

      const templateColors = this._getTemplateGameColorsForReset();
      this._applyGameColorResetFromTemplate(templateColors || null);
      this._applyGameSvgTextResetFromBaselineOrTemplate(true);
      if (tpl) {
        this._resetGameAreaBackgroundFromTemplate(tpl);
      }
      this._resetUnifiedGameLayoutAndSizeFromTemplate();
      return;
    }

    const templateId = this.theme?.template || 101;
    let template = getTemplateById(templateId);
    if (!template) {
      template = getTemplateById(templateId);
    }
    if (!template) {
      template = getTemplateById(101);
    }

    if (template && template.hasGame !== false && gm && typeof gm.changeGameType === 'function') {
      const rawTplGid = Number(template.gameID);
      const resolvedId =
        Number.isInteger(rawTplGid) && rawTplGid > 0
          ? rawTplGid
          : (templateDefaultGameToId(template) ?? 1);
      setGameTypeById(this.theme, resolvedId);
      const gameTypeName = (
        getGameTypeName(this.theme) ||
        templateDefaultGameToTypeName(template) ||
        'wheel'
      ).trim();
      const validated =
        typeof gm._validateGameType === 'function'
          ? gm._validateGameType(gameTypeName)
          : gameTypeName;
      gm.changeGameType(validated || 'wheel', { skipPreviewUpdate: false, updateDOM: true });
    }

    this._applyGameColorResetFromTemplate(template?.gameColors);
    this._applyGameSvgTextResetFromBaselineOrTemplate(true);
    if (template) {
      this._resetGameAreaBackgroundFromTemplate(template);
    }
  }

  resetColors() {
    const unifiedShell = isUnifiedPopupShellTheme(this.theme);

    if (unifiedShell) {
      const resetData = this.getResetSource();
      
      if (resetData.texts) {
        applyTemplateTextsUtil(this.theme, resetData.texts);
      }
      
      if (resetData.input_fields_style) {
        this.theme.input_fields_style = JSON.parse(JSON.stringify(resetData.input_fields_style));
        setTimeout(() => {
          if (this.inputFieldsManager) {
            this.inputFieldsManager.initCommonInputFieldStylePickers();
          }
        }, 100);
      }
      
      if (resetData.input_fields && Array.isArray(resetData.input_fields)) {
        this.theme.input_fields = JSON.parse(JSON.stringify(resetData.input_fields));
        setTimeout(() => {
          if (this.inputFieldsManager) {
            this.inputFieldsManager.loadInputFields(this.theme.input_fields);
          }
        }, 150);
      }

      this._applyGameColorResetFromTemplate(resetData?.gameColors);
      
      const containerBg =
        containerStyleValue(resetData.containerStyle, 'background') || '';
      const containerBgInput = document.querySelector('input[name="container_bg_color"]');
      if (containerBgInput) containerBgInput.value = containerBg;
      const popupMain = document.getElementById("wheelluckContainer");
      if (popupMain && containerBg) {
        preserveBackgroundImage(popupMain, containerBg, 'backgroundColor');
      }
      const containerBgBox = document.getElementById('container_bg_color_box');
      if (containerBgBox && containerBg) {
        containerBgBox.style.setProperty('background', containerBg, 'important');
      }

      const resetSubmit = getPrimarySubmitFieldStyle(resetData) || resetData.text_styles?.submit_button || {};
      const buttonBg = getButtonBackground(resetSubmit);
      const hasResetGradient = isGradient(buttonBg);
      const buttonBgPicker = hasResetGradient
        ? resetSubmit.background || getGradientLastColor(buttonBg) || ''
        : buttonBg;

      const submit_button = getPrimarySubmitButtonElement();
      if (submit_button && (buttonBg || buttonBgPicker)) {
        if (hasResetGradient) {
          submit_button.style.setProperty('background', buttonBg, 'important');
        } else {
          submit_button.style.setProperty('background', buttonBgPicker, 'important');
        }
      }

      if (!this.theme.containerStyle) this.theme.containerStyle = {};
      if (containerBg) {
        this.theme.containerStyle.background = containerBg;
        delete this.theme.containerStyle['background-color'];
      }
      if (buttonBg) {
        this.popupManager.changeButtonBackgroundColor(buttonBg);
      }
    } else {
      const templateId = this.theme?.template || 101;
      let template = getTemplateById(templateId);
      if (!template) {
        template = getTemplateById(templateId);
      }
      if (!template) {
        template = getTemplateById(101);
      }
      
      if (template) {
        this._applyGameColorResetFromTemplate(template.gameColors);

        {
          const containerBg =
            containerStyleValue(template.containerStyle, 'background') || '';
          const submitTpl =
            getPrimarySubmitFieldStyle(template) || template.text_styles?.submit_button || {};
          const buttonBg = getButtonBackground(submitTpl);
          const hasGrad = isGradient(buttonBg);
          const buttonBgPicker = hasGrad
            ? submitTpl.background || getGradientLastColor(buttonBg) || ''
            : buttonBg;

          const containerBgInput = document.querySelector('input[name="container_bg_color"]');
          if (containerBgInput) containerBgInput.value = containerBg;
          const popupMain = document.getElementById("wheelluckContainer");
          if (popupMain && containerBg) {
            preserveBackgroundImage(popupMain, containerBg, 'backgroundColor');
          }
          const containerBgBox = document.getElementById('container_bg_color_box');
          if (containerBgBox && containerBg) {
            containerBgBox.style.setProperty('background', containerBg, 'important');
          }

          const submit_button = getPrimarySubmitButtonElement();
          if (submit_button && (buttonBg || buttonBgPicker)) {
            if (hasGrad) {
              submit_button.style.setProperty('background', buttonBg, 'important');
            } else {
              submit_button.style.setProperty('background', buttonBgPicker, 'important');
            }
          }

          if (!this.theme.containerStyle) this.theme.containerStyle = {};
          if (containerBg) {
            this.theme.containerStyle.background = containerBg;
            delete this.theme.containerStyle['background-color'];
          }
          if (buttonBg) {
            this.popupManager.changeButtonBackgroundColor(buttonBg);
          }
        }
        
        if (this.colorManager && typeof this.colorManager.updateTextColorsForAllViews === 'function') {
          this.colorManager.updateTextColorsForAllViews();
        }
      } else {
        const element = document.getElementById('katman_2');
        const texts = Array.from(document.getElementsByClassName("cls-3 wheelText"));
        const defaultColors = this.getCSSVariables();

        if (!defaultColors || Object.keys(defaultColors).length === 0) {
          console.warn('No CSS variables found for resetColors');
          return;
        }

        const colorMappings = {
          'slice_1_bg_color': '--slice-color-1',
          'slice_1_text_color': '--text-color',
          'slice_2_bg_color': '--slice-color-2',
          'slice_2_text_color': '--text-color',
          'slice_3_bg_color': '--slice-color-3',
          'slice_3_text_color': '--text-color',
          'slice_4_bg_color': '--slice-color-4',
          'slice_4_text_color': '--text-color',
          'circle_bg_color': '--background-color',
          'circle_text_color': '--secondary-color',
          'pin_bg_color': '--pin-color-1',
          'pin_text_color': '--pin-color-2',
        };

        if (element) {
          for (const [property, value] of Object.entries(defaultColors)) {
            element.style.setProperty(property, value);
          }
        }

        const pinEl =
          element?.querySelector?.('.wheel-pin-container') ||
          document.querySelector('.wheel-pin-container');
        if (pinEl) {
          for (const [property, value] of Object.entries(defaultColors)) {
            pinEl.style.setProperty(property, value);
          }
        }

        for (const [inputName, colorKey] of Object.entries(colorMappings)) {
          const input = document.querySelector(`input[name=${inputName}]`);
          if (input) {
            input.value = defaultColors[`${colorKey}`];
            const box = document.getElementById(`${inputName}_box`);
            if (box) {
              box.style.setProperty('background', defaultColors[`${colorKey}`], 'important');
            }
          }
        }
        
        if (this.colorManager && typeof this.colorManager.updateTextColorsForAllViews === 'function') {
          this.colorManager.updateTextColorsForAllViews();
        }

        document.querySelector('input[name="container_bg_color"]').value = '#c1d3e1';
        const popupMain = document.getElementById("wheelluckContainer");
        if (popupMain) {
          preserveBackgroundImage(popupMain, '#c1d3e1', 'backgroundColor');
        }
        
        const containerBgBox = document.getElementById('container_bg_color_box');
        if (containerBgBox) {
          containerBgBox.style.setProperty('background', '#c1d3e1', 'important');
        }

        const submit_button = getPrimarySubmitButtonElement();
        if (submit_button && !isUnifiedPopupShellTheme(this.theme)) {
          submit_button.style.backgroundColor = '#FC8289';
        }
      }
    }
  }
  
  resetTexts() {
    const unifiedShell = isUnifiedPopupShellTheme(this.theme);
    const hasBaselineTexts =
      this._textsResetBaseline &&
      ((this._textsResetBaseline.texts &&
        Object.keys(this._textsResetBaseline.texts).length > 0) ||
        (this._textsResetBaseline.text_styles &&
          Object.keys(this._textsResetBaseline.text_styles).length > 0));

    if (unifiedShell && hasBaselineTexts) {
      const baseline = JSON.parse(JSON.stringify(this._textsResetBaseline));
      this._applyTextsFromBaseline(baseline);
      this._applyThemeToDOM(this.theme);
      if (this.textEditorManager?.textEditorState?.currentInputName) {
        const currentInputName = this.textEditorManager.textEditorState.currentInputName;
        setTimeout(() => {
          this.textEditorManager.closeTextEditor();
          const inputElement = document.querySelector(
            `.texts-input-container input[name="${currentInputName}"], .texts-input-container textarea[name="${currentInputName}"]`
          );
          if (inputElement) {
            this.textEditorManager.openTextEditor(inputElement);
          }
        }, 250);
      }
      return;
    }

    let textsToApply = null;

    if (unifiedShell) {
      const resetData = this.getResetSource();
      if (resetData?.texts || resetData?.text_styles) {
        textsToApply = resetData.texts
          ? JSON.parse(JSON.stringify(resetData.texts))
          : {};
        if (resetData.text_styles && typeof resetData.text_styles === 'object') {
          textsToApply = {
            ...textsToApply,
            styles: JSON.parse(JSON.stringify(resetData.text_styles)),
          };
        }
      }
    } else {
      const templateId = this.theme?.template || 101;
      let template = getTemplateById(templateId);
      
      if (!template) {
        template = getTemplateById(101);
      }
      
      if (template) {
        textsToApply = template.texts || default_text;
        
        if (!template.texts && !unifiedShell) {
          textsToApply = JSON.parse(JSON.stringify(default_text));
          if (!this.theme.text_styles) this.theme.text_styles = {};
          if (this.theme.text_styles.headline) this.theme.text_styles.headline.color = '#ffffff';
          if (this.theme.text_styles.description) this.theme.text_styles.description.color = '#ffffff';
          if (this.theme.text_styles.disclaimer) this.theme.text_styles.disclaimer.color = '#ffffff';
          mergePrimaryCloseFormFieldStyle(this.theme, { color: '#ffffff' });
        } else if (textsToApply) {
          textsToApply = JSON.parse(JSON.stringify(textsToApply));
        }
      }
    }

    if (textsToApply) {
      applyTemplateTextsUtil(this.theme, textsToApply);
    }
    this._applyThemeToDOM(this.theme);

    if (this.textEditorManager?.textEditorState?.currentInputName) {
      const currentInputName = this.textEditorManager.textEditorState.currentInputName;
      setTimeout(() => {
        this.textEditorManager.closeTextEditor();
        const inputElement = document.querySelector(`.texts-input-container input[name="${currentInputName}"], .texts-input-container textarea[name="${currentInputName}"]`);
        if (inputElement) {
          this.textEditorManager.openTextEditor(inputElement);
        }
      }, 250);
    }
  }

  getCSSVariables() {
    const cssVariables = {};
    const styleSheets = document.styleSheets;

    for (let i = 0; i < styleSheets.length; i++) {
      let cssRules;

      try {
        cssRules = styleSheets[i].cssRules || styleSheets[i].rules;
      } catch (e) {
        continue;
      }

      for (let j = 0; j < cssRules.length; j++) {
        const rule = cssRules[j];

        if (rule.selectorText === '#katman_2') {
          const style = rule.style;

          for (let k = 0; k < style.length; k++) {
            const property = style[k];
            if (property.startsWith('--')) {
              cssVariables[property] = style.getPropertyValue(property).trim();
            }
          }

          return cssVariables;
        }
      }
    }

    return cssVariables;
  }

  getCSSVariablesFromSvg(svgContent) {
    const cssVariables = {};
    
    if (!svgContent) {
      return cssVariables;
    }

    const styleMatch = svgContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleMatch) {
      const styleContent = styleMatch[1];
      
      const varRegex = /--([\w-]+)\s*:\s*([^;]+)/g;
      let match;
      while ((match = varRegex.exec(styleContent)) !== null) {
        const varName = `--${match[1]}`;
        const varValue = match[2].trim().replace(/['"]/g, '');
        cssVariables[varName] = varValue;
      }
      
      const selectorRegex = /#(katman_2|cark)\s*\{([^}]+)\}/g;
      while ((match = selectorRegex.exec(styleContent)) !== null) {
        const selectorContent = match[2];
        const varRegex2 = /--([\w-]+)\s*:\s*([^;]+)/g;
        let match2;
        while ((match2 = varRegex2.exec(selectorContent)) !== null) {
          const varName = `--${match2[1]}`;
          const varValue = match2[2].trim().replace(/['"]/g, '');
          cssVariables[varName] = varValue;
        }
      }
    }
    
    return cssVariables;
  };

  _resetWheelPopupBg() {  
    document.querySelectorAll('#imageGallery .image-item').forEach((item) => item.classList.remove('selectedWheelBG'));

    const templateId = this.theme?.template;
    const template = templateId ? (getTemplateById(templateId)) : null;
    const templateBg = template?.background_image;
    const path = templateBg?.path || '';

    if (!this.theme.background_image) {
      this.theme.background_image = { path: '', style: '' };
    }
    this.theme.background_image.path = path;
    this.theme.background_image.style = templateBg?.style || '';
    this.resetBackground = !path;

    const popupMain = document.getElementById("wheelluckContainer");
    const imageManager = window.wheelApp?.imageManager;
    if (path && imageManager) {
      imageManager.setInitialBackground();
    } else {
      preserveBackgroundColor(popupMain, '');
    }
  }

  applyTemplate(templateName, changeTemplate = true) {
    return this.templateManager.applyTemplate(templateName, changeTemplate);
  }

  updateColorInput(inputName, value) {
    return this.colorManager.updateColorInput(inputName, value);
  }

  applyContainerAndButtonColors(templateColors, applyImmediately = false) {
    return this.colorManager.applyContainerAndButtonColors(templateColors, applyImmediately);
  }

  applySliceColors(templateColors) {
    return this.colorManager.applySliceColors(templateColors);
  }

  setColorsFromWheel(wheelSvg) {
    return this.colorManager.setColorsFromWheel(wheelSvg);
  }

  loadThemeColorsToInputs() {
    return this.colorManager.loadThemeColorsToInputs();
  }

  changeContainerBackgroundColor(value) {
    return this.popupManager.changeContainerBackgroundColor(value);
  }

  applyPopupPosition(position) {
    return this.popupManager.applyPopupPosition(position);
  }

  syncPresetPopupSize(size) {
    return this.popupManager.syncPresetPopupSize(size);
  }

  applyLightPopupGridPosition(gridPosition) {
    return this.popupManager.applyLightPopupGridPosition(gridPosition);
  }

  initPopupSettings(resetForNewTemplate = false) {
    return this.popupManager.initPopupSettings(resetForNewTemplate);
  }

  updatePopupPositionGrid(position, savedGridPosition = null) {
    return this.popupManager.updatePopupPositionGrid(position, savedGridPosition);
  }

  changeSliceColor(parameter, value) {
    return this.colorManager.changeSliceColor(parameter, value);
  }

  changePinColor(parameter, value) {
    return this.colorManager.changePinColor(parameter, value);
  }

  changeSliceTextColor(idx1, idx2, idx3, parameter, value) {
    return this.colorManager.changeSliceTextColor(idx1, idx2, idx3, parameter, value);
  }

  updateTextColorsForAllViews() {
    return this.colorManager.updateTextColorsForAllViews();
  }

  changeButtonBackgroundColor(value) {
    return this.popupManager.changeButtonBackgroundColor(value);
  }

  changeCountdownBackgroundColor(value) {
    return this.colorManager.changeCountdownBackgroundColor(value);
  }

  changeCountdownTextColor(value) {
    return this.colorManager.changeCountdownTextColor(value);
  }

  _syncOptionCheckbox(item, inputName) {
    const el = document.querySelector(`input[name="${inputName}"]`);
    if (el) el.checked = item.checked;
  }

  _setFlexVisible(el, visible) {
    if (!el) return;
    el.style.display = visible ? 'flex' : 'none';
  }

  changeSetSchedule(item) {
    this._syncOptionCheckbox(item, 'schedule_checkbox');
    const scheduleForm = document.querySelector('form[name="schedule_form"]');
    this._setFlexVisible(scheduleForm?.parentElement, item.checked);
  }

  changePreventDublicate(item) {
    this._syncOptionCheckbox(item, 'prevent_dublicate');
  }

  changeStartDelay(item) {
    this._syncOptionCheckbox(item, 'start_delay_active');
    const startDelayInput = document.querySelector('input[name="start_delay"]');
    this._setFlexVisible(startDelayInput?.parentElement, item.checked);
  }

  changeShowOnMobile(item) {
    this._syncOptionCheckbox(item, 'show_on_mobile');
  }

  /**
   * Countdown bölümünü veritabanı / yeni tema sistem varsayılanına döndürür (kaydetmeden önce formda kalır).
   */
  resetCountdownToSystemDefaults() {
    const d = COUNTDOWN_SYSTEM_DEFAULTS;
    if (!this.theme.countdown || typeof this.theme.countdown !== 'object') {
      this.theme.countdown = {};
    }
    this.theme.countdown.active = d.active;
    this.theme.countdown.valid_time = d.valid_time;
    if (!this.theme.countdown.colors || typeof this.theme.countdown.colors !== 'object') {
      this.theme.countdown.colors = {};
    }
    this.theme.countdown.colors.background = d.colors.background;
    this.theme.countdown.colors.text = d.colors.text;

    const countdownCb = document.querySelector('input[name="display_countdown_reminder"]');
    if (countdownCb) countdownCb.checked = d.active;

    const validTimeInput = document.querySelector('input[name="valid_time"]');
    if (validTimeInput) {
      validTimeInput.value = d.valid_time;
      validTimeInput.setCustomValidity('');
    }

    const bg = stripHexAlphaChannel(d.colors.background) || d.colors.background;
    const textCol = stripHexAlphaChannel(d.colors.text) || d.colors.text;

    this.colorManager.updateColorInputAndBox('countdown_bg_color', bg);
    this.colorManager.updateColorInputAndBox('countdown_text_color', textCol);
    this.colorManager.changeCountdownBackgroundColor(bg);
    this.colorManager.changeCountdownTextColor(textCol);

    const countdownInCouponCode = document.querySelector('.countDownWrapper .countdown');
    if (countdownInCouponCode) {
      countdownInCouponCode.style.display = d.active ? 'block' : 'none';
    }

    const countdownPanel = document.querySelector('.wheelCouponPanel');
    if (countdownPanel) {
      countdownPanel.style.backgroundColor = bg || '';
      countdownPanel.style.color = textCol || '';
    }

    if (d.active) {
      this._startCountdown(d.valid_time);
    }

    this.popupManager?.refreshCountdownPhonePreviewIfMounted?.();
  }

  changeDisplayCountdownReminder(item) {
    this._syncOptionCheckbox(item, 'display_countdown_reminder');

    this.theme.countdown.active = item.checked;
    
    const validTimeInput = document.querySelector('input[name="valid_time"]');
    const countdownInCouponCode = document.querySelector(
      ".countDownWrapper .countdown"
    );

    if (item.checked) {
      if (countdownInCouponCode) countdownInCouponCode.style.display = 'block';
      this._startCountdown(validTimeInput.value);
    } else {
      if (countdownInCouponCode) countdownInCouponCode.style.display = 'none';
    }
    this.popupManager?.refreshCountdownPhonePreviewIfMounted?.();
  }

  _collectColorValues(theme) {
    if (!theme.containerStyle) theme.containerStyle = {};
    const containerBgInput = document.querySelector('input[name="container_bg_color"]');
    const fromPicker =
      containerBgInput && containerBgInput.value != null ? String(containerBgInput.value).trim() : '';
    const fromTheme = containerStyleValue(this.theme?.containerStyle, 'background');
    const containerBg = fromPicker || fromTheme || '';
    theme.containerStyle.background = containerBg;
    delete theme.containerStyle['background-color'];
    if (this.theme) {
      if (!this.theme.containerStyle || typeof this.theme.containerStyle !== 'object') {
        this.theme.containerStyle = {};
      }
      this.theme.containerStyle.background = containerBg;
      delete this.theme.containerStyle['background-color'];
    }

    const countdownMappings = [
      ['countdown_bg_color', 'countdown.colors.background'],
      ['countdown_text_color', 'countdown.colors.text'],
    ];

    countdownMappings.forEach(([inputName, themePath]) => {
      const input = document.querySelector(`input[name="${inputName}"]`);
      if (input) {
        const pathParts = themePath.split('.');
        let current = theme;
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (!current[pathParts[i]]) {
            current[pathParts[i]] = {};
          }
          current = current[pathParts[i]];
        }
        current[pathParts[pathParts.length - 1]] = input.value;
      }
    });

    // Oyun paleti: yalnızca gameColors (CSS değişkenleri). Root `colors` objesi oluşturulmaz.
    const popupType = theme.popup_type || this.theme?.popup_type;
    const rawGid = this.theme?.gameID ?? theme.gameID;
    const hasGamePalette =
      popupType === 'gaming' || (rawGid != null && rawGid !== '');

    if (hasGamePalette) {
      const gameColorMappings = [
        ['slice_1_bg_color', '--slice-color-1'],
        ['slice_2_bg_color', '--slice-color-2'],
        ['slice_3_bg_color', '--slice-color-3'],
        ['slice_4_bg_color', '--slice-color-4'],
        ['slice_1_text_color', '--text-color-1'],
        ['slice_2_text_color', '--text-color-2'],
        ['slice_3_text_color', '--text-color-3'],
        ['slice_4_text_color', '--text-color-4'],
        ['circle_bg_color', '--background-color'],
        ['circle_text_color', '--secondary-color'],
        ['pin_bg_color', '--pin-color-1'],
        ['pin_text_color', '--pin-color-2'],
      ];

      gameColorMappings.forEach(([inputName, cssVar]) => {
        const input = document.querySelector(`input[name="${inputName}"]`);
        if (!input) return;
        const v = input.value;
        if (!theme.gameColors || typeof theme.gameColors !== 'object') {
          theme.gameColors = {};
        }
        theme.gameColors[cssVar] = v;
        if (this.theme) {
          if (!this.theme.gameColors || typeof this.theme.gameColors !== 'object') {
            this.theme.gameColors = {};
          }
          this.theme.gameColors[cssVar] = v;
        }
      });

      const gameAreaOpacityEl = document.getElementById('game_area_bg_opacity');
      if (gameAreaOpacityEl) {
        let pct = parseInt(gameAreaOpacityEl.value, 10);
        if (!Number.isFinite(pct)) pct = 100;
        pct = Math.min(100, Math.max(0, pct));
        const applyOp = (th) => {
          if (!th) return;
          if (!th.game_styles || typeof th.game_styles !== 'object') th.game_styles = {};
          if (pct >= 100) delete th.game_styles.gameOpacity;
          else th.game_styles.gameOpacity = pct;
          delete th.gameBackgroundOpacity;
        };
        applyOp(theme);
        applyOp(this.theme);
      }

      const gameAreaBgInput = document.querySelector('input[name="game_area_bg_color"]');
      if (gameAreaBgInput) {
        let raw = String(gameAreaBgInput.value || '').trim();
        if (raw && /linear-gradient|radial-gradient/i.test(raw)) {
          const solidGb = getGradientLastColor(raw);
          if (solidGb) raw = solidGb;
        }
        const applyBg = (th) => {
          if (!th) return;
          if (!th.game_styles || typeof th.game_styles !== 'object') th.game_styles = {};
          if (raw) {
            th.game_styles.gameBackground = raw;
          } else {
            delete th.game_styles.gameBackground;
          }
          delete th.gameBackground;
        };
        applyBg(theme);
        applyBg(this.theme);
      }
    }
  }

  /**
   * Ödül satırlarını (#gameRewardsContainer) DOM'dan okuyup theme.rewards olarak kaydeder.
   * `sliceText` = SVG .wheelText sınıfı (reward_sliceText_*).
   */
  _collectRewardsFromDom(theme) {
    const newRows = document.querySelectorAll('#gameRewardsContainer .reward-row');
    if (newRows.length === 0) {
      return;
    }

    const rewards = [];
    newRows.forEach((row, i) => {
      const labelInput = row.querySelector(`input[name="reward_label_${i}"]`);
      const codeInput = row.querySelector(`input[name="reward_code_${i}"]`);
      const weightInput = row.querySelector(`input[name="reward_weight_${i}"]`);
      const hasCheckbox = row.querySelector(`input[name="reward_has_${i}"]`);
      const sliceInput = row.querySelector(`input[name="reward_sliceText_${i}"]`);

      let label = labelInput ? (labelInput.value || '').trim() : '';
      label = truncateRewardLabel(label);
      if (labelInput && labelInput.value !== label) labelInput.value = label;
      const code = codeInput ? (codeInput.value || '').trim() : '';
      let weight = weightInput ? parseInt(weightInput.value, 10) : 0;
      if (Number.isNaN(weight) || weight < 0) weight = 0;
      if (weight > 100) weight = 100;
      if (weightInput) {
        const raw = String(weightInput.value ?? '').trim();
        if (raw === '' || Number.isNaN(parseInt(weightInput.value, 10))) {
          weightInput.value = String(weight);
        }
      }
      const hasReward = hasCheckbox ? hasCheckbox.checked : weight > 0;
      const sliceText = (sliceInput?.value || '').trim();

      rewards.push({ label, text: label, code, couponCode: code, weight, hasReward, sliceText });
    });

    theme.rewards = rewards;
    if (this.theme) {
      this.theme.rewards = JSON.parse(JSON.stringify(rewards));
    }
  }

  _collectFormFieldValues(theme) {
    theme.schedule = document.querySelector('input[name="schedule_checkbox"]')?.checked || false;
    theme.options.prevent_dublicate = document.querySelector('input[name="prevent_dublicate"]')?.checked || false;
    theme.options.show_on_mobile = document.querySelector('input[name="show_on_mobile"]')?.checked || false;
    theme.options.trigger_intent_leave = document.querySelector('input[name="trigger_intent_leave"]')?.checked || false;
    theme.options.trigger_scroll_down = document.querySelector('input[name="trigger_scroll_down"]')?.checked || false;
    theme.options.start_delay_active = document.querySelector('input[name="start_delay_active"]')?.checked || false;
    theme.options.start_delay = document.querySelector('input[name="start_delay"]')?.value || '';
    theme.options.specific_urls = document.querySelector('textarea[name="specific_urls"]')?.value || '';
    theme.options.specific_items = document.querySelector('textarea[name="specific_items"]')?.value || '';
    theme.options.smart_reward = document.querySelector('input[name="smart_reward"]')?.checked || false;
    theme.options.property_id = (document.querySelector('input[name="property_id"]')?.value || '').trim();
  }

  /** Consent artık yalnızca `input_fields`; DB payload'dan legacy options anahtarlarını at. */
  _stripLegacyConsentOptions(theme) {
    if (!theme || typeof theme !== 'object') return;
    if (theme.options && typeof theme.options === 'object') {
      delete theme.options.display_consent;
      delete theme.options.consent_link;
    }
    if (this.theme?.options && typeof this.theme.options === 'object') {
      delete this.theme.options.display_consent;
      delete this.theme.options.consent_link;
    }
  }

  _collectTextValues(theme) {
    const headlineEl = document.querySelector('input[name="headline"]');
    theme.texts.headline = headlineEl?.getAttribute('data-full-value') || headlineEl?.value || '';

    const descriptionEl = document.querySelector('textarea[name="description"]');
    theme.texts.description = descriptionEl?.getAttribute('data-full-value') || descriptionEl?.value || '';

    const disclaimerEl = document.querySelector('textarea[name="disclaimer"]');
    theme.texts.disclaimer = disclaimerEl?.getAttribute('data-full-value') || disclaimerEl?.value || '';

    if (theme.texts?.styles) {
      delete theme.texts.styles;
    }

    if (!theme.text_styles) {
      theme.text_styles = {};
    }
    if (this.theme.texts && this.theme.text_styles) {
      theme.text_styles = { ...this.theme.text_styles };
      delete theme.text_styles.submit_button;
    }

    theme.input_fields = this.getInputFieldsData();
    this._stripLegacyConsentOptions(theme);

    const submit_buttonEl = getPrimarySubmitButtonElement();
    if (submit_buttonEl) {
      const styleFromDom = {};
      const styleKeys = [
        "font-family",
        "font-size",
        "text-align",
        "font-weight",
        "font-style",
        "text-decoration",
        "line-height",
        "letter-spacing",
        "width",
        "height",
        "border-radius",
        "border",
        "box-shadow",
        "padding",
        "margin-top",
        "display",
        "cursor",
      ];
      // Yalnızca inline: computed ile padding/display/cursor vb. tema kirlenmesi oluyordu
      // (şablondaki minimal stil ile DB uyumsuzdu).
      styleKeys.forEach((cssKey) => {
        const inlineValue = submit_buttonEl.style.getPropertyValue(cssKey);
        const trimmed = inlineValue && String(inlineValue).trim();
        if (!trimmed) return;
        styleFromDom[cssKey] = trimmed;
      });
      // Arka plan / metin rengi: yine sadece inline (computed griye kayabiliyordu).
      const bgKeys = ['background', 'background-image', 'color'];
      bgKeys.forEach((cssKey) => {
        const inlineValue = submit_buttonEl.style.getPropertyValue(cssKey);
        const trimmed = inlineValue && String(inlineValue).trim();
        if (!trimmed) return;
        if (cssKey === 'background-image' && isCssPaintNone(trimmed)) return;
        styleFromDom[cssKey] = trimmed;
      });
      const legacyDomBg = submit_buttonEl.style.getPropertyValue('background-color');
      if (legacyDomBg && String(legacyDomBg).trim() && !styleFromDom.background) {
        styleFromDom.background = String(legacyDomBg).trim();
      }
      mergePrimarySubmitFieldStyle(theme, styleFromDom);
      const primarySubmit = getPrimarySubmitInputField(theme);
      if (primarySubmit?.style) {
        const junkImg = primarySubmit.style['background-image'] ?? primarySubmit.style.backgroundImage;
        if (isCssPaintNone(junkImg)) {
          delete primarySubmit.style['background-image'];
          delete primarySubmit.style.backgroundImage;
        }
        delete primarySubmit.style['background-color'];
        delete primarySubmit.style.backgroundColor;
      }
    }
  }

  _collectPopupSettings(theme) {
    theme.popup_settings = theme.popup_settings || {};
    const popupSettings = theme.popup_settings;

    const popupPositionRadio = document.querySelector('input[name="popup_position"]:checked');
    popupSettings.popup_position = popupPositionRadio ? popupPositionRadio.value : 'left';

    const popupPositionGridRadio = document.querySelector('input[name="popup_position_grid"]:checked');
    if (popupPositionGridRadio) {
      const gridPosition = popupPositionGridRadio.getAttribute('data-grid-position') || popupPositionGridRadio.value;
      popupSettings.popup_position_grid = gridPosition;
    }

    const popupSizeRadio = document.querySelector('input[name="popup_size"]:checked');
    if (popupSizeRadio) {
      popupSettings.popup_size = popupSizeRadio.value;
    }

    const widthInput = document.getElementById('popup_width');
    const heightInput = document.getElementById('popup_height');
    if (widthInput && heightInput) {
      const w = parseInt(widthInput.value, 10) || 560;
      const h = parseInt(heightInput.value, 10) || 530;
      const wPx = `${w}px`;
      const hPx = `${h}px`;
      popupSettings.popup_width = wPx;
      popupSettings.popup_height = hPx;
      if (!theme.containerStyle || typeof theme.containerStyle !== 'object') {
        theme.containerStyle = {};
      }
      theme.containerStyle.width = wPx;
      theme.containerStyle.height = hPx;
      if (this.theme) {
        if (!this.theme.containerStyle || typeof this.theme.containerStyle !== 'object') {
          this.theme.containerStyle = {};
        }
        this.theme.containerStyle.width = wPx;
        this.theme.containerStyle.height = hPx;
      }
    }

    const openingEffectSelect = document.getElementById('popup_opening_effect');
    if (openingEffectSelect && !openingEffectSelect.disabled) {
      popupSettings.popup_opening_effect = openingEffectSelect.value;
    } else {
      popupSettings.popup_opening_effect = 'fade_in_scale';
    }

    const openingEffectDuration = document.getElementById('popup_opening_effect_duration');
    if (openingEffectDuration && !openingEffectDuration.disabled) {
      popupSettings.popup_opening_effect_duration = parseInt(openingEffectDuration.value) || 700;
    } else {
      popupSettings.popup_opening_effect_duration = 700;
    }

    }

  _collectCountdownSettings(theme) {
    const countdownActiveInput = document.querySelector('input[name="display_countdown_reminder"]');
    const validTimeInput = document.querySelector('input[name="valid_time"]');
    
    if (countdownActiveInput) {
      theme.countdown.active = countdownActiveInput.checked;
    }
    if (validTimeInput) {
      const value = parseInt(validTimeInput.value, 10);
      if (value <= 0) {
        validTimeInput.value = 1;
        theme.countdown.valid_time = '1';
      } else {
        theme.countdown.valid_time = validTimeInput.value;
      }
    }
  }

  getThemeJson() {
    const themeInput = document.querySelector('input[name="theme"]');
    if (!themeInput) {
      console.error('Theme input field not found');
      return;
    }
    
    var theme = JSON.parse(JSON.stringify(this.theme));

    this._collectColorValues(theme);

    this._collectFormFieldValues(theme);
    this._collectTextValues(theme);
    this._collectPopupSettings(theme);
    this._collectCountdownSettings(theme);
    
    if (this.theme.input_fields_style) {
      theme.input_fields_style = { ...this.theme.input_fields_style };
    }
    
    if (this.theme.layout) {
      theme.layout = JSON.parse(JSON.stringify(this.theme.layout));
    }

    var templateId = this.theme.template || 101;
    theme.template = templateId;

    var template = getTemplateById(templateId);
    if (!template) {
      template = getTemplateById(templateId);
    }
    if (!template) {
      console.warn(`Template id=${templateId} not found, using default`);
      template = getTemplateById(101);
      if (!template) {
        template = { wheel: '', slotmachine: '', scratchcard: '', pin: '' };
      }
      templateId = 101;
      theme.template = 101;
    }

    // Save akışında nested alanlar bazen undefined gelebiliyor.
    // Kaydetmeden önce zorunlu obje yapısını garanti et.
    if (!theme.background_image || typeof theme.background_image !== 'object') {
      theme.background_image = { path: '', style: '' };
    }
    if (!theme.top_image || typeof theme.top_image !== 'object') {
      theme.top_image = { path: '', style: '', position: 'top' };
    }
    if (!theme.bottom_image || typeof theme.bottom_image !== 'object') {
      theme.bottom_image = { path: '', style: '' };
    }
    if (!theme.image || typeof theme.image !== 'object') {
      theme.image = { path: '', style: '', position: 'top' };
    }

    theme.popup_type = 'gaming';
    this.theme.popup_type = 'gaming';

    {
      var selectedImageElement = document.querySelector('.selectedWheelBG img');
      var selectedImageUrl = selectedImageElement ? selectedImageElement.src : '';

      if (this.resetBackground) {
        theme.background_image.path = '';
        theme.background_image.style = '';
      } else if (selectedImageUrl) {
        theme.background_image.path = selectedImageUrl;
      } else if (this.theme?.background_image?.path) {
        theme.background_image.path = this.theme.background_image.path;
      } else {
        theme.background_image.path = '';
      }
    }

    if (theme.popup_type === 'gaming' && theme.template === 101) {
      theme.top_image.path = '';
      theme.bottom_image.path = '';
    }

    {
        if (this.resetBackground) {
          theme.background_image.path = '';
          theme.background_image.style = '';
        } else if (this.theme?.background_image) {
          theme.background_image = JSON.parse(JSON.stringify(this.theme.background_image));
        } else {
          theme.background_image = { path: '', style: '' };
        }

        const imageManager = window.wheelApp?.imageManager;
        this.theme.layout = this.theme.layout || {};
        {
          const rawPos = imageManager?.getTopImagePosition?.() || '';
          const pNorm = String(rawPos).trim().toLowerCase();
          const pos = ['left', 'right', 'top'].includes(pNorm) ? pNorm : 'top';
          this.theme.layout.position = pos;
        }

        if (this.resetTopImage) {
          this.patchDecorativeImage({ path: '', style: '' });
        }

        const liveSnap = this.theme?.image || this.theme?.top_image || {
          path: '',
          style: '',
        };
        const decorativeOut = JSON.parse(JSON.stringify(liveSnap));
        delete decorativeOut.position;
        theme.top_image = decorativeOut;
        if (isUnifiedPopupShellTheme(this.theme)) {
          theme.image = JSON.parse(JSON.stringify(decorativeOut));
        }

        
        theme.bottom_image = { path: '', style: '' };

        const gameTypeSelect = document.getElementById('gameTypeSelect');
        const canonicalTemplate =
          getTemplateById(theme?.template) || template || {};
        const selectedGameType = gameTypeSelect && gameTypeSelect.value ? gameTypeSelect.value.trim() : '';
        /* Dropdown boş = kullanıcı oyunu kaldırdı; tema.gameID sızıntısıyla getGameTypeName / şablon varsayılanı yazma. */
        const gameSelectExplicitlyEmpty =
          Boolean(gameTypeSelect) && String(gameTypeSelect.value ?? '').trim() === '';

        let finalGameType = selectedGameType;
        if (!finalGameType && !gameSelectExplicitlyEmpty) {
          finalGameType = (getGameTypeName(this.theme) || '').trim();
        }
        if (!finalGameType && !gameSelectExplicitlyEmpty && resolveAllowedGame(canonicalTemplate)) {
          const tn = templateDefaultGameToTypeName(canonicalTemplate);
          if (tn) finalGameType = tn;
        }

        if (finalGameType && finalGameType !== '') {
          const heightFromTheme = getGameHeightStyle(imageManager?.theme || this.theme);
          const templateHeightStyle = String(
            canonicalTemplate?.game_styles?.game_svg_area || '',
          ).trim();

          const gameSvgHeightInput = document.getElementById('lightPopupGameSvgHeight');
          let heightPercent = 30;

          /* Önce UI slider, sonra kayıtlı tema; şablon yalnızca ikisi de yoksa. */
          const rawSlider = gameSvgHeightInput ? String(gameSvgHeightInput.value ?? '').trim() : '';
          if (rawSlider !== '') {
            const v = parseInt(rawSlider, 10);
            if (Number.isFinite(v)) heightPercent = v;
          } else if (heightFromTheme) {
            if (imageManager && typeof imageManager.extractHeightPercent === 'function') {
              heightPercent = imageManager.extractHeightPercent(heightFromTheme) || 30;
            } else {
              const match = heightFromTheme.match(/height:\s*([\d.]+)%/i);
              heightPercent = match ? parseFloat(match[1]) : 30;
            }
          } else if (templateHeightStyle) {
            const m = templateHeightStyle.match(/height:\s*([\d.]+)%/i);
            heightPercent = m ? parseFloat(m[1]) : 30;
          }

          let svgContent =
            getGameSvgString(imageManager?.theme || {}) ||
            getGameSvgString(this.theme) ||
            DefaultGameSvgs.getGameSvg(finalGameType);
          
          const gidLight = gameTypeNameToId(finalGameType) ?? 1;
          setGameTypeById(theme, gidLight);
          setGameTypeById(this.theme, gidLight);
          setGameSvgString(theme, svgContent);
          setGameSvgString(this.theme, svgContent);
          if (gameTypeSelect && finalGameType) {
            gameTypeSelect.value = finalGameType;
          }
          if (this.gameManager) {
            this.gameManager.currentView = finalGameType;
          }
          if (typeof window !== 'undefined') {
            window.currentView = finalGameType;
          }
          setGameHeightStyle(theme, `height: ${heightPercent}%`);
          setGameHeightStyle(this.theme, `height: ${heightPercent}%`);
          mergeLightGameDesktopStyleFromTemplate(theme, canonicalTemplate);
          const gpLightFromTheme = String(theme?.layout?.position || '').trim().toLowerCase();
          if (gpLightFromTheme === 'left' || gpLightFromTheme === 'right' || gpLightFromTheme === 'top') {
            theme.game_position = gpLightFromTheme;
            if (this.theme) this.theme.game_position = gpLightFromTheme;
          }
        } else {
          resetLightGameThemeCompletely(theme);
          if (this.theme) {
            resetLightGameThemeCompletely(this.theme);
          }
        }
    }

    if (theme.popup_type === 'gaming') {
      if (getGameTypeName(this.theme)) {
        const gameType = getGameTypeName(this.theme);
        let gameSvgContent = getGameSvgString(this.theme) || '';
        
        const gt = (gameType || '').toLowerCase();
        if (
          gameSvgContent &&
          ['wheel', 'slot', 'scratchcard', 'silverwheel'].includes(gt)
        ) {
          gameSvgContent = syncGameSvgWithRewardInputs(gameSvgContent);
        }

        setGameSvgString(theme, gameSvgContent);
      } else {
        setGameSvgString(theme, '');
      }

    }

    if (theme.popup_type === 'gaming') {
      const validTypes = this.gameManager?.validGameTypes || ['wheel', 'slot', 'scratchcard', 'silverwheel'];
      const gameTypeSelectEl = document.getElementById('gameTypeSelect');
      const fromSelect = (gameTypeSelectEl?.value || '').trim();
      const fromTheme = (getGameTypeName(this.theme) || '').trim();
      const defaultGameType = templateDefaultGameToTypeName(template) || 'wheel';

      let currentGameType = '';
      if (fromSelect && validTypes.includes(fromSelect)) {
        currentGameType = fromSelect;
      } else if (fromTheme && validTypes.includes(fromTheme)) {
        currentGameType = fromTheme;
      } else if (template?.hasGame !== false && defaultGameType && validTypes.includes(defaultGameType)) {
        currentGameType = defaultGameType;
      } else {
        currentGameType = 'wheel';
      }

      if (currentGameType && validTypes.includes(currentGameType)) {
        const gidG = gameTypeNameToId(currentGameType) ?? 1;
        setGameTypeById(theme, gidG);
        setGameHeightStyle(theme, '');

        let gameSvgContent = getGameSvgString(this.theme)?.trim() || '';

        if (!gameSvgContent) {
          const container =
            document.querySelector('.game-svg-container .game-svg-inner') ||
            document.querySelector('.game-svg-container');
          const svgElement = container?.querySelector('svg');
          if (svgElement) {
            gameSvgContent = svgElement.outerHTML;
          }
        }

        if (!gameSvgContent) {
          const tplKey = TEMPLATE_SVG_KEYS[currentGameType];
          const tplSvg = template?.[tplKey] || '';
          gameSvgContent = tplSvg || DefaultGameSvgs.getGameSvg();

          const cgt = (currentGameType || '').toLowerCase();
          if (['wheel', 'slot', 'scratchcard', 'silverwheel'].includes(cgt)) {
            gameSvgContent = syncGameSvgWithRewardInputs(gameSvgContent);
          }
        }

        setGameSvgString(theme, gameSvgContent);
        setGameTypeById(this.theme, gidG);
        setGameSvgString(this.theme, gameSvgContent);

        if (this.gameManager) {
          this.gameManager.currentView = currentGameType;
        }
        if (typeof window !== 'undefined') {
          window.currentView = currentGameType;
        }
        if (gameTypeSelectEl && validTypes.includes(currentGameType)) {
          gameTypeSelectEl.value = currentGameType;
        }

        const gpGamingFromTheme = String(theme?.layout?.position || '').trim().toLowerCase();
        if (gpGamingFromTheme === 'left' || gpGamingFromTheme === 'right' || gpGamingFromTheme === 'top') {
          theme.game_position = gpGamingFromTheme;
          if (this.theme) this.theme.game_position = gpGamingFromTheme;
        }
      }
    }

    // Oyun renklerini kayıttan hemen önce DOM’dan bir kez daha oku (state ile hizalı payload).
    const hasGameForFinalColorCollect = theme.popup_type === 'gaming';
    if (hasGameForFinalColorCollect) {
      this._collectColorValues(theme);
    }
    this._collectRewardsFromDom(theme);

    purgeLegacyThemeRootKeys(theme);
    purgeLegacyThemeRootKeys(this.theme);
    // New system: DB payload never stores desktop_style.
    delete theme.desktop_style;
    if (this.theme) delete this.theme.desktop_style;
    delete theme.text_styles?.submit_button;
    delete theme.button_style;

    // Close button'u sadece aktif tema state'inden kaydet.
    if (this.theme.close_button) {
      theme.close_button = JSON.parse(JSON.stringify(this.theme.close_button));
    }

    stripGameFieldsIfLightTemplateHasNoGame(theme);
    stripGameFieldsIfLightTemplateHasNoGame(this.theme);

    theme.hasGame = true;
    if (this.theme) this.theme.hasGame = true;

    // Payload'i fallback yerine aktif tema state'ine sabitle.
    theme.layout = JSON.parse(JSON.stringify(this.theme?.layout || theme.layout || {}));
    {
      const lp = String(theme?.layout?.position || '').trim().toLowerCase();
      if (lp === 'left' || lp === 'right' || lp === 'top') {
        theme.game_position = lp;
      }
    }
    theme.game_styles = JSON.parse(JSON.stringify(this.theme?.game_styles || theme.game_styles || {}));
    theme.content_styles = JSON.parse(JSON.stringify(this.theme?.content_styles || theme.content_styles || {}));
    theme.image_styles = JSON.parse(JSON.stringify(this.theme?.image_styles || theme.image_styles || {}));
    theme.background_image = JSON.parse(JSON.stringify(this.theme?.background_image || theme.background_image || { path: '', style: '' }));
    theme.image = JSON.parse(JSON.stringify(this.theme?.image || theme.image || { path: '', style: '' }));
    theme.top_image = JSON.parse(JSON.stringify(this.theme?.top_image || this.theme?.image || theme.top_image || { path: '', style: '' }));
    if (isUnifiedPopupShellTheme(theme)) {
      delete theme.image.position;
      delete theme.top_image.position;
    }
    theme.bottom_image = JSON.parse(JSON.stringify(this.theme?.bottom_image || theme.bottom_image || { path: '', style: '' }));

    // Kayıtta popup kabuğunun DOM anlık görüntüsü — preview/widget bu HTML'i doğrudan basar (yeniden ThemeManager ile kurulmaz).
    // Mobil önizlemede outerHTML, mobile-preview-mode ve sığdırma stilleri içerir; canonical kayıt masaüstü kabuğu olmalı.
    const wheelluckShell = document.getElementById('wheelluckContainer');
    const wasMobileViewForSnapshot = Boolean(this._isMobileView);
    if (wasMobileViewForSnapshot) {
      this._showDesktopView();
      if (wheelluckShell) {
        void wheelluckShell.offsetHeight;
      }
    }
    if (wheelluckShell) {
      try {
        const snapshot = wheelluckShell.outerHTML;
        theme.rendered_html = snapshot;
      } catch (e) {
        console.warn('[ThemeManager] wheelluckContainer snapshot failed', e);
      }
    }
    if (wasMobileViewForSnapshot) {
      this._showMobileView();
    }
    delete theme.rendered_popup_html;
    /* gameSVG yalnızca editör belleği; DB’de gameID + gameColors yeterli. */
    delete theme.gameSVG;

    const themeInputElement = document.querySelector('input[name="theme"]');
    if (themeInputElement) {
      themeInputElement.value = JSON.stringify(theme);
    } else {
      console.error('Theme input field not found');
    }
  }

  saveChanges() {
    const inputFields = this.getInputFieldsData();
    const primarySubmit = inputFields.find(
      (f) =>
        f &&
        (f.type === 'submit_button' || f.type === 'button') &&
        f.action === 'submit_form'
    );
    const submitText = (primarySubmit?.text || '').trim();
    if (!primarySubmit || !submitText) {
      toastr.error("Submit button text cannot be empty. Please enter a button text.");
      const inputAccordion = document.querySelector('.accordion-button[aria-controls="collapseInput"]');
      if (inputAccordion) inputAccordion.click();
      return;
    }
    
    if (this.theme.input_fields_style) {
      const themeInput = document.querySelector('input[name="theme"]');
      if (themeInput) {
        try {
          const theme = JSON.parse(themeInput.value);
          theme.input_fields_style = this.theme.input_fields_style;
          themeInput.value = JSON.stringify(theme);
        } catch (e) {
          console.error('Error saving input_fields_style:', e);
        }
      }
    }
    if (this.theme) {
      this.theme.input_fields = inputFields;
    }

    // Validate schedule fields if schedule is enabled
    const scheduleCheckbox = document.querySelector('input[name="schedule_checkbox"]');
    if (scheduleCheckbox && scheduleCheckbox.checked) {
      const startDate = document.querySelector('input[name="start_date"]')?.value;
      const startTime = document.querySelector('input[name="start_time"]')?.value;
      const endDate = document.querySelector('input[name="end_date"]')?.value;
      const endTime = document.querySelector('input[name="end_time"]')?.value;
      
      if (!startDate) {
        toastr.error("Start date is required when schedule is enabled.");
        return;
      }
      if (!startTime) {
        toastr.error("Start time is required when schedule is enabled.");
        return;
      }
      if (!endDate) {
        toastr.error("End date is required when schedule is enabled.");
        return;
      }
      if (!endTime) {
        toastr.error("End time is required when schedule is enabled.");
        return;
      }
    }

    const consentUrlErr = this.inputFieldsManager.validateConsentPolicyUrlForSave();
    if (consentUrlErr) {
      toastr.error(consentUrlErr.message);
      this.inputFieldsManager.focusConsentPolicyUrlError(consentUrlErr.message);
      return;
    }

    const rewardWeightTotal = this.gameManager.getManualRewardWeightsTotal();
    if (rewardWeightTotal !== null && rewardWeightTotal !== 100) {
      if (typeof toastr !== 'undefined' && typeof toastr.warning === 'function') {
        toastr.warning(
          `Total weight is ${rewardWeightTotal}%. Adjust the Weight (%) values so they add up to exactly 100%.`
        );
      }
      this.gameManager._openRewardsAccordion();
      return;
    }

    /* Önizleme + rendered_html snapshot, kayıtlı input_fields (policy_url dahil) ile aynı olsun. */
    this.renderInputFieldsInWidget(this.theme.input_fields || []);

    this.getThemeJson();

    var baseForm = document.querySelector('form[name="base_form"]');
    var scheduleForm = document.querySelector('form[name="schedule_form"]');

    var baseFormData = new FormData(baseForm);
    var scheduleFormData = new FormData(scheduleForm);

    const combinedFormData = new FormData();

    baseFormData.forEach((value, key) => {
      combinedFormData.append(key, value);
    });

    scheduleFormData.forEach((value, key) => {
      combinedFormData.append(key, value);
    });
    var promotion_id = baseForm.getAttribute("data-promotion_id");
    var url = `/promotion/${promotion_id}/edit`;

    fetch(url, {
      method: "POST",
      body: combinedFormData,
      headers: {
        "X-CSRFToken": document.querySelector('input[name="csrfmiddlewaretoken"]')
          .value,
      },
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error(
            `${response.status} ${response.statusText} ${response.url}`
          );
        }
      })
      .then((data) => {
        if (data.success) {
          try {
            const autoPid = window.__WHEELLUCK_AUTO_SNAPSHOT_PROMOTION_ID;
            if (autoPid) {
              sessionStorage.setItem(`wheelluck_rendered_snapshot_done_${autoPid}`, '1');
              window.__WHEELLUCK_AUTO_SNAPSHOT_PROMOTION_ID = null;
              const u = new URL(window.location.href);
              if (u.searchParams.has('template_id')) {
                u.searchParams.delete('template_id');
                const q = u.searchParams.toString();
                history.replaceState({}, '', q ? `${u.pathname}?${q}` : u.pathname);
              }
            }
          } catch (_) {}
          toastr.success("The changes saved successfully");
          
          setTimeout(() => {
            const themeInput = document.querySelector('input[name="theme"]');
            if (themeInput) {
              try {
                const savedTheme = JSON.parse(themeInput.value);
                migrateLegacyConsentIntoInputFields(savedTheme);
                this.loadInputFields(savedTheme.input_fields || []);
                this.renderInputFieldsInWidget(savedTheme.input_fields || []);
              } catch (e) {
                console.error('Error parsing theme after save:', e);
              }
            }
          }, 100);
        } else if (data.redirect_url) {
          try {
            window.__WHEELLUCK_AUTO_SNAPSHOT_PROMOTION_ID = null;
          } catch (_) {}
          toastr.error(data.message, null, {
            onHidden: function () {
              window.location.href = data.redirect_url;
            },
          });
        } else {
          try {
            window.__WHEELLUCK_AUTO_SNAPSHOT_PROMOTION_ID = null;
          } catch (_) {}
          if (!data.messages || !data.messages.length) {
            toastr.error("The changes could not save!");
          } else {
            for (var message of data.messages) {
              const errCode = message.code || "";
              if (
                errCode === "consent_policy_url_blank" ||
                errCode === "consent_policy_url_invalid"
              ) {
                toastr.error(message.error);
                this.inputFieldsManager.focusConsentPolicyUrlError(message.error);
                continue;
              }
              // "__all__" = Django'nun genel (field'e bağlı olmayan) hata anahtarı.
              if (message.field === "__all__") {
                toastr.error(message.error);
              } else {
                const niceField =
                  message.field && typeof message.field === "string"
                    ? message.field.charAt(0).toUpperCase() + message.field.slice(1)
                    : "Field";
                toastr.error(`"${niceField}" : ${message.error}`);
              }
            }
          }
        }
      })
      .catch((error) => {
        try {
          window.__WHEELLUCK_AUTO_SNAPSHOT_PROMOTION_ID = null;
        } catch (_) {}
        console.error('[ThemeManager] saveChanges failed:', error);
        toastr.error("The changes could not save!");
      });
  }


}

export { ThemeManager };

