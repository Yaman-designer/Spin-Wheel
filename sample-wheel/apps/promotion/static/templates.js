const default_text = {
  "headline": "Our store's special bonus unlocked!",
  "description": "You have a chance to win a nice big fat discount. Are you feeling lucky? Give it a spin!",
  "disclaimer": "You can spin the wheel only once. ",
  "styles": {
    "headline": {
      "font-family": "Arial",
      "font-size": "28px",
      "text-align": "center",
      "font-weight": "bold",
      "font-style": "normal",
      "text-decoration": "none",
      "color": "#f2f2f2"
    },
    "description": {
      "font-family": "Arial",
      "font-size": "16px",
      "text-align": "center",
      "font-weight": "normal",
      "font-style": "normal",
      "text-decoration": "none",
      "color": "#f2f2f2"
    },
    "disclaimer": {
      "font-family": "Arial",
      "font-size": "14px",
      "text-align": "center",
      "font-weight": "normal",
      "font-style": "italic",
      "text-decoration": "none",
      "color": "#f2f2f2"
    },
  }
}

const default_input_fields = [
  {
    id: "default_email_field",
    label: "Email",
    name: "email",
    type: "email",
    placeholder: "Enter your email address",
    required: true,
    style: {
      "border-color": "#dee2e6",
      "border-width": "1",
      "border-radius": "12",
      "placeholder-color": "#6c757d",
      "width": "100",
      "height": "40",
      "text-align": "center",
      "color": "#000000",
      "padding": "12px",
      "background": "#ffffff",
      "focus-border-color": "#fc8289",
    },
  },
  {
    id: "default_submit_btn",
    label: "Button",
    name: "button_default_submit",
    type: "submit_button",
    text: "Try your luck",
    action: "submit_form",
    action_url: "",
    style: {
      "font-family": "Arial",
      "font-size": "16px",
      "text-align": "center",
      "font-weight": "bold",
      "font-style": "normal",
      "text-decoration": "none",
      "width": "100%",
      "height": "40px",
      "border-radius": "30px",
      "border": "none",
      "box-shadow": "inset 1px 1px rgba(255, 255, 255, 0.1), 2px 2px 1px 1px rgba(0, 0, 0, 0.1)",
      "letter-spacing": "0.05em",
      "background": "#fc8289",
      "color": "#000000",
    }
  },
  {
    id: "default_close_btn",
    label: "Button",
    name: "button_default_close",
    type: "submit_button",
    text: "No, I don't feel lucky",
    action: "close_form",
    action_url: "",
    style: {
      "font-family": "Arial",
      "font-size": "14px",
      "text-align": "center",
      "font-weight": "normal",
      "font-style": "normal",
      "text-decoration": "none",
      "color": "#f2f2f2",
      "border": "none",
      "background": "none",
    }
  }
]

function defaultGamingTemplateInputFields() {
  return JSON.parse(JSON.stringify(default_input_fields))
}


const default_content_styles = {
  left: {
    content_wrapper:
      "position: relative ; display: flex ; flex-direction: row ; width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; align-self: center ; align-items: stretch ; justify-content: flex-start ; box-sizing: border-box ; overflow: hidden ;",
    content:
      "order: 2 ; flex: 0 0 40% ; width: 40% ; min-width: 0 ; box-sizing: border-box ; padding: 50px 22px 50px 28px ; margin-top: 0 ; display: flex ; flex-direction: column ; justify-content: space-between ; align-items: center ; overflow-y: auto ; overflow-x: hidden ; text-align: center ;",
    content_inner:
      "margin: 0 ; width: 100% ; flex: 1 0 auto ;justify-content: center ; box-sizing: border-box ; display: flex ; flex-direction: column ; align-items: center ; gap: 18px ;",
  },
  top: {
    content_wrapper:
      "position: relative ; display: flex ; flex-direction: column ; width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; align-self: center ; align-items: stretch ; justify-content: flex-start ; box-sizing: border-box ; overflow: hidden ;",
    content:
      "order: 2 ; flex: 1 1 auto ; width: 100% ; min-width: 0 ; min-height: 0 ; box-sizing: border-box ; padding: 50px 22px 50px 28px ; margin-top: 0 ; display: flex ; flex-direction: column ; justify-content: center ; align-items: center ; overflow-y: auto ; overflow-x: hidden ; text-align: center ;",
    content_inner:
      "margin: 0 ; width: 100% ; box-sizing: border-box ; display: flex ; flex-direction: column ; align-items: center ; gap: 18px ;",
  },
  right: {
    content_wrapper:
      "position: relative ; display: flex ; flex-direction: row ; width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; align-self: center ; align-items: stretch ; justify-content: flex-start ; box-sizing: border-box ; overflow: hidden ;",
    content:
      "order: 1 ; flex: 0 0 40% ; width: 40% ; min-width: 0 ; box-sizing: border-box ; padding: 50px 28px 50px 22px ; margin-top: 0 ; display: flex ; flex-direction: column ; justify-content: center ; align-items: center ; overflow-y: auto ; overflow-x: hidden ; text-align: center ;",
    content_inner:
      "margin: 0 ; width: 100% ; box-sizing: border-box ; display: flex ; flex-direction: column ; align-items: center ; gap: 18px ;",
  },
}

