import { getTemplateById, default_text, default_input_fields } from '../templates.js';
import { DefaultGameSvgs, getGameRecordById } from '../utils/game-svgs.js';
import {
  getGameSvgString,
  getGameTypeName,
  setGameSvgString,
  setGameTypeById,
  clearGameThemeLight,
  mergeGameColorsIntoSvgMarkup,
  gameColorsMatchRecord,
  reconcilePersistedGameSvgWithGameId,
  templateDefaultGameToTypeName,
  templateDefaultGameToId,
  resolveTemplateDefaultGameId,
} from '../utils/game-theme-utils.js';
import {
  applyStyleString,
  applyStyleObject,
  applyPopupBackgroundImage,
  applyGameAreaBackgroundFromTheme,
  mergeBackgroundImage,
  mergeDecorativeImage,
  normalizeThemeAssetUrl,
  isUnifiedPopupShellTheme,
  getCloseFormButtonElement,
  setSubmitWidgetText,
  sanitizeSvgTransforms,
} from '../utils/dom-utils.js';
import { syncGameSvgWithRewardInputs } from './game-manager.js';

export const TEMPLATE_SVG_KEYS = {
  wheel: 'wheel',
  silverwheel: 'wheel',
  slot: 'slotmachine',
  scratchcard: 'scratchcard',
};

/** Şablon SVG kök anahtarı — yalnızca gameID. */
const TEMPLATE_SVG_KEY_BY_ID = {
  1: 'wheel',
  2: 'slotmachine',
  3: 'scratchcard',
  4: 'wheel',
};

export const isWheelType = (type) => type === 'wheel' || type === 'silverwheel';

export function resolveLayoutPosition(theme, template) {
  const layoutPos = String(theme?.layout?.position || '').toLowerCase().trim();
  if (layoutPos === 'left' || layoutPos === 'right' || layoutPos === 'top') return layoutPos;
  const tplLayoutPos = String(template?.layout?.position || '').toLowerCase().trim();
  if (tplLayoutPos === 'left' || tplLayoutPos === 'right' || tplLayoutPos === 'top') return tplLayoutPos;
  const legacyImage = String(theme?.image?.position || template?.image?.position || '').toLowerCase().trim();
  if (legacyImage === 'left' || legacyImage === 'right' || legacyImage === 'top') return legacyImage;
  const layoutType = String(theme?.layout?.type || template?.layout?.type || '').toLowerCase().trim();
  if (layoutType === 'split-reverse') return 'right';
  if (layoutType === 'split') return 'left';
  return 'top';
}

function isWheelGameId(gid) {
  const parsed = Number(gid);
  const n = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  return n === 1 || n === 4;
}

/** gameID 1–4: SVG’de `.wheelText` + sliceText ile ödül DOM senkronu (syncGameSvgWithRewardInputs). */
function isGameWithRewardTextsId(gid) {
  const parsed = Number(gid);
  const n = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  return n != null && n >= 1 && n <= 4;
}
import {
  applyTextStyles,
  clearAllTextStyles,
  applyTemplateTexts,
  applyCurrentTextStylesToDOM,
  getInputFieldButtonText,
  getPrimarySubmitFieldStyle,
} from '../utils/text-utils.js';

export class TemplateManager {
  constructor(themeManager) {
    this.themeManager = themeManager;
    this.selectedTemplateValue = themeManager.selectedTemplateValue;
    this._lastApply = { templateId: null, changeTemplate: null, time: 0 };
  }

  get theme() {
    return this.themeManager.theme;
  }

  set theme(value) {
    this.themeManager.theme = value;
  }

  _cancelBackendImageApplication() {
    if (window?.wheelApp?.imageManager) {
      window.wheelApp.imageManager.cancelInitialTopImage();
    }
  }

  _resetTemplateChangingFlag() {
    setTimeout(() => {
      if (window?.wheelApp?.imageManager) {
        window.wheelApp.imageManager.resetTemplateChangingFlag();
      }
    }, 300);
  }

  /**
   * Change theme sonrası şablonun varsayılan oyunu (defaultGame) ve önizlemeyi senkronlar.
   */
  _syncGameFromTemplateAfterChange(template) {
    if (!template || !this.themeManager?.gameManager) return;
    const gm = this.themeManager.gameManager;
    const theme = this.theme;
    if (template.hasGame === false) {
      if (typeof gm.syncAfterNoGameTemplate === 'function') {
        gm.syncAfterNoGameTemplate();
      }
      gm.updateGameControlsVisibility?.();
      return;
    }
    const unified = theme.popup_type === 'gaming';
    if (!unified) {
      let gid = templateDefaultGameToId(template);
      if (gid == null) gid = 1;
      gm.changeGameType(gid, { skipPreviewUpdate: false, updateDOM: true });
      gm.updateGameControlsVisibility?.();
      return;
    }

    if (theme.hasGame === false) {
      if (typeof gm.syncAfterNoGameTemplate === 'function') {
        gm.syncAfterNoGameTemplate();
      }
      gm.updateGameControlsVisibility?.();
      return;
    }

    const rawThemeGameId = Number(theme.gameID);
    let gid = Number.isInteger(rawThemeGameId) && rawThemeGameId > 0 ? rawThemeGameId : null;
    if (gid == null) {
      gid = templateDefaultGameToId(template);
      if (gid != null) setGameTypeById(theme, gid);
    }
    if (gid == null) {
      gm.updateGameControlsVisibility?.();
      return;
    }
    if (typeof gm.applyGameSvgWithType === 'function') {
      const typeName = getGameRecordById(gid)?.name || '';
      if (gm.gameTypeSelect && typeName) gm.gameTypeSelect.value = typeName;
      gm.applyGameSvgWithType(gid, false);
    }
    if (theme.popup_type === 'gaming' && typeof gm._loadInitialRewards === 'function') {
      gm._loadInitialRewards();
    }
    gm.updateGameControlsVisibility?.();
  }

