import { ThemeManager } from "./managers/theme-manager.js";
import { ImageManager } from "./managers/image-manager.js";
import { GameManager } from "./managers/game-manager.js";
import { getTemplateById } from "./templates.js";
import { normalizeGameTheme, setGameTypeById, setGameSvgString } from "./utils/game-theme-utils.js";

window.currentView = "wheel";
window.theme = window.theme || {};

function getPromotionId() {
  const baseForm = document.querySelector('form[name="base_form"]');
  return baseForm ? baseForm.getAttribute('data-promotion_id') : null;
}

function initializeTheme(theme) {
    normalizeGameTheme(theme);
    return theme;
  }

function getMinDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return {
      minDate: `${year}-${month}-${day}`,
      minTime: `${hours}:${minutes}`,
    };
  }

function getNowTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

function getLastTime() {
    return "23:59";
  }

// --- Orchestration ---

let appThemeManager = null;
let appImageManager = null;
let appTheme = null;

async function initialize() {
  try {
    let themeInput = null;
    let retries = 0;
    const maxRetries = 10;
    
    while (!themeInput && retries < maxRetries) {
      themeInput = document.querySelector('input[name="theme"]');
      if (!themeInput) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }
    }

    if (!themeInput) {
      console.error("Theme input not found after", maxRetries, "retries");
      throw new Error("Did not rendered necessary elements.");
    }

    if (!themeInput.value || themeInput.value.trim() === '') {
      console.error("Theme input exists but has no value");
      throw new Error("Theme input value is empty.");
    }

    const rawThemeValue = themeInput.value;
    try {
      const rawThemeFromInput = JSON.parse(rawThemeValue);
      window.rawThemeFromInput = rawThemeFromInput;
      } catch (e) {
      console.error('[COLOR PICKER] initialize - Error parsing raw theme:', e);
    }

    let theme = JSON.parse(themeInput.value);
    theme = initializeTheme(theme);
    window.theme = theme;
    appTheme = theme;

    appThemeManager = new ThemeManager(theme, null);
    window.themeManager = appThemeManager;

    appImageManager = new ImageManager(theme, appThemeManager, false);

    window.wheelApp = {
      themeManager: appThemeManager,
      imageManager: appImageManager,
      theme: appTheme
    };

    await init();

  } catch (error) {
    console.error("An error occurred while rendering the page:", error);
  } finally {
    const spinner = document.getElementById("loadingSpinner");
    if (spinner) {
      spinner.classList.add("visually-hidden");
    }
  }
}

