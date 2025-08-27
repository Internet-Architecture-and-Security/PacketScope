// useFilters.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { IntlShape } from 'react-intl';
import { type MessageInstance } from 'antd/es/message/interface';
import { APIs } from '@/constants';

export interface Filter {
  id: number;
  rule_type: 'basic' | 'tcp' | 'udp' | 'icmp';
  src_ip?: string;
  dst_ip?: string;
  src_port?: number;
  dst_port?: number;
  protocol?: string;
  action: 'allow' | 'drop';
  enabled: boolean;
  comment?: string;
  ai_generated?: boolean;
  ai_confidence?: number;
  ai_reason?: string;
  tcp_flags?: number;
  tcp_flags_mask?: number;
  icmp_type?: number;
  icmp_code?: number;
  inner_src_ip?: string;
  inner_dst_ip?: string;
  inner_protocol?: number | string;
}

interface FilterState {
  filters: Filter[];
  initFilters: (messageApi?: MessageInstance, intl?: IntlShape) => Promise<void>;
  fetchFilters: (messageApi?: MessageInstance, intl?: IntlShape) => Promise<void>;
  addFilter: (filter: Partial<Filter>, messageApi?: MessageInstance, intl?: IntlShape) => Promise<void>;
  updateFilter: (id: number, filter: Partial<Filter>, messageApi?: MessageInstance, intl?: IntlShape) => Promise<void>;
  deleteFilter: (id: number, messageApi?: MessageInstance, intl?: IntlShape) => Promise<void>;
  toggleFilter: (id: number, messageApi?: MessageInstance, intl?: IntlShape) => Promise<void>;
}


