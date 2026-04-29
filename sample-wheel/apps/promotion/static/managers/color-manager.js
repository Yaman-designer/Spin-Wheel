import {
  containerStyleValue,
  applyGameAreaBackgroundFromTheme,
  resolveGameAreaBackgroundCss,
} from '../utils/dom-utils.js';
import { setupPicker } from '../utils/picker-utils.js';
import {
  getGradientLastColor,
  stripHexAlphaChannel,
  normalizeGameBackgroundOpacityPercent,
} from '../utils/color-utils.js';

/** Picker düz renk modunda kalsın: gradient ise son duraktan tek hex üret. */
function solidGameAreaBackgroundForPicker(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/linear-gradient|radial-gradient/i.test(s)) {
    return getGradientLastColor(s) || s;
  }
  return s;
}

function resolveGameAreaBackgroundPickerSeed(theme) {
  return solidGameAreaBackgroundForPicker(resolveGameAreaBackgroundCss(theme));
}

export function ensureCountdownColorStructure(theme) {
  if (!theme || typeof theme !== 'object') return;
  if (!theme.countdown) {
    theme.countdown = { colors: { background: '', text: '' } };
  }
  if (!theme.countdown.colors) {
    theme.countdown.colors = { background: '', text: '' };
  }
}

/**
 * Tüm renk picker satırlarını tek yerden kurar (ThemeManager + ColorManager).
 * @param {{ popupManager?: { changeContainerBackgroundColor?: Function } }} [options]
 */
export function installPromotionColorPickers(theme, colorManager, options = {}) {
  ensureCountdownColorStructure(theme);
  const popupManager = options.popupManager ?? colorManager.themeManager?.popupManager;

  const containerBgRaw = containerStyleValue(theme.containerStyle, 'background') || '';
  const containerBg = stripHexAlphaChannel(containerBgRaw);

  const svg =
    typeof colorManager.findActiveSvg === 'function' ? colorManager.findActiveSvg() : null;
  const cssVar = (name) => (svg ? getComputedStyle(svg).getPropertyValue(name).trim() : '');

  const gameAreaBgSeed = resolveGameAreaBackgroundPickerSeed(theme);

  const pickers = [
    [
      'container_bg_color_box',
      'container_bg_color',
      containerBg,
      '#wheelluckContainer',
      'background',
      (color) => popupManager?.changeContainerBackgroundColor?.(color),
    ],
    [
      'game_area_bg_color_box',
      'game_area_bg_color',
      gameAreaBgSeed,
      '.game-svg-container',
      'background',
      (color) => colorManager.changeGameAreaBackgroundColor(color),
    ],
    [
      'slice_1_bg_color_box',
      'slice_1_bg_color',
      cssVar('--slice-color-1'),
      null,
      null,
      (color) => colorManager.changeSliceColor('--slice-color-1', color),
    ],
    [
      'slice_1_text_color_box',
      'slice_1_text_color',
      cssVar('--text-color'),
      null,
      null,
      (color) => colorManager.changeSliceTextColor(0, 10, 8, '--text-color', color),
    ],
    [
      'slice_2_bg_color_box',
      'slice_2_bg_color',
      cssVar('--slice-color-2'),
      null,
      null,
      (color) => colorManager.changeSliceColor('--slice-color-2', color),
    ],
    [
      'slice_2_text_color_box',
      'slice_2_text_color',
      cssVar('--text-color'),
      null,
      null,
      (color) => colorManager.changeSliceTextColor(1, 3, 5, '--text-color', color),
    ],
    [
      'slice_3_bg_color_box',
      'slice_3_bg_color',
      cssVar('--slice-color-3'),
      null,
      null,
      (color) => colorManager.changeSliceColor('--slice-color-3', color),
    ],
    [
      'slice_3_text_color_box',
      'slice_3_text_color',
      cssVar('--text-color'),
      null,
      null,
      (color) => colorManager.changeSliceTextColor(11, 9, 7, '--text-color', color),
    ],
    [
      'slice_4_bg_color_box',
      'slice_4_bg_color',
      cssVar('--slice-color-4'),
      null,
      null,
      (color) => colorManager.changeSliceColor('--slice-color-4', color),
    ],
    [
      'slice_4_text_color_box',
      'slice_4_text_color',
      cssVar('--text-color'),
      null,
      null,
      (color) => colorManager.changeSliceTextColor(2, 4, 6, '--text-color', color),
    ],
    [
      'circle_bg_color_box',
      'circle_bg_color',
      cssVar('--background-color'),
      null,
      null,
      (color) => colorManager.changeSliceColor('--background-color', color),
    ],
    [
      'circle_text_color_box',
      'circle_text_color',
      cssVar('--secondary-color'),
      null,
      null,
      (color) => colorManager.changeSliceColor('--secondary-color', color),
    ],
    [
      'pin_bg_color_box',
      'pin_bg_color',
      cssVar('--pin-color-1'),
      null,
      null,
      (color) => colorManager.changePinColor('--pin-color-1', color),
    ],
    [
      'pin_text_color_box',
      'pin_text_color',
      cssVar('--pin-color-2'),
      null,
      null,
      (color) => colorManager.changePinColor('--pin-color-2', color),
    ],
    [
      'countdown_bg_color_box',
      'countdown_bg_color',
      theme.countdown.colors.background || '',
      null,
      null,
      (color) => colorManager.changeCountdownBackgroundColor(color),
    ],
    [
      'countdown_text_color_box',
      'countdown_text_color',
      theme.countdown.colors.text || '',
      null,
      null,
      (color) => colorManager.changeCountdownTextColor(color),
    ],
  ];

  pickers.forEach((args) => setupPicker(...args));
}

