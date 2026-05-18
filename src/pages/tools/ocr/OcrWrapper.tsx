import React, { Suspense, lazy } from 'react';
import { Monitor, AlertCircle } from 'lucide-react';
import { isElectron } from '../../../utils/environment';

const OcrPage = isElectron() 
  ? lazy(() => import('./index')) 
  : () => (
      <div className="flex flex-col h-full min-h-full bg-bg-primary items-center justify-center p-8">
        <div className="bg-card rounded-lg shadow-md p-8 text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
            <Monitor className="w-8 h-8 text-error" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">OCR文字识别</h2>
          <p className="text-text-secondary text-sm mb-4">
            此功能仅在桌面应用中可用，需要本地Python环境支持。
          </p>
          <div className="flex items-center gap-2 text-warning text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>请下载桌面客户端以使用此功能</span>
          </div>
        </div>
      </div>
    );

const OcrWrapper: React.FC = () => {
  if (!isElectron()) {
    return <OcrPage />;
  }
  
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-text-secondary mt-4">加载中...</span>
        </div>
      </div>
    }>
      <OcrPage />
    </Suspense>
  );
};

export default OcrWrapper;