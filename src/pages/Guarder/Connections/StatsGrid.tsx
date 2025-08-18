import React from 'react';
import { Globe, Zap, Activity, Shield } from 'lucide-react';
import { useIntl } from 'react-intl';
import StatCard from './StatCard';

interface Stats {
  TotalPackets: number;
  TotalBytes: number;
  DroppedPackets: number;
  MalformedPackets: number;
}

interface StatsGridProps {
  stats: Stats;
  formatBytes: (bytes: number) => string;
}

const StatsGrid: React.FC<StatsGridProps> = ({ stats, formatBytes }) => {
  const intl = useIntl();

  const statsConfig = [
    { 
      label: intl.formatMessage({ id: 'ConnectionsMonitor.totalPackets' }), 
      value: stats.TotalPackets, 
      icon: <Globe />, 
      color: 'green' 
    },
    { 
      label: intl.formatMessage({ id: 'ConnectionsMonitor.totalBytes' }), 
      value: formatBytes(stats.TotalBytes), 
      icon: <Zap />, 
      color: 'blue' 
    },
    { 
      label: intl.formatMessage({ id: 'ConnectionsMonitor.droppedPackets' }), 
      value: stats.DroppedPackets, 
      icon: <Activity />, 
      color: 'purple' 
    },
    { 
      label: intl.formatMessage({ id: 'ConnectionsMonitor.malformedPackets' }), 
      value: stats.MalformedPackets, 
      icon: <Shield />, 
      color: 'red' 
    },
  ];

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsConfig.map((item, index) => (
        <StatCard key={index} {...item} />
      ))}
    </section>
  );
};

export default StatsGrid;