// /FunctionCallChainViewer/useFunctionCallData.ts

import { useState, useEffect, useRef } from 'react';
import { App } from 'antd';
import { useIntl } from 'react-intl';
import { QueryParams, FuncTable } from './types';
import { APIs } from '@/constants/APs';

export function useFunctionCallData(queryParams: QueryParams | null) {
  const intl = useIntl();
  const { message } = App.useApp();
  const receiveChainName = intl.formatMessage({ id: 'FunctionCallChainViewer.receiveFunctionChain' });
  const sendChainName = intl.formatMessage({ id: 'FunctionCallChainViewer.sendFunctionChain' });

  const [chainData, setChainData] = useState({
    [receiveChainName]: null,
    [sendChainName]: null,
  });
  const [funcTable, setFuncTable] = useState<FuncTable>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isCheckedRef = useRef<boolean>(false);
  const [isClickedAllChains, setIsClickedAllChains] = useState<boolean>(false);

  const fetchFuncTable = async () => {
    try {
      const res = await fetch(APIs['Tracer.getFuncTable'], { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setFuncTable(data);
    } catch (err) {
      console.error(intl.formatMessage({ id: 'FunctionCallChainViewer.fetchFuncTableFailed' }), err);
      message.error(intl.formatMessage({ id: 'FunctionCallChainViewer.fetchFuncTableFailed' }));
    }
  };

  const fetchChainData = async (params: QueryParams) => {
    if (!params?.srcip) {
      message.warning(intl.formatMessage({ id: 'FunctionCallChainViewer.missingParams' }));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new URLSearchParams();
      formData.append('srcip', params.srcip);
      formData.append('dstip', params.dstip);
      formData.append('srcport', String(params.srcport));
      formData.append('dstport', String(params.dstport));
      formData.append('count', String(params.count ?? 1));

      const res = await fetch(APIs['Tracer.getRecentMap'], { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      const data = await res.json();
      const newData = {
        [receiveChainName]: data[0],
        [sendChainName]: data[1],
      };
      setChainData(newData);

      if (params.count && params.count > 1) {
        isCheckedRef.current = true;
        setIsClickedAllChains(true);
      } else {
        isCheckedRef.current = false;
        setIsClickedAllChains(false);
      }
      return newData;
    } catch (err: any) {
      const errorMsg = intl.formatMessage({ id: 'FunctionCallChainViewer.fetchChainDataFailed' });
      console.error(errorMsg, err);
      setError(`${errorMsg}: ${err.message}`);
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (queryParams) {
      fetchFuncTable();
      fetchChainData(queryParams);
    }
  }, [queryParams]);
  
  return {
    chainData,
    funcTable,
    loading,
    error,
    fetchChainData,
    receiveChainName,
    sendChainName,
    isClickedAllChains,
    setIsClickedAllChains,
  };
}