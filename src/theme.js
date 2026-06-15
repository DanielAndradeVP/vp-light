export const theme = {
  colors: {
    bg: '#26363c',
    bgDark: '#1d2b30',
    bgDarker: '#000000',
    surface: '#35484f',
    surfaceAlt: '#2d3f45',
    surfaceRaised: '#40545c',
    panel: '#35484f',
    panelDark: '#24343a',
    border: '#8db8b8',
    borderSoft: '#5f8588',
    borderStrong: '#b7dede',
    text: '#ffffff',
    textSecondary: '#c8dddd',
    textMuted: '#9bb4b7',
    textDisabled: '#6f8588',
    buttonBg: '#000000',
    buttonSurface: '#233237',
    buttonHover: '#30464d',
    primary: '#8db8b8',
    accent: '#00d000',
    warn: '#ff3333',
    danger: '#cc2222',
    active: '#00ff00',
    focus: '#8db8b8',
    selection: '#4e6b73',
    gridLine: '#b7c7c9',
    gridMesh: 'rgba(255,255,255,0.12)',
    primaryOverlay: 'rgba(141,184,184,.18)',
    accentOverlay: 'rgba(0,208,0,.16)',
    warnOverlay: 'rgba(255,51,51,.18)',
    hover: '#5f8588',
    scenePalette: ['#000000', '#cc0000', '#00aa00', '#0000cc', '#cccc00', '#00cccc', '#aa00aa', '#cc6600']
  },
  typography: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    compact: { fontSize: '11px' },
    toolbar: { fontSize: '14px', fontWeight: 700 },
    toolbarLarge: { fontSize: '14px', fontWeight: 700 },
    button: { fontSize: '12px', fontWeight: 700 },
    cardTitle: { fontSize: '14px', fontWeight: 700 },
    title: { fontSize: '14px', fontWeight: 700 },
    body: { fontSize: '12px' },
    label: { fontSize: '11px' },
    tableHeader: { fontSize: '14px', fontWeight: 400 },
    tableCell: { fontSize: '13px' },
    tooltip: { fontSize: '10px' },
    chip: { fontSize: '11px' },
    sliderThumb: { fontSize: '12px', fontWeight: 700 }
  },
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
    formFieldPaddingBottom: '1.25em',
    inputPadding: '4px 6px',
    inputMarginTop: '0'
  },
  radius: {
    none: 0,
    sm: 1,
    md: 2
  },
  borders: {
    thin: '1px solid #8db8b8',
    soft: '1px solid #5f8588',
    strong: '2px solid #b7dede',
    button: '1px solid #ffffff',
    grid: '1px solid #b7c7c9'
  },
  elevation: {
    none: 'none',
    panel: 'none',
    raised: 'none',
    modal: '0 4px 12px rgba(0,0,0,.65)',
    z1: 'none',
    z2: 'none',
    z4: 'none',
    z6: 'none',
    z8: 'none'
  },
  layout: {
    topBarHeight: 26,
    bottomSceneHeight: 56,
    bottomFKeyHeight: 40,
    rightPanelWidth: 320,
    leftPanelWidth: 96
  },
  components: {
    button: {
      background: '#000000',
      color: '#ffffff',
      border: '1px solid #ffffff',
      borderRadius: 0,
      minHeight: 32,
      padding: '4px 8px',
      fontSize: 12,
      fontWeight: 700
    },
    sceneButton: {
      background: '#000000',
      color: '#ffffff',
      border: '1px solid #ffffff',
      activeBorder: '2px solid #ffffff',
      minHeight: 52
    },
    fKeyButton: {
      background: '#000000',
      color: '#ffffff',
      border: '1px solid #ffffff',
      minHeight: 36,
      focusOutline: 'none'
    },
    panel: {
      background: '#35484f',
      border: '1px solid #8db8b8'
    },
    table: {
      background: '#4a5d64',
      headerBackground: '#1d2b30',
      border: '1px solid #b7c7c9',
      rowBorder: '1px solid #b7c7c9'
    },
    modal: {
      background: '#26363c',
      border: '1px solid #8db8b8',
      color: '#ffffff',
      overlay: 'rgba(0,0,0,.65)'
    }
  }
};

export default theme;
