import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Scan, Copy, Trash2, FileText, Check, Edit3, RefreshCw, AlertCircle, CheckCircle, Play, Square, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';
import { OcrHistoryItem } from '../../../types/ocr';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Modal from '../../../components/ui/Modal';
import { logError } from '../../../services/loggerService';

interface OcrServiceStatus {
  available: boolean;
  message: string;
  status?: string;
  lastError?: string | null;
  canManualStart?: boolean;
  pid?: number;
  uptime?: number;
}

const OCR_HISTORY_KEY = 'ocr_history';
const MAX_HISTORY_COUNT = 20;

interface OcrBlock {
  text: string;
  confidence: number;
  box: number[][];
}

const OcrPage: React.FC = () => {
  const { addToast } = useToastStore();
  const [imagePreview, setImagePreview] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<string>('');
  const [ocrBlocks, setOcrBlocks] = useState<OcrBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<OcrHistoryItem[]>([]);
  const [editableResult, setEditableResult] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [ocrStatus, setOcrStatus] = useState<OcrServiceStatus | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [isStartingService, setIsStartingService] = useState(false);
  const [showServiceDetails, setShowServiceDetails] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<{ success: boolean; output: string; error?: string } | null>(null);
  const [showDiagnoseModal, setShowDiagnoseModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{ success: boolean; output: string; error?: string } | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    checkOcrStatus();
    loadHistory();

    const handleSettingsChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        addToast({ type: 'info', message: 'OCR设置已更新，部分更改需要重启服务才能生效' });
        checkOcrStatus();
      }
    };

    window.addEventListener('ocr-settings-changed', handleSettingsChanged);
    return () => {
      window.removeEventListener('ocr-settings-changed', handleSettingsChanged);
    };
  }, [addToast]);

  const checkOcrStatus = async () => {
    try {
      const result = await window.electron?.ocr?.status();
      if (result) {
        setOcrStatus(result);
      }
    } catch (error) {
      console.error('检查OCR状态失败:', error);
      setOcrStatus({
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
      const result = await window.electron?.ocr?.start();
      if (result?.success) {
        addToast({ type: 'success', message: result.message });
        await checkOcrStatus();
      } else {
        addToast({ type: 'error', message: result?.message || '启动失败，请检查Python环境配置' });
        await checkOcrStatus();
      }
    } catch (error) {
      logError('启动服务失败', 'OcrPage', error as Error);
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
      logError('诊断失败', 'OcrPage', error as Error);
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

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem(OCR_HISTORY_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  };

  const saveToHistory = useCallback((imageBase64: string, text: string) => {
    const newItem: OcrHistoryItem = {
      id: Date.now().toString(),
      imageBase64: imageBase64.substring(0, 1000),
      text,
      timestamp: Date.now(),
    };

    const newHistory = [newItem, ...history].slice(0, MAX_HISTORY_COUNT);
    setHistory(newHistory);

    try {
      localStorage.setItem(OCR_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      logError('保存历史记录失败', 'OcrPage', error as Error);
    }
  }, [history]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast({ type: 'error', message: '请上传图片文件' });
      return;
    }

    if (ocrStatus?.available === false) {
      addToast({ type: 'warning', message: 'OCR服务不可用，请先启动服务' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setSelectedBlockIndex(null);
      performOcr(base64);
    };
    reader.readAsDataURL(file);
  }, [addToast, ocrStatus?.available]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const performOcr = useCallback(async (imageBase64: string) => {
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    setOcrResult('');
    setOcrBlocks([]);
    setEditableResult('');
    setSelectedBlockIndex(null);

    try {
      const result = await window.electron?.ocr?.recognize(imageBase64);

      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (result && result.success) {
        setOcrResult(result.text);
        setEditableResult(result.text);
        setOcrBlocks(result.blocks || []);
        saveToHistory(imageBase64, result.text);
        addToast({ type: 'success', message: `识别成功，共 ${result.blocks?.length || 0} 个文字块` });
      } else {
        addToast({ type: 'error', message: result?.error || '识别失败' });
        setOcrResult('');
      }
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      console.error('OCR识别失败:', error);
      addToast({ type: 'error', message: 'OCR识别失败，请检查服务是否正常' });
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [addToast, saveToHistory]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (loading) {
        addToast({ type: 'info', message: '正在识别中，请稍候...' });
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            addToast({ type: 'info', message: '检测到粘贴的图片，正在识别...' });
            await handleImageUpload(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [loading, addToast, handleImageUpload]);

  const handleCopy = async () => {
    const textToCopy = isEditing ? editableResult : ocrResult;
    if (!textToCopy) {
      addToast({ type: 'warning', message: '没有可复制的内容' });
      return;
    }

    await navigator.clipboard.writeText(textToCopy);
    addToast({ type: 'success', message: '已复制到剪贴板' });
  };

  const handleClear = () => {
    setImagePreview('');
    setOcrResult('');
    setOcrBlocks([]);
    setEditableResult('');
    setIsEditing(false);
    setSelectedBlockIndex(null);
  };

  const handleBlockClick = (index: number) => {
    setSelectedBlockIndex(selectedBlockIndex === index ? null : index);
  };

  const getBoxStyle = (box: number[][], containerWidth: number, containerHeight: number) => {
    if (!box || box.length < 4) return null;

    const xCoords = box.map((p) => p[0]);
    const yCoords = box.map((p) => p[1]);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    const scaleX = containerWidth / imageDimensions.width;
    const scaleY = containerHeight / imageDimensions.height;

    return {
      left: minX * scaleX,
      top: minY * scaleY,
      width: (maxX - minX) * scaleX,
      height: (maxY - minY) * scaleY,
    };
  };

  const handleHistoryClick = (item: OcrHistoryItem) => {
    setOcrResult(item.text);
    setEditableResult(item.text);
    addToast({ type: 'info', message: '已恢复历史记录的文字内容' });
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(OCR_HISTORY_KEY);
    setConfirmClearHistory(false);
    addToast({ type: 'success', message: '历史记录已清空' });
  };

  const toggleEditMode = () => {
    if (isEditing) {
      setOcrResult(editableResult);
    }
    setIsEditing(!isEditing);
  };

  return (
    <div className="flex flex-col h-full min-h-full bg-bg-primary overflow-hidden">
      <header className="h-14 flex-shrink-0 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!ocrResult && !editableResult}
            className="px-3 py-1.5 text-text-secondary hover:bg-bg-tertiary rounded-lg transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            复制结果
          </button>
          <button
            onClick={toggleEditMode}
            disabled={!ocrResult}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-sm ${
              isEditing ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-tertiary'
            } disabled:opacity-50`}
          >
            {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {isEditing ? '完成编辑' : '编辑结果'}
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-error hover:bg-error/10 rounded-lg transition-colors flex items-center gap-1.5 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            清空
          </button>
        </div>
        <div className="flex items-center gap-2">
          {ocrStatus === null && (
            <span className="text-xs text-text-tertiary flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              检查服务状态...
            </span>
          )}
          {ocrStatus !== null && (
            <div className="flex items-center gap-2">
              <div className={`px-2 py-1 rounded-full text-xs flex items-center gap-1.5 ${
                ocrStatus.available ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
              }`}>
                {ocrStatus.available ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {ocrStatus.available ? '服务就绪' : '服务未运行'}
              </div>
              
              {ocrStatus.canManualStart && (
                <button
                  onClick={handleStartService}
                  disabled={isStartingService}
                  className="px-2 py-1 bg-primary hover:bg-primary/80 text-white text-xs rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {isStartingService ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  {isStartingService ? '启动中...' : '启动服务'}
                </button>
              )}
              
              {!ocrStatus.canManualStart && ocrStatus.available && (
                <button
                  onClick={handleStopService}
                  className="px-2 py-1 bg-warning/10 hover:bg-warning/20 text-warning text-xs rounded-lg transition-colors flex items-center gap-1"
                >
                  <Square className="w-3 h-3" />
                  停止服务
                </button>
              )}

              <button
                onClick={() => setShowServiceDetails(!showServiceDetails)}
                className="p-1 hover:bg-bg-tertiary rounded transition-colors"
                title="服务详情"
              >
                {showServiceDetails ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
              </button>
            </div>
          )}
          <span className="text-xs text-text-tertiary">支持 Ctrl/Cmd+V 粘贴图片</span>
        </div>
      </header>

      {showServiceDetails && ocrStatus && (
        <div className="bg-gray-100/50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-3 h-3 text-text-tertiary" />
              <span className="text-text-tertiary">服务状态:</span>
              <span className={`font-medium ${
                ocrStatus.status === 'running' ? 'text-success' :
                ocrStatus.status === 'starting' ? 'text-warning' :
                ocrStatus.status === 'error' ? 'text-error' : 'text-text-secondary'
              }`}>
                {ocrStatus.status === 'running' ? '运行中' :
                 ocrStatus.status === 'starting' ? '启动中' :
                 ocrStatus.status === 'stopping' ? '停止中' :
                 ocrStatus.status === 'error' ? '异常' : '已停止'}
              </span>
            </div>
            {ocrStatus.pid && (
              <div className="flex items-center gap-1.5">
                <span className="text-text-tertiary">PID:</span>
                <span className="font-mono">{ocrStatus.pid}</span>
              </div>
            )}
            {ocrStatus.uptime !== undefined && ocrStatus.uptime !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-text-tertiary">运行时间:</span>
                <span>{Math.floor(ocrStatus.uptime / 60)}分{ocrStatus.uptime % 60}秒</span>
              </div>
            )}
            {ocrStatus.lastError && (
              <div className="flex-1 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-error" />
                <span className="text-error truncate max-w-xs" title={ocrStatus.lastError}>
                  错误: {ocrStatus.lastError}
                </span>
              </div>
            )}
          </div>
          {ocrStatus.lastError && (
              <div className="mt-2 p-2 bg-error/10 rounded text-xs text-error">
                <div className="font-medium mb-1">常见解决方法:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>检查Python环境是否正确安装（建议Python 3.8+）</li>
                  <li>确保已安装所需依赖：pip install -r requirements.txt</li>
                  <li>检查端口8766是否被其他程序占用</li>
                  <li>尝试重启应用后再次启动服务</li>
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={handleDiagnose}
                    disabled={isDiagnosing}
                    className="mt-2 px-3 py-1.5 bg-primary hover:bg-primary/80 text-white text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
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
                    className="mt-2 px-3 py-1.5 bg-success hover:bg-success/80 text-white text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
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
            )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">
              上传图片
            </span>
          </div>
          <div className="flex-1 flex flex-col p-4 overflow-auto">
            {!imagePreview ? (
              <div
                className="bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-600 h-full flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => document.getElementById('file-input')?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith('image/')) {
                    handleImageUpload(file);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <Scan className="w-16 h-16 text-primary mb-4" />
                <p className="text-text-secondary mb-1">点击或拖拽图片到此处</p>
                <p className="text-text-tertiary text-xs">支持 PNG、JPG、BMP、WEBP 格式</p>
                <p className="text-text-tertiary text-xs mt-1">或使用 Ctrl/Cmd+V 粘贴剪贴板图片</p>
              </div>
            ) : (
              <div
                ref={imageContainerRef}
                className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex items-center justify-center relative"
              >
                <img
                  src={imagePreview}
                  alt="预览"
                  className="max-w-full max-h-full object-contain"
                  onLoad={handleImageLoad}
                />

                {imageDimensions.width > 0 &&
                  selectedBlockIndex !== null &&
                  imageContainerRef.current &&
                  ocrBlocks[selectedBlockIndex] && (() => {
                    const containerRect = imageContainerRef.current?.getBoundingClientRect();
                    if (!containerRect) return null;

                    const containerAspect = containerRect.width / containerRect.height;
                    const imageAspect = imageDimensions.width / imageDimensions.height;

                    let displayWidth, displayHeight, offsetX, offsetY;
                    if (imageAspect > containerAspect) {
                      displayWidth = containerRect.width;
                      displayHeight = containerRect.width / imageAspect;
                      offsetX = 0;
                      offsetY = (containerRect.height - displayHeight) / 2;
                    } else {
                      displayHeight = containerRect.height;
                      displayWidth = containerRect.height * imageAspect;
                      offsetX = (containerRect.width - displayWidth) / 2;
                      offsetY = 0;
                    }

                    const block = ocrBlocks[selectedBlockIndex];
                    const boxStyle = getBoxStyle(block.box, displayWidth, displayHeight);
                    if (!boxStyle) return null;

                    return (
                      <div key={selectedBlockIndex} className="absolute inset-0 pointer-events-none">
                        <div
                          className="absolute border-2 border-primary bg-primary/20 shadow-lg shadow-primary/30 transition-all duration-200"
                          style={{
                            left: offsetX + boxStyle.left,
                            top: offsetY + boxStyle.top,
                            width: boxStyle.width,
                            height: boxStyle.height,
                          }}
                        >
                          <div className="absolute -top-4 left-0 text-[10px] px-1.5 rounded bg-primary text-white">
                            {selectedBlockIndex + 1}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                {loading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <LoadingSpinner />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">
              识别结果
            </span>
            {loading && (
              <span className="text-xs text-primary flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                识别中...
              </span>
            )}
            {ocrBlocks.length > 0 && !loading && (
              <span className="text-xs text-text-tertiary">
                {ocrBlocks.length} 个文字块
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {ocrResult || editableResult ? (
              <div className="h-full">
                {isEditing ? (
                  <textarea
                    value={editableResult}
                    onChange={(e) => setEditableResult(e.target.value)}
                    className="w-full h-full resize-none bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-800 dark:text-gray-200"
                    placeholder="编辑识别结果..."
                  />
                ) : (
                  <div className="space-y-2">
                    {ocrBlocks.length > 0 && (
                      <div className="mb-3 p-2 bg-bg-tertiary rounded text-xs max-h-48 overflow-auto">
                        <div className="text-text-tertiary mb-2 sticky top-0 bg-bg-tertiary">
                          识别详情（点击高亮对应区域）：
                        </div>
                        <div className="space-y-1">
                          {ocrBlocks.map((block, index) => (
                            <div
                              key={index}
                              onClick={() => handleBlockClick(index)}
                              className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                                selectedBlockIndex === index
                                  ? 'bg-primary/20 border border-primary'
                                  : 'hover:bg-bg-secondary border border-transparent'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 flex items-center justify-center text-[10px] rounded ${
                                  selectedBlockIndex === index
                                    ? 'bg-primary text-white'
                                    : 'bg-success text-white'
                                }`}
                              >
                                {index + 1}
                              </span>
                              <span className="text-text-secondary flex-1 truncate">
                                {block.text.substring(0, 40)}
                                {block.text.length > 40 ? '...' : ''}
                              </span>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                                  block.confidence > 0.9
                                    ? 'bg-success/20 text-success'
                                    : block.confidence > 0.7
                                    ? 'bg-warning/20 text-warning'
                                    : 'bg-error/20 text-error'
                                }`}
                              >
                                {(block.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 max-h-64 overflow-auto">
                      {ocrResult}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <FileText className="w-16 h-16 opacity-50 mx-auto mb-4" />
                  <p>识别结果将显示在这里</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">
              历史记录 ({history.length})
            </span>
            <button
              onClick={() => setConfirmClearHistory(true)}
              className="text-xs text-error hover:underline"
            >
              清空历史
            </button>
          </div>
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
            {history.slice(0, 10).map((item) => (
              <button
                key={item.id}
                onClick={() => handleHistoryClick(item)}
                className="flex-shrink-0 p-2 bg-gray-100 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors text-left"
                style={{ minWidth: 120 }}
              >
                <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {item.text.substring(0, 30)}
                  {item.text.length > 30 ? '...' : ''}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">
                  {new Date(item.timestamp).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        id="file-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImageUpload(file);
          }
        }}
      />

      <Modal
        title="确认清空"
        isOpen={confirmClearHistory}
        onClose={() => setConfirmClearHistory(false)}
        onConfirm={handleClearHistory}
      >
        <p>确定要清空所有历史记录吗？</p>
      </Modal>

      <Modal
        title="OCR 服务诊断结果"
        isOpen={showDiagnoseModal}
        onClose={() => setShowDiagnoseModal(false)}
        onConfirm={() => setShowDiagnoseModal(false)}
      >
        {isDiagnosing ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-primary mr-3" />
            <span>正在运行诊断...</span>
          </div>
        ) : diagnoseResult ? (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg text-sm ${diagnoseResult.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
              {diagnoseResult.success ? '✓ 诊断通过，未发现问题' : '✗ 诊断完成，发现问题'}
            </div>
            {diagnoseResult.output && (
              <div className="bg-bg-secondary p-3 rounded-lg max-h-96 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap text-text-primary">
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
      </Modal>

      <Modal
        title="安装 Python 依赖"
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        onConfirm={() => setShowInstallModal(false)}
      >
        {isInstalling ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-success mr-3" />
            <span>正在安装依赖，这可能需要几分钟...</span>
          </div>
        ) : installResult ? (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg text-sm ${installResult.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
              {installResult.success ? '✓ 依赖安装成功！' : '✗ 依赖安装失败'}
            </div>
            {installResult.output && (
              <div className="bg-bg-secondary p-3 rounded-lg max-h-96 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap text-text-primary">
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
      </Modal>
    </div>
  );
};

export default OcrPage;
