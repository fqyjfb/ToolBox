import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, Download, Copy, Sparkles, Trash2, Check, Send, Settings2, History } from 'lucide-react';
import { createFontTask, deleteFontTask, getUserFontTasks } from '../../../services/AgnesService';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import ImagePreviewModal from '../../../components/ImagePreviewModal';
import { generateImage } from '../../../services/agnesApi';
import type { FontGenerationTask } from '../../../types/agnes';
import { FONT_CATEGORIES, FONT_STYLES, type FontStyle } from '../../../constants/fontStyles';

const generateUniqueFileName = (text: string): string => {
  return `${text}-${Date.now()}.png`;
};

const SIZE_OPTIONS = [
  { value: '512x512', label: '512' },
  { value: '1024x1024', label: '1024' },
  { value: '1024x768', label: '1024×768' },
  { value: '768x1024', label: '768×1024' },
  { value: '1024x1536', label: '1024×1536' },
  { value: '1536x1024', label: '1536×1024' },
];

const BACKGROUND_OPTIONS = [
  { value: 'white', label: '白', description: '白色背景' },
  { value: 'black', label: '黑', description: '黑色背景' },
  { value: 'transparent', label: '透', description: '透明背景' },
  { value: 'gradient', label: '渐', description: '渐变背景' },
];

