import React, { useState, useCallback } from 'react';
import { Tag, Copy, Download } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const MetaTagsGeneratorPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [title, setTitle] = useState('我的网站 - 优质内容');
  const [description, setDescription] = useState('这是我的网站描述，包含关键词和主要内容介绍。');
  const [keywords, setKeywords] = useState('关键词1,关键词2,关键词3');
  const [author, setAuthor] = useState('作者名称');
  const [robots, setRobots] = useState('index,follow');
  const [viewport, setViewport] = useState('width=device-width, initial-scale=1.0');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [ogUrl, setOgUrl] = useState('');
  const [ogType, setOgType] = useState('website');

  const generateMetaTags = useCallback(() => {
    let tags = '';
    
    if (title) tags += `<meta charset="UTF-8">\n`;
    if (title) tags += `<meta name="viewport" content="${viewport}">\n`;
    if (title) tags += `<title>${title}</title>\n`;
    if (description) tags += `<meta name="description" content="${description}">\n`;
    if (keywords) tags += `<meta name="keywords" content="${keywords}">\n`;
    if (author) tags += `<meta name="author" content="${author}">\n`;
    if (robots) tags += `<meta name="robots" content="${robots}">\n`;
    
    if (ogTitle || ogDescription || ogImage || ogUrl || ogType) {
      tags += '\n<!-- Open Graph -->\n';
      if (ogTitle) tags += `<meta property="og:title" content="${ogTitle}">\n`;
      if (ogDescription) tags += `<meta property="og:description" content="${ogDescription}">\n`;
      if (ogImage) tags += `<meta property="og:image" content="${ogImage}">\n`;
      if (ogUrl) tags += `<meta property="og:url" content="${ogUrl}">\n`;
      if (ogType) tags += `<meta property="og:type" content="${ogType}">\n`;
    }
    
    return tags;
  }, [title, description, keywords, author, robots, viewport, ogTitle, ogDescription, ogImage, ogUrl, ogType]);

  const handleCopy = useCallback(() => {
    const tags = generateMetaTags();
    if (!tags.trim()) {
      addToast({ message: '没有可复制的内容', type: 'warning' });
      return;
    }
    
    navigator.clipboard.writeText(tags).then(() => {
      addToast({ message: '已复制到剪贴板', type: 'success' });
    }).catch(() => {
      addToast({ message: '复制失败', type: 'error' });
    });
  }, [generateMetaTags, addToast]);

  const handleDownload = useCallback(() => {
    const tags = generateMetaTags();
    if (!tags.trim()) {
      addToast({ message: '没有可下载的内容', type: 'warning' });
      return;
    }
    
    const blob = new Blob([tags], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meta-tags.html';
    a.click();
    URL.revokeObjectURL(url);
    addToast({ message: '文件已下载', type: 'success' });
  }, [generateMetaTags, addToast]);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Tag className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Meta 标签生成器</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors text-sm"
          >
            <Copy className="w-4 h-4" />
            复制
          </button>
          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            下载
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-auto">
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">基本信息</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">页面标题</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
                  placeholder="网站标题"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">页面描述</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm resize-none"
                  rows={3}
                  placeholder="网站描述"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">关键词</label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
                  placeholder="用逗号分隔"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">作者</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Robots</label>
                  <input
                    type="text"
                    value={robots}
                    onChange={(e) => setRobots(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Viewport</label>
                <input
                  type="text"
                  value={viewport}
                  onChange={(e) => setViewport(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
                />
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Open Graph</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">OG 标题</label>
                <input
                  type="text"
                  value={ogTitle}
                  onChange={(e) => setOgTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
                  placeholder="可选"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">OG 描述</label>
                <textarea
                  value={ogDescription}
                  onChange={(e) => setOgDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm resize-none"
                  rows={2}
                  placeholder="可选"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">OG 图片</label>
                <input
                  type="text"
                  value={ogImage}
                  onChange={(e) => setOgImage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
                  placeholder="图片 URL"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">OG URL</label>
                  <input
                    type="text"
                    value={ogUrl}
                    onChange={(e) => setOgUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">OG 类型</label>
                  <select
                    value={ogType}
                    onChange={(e) => setOgType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
                  >
                    <option value="website">website</option>
                    <option value="article">article</option>
                    <option value="blog">blog</option>
                    <option value="product">product</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">生成的代码</h3>
              <textarea
                value={generateMetaTags()}
                readOnly
                className="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono text-xs resize-none outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetaTagsGeneratorPage;