import React, { useState } from 'react';
import styled from 'styled-components';
import { RefreshCw, CheckCircle, Download } from 'lucide-react';
import { useToastStore } from '../store/toastStore';

interface UpdateButtonProps {
  isChecking: boolean;
  hasUpdate: boolean;
  onCheck: () => void;
  downloadUrl: string;
}

const UpdateButton: React.FC<UpdateButtonProps> = ({ isChecking, hasUpdate, onCheck, downloadUrl }) => {
  const { addToast } = useToastStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleDownload = async () => {
    if (!downloadUrl || isDownloading || isInstalling) return;
    
    setIsDownloading(true);
    setDownloadProgress(0);
    addToast({ type: 'info', message: '开始下载更新...' });

    try {
      if (window.electron && window.electron.downloadUpdate) {
        if (window.electron.onDownloadProgress) {
          window.electron.onDownloadProgress((progress) => {
            setDownloadProgress(progress);
          });
        }
        
        const result = await window.electron.downloadUpdate(downloadUrl);
        
        if (result.code === 0) {
          addToast({ type: 'success', message: result.msg });
          
          setIsDownloading(false);
          setDownloadProgress(100);
          setIsInstalling(true);
          
          const installPath = result.path;
          if (installPath) {
            setTimeout(async () => {
              try {
                const installResult = await window.electron!.installUpdate(installPath);
                if (installResult.code === 0) {
                  addToast({ type: 'success', message: installResult.msg });
                } else {
                  addToast({ type: 'error', message: installResult.msg });
                }
              } catch (installError) {
                console.error('Install failed:', installError);
              }
              setIsInstalling(false);
            }, 500);
          }
        } else {
          addToast({ type: 'error', message: result.msg });
        }
      } else {
        window.open(downloadUrl, '_blank');
        addToast({ type: 'info', message: '正在打开下载页面...' });
      }
    } catch (error) {
      console.error('Update download failed:', error);
      let errorMsg = '未知错误';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMsg = (error as { msg?: string }).msg || JSON.stringify(error);
      } else if (typeof error === 'string') {
        errorMsg = error;
      }
      addToast({ type: 'error', message: `下载失败: ${errorMsg}` });
    } finally {
      setIsDownloading(false);
      setIsInstalling(false);
    }
  };

  const getIcon = () => {
    if (isInstalling) {
      return <CheckCircle size={14} />;
    }
    if (isDownloading) {
      return <RefreshCw size={14} className="animate-spin" />;
    }
    if (hasUpdate) {
      return <Download size={14} />;
    }
    if (isChecking) {
      return <RefreshCw size={14} className="animate-spin" />;
    }
    return <RefreshCw size={14} />;
  };

  const getText = () => {
    if (isInstalling) return '安装中...';
    if (isDownloading) return '下载中...';
    if (hasUpdate) return '下载更新';
    if (isChecking) return '检查中...';
    return '检查更新';
  };

  const handleClick = () => {
    if (hasUpdate) {
      handleDownload();
    } else {
      onCheck();
    }
  };

  return (
    <StyledWrapper>
      <button 
        className="button" 
        onClick={handleClick}
        disabled={isChecking || isDownloading || isInstalling}
      >
        <div className="icon">
          {getIcon()}
        </div>
        <span>{getText()}</span>
        {isDownloading && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${downloadProgress}%` }}></div>
          </div>
        )}
      </button>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .button {
    font-family: inherit;
    background: #2CA0D9;
    color: white;
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
    transition: background 0.3s ease;
  }

  .button:hover:not(:disabled) {
    background: #1f7bb5;
  }

  .button:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .button:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(44, 160, 217, 0.5);
  }

  .button .icon {
    background: #fff;
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
    color: #2CA0D9;
    width: 14px;
    height: 14px;
  }

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
    left: 4px;
    right: 4px;
    height: 2px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 1px;
  }

  .progress-fill {
    height: 100%;
    background: white;
    border-radius: 1px;
    transition: width 0.3s ease;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

export default UpdateButton;