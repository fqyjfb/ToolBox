import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePluginStore } from '../../store/pluginStore';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { pluginApi } from '../../services/pluginApi';

const PluginPage: React.FC = () => {
  const { pluginId } = useParams<{ pluginId: string }>();
  const navigate = useNavigate();
  const { installedPlugins } = usePluginStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const openPlugin = async () => {
      if (!pluginId) {
        setError('插件ID为空');
        setIsLoading(false);
        return;
      }

      const plugin = installedPlugins.find(p => p.id === pluginId);
      if (!plugin) {
        setError('插件未安装');
        setIsLoading(false);
        return;
      }

      try {
        await pluginApi.openPluginWindow(pluginId);
        setTimeout(() => {
          navigate('/');
        }, 300);
      } catch (err) {
        setError('打开插件窗口失败');
      } finally {
        setIsLoading(false);
      }
    };

    openPlugin();
  }, [pluginId, installedPlugins, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-gray-500 mb-2">{error}</div>
          <div className="text-gray-400 text-sm">插件ID: {pluginId}</div>
        </div>
      </div>
    );
  }

  return null;
};

export default PluginPage;