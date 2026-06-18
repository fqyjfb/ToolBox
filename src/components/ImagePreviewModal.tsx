import React from 'react';
import { X, Download, Trash2 } from 'lucide-react';

interface ImagePreviewModalProps {
  imageUrl: string;
  alt?: string;
  onClose: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  extraInfo?: React.ReactNode;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  imageUrl,
  alt = 'Preview',
  onClose,
  onDownload,
  onDelete,
  showActions = true,
  extraInfo,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">图片预览</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
            <img
              src={imageUrl}
              alt={alt}
              className="w-full max-h-[55vh] object-contain"
            />
            {showActions && (
              <div className="absolute top-2 right-2 flex gap-1">
                {onDownload && (
                  <button
                    onClick={onDownload}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/80 hover:bg-white text-gray-600 hover:text-primary shadow-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => {
                      onDelete();
                      onClose();
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/80 hover:bg-white text-gray-600 hover:text-red-500 shadow-sm transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
          {alt && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-800 dark:text-gray-200 truncate" title={alt}>
                {alt}
              </p>
              {extraInfo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImagePreviewModal;