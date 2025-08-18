import { Outlet, NavLink } from 'react-router';
import { useIntl } from 'react-intl';
import classnames from 'classnames';
import { Flex, Layout, Row, Col, Tooltip } from 'antd';
import DarkModeButton from '@/components/DarkModeButton';
// import FullScreen from '@/components/FullScreen';
import SelectLang from '@/components/SelectLang';
import Controls from '@/components/Controls';
import { useTheme } from '@/stores/useStore';
import Logo from '@/components/Logo';

import Icon from '@ant-design/icons';
import type { CustomIconComponentProps } from '@ant-design/icons/lib/components/Icon';
import monitorSvg from '@/assets/monitor.svg?react';
import locatorSvg from '@/assets/locator.svg?react';
import guarderSvg from '@/assets/guarder.svg?react';

const MonitorIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={monitorSvg} {...props} />;

const LocatorIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={locatorSvg} {...props} />;

const GuarderIcon = (props: Partial<CustomIconComponentProps>) => <Icon component={guarderSvg} {...props} />;

const { Header, Content } = Layout;

export default function LayoutComponent(props) {
  const { currentTheme } = useTheme();
  const intl = useIntl();
  console.log(currentTheme);
  return (
    <Layout className="relative h-screen w-screen overflow-hidden select-none">
      <Header
        className={classnames(
          `fixed top-0 leading-1 w-full px-3 border-b h-[var(--header-height)] z-10`,
          currentTheme === 'light' ? 'bg-slate-200 border-b-slate-300' : 'bg-slate-700 border-b-slate-600 text-slate-50',
        )}
      >
        {/* 顶栏 */}
        <Row className="h-full">
          <Col span={2}>
            <Logo></Logo>
          </Col>
          <Col span={18}>
            <Flex justify="flex-start" align="center" className="h-full" gap={20}>
              <Controls />
            </Flex>
          </Col>
          <Col span={4}>
            <Flex justify="flex-end" align="center" className="h-full" gap={20}>
              <SelectLang />
              <DarkModeButton />
            </Flex>
          </Col>
        </Row>
      </Header>
      <nav className={`fixed left-0 w-[56px] h-[calc(100vh-var(--header-height))] top-[var(--header-height)] z-10`}>
        <Flex
          vertical
          gap={0}
          className={classnames(
            'w-14 items-center font-bold text-3xl h-full border-r-[0]',
            currentTheme === 'light' ? 'bg-slate-200 border-r-slate-300' : 'bg-slate-700 border-b-slate-600 text-cyan-50',
          )}
        >
          {' '}
          <Tooltip title={intl.formatMessage({ id: 'sideBar.monitor' })} placement="right" mouseEnterDelay={1.5}>
            <NavLink
              to={'/'}
              className={({ isActive, isPending, isTransitioning }) =>
                classnames(
                  'block w-full h-[60px] flex justify-center',
                  isActive ? 'bg-[linear-gradient(135deg,#6253e1,#04befe)] text-amber-50' : 'text-[#4096ff]',
                )
              }
            >
              <MonitorIcon className="font-bold text-3xl" />
            </NavLink>
          </Tooltip>
          <Tooltip title={intl.formatMessage({ id: 'sideBar.guarder' })} placement="right" mouseEnterDelay={1.5}>
            <NavLink
              to={'/guarder'}
              className={({ isActive, isPending, isTransitioning }) =>
                classnames(
                  'block w-full h-[60px] flex justify-center',
                  isActive ? 'bg-[linear-gradient(135deg,#6253e1,#04befe)] text-amber-50' : 'text-[#4096ff]',
                )
              }
            >
              <GuarderIcon />
            </NavLink>
          </Tooltip>
          <Tooltip title={intl.formatMessage({ id: 'sideBar.Locator' })} placement="right" mouseEnterDelay={1.5}>
            <NavLink
              to={'/locator'}
              className={({ isActive, isPending, isTransitioning }) =>
                classnames(
                  'block w-full h-[60px] flex justify-center',
                  isActive ? 'bg-[linear-gradient(135deg,#6253e1,#04befe)] text-amber-50' : 'text-[#4096ff]',
                )
              }
            >
              <LocatorIcon />
            </NavLink>
          </Tooltip>
        </Flex>
      </nav>
      <Content className={`relative h-full w-full pt-[var(--header-height)] pl-[var(--sidebar-width)]`}>
        <div className="h-full w-full overflow-auto will-change-scroll">
          <Outlet></Outlet>
        </div>
      </Content>
    </Layout>
  );
}