  _getLightPopupShellEl() {
    return document.getElementById('wheelluckContainer');
  }

  _setImagePositionRadio(position) {
    if (!window?.wheelApp?.imageManager) {
      return;
    }
    const imageManager = window.wheelApp.imageManager;
    const positionValue = position || 'top';
    
    if (imageManager.topImagePositionRadios && imageManager.topImagePositionRadios.length > 0) {
      const positionRadio = Array.from(imageManager.topImagePositionRadios).find(r => r.value === positionValue);
      if (positionRadio) {
        positionRadio.checked = true;
      } else {
        const topRadio = Array.from(imageManager.topImagePositionRadios).find(r => r.value === 'top');
        if (topRadio) {
          topRadio.checked = true;
        }
      }
    }
  }

  applyTemplate(templateId, changeTemplate = true) {
    const now = Date.now();
    if (
      this._lastApply.templateId === templateId &&
      this._lastApply.changeTemplate === changeTemplate &&
      now - this._lastApply.time < 150
    ) {
      return;
    }
    this._lastApply = { templateId, changeTemplate, time: now };

    let template = getTemplateById(templateId);

    const theme = this.theme;

    if (changeTemplate) {
      theme.background_image = template.background_image
        ? JSON.parse(JSON.stringify(template.background_image))
        : { path: '', style: '' };
    }

    theme.popup_type = template.popup_type;

    if (changeTemplate) {
      if (template.hasGame !== undefined) {
        theme.hasGame = template.hasGame;
      } else if (
        (template.defaultGame != null && template.defaultGame !== '') ||
        template.wheel ||
        template.slotmachine ||
        template.scratchcard
      ) {
        theme.hasGame = true;
      }
      if (template.defaultGame !== undefined) {
        theme.defaultGame = template.defaultGame;
      } else if (template.hasGame === false) {
        delete theme.defaultGame;
      }
      theme.hasGame = true;
    }

    const accordion = document.getElementById('accordionExample');
    accordion.setAttribute('data-popup-type', theme.popup_type);
    const layoutType = template?.layout?.type || theme?.layout?.type || '';
    accordion.setAttribute('data-layout-type', layoutType);


    if (changeTemplate) {
      theme.texts = theme.texts || {};
      theme.text_styles = template.text_styles
        ? JSON.parse(JSON.stringify(template.text_styles))
        : {};
    }

    theme.template = templateId;
    this.themeManager.selectedTemplateValue = templateId;
    this.selectedTemplateValue = templateId;
    const templateNameDisplay = document.querySelector('.template-name-display');
    if (templateNameDisplay) {
      const rawName = String(template?.name || '').trim();
      templateNameDisplay.textContent = rawName
        ? rawName
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ')
        : 'Template';
    }

    if (changeTemplate) {
      clearAllTextStyles();
    }

    this.applyPopup(template, templateId, changeTemplate);

    this.themeManager.initPopupSettings(changeTemplate);

    if (changeTemplate) {
      this._syncGameFromTemplateAfterChange(template);
      if (typeof this.themeManager?._loadColorInputs === 'function') {
        this.themeManager._loadColorInputs(this.theme);
      }
      applyGameAreaBackgroundFromTheme(this.theme);
    }

    if (changeTemplate && this.themeManager?._updateGameColorsResetBaselineFromCurrentTheme) {
      this.themeManager._updateGameColorsResetBaselineFromCurrentTheme();
      this.themeManager._updateGameSvgTextResetBaselineFromCurrentTheme();
      this.themeManager._updateTextsResetBaselineFromCurrentTheme();
      setTimeout(() => {
        this.themeManager._updateGameColorsResetBaselineFromCurrentTheme();
        this.themeManager._updateGameSvgTextResetBaselineFromCurrentTheme();
        this.themeManager._updateTextsResetBaselineFromCurrentTheme();
      }, 250);
    }

    if (window?.wheelApp?.imageManager) {
      window.wheelApp.imageManager.theme = theme;
      window.wheelApp.imageManager.popupType = theme?.popup_type || window.wheelApp.imageManager.popupType;
      window.wheelApp.imageManager.updateTopControlsVisibility();
    }

    setTimeout(() => {
      if (theme) {
        const inputFields = theme.input_fields || [];
        this.themeManager.loadInputFields(inputFields);
        this.themeManager.renderInputFieldsInWidget(inputFields);
      }
    }, 400);
  }

  getCommonDOMElements() {
    return {
    
      wheelluckContainer:document.querySelector('#wheelluckContainer') ,
      contentWrapper: document.querySelector(".contentWrapper"),
      wheelluckContent: document.querySelector("#wheelluckContent"),
      wheelluckContentInner: document.querySelector("#wheelluckContentInner"),
      gameSvgContainer: document.querySelector(".game-svg-container"),
      gameSvgInner: document.querySelector(".game-svg-inner"),
      close_link: isUnifiedPopupShellTheme(this.theme)
        ? getCloseFormButtonElement()
        : document.querySelector('#close_link'),
    };
  }

