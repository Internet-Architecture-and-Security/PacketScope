import React from 'react';
import { useSelectLang, useTheme } from '@/stores/useStore';
import Icon from '@ant-design/icons';
import type { CustomIconComponentProps } from '@ant-design/icons/lib/components/Icon';
import classNames from 'classnames';
import enSvg from '@/assets/en.svg?react';
import cnSvg from '@/assets/cn.svg?react';

const EnIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={enSvg} {...props} />;

const CnIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={cnSvg} {...props} />;

const SelectLang = () => {
  // const { locale, formatMessage } = useIntl();
  const { currentLang, setCurrentLang } = useSelectLang();
  const { currentTheme } = useTheme();
  const isEN = currentLang === 'en-US';

  const clickCallback = () => {
    const newLang = isEN ? 'zh-CN' : 'en-US';
    setCurrentLang(newLang);
  };

  return (
    <span
      className={classNames('cursor-pointer text-2xl', currentTheme === 'dark' ? 'text-[#e6f7ff]' : 'text-[#4096ff]')}
      onClick={clickCallback}
    >
      {isEN ? <EnIcon /> : <CnIcon />}
    </span>
  );
};

export default SelectLang;