const FontGeneratorPage: React.FC = () => {
  const admin = useAuthStore((state) => state.admin);
  const addToast = useToastStore((state) => state.addToast);
  const navigate = useNavigate();

  const [selectedCategory, setSelectedCategory] = useState<string>('fashion');
  const [selectedFontStyle, setSelectedFontStyle] = useState<FontStyle | null>(null);
  const [textInput, setTextInput] = useState('');
  const [imageSize, setImageSize] = useState('1024x1024');
  const [imageSeed, setImageSeed] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('white');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationHistory, setGenerationHistory] = useState<FontGenerationTask[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<FontGenerationTask | null>(null);

  const categories = useMemo(() => FONT_CATEGORIES, []);
  const fontStyles = useMemo(() => {
    return FONT_STYLES.filter(style => style.category_id === selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    if (!admin) return;

    const loadHistory = async () => {
      try {
        const tasks = await getUserFontTasks(admin.id);
        setGenerationHistory(tasks);
      } catch (error) {
        console.error('加载历史记录失败:', error);
      }
    };

    loadHistory();
  }, [admin]);

  const handleGenerate = async () => {
    if (!admin || !textInput.trim() || !selectedFontStyle) return;

    setIsGenerating(true);

    try {
      let prompt = selectedFontStyle.prompt.replace(/"[^"]+"/, `"${textInput.trim()}"`);

      if (backgroundColor === 'transparent') {
        prompt += ' 透明背景，无背景色';
      } else if (backgroundColor === 'white') {
        prompt += ' 纯白色背景，干净简洁';
      } else if (backgroundColor === 'black') {
        prompt += ' 纯黑色背景，高对比度';
      } else if (backgroundColor === 'gradient') {
        prompt += ' 渐变色彩背景，现代感';
      }

      const extraBody: Record<string, unknown> = {};
      if (negativePrompt) {
        extraBody.negative_prompt = negativePrompt;
      }
      if (imageSeed) {
        extraBody.seed = parseInt(imageSeed, 10);
      }

      const result = await generateImage(prompt, 'agnes-image-2.1-flash', imageSize, extraBody);

      await createFontTask(admin.id, {
        font_style_id: selectedFontStyle.style_id,
        text_content: textInput.trim(),
        prompt,
        size: imageSize,
        background_color: backgroundColor,
        negative_prompt: negativePrompt || undefined,
        image_url: result.url
      });

      const newTask: FontGenerationTask = {
        id: Date.now().toString(),
        user_id: admin.id,
        task_id: Date.now().toString(36),
        font_style_id: selectedFontStyle.style_id,
        text_content: textInput.trim(),
        prompt,
        size: imageSize,
        background_color: backgroundColor,
        negative_prompt: negativePrompt || undefined,
        image_url: result.url,
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setGenerationHistory(prev => [newTask, ...prev]);

      addToast({ type: 'success', message: '字体生成成功' });
    } catch (error) {
      console.error('生成失败:', error);
      addToast({ type: 'error', message: '生成失败，请稍后重试' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (url: string, text: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = generateUniqueFileName(text);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      addToast({ type: 'success', message: '下载成功' });
    } catch {
      addToast({ type: 'error', message: '下载失败' });
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      addToast({ type: 'success', message: '链接已复制' });
    } catch {
      addToast({ type: 'error', message: '复制失败' });
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!admin) return;

    try {
      await deleteFontTask(admin.id, taskId);
      setGenerationHistory(prev => prev.filter(item => item.id !== taskId));
      addToast({ type: 'success', message: '删除成功' });
    } catch (error) {
      console.error('删除失败:', error);
      addToast({ type: 'error', message: '删除失败' });
    }
  };

  const handlePreview = (url: string, item?: FontGenerationTask) => {
    setPreviewImage(url);
    setPreviewItem(item || null);
  };

  return (
    <div className="h-full flex flex-col md:flex-row">
      <div className="md:max-w-[210px] flex flex-col md:min-w-[210px]">
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Palette className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-gray-800 dark:text-gray-200">字体生成器</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI艺术字体</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/tools/ai-chat/history')}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400"
            title="历史记录"
          >
            <History className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 relative">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedFontStyle(null);
            }}
            className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
          >
            {categories.map(cat => (
              <option key={cat.category_id} value={cat.category_id}>
                {cat.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="h-32 overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-1.5">
              {fontStyles.map(style => (
                <button
                  key={style.style_id}
                  onClick={() => setSelectedFontStyle(style)}
                  className={`relative aspect-[5/2] rounded-md overflow-hidden border transition-all ${
                    selectedFontStyle?.style_id === style.style_id
                      ? 'border-primary ring-1 ring-primary/30 shadow-sm'
                      : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <img
                    src={`./tools/ai-chat/fonts/${style.thumbnail}`}
                    alt={style.name}
                    className="w-full h-full object-cover bg-black"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-0.5">
                    <span className="text-[10px] text-white font-medium truncate">{style.name}</span>
                  </div>
                  {selectedFontStyle?.style_id === style.style_id && (
                    <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-1.5 h-1.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2.5 space-y-1.5">
            <div className="relative">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="输入文字（2-4字）"
                maxLength={10}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {textInput && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {textInput.length}/10
                </span>
              )}
            </div>

            {selectedFontStyle && (
              <div className="relative">
                <textarea
                  value={selectedFontStyle.prompt.replace(/"[^"]+"，?/, '') || ''}
                  onChange={(e) => {
                    if (selectedFontStyle) {
                      const match = selectedFontStyle.prompt.match(/"[^"]+"/);
                      const textPart = match ? match[0] : '""';
                      const updatedStyle = {
                        ...selectedFontStyle,
                        prompt: `${textPart}，${e.target.value}`
                      };
                      setSelectedFontStyle(updatedStyle);
                    }
                  }}
                  placeholder="字体风格描述..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
                >
                  {SIZE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">尺寸</span>
              </div>
              <div className="w-16">
                <input
                  type="number"
                  value={imageSeed}
                  onChange={(e) => setImageSeed(e.target.value)}
                  placeholder="种子"
                  className="w-full px-2 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              {BACKGROUND_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setBackgroundColor(opt.value)}
                  className={`w-8 h-8 rounded-md text-xs font-medium transition-all ${
                    backgroundColor === opt.value
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300'
                  }`}
                  title={opt.description}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="负向提示词"
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

            <button
              onClick={handleGenerate}
              disabled={!textInput.trim() || !selectedFontStyle || isGenerating}
              className="w-full py-2.5 text-sm rounded-md bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  生成字体
                </>
              )}
            </button>

            {selectedFontStyle && (
              <div className="px-2 py-1.5 rounded-md border border-primary/20">
                <div className="flex items-center gap-1.5">
                  <Settings2 className="w-3 h-3 text-primary" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">已选择: </span>
                  <span className="text-xs text-primary font-medium">{selectedFontStyle.name}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-3 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-200">生成结果</h1>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">点击缩略图放大预览，支持下载、复制和删除</p>
          </div>
          {generationHistory.length > 0 && (
            <span className="px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-xs md:text-sm text-gray-600 dark:text-gray-300">
              {generationHistory.length} 张
            </span>
          )}
        </div>

        {generationHistory.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4">
              <Palette className="w-10 h-10 text-primary/60" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">还没有生成的字体图片</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">选择字体样式并输入文字开始生成</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
              {generationHistory.map((item) => {
                const textMatch = item.prompt.match(/"([^"]+)"/);
                const displayText = textMatch ? textMatch[1] : item.text_content;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl overflow-hidden hover:shadow-md transition-all"
                  >
                    <div
                      className="aspect-square cursor-pointer"
                      onClick={() => handlePreview(item.image_url || '', item)}
                    >
                      <img
                        src={item.image_url}
                        alt={displayText}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="p-2 md:p-3">
                      <div className="flex items-center justify-between mb-1 md:mb-2">
                        <span className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[60%]">
                          {displayText}
                        </span>
                        <span className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">
                          {SIZE_OPTIONS.find(s => s.value === item.size)?.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleDownload(item.image_url || '', displayText)}
                          className="flex-1 h-7 md:h-8 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-primary hover:text-white transition-all text-[10px] md:text-xs"
                          title="下载"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleCopyLink(item.image_url || '')}
                          className="flex-1 h-7 md:h-8 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-primary hover:text-white transition-all text-[10px] md:text-xs"
                          title="复制链接"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="flex-1 h-7 md:h-8 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-500 hover:text-white transition-all text-[10px] md:text-xs"
                          title="删除"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage}
          alt={previewItem?.text_content || '字体预览'}
          onClose={() => {
            setPreviewImage(null);
            setPreviewItem(null);
          }}
          onDownload={() => {
            const text = previewItem ? (() => {
              const textMatch = previewItem.prompt.match(/"([^"]+)"/);
              return textMatch ? textMatch[1] : previewItem.text_content;
            })() : 'font';
            handleDownload(previewImage, text);
          }}
          onDelete={previewItem ? () => handleDelete(previewItem.id) : undefined}
        />
      )}
    </div>
  );
};

export default FontGeneratorPage;
