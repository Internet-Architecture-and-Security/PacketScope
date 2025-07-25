import { useState, useEffect } from 'react';
// import { Outlet } from 'react-router';
import { Layout, Result, Button, Flex, Typography, Image } from 'antd';
import { SecurityScanOutlined, WifiOutlined, ReloadOutlined } from '@ant-design/icons';
import LayoutComponent from './LayoutComponent';
import { useIntl } from 'react-intl';
import logo from '@/assets/newlogo.png';
// import Logo from '@/assets/newlogo.svg?react';
import axios from 'axios';

const { Title, Paragraph } = Typography;

const POLLING_INTERVAL = 5000; // Poll every 3 seconds
const REQUEST_TIMEOUT = 8000; // 5 seconds timeout
const API_URL = 'http://127.0.0.1:19999/IsAttachFinished';

// 自定义 Loading 组件
const CustomLoading = () => (
  <div className="relative w-16 h-16 mx-auto">
    {/* 外圈旋转 */}
    <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-cyan-400 border-r-cyan-400 rounded-full animate-spin" />
    {/* 内圈反向旋转 */}
    <div className="absolute inset-2 w-12 h-12 border-4 border-transparent border-b-blue-500 border-l-blue-500 rounded-full animate-spin-reverse" />
    {/* 中心点 */}
    <div className="absolute inset-6 w-4 h-4 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-full animate-pulse" />
  </div>
);

export default function ServiceReadinessGate() {
  const intl = useIntl();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isTimeout, setIsTimeout] = useState(false);

  // 产品的核心价值点
  const PRODUCT_PAIN_POINTS = [
    intl.formatMessage({ id: 'ServiceReadinessGate.productValue1' }),
    intl.formatMessage({ id: 'ServiceReadinessGate.productValue2' }),
    intl.formatMessage({ id: 'ServiceReadinessGate.productValue3' }),
  ];

  // 创建 axios 实例
  const apiClient = axios.create({
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // 轮询后端服务状态的 Effect
  useEffect(() => {
    if (isReady || error) return;

    const checkServiceStatus = async () => {
      try {
        setIsTimeout(false);
        const response = await apiClient.get(API_URL);

        if (response.status === 200) {
          const data = response.data;
          if (Array.isArray(data) && data[0] === true) {
            setIsReady(true);
            setError(null);
            clearInterval(intervalId);
          }
        } else {
          throw new Error(intl.formatMessage(
            { id: 'ServiceReadinessGate.serviceResponseError' },
            { status: response.status }
          ));
        }
      } catch (e) {
        let errorMessage = intl.formatMessage({ id: 'ServiceReadinessGate.serviceConnectionFailed' });

        if (e.code === 'ECONNABORTED' || e.message.includes('timeout')) {
          setIsTimeout(true);
          errorMessage = intl.formatMessage({ id: 'ServiceReadinessGate.requestTimeout' });
        } else if (e.code === 'ECONNREFUSED') {
          errorMessage = intl.formatMessage({ id: 'ServiceReadinessGate.connectionRefused' });
        } else if (e.code === 'ENOTFOUND') {
          errorMessage = intl.formatMessage({ id: 'ServiceReadinessGate.hostNotFound' });
        } else if (e.response) {
          errorMessage = intl.formatMessage(
            { id: 'ServiceReadinessGate.serverError' },
            { status: e.response.status, statusText: e.response.statusText }
          );
        } else if (e.request) {
          errorMessage = intl.formatMessage({ id: 'ServiceReadinessGate.networkError' });
        } else {
          errorMessage = e.message || intl.formatMessage({ id: 'ServiceReadinessGate.unknownError' });
        }

        setError(errorMessage);
        clearInterval(intervalId);
      }
    };

    checkServiceStatus();
    const intervalId = setInterval(checkServiceStatus, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [isReady, error, intl]);

  // 循环显示产品价值点的 Effect
  useEffect(() => {
    if (!isReady && !error) {
      const tipInterval = setInterval(() => {
        setCurrentTipIndex((prevIndex) => (prevIndex + 1) % PRODUCT_PAIN_POINTS.length);
      }, 4000); // 每4秒切换一次提示
      return () => clearInterval(tipInterval);
    }
  }, [isReady, error, PRODUCT_PAIN_POINTS.length]);

  // 重试函数
  const handleRetry = () => {
    setError(null);
    setIsTimeout(false);
    setIsReady(false);
  };

  // 1. 错误状态: 服务不可达
  if (error) {
    return (
      <Layout className="h-screen w-screen bg-slate-900">
        <Flex align="center" justify="center" className="h-full">
          <Result
            status="error"
            icon={isTimeout ? <WifiOutlined style={{ color: '#ff4d4f' }} /> : <SecurityScanOutlined style={{ color: '#ff4d4f' }} />}
            title={
              <Title level={3} className="text-red-400">
                {isTimeout 
                  ? intl.formatMessage({ id: 'ServiceReadinessGate.connectionTimeout' })
                  : intl.formatMessage({ id: 'ServiceReadinessGate.serviceUnavailable' })
                }
              </Title>
            }
            subTitle={
              <div className="text-slate-400">
                <p>{error}</p>
                {isTimeout && (
                  <div className="mt-4 text-sm">
                    <p>{intl.formatMessage({ id: 'ServiceReadinessGate.troubleshootTip1' })}</p>
                    <p>{intl.formatMessage({ id: 'ServiceReadinessGate.troubleshootTip2' })}</p>
                    <p>{intl.formatMessage({ id: 'ServiceReadinessGate.troubleshootTip3' })}</p>
                  </div>
                )}
              </div>
            }
            extra={
              <Button
                type="primary"
                danger
                icon={<ReloadOutlined />}
                onClick={handleRetry}
                className="bg-red-600 hover:bg-red-700 border-red-600"
              >
                {intl.formatMessage({ id: 'ServiceReadinessGate.retryConnection' })}
              </Button>
            }
          />
        </Flex>
      </Layout>
    );
  }

  // 2. 准备就绪状态: 渲染主应用
  if (isReady) {
    return <LayoutComponent />;
  }

  // 3. 加载状态: 富有科技感的等待界面
  return (
    <Layout className="h-screen w-screen bg-slate-900 overflow-hidden">
      <Flex align="center" justify="center" vertical className="h-full text-center text-slate-300 relative">
        {/* 背景装饰性光晕 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-900 via-sky-800 to-purple-900 rounded-full blur-3xl opacity-30 animate-pulse" />

        <div className="z-10">
          <Image
            src={logo}
            width={150}
            height={183}
            className="relative top-[-2px]"
            preview={false}
            placeholder={
              <Image
                preview={false}
                className="blur-sm"
                src={
                  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAfCAYAAAASsGZ+AAADzUlEQVR42mIgCBr+CwBKLQco2dUlCn/vXdu2bdu2bdu2zWPbtj0+tm1r0EmnZ999PFZ/a+1VKfxVccJ3+sBK4xutt83nWy21evCDHqWttiMZ3PB+a4WbabOW259lu57v7Vv8qHH2T6dK/KRXLblJZFVz85MKHN3/+VmXO9/TOdmutS6gUvyqK/hFkbXOi6+mDDzsfUuuXeiB+1EhpP/xu8bym2R7dwV36u9N9bYVPoq/JKsvFeUX7eH6Vfyj9fypXSiXmvqBah7yr560fdTKsFq4ydGURXU1xOtsr6NcaqiNB8lDztp8kXektrpSS0ucO6KMnXvDdfKQVyiXOupAXRfX3Ho3Yf80S9RXA0rBuedxjde/Q7k0Vk0aSrY3bo010s6WHJ9ZxrrvaLCx5hHKpZmvRVMXN9c/BY5uL5pIzk0vY90oS96ZoymXtm7YSus361AMrXUWLSRaqgsl4LrbnJNtChWmnb7yMFlDrV1or0cck/UtRfDwYx1fsjl/NRWmjnago4bQSbJ9mQ76xVYedh8F6aw7HF9iCddQabpoD7qqk3UB3dTbVh563ObmR9jPdI1sRQ8P8JuCpOiZWGKt29qot86yL3pqEb3i15E0/XUQffJF3yilwM2xI30SoWPTMckzUDcxIBIDoxoUZEBijGP5DNLuJM3gxIcM8ZDU8AUKkhI2ISUhhsQvJWlSghakBvKQCyhIeuId0kKREb5K0mSFE62ItCKv8My8a8n0kKxYHZJikHZmZBAxIpxEUTLX7ceIQFYmSTEqPJ8xgaxWlMToYL6Vg/R/qsz48DnGBbI+KjkfdGPsxvzJVJkJYTUmxGQtZ2LeTMbHZmDZn4nFxNz1TAjkYQ9RZSbH2rl5aBtncl6cSdbk3DgTA8vWcccCpsTeokz8QcIU/Kfa+lT/qz0pDd9tTHRNWX89BT6t7amjr6ivc7Z+12vqWPytpobecm5Xx4/jT51GPT1ELccHWP3ye9BDBzNSxzMgdhxp4YUM0THWEaToCgzDwrNIiZ2Em/Xw4jrU1htu2tEDvqOa/rS927kRHvCp/SberuntlvylP8jUPYxWM4ZHj5CZqEdq4g3SoqakxP+yX5NhibqkRNWt9gwJfsMN+vCDDrH92urgRj/b/mT7CP+oq4/gGzeuzh96m990B9/rH8avv5pJ0VBG6WOGx/8kPfYGWWFD0oIfPawaHkS63iFDjRgWPID3fneMG+1NTZ2JccMj7B8NPq+2HrQLP+s0Bml7PrafofOY4lNjGJR7OKnrD3TsBPpoNzI9NDO6DUMfx306/wPoosThI6ul3AAAAABJRU5ErkJggg=='
                }
                width={150}
                height={183}
              ></Image>
            }
          ></Image>
          {/* <Title level={1} className="font-bold tracking-wider mb-4">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">PacketScope</span>
          </Title> */}
          {/* <Logo/> */}
          <Paragraph className="text-slate-300 text-xl font-bold mb-12">
            {intl.formatMessage({ id: 'ServiceReadinessGate.tagline' })}
          </Paragraph>

          {/* 自定义 Loading 动画 */}
          <CustomLoading />

          <Paragraph className="text-slate-400 mt-6 text-base">
            {intl.formatMessage({ id: 'ServiceReadinessGate.startingCoreServices' })}
          </Paragraph>

          {/* 动态提示文案 */}
          <div className="h-10 flex items-center justify-center mt-8">
            <p key={currentTipIndex} className="text-slate-500 transition-opacity duration-500 animate-fade-in-out">
              {PRODUCT_PAIN_POINTS[currentTipIndex]}
            </p>
          </div>
        </div>
      </Flex>
    </Layout>
  );
}