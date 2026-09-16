import React from 'react';
import { RefreshCw, CheckCircle, Sparkles, AlertCircle } from 'lucide-react';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'error';

interface UpdateButtonProps {
  status: UpdateStatus;
  latestVersion: string;
  downloadProgress: number;
  onCheck: () => void;
  onDownload: () => void;
  onInstall: () => void;
  onRetry: () => void;
  errorMessage: string;
}

const UpdateButton: React.FC<UpdateButtonProps> = ({
  status,
  latestVersion,
  downloadProgress,
  onCheck,
  onDownload,
  onInstall,
  onRetry,
  errorMessage,
}) => {
  const getIcon = () => {
    switch (status) {
      case 'checking':
      case 'downloading':
        return <RefreshCw size={14} className="animate-spin" />;
      case 'available':
        return <Sparkles size={14} />;
      case 'ready':
      case 'installing':
        return <CheckCircle size={14} />;
      case 'error':
        return <AlertCircle size={14} />;
      default:
        return <RefreshCw size={14} />;
    }
  };

  const getText = () => {
    switch (status) {
      case 'checking':
        return '检查中...';
      case 'downloading':
        return `下载中... ${downloadProgress}%`;
      case 'available':
        return '下载更新';
      case 'ready':
        return '安装更新';
      case 'installing':
        return '安装中...';
      case 'error':
        return '重试';
      default:
        return '检查更新';
    }
  };

  const getButtonVariant = () => {
    switch (status) {
      case 'available':
        return 'success';
      case 'ready':
        return 'primary';
      case 'error':
        return 'error';
      case 'checking':
      case 'downloading':
      case 'installing':
        return 'disabled';
      default:
        return 'default';
    }
  };

  const handleClick = () => {
    switch (status) {
      case 'available':
        onDownload();
        break;
      case 'ready':
        onInstall();
        break;
      case 'error':
        onRetry();
        break;
      default:
        onCheck();
    }
  };

  const isDisabled = ['checking', 'downloading', 'installing'].includes(status);

  return (
    <div className="update-button-wrapper">
      <button
        className={`update-button ${getButtonVariant()}`}
        onClick={handleClick}
        disabled={isDisabled}
      >
        <div className="update-icon">
          {getIcon()}
        </div>
        <span>{getText()}</span>
        {status === 'downloading' && (
          <div className="update-progress-bar">
            <div className="update-progress-fill" style={{ width: `${downloadProgress}%` }}></div>
          </div>
        )}
      </button>
      
      {status === 'available' && latestVersion && (
        <div className="update-version-hint">
          新版本: v{latestVersion}
        </div>
      )}
      
      {status === 'error' && errorMessage && (
        <div className="update-error-hint">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default UpdateButton;