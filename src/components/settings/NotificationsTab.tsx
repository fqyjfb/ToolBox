import React from 'react';
import { Bell } from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';
import { NotificationSettings } from '../../types/settings';

interface NotificationsTabProps {
  notifications: NotificationSettings;
  onNotificationToggle: (key: keyof NotificationSettings) => void;
}

const NotificationsTab: React.FC<NotificationsTabProps> = ({ notifications, onNotificationToggle }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="w-5 h-5 flex items-center justify-center text-primary">
          <Bell size={16} />
        </div>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">通知设置</h2>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <span className="text-sm text-gray-700 dark:text-gray-300">工具执行完成通知</span>
          <ToggleSwitch
            enabled={notifications.toolComplete}
            onChange={() => onNotificationToggle('toolComplete')}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <span className="text-sm text-gray-700 dark:text-gray-300">系统更新通知</span>
          <ToggleSwitch
            enabled={notifications.updates}
            onChange={() => onNotificationToggle('updates')}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <span className="text-sm text-gray-700 dark:text-gray-300">错误通知</span>
          <ToggleSwitch
            enabled={notifications.errors}
            onChange={() => onNotificationToggle('errors')}
          />
        </div>
      </div>
    </div>
  );
};

export default NotificationsTab;
