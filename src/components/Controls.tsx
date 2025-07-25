import { useEffect, useState } from 'react';
import { useSelectLang, useTheme } from '@/stores/useStore';
import Icon from '@ant-design/icons';
import { Button, Flex, Divider, App, Tooltip } from 'antd';
import type { CustomIconComponentProps } from '@ant-design/icons/lib/components/Icon';
import { StarOutlined, StarFilled, StarTwoTone, CaretRightFilled, StopOutlined } from '@ant-design/icons';
import classnames from 'classnames';
// import recordSvg from '@/assets/record.svg?react';
import stopSvg from '@/assets/stop.svg?react';
import { useIsAutoScroll } from '@/stores/useStore';
import { usePollingManager } from '@/stores/usePollingManager';
import { useIntl } from 'react-intl';

import recordSvg from '@/assets/record.svg?react';
import clearSvg from '@/assets/clear.svg?react';
import stoprecordSvg from '@/assets/stoprecord.svg?react';
import filterSvg from '@/assets/filter.svg?react';
import autoSvg from '@/assets/auto.svg?react';
import helpSvg from '@/assets/help.svg?react';

const ClearIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={clearSvg} {...props} />;
const StoprecordIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={stoprecordSvg} {...props} />;
const RecordIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={recordSvg} {...props} />;
const FilterIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={filterSvg} {...props} />;
const AutoIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={autoSvg} {...props} />;
const HelpIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={helpSvg} {...props} />;

const Controls = () => {
  const intl = useIntl();
  const [isClearing, setIsClearing] = useState(false);
  const pollingManagerStore = usePollingManager();
  const { message } = App.useApp();
  // const [isAutoScroll, setIsAutoScroll] = useState(true);
  // const isAutoScrollStore = useIsAutoScroll();
  // const { locale, formatMessage } = useIntl();
  const { currentLang, setCurrentLang } = useSelectLang();
  // const { currentTheme } = useTheme();
  const isEN = currentLang === 'en-US';

  useEffect(() => {
    pollingManagerStore.setConfig('socket', {
      url: 'http://127.0.0.1:19999/QuerySockList',
    });
  }, []);

  const clickCallback = () => {
    const newLang = isEN ? 'zh-CN' : 'en-US';
    setCurrentLang(newLang);
  };

  // 清除数据的处理函数
  const handleClearData = async () => {
    try {
      setIsClearing(true);
      const response = await fetch('http://127.0.0.1:19999/ClearData', {
        method: 'GET',
      });

      if (response.ok) {
        // 清除本地store中的数据
        message.success(intl.formatMessage({ id: 'controls.clearSuccess' }));
      } else {
        message.error(intl.formatMessage({ id: 'controls.clearFailure' }));
      }
    } catch (error) {
      console.error('Clear data error:', error);
      message.error(intl.formatMessage({ id: 'controls.clearFailure' }));
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Flex gap={30} className="ml-5" align="center">
      <Button
        shape="circle"
        onClick={() => {
          pollingManagerStore.togglePolling('socket');
        }}
        className="border-0 text-[24px] h-full"
        ghost
        icon={
          pollingManagerStore.tasks['socket']?.isPolling ? (
            <Tooltip title={intl.formatMessage({ id: 'controls.stop' })}>
              <StoprecordIcon className="text-red-600" />
            </Tooltip>
          ) : (
            <Tooltip title={intl.formatMessage({ id: 'controls.start' })}>
              <RecordIcon className="text-zinc-700" />
            </Tooltip>
          )
        }
      />
      <Button
        shape="circle"
        className="border-0 text-[24px]"
        onClick={handleClearData}
        loading={isClearing}
        ghost
        icon={
          <Tooltip title={intl.formatMessage({ id: 'controls.clear' })}>
            <ClearIcon className="text-zinc-700" />
          </Tooltip>
        }
      />
      {/* <Divider type="vertical" className="h-[20px]" />
      <Button shape="circle" className="border-0 text-[24px]" ghost icon={<FilterIcon className="text-zinc-700" />} />
      <Button
        shape="circle"
        className="border-0 text-[24px]"
        onClick={isAutoScrollStore.toggleAutoScroll}
        ghost
        icon={<AutoIcon className={classnames(isAutoScrollStore.isAutoScroll ? 'text-blue-600' : 'text-zinc-700')} />}
      /> */}
      {/* <Divider type="vertical" className="h-[20px]" />
      <Button
        shape="circle"
        className="border-0 text-[24px]"
        ghost
        icon={
          <Tooltip title="帮助">
            <HelpIcon className="text-zinc-700" />
          </Tooltip>
        }
      /> */}
    </Flex>
  );
};

export default Controls;