const templates = [
  {
    id: 101,
    name: "Basic Design",
    categories: ["Modern", "Classic"],
    popup_type: "gaming",
    hasGame: true,    thumbnail: "",
    gameID: 1,
    containerStyle: {
      "display": "flex",
      "flex-direction": "column",
      "align-items": "stretch",
      "justify-content": "flex-start",
      "width": "980px",
      "height": "580px",
      "background": "#c1d3e1",
      "border-radius": "16px",
      "box-shadow": "0 14px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)",
      "overflow": "hidden",
      "overflow-x": "hidden",
      "overflow-y": "auto",
      "box-sizing": "border-box",
      "position": "absolute",
      "z-index": "100",
    },
    layout: {
      type: "split",
      position: "left",
    },
    texts: {
      headline: default_text.headline,
      description: default_text.description,
      disclaimer: default_text.disclaimer,
    },
    text_styles: {
    headline: { ...default_text.styles.headline },
    description: { ...default_text.styles.description },
    disclaimer: { ...default_text.styles.disclaimer },
    },
    close_button: {
      type: "icon",
      position: "top-right",
      style:
        "position:absolute; right:12px; top:10px; width:32px; height:32px; background:rgba(255,255,255,0.25); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.35); border-radius:50%; color:#1a1a1a; font-size:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10;",
    },
    game_styles: {
      game_svg: "display: block ; box-sizing: border-box ; max-width: 100% ; max-height: 100% ; width: auto ; height: auto ; flex-shrink: 1 ;",
      game_svg_area: "height: 80%",
      gameBackground: "#ffffff",
      gameOpacity: 0,
      game_svg_text: {
        "font-family": "Arial",
        "font-size": "26px"
      },
      left: {
        game: "order: 1 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ;height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      top: {
        game: "order: 1 ; flex: 0 0 auto ; width: 100% ; max-width: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      right: {
        game: "order: 2 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ; height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
    },
    content_styles: JSON.parse(JSON.stringify(default_content_styles)),
    image_styles: {
      left: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      top: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      right: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
    },
    input_fields: defaultGamingTemplateInputFields(),
    gameColors: {
      "--primary-color": "#00C39A",
      "--secondary-color": "#808080",
      "--text-color": "#F2F2F2",
      "--accent-color": "#00008B",
      "--background-color": "#d8c8a1",
      "--slice-color-1": "#edc2c1",
      "--slice-color-2": "#e3e9bf",
      "--slice-color-3": "#eb9853",
      "--slice-color-4": "#87bbb5",
      "--pin-color-1": "#ff8061",
      "--pin-color-2": "#F2F2F2",
    },
    background_image: {
      path: "",
      style: "background-size: cover; background-position: center;",
    },
    image: {
      path: "",
      style: "",
    },
    top_image: {
      path: "",
      style: "position:absolute;left:50%;top:0;transform:translateX(-50%);width:min(92%,720px);max-height:26%;height:auto;object-fit:contain;object-position:center top;pointer-events:none;",
    },
    bottom_image: {
      path: "",
      style: "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:min(92%,720px);max-height:24%;height:auto;object-fit:contain;object-position:center bottom;pointer-events:none;",
    },
  },
  // pink — tema 101 ile aynı kabuk/layout/stiller; arka plan görseli ve gameColors pembe
  {
    id: 102,
    name: "Pink Template",
    categories: ["Modern", "Colorful"],
    popup_type: "gaming",
    hasGame: true,    thumbnail: "",
    gameID: 1,
    containerStyle: {
      "display": "flex",
      "flex-direction": "column",
      "align-items": "stretch",
      "justify-content": "flex-start",
      "width": "980px",
      "height": "580px",
      "background": "#c1d3e1",
      "border-radius": "16px",
      "box-shadow": "0 14px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)",
      "overflow": "hidden",
      "overflow-x": "hidden",
      "overflow-y": "auto",
      "box-sizing": "border-box",
      "position": "absolute",
      "z-index": "100",
    },
    layout: {
      type: "split",
      position: "left",
    },
    texts: {
      headline: default_text.headline,
      description: default_text.description,
      disclaimer: default_text.disclaimer,
    },
    text_styles: {
  headline: { ...default_text.styles.headline },
  description: { ...default_text.styles.description },
  disclaimer: { ...default_text.styles.disclaimer },
},
    close_button: {
      type: "icon",
      position: "top-right",
      style: "position:absolute; right:12px; top:10px; width:32px; height:32px; background:rgba(255,255,255,0.25); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.35); border-radius:50%; color:#1a1a1a; font-size:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10;",
    },
    game_styles: {
      game_svg: "display: block ; box-sizing: border-box ; max-width: 100% ; max-height: 100% ; width: auto ; height: auto ; flex-shrink: 1 ;",
      game_svg_area: "height: 80%",
      gameBackground: "#ffffff",
      gameOpacity: 0,
      game_svg_text: {
        "font-family": "Arial",
        "font-size": "26px"
      },
      left: {
        game: "order: 1 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ;height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      top: {
        game: "order: 1 ; flex: 0 0 auto ; width: 100% ; max-width: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      right: {
        game: "order: 2 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ; height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
    },
    content_styles: JSON.parse(JSON.stringify(default_content_styles)),
    image_styles: {
      left: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      top: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      right: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
    },
    input_fields: defaultGamingTemplateInputFields(),
    gameColors: {
      "--primary-color": "#00C39A",
      "--secondary-color": "#e72190",
      "--text-color": "#F2F2F2",
      "--accent-color": "#00008B",
      "--background-color": "#00c39a",
      "--slice-color-1": "#9dddd0",
      "--slice-color-2": "#efa6d1",
      "--slice-color-3": "#9dddd0",
      "--slice-color-4": "#efa6d1",
      "--pin-color-1": "#ff8061",
      "--pin-color-2": "#F2F2F2",
    },
    background_image: {
      path: "static/images/templates/template1/background.png",
      style: "background-size: cover; background-position: center;",
    },
    image: {
      path: "",
      style: "",
    },
    top_image: {
      path: "",
      style: "position:absolute;left:50%;top:0;transform:translateX(-50%);width:min(90%,680px);max-height:25%;height:auto;object-fit:contain;object-position:center top;pointer-events:none;",
    },
    bottom_image: {
      path: "",
      style: "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:min(90%,680px);max-height:23%;height:auto;object-fit:contain;object-position:center bottom;pointer-events:none;",
    },
  },
  // green — tema 101 ile aynı kabuk/layout/stiller; template2 arka plan, gameColors yeşil
  {
    id: 103,
    name: "Green Template",
    categories: ["Modern", "Colorful"],
    popup_type: "gaming",
    hasGame: true,    thumbnail: "",
    gameID: 1,
    containerStyle: {
      "display": "flex",
      "flex-direction": "column",
      "align-items": "stretch",
      "justify-content": "flex-start",
      "width": "980px",
      "height": "580px",
      "background": "#c1d3e1",
      "border-radius": "16px",
      "box-shadow": "0 14px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)",
      "overflow": "hidden",
      "overflow-x": "hidden",
      "overflow-y": "auto",
      "box-sizing": "border-box",
      "position": "absolute",
      "z-index": "100",
    },
    layout: {
      type: "split",
      position: "left",
    },
    texts: {
      headline: default_text.headline,
      description: default_text.description,
      disclaimer: default_text.disclaimer,
    },
    text_styles: {
  headline: { ...default_text.styles.headline },
  description: { ...default_text.styles.description },
  disclaimer: { ...default_text.styles.disclaimer },
},
    close_button: {
      type: "icon",
      position: "top-right",
      style: "position:absolute; right:12px; top:10px; width:32px; height:32px; background:rgba(255,255,255,0.25); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.35); border-radius:50%; color:#1a1a1a; font-size:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10;",
    },
    game_styles: {
      game_svg: "display: block ; box-sizing: border-box ; max-width: 100% ; max-height: 100% ; width: auto ; height: auto ; flex-shrink: 1 ;",
      game_svg_area: "height: 80%",
      gameBackground: "#ffffff",
      gameOpacity: 0,
      game_svg_text: {
        "font-family": "Arial",
        "font-size": "26px"
      },
      left: {
        game: "order: 1 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ;height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      top: {
        game: "order: 1 ; flex: 0 0 auto ; width: 100% ; max-width: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      right: {
        game: "order: 2 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ; height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
    },
    content_styles: JSON.parse(JSON.stringify(default_content_styles)),
    image_styles: {
      left: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      top: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      right: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
    },
    input_fields: defaultGamingTemplateInputFields(),
    gameColors: {
      "--primary-color": "#00C39A",
      "--secondary-color": "#00c39a",
      "--text-color": "#F2F2F2",
      "--accent-color": "#00008B",
      "--background-color": "#ea1293",
      "--slice-color-1": "#9dddd0",
      "--slice-color-2": "#efa6d1",
      "--slice-color-3": "#9dddd0",
      "--slice-color-4": "#efa6d1",
      "--pin-color-1": "#ff8061",
      "--pin-color-2": "#F2F2F2",
    },
    background_image: {
      path: "static/images/templates/template2/background.png",
      style: "background-size: cover; background-position: center;",
    },
    image: {
      path: "",
      style: "",
    },
    top_image: {
      path: "",
      style: "position:absolute;left:50%;top:0;transform:translateX(-50%);width:min(88%,660px);max-height:27%;height:auto;object-fit:contain;object-position:center top;pointer-events:none;",
    },
    bottom_image: {
      path: "",
      style: "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:min(88%,660px);max-height:22%;height:auto;object-fit:contain;object-position:center bottom;pointer-events:none;",
    },
  },
  // happy halloween 1 — tema 101 ile aynı kabuk; üst/alt dekor görselleri korunur
  {
    id: 104,
    name: "Happy Halloween 1",
    categories: ["Holiday", "Dark"],
    popup_type: "gaming",
    hasGame: true,    thumbnail: "",
    gameID: 1,
    containerStyle: {
      "display": "flex",
      "flex-direction": "column",
      "align-items": "stretch",
      "justify-content": "flex-start",
      "width": "980px",
      "height": "580px",
      "background": "#c1d3e1",
      "border-radius": "16px",
      "box-shadow": "0 14px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)",
      "overflow": "hidden",
      "overflow-x": "hidden",
      "overflow-y": "auto",
      "box-sizing": "border-box",
      "position": "absolute",
      "z-index": "100",
    },
    layout: {
      type: "split",
      position: "left",
    },
    texts: {
      headline: default_text.headline,
      description: default_text.description,
      disclaimer: default_text.disclaimer,
    },
    text_styles: {
    headline: { ...default_text.styles.headline },
    description: { ...default_text.styles.description },
    disclaimer: { ...default_text.styles.disclaimer },
    },
    close_button: {
      type: "icon",
      position: "top-right",
      style: "position:absolute; right:12px; top:10px; width:32px; height:32px; background:rgba(255,255,255,0.25); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.35); border-radius:50%; color:#1a1a1a; font-size:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10;",
    },
    game_styles: {
      game_svg: "display: block ; box-sizing: border-box ; max-width: 100% ; max-height: 100% ; width: auto ; height: auto ; flex-shrink: 1 ;",
      game_svg_area: "height: 80%",
      gameBackground: "#ffffff",
      gameOpacity: 0,
      game_svg_text: {
        "font-family": "Arial",
        "font-size": "26px"
      },
      left: {
        game: "order: 1 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ;height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      top: {
        game: "order: 1 ; flex: 0 0 auto ; width: 100% ; max-width: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      right: {
        game: "order: 2 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ; height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
    },
    content_styles: JSON.parse(JSON.stringify(default_content_styles)),
    image_styles: {
      left: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      top: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      right: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
    },
    input_fields: defaultGamingTemplateInputFields(),
    gameColors: {
      "--primary-color": "#00C39A",
      "--secondary-color": "#e72190",
      "--text-color": "#F2F2F2",
      "--accent-color": "#00008B",
      "--background-color": "#ffffff",
      "--slice-color-1": "#fbcdcc",
      "--slice-color-2": "#670d0d",
      "--slice-color-3": "#bc3333",
      "--slice-color-4": "#e78584",
      "--pin-color-1": "#ff8061",
      "--pin-color-2": "#F2F2F2",
    },
    background_image: {
      path: "static/images/templates/happyHalloween/background.jpg",
      style: "background-size: cover; background-position: center;",
    },
    image: {
      path: "",
      style: "",
    },
    top_image: {
      path: "static/images/templates/happyHalloween/top-image.png",
      style: "position:absolute;left:50%;top:1%;transform:translateX(-50%);width:340px;max-width:min(92%,720px);height:auto;max-height:30%;object-fit:contain;object-position:center top;pointer-events:none;",
    },
    bottom_image: {
      path: "static/images/templates/happyHalloween/bottom-image.png",
      style: "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:340px;max-width:min(92%,720px);height:auto;max-height:30%;object-fit:contain;object-position:center bottom;pointer-events:none;",
    },
},
// happy halloween 2
{
    id: 105,
    name: "Happy Halloween 2",
    categories: ["Holiday", "Dark"],
    popup_type: "gaming",
    hasGame: true,    thumbnail: "",
    gameID: 1,
    containerStyle: {
      "display": "flex",
      "flex-direction": "column",
      "align-items": "stretch",
      "justify-content": "flex-start",
      "width": "980px",
      "height": "580px",
      "background": "#c1d3e1",
      "border-radius": "16px",
      "box-shadow": "0 14px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)",
      "overflow": "hidden",
      "overflow-x": "hidden",
      "overflow-y": "auto",
      "box-sizing": "border-box",
      "position": "absolute",
      "z-index": "100",
    },
    layout: {
      type: "split",
      position: "left",
    },
    texts: {
      headline: default_text.headline,
      description: default_text.description,
      disclaimer: default_text.disclaimer,
    },
    text_styles: {
  headline: { ...default_text.styles.headline },
  description: { ...default_text.styles.description },
  disclaimer: { ...default_text.styles.disclaimer },
},
    close_button: {
      type: "icon",
      position: "top-right",
      style: "position:absolute; right:12px; top:10px; width:32px; height:32px; background:rgba(255,255,255,0.25); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.35); border-radius:50%; color:#1a1a1a; font-size:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10;",
    },
    game_styles: {
      game_svg: "display: block ; box-sizing: border-box ; max-width: 100% ; max-height: 100% ; width: auto ; height: auto ; flex-shrink: 1 ;",
      game_svg_area: "height: 80%",
      gameBackground: "#ffffff",
      gameOpacity: 0,
      game_svg_text: {
        "font-family": "Arial",
        "font-size": "26px"
      },
      left: {
        game: "order: 1 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ;height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      top: {
        game: "order: 1 ; flex: 0 0 auto ; width: 100% ; max-width: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      right: {
        game: "order: 2 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ; height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
    },
    content_styles: JSON.parse(JSON.stringify(default_content_styles)),
    image_styles: {
      left: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      top: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      right: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
    },
    input_fields: defaultGamingTemplateInputFields(),
    gameColors: {
      "--primary-color": "#00C39A",
      "--secondary-color": "#ec6d04",
      "--text-color": "#F2F2F2",
      "--accent-color": "#00008B",
      "--background-color": "#1d1d1b",
      "--slice-color-1": "#ec6d04",
      "--slice-color-2": "#1d1d1b",
      "--slice-color-3": "#ec6d04",
      "--slice-color-4": "#1d1d1b",
      "--pin-color-1": "#ff8061",
      "--pin-color-2": "#F2F2F2",
    },
    background_image: {
      path: "static/images/templates/happyHalloween2/background.jpg",
      style: "background-size: cover; background-position: center;",
    },
    image: {
      path: "",
      style: "",
    },
    top_image: {
      path: "",
      style: "position:absolute;left:50%;top:0;transform:translateX(-50%);width:min(91%,700px);max-height:26%;height:auto;object-fit:contain;object-position:center top;pointer-events:none;",
    },
    bottom_image: {
      path: "static/images/templates/happyHalloween2/bottom-image.png",
      style: "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:340px;max-width:min(92%,720px);height:auto;max-height:29%;object-fit:contain;object-position:center bottom;pointer-events:none;",
    },
},
// valentines day
{
    id: 106,
    name: "Valentines Day",
    categories: ["Holiday", "Romantic"],
    popup_type: "gaming",
    hasGame: true,    thumbnail: "",
    gameID: 1,
    containerStyle: {
      "display": "flex",
      "flex-direction": "column",
      "align-items": "stretch",
      "justify-content": "flex-start",
      "width": "980px",
      "height": "580px",
      "background": "#c1d3e1",
      "border-radius": "16px",
      "box-shadow": "0 14px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)",
      "overflow": "hidden",
      "overflow-x": "hidden",
      "overflow-y": "auto",
      "box-sizing": "border-box",
      "position": "absolute",
      "z-index": "100",
    },
    layout: {
      type: "split",
      position: "left",
    },
    texts: {
      headline: default_text.headline,
      description: default_text.description,
      disclaimer: default_text.disclaimer,
    },
    text_styles: {
  headline: { ...default_text.styles.headline },
  description: { ...default_text.styles.description },
  disclaimer: { ...default_text.styles.disclaimer },
},
    close_button: {
      type: "icon",
      position: "top-right",
      style: "position:absolute; right:12px; top:10px; width:32px; height:32px; background:rgba(255,255,255,0.25); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.35); border-radius:50%; color:#1a1a1a; font-size:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10;",
    },
    game_styles: {
      game_svg: "display: block ; box-sizing: border-box ; max-width: 100% ; max-height: 100% ; width: auto ; height: auto ; flex-shrink: 1 ;",
      game_svg_area: "height: 80%",
      gameBackground: "#ffffff",
      gameOpacity: 0,
      game_svg_text: {
        "font-family": "Arial",
        "font-size": "26px"
      },
      left: {
        game: "order: 1 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ;height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      top: {
        game: "order: 1 ; flex: 0 0 auto ; width: 100% ; max-width: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      right: {
        game: "order: 2 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ; height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
    },
    content_styles: JSON.parse(JSON.stringify(default_content_styles)),
    image_styles: {
      left: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      top: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      right: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
    },
    input_fields: defaultGamingTemplateInputFields(),
    gameColors: {
      "--primary-color": "#00C39A",
      "--secondary-color": "#bc3333",
      "--text-color": "#F2F2F2",
      "--accent-color": "#00008B",
      "--background-color": "#F1B0B8",
      "--slice-color-1": "#fbcdcc",
      "--slice-color-2": "#670d0d",
      "--slice-color-3": "#bc3333",
      "--slice-color-4": "#e78584",
      "--pin-color-1": "#ff8061",
      "--pin-color-2": "#F2F2F2",
    },
    background_image: {
      path: "static/images/templates/valentinesDay/background.jpg",
      style: "background-size: cover; background-position: center;",
    },
    image: {
      path: "",
      style: "",
    },
    top_image: {
      path: "static/images/templates/valentinesDay/top-image.png",
      style: "position:absolute;left:50%;top:1%;transform:translateX(-50%);width:340px;max-width:min(94%,760px);height:auto;max-height:28%;object-fit:contain;object-position:center top;pointer-events:none;",
    },
    bottom_image: {
      path: "static/images/templates/valentinesDay/bottom-image.png",
      style: "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:340px;max-width:min(94%,760px);height:auto;max-height:28%;object-fit:contain;object-position:center bottom;pointer-events:none;",
    },
},
  // black friday 1 — tema 101 ile aynı kabuk; üst/alt dekor görselleri korunur
  {
    id: 107,
    name: "Black Friday 1",
    categories: ["Holiday", "Dark"],
    popup_type: "gaming",
    hasGame: true,    thumbnail: "",
    gameID: 1,
    containerStyle: {
      "display": "flex",
      "flex-direction": "column",
      "align-items": "stretch",
      "justify-content": "flex-start",
      "width": "980px",
      "height": "580px",
      "background": "#c1d3e1",
      "border-radius": "16px",
      "box-shadow": "0 14px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)",
      "overflow": "hidden",
      "overflow-x": "hidden",
      "overflow-y": "auto",
      "box-sizing": "border-box",
      "position": "absolute",
      "z-index": "100",
    },
    layout: {
      type: "split",
      position: "left",
    },
    texts: {
      headline: default_text.headline,
      description: default_text.description,
      disclaimer: default_text.disclaimer,
    },
    text_styles: {
  headline: { ...default_text.styles.headline },
  description: { ...default_text.styles.description },
  disclaimer: { ...default_text.styles.disclaimer },
},
    close_button: {
      type: "icon",
      position: "top-right",
      style: "position:absolute; right:12px; top:10px; width:32px; height:32px; background:rgba(255,255,255,0.25); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.35); border-radius:50%; color:#1a1a1a; font-size:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10;",
    },
    game_styles: {
      game_svg: "display: block ; box-sizing: border-box ; max-width: 100% ; max-height: 100% ; width: auto ; height: auto ; flex-shrink: 1 ;",
      game_svg_area: "height: 80%",
      gameBackground: "#ffffff",
      gameOpacity: 0,
      game_svg_text: {
        "font-family": "Arial",
        "font-size": "26px"
      },
      left: {
        game: "order: 1 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ;height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      top: {
        game: "order: 1 ; flex: 0 0 auto ; width: 100% ; max-width: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      right: {
        game: "order: 2 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ; height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
    },
    content_styles: JSON.parse(JSON.stringify(default_content_styles)),
    image_styles: {
      left: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      top: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      right: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
    },
    input_fields: defaultGamingTemplateInputFields(),
    gameColors: {
      "--primary-color": "red",
      "--secondary-color": "#808080",
      "--text-color": "#F2F2F2",
      "--accent-color": "#00008B",
      "--background-color": "#303030",
      "--slice-color-1": "#fbcdcc",
      "--slice-color-2": "#610b0b",
      "--slice-color-3": "#ac302f",
      "--slice-color-4": "#da7d7e",
      "--pin-color-1": "#ff8061",
      "--pin-color-2": "#F2F2F2",
    },
    background_image: {
      path: "static/images/templates/black-friday1/background.jpg",
      style: "background-size: cover; background-position: center;",
    },
    image: {
      path: "",
      style: "",
    },
    top_image: {
      path: "static/images/templates/black-friday1/top-image.png",
      style: "position:absolute;left:50%;top:1%;transform:translateX(-50%);width:340px;max-width:min(93%,740px);height:auto;max-height:29%;object-fit:contain;object-position:center top;pointer-events:none;",
    },
    bottom_image: {
      path: "static/images/templates/black-friday1/bottom-image.png",
      style: "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:340px;max-width:min(93%,740px);height:auto;max-height:26%;object-fit:contain;object-position:center bottom;pointer-events:none;",
    },
},
{
  id: 108,
  name: "Black Friday 2",
  categories: ["Holiday", "Dark"],
  popup_type: "gaming",
  hasGame: true,  thumbnail: "",
  gameID: 1,
  containerStyle: {
    "display": "flex",
    "flex-direction": "column",
    "align-items": "stretch",
    "justify-content": "flex-start",
    "width": "980px",
    "height": "580px",
    "background": "#c1d3e1",
    "border-radius": "16px",
    "box-shadow": "0 14px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)",
    "overflow": "hidden",
    "overflow-x": "hidden",
    "overflow-y": "auto",
    "box-sizing": "border-box",
    "position": "absolute",
    "z-index": "100",
  },
  layout: {
    type: "split",
    position: "left",
  },
  texts: {
    headline: default_text.headline,
    description: default_text.description,
    disclaimer: default_text.disclaimer,
  },
  text_styles: {
  headline: { ...default_text.styles.headline },
  description: { ...default_text.styles.description },
  disclaimer: { ...default_text.styles.disclaimer },
},
  close_button: {
    type: "icon",
    position: "top-right",
    style: "position:absolute; right:12px; top:10px; width:32px; height:32px; background:rgba(255,255,255,0.25); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.35); border-radius:50%; color:#1a1a1a; font-size:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10;",
  },
  game_styles: {
    game_svg: "display: block ; box-sizing: border-box ; max-width: 100% ; max-height: 100% ; width: auto ; height: auto ; flex-shrink: 1 ;",
    game_svg_area: "height: 80%",
    gameBackground: "#ffffff",
    gameOpacity: 0,
    game_svg_text: {
      "font-family": "Arial",
      "font-size": "26px"
    },
    left: {
      game: "order: 1 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ;height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
      game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
    },
    top: {
      game: "order: 1 ; flex: 0 0 auto ; width: 100% ; max-width: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
      game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
    },
    right: {
      game: "order: 2 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ; height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
      game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
    },
  },
  content_styles: JSON.parse(JSON.stringify(default_content_styles)),
  image_styles: {
    left: {
      image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
      image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
    },
    top: {
      image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
      image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
    },
    right: {
      image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
      image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
    },
  },
  input_fields: defaultGamingTemplateInputFields(),
  gameColors: {
    "--primary-color": "#00C39A",
    "--secondary-color": "#86592c",
    "--text-color": "#F2F2F2",
    "--accent-color": "#00008B",
    "--background-color": "#eab853",
    "--slice-color-1": "#81562a",
    "--slice-color-2": "#dfaf4f",
    "--slice-color-3": "#81562a",
    "--slice-color-4": "#dfaf4f",
    "--pin-color-1": "#ff8061",
    "--pin-color-2": "#F2F2F2",
  },
  background_image: {
    path: "static/images/templates/black-friday2/background.jpg",
    style: "background-size: cover; background-position: center;",
  },
  image: {
    path: "",
    style: "",
  },
  top_image: {
    path: "static/images/templates/black-friday2/top-image.png",
    style: "position:absolute;left:50%;top:1%;transform:translateX(-50%);width:340px;max-width:min(91%,710px);height:auto;max-height:28%;object-fit:contain;object-position:center top;pointer-events:none;",
  },
  bottom_image: {
    path: "static/images/templates/black-friday2/bottom-image.png",
    style: "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:340px;max-width:min(91%,710px);height:auto;max-height:27%;object-fit:contain;object-position:center bottom;pointer-events:none;",
  },
},
  {
    id: 109,
    name: "Christmas",
    categories: ["Holiday", "Festive"],
    popup_type: "gaming",
    hasGame: true,    thumbnail: "",
    gameID: 1,
    containerStyle: {
      "display": "flex",
      "flex-direction": "column",
      "align-items": "stretch",
      "justify-content": "flex-start",
      "width": "980px",
      "height": "580px",
      "background": "#c1d3e1",
      "border-radius": "16px",
      "box-shadow": "0 14px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)",
      "overflow": "hidden",
      "overflow-x": "hidden",
      "overflow-y": "auto",
      "box-sizing": "border-box",
      "position": "absolute",
      "z-index": "100",
    },
    layout: {
      type: "split",
      position: "left",
    },
    texts: {
      headline: default_text.headline,
      description: default_text.description,
      disclaimer: default_text.disclaimer,
    },
    text_styles: {
  headline: { ...default_text.styles.headline },
  description: { ...default_text.styles.description },
  disclaimer: { ...default_text.styles.disclaimer },
},
    close_button: {
      type: "icon",
      position: "top-right",
      style: "position:absolute; right:12px; top:10px; width:32px; height:32px; background:rgba(255,255,255,0.25); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.35); border-radius:50%; color:#1a1a1a; font-size:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10;",
    },
    game_styles: {
      game_svg: "display: block ; box-sizing: border-box ; max-width: 100% ; max-height: 100% ; width: auto ; height: auto ; flex-shrink: 1 ;",
      game_svg_area: "height: 80%",
      gameBackground: "#ffffff",
      gameOpacity: 0,
      game_svg_text: {
        "font-family": "Arial",
        "font-size": "26px"
      },
      left: {
        game: "order: 1 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ;height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      top: {
        game: "order: 1 ; flex: 0 0 auto ; width: 100% ; max-width: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      right: {
        game: "order: 2 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ; height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
    },
    content_styles: JSON.parse(JSON.stringify(default_content_styles)),
    image_styles: {
      left: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      top: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      right: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
    },
    input_fields: defaultGamingTemplateInputFields(),
    gameColors: {
      "--primary-color": "#00C39A",
      "--secondary-color": "#9a000c",
      "--text-color": "#F2F2F2",
      "--accent-color": "#00008B",
      "--background-color": "#FFFFFF",
      "--slice-color-1": "#fbcdcc",
      "--slice-color-2": "#610b0b",
      "--slice-color-3": "#ac302f",
      "--slice-color-4": "#e78584",
      "--pin-color-1": "#ff8061",
      "--pin-color-2": "#F2F2F2",
    },
    background_image: {
      path: "static/images/templates/christmas/background.jpg",
      style: "background-size: cover; background-position: center;",
    },
    image: {
      path: "",
      style: "",
    },
    top_image: {
      path: "static/images/templates/christmas/top-image.png",
      style: "position:absolute;left:50%;top:1%;transform:translateX(-50%);width:340px;max-width:min(95%,780px);height:auto;max-height:30%;object-fit:contain;object-position:center top;pointer-events:none;",
    },
    bottom_image: {
      path: "static/images/templates/christmas/bottom-image.png",
      style: "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:340px;max-width:min(95%,780px);height:auto;max-height:25%;object-fit:contain;object-position:center bottom;pointer-events:none;",
    },
},
{
  id: 110,
  name: "Easter",
  categories: ["Holiday", "Spring"],
  popup_type: "gaming",
  hasGame: true,  thumbnail: "",
  gameID: 1,
  containerStyle: {
    "display": "flex",
    "flex-direction": "column",
    "align-items": "stretch",
    "justify-content": "flex-start",
    "width": "980px",
    "height": "580px",
    "background": "#c1d3e1",
    "border-radius": "16px",
    "box-shadow": "0 14px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)",
    "overflow": "hidden",
    "overflow-x": "hidden",
    "overflow-y": "auto",
    "box-sizing": "border-box",
    "position": "absolute",
    "z-index": "100",
  },
  layout: {
    type: "split",
    position: "left",
  },
  texts: {
    headline: default_text.headline,
    description: default_text.description,
    disclaimer: default_text.disclaimer,
  },
  text_styles: {
  headline: { ...default_text.styles.headline },
  description: { ...default_text.styles.description },
  disclaimer: { ...default_text.styles.disclaimer },
},
  close_button: {
    type: "icon",
    position: "top-right",
    style: "position:absolute; right:12px; top:10px; width:32px; height:32px; background:rgba(255,255,255,0.25); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.35); border-radius:50%; color:#1a1a1a; font-size:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10;",
  },
  game_styles: {
    game_svg: "display: block ; box-sizing: border-box ; max-width: 100% ; max-height: 100% ; width: auto ; height: auto ; flex-shrink: 1 ;",
    game_svg_area: "height: 80%",
    gameBackground: "#ffffff",
    gameOpacity: 0,
    game_svg_text: {
      "font-family": "Arial",
      "font-size": "26px"
    },
    left: {
      game: "order: 1 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ;height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
      game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
    },
    top: {
      game: "order: 1 ; flex: 0 0 auto ; width: 100% ; max-width: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
      game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
    },
    right: {
      game: "order: 2 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ; height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
      game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
    },
  },
  content_styles: JSON.parse(JSON.stringify(default_content_styles)),
  image_styles: {
    left: {
      image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
      image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
    },
    top: {
      image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
      image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
    },
    right: {
      image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
      image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
    },
  },
  input_fields: defaultGamingTemplateInputFields(),
  gameColors: {
    "--primary-color": "#00C39A",
    "--secondary-color": "#fff",
    "--text-color": "#F2F2F2",
    "--accent-color": "#00008B",
    "--background-color": "#04c39a",
    "--slice-color-1": "#fbcdcc",
    "--slice-color-2": "#eff5c9",
    "--slice-color-3": "#faa258",
    "--slice-color-4": "#8fc6c0",
    "--pin-color-1": "#ff8061",
    "--pin-color-2": "#F2F2F2",
  },
  background_image: {
    path: "static/images/templates/easter/background.jpg",
    style: "background-size: cover; background-position: center;",
  },
  image: {
    path: "",
    style: "",
  },
  top_image: {
    path: "static/images/templates/easter/top-image.png",
    style: "position:absolute;left:50%;top:1%;transform:translateX(-50%);width:340px;max-width:min(92%,720px);height:auto;max-height:28%;object-fit:contain;object-position:center top;pointer-events:none;",
  },
  bottom_image: {
    path: "",
    style: "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:min(89%,700px);max-height:23%;height:auto;object-fit:contain;object-position:center bottom;pointer-events:none;",
  },
},
  // mother day — tema 101 ile aynı kabuk; arka plan ve gameColors korunur
  {
    id: 111,
    name: "Mother Day",
    categories: ["Holiday", "Festive"],
    popup_type: "gaming",
    hasGame: true,    thumbnail: "",
    gameID: 1,
    containerStyle: {
      "display": "flex",
      "flex-direction": "column",
      "align-items": "stretch",
      "justify-content": "flex-start",
      "width": "980px",
      "height": "580px",
      "background": "#c1d3e1",
      "border-radius": "16px",
      "box-shadow": "0 14px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)",
      "overflow": "hidden",
      "overflow-x": "hidden",
      "overflow-y": "auto",
      "box-sizing": "border-box",
      "position": "absolute",
      "z-index": "100",
    },
    layout: {
      type: "split",
      position: "left",
    },
    texts: {
      headline: default_text.headline,
      description: default_text.description,
      disclaimer: default_text.disclaimer,
    },
    text_styles: {
  headline: { ...default_text.styles.headline },
  description: { ...default_text.styles.description },
  disclaimer: { ...default_text.styles.disclaimer },
},
    close_button: {
      type: "icon",
      position: "top-right",
      style: "position:absolute; right:12px; top:10px; width:32px; height:32px; background:rgba(255,255,255,0.25); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.35); border-radius:50%; color:#1a1a1a; font-size:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10;",
    },
    game_styles: {
      game_svg: "display: block ; box-sizing: border-box ; max-width: 100% ; max-height: 100% ; width: auto ; height: auto ; flex-shrink: 1 ;",
      game_svg_area: "height: 80%",
      gameBackground: "#ffffff",
      gameOpacity: 0,
      game_svg_text: {
        "font-family": "Arial",
        "font-size": "26px"
      },
      left: {
        game: "order: 1 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ;height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      top: {
        game: "order: 1 ; flex: 0 0 auto ; width: 100% ; max-width: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
      right: {
        game: "order: 2 ; flex: 0 0 60% ; width: 60% ; max-width: 60% ; height: 100% ; align-self: center ; display: flex ; flex-direction: column ; align-items: center ; justify-content: center ; box-sizing: border-box ; min-height: 0 ; position: relative ; overflow: hidden ;",
        game_inner: "width: 100% ; height: 100% ; min-height: 0 ; flex: 1 1 auto ; display: flex ; align-items: center ; justify-content: center ; box-sizing: border-box ; overflow: hidden ; padding: 8px ;height: 100%;",
      },
    },
    content_styles: JSON.parse(JSON.stringify(default_content_styles)),
    image_styles: {
      left: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      top: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
      right: {
        image: "display: flex ; flex-direction: column ; flex: 0 0 0 ; width: 0 ; max-width: 0 ; min-width: 0 ; overflow: hidden ; padding: 0 ; margin: 0 ;",
        image_inner: "display: none ; width: 0 ; height: 0 ; overflow: hidden ;",
      },
    },
    input_fields: defaultGamingTemplateInputFields(),
    gameColors: {
      "--primary-color": "#00C39A",
      "--secondary-color": "#FFFFFF",
      "--text-color": "#F2F2F2",
      "--accent-color": "#00008B",
      "--background-color": "#ff1672",
      "--slice-color-1": "#eac9ee",
      "--slice-color-2": "#eb2bb6",
      "--slice-color-3": "#f1a7fe",
      "--slice-color-4": "#c93251",
      "--pin-color-1": "#ff8061",
      "--pin-color-2": "#F2F2F2",
    },
    background_image: {
      path: "static/images/templates/mother-day/background.jpg",
      style: "background-size: cover; background-position: center;",
    },
    image: {
      path: "",
      style: "",
    },
    top_image: {
      path: "",
      style: "position:absolute;left:50%;top:0;transform:translateX(-50%);width:min(93%,730px);max-height:25%;height:auto;object-fit:contain;object-position:center top;pointer-events:none;",
    },
    bottom_image: {
      path: "",
      style: "position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:min(93%,730px);max-height:24%;height:auto;object-fit:contain;object-position:center bottom;pointer-events:none;",
    },
}

];

function getTemplateById(id) {
  return templates.find((item) => item.id === id);
}

function getTemplateObjectByName(name) {
  return templates.find((item) => item.name === name);
}

function getTemplateList() {
  return templates
    .filter((item) => item.id !== 101)
    .map((item) => ({ id: item.id, name: item.name }));
}

export {
  templates,
  getTemplateById,
  getTemplateObjectByName,
  getTemplateList,
  default_text,
  default_input_fields,
  defaultGamingTemplateInputFields
};