export const useFiltersStore = create<FilterState>()(
  devtools((set, get) => ({
    filters: [],
    initFilters: async (messageApi, intl) => {
      try {
        const res = await fetch(APIs['Guarder.filters']);
        if (!res.ok) throw new Error('接口错误');
        const data: Filter[] = await res.json();
        if (data.length === 0) {
          await get().addFilter({
            rule_type: 'icmp',
            protocol: 'icmp',
            icmp_type: 8,
            icmp_code: 0,
            action: 'drop',
            enabled: false,
            comment: intl?.formatMessage({ id: 'useFilters.blockIcmpPing' }) || 'Block all ICMP ping requests (Echo Request)',
          });
          await get().addFilter({
            rule_type: 'icmp',
            protocol: 'icmp',
            icmp_type: 3,
            inner_protocol: 'udp',
            action: 'drop',
            enabled: false,
            comment: intl?.formatMessage({ id: 'useFilters.blockIcmpDestUnreachable' }) || 'Block ICMP Destination Unreachable with inner UDP packets',
          });
          await get().addFilter({
            rule_type: 'icmp',
            protocol: 'icmp',
            icmp_type: 11,
            inner_protocol: 'udp',
            action: 'drop',
            enabled: false,
            comment: intl?.formatMessage({ id: 'useFilters.blockUdpTraceroute' }) || 'Block UDP traceroute attempts (ICMP Time Exceeded)',
          });
          await get().addFilter({
            rule_type: 'tcp',
            protocol: 'tcp',
            dst_port: 23,
            action: 'drop',
            enabled: false,
            comment: intl?.formatMessage({ id: 'useFilters.blockTelnet' }) || 'Block Telnet (insecure remote access)',
          });
          await get().addFilter({
            rule_type: 'tcp',
            protocol: 'tcp',
            dst_port: 135,
            action: 'drop',
            enabled: false,
            comment: intl?.formatMessage({ id: 'useFilters.blockRpcEndpoint' }) || 'Block RPC Endpoint Mapper (Windows vulnerability)',
          });
          await get().addFilter({
            rule_type: 'tcp',
            protocol: 'tcp',
            dst_port: 445,
            action: 'drop',
            enabled: false,
            comment: intl?.formatMessage({ id: 'useFilters.blockSmbCifs' }) || 'Block SMB/CIFS (ransomware vector)',
          });
          await get().addFilter({
            rule_type: 'tcp',
            protocol: 'tcp',
            dst_port: 139,
            action: 'drop',
            enabled: false,
            comment: intl?.formatMessage({ id: 'useFilters.blockNetbios' }) || 'Block NetBIOS Session Service',
          });
          await get().addFilter({
            rule_type: 'tcp',
            protocol: 'tcp',
            dst_port: 1433,
            action: 'drop',
            enabled: false,
            comment: intl?.formatMessage({ id: 'useFilters.blockMsSqlServer' }) || 'Block MS SQL Server (external access)',
          });
          await get().addFilter({
            rule_type: 'tcp',
            protocol: 'tcp',
            dst_port: 3389,
            action: 'drop',
            enabled: false,
            comment: intl?.formatMessage({ id: 'useFilters.blockRdp' }) || 'Block RDP (brute force target)',
          });
          await get().addFilter({
            rule_type: 'tcp',
            protocol: 'tcp',
            dst_port: 5900,
            action: 'drop',
            enabled: false,
            comment: intl?.formatMessage({ id: 'useFilters.blockVnc' }) || 'Block VNC (insecure remote access)',
          });
        }
      } catch (err) {
        messageApi?.error(intl?.formatMessage({ id: 'useFilters.fetchFiltersFailed' }) || '获取过滤器失败');
        console.error(err);
      }
    },

    fetchFilters: async (messageApi, intl) => {
      try {
        const res = await fetch(APIs['Guarder.filters']);
        if (!res.ok) throw new Error('接口错误');
        const data: Filter[] = await res.json();
        const newFilters = data
          .map((item) => ({ ...item, key: item.id, ai_generated: item.comment?.includes('AI') }))
          .sort((a, b) => b.id - a.id);
        set({ filters: newFilters });
      } catch (err) {
        messageApi?.error(intl?.formatMessage({ id: 'useFilters.fetchFiltersFailed' }) || '获取过滤器失败');
        console.error(err);
      }
    },

    addFilter: async (filter, messageApi, intl) => {
      try {
        const res = await fetch(APIs['Guarder.filters'], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filter),
        });
        if (!res.ok) throw new Error('添加失败');
        messageApi?.success(intl?.formatMessage({ id: 'useFilters.addSuccess' }) || '添加成功');
        await get().fetchFilters(messageApi, intl);
      } catch (err) {
        messageApi?.error(intl?.formatMessage({ id: 'useFilters.addFilterFailed' }) || '添加过滤器失败');
        console.error(err);
      }
    },

    updateFilter: async (id, filter, messageApi, intl) => {
      try {
        const res = await fetch(`${APIs['Guarder.filters']}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filter),
        });
        if (!res.ok) throw new Error('更新失败');
        messageApi?.success(intl?.formatMessage({ id: 'useFilters.updateSuccess' }) || '更新成功');
        await get().fetchFilters(messageApi, intl);
      } catch (err) {
        messageApi?.error(intl?.formatMessage({ id: 'useFilters.updateFilterFailed' }) || '更新过滤器失败');
        console.error(err);
      }
    },

    deleteFilter: async (id, messageApi, intl) => {
      try {
        const res = await fetch(`${APIs['Guarder.filters']}/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('删除失败');
        messageApi?.success(intl?.formatMessage({ id: 'useFilters.deleteSuccess' }) || '删除成功');
        await get().fetchFilters(messageApi, intl);
      } catch (err) {
        messageApi?.error(intl?.formatMessage({ id: 'useFilters.deleteFilterFailed' }) || '删除过滤器失败');
        console.error(err);
      }
    },

    toggleFilter: async (id, messageApi, intl) => {
      const current = get().filters.find((f) => f.id === id);
      if (!current) return;

      const endpoint = current.enabled ? 'disable' : 'enable';
      try {
        const res = await fetch(`${APIs['Guarder.filters']}/${id}/${endpoint}`, {
          method: 'POST',
        });
        if (!res.ok) throw new Error('切换失败');
        const successMessage = current.enabled 
          ? intl?.formatMessage({ id: 'useFilters.disableSuccess' }) || '禁用成功'
          : intl?.formatMessage({ id: 'useFilters.enableSuccess' }) || '启用成功';
        messageApi?.success(successMessage);
        await get().fetchFilters(messageApi, intl);
      } catch (err) {
        messageApi?.error(intl?.formatMessage({ id: 'useFilters.toggleFilterFailed' }) || '切换过滤器状态失败');
        console.error(err);
      }
    },
  })),
);