export class ColorManager {
  constructor(themeManager) {
    this.themeManager = themeManager;

    // Dilim metin renkleri burada yok: hepsi aynı --text-color değişkenine yazılınca
    // syncColorsFromInputs son girişle tüm çark metnini bozuyordu. Renkler changeSliceTextColor ile (inline fill) uygulanır.
    this.colorMappings = {
      'slice_1_bg_color': '--slice-color-1',
      'slice_2_bg_color': '--slice-color-2',
      'slice_3_bg_color': '--slice-color-3',
      'slice_4_bg_color': '--slice-color-4',
      'circle_bg_color': '--background-color',
      'circle_text_color': '--secondary-color',
      'pin_bg_color': '--pin-color-1',
      'pin_text_color': '--pin-color-2',
    };
  }

  get theme() {
    return this.themeManager.theme;
  }

  set theme(value) {
    this.themeManager.theme = value;
  }

  findActiveSvg() {
    let svg = document.getElementById('katman_2');
    
    if (!svg) {
      const gameContainer = document.querySelector('.game-svg-container');
      if (gameContainer) {
        svg = gameContainer.querySelector('svg') || gameContainer.querySelector('svg#cark');
      }
    }
    
    return svg;
  }
  
  findTextElements() {
    const gamingTexts = Array.from(document.getElementsByClassName("cls-3 wheelText"));
    if (gamingTexts.length > 0) {
      return gamingTexts;
    }
    
    const lightTexts = Array.from(
      document.querySelectorAll('.game-svg-container .wheelText, .game-svg-container text')
    );
    return lightTexts;
  }
  
  applyColorToSvg(cssVariable, value) {
    const svg = this.findActiveSvg();
    if (!svg) {
      return false;
    }
    
    svg.style.setProperty(cssVariable, value);
    return true;
  }

  _setThemeGameColor(cssVariable, value) {
    if (!cssVariable) return;
    const targets = [this.theme, this.themeManager?.theme];
    targets.forEach((t) => {
      if (!t) return;
      if (!t.gameColors || typeof t.gameColors !== 'object') {
        t.gameColors = {};
      }
      t.gameColors[cssVariable] = value;
    });
  }
  
  applyColorsToSvg(colorMap) {
    const svg = this.findActiveSvg();
    if (!svg) {
      return false;
    }

    const skipRootTextVars = new Set([
      '--text-color',
      '--text-color-1',
      '--text-color-2',
      '--text-color-3',
      '--text-color-4',
    ]);

    Object.entries(colorMap).forEach(([cssVariable, value]) => {
      if (value && !skipRootTextVars.has(cssVariable)) {
        svg.style.setProperty(cssVariable, value);
      }
    });

    return true;
  }
  
  
  updateColorInputAndBox(inputName, value) {
    const input = document.querySelector(`input[name="${inputName}"]`);
    const box = document.getElementById(`${inputName}_box`);
    
    if (!input || !box) {
      return;
    }
    
    input.value = value;
    
    if (value) {
      box.style.setProperty('background', value, 'important');
    } else {
      box.style.removeProperty('background');
    }
    
    if (box.picker) {
      try {
        // Gradient ise 2. renk referansimiz olacak diger beyaz sabit kalacak, değilse direkt kullan
        const colorToSet = (value && (value.includes('linear-gradient') || value.includes('radial-gradient'))) 
          ? (getGradientLastColor(value) || value) 
          : value;
        box.picker.setColor(colorToSet, false);
      } catch(e) {
      }
    }
    
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  syncColorsFromInputs() {
    const svg = this.findActiveSvg();
    if (!svg) {
      this.updateTextColorsForAllViews();
      return;
    }
    
    Object.entries(this.colorMappings).forEach(([inputName, cssVariable]) => {
      const input = document.querySelector(`input[name="${inputName}"]`);
      if (input && input.value) {
        svg.style.setProperty(cssVariable, input.value);
      }
    });
    
    this.updateTextColorsForAllViews();
  }
  
  syncColorsToInputs(colorMap = null) {
    if (colorMap) {
      Object.entries(this.colorMappings).forEach(([inputName, cssVariable]) => {
        if (colorMap[cssVariable]) {
          this.updateColorInputAndBox(inputName, colorMap[cssVariable]);
        }
      });
      const legacy = colorMap['--text-color'];
      const pairs = [
        ['slice_1_text_color', '--text-color-1'],
        ['slice_2_text_color', '--text-color-2'],
        ['slice_3_text_color', '--text-color-3'],
        ['slice_4_text_color', '--text-color-4'],
      ];
      pairs.forEach(([inputName, key]) => {
        const v = colorMap[key] || legacy;
        if (v) {
          this.updateColorInputAndBox(inputName, v);
        }
      });
      return;
    }
    
    const svg = this.findActiveSvg();
    if (!svg) {
      return;
    }
    
    const computedStyle = window.getComputedStyle(svg);
    Object.entries(this.colorMappings).forEach(([inputName, cssVariable]) => {
      const value = computedStyle.getPropertyValue(cssVariable).trim();
      if (value) {
        this.updateColorInputAndBox(inputName, value);
      }
    });
  }

  initPickers(theme = this.theme) {
    installPromotionColorPickers(theme, this, {
      popupManager: this.themeManager?.popupManager,
    });
  }

  updateColorControlsVisibility() {
    const isScratch = (window.currentView || 'wheel').toLowerCase() === 'scratchcard';

    const rowAnchors = ['circle_bg_color_box', 'pin_bg_color_box'];
    rowAnchors.forEach((anchorId) => {
      const anchor = document.getElementById(anchorId);
      if (!anchor) return;
      const row = anchor.closest('.row');
      if (row) {
        row.style.display = isScratch ? 'none' : '';
      }
    });
  }

  applyCurrentColors() {
    this.syncColorsFromInputs();
  }

  ensureThemeColorsStructure() {
    if (!this.theme.containerStyle) {
      this.theme.containerStyle = {};
    }
    if (!this.theme.text_styles) {
      this.theme.text_styles = {};
    }
  }
  
  _applyFillToText(textElement, value) {
    if (!textElement) return;
    textElement.setAttribute('fill', value);
    textElement.style.setProperty('fill', value, 'important');
  }

  updateColorInput(inputName, value) {
    this.updateColorInputAndBox(inputName, value);
  }

  applyContainerAndButtonColors(templateColors, applyImmediately = false) {
    if (!templateColors) return;
    
    this.ensureThemeColorsStructure();
    
    const rgbToHex = (rgb) => {
      if (!rgb) return '';
      const trimmedRgb = String(rgb).trim();
      if (trimmedRgb.includes('linear-gradient') || trimmedRgb.includes('radial-gradient') || trimmedRgb.includes('url(')) {
        return trimmedRgb;
      }
      
      const rgbMatch = trimmedRgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        return '#' + [r, g, b].map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('');
      }
      return trimmedRgb.startsWith('#') ? trimmedRgb : rgb;
    };
    
    if (templateColors.container) {
      if (templateColors.container.background) {
        if (!this.theme.containerStyle) this.theme.containerStyle = {};
        this.theme.containerStyle.background = templateColors.container.background;
        delete this.theme.containerStyle['background-color'];
        const hexColor = rgbToHex(templateColors.container.background);
        this.updateColorInput('container_bg_color', hexColor || templateColors.container.background);
        if (applyImmediately && this.themeManager?.popupManager) {
          this.themeManager.popupManager.changeContainerBackgroundColor(templateColors.container.background);
        }
      }
    }

    if (templateColors.button?.background && applyImmediately && this.themeManager?.popupManager) {
      this.themeManager.popupManager.changeButtonBackgroundColor(templateColors.button.background);
    }
  }

  applySliceColors(templateColors) {
    if (!templateColors) return;
    
    const sliceColors = ['slice_1', 'slice_2', 'slice_3', 'slice_4'];
    sliceColors.forEach(sliceName => {
      if (templateColors[sliceName]) {
        if (templateColors[sliceName].background) {
          this.updateColorInput(`${sliceName}_bg_color`, templateColors[sliceName].background);
        }
        if (templateColors[sliceName].text) {
          this.updateColorInput(`${sliceName}_text_color`, templateColors[sliceName].text);
        }
      }
    });
    
    if (templateColors.circle) {
      if (templateColors.circle.background) {
        this.updateColorInput('circle_bg_color', templateColors.circle.background);
      }
      if (templateColors.circle.text) {
        this.updateColorInput('circle_text_color', templateColors.circle.text);
      }
    }
    
    if (templateColors.pin) {
      if (templateColors.pin.background) {
        this.updateColorInput('pin_bg_color', templateColors.pin.background);
      }
      if (templateColors.pin.text) {
        this.updateColorInput('pin_text_color', templateColors.pin.text);
      }
    }
  }

  changeGameAreaBackgroundColor(value) {
    let v = value != null ? String(value).trim() : '';
    if (v && /linear-gradient|radial-gradient/i.test(v)) {
      v = getGradientLastColor(v) || v;
    }
    const targets = [this.theme, this.themeManager?.theme];
    targets.forEach((t) => {
      if (!t) return;
      if (!t.game_styles || typeof t.game_styles !== 'object') t.game_styles = {};
      const gs = t.game_styles;
      if (!v) {
        delete gs.gameBackground;
        delete gs.gameOpacity;
      } else {
        gs.gameBackground = v;
        const vt = String(v).trim().toLowerCase();
        if (vt === 'transparent') {
          gs.gameOpacity = 0;
        } else if (!/linear-gradient|radial-gradient/i.test(vt)) {
          const opEl = document.getElementById('game_area_bg_opacity');
          const opPct = opEl
            ? normalizeGameBackgroundOpacityPercent(opEl.value)
            : normalizeGameBackgroundOpacityPercent(gs.gameOpacity);
          if (opPct <= 0) {
            gs.gameOpacity = 0;
          } else if (opPct >= 100) {
            delete gs.gameOpacity;
          } else {
            gs.gameOpacity = opPct;
          }
        }
      }
      delete t.gameBackground;
      delete t.gameBackgroundOpacity;
    });
    if (!v) {
      const opEl = document.getElementById('game_area_bg_opacity');
      if (opEl) {
        const th = this.theme || this.themeManager?.theme;
        const nextBg = String(resolveGameAreaBackgroundCss(th) || '').trim().toLowerCase();
        const nextPct = nextBg === 'transparent' ? 0 : 100;
        opEl.value = String(nextPct);
        const lab = document.getElementById('game_area_bg_opacity_value');
        if (lab) lab.textContent = `${nextPct}%`;
        if (th) {
          if (!th.game_styles || typeof th.game_styles !== 'object') th.game_styles = {};
          if (nextPct >= 100) delete th.game_styles.gameOpacity;
          else th.game_styles.gameOpacity = nextPct;
        }
      }
    } else if (/^transparent$/i.test(String(v).trim())) {
      const opEl = document.getElementById('game_area_bg_opacity');
      if (opEl) {
        opEl.value = '0';
        const lab = document.getElementById('game_area_bg_opacity_value');
        if (lab) lab.textContent = '0%';
      }
    }
    const gm = this.themeManager?.gameManager;
    if (!v && gm?.applyGamePositionLayout) {
      gm.applyGamePositionLayout();
    } else {
      applyGameAreaBackgroundFromTheme(this.theme || this.themeManager?.theme);
    }
  }

  changeSliceColor(parameter, value) {
    this.applyColorToSvg(parameter, value);
    this._setThemeGameColor(parameter, value);
  }

  changePinColor(parameter, value) {
    this.applyColorToSvg(parameter, value);
    this._setThemeGameColor(parameter, value);
  }

  changeSliceTextColor(idx1, idx2, idx3, parameter, value) {
    const keyBySliceIndex = {
      0: '--text-color-1',
      1: '--text-color-2',
      11: '--text-color-3',
      2: '--text-color-4',
    };
    const textCssVar = keyBySliceIndex[idx1] || '--text-color';
    this._setThemeGameColor(textCssVar, value);
    // Legacy fallback for older SVGs that only read --text-color.
    this._setThemeGameColor('--text-color', value);

    const gamingTexts = Array.from(document.getElementsByClassName("wheelText"));
    if (gamingTexts.length > 0) {
      [idx1, idx2, idx3].forEach(idx => {
        this._applyFillToText(gamingTexts[idx], value);
      });
      return;
    }
    
    const gameContainer = document.querySelector('.game-svg-container');
    if (gameContainer) {
      const allWheelTexts = Array.from(gameContainer.getElementsByClassName("wheelText"));
      const lightTexts = allWheelTexts.filter(text => !text.classList.contains('centerText'));
      
      if (lightTexts.length > 0) {
        [idx1, idx2, idx3].forEach(idx => {
          this._applyFillToText(lightTexts[idx], value);
        });
      } else {
        const allTexts = Array.from(gameContainer.querySelectorAll('text')).filter(text => 
          !text.classList.contains('centerText') && text.id !== 'label-center'
        );
        if (allTexts.length > 0) {
          [idx1, idx2, idx3].forEach(idx => {
            this._applyFillToText(allTexts[idx], value);
          });
        }
      }
    }
  }

  updateTextColorsForAllViews() {
    const textColorMappings = {
      'slice_1_text_color': [0, 10, 8],
      'slice_2_text_color': [1, 3, 5],
      'slice_3_text_color': [11, 9, 7],
      'slice_4_text_color': [2, 4, 6]
    };

    Object.entries(textColorMappings).forEach(([inputName, indices]) => {
      const input = document.querySelector(`input[name="${inputName}"]`);
      if (input && input.value) {
        this.changeSliceTextColor(indices[0], indices[1], indices[2], '--text-color', input.value);
      }
    });

    for (let i = 1; i <= 12; i++) {
      const rewardInput = document.querySelector(`input[name="reward_${i}_label"]`);
      const wheelTextElement = document.getElementsByClassName("wheelText")[i - 1];
      
      if (rewardInput && rewardInput.value && wheelTextElement) {
        const tspanElement = wheelTextElement.querySelector('tspan');
        if (tspanElement) {
          tspanElement.textContent = rewardInput.value;
        } else {
          wheelTextElement.textContent = rewardInput.value;
        }
      }

      const codeInput = document.querySelector(`input[name="reward_${i}_code"]`);
      if (codeInput && codeInput.value && wheelTextElement) {
        wheelTextElement.setAttribute("data-code", codeInput.value);
      }
    }
  }

  changeCountdownBackgroundColor(value) {
    document
      .querySelectorAll(
        '#promotionCouponBarCapturePanel, .promotion-phone-coupon-overlay .promotion-phone-coupon-clone',
      )
      .forEach((el) => {
        if (el) el.style.backgroundColor = value;
      });
    // Tam remount (refreshCountdownPhonePreviewIfMounted) giriş animasyonunu baştan oynatır;
    // renk zaten yukarıdaki öğelere uygulanıyor — ek yenileme gerekmez.
  }

  changeCountdownTextColor(value) {
    document
      .querySelectorAll(
        '#promotionCouponBarCapturePanel, .promotion-phone-coupon-overlay .promotion-phone-coupon-clone',
      )
      .forEach((el) => {
        if (!el) return;
        el.style.color = value;
        el.querySelectorAll('.close-btn').forEach((b) => {
          b.style.color = value;
        });
      });
  }
  
  extractGameDefaults(svgContent, loadTexts = true) {
    if (!svgContent) {
      console.warn("extractGameDefaults: svgContent is empty");
      return;
    }

    const getVar = (name) => {
      const regex = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;\\n\\r]+)`, 'i');
      const match = svgContent.match(regex);
      if (match && match[1]) {
        return match[1].trim().replace(/['"]/g, '');
      }
      return '';
    };

    const sliceColor1 = getVar('--slice-color-1');
    const sliceColor2 = getVar('--slice-color-2');
    const sliceColor3 = getVar('--slice-color-3');
    const sliceColor4 = getVar('--slice-color-4');
    const backgroundColor = getVar('--background-color');
    const secondaryColor = getVar('--secondary-color');
    const pinColor1 = getVar('--pin-color-1');
    const pinColor2 = getVar('--pin-color-2');
    const textColor = getVar('--text-color');

    const colorUpdates = {
      'slice_1_bg_color': sliceColor1,
      'slice_2_bg_color': sliceColor2,
      'slice_3_bg_color': sliceColor3,
      'slice_4_bg_color': sliceColor4,
      'circle_bg_color': backgroundColor,
      'circle_text_color': secondaryColor,
      'pin_bg_color': pinColor1,
      'pin_text_color': pinColor2,
      'slice_1_text_color': textColor,
      'slice_2_text_color': textColor,
      'slice_3_text_color': textColor,
      'slice_4_text_color': textColor,
    };
    
    Object.entries(colorUpdates).forEach(([inputName, value]) => {
      if (value) {
        this.updateColorInputAndBox(inputName, value);
      }
    });

    if (loadTexts) {
      this.extractAndLoadTextsFromSvg(svgContent);
    }

  }

  applyGameColorsFromTemplate(gameColors) {
    if (!gameColors || typeof gameColors !== 'object') {
      return;
    }

    const colorMappings = {
      '--slice-color-1': 'slice_1_bg_color',
      '--slice-color-2': 'slice_2_bg_color',
      '--slice-color-3': 'slice_3_bg_color',
      '--slice-color-4': 'slice_4_bg_color',
      '--background-color': 'circle_bg_color',
      '--secondary-color': 'circle_text_color',
      '--pin-color-1': 'pin_bg_color',
      '--pin-color-2': 'pin_text_color',
    };

    Object.entries(colorMappings).forEach(([cssVar, inputName]) => {
      if (gameColors[cssVar]) {
        this.updateColorInputAndBox(inputName, gameColors[cssVar]);
      }
    });

    const legacyText = gameColors['--text-color'];
    const textBySlice = [
      ['--text-color-1', 'slice_1_text_color'],
      ['--text-color-2', 'slice_2_text_color'],
      ['--text-color-3', 'slice_3_text_color'],
      ['--text-color-4', 'slice_4_text_color'],
    ];
    textBySlice.forEach(([key, inputName]) => {
      const v = gameColors[key] || legacyText;
      if (v) {
        this.updateColorInputAndBox(inputName, v);
      }
    });

    this.applyColorsToSvg(gameColors);
    this.updateTextColorsForAllViews();
  }

  extractAndLoadTextsFromSvg(svgContent) {
    try {
      const tempContainer = document.createElement("div");
      tempContainer.innerHTML = svgContent;

      const allWheelTexts = tempContainer.querySelectorAll(".wheelText");
      const wheelTextItems = Array.from(allWheelTexts).filter(text => 
        !text.classList.contains('centerText') && text.id !== 'label-center'
      );

      const rewardsRows = document.querySelectorAll("#gameRewardsContainer .reward-row");

      if (rewardsRows.length === 0 || wheelTextItems.length === 0) {
        return;
      }

      const sliceSlotFromEl = (el) => {
        for (const c of el.classList) {
          if (/^slice[1-4]-text[1-3]$/.test(c)) return c;
        }
        return null;
      };

      wheelTextItems.forEach((wheelTextItem) => {
        const slot = sliceSlotFromEl(wheelTextItem);
        if (!slot) return;

        rewardsRows.forEach((row, i) => {
          const sliceInput = row.querySelector(`input[name="reward_sliceText_${i}"]`);
          if (!sliceInput || sliceInput.value.trim() !== slot) return;

          const labelInput = row.querySelector(`input[name="reward_label_${i}"]`);
          const codeInput = row.querySelector(`input[name="reward_code_${i}"]`);
          const weightInput = row.querySelector(`input[name="reward_weight_${i}"]`);

          let textContent = '';
          const tspan = wheelTextItem.querySelector('tspan');
          if (tspan) {
            textContent = tspan.textContent.trim();
          } else {
            textContent = wheelTextItem.textContent.trim();
          }

          if (textContent && labelInput) {
            labelInput.value = textContent;
            labelInput.dispatchEvent(new Event('input', { bubbles: true }));
            labelInput.dispatchEvent(new Event('change', { bubbles: true }));
          }

          const codeAttr = wheelTextItem.getAttribute('data-code');
          if (codeAttr && codeInput) {
            codeInput.value = codeAttr;
            codeInput.dispatchEvent(new Event('input', { bubbles: true }));
            codeInput.dispatchEvent(new Event('change', { bubbles: true }));
          }

          const weightAttr = wheelTextItem.getAttribute('data-weight');
          if (weightAttr && weightInput) {
            weightInput.value = weightAttr;
            weightInput.dispatchEvent(new Event('input', { bubbles: true }));
            weightInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      });
    } catch (e) {
      console.error('[color-manager] Failed to extract texts from SVG:', e);
    }
  }

  setColorsFromWheel(wheelSvg) {
    this.extractGameDefaults(wheelSvg, false);
  }

  loadThemeColorsToInputs() {
    const svg = this.findActiveSvg();
    if (!svg) return;

    const cssVar = (name) => getComputedStyle(svg).getPropertyValue(name).trim();
    const fallbackText =
      cssVar('--text-color-1') ||
      cssVar('--text-color') ||
      '';

    const colorMappings = {
      'slice_1_bg_color': cssVar('--slice-color-1'),
      'slice_1_text_color': cssVar('--text-color-1') || fallbackText,
      'slice_2_bg_color': cssVar('--slice-color-2'),
      'slice_2_text_color': cssVar('--text-color-2') || fallbackText,
      'slice_3_bg_color': cssVar('--slice-color-3'),
      'slice_3_text_color': cssVar('--text-color-3') || fallbackText,
      'slice_4_bg_color': cssVar('--slice-color-4'),
      'slice_4_text_color': cssVar('--text-color-4') || fallbackText,
      'circle_bg_color': cssVar('--background-color'),
      'circle_text_color': cssVar('--secondary-color'),
      'pin_bg_color': cssVar('--pin-color-1'),
      'pin_text_color': cssVar('--pin-color-2'),
    };

    Object.entries(colorMappings).forEach(([inputName, colorValue]) => {
      if (colorValue) {
        this.updateColorInput(inputName, colorValue);
      }
    });
  }
}


