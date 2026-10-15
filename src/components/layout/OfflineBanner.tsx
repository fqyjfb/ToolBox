import React from 'react';
import { WifiOff } from 'lucide-react';
import { useSyncStore } from '../../store/syncStore';

const OfflineBanner: React.FC = () => {
  const isOnline = useSyncStore((state) => state.isOnline);

  if (isOnline) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 w-full flex-shrink-0"
      style={{
        height: '32px',
        backgroundColor: '#fef3c7',
        color: '#92400e',
        fontSize: '12px',
        lineHeight: '32px',
      }}
    >
      <WifiOff size={16} />
      <span>当前无网络连接，数据已切换至本地，恢复后自动同步</span>
    </div>
  );
};

export default OfflineBanner;