async function init() {
  try {
    const originalTemplateId = appTheme.template;
    
    const params = new URLSearchParams(window.location.search);
    const redirectId = window.SELECTED_TEMPLATE_FROM_REDIRECT;
    const urlId = params.get('template_id') ? parseInt(params.get('template_id'), 10) : null;
    const templateOverrideId = redirectId || urlId;

    const isNewTemplateSelection = templateOverrideId && templateOverrideId !== originalTemplateId;

    if (isNewTemplateSelection && templateOverrideId) {
      appTheme.template = templateOverrideId;
      appThemeManager.selectedTemplateValue = templateOverrideId;
      
      try {
        const template = getTemplateById(templateOverrideId);
        if (template) {
          appTheme.popup_type = 'gaming';

          if (template.containerStyle) {
            appTheme.containerStyle = JSON.parse(JSON.stringify(template.containerStyle));
          }
          if (template.text_styles) {
            appTheme.text_styles = JSON.parse(JSON.stringify(template.text_styles));
          }
      if (template.background_image && template.background_image.path) {
            appTheme.background_image = template.background_image;
          }
      if (template.top_image && template.top_image.path) {
            appTheme.top_image = template.top_image;
          }
      if (template.bottom_image && template.bottom_image.path) {
            appTheme.bottom_image = template.bottom_image;
          }
          if (template.wheel) {
            setGameTypeById(appTheme, 1);
            setGameSvgString(appTheme, template.wheel);
          }
    } else {
          console.warn(`Template id=${templateOverrideId} not found, continuing with default theme`);
        }
      } catch (templateError) {
        console.error(`Error loading template id=${templateOverrideId}:`, templateError);
      }
    }

    const changeTemplate = isNewTemplateSelection;
    appThemeManager.activeTemplateId = isNewTemplateSelection ? templateOverrideId : null;
    appThemeManager.initialPopup(appTheme, changeTemplate);
    appTheme = appThemeManager.theme;
    window.wheelApp.theme = appTheme;

    appImageManager.selectedPopupType(appTheme.popup_type);
    appImageManager.init();

    if (isNewTemplateSelection || templateOverrideId) {
      clearTemplateQueryParam();
      window.SELECTED_TEMPLATE_FROM_REDIRECT = null;
    }

    setTimeout(() => {
      if (!isNewTemplateSelection) {
        const themeInput = document.querySelector('input[name="theme"]');
        if (themeInput) {
          try {
            const savedTheme = JSON.parse(themeInput.value);
            
            if (savedTheme?.input_fields) {
              appThemeManager.theme.input_fields = savedTheme.input_fields;
              appThemeManager.loadInputFields(savedTheme.input_fields);
            } else if (appThemeManager.theme?.input_fields) {
              appThemeManager.loadInputFields(appThemeManager.theme.input_fields);
            }

            if (savedTheme?.input_fields_style) {
              appThemeManager.theme.input_fields_style = savedTheme.input_fields_style;
            }
            setTimeout(() => {
              if (appThemeManager.inputFieldsManager) {
                appThemeManager.inputFieldsManager.initCommonInputFieldStylePickers();
              }
            }, 300);
          } catch (e) {
            console.error('Error parsing theme:', e);
          }
    } else {
          if (appThemeManager.theme?.input_fields) {
            appThemeManager.loadInputFields(appThemeManager.theme.input_fields);
          }
        }
      }
    }, 500);
    
    appThemeManager.initialEvents(appTheme);
    appThemeManager.initPickers();

    setTimeout(() => {
      appThemeManager.applyCurrentColors();
      appThemeManager._updateGameColorsResetBaselineFromCurrentTheme();
      appThemeManager._updateGameSvgTextResetBaselineFromCurrentTheme();
      appThemeManager._updateTextsResetBaselineFromCurrentTheme();
    }, 300);
    
    appThemeManager._initTooltips();
    appThemeManager._initHelpLinks();
    initDateTimePickers();
    appImageManager.checkImageCount();

    initializeEventListeners();

    hideLoadingSpinner();

    // Yeni promosyon + şablon: sunucuda rendered_html yok. DOM oturduktan sonra Save Changes ile aynı POST ile DB'ye snapshot yaz.
    setTimeout(() => {
      try {
        const tm = appThemeManager;
        const shell = document.getElementById('wheelluckContainer');
        if (!tm || !shell) return;

        const pid = getPromotionId();
        if (!pid) return;
        if (sessionStorage.getItem(`wheelluck_rendered_snapshot_done_${pid}`)) return;

        const params = new URLSearchParams(window.location.search);
        const fromTemplate = params.has('template_id');

        let needsSnapshot = true;
        try {
          const themeInput = document.querySelector('input[name="theme"]');
          const th = JSON.parse(themeInput?.value || '{}');
          needsSnapshot = String(th.rendered_html || '').trim().length < 80;
        } catch (_) {
          needsSnapshot = true;
        }

        if (!fromTemplate && !needsSnapshot) return;

        window.__WHEELLUCK_AUTO_SNAPSHOT_PROMOTION_ID = pid;
        tm.saveChanges();
      } catch (e) {
        console.warn('[promotion.init] auto persist rendered_html failed', e);
      }
    }, 2000);

  } catch (error) {
    console.error("App could not rendered:", error);
    hideLoadingSpinner();
  }
}

