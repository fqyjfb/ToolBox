import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QrCode, Copy, Download, RefreshCw } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';
import QRCode from 'qrcode';

const QrGeneratorPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [input, setInput] = useState('https://htmls.dev');
  const [size, setSize] = useState(256);
  const [level, setLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [colorDark, setColorDark] = useState('#000000');
  const [colorLight, setColorLight] = useState('#ffffff');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateQR = useCallback(async () => {
    if (!input.trim()) {
      addToast({ message: '请输入内容', type: 'warning' });
      return;
    }

    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = size;
      canvas.height = size;

      await QRCode.toCanvas(canvas, input.trim(), {
        width: size,
        margin: 1,
        color: {
          dark: colorDark,
          light: colorLight
        },
        errorCorrectionLevel: level
      });

      setQrDataUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      addToast({ message: '生成失败: ' + (err as Error).message, type: 'error' });
    }
  }, [input, size, level, colorDark, colorLight, addToast]);

  useEffect(() => {
    generateQR();
  }, [generateQR]);

  const handleCopy = useCallback(() => {
    if (!qrDataUrl) {
      addToast({ message: '没有可复制的内容', type: 'warning' });
      return;
    }
    
    navigator.clipboard.writeText(qrDataUrl).then(() => {
      addToast({ message: '已复制图片链接', type: 'success' });
    }).catch(() => {
      addToast({ message: '复制失败', type: 'error' });
    });
  }, [qrDataUrl, addToast]);

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) {
      addToast({ message: '没有可下载的内容', type: 'warning' });
      return;
    }
    
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'qrcode.png';
    link.click();
    addToast({ message: '图片已下载', type: 'success' });
  }, [qrDataUrl, addToast]);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <QrCode className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">二维码生成器</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleCopy}
            disabled={!qrDataUrl}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Copy className="w-4 h-4" />
            复制链接
          </button>
          <button 
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            下载
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-auto">
        <div className="p-6 flex flex-col lg:flex-row gap-8 items-start justify-center">
          <div className="flex-shrink-0">
            {qrDataUrl ? (
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow-md">
                <img src={qrDataUrl} alt="QR Code" className="rounded" />
              </div>
            ) : (
              <div className="w-64 h-64 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <QrCode className="w-16 h-16 text-gray-400" />
              </div>
            )}
          </div>
          
          <div className="flex-1 w-full max-w-md space-y-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">内容</label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none outline-none focus:border-blue-500"
                rows={4}
                placeholder="输入文本或网址..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">尺寸</label>
                <select
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:border-blue-500"
                >
                  <option value="128">128 x 128</option>
                  <option value="256">256 x 256</option>
                  <option value="384">384 x 384</option>
                  <option value="512">512 x 512</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">容错级别</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as 'L' | 'M' | 'Q' | 'H')}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:border-blue-500"
                >
                  <option value="L">低 (7%)</option>
                  <option value="M">中 (15%)</option>
                  <option value="Q">较高 (25%)</option>
                  <option value="H">高 (30%)</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">颜色</label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">前景色</label>
                  <div className="relative">
                    <input
                      type="color"
                      value={colorDark}
                      onChange={(e) => setColorDark(e.target.value)}
                      className="w-full h-10 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">背景色</label>
                  <input
                    type="color"
                    value={colorLight}
                    onChange={(e) => setColorLight(e.target.value)}
                    className="w-full h-10 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
            </div>
            
            <button
              onClick={generateQR}
              className="w-full flex items-center justify-center gap-2 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              生成二维码
            </button>
          </div>
        </div>
      </div>
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default QrGeneratorPage;