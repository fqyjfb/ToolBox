import React from 'react';
import styled from 'styled-components';
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
    <StyledWrapper>
      <button
        className={`button ${getButtonVariant()}`}
        onClick={handleClick}
        disabled={isDisabled}
      >
        <div className="icon">
          {getIcon()}
        </div>
        <span>{getText()}</span>
        {status === 'downloading' && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${downloadProgress}%` }}></div>
          </div>
        )}
      </button>
      
      {status === 'available' && latestVersion && (
        <div className="version-hint">
          新版本: v{latestVersion}
        </div>
      )}
      
      {status === 'error' && errorMessage && (
        <div className="error-hint">
          {errorMessage}
        </div>
      )}
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .button {
    font-family: inherit;
    color: var(--color-bg-primary);
    font-size: 14px;
    border: none;
    border-radius: 6px;
    letter-spacing: 0.04em;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    height: 28px;
    padding-left: 28px;
    padding-right: 12px;
    cursor: pointer;
    transition: background-color var(--transition-normal);
  }

  .button.default {
    background-color: var(--color-button-primary);
  }

  .button.default:hover:not(:disabled) {
    background-color: var(--color-button-primary-hover);
  }

  .button.success {
    background-color: var(--color-success);
  }

  .button.success:hover:not(:disabled) {
    filter: brightness(0.9);
  }

  .button.primary {
    background-color: var(--color-primary);
  }

  .button.primary:hover:not(:disabled) {
    background-color: var(--color-primary-hover);
  }

  .button.error {
    background-color: var(--color-error);
  }

  .button.error:hover:not(:disabled) {
    filter: brightness(0.9);
  }

  .button.disabled {
    background-color: var(--color-text-tertiary);
    cursor: not-allowed;
  }

  .button:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(39, 93, 126, 0.5);
  }

  .button .icon {
    background: var(--color-bg-primary);
    height: 20px;
    width: 20px;
    border-radius: 50%;
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    left: 4px;
    transition: all 0.5s;
  }

  .icon svg {
    transition: all 0.5s;
    width: 14px;
    height: 14px;
  }

  .default .icon svg { color: var(--color-button-primary); }
  .success .icon svg { color: var(--color-success); }
  .primary .icon svg { color: var(--color-primary); }
  .error .icon svg { color: var(--color-error); }
  .disabled .icon svg { color: var(--color-text-tertiary); }

  .button:hover:not(:disabled) .icon svg {
    transform: rotate(360deg);
  }

  .button:hover:not(:disabled) .icon {
    width: calc(100% - 8px);
    border-radius: 4px;
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  .progress-bar {
    position: absolute;
    bottom: 0;
    left: 5px;
    right: 5px;
    height: 2px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 1px;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-bg-primary);
    border-radius: 1px;
    transition: width 0.3s ease;
  }

  .version-hint {
    font-size: var(--text-xs);
    color: var(--color-success);
    margin-top: var(--space-1);
    text-align: center;
  }

  .error-hint {
    font-size: var(--text-xs);
    color: var(--color-error);
    margin-top: var(--space-1);
    text-align: center;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

export default UpdateButton;