  /**
   * Birleşik kabukta üst görsel kabuğu yoksa oluşturur (tema path sonradan / galeri).
   * Bucket + img meta şablon/tema ile burada tek yerde uygulanır.
   */
  ensureUnifiedImageContainer(sceneTemplate = null, imageMeta = null) {
    if (!isUnifiedPopupShellTheme(this.theme)) return null;
    const root = document.getElementById('wheelluckContainer');
    const contentWrapper = root?.querySelector('.contentWrapper');
    const wheelluckContent = document.getElementById('wheelluckContent');
    if (!contentWrapper || !wheelluckContent) return null;

    const existing =
      root.querySelector('.image-container.wheelluckImage') ||
      root.querySelector('.image-container');
    if (existing?.isConnected) return existing;

    const template =
      sceneTemplate ||
      getTemplateById(this.theme?.template) ||
      null;
    const meta = imageMeta ?? this.theme?.image ?? this.theme?.top_image ?? {};
    const activePosition = resolveLayoutPosition(this.theme, template);

    const wheelluckImage = document.createElement('div');
    wheelluckImage.className = 'image-container wheelluckImage';
    const wheelluckImageInner = document.createElement('div');
    wheelluckImageInner.className = 'wheelluckImageInner';
    const topImageEl = document.createElement('img');
    topImageEl.className = 'top-image';
    topImageEl.alt = '';
    wheelluckImageInner.appendChild(topImageEl);
    wheelluckImage.appendChild(wheelluckImageInner);
    contentWrapper.insertBefore(wheelluckImage, wheelluckContent);

    const bucketImageStyle =
      this.theme?.image_styles?.[activePosition]?.image ||
      template?.image_styles?.[activePosition]?.image;
    const bucketImageInnerStyle =
      this.theme?.image_styles?.[activePosition]?.image_inner ||
      template?.image_styles?.[activePosition]?.image_inner;
    if (bucketImageStyle) applyStyleString(wheelluckImage, bucketImageStyle);
    if (bucketImageInnerStyle) applyStyleString(wheelluckImageInner, bucketImageInnerStyle);

    const tplImg = template?.image;
    const imgStyle = meta.style || tplImg?.style;
    if (imgStyle) applyStyleString(topImageEl, imgStyle);
    if (activePosition === 'left' || activePosition === 'right' || activePosition === 'top') {
      topImageEl.setAttribute('data-position', activePosition);
    }

    return wheelluckImage;
  }

  _createWheelluckContainer(template) {
    const popupContainer = document.getElementById('popupContainer');

    const container = document.createElement('div');
    container.id = 'wheelluckContainer';
    popupContainer.appendChild(container);

    const popupType = this.theme?.popup_type || 'gaming';
    container.classList.add(`${popupType}-popup-mode`);

    const containerStyle = this.theme?.containerStyle || template?.containerStyle;

    applyStyleObject(container, containerStyle);

    const bgImage = mergeBackgroundImage(this.theme, template);
    if (bgImage && (bgImage.path || bgImage.style)) {
      applyPopupBackgroundImage(container, bgImage);
    }
  }

  _createWheelluckPartials(template) {
    const root = document.getElementById('wheelluckContainer');

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'contentWrapper';
    root.appendChild(contentWrapper);
  
 
    const wheelluckContent = document.createElement('div');
    wheelluckContent.id = 'wheelluckContent';
    contentWrapper.appendChild(wheelluckContent);

    const contentInner = document.createElement('div');
    contentInner.id = 'wheelluckContentInner';
    const activePosition = resolveLayoutPosition(this.theme, template);
    const shellImageData = this.theme?.image || this.theme?.top_image;
    const hasTopImagePath = String(shellImageData?.path || '').trim();
    const bucketContentInnerStyle =
      this.theme?.content_styles?.[activePosition]?.content_inner ||
      template?.content_styles?.[activePosition]?.content_inner;
    applyStyleString(
      contentInner,
      bucketContentInnerStyle ||
        'margin: 0; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 18px;'
    );
    wheelluckContent.appendChild(contentInner);

    if (hasTopImagePath) {
      this.ensureUnifiedImageContainer(template, shellImageData);
    }

    const texts = template?.texts || this.theme?.texts || {};
    const inputFieldsForButtons =
      this.theme?.input_fields || template?.input_fields || [];

    Object.keys(texts).forEach(field => {
      if (field === 'styles' || field === 'submit_button' || field === 'close_link') return;

      const el = document.createElement('div');
      el.id = field;
      el.innerHTML = String(texts[field] ?? '').replace(/\n/g, '<br>');
      contentInner.appendChild(el);
    });

    const wheelLeads = document.createElement('div');
    wheelLeads.id = 'wheelLeads';
    wheelLeads.className = '';
    applyStyleString(wheelLeads, 'width: 100%; max-width: 100%;');
    contentInner.appendChild(wheelLeads);

    const fields = document.createElement('div');
    fields.id = 'wheelLeadsFields';
    fields.className = '';
    wheelLeads.appendChild(fields);

    const additionalFields = document.createElement('div');
    additionalFields.id = 'additionalInputFields';
    additionalFields.className = 'additional-input-fields';
    applyStyleString(
      additionalFields,
      'display: flex; flex-direction: column; align-items: stretch; width: 100%; max-width: 100%; box-sizing: border-box;'
    );
    fields.appendChild(additionalFields);

    const toast = document.createElement('div');
    toast.className = 'wheelToast';
    applyStyleString(toast, 'left: 50%; transform: translate(-50%, 0%);');
    const onSpan = document.createElement('span');
    onSpan.id = 'wheelButtonOn';
    toast.appendChild(onSpan);
    wheelLeads.appendChild(toast);

    // Light / gaming: kapat metni yalnızca #additionalInputFields içindeki close_form butonunda.
    if (!isUnifiedPopupShellTheme(this.theme)) {
      const closeEl = document.createElement('div');
      closeEl.id = 'close_link';
      const closeText = document.createElement('span');
      closeText.className = 'text';
      closeText.textContent =
        getInputFieldButtonText({ input_fields: inputFieldsForButtons }, 'close_form') ||
        '';
      closeEl.appendChild(closeText);
      contentInner.appendChild(closeEl);
    }

    const closeButton = this.theme?.close_button || template?.close_button;
    if (closeButton) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'close_button';
      btn.innerHTML = '&times;';
      if (closeButton.style) {
        applyStyleString(btn, closeButton.style);
      }
      contentWrapper.appendChild(btn);
    }

