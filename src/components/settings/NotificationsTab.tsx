import React from 'react';
import { Bell, AlertCircle } from 'lucide-react';
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
        <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">错误通知</span>
          </div>
          <ToggleSwitch
            enabled={notifications.errors}
            onChange={() => onNotificationToggle('errors')}
          />
        </div>
      </div>
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          开启后，当应用发生错误时会在界面显示错误提示通知
        </p>
      </div>
    </div>
  );
};

export default NotificationsTab;
