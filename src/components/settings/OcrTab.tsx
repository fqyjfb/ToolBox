import React, { useState, useEffect, useCallback } from 'react';
import { Scan, CheckCircle, AlertCircle, RefreshCw, Play, Square, HelpCircle, FolderOpen, Wifi, Clock, RotateCw, Save, Search } from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';
import Modal from '../ui/Modal';
import SettingCard from './SettingCard';
import { useToastStore } from '../../store/toastStore';
import { logError } from '../../services/loggerService';
import { localStorageService, STORAGE_KEYS } from '../../services/localStorageService';

const DEFAULT_OCR_SETTINGS = {
  httpPort: 8766,
  wsPort: 8765,
  idleTimeoutMinutes: 10,
  autoRestart: true,
  maxRestarts: 3,
  pythonPath: '',
};

interface OcrSettings {
  httpPort: number;
  wsPort: number;
  idleTimeoutMinutes: number;
  autoRestart: boolean;
  maxRestarts: number;
  pythonPath: string;
}

interface OcrServiceStatus {
  available: boolean;
  message: string;
  status?: string;
  lastError?: string | null;
  canManualStart?: boolean;
  pid?: number;
  uptime?: number;
}

const OcrTab: React.FC = () => {
  const addToast = useToastStore(state => state.addToast);
  const [settings, setSettings] = useState<OcrSettings>(DEFAULT_OCR_SETTINGS);
  const [serviceStatus, setServiceStatus] = useState<OcrServiceStatus | null>(null);
  const [isStartingService, setIsStartingService] = useState(false);
  const [isCheckingPort, setIsCheckingPort] = useState(false);
  const [portCheckResults, setPortCheckResults] = useState<{ [key: string]: boolean | null }>({});
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<{ success: boolean; output: string; error?: string } | null>(null);
  const [showDiagnoseModal, setShowDiagnoseModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{ success: boolean; output: string; error?: string } | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    loadSettings();
    checkOcrStatus();
  }, []);

  const loadSettings = () => {
    const saved = localStorageService.get<OcrSettings>(STORAGE_KEYS.OCR_SETTINGS, null as unknown as OcrSettings);
    if (saved) {
      setSettings({ ...DEFAULT_OCR_SETTINGS, ...saved });
    }
  };

  const saveSettings = useCallback((newSettings: OcrSettings) => {
    localStorageService.set(STORAGE_KEYS.OCR_SETTINGS, newSettings);
    setSettings(newSettings);
    setHasUnsavedChanges(false);
    window.dispatchEvent(new CustomEvent('ocr-settings-changed', { detail: newSettings }));
    addToast({ type: 'success', message: 'OCR设置已保存' });
  }, [addToast]);

  const handleSettingChange = <K extends keyof OcrSettings>(key: K, value: OcrSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const checkOcrStatus = async () => {
    try {
      const result = await window.electron?.ocr?.status();
      if (result) {
        setServiceStatus(result);
      }
    } catch (error) {
      console.error('检查OCR状态失败:', error);
      setServiceStatus({
        available: false,
        message: '检查服务状态失败',
        status: 'error',
        lastError: String(error),
        canManualStart: true,
      });
    }
  };

  const handleStartService = async () => {
    setIsStartingService(true);
    try {
      if (hasUnsavedChanges) {
        addToast({ type: 'warning', message: '有未保存的设置，请先保存后再启动服务' });
        setIsStartingService(false);
        return;
      }
      const result = await window.electron?.ocr?.start();
      if (result?.success) {
        addToast({ type: 'success', message: result.message });
        await checkOcrStatus();
      } else {
        addToast({ type: 'error', message: result?.message || '启动失败，请检查Python环境配置' });
        await checkOcrStatus();
      }
    } catch (error) {
      console.error('启动服务失败:', error);
      addToast({ type: 'error', message: '启动服务异常: ' + String(error) });
      await checkOcrStatus();
    } finally {
      setIsStartingService(false);
    }
  };

  const handleStopService = async () => {
    try {
      const result = await window.electron?.ocr?.stop();
      if (result?.success) {
        addToast({ type: 'info', message: result.message });
        await checkOcrStatus();
      } else {
        addToast({ type: 'error', message: result?.message || '停止失败' });
      }
    } catch (error) {
      console.error('停止服务失败:', error);
      addToast({ type: 'error', message: '停止服务异常: ' + String(error) });
    }
  };

  const handleCheckPort = async (port: number, portType: 'http' | 'ws') => {
    setIsCheckingPort(true);
    setPortCheckResults(prev => ({ ...prev, [`${portType}-${port}`]: null }));
    try {
      const result = await window.electron?.ocr?.checkPort(port);
      if (result?.success) {
        setPortCheckResults(prev => ({ ...prev, [`${portType}-${port}`]: result.inUse }));
        if (result.inUse) {
          addToast({ type: 'warning', message: `端口 ${port} 已被占用` });
        }
      }
    } catch (error) {
      logError('检查端口失败', 'OcrTab', error as Error);
      addToast({ type: 'error', message: '检查端口失败' });
    } finally {
      setIsCheckingPort(false);
    }
  };

  const handleDiagnose = async () => {
    setIsDiagnosing(true);
    setShowDiagnoseModal(true);
    setDiagnoseResult(null);
    try {
      const result = await window.electron?.ocr?.diagnose();
      const finalResult = result || { success: false, output: '', error: '诊断功能不可用' };
      setDiagnoseResult(finalResult);
      if (finalResult.success) {
        addToast({ type: 'success', message: '诊断完成，未发现问题' });
      } else {
        addToast({ type: 'warning', message: '诊断完成，发现问题请查看详情' });
      }
    } catch (error) {
      console.error('诊断失败:', error);
      setDiagnoseResult({
        success: false,
        output: '',
        error: String(error),
      });
      addToast({ type: 'error', message: '诊断运行异常' });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleInstallDeps = async () => {
    setIsInstalling(true);
    setShowInstallModal(true);
    setInstallResult(null);
    try {
      const result = await window.electron?.ocr?.installDeps();
      const finalResult = result || { success: false, output: '', error: '安装功能不可用' };
      setInstallResult(finalResult);
      if (finalResult.success) {
        addToast({ type: 'success', message: '依赖安装成功！现在可以启动OCR服务了' });
        await checkOcrStatus();
      } else {
        addToast({ type: 'error', message: '依赖安装失败，请查看详情' });
      }
    } catch (error) {
      console.error('安装失败:', error);
      setInstallResult({
        success: false,
        output: '',
        error: String(error),
      });
      addToast({ type: 'error', message: '依赖安装运行异常' });
    } finally {
      setIsInstalling(false);
    }
  };

  const handleSelectPythonPath = async () => {
    try {
      const result = await window.electron?.ocr?.selectPythonPath();
      if (result?.success && result.path) {
        handleSettingChange('pythonPath', result.path);
        addToast({ type: 'success', message: '已选择Python解释器' });
      }
    } catch (error) {
      logError('选择Python路径失败', 'OcrTab', error as Error);
      addToast({ type: 'error', message: '选择Python路径失败' });
    }
  };

  const handleSave = () => {
    if (serviceStatus?.available) {
      addToast({ type: 'warning', message: '请先停止服务后再保存设置' });
      return;
    }
    saveSettings(settings);
  };

  const handleReset = () => {
    setSettings(DEFAULT_OCR_SETTINGS);
    setHasUnsavedChanges(true);
    addToast({ type: 'info', message: '已重置为默认设置，请保存' });
  };

  const getPortCheckIcon = (portType: 'http' | 'ws', port: number) => {
    const key = `${portType}-${port}`;
    const result = portCheckResults[key];
    if (result === null) return null;
    if (result === false) return <CheckCircle className="w-4 h-4 text-success" />;
    if (result === true) return <AlertCircle className="w-4 h-4 text-error" />;
    return null;
  };

  return (
    <SettingCard>
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="w-5 h-5 flex items-center justify-center text-primary">
          <Scan size={16} />
        </div>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">OCR识别设置</h2>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">服务状态</span>
            {serviceStatus === null ? (
              <span className="text-xs text-text-tertiary flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                检查中...
              </span>
            ) : (
              <div className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 ${
                serviceStatus.available ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
              }`}>
                {serviceStatus.available ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {serviceStatus.available ? '运行中' : '已停止'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {serviceStatus?.canManualStart && !serviceStatus.available && (
              <button
                onClick={handleStartService}
                disabled={isStartingService || hasUnsavedChanges}
                className="px-3 py-1.5 bg-primary hover:bg-primary/80 text-white text-xs rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isStartingService ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                {isStartingService ? '启动中...' : '启动服务'}
              </button>
            )}
            {serviceStatus?.available && (
              <button
                onClick={handleStopService}
                className="px-3 py-1.5 bg-warning/10 hover:bg-warning/20 text-warning text-xs rounded-md transition-colors flex items-center gap-1.5"
              >
                <Square className="w-3 h-3" />
                停止服务
              </button>
            )}
            <button
              onClick={checkOcrStatus}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="刷新状态"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-700 dark:text-gray-300">服务端口配置</span>
            {serviceStatus?.available && (
              <span className="text-xs text-warning">（服务运行中，修改设置需停止服务）</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">HTTP 端口</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.httpPort}
                  onChange={(e) => handleSettingChange('httpPort', parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  min="1"
                  max="65535"
                />
                <button
                  onClick={() => handleCheckPort(settings.httpPort, 'http')}
                  disabled={isCheckingPort}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="检测端口"
                >
                  {isCheckingPort ? (
                    <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                  ) : (
                    getPortCheckIcon('http', settings.httpPort) || <Search className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">WebSocket 端口</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.wsPort}
                  onChange={(e) => handleSettingChange('wsPort', parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  min="1"
                  max="65535"
                />
                <button
                  onClick={() => handleCheckPort(settings.wsPort, 'ws')}
                  disabled={isCheckingPort}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="检测端口"
                >
                  {isCheckingPort ? (
                    <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                  ) : (
                    getPortCheckIcon('ws', settings.wsPort) || <Search className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">空闲超时（分钟）</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={settings.idleTimeoutMinutes}
              onChange={(e) => handleSettingChange('idleTimeoutMinutes', parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              min="1"
              max="60"
            />
            <span className="text-xs text-gray-500">服务空闲 {settings.idleTimeoutMinutes} 分钟后自动停止</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">自动重启</span>
          </div>
          <ToggleSwitch
            enabled={settings.autoRestart}
            onChange={(val) => handleSettingChange('autoRestart', val)}
          />
        </div>

        {settings.autoRestart && (
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300 ml-6">最大重启次数</span>
            </div>
            <input
              type="number"
              value={settings.maxRestarts}
              onChange={(e) => handleSettingChange('maxRestarts', parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              min="0"
              max="10"
            />
          </div>
        )}

        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Python 解释器路径</span>
            <span className="text-xs text-gray-500">（留空使用系统默认）</span>
          </div>
          <div className="flex items-center gap-2 ml-6">
            <input
              type="text"
              value={settings.pythonPath}
              onChange={(e) => handleSettingChange('pythonPath', e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              placeholder="例如: C:\Python39\python.exe"
            />
            <button
              onClick={handleSelectPythonPath}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded-md transition-colors"
            >
              浏览
            </button>
          </div>
        </div>

        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">故障排查</span>
          </div>
          <div className="flex gap-2 ml-6">
            <button
              onClick={handleDiagnose}
              disabled={isDiagnosing}
              className="px-3 py-1.5 bg-primary hover:bg-primary/80 text-white text-xs rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isDiagnosing ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <HelpCircle className="w-3 h-3" />
              )}
              {isDiagnosing ? '诊断中...' : '运行诊断'}
            </button>
            <button
              onClick={handleInstallDeps}
              disabled={isInstalling}
              className="px-3 py-1.5 bg-primary hover:bg-primary/80 text-white text-xs rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isInstalling ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              {isInstalling ? '安装中...' : '安装依赖'}
            </button>
          </div>
        </div>

        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            重置默认
          </button>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="text-xs text-warning">有未保存的更改</span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || serviceStatus?.available}
              className="px-4 py-1.5 bg-primary hover:bg-primary/80 text-white text-sm rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              保存设置
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showDiagnoseModal}
        onClose={() => setShowDiagnoseModal(false)}
        title="OCR 服务诊断结果"
        showCancel={false}
        showConfirm={false}
        size="lg"
      >
        <div className="max-h-96 overflow-auto">
          {isDiagnosing ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary mr-3" />
              <span className="text-gray-600 dark:text-gray-400">正在运行诊断...</span>
            </div>
          ) : diagnoseResult ? (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg text-sm ${diagnoseResult.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                {diagnoseResult.success ? '✓ 诊断通过，未发现问题' : '✗ 诊断完成，发现问题'}
              </div>
              {diagnoseResult.output && (
                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {diagnoseResult.output}
                  </pre>
                </div>
              )}
              {diagnoseResult.error && (
                <div className="bg-error/10 p-3 rounded-lg">
                  <div className="text-xs font-medium text-error mb-1">错误信息:</div>
                  <pre className="text-xs font-mono text-error">
                    {diagnoseResult.error}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        title="安装 Python 依赖"
        showCancel={false}
        showConfirm={false}
        size="lg"
      >
        <div className="max-h-96 overflow-auto">
          {isInstalling ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary mr-3" />
              <span className="text-gray-600 dark:text-gray-400">正在安装依赖，这可能需要几分钟...</span>
            </div>
          ) : installResult ? (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg text-sm ${installResult.success ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                {installResult.success ? '✓ 依赖安装成功！' : '✗ 依赖安装失败'}
              </div>
              {installResult.output && (
                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {installResult.output}
                  </pre>
                </div>
              )}
              {installResult.error && (
                <div className="bg-error/10 p-3 rounded-lg">
                  <div className="text-xs font-medium text-error mb-1">错误信息:</div>
                  <pre className="text-xs font-mono text-error">
                    {installResult.error}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Modal>
    </SettingCard>
  );
};

export default OcrTab;