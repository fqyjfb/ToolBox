import React, { useState, useCallback } from 'react';
import { Map, Copy, Download, FileText } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

interface UrlEntry {
  url: string;
  priority: string;
  changefreq: string;
  lastmod: string;
}

const SitemapGeneratorPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [entries, setEntries] = useState<UrlEntry[]>([
    { url: 'https://example.com/', priority: '1.0', changefreq: 'daily', lastmod: '' },
    { url: 'https://example.com/about', priority: '0.8', changefreq: 'weekly', lastmod: '' },
    { url: 'https://example.com/blog', priority: '0.9', changefreq: 'daily', lastmod: '' },
  ]);
  const [output, setOutput] = useState('');

  const changefreqOptions = [
    { value: 'always', label: 'always' },
    { value: 'hourly', label: 'hourly' },
    { value: 'daily', label: 'daily' },
    { value: 'weekly', label: 'weekly' },
    { value: 'monthly', label: 'monthly' },
    { value: 'yearly', label: 'yearly' },
    { value: 'never', label: 'never' },
  ];

  const priorityOptions = ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1.0'];

  const generateSitemap = useCallback(() => {
    const validEntries = entries.filter(e => e.url);
    
    if (validEntries.length === 0) {
      addToast({ message: '请至少添加一个 URL', type: 'warning' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    validEntries.forEach(entry => {
      xml += `
  <url>
    <loc>${entry.url}</loc>`;
      
      if (entry.lastmod) {
        xml += `
    <lastmod>${entry.lastmod}</lastmod>`;
      } else {
        xml += `
    <lastmod>${today}</lastmod>`;
      }
      
      xml += `
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`;
    });

    xml += `
</urlset>`;

    setOutput(xml);
    addToast({ message: 'Sitemap 已生成', type: 'success' });
  }, [entries, addToast]);

  const addEntry = useCallback(() => {
    setEntries([...entries, { url: '', priority: '0.5', changefreq: 'weekly', lastmod: '' }]);
  }, [entries]);

  const removeEntry = useCallback((index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  }, [entries]);

  const updateEntry = useCallback((index: number, field: keyof UrlEntry, value: string) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  }, [entries]);

  const handleCopy = useCallback(() => {
    if (!output) {
      addToast({ message: '没有可复制的内容', type: 'warning' });
      return;
    }
    
    navigator.clipboard.writeText(output).then(() => {
      addToast({ message: '已复制到剪贴板', type: 'success' });
    }).catch(() => {
      addToast({ message: '复制失败', type: 'error' });
    });
  }, [output, addToast]);

  const handleDownload = useCallback(() => {
    if (!output) {
      addToast({ message: '没有可下载的内容', type: 'warning' });
      return;
    }
    
    const blob = new Blob([output], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sitemap.xml';
    a.click();
    URL.revokeObjectURL(url);
    addToast({ message: '文件已下载', type: 'success' });
  }, [output, addToast]);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Map className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Sitemap 生成器</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={generateSitemap}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            生成 XML
          </button>
          <button 
            onClick={handleCopy}
            disabled={!output}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Copy className="w-4 h-4" />
            复制
          </button>
          <button 
            onClick={handleDownload}
            disabled={!output}
            className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            下载
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-auto">
        <div className="p-4">
          <div className="mb-4">
            {entries.map((entry, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">URL {index + 1}</span>
                  {entries.length > 1 && (
                    <button
                      onClick={() => removeEntry(index)}
                      className="text-red-500 hover:text-red-600 text-sm"
                    >
                      删除
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={entry.url}
                    onChange={(e) => updateEntry(index, 'url', e.target.value)}
                    placeholder="https://example.com/path"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm"
                  />
                  
                  <select
                    value={entry.priority}
                    onChange={(e) => updateEntry(index, 'priority', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm"
                  >
                    {priorityOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  
                  <select
                    value={entry.changefreq}
                    onChange={(e) => updateEntry(index, 'changefreq', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm"
                  >
                    {changefreqOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  
                  <input
                    type="date"
                    value={entry.lastmod}
                    onChange={(e) => updateEntry(index, 'lastmod', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm"
                  />
                </div>
              </div>
            ))}
            
            <button
              onClick={addEntry}
              className="w-full py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
            >
              + 添加 URL
            </button>
          </div>

          {output && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">生成的 Sitemap XML</h3>
              <textarea
                value={output}
                readOnly
                className="w-full h-48 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SitemapGeneratorPage;