function openPopupSettingsAccordion() {
  const btn = document.querySelector('#headingPopupSettings .accordion-button');
  const collapseEl = document.getElementById('collapsePopupSettings');
  if (!btn || !collapseEl) return;
  if (collapseEl.classList.contains('show')) {
    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  btn.click();
  btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function shouldIgnoreClickForPopupSettingsShortcut(target) {
  if (!target || typeof target.closest !== 'function') return true;
  return !!target.closest(
    [
      'button',
      'a',
      'input',
      'textarea',
      'select',
      '.game-svg-inner',
      '#wheelLeads',
      '#headline',
      '#description',
      '#disclaimer',
      '#close_link',
      '.consent-box',
    ].join(', ')
  );
}

/** Önizleme kabuğuna tıklanınca sol panelde Pop-up Settings accordion'unu açar (tek seferlik dinleyici; kabuk DOM'da yeniden oluşsa da çalışır). */
function initWheelluckShellOpenPopupSettingsAccordion() {
  if (initWheelluckShellOpenPopupSettingsAccordion._done) return;
  initWheelluckShellOpenPopupSettingsAccordion._done = true;

  document.addEventListener(
    'click',
    (e) => {
      if (!e.target || !e.target.closest) return;
      const shell = e.target.closest('#wheelluckContainer');
      if (!shell) return;
      if (shouldIgnoreClickForPopupSettingsShortcut(e.target)) return;
      openPopupSettingsAccordion();
    },
    false
  );
}

function initializeEventListeners() {
  const submitButton = document.querySelector("button[name='submit_button']");
  if (submitButton) {
    submitButton.addEventListener("click", () => appThemeManager.saveChanges());
  }

  const unifiedShell = Boolean(appTheme);

  if (!unifiedShell) {
    initGameType();
  }
  appImageManager.selectedPopupType(appTheme.popup_type);
  appImageManager.popupType = appTheme.popup_type;

  initWheelluckShellOpenPopupSettingsAccordion();
}

function initGameType() {
  const gameManager = appThemeManager.gameManager || new GameManager(appTheme, appThemeManager);
  gameManager.theme = appTheme;
  gameManager.themeManager = appThemeManager;
  gameManager.init(appTheme);
  gameManager.initDOMElements();
}

function initDateTimePickers() {
  const startDateInput = document.querySelector('input[name="start_date"]');
  const startTimeInput = document.querySelector('input[name="start_time"]');
  const endDateInput = document.querySelector('input[name="end_date"]');
  const endTimeInput = document.querySelector('input[name="end_time"]');
  
  if (!startDateInput || !startTimeInput || !endDateInput || !endTimeInput) {
    return;
  }
  
  const { minDate } = getMinDateTime();

  [startDateInput, startTimeInput, endDateInput, endTimeInput].forEach(input => {
    input.removeAttribute('readonly');
    input.style.cursor = 'pointer';
    
    input.addEventListener('keydown', (e) => {
      if (['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        return;
      }
      e.preventDefault();
      return false;
    });
    
    input.addEventListener('keypress', (e) => {
      e.preventDefault();
      return false;
    });
    
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      return false;
    });
  });

  startDateInput.setAttribute("min", minDate);
  endDateInput.setAttribute("min", minDate);

  startDateInput.addEventListener("change", () => {
    startTimeInput.value = getNowTime();
    endDateInput.setAttribute("min", startDateInput.value);
  });

  endDateInput.addEventListener("change", () => {
    endTimeInput.value = getLastTime();
  });
}

function hideLoadingSpinner() {
    const spinner = document.getElementById("loadingSpinner");
    if (spinner) {
      spinner.classList.add("visually-hidden");
    }
  }

function clearTemplateQueryParam() {
  const url = new URL(window.location.href);
  if (url.searchParams.has('template_id')) {
    url.searchParams.delete('template_id');
    const params = url.searchParams.toString();
    const newUrl = url.pathname + (params ? `?${params}` : '') + url.hash;
    window.history.replaceState({}, '', newUrl);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.querySelector('section.section[data-promotion-name]')) {
    await initialize();
  }
});

export {
  ThemeManager,
  getPromotionId,
  initialize,
  initializeTheme,
  getMinDateTime,
  getNowTime,
  getLastTime,
  clearTemplateQueryParam,
  openPopupSettingsAccordion,
  shouldIgnoreClickForPopupSettingsShortcut,
  initWheelluckShellOpenPopupSettingsAccordion,
  initDateTimePickers,
  hideLoadingSpinner,
};