    const bucketContentWrapperStyle =
      this.theme?.content_styles?.[activePosition]?.content_wrapper ||
      template?.content_styles?.[activePosition]?.content_wrapper;
    const bucketContentStyle =
      this.theme?.content_styles?.[activePosition]?.content ||
      template?.content_styles?.[activePosition]?.content;

    if (bucketContentWrapperStyle) {
      applyStyleString(contentWrapper, bucketContentWrapperStyle);
    }
    contentWrapper.style.setProperty('position', 'relative', 'important');
    contentWrapper.style.setProperty('z-index', '1', 'important');

    const bgImage = mergeBackgroundImage(this.theme, template);
    if (bgImage && (bgImage.path || bgImage.style)) {
      applyPopupBackgroundImage(root, bgImage);
    }
    if (bucketContentStyle) {
      applyStyleString(wheelluckContent, bucketContentStyle);
    }
  }

  _applyTemplateTexts(texts) {
    applyTemplateTexts(this.theme, texts);
  }

  _applyCurrentTextStylesToDOM() {
    applyCurrentTextStylesToDOM(this.theme);
  }

  renderGame(gameIdRaw, options = {}) {
    const {
      loadDefaults = false,
      applyRewards = true,
      applyColors = false,
      customSvg = '',
      /** Birleşik kabuk: `applyGameSvgWithType` `.game-svg-inner` doldurur; çift yazmayı önlemek için. */
      writeLuckywheel = true,
    } = options;

    const parsedRawGid = Number(gameIdRaw);
    const parsedThemeGid = Number(this.theme?.gameID);
    const gid =
      (Number.isInteger(parsedRawGid) && parsedRawGid > 0 ? parsedRawGid : null) ??
      (Number.isInteger(parsedThemeGid) && parsedThemeGid > 0 ? parsedThemeGid : null) ??
      1;

    const templateId = this.theme.template || 101;
    let template = null;
    if (templateId !== 101) {
      template = getTemplateById(templateId);
    }

    const parsedThemeGid2 = Number(this.theme?.gameID);
    const themeGid = Number.isInteger(parsedThemeGid2) && parsedThemeGid2 > 0 ? parsedThemeGid2 : null;
    const typesAligned = themeGid == null || themeGid === gid;

    let svgContent = '';

    if (customSvg && customSvg.trim()) {
      svgContent = customSvg;
    } else if (typesAligned && getGameSvgString(this.theme).trim()) {
      reconcilePersistedGameSvgWithGameId(this.theme);
      svgContent = getGameSvgString(this.theme).trim();
    } else if (template && typesAligned) {
      const tplKey = TEMPLATE_SVG_KEY_BY_ID[gid];
      if (tplKey && template[tplKey]) {
        svgContent = template[tplKey];
      }
    }

    if (!svgContent || svgContent.trim() === '' || loadDefaults) {
      const gameData = DefaultGameSvgs.getGameById(gid);
      svgContent = gameData.svg || '';
    }

    if (applyRewards && isGameWithRewardTextsId(gid) && svgContent) {
      svgContent = syncGameSvgWithRewardInputs(svgContent);
    }

    let gc = this.theme?.gameColors;
    if (!gc || typeof gc !== 'object' || Object.keys(gc).length === 0) {
      const gameRec = DefaultGameSvgs.getGameById(gid);
      if (gameRec?.gameColors && Object.keys(gameRec.gameColors).length > 0) {
        gc = gameRec.gameColors;
      } else {
        const tplMeta =
          template ||
          (this.theme.template != null && this.theme.template !== 101
            ? getTemplateById(this.theme.template)
            : null);
        if (tplMeta?.gameColors && Object.keys(tplMeta.gameColors).length > 0) {
          gc = tplMeta.gameColors;
        }
      }
    }
    let svgForDom =
      gc && typeof gc === 'object' && Object.keys(gc).length > 0
        ? mergeGameColorsIntoSvgMarkup(svgContent, gc)
        : svgContent;

    svgForDom = sanitizeSvgTransforms(svgForDom);

    if (writeLuckywheel) {
      const outer = document.querySelector('.game-svg-container');
      let inner = outer?.querySelector('.game-svg-inner');
      if (outer && svgForDom && svgForDom.trim()) {
        if (!inner) {
          inner = document.createElement('div');
          inner.className = 'game-svg-inner';
          outer.appendChild(inner);
        }
        try {
          inner.innerHTML = svgForDom;
          const mountedSvg = inner.querySelector('svg');
          if (!mountedSvg) {
            console.warn('[renderGame] SVG element not found after mount, gid:', gid);
          }
        } catch (e) {
          console.warn('[renderGame] SVG mount failed, gid:', gid, e);
        }
      }
    }

    setGameSvgString(this.theme, svgContent);
    setGameTypeById(this.theme, gid);

    if (applyColors) {
      if (isWheelGameId(gid)) {
        const wheelSvgForColors = template?.wheel || svgContent;
        this.themeManager.colorManager.setColorsFromWheel(wheelSvgForColors);
      } else {
        this.themeManager.colorManager.loadThemeColorsToInputs();
        this.themeManager.colorManager.applyCurrentColors();
      }
    }

    if (gid === 2 && svgContent && typeof this.themeManager.attachSlotLiveHandlers === 'function') {
      this.themeManager.attachSlotLiveHandlers();
    }

    return svgContent;
  }

  _clearGameSvg() {
    if (window?.wheelApp?.imageManager?.gameManager) {
      window.wheelApp.imageManager.gameManager.removeGameSvg();
    }
      clearGameThemeLight(this.theme);
      const gameTypeSelect = document.getElementById('gameTypeSelect');
      if (gameTypeSelect) {
        gameTypeSelect.value = '';
    }
  }
  
  _renderPopup(template) {
    if (!template) {
      return;
    }
    const popupContainer = document.getElementById('popupContainer');
    const existingShell = document.getElementById('wheelluckContainer');
    if (popupContainer && existingShell) {
      existingShell.remove();
    }
    this._createWheelluckContainer(template);
    this._createWheelluckPartials(template);
  }
  
  
  _parseTemplateStyles(template) {
    const styles = {
      backgroundImage: {},
      button: {},
      inputFields: {},
      closeButton: {},
      texts: {}
    };

    if (template.background_image?.style) {
      styles.backgroundImage = this._parseStyleString(template.background_image.style);
    }

    if (template.input_fields_style) {
      styles.inputFields = { ...template.input_fields_style };
    }

    if (template.close_button?.style) {
      styles.closeButton = this._parseStyleString(template.close_button.style);
    }

    if (template.text_styles) {
      styles.texts = template.text_styles;
    }
    
    return styles;
  }

  _parseStyleString(styleString) {
    const styles = {};
    if (!styleString) return styles;
    
    const declarations = styleString.split(';').filter(s => s.trim());
    declarations.forEach(decl => {
      const [property, value] = decl.split(':').map(s => s.trim());
      if (property && value) {
        const camelProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        styles[camelProperty] = value;
      }
    });
    
    return styles;
  }

  _camelize(str) {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  _capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  _clearLightPopupElements() {
    const elements = [
      '.wheelluck-decor-layer',
      '.image-container',
      '.top-image',
      '.bottom-image',
      '.game-svg-container'
    ];
    
    elements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    const wheelluckRoot = document.querySelector('#wheelluckContainer');
    if (wheelluckRoot) {
      wheelluckRoot.classList.remove('has-top-image');
      wheelluckRoot.classList.remove('has-game-svg');
    }

    const wheelPopupMain = this._getLightPopupShellEl();
    if (wheelPopupMain) {
      wheelPopupMain.style.removeProperty('--top-image-height');
    }
  }

  _renderTopImage(topImageData) {
    if (!topImageData || !String(topImageData.path || '').trim()) {
      return;
    }
    
    setTimeout(() => {
      if (window?.wheelApp?.imageManager) {
        const imageManager = window.wheelApp.imageManager;
        
        let imagePath = topImageData.path || '';
        if (imagePath && !imagePath.startsWith('/') && !imagePath.startsWith('http')) {
          imagePath = '/' + imagePath;
        }
        
        imageManager.theme = this.theme;
        imageManager.popupType = this.theme?.popup_type || 'gaming';

        const merged = JSON.parse(JSON.stringify(topImageData));
        if (imagePath) merged.path = imagePath;
        this.themeManager.patchDecorativeImage({
          path: String(merged.path || '').trim(),
          style: merged.style || '',
        });

        const radioPos = String(
          this.theme?.layout?.position || topImageData.position || ''
        )
          .trim()
          .toLowerCase();
        if (radioPos === 'left' || radioPos === 'right' || radioPos === 'top') {
          this._setImagePositionRadio(radioPos);
        }
        
        const sizePercent = imageManager.extractHeightPercent(topImageData.style) || imageManager.topImageDefaultHeight || 30;
        imageManager.applyTopImage(imagePath, sizePercent);
      }
    }, 100);
  }

  _renderText(type, text, textStyles, spacing) {
    const elementMap = {
      headline: '#headline',
      description: '#description',
      disclaimer: '#disclaimer'
    };
    
    let element = document.querySelector(elementMap[type]);
    
    if (!element) {
      const contentWrapper = document.querySelector('.contentWrapper');
      if (!contentWrapper) return;
      
      element = document.createElement('div');
      element.id = elementMap[type].replace('#', '');
      contentWrapper.appendChild(element);
    }
    if (
      element.id === 'submit_button' ||
      element.classList.contains('submit-button') ||
      element.classList.contains('submit-button-widget')
    ) {
      element.textContent = text;
    } else if (textStyles?.htmlContent) {
      let htmlContent = textStyles.htmlContent;
      if (typeof htmlContent === 'string') {
        htmlContent = htmlContent.replace(/\n/g, '<br>');
      }
      element.innerHTML = htmlContent;
    } else {
      element.textContent = text;
    }
    
    if (textStyles) {
      applyTextStyles(element, textStyles);
    }
    if (spacing) {
      element.style.setProperty('margin-top', spacing, 'important');
    }
  }

  _renderButton(text, textStyles, buttonStyle, spacing, changeTemplate = false) {
    let button =
      document.querySelector('#additionalInputFields .submit-button-widget[data-action="submit_form"]') ||
      document.querySelector('#additionalInputFields .submit-button-widget') ||
      document.getElementById('submit_button');
    
    if (!button) {
      const contentWrapper = document.querySelector('.contentWrapper');
      if (!contentWrapper) return;
      
      button = document.createElement('button');
      button.id = 'submit_button';
      button.type = 'button';
      button.className = 'submit-button-widget';
      contentWrapper.appendChild(button);
    }

    const buttonText =
      text ||
      getInputFieldButtonText(this.theme, 'submit_form') ||
      this.theme?.texts?.submit_button ||
      '';
    button.textContent = buttonText;

    button.style.cssText = '';

    if (changeTemplate && textStyles) {
      applyStyleObject(button, textStyles, { important: true, exclude: ['htmlContent', 'alignment'] });

      const themeStyles = getPrimarySubmitFieldStyle(this.theme) || {};
      Object.keys(themeStyles).forEach(key => {
        const value = themeStyles[key];
        const cssKey = key.includes('-') ? key : key.replace(/([A-Z])/g, '-$1').toLowerCase();
        if (!textStyles[key] && !textStyles[cssKey] && value !== undefined && value !== null && value !== '' && key !== 'htmlContent') {
          button.style.setProperty(cssKey, String(value).trim(), 'important');
        }
      });
    } else {
      const stylesToApply = textStyles || getPrimarySubmitFieldStyle(this.theme);

      if (stylesToApply) {
        applyStyleObject(button, stylesToApply, { important: true, exclude: ['htmlContent', 'alignment'] });
      }
    }

    const theme = this.theme;
    const submitStyles = getPrimarySubmitFieldStyle(theme) || {};

    let buttonBackgroundColor = submitStyles.background;
    if (buttonBackgroundColor?.startsWith('#') && buttonBackgroundColor.length === 9) {
      buttonBackgroundColor = buttonBackgroundColor.substring(0, 7);
    }

    if (buttonBackgroundColor) {
      button.style.setProperty('background', buttonBackgroundColor, 'important');
    }

    let buttonTextColor = submitStyles.color;
    if (buttonTextColor?.startsWith('#') && buttonTextColor.length === 9) {
      buttonTextColor = buttonTextColor.substring(0, 7);
    }
    if (buttonTextColor) {
      button.style.setProperty('color', buttonTextColor, 'important');
    }

    if (!submitStyles.cursor) {
      button.style.setProperty('cursor', 'pointer', 'important');
    }

    const unnecessaryStyles = ['object-fit', 'object-position', 'background-position', 'background-size', 'background-repeat', 'background-attachment', 'background-origin', 'background-clip'];
    unnecessaryStyles.forEach(style => {
      if (!submitStyles[style]) {
        button.style.removeProperty(style);
      }
    });

    if (spacing) {
      button.style.setProperty('margin-top', spacing, 'important');
    }
  }

  _renderCloseLink(text, textStyles, spacing) {
    if (isUnifiedPopupShellTheme(this.theme)) {
      const closeBtn = getCloseFormButtonElement();
      if (!closeBtn) return;
      if (text != null) setSubmitWidgetText(closeBtn, text);
      if (textStyles) applyTextStyles(closeBtn, textStyles);
      if (spacing) closeBtn.style.setProperty('margin-top', spacing, 'important');
      return;
    }

    let closeElement = document.querySelector('#close_link .text') || document.getElementById('close_link');
    if (!closeElement) {
      const contentWrapper = document.querySelector('.contentWrapper');
      if (!contentWrapper) return;
      
      const closeContainer = document.createElement('div');
      closeContainer.id = 'close_link';
      closeElement = document.createElement('span');
      closeElement.classList.add('text');
      closeContainer.appendChild(closeElement);
      contentWrapper.appendChild(closeContainer);
    }

    if (textStyles?.htmlContent) {
      closeElement.innerHTML = textStyles.htmlContent;
    } else {
      closeElement.textContent = text;
    }
    
    if (textStyles) {
      applyTextStyles(closeElement, textStyles);
    }
    const hasPositionInTheme = textStyles && (textStyles.position != null && String(textStyles.position).trim() !== '');
    if (!hasPositionInTheme) {
      ['position', 'top', 'right', 'left', 'bottom', 'z-index'].forEach((p) => {
        closeElement.style.removeProperty(p);
      });
    }
    
    if (spacing) {
      closeElement.style.setProperty('margin-top', spacing, 'important');
    }
  }
  
  _renderCloseButton(closeButtonConfig) {
    if (!closeButtonConfig) {
      return;
    }
    const popupMain = this._getLightPopupShellEl();
    if (!popupMain) {
      return;
    }
    
    const closeRoot = document.getElementById('wheelluckContainer');
    if (closeRoot) {
      const allCloseButtons = closeRoot.querySelectorAll('.template-close-button, .close-button-wrapper');
      allCloseButtons.forEach(btn => btn.remove());
    }

    const contentWrapper = document.querySelector('.contentWrapper');
    const container = contentWrapper || popupMain;

    const closeButtonWrapper = document.createElement('div');
    closeButtonWrapper.className = 'close-button-wrapper';
    applyStyleString(closeButtonWrapper, 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 1000;');

    if (container.firstChild) {
      container.insertBefore(closeButtonWrapper, container.firstChild);
    } else {
      container.appendChild(closeButtonWrapper);
    }

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'template-close-button';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.innerHTML = '×';
    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (closeRoot) {
        applyStyleString(closeRoot, 'display: none; visibility: hidden; opacity: 0;');
      }
    });
    closeButtonWrapper.appendChild(closeButton);

    if (closeButtonConfig?.style) {
      applyStyleString(closeButton, closeButtonConfig.style + '; pointer-events: auto;');
    } else {
      applyStyleString(closeButton, 'position: absolute; top: 15px; right: 15px; width: 36px; height: 36px; background: rgba(80,80,80,0.7); border-radius: 50%; color: #ffffff; font-size: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 1000; pointer-events: auto;');
    }
  }

  _renderBackgroundImage(backgroundImageData, styles) {
    const popupMain = this._getLightPopupShellEl();
    if (!popupMain) return;
    
    if (backgroundImageData.path) {
      let bgStyles = [`background-image: url("${backgroundImageData.path}") !important`];

      if (backgroundImageData.style) {
        const styleDeclarations = backgroundImageData.style.split(';').filter(s => s.trim());
        styleDeclarations.forEach(decl => {
          const [property, value] = decl.split(':').map(s => s.trim());
          if (property && value) {
            const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
            if (cssProperty.includes('background')) {
              bgStyles.push(`${cssProperty}: ${value} !important`);
            }
          }
        });
      } else {
        bgStyles.push('background-size: cover !important');
        bgStyles.push('background-repeat: no-repeat !important');
        bgStyles.push('background-position: center center !important');
      }

      if (styles) {
        Object.keys(styles).forEach(key => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          bgStyles.push(`background-${cssKey}: ${styles[key]} !important`);
        });
      }
      
      popupMain.style.cssText = bgStyles.join('; ') + ';';
    }
  }

  _renderInputFields(inputFields, inputFieldsStyle) {
    if (this.themeManager && this.themeManager.inputFieldsManager) {
      this.theme.input_fields = JSON.parse(JSON.stringify(inputFields));
      if (inputFieldsStyle && Object.keys(inputFieldsStyle).length > 0) {
        this.theme.input_fields_style = { ...inputFieldsStyle };
      } else {
        delete this.theme.input_fields_style;
      }

      setTimeout(() => {
        if (this.themeManager) {
          this.themeManager.loadInputFields(this.theme.input_fields);
        }
      }, 100);
    }
  }
  

  /**
   * Popup sablonundaki gameID / gameColors tema JSON'a islenir.
   * overwrite: şablon değişiminde şablondaki değerler kullanılır; aksi halde yalnızca eksik alanlar doldurulur.
   */
  _applyTemplateGameDefaults(theme, template, overwrite) {
    if (!template || template.hasGame === false) return;
    /* Kayıtta oyun kaldırıldıysa (hasGame: false) şablon gameID ile tema ezilmesin. */
    if (theme.hasGame === false) return;
    const tplGc =
      template.gameColors &&
      typeof template.gameColors === 'object' &&
      Object.keys(template.gameColors).length > 0;
    const tplId = template.gameID != null && template.gameID !== '';

    if (overwrite) {
      if (tplId) theme.gameID = template.gameID;
      if (tplGc) theme.gameColors = JSON.parse(JSON.stringify(template.gameColors));
      return;
    }
    if (tplId && (theme.gameID == null || theme.gameID === '')) {
      theme.gameID = template.gameID;
    }
    if (tplGc) {
      const cur = theme.gameColors || {};
      const empty = typeof cur !== 'object' || Object.keys(cur).length === 0;
      const rec = getGameRecordById(theme.gameID ?? 1);
      const sameAsEngineDefault =
        rec?.gameColors && gameColorsMatchRecord(cur, rec.gameColors);
      if (empty || sameAsEngineDefault) {
        theme.gameColors = JSON.parse(JSON.stringify(template.gameColors));
      }
    }
  }

  applyPopup(template, _templateName, changeTemplate = true) {
    const theme = this.theme;

    if (changeTemplate) {
      this._cancelBackendImageApplication();
      const tmgr = this.themeManager;
      if (tmgr._suppressNoGameLayoutClearTimeout) {
        clearTimeout(tmgr._suppressNoGameLayoutClearTimeout);
        tmgr._suppressNoGameLayoutClearTimeout = null;
      }
      tmgr._suppressNoGameLayoutMutations = true;
      // Template change: backendten tasinan legacy style alanlarini temizle.
      delete theme.desktop_style;

      const pick =
        template.image && (String(template.image.path || '').trim() || template.image.style)
          ? template.image
          : template.top_image &&
              (String(template.top_image.path || '').trim() || template.top_image.style)
            ? template.top_image
            : null;
      if (pick) {
        const c = JSON.parse(JSON.stringify(pick));
        this.themeManager.patchDecorativeImage({
          path: String(c.path || '').trim(),
          style: c.style || '',
        });
      } else {
        this.themeManager.patchDecorativeImage({ path: '', style: '' });
      }

      if (template.bottom_image) {
        theme.bottom_image = JSON.parse(JSON.stringify(template.bottom_image));
      } else {
        theme.bottom_image = { path: '', style: '' };
      }

      if (template.containerStyle) {
        theme.containerStyle = JSON.parse(JSON.stringify(template.containerStyle));
      }
      if (template.layout) {
        theme.layout = JSON.parse(JSON.stringify(template.layout));
      }
      if (template.close_button) {
        theme.close_button = JSON.parse(JSON.stringify(template.close_button));
      }
      if (template.game_styles && typeof template.game_styles === 'object') {
        theme.game_styles = JSON.parse(JSON.stringify(template.game_styles));
      } else {
        theme.game_styles = {};
      }
      if (template.gameBackground != null && String(template.gameBackground).trim() !== '') {
        if (!theme.game_styles || typeof theme.game_styles !== 'object') {
          theme.game_styles = {};
        }
        if (!Object.prototype.hasOwnProperty.call(theme.game_styles, 'gameBackground')) {
          theme.game_styles.gameBackground = String(template.gameBackground).trim();
        }
      } else if (changeTemplate) {
        if (theme.game_styles && typeof theme.game_styles === 'object') {
          const tplGsBg = template?.game_styles;
          if (
            !tplGsBg ||
            typeof tplGsBg !== 'object' ||
            !Object.prototype.hasOwnProperty.call(tplGsBg, 'gameBackground')
          ) {
            delete theme.game_styles.gameBackground;
          }
        }
      }
      delete theme.gameBackground;
      delete theme.gameBackgroundOpacity;
      if (changeTemplate && theme.game_styles && typeof theme.game_styles === 'object') {
        const tplGs = template?.game_styles;
        if (
          !tplGs ||
          typeof tplGs !== 'object' ||
          !Object.prototype.hasOwnProperty.call(tplGs, 'gameOpacity')
        ) {
          delete theme.game_styles.gameOpacity;
        }
      }
      if (template.content_styles) {
        theme.content_styles = JSON.parse(JSON.stringify(template.content_styles));
      }
      if (template.image_styles) {
        theme.image_styles = JSON.parse(JSON.stringify(template.image_styles));
      }

      if (Array.isArray(template.input_fields)) {
        theme.input_fields = JSON.parse(JSON.stringify(template.input_fields));
      } else {
        theme.input_fields = JSON.parse(JSON.stringify(default_input_fields || []));
      }
      if (template.input_fields_style) {
        theme.input_fields_style = JSON.parse(JSON.stringify(template.input_fields_style));
      } else {
        delete theme.input_fields_style;
      }
    }

    if (changeTemplate && template?.hasGame === false) {
      theme.gameID = null;
      theme.gameSVG = '';
      if (theme.game_styles) {
        theme.game_styles.game_svg_area = '';
      }
    } else if (template?.hasGame !== false) {
      this._applyTemplateGameDefaults(theme, template, !!changeTemplate);
    }

    if (changeTemplate && template.game_styles) {
      const pos = String(theme?.layout?.position || '').trim().toLowerCase();
      if (pos === 'left' || pos === 'right' || pos === 'top') {
        theme.game_position = pos;
      }
    }

    const shellMissing =
      typeof document === 'undefined' || !document.getElementById('wheelluckContainer');
    // changeTemplate === false: yalnızca metin / tema alanları güncellenir; kabuğu yıkmak
    // .game-svg-container ve SVG'yi siler (partial HTML oyun alanı oluşturmaz).
    if (changeTemplate || shellMissing) {
      this._renderPopup(template);
    }

    if (changeTemplate && template.texts) {
      this._applyTemplateTexts(template.texts);
    } else {
      this._applyCurrentTextStylesToDOM();
    }

    const imageData = theme?.image || template?.image;
    const hasTopImagePath = imageData?.path && String(imageData.path).trim();
    if (hasTopImagePath) {
      this._renderTopImage(imageData);
    } else if (changeTemplate) {
      window?.wheelApp?.imageManager?.clearTopImageDOM?.();
    }

    if (changeTemplate) {
      if (this.themeManager?.inputFieldsManager) {
        setTimeout(() => {
          this.themeManager.loadInputFields(theme.input_fields);
          this.themeManager.inputFieldsManager.initCommonInputFieldStylePickers();
          this.themeManager.inputFieldsManager.renderInputFieldsInWidget(theme.input_fields);
        }, 150);
      }

      this._resetTemplateChangingFlag();
      const tmgr = this.themeManager;
      tmgr._suppressNoGameLayoutClearTimeout = setTimeout(() => {
        tmgr._suppressNoGameLayoutMutations = false;
        tmgr._suppressNoGameLayoutClearTimeout = null;
      }, 450);
    }

    const tplForDecor = template || getTemplateById(this.theme?.template);
    if (this.theme?.popup_type === 'gaming' && tplForDecor) {
      this._renderDecorativeBandImages(tplForDecor);
    }
  }

  /**
   * Gaming: şablondaki dekoratif üst/alt görseller — `.contentWrapper` içinde arka planda (pointer-events: none).
   * `path` yoksa img oluşturulmaz; tema JSON'daki stil korunur.
   */
  _renderDecorativeBandImages(template) {
    const theme = this.theme;
    if (!theme || theme.popup_type !== 'gaming' || typeof document === 'undefined') return;

    const contentWrapper = document.querySelector('.contentWrapper');
    if (!contentWrapper) return;

    let layer = contentWrapper.querySelector(':scope > .wheelluck-decor-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'wheelluck-decor-layer';
      layer.setAttribute('aria-hidden', 'true');
      contentWrapper.insertBefore(layer, contentWrapper.firstChild);
    }
    layer.innerHTML = '';

    const topMerge = mergeDecorativeImage(theme, template, 'top_image');
    const bottomMerge = mergeDecorativeImage(theme, template, 'bottom_image');

    const appendDecorImg = (className, merged) => {
      if (!merged || !String(merged.path || '').trim()) return;
      const img = document.createElement('img');
      img.className = className;
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      img.src = normalizeThemeAssetUrl(merged.path);
      if (merged.style) applyStyleString(img, merged.style);
      layer.appendChild(img);
    };

    appendDecorImg('decor-top-image', topMerge);
    appendDecorImg('decor-bottom-image', bottomMerge);
  }

}



