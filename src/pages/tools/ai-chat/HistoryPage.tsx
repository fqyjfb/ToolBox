import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCallbackRef } from '../../../hooks/useCallbackRef';
import { useAgnesStore } from '../../../store/agnesStore';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import { Image, Video, Download, Trash2, X, Play, RefreshCw, Check, AlertCircle, Upload, Palette } from 'lucide-react';
import type { ImageResult, VideoTask } from '../../../types/agnes';
import { getVideoTaskStatus, cancelVideoTask } from '../../../services/agnesApi';
import ImagePreviewModal from '../../../components/ImagePreviewModal';

const POLLING_INTERVAL_MS = 5000;

const HistoryPage: React.FC = () => {
  const { imageGeneration, videoGeneration, fontGeneration, addImageToHistory, updateVideoTask, removeVideoTask, removeFontTask, removeImage } = useAgnesStore();
  const admin = useAuthStore((state) => state.admin);
  const addToast = useToastStore((state) => state.addToast);

  const [confirmCancelTaskId, setConfirmCancelTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'images' | 'videos' | 'fonts'>('images');
  const [selectedImage, setSelectedImage] = useState<ImageResult | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedFontImage, setSelectedFontImage] = useState<string | null>(null);
  const [selectedFontTask, setSelectedFontTask] = useState<{ id: string; text: string } | null>(null);
  const [pollingStatus, setPollingStatus] = useState<'idle' | 'polling'>('idle');
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tasksRef = useRef<VideoTask[]>([]);
  const pollingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    tasksRef.current = videoGeneration.tasks;
  }, [videoGeneration.tasks]);

  const fetchTaskStatus = useCallback(async (taskId: string): Promise<void> => {
    try {
      const result = await getVideoTaskStatus(taskId);

      if (!result || typeof result !== 'object') {
        return;
      }

      const status = result.status?.toLowerCase() || 'queued';
      const progress = typeof result.progress === 'number' && !isNaN(result.progress) ? result.progress : 0;
      const videoUrl = (result.video_url || '').trim();

      updateVideoTask(taskId, {
        status: status as VideoTask['status'],
        progress,
        video_url: videoUrl,
      });
    } catch (error) {
      console.error(`Failed to fetch task ${taskId}:`, error);
    }
  }, [updateVideoTask]);

  const stopPolling = useCallbackRef(() => {
    if (pollingTimerRef.current !== null) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    setPollingStatus('idle');
  }, []);

  const startPolling = useCallbackRef(() => {
    if (pollingTimerRef.current !== null) return;

    setPollingStatus('polling');

    const poll = async () => {
      const tasks = tasksRef.current;

      if (tasks.length === 0) {
        stopPolling();
        return;
      }

      const pendingTasks = tasks.filter(task =>
        ['pending', 'running', 'queued', 'processing'].includes(task.status)
      );

      if (pendingTasks.length === 0) {
        stopPolling();
        return;
      }

      for (const task of pendingTasks) {
        await fetchTaskStatus(task.task_id);
      }
    };

    poll();
    pollingTimerRef.current = window.setInterval(poll, POLLING_INTERVAL_MS);
  }, [fetchTaskStatus, stopPolling]);

  useEffect(() => {
    const taskStatuses = videoGeneration.tasks.map(t => t.status);
    const hasPendingTasks = taskStatuses.some(
      status => ['pending', 'running', 'queued', 'processing'].includes(status)
    );

    if (hasPendingTasks && pollingStatus === 'idle') {
      startPolling();
    } else if (!hasPendingTasks && pollingStatus === 'polling') {
      stopPolling();
    }
  }, [videoGeneration.tasks, pollingStatus, startPolling, stopPolling]);

  const handleRefreshAllTasks = async () => {
    if (videoGeneration.tasks.length === 0) return;

    setPollingStatus('polling');

    for (const task of videoGeneration.tasks) {
      await fetchTaskStatus(task.task_id);
    }

    setPollingStatus('idle');
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const handleImageDownload = async (url: string, filename?: string) => {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `agnes-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      addToast({ type: 'error', message: '下载失败' });
    }
  };

  const handleImageDelete = (id: string) => {
    removeImage(id, admin?.id);
    if (selectedImage?.id === id) {
      setSelectedImage(null);
    }
  };

  const handleVideoDownload = (url: string, taskId: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `video-${taskId}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getVideoStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'succeeded':
      case 'success':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'failed':
      case 'cancelled':
      case 'canceled':
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'running':
      case 'in_progress':
      case 'processing':
      case 'submitted':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <RefreshCw className="w-4 h-4 text-gray-400" />;
    }
  };

  const getVideoStatusText = (status: string) => {
    switch (status) {
      case 'completed':
      case 'succeeded':
      case 'success':
        return '已完成';
      case 'failed':
      case 'cancelled':
      case 'canceled':
      case 'error':
        return '失败';
      case 'running':
      case 'in_progress':
      case 'processing':
        return '生成中';
      case 'queued':
      case 'submitted':
        return '排队中';
      default:
        return '等待中';
    }
  };

  const handleExport = () => {
    const data = {
      images: imageGeneration.history,
      videos: videoGeneration.tasks,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agnes-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);

        let importedCount = 0;

        if (data.images && Array.isArray(data.images)) {
          const currentIds = new Set(imageGeneration.history.map(img => img.id));
          const newImages = data.images.filter((img: ImageResult) => !currentIds.has(img.id));
          newImages.forEach((img: ImageResult) => {
            addImageToHistory(img);
          });
          importedCount += newImages.length;
        }

        setImportSuccess(`成功导入 ${importedCount} 条记录`);
        setImportError(null);

        setTimeout(() => {
          setImportSuccess(null);
        }, 3000);
      } catch {
        setImportError('导入失败，请确保文件格式正确');
        setImportSuccess(null);

        setTimeout(() => {
          setImportError(null);
        }, 3000);
      }
    };
    reader.readAsText(file);

    e.target.value = '';
  };

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-900">
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">任务列表</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">查看您的图像生成历史和视频任务记录</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  导出
                </button>
                <button
                  onClick={handleImportClick}
                  className="px-3 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                  <Upload className="w-4 h-4" />
                  导入
                </button>
              </div>
            </div>
            {(importSuccess || importError) && (
              <div className={`mt-2 p-3 rounded-lg text-sm flex items-center gap-2 ${
                importSuccess ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {importSuccess ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{importSuccess || importError}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setActiveTab('images')}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl transition-all ${
                activeTab === 'images'
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Image className="w-5 h-5" />
              <span className="text-sm font-medium">
                图像历史 ({imageGeneration.history.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl transition-all ${
                activeTab === 'videos'
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Video className="w-5 h-5" />
              <span className="text-sm font-medium">
                视频任务 ({videoGeneration.tasks.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('fonts')}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl transition-all ${
                activeTab === 'fonts'
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Palette className="w-5 h-5" />
              <span className="text-sm font-medium">
                字体任务 ({fontGeneration.tasks.length})
              </span>
            </button>
          </div>

          {activeTab === 'images' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
              {imageGeneration.history.length === 0 ? (
                <div className="text-center py-12">
                  <Image className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">暂无图像生成历史</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">生成图像后会自动保存到这里</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 py-3">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">图像历史</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">共 {imageGeneration.history.length} 张</span>
                  </div>
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {imageGeneration.history.map((image) => (
                      <div
                        key={image.id}
                        className={`relative group bg-gray-50 dark:bg-gray-700 rounded-xl overflow-hidden cursor-pointer transition-all ${
                          selectedImage?.id === image.id ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => setSelectedImage(image)}
                      >
                        <img
                          src={image.url}
                          alt={image.prompt}
                          className="w-full h-32 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleImageDownload(image.url); }}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors"
                          >
                            <Download className="w-3 h-3 inline mr-1" />
                            下载
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleImageDelete(image.id); }}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
                          >
                            <Trash2 className="w-3 h-3 inline mr-1" />
                            删除
                          </button>
                        </div>
                        <div className="p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={image.prompt}>
                            {image.prompt}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">{image.size}</span>
                            {image.referenceImages && image.referenceImages.length > 0 && (
                              <span className="text-xs text-primary">图生图</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
              {videoGeneration.tasks.length === 0 ? (
                <div className="text-center py-12">
                  <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">暂无视频任务</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">创建视频任务后会显示在这里</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 py-3">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">视频任务</h3>
                    <div className="flex items-center gap-2">
                      {pollingStatus === 'polling' && (
                        <span className="flex items-center gap-1 text-xs text-primary">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          轮询中
                        </span>
                      )}
                      <button
                        onClick={handleRefreshAllTasks}
                        disabled={pollingStatus === 'polling'}
                        className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3 inline mr-1" />
                        刷新
                      </button>
                      <span className="text-xs text-gray-500 dark:text-gray-400">共 {videoGeneration.tasks.length} 个</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {videoGeneration.tasks.map((task) => {
                      const isProcessing = ['pending', 'running', 'queued', 'processing'].includes(task.status);
                      const isCompleted = ['completed', 'succeeded', 'success'].includes(task.status);
                      const isFailed = ['failed', 'cancelled', 'canceled', 'error'].includes(task.status);
                      const statusColor = isCompleted ? 'text-green-500' : isFailed ? 'text-red-500' : 'text-gray-500';

                      return (
                        <div key={task.id} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                              {task.task_id}
                            </div>

                            <div className="flex-shrink-0 flex items-center gap-1">
                              {isProcessing && (
                                confirmCancelTaskId === task.id ? (
                                  <>
                                    <button
                                      onClick={async () => {
                                        try {
                                          await cancelVideoTask(task.task_id);
                                          updateVideoTask(task.id, { status: 'cancelled' });
                                          setConfirmCancelTaskId(null);
                                        } catch {
                                          addToast({ type: 'error', message: '取消任务失败' });
                                        }
                                      }}
                                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                      title="确认取消"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setConfirmCancelTaskId(null)}
                                      className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                                      title="取消操作"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => setConfirmCancelTaskId(task.id)}
                                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                    title="取消任务"
                                  >
                                    <AlertCircle className="w-4 h-4" />
                                  </button>
                                )
                              )}

                              {isCompleted && task.video_url && (
                                <>
                                  <button
                                    onClick={() => setSelectedVideo(task.video_url ?? null)}
                                    className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors"
                                    title="预览视频"
                                  >
                                    <Play className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleVideoDownload(task.video_url as string, task.task_id)}
                                    className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                                    title="下载视频"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => removeVideoTask(task.id, admin?.id)}
                                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                    title="删除任务"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}

                              {isFailed && (
                                <>
                                  <button
                                    onClick={() => pollingStatus !== 'polling' && startPolling()}
                                    className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                                    title="重新获取状态"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => removeVideoTask(task.id, admin?.id)}
                                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                    title="删除任务"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1 min-w-0" title={task.prompt}>
                              {task.prompt}
                            </p>
                            <span className={`flex items-center gap-1 text-xs ${statusColor} flex-shrink-0`}>
                              {getVideoStatusIcon(task.status)}
                              {getVideoStatusText(task.status)}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(task.created_at).toLocaleString('zh-CN')}
                            </span>
                            {task.size && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                分辨率: {task.size}
                              </span>
                            )}
                          </div>

                          {isProcessing && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                <span className="flex items-center gap-1">
                                  <RefreshCw className={`w-3 h-3 ${pollingStatus === 'polling' ? 'animate-spin' : ''}`} />
                                  生成进度
                                </span>
                                <span>{task.progress ?? 0}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    task.progress && task.progress > 0 ? 'bg-primary' : 'bg-primary/50 animate-pulse'
                                  }`}
                                  style={{ width: `${task.progress ?? 0}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {isFailed && task.error_message && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-red-500">
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{task.error_message}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'fonts' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
              {fontGeneration.tasks.length === 0 ? (
                <div className="text-center py-12">
                  <Palette className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">暂无字体生成任务</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">生成字体后会显示在这里</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 py-3">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">字体任务</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">共 {fontGeneration.tasks.length} 个</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                    {fontGeneration.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`relative group bg-gray-50 dark:bg-gray-700 rounded-xl overflow-hidden cursor-pointer transition-all ${
                          selectedFontImage && selectedFontTask?.id === task.id ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => {
                          setSelectedFontImage(task.image_url || null);
                          setSelectedFontTask({ id: task.id, text: task.text_content });
                        }}
                      >
                        {task.image_url && (
                          <img
                            src={task.image_url}
                            alt={task.text_content}
                            className="w-full h-28 sm:h-32 object-cover"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleImageDownload(task.image_url as string, task.text_content); }}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors"
                          >
                            <Download className="w-3 h-3 inline mr-1" />
                            下载
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFontTask(task.id, admin?.id); }}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
                          >
                            <Trash2 className="w-3 h-3 inline mr-1" />
                            删除
                          </button>
                        </div>
                        <div className="p-2 sm:p-3">
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate" title={task.text_content}>
                            {task.text_content}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] sm:text-xs text-gray-400">{task.size}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {selectedImage && (
        <ImagePreviewModal
          imageUrl={selectedImage.url}
          alt={selectedImage.prompt}
          onClose={() => setSelectedImage(null)}
          onDownload={() => handleImageDownload(selectedImage.url)}
          onDelete={() => handleImageDelete(selectedImage.id)}
          extraInfo={
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{selectedImage.size}</span>
              {selectedImage.seed && <span>Seed: {selectedImage.seed}</span>}
            </div>
          }
        />
      )}

      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">视频预览</h3>
              <button onClick={() => setSelectedVideo(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  src={selectedVideo}
                  controls
                  className="w-full max-h-[60vh]"
                />
              </div>
              <div className="mt-3 flex justify-center">
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = selectedVideo;
                    link.download = `video-${Date.now()}.mp4`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-4 h-4 inline mr-2" />
                  下载视频
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedFontImage && selectedFontTask && (
        <ImagePreviewModal
          imageUrl={selectedFontImage}
          alt={selectedFontTask.text}
          onClose={() => {
            setSelectedFontImage(null);
            setSelectedFontTask(null);
          }}
          onDownload={() => handleImageDownload(selectedFontImage, selectedFontTask.text)}
          onDelete={() => removeFontTask(selectedFontTask.id, admin?.id)}
        />
      )}
    </div>
  );
};

export default HistoryPage;
