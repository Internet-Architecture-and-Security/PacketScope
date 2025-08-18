import { FC } from 'react';
import { Switch, SwitchProps } from 'antd';
import { useTheme } from '@/stores/useStore';
import Icon from '@ant-design/icons';
import type { CustomIconComponentProps } from '@ant-design/icons/lib/components/Icon';
import lightSvg from '@/assets/light.svg?react';
import darkSvg from '@/assets/dark.svg?react';

const LightIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={lightSvg} {...props} />;

const DarkIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={darkSvg} {...props} />;

const DarkModeButton: FC<SwitchProps> = (props) => {
  const { setCurrentTheme, currentTheme } = useTheme();
  return (
    <Switch
      // className="leading-none"
      checkedChildren={<LightIcon style={{ fontSize: 18, marginTop: 2 }} />}
      unCheckedChildren={<DarkIcon style={{ fontSize: 16 }} />}
      defaultChecked={currentTheme === 'light'}
      onChange={(value) => {
        setCurrentTheme(value ? 'light' : 'dark');
      }}
      {...props}
    />
  );
};

export default DarkModeButton;
