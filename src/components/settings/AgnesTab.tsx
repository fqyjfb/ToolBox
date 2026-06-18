import React, { useState, useEffect, useCallback } from 'react';
import { Key, Eye, EyeOff, Save, Check, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/AuthStore';
import { useToastStore } from '../../store/toastStore';
import { getUserAgnesConfig, saveUserAgnesConfig } from '../../services/AgnesService';

const AgnesTab: React.FC = () => {
  const admin = useAuthStore((state) => state.admin);
  const addToast = useToastStore((state) => state.addToast);

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!admin) return;
    try {
      const config = await getUserAgnesConfig(admin.id);
      if (config) {
        setApiKey(config.api_key || '');
      }
    } catch (error) {
      console.error('加载Agnes配置失败:', error);
    }
  }, [admin]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (!admin) return;

    try {
      setIsLoading(true);
      await saveUserAgnesConfig(admin.id, { api_key: apiKey });
      setSaved(true);
      addToast({ type: 'success', message: '配置已保存' });
      setTimeout(() => setSaved(false), 2000);
    } catch {
      addToast({ type: 'error', message: '保存失败，请重试' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="w-5 h-5 flex items-center justify-center text-purple-600">
          <Key size={16} />
        </div>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Agnes AI 设置</h2>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="输入 Agnes API Key"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title={showKey ? '隐藏密钥' : '显示密钥'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-colors ${
                saved
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-800 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {saved ? (
                <>
                  <Check size={14} />
                  已保存
                </>
              ) : isLoading ? (
                <>
                  <Save size={14} className="animate-spin" />
                  保存中
                </>
              ) : (
                <>
                  <Save size={14} />
                  保存
                </>
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <AlertCircle size={14} className="text-yellow-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              API Key 将安全存储在云端，仅用于调用 Agnes AI 服务
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgnesTab;