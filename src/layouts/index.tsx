import { IntlProvider } from 'react-intl';
import zh from '@/locales/zh-CN';
import en from '@/locales/en-US';
import ServiceReadinessGate from './ServiceReadinessGate';
import { useSelectLang } from '@/stores/useStore';
import { ConfigProvider, App } from 'antd';
// import { AliveScope } from 'react-activation';
import Theme from './Theme';

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
  const { currentLang, defaultValue } = useSelectLang();
  const locale = (messages[currentLang as keyof Messages] ? currentLang : 'en-US') as keyof Messages;

  return (
    <ConfigProvider locale={currentLang === 'zh-CN' ? zhCN : enUS}>
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
