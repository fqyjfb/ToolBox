import React, { useState, useEffect } from 'react';
import { Globe, Search, RefreshCw, MapPin, Clock, Building, Wifi } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

interface IPInfo {
  ip: string;
  version: string;
  city: string;
  region: string;
  country_name: string;
  country_code: string;
  timezone: string;
  currency: string;
  currency_name: string;
  postal: string;
  latitude: number;
  longitude: number;
  org: string;
  asn: string;
  languages: string;
  error?: boolean;
  reason?: string;
}

const IPInfoPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [ipInput, setIpInput] = useState('');
  const [ipInfo, setIpInfo] = useState<IPInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchIPInfo = async (ip: string = '') => {
    setLoading(true);
    setError('');
    
    try {
      const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
      const response = await fetch(url);
      
      if (!response.ok) throw new Error('查询失败');
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.reason || '查询失败');
      }
      
      setIpInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败，请检查网络连接');
      addToast({ message: err instanceof Error ? err.message : '查询失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIPInfo();
  }, []);

  const handleQuery = () => {
    fetchIPInfo(ipInput.trim());
  };

  const handleGetMyIP = () => {
    setIpInput('');
    fetchIPInfo();
  };

  const infoItems = ipInfo ? [
    { label: 'IP 地址', value: ipInfo.ip, icon: Globe },
    { label: '版本', value: ipInfo.version, icon: Wifi },
    { label: '城市', value: ipInfo.city || '未知', icon: MapPin },
    { label: '地区', value: ipInfo.region || '未知', icon: MapPin },
    { label: '国家', value: `${ipInfo.country_name || '未知'} (${ipInfo.country_code || ''})`, icon: Globe },
    { label: '时区', value: ipInfo.timezone || '未知', icon: Clock },
    { label: '货币', value: `${ipInfo.currency || '未知'} (${ipInfo.currency_name || ''})`, icon: Building },
    { label: '邮政编码', value: ipInfo.postal || '未知', icon: MapPin },
    { label: '纬度', value: ipInfo.latitude?.toString() || '未知', icon: MapPin },
    { label: '经度', value: ipInfo.longitude?.toString() || '未知', icon: MapPin },
    { label: 'ISP', value: ipInfo.org || ipInfo.asn || '未知', icon: Wifi },
    { label: '语言', value: (ipInfo.languages || '未知').split(',')[0], icon: Globe },
  ].filter(item => item.value && item.value !== '未知') : [];

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-3 mb-4">
        <Globe className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">IP 地址信息查询</h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
        <div className="mb-4">
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
            查询 IP 地址（留空查询本机 IP）：
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
              placeholder="例如: 8.8.8.8"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleQuery}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Search className="w-4 h-4" />
              查询
            </button>
          </div>
        </div>
        
        <button
          onClick={handleGetMyIP}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          查询本机 IP
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>正在查询...</span>
          </div>
        </div>
      ) : ipInfo ? (
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {infoItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">{item.label}</span>
                  </div>
                  <div className="text-gray-800 dark:text-gray-200 font-semibold break-all">
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default IPInfoPage;