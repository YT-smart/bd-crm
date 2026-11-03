import type { GlobalThemeOverrides } from 'naive-ui';

const FONT =
  "'Inter Variable', 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Source Han Sans SC', 'Microsoft YaHei', sans-serif";

/** Naive UI 主题覆盖：与 styles/index.css 中的 CSS 变量保持一致 */
export function getThemeOverrides(dark: boolean): GlobalThemeOverrides {
  const brand = dark
    ? { primaryColor: '#5C7CFA', primaryColorHover: '#748FFC', primaryColorPressed: '#4C6EF5', primaryColorSuppl: '#748FFC' }
    : { primaryColor: '#3B5BDB', primaryColorHover: '#4C6EF5', primaryColorPressed: '#364FC7', primaryColorSuppl: '#4C6EF5' };

  return {
    common: {
      ...brand,
      fontFamily: FONT,
      fontSize: '14px',
      fontSizeMedium: '14px',
      borderRadius: '8px',
      borderRadiusSmall: '6px',
      heightMedium: '36px',
      successColor: dark ? '#51CF66' : '#2F9E44',
      warningColor: dark ? '#FFA94D' : '#E67700',
      errorColor: dark ? '#FF6B6B' : '#E03131',
      infoColor: dark ? '#4DABF7' : '#1C7ED6',
      textColorBase: dark ? '#E8EAF0' : '#0F172A',
      textColor1: dark ? '#E8EAF0' : '#0F172A',
      textColor2: dark ? '#A3ABBD' : '#475467',
      textColor3: dark ? '#6B7385' : '#8A94A6',
      borderColor: dark ? '#232733' : '#E6E8EC',
      dividerColor: dark ? '#232733' : '#E6E8EC',
      bodyColor: dark ? '#0B0D12' : '#F6F7F9',
      cardColor: dark ? '#13161D' : '#FFFFFF',
      modalColor: dark ? '#13161D' : '#FFFFFF',
      popoverColor: dark ? '#191D26' : '#FFFFFF',
      tableColor: dark ? '#13161D' : '#FFFFFF',
      inputColor: dark ? '#0F1117' : '#FFFFFF',
      hoverColor: dark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
    },
    DataTable: {
      thColor: dark ? '#13161D' : '#FAFBFC',
      thTextColor: dark ? '#A3ABBD' : '#475467',
      thFontWeight: '500',
      tdColorHover: dark ? '#191D26' : '#F8F9FB',
      borderColor: dark ? '#232733' : '#EEF0F3',
      thPaddingMedium: '12px 16px',
      tdPaddingMedium: '13px 16px',
      thPaddingSmall: '10px 16px',
      tdPaddingSmall: '11px 16px',
    },
    Button: {
      fontWeight: '500',
    },
    Card: {
      borderRadius: '12px',
    },
    Input: {
      borderHover: dark ? '1px solid #2F3443' : '1px solid #C7CDD6',
    },
    Tooltip: {
      borderRadius: '6px',
    },
  };
}
