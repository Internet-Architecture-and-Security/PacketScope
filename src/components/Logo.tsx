import { Spin, Image, Flex, Typography } from 'antd';
import logoimg from '@/assets/logo2.png';
import React from 'react';

// const { Title } = Typography;
const Logo = ({ ...reset }) => (
  <Flex className="h-full ml-1.5" align="center">
    <Image height={30} width={19} src={logoimg} preview={false} ></Image>
    {/* <Title className="text-[20px]" level={1}>PacketScope</Title> */}
  </Flex>
);

export default Logo;
