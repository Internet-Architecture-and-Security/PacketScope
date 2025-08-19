import { IntlProvider } from 'react-intl';
import zh from '@/locales/zh-CN';
import en from '@/locales/en-US';
import ServiceReadinessGate from './ServiceReadinessGate';
import { useSelectLang } from '@/stores/useStore';
import { ConfigProvider, App } from 'antd';
// import { AliveScope } from 'react-activation';
import Theme from './Theme';
import { useTheme } from '@/stores/useStore';

import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';

console.log(zh, 'zh');
// 定义 messages 类型
interface Messages {
  'en-US': Record<string, string>;
  'zh-CN': Record<string, string>;
}

const messages: Messages = {
  'en-US': en,
  'zh-CN': zh,
};

export default function Layout() {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const { currentLang, defaultValue } = useSelectLang();
  const locale = (messages[currentLang as keyof Messages] ? currentLang : 'en-US') as keyof Messages;

  return (
    <ConfigProvider theme={{
      components: {
        Table: {
           headerBorderRadius:0,
          colorBgContainer: isDark ? '#1f2937' : '#fff',
          headerBg: 'transparent',
          headerSplitColor: isDark ? '#374151' : '#f0f0f0',
          borderColor: isDark ? '#374151' : '#f0f0f0',
        },
        Select: {
          colorBorder: isDark ? '#374151' : '#d9d9d9',
          colorBgElevated: isDark ? '#374151' : '#fff',
          colorBgContainer: isDark ? '#1f2937' : '#fff',
        },
        Tooltip: {
          colorBgSpotlight: isDark ? 'rgba(55,65,81, 0.95)' : 'rgba(0,0,0,0.85)',
        },
        Button: {
          defaultShadow: isDark ? '0 2px 0 rgba(55,65,81,0.02)' : '0 2px 0 rgba(0,0,0,0.02)',
          primaryShadow: isDark ? '0 2px 0 rgba(55,65,81,0.02)' : '0 2px 0 rgba(5,145,255,0.1)',
          colorBgContainer: isDark ? '#374151' : '#fff',
        },
        Popover: {
          colorBgElevated: isDark ? '#374151' : '#fff',
        },
        // Form: {
        //   colorBorder: isDark ? '#374151' : '#d9d9d9',
        //   colorBgContainer: isDark ? '#1f2937' : '#fff',
        // },
        Pagination: {
          colorBgContainer: isDark ? '#1f2937' : '#fff',
          colorBorder: isDark ? '#374151' : '#d9d9d9',
        },
        Modal: {
          colorBorder: isDark ? '#374151' : '#d9d9d9',
          colorBgElevated: isDark ? '#1f2937' : '#fff',
          colorBgContainer: isDark ? '#1f2937' : '#fff',
        },
        Radio: {
          colorBorder: isDark ? '#374151' : '#d9d9d9',
          colorBgContainer: isDark ? '#1f2937' : '#fff',
        },
        Input: {
          colorBorder: isDark ? '#374151' : '#d9d9d9',
          colorBgContainer: isDark ? '#1f2937' : '#fff',
        },
        InputNumber: {
          colorBorder: isDark ? '#374151' : '#d9d9d9',
          colorBgContainer: isDark ? '#1f2937' : '#fff',
          handleBg: isDark ? '#242d3d' : '#fff',
          hoverBorderColor: isDark ? '#5e6c82' : '#1d4ed8',
        },
        Menu: {
          colorBgContainer: isDark ? '#1f2937' : undefined,
          colorText: isDark ? '#d1d5db' : undefined,
          itemSelectedColor: isDark ? '#60a5fa' : '#3b82f6',
          // itemSelectedBg: isDark ? '#e6f4ff' : '#e6f4ff',
          colorItemBg: isDark ? 'transparent' : undefined,
        },
        Alert: {
          colorInfoBorder: isDark ? '#1e41a1' : '#91caff',
          colorInfoBg: isDark ? '#1c2a49' : '#e6f4ff',
          colorInfo: isDark ? '#3c89ff' : '#1677ff'
        },
        Notification: {
          colorBgElevated: isDark ? '#374151' : '#fff',
        },
        Message: {
          colorBgElevated: isDark ? '#374151' : '#fff',
        },
        Card: {
          colorBgContainer: isDark ? '#1f2937' : '#fff',
            colorBorderSecondary: isDark ? '#374151' : '#f0f0f0',
        },
        Tabs: {
            colorBorderSecondary: isDark ? '#374151' : '#f0f0f0',
        }
      }
    }} locale={currentLang === 'zh-CN' ? zhCN : enUS}>
      <IntlProvider locale={locale} defaultLocale={defaultValue} messages={messages[locale]}>
        <Theme>
          {/* <AliveScope> */}
          <App>
            <ServiceReadinessGate />
          </App>
          {/* </AliveScope> */}
        </Theme>
      </IntlProvider>
    </ConfigProvider>
  );
}
