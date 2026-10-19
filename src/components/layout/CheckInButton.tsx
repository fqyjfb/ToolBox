import React, { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/AuthStore';
import { useToastStore } from '../../store/toastStore';
import { checkInService, checkInStatusQuery } from '../../services/CheckInService';
import { queryKeys } from '../../queries/keys';
import Tooltip from '../ui/Tooltip';

// 签到按钮：大窗态为头部标准图标按钮（w-9 h-9），小窗紧凑态为徽章大小（置于原超管徽章位置）
const CheckInButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const { data } = useQuery(checkInStatusQuery(userId));
  const [submitting, setSubmitting] = useState(false);

  if (!userId) return null;

  const checkedToday = data?.checkedToday ?? false;
  const streak = data?.streak ?? 0;
  const tip = checkedToday ? `今日已签到 · 连续 ${streak} 天` : '每日签到';

  const handleCheckIn = async () => {
    if (submitting) return;
    if (checkedToday) {
      addToast({ type: 'info', message: '今日已签到' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await checkInService.checkInToday(userId);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.checkIn.status(userId) });
        addToast({ type: 'success', message: result.alreadyChecked ? '今日已签到' : '签到成功' });
      } else {
        addToast({ type: 'error', message: result.error || '签到失败' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (compact) {
    return (
      <button
        className="flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded font-medium flex-shrink-0"
        style={{ backgroundColor: checkedToday ? 'var(--color-success)' : 'var(--color-accent)', color: 'var(--color-bg-primary)' }}
        onClick={handleCheckIn}
        title={tip}
      >
        <CalendarCheck className="w-3 h-3" />
        {checkedToday ? '已签' : '签到'}
      </button>
    );
  }

  return (
    <Tooltip title={tip} position="bottom">
      <button
        className="w-9 h-9 flex items-center justify-center text-content-secondary transition-colors duration-200 hover:bg-menu-hover"
        style={checkedToday ? { color: 'var(--color-accent)' } : undefined}
        onClick={handleCheckIn}
      >
        <CalendarCheck className="w-4 h-4" />
      </button>
    </Tooltip>
  );
};

export default CheckInButton;
