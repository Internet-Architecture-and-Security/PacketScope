import React, { useEffect, useState } from 'react';
import { Splitter } from 'antd';
import PacketDetails from './PacketDetails_m';
import FunctionCallChainViewer from './FunctionCallChainViewer_m';
import ProtocolStackMonitor from './ProtocolStackMonitor_m';
import SocketViewer from './SocetViewer_m';
import { useTheme } from '@/stores/useStore';
import classNames from 'classnames';


const Monitor = () => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme === 'dark';
  const [contentListHeight, setContentListHeight] = useState<number>(0);
  const [queryParams, setQueryParams] = useState<{
    srcip: string;
    dstip: string;
    srcport: number;
    dstport: number;
    ipver?: number;
    protocol?: string;
  } | null>(null);
  // Update panel height on resize
  useEffect(() => {
    const updateHeight = () => {
      setTimeout(() => {
        const element = document.querySelector('.packetscope-list-panel');
        const height = element?.getBoundingClientRect().height;
        if (height) {
          setContentListHeight(height);
        }
      }, 6);
    };

    updateHeight(); // Initial height setup
    window.addEventListener('resize', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  // Handle the SocketViewer row click event
  const handleRowClick = (record: any) => {
    const [srcip, srcport] = record.src.split(':');
    const [dstip, dstport] = record.dist.split(':');
    const ipver = record.type === 'ipv4' ? 4 : 6;
    console.log('Row clicked:', record);

    // Get the request params from the record
    const params = {
      srcip: srcip || '',
      dstip: dstip || '',
      srcport: srcport || 0,
      dstport: dstport || 0,
      ipver: ipver || 4,
      protocol: record.protocol,
    };

    // Set the query params to trigger the data request of the PacketDetails component.
    setQueryParams(params);
    // setQueryParams({
    //   srcip: '127.0.0.54',
    //   dstip: '0.0.0.0',
    //   srcport: 53,
    //   dstport: 0,
    //   ipver: 4,
    // });
    console.log('Setting query params:', params);
  };

  return (
    <Splitter
      layout="vertical"
      onResize={(sizes: number[]) => {
        // adjust Splitter resize
        setContentListHeight(sizes[0]);
      }}
    >
      <Splitter.Panel defaultSize="65%" className={classNames("flex justify-center items-center packetscope-list-panel", { 'bg-gray-900': isDark, 'bg-white': !isDark })}>
        <SocketViewer contentHeight={contentListHeight} onRowClick={handleRowClick} />
      </Splitter.Panel>
      <Splitter.Panel collapsible>
        <Splitter>
          <Splitter.Panel collapsible className="flex justify-center items-center overflow-hidden">
            <PacketDetails queryParams={queryParams} />
          </Splitter.Panel>
          <Splitter.Panel collapsible className="flex justify-center items-center overflow-hidden">
            <FunctionCallChainViewer queryParams={queryParams} />
          </Splitter.Panel>
          <Splitter.Panel collapsible className="flex justify-center items-center overflow-hidden">
            <ProtocolStackMonitor queryParams={queryParams} />
          </Splitter.Panel>
        </Splitter>
      </Splitter.Panel>
    </Splitter>
  );
};

export default Monitor;
