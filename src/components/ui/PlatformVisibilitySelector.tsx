import React, { useState, useRef, useEffect } from 'react';
import { Settings, Check } from 'lucide-react';
import { PlatformVisibility } from '../../types/account';

type PlatformType = 'website_account' | 'shops' | 'social' | 'emails' | 'phones' | 'companies' | 'credentials' | 'general';

interface PlatformItem {
  id: PlatformType;
  name: string;
  icon: React.ElementType;
  showAddButton: boolean;
  addLabel: string;
}

interface PlatformVisibilitySelectorProps {
  platforms: PlatformItem[];
  visibility: PlatformVisibility;
  onVisibilityChange: (visibility: PlatformVisibility) => void;
}

const PlatformVisibilitySelector: React.FC<PlatformVisibilitySelectorProps> = ({ platforms, visibility, onVisibilityChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handlePlatformToggle = (platformId: PlatformType) => {
    const newVisibility = {
      ...visibility,
      [platformId]: !visibility[platformId],
    };
    onVisibilityChange(newVisibility);
  };

  const isAllSelected = platforms.every(p => visibility[p.id]);

  const handleSelectAll = () => {
    const newVisibility: PlatformVisibility = {} as PlatformVisibility;
    if (isAllSelected) {
      platforms.forEach(p => {
        newVisibility[p.id] = false;
      });
      newVisibility.website_account = true;
    } else {
      platforms.forEach(p => {
        newVisibility[p.id] = true;
      });
    }
    onVisibilityChange(newVisibility);
  };

  const handleReset = () => {
    const newVisibility: PlatformVisibility = {} as PlatformVisibility;
    platforms.forEach(p => {
      newVisibility[p.id] = true;
    });
    onVisibilityChange(newVisibility);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-content-secondary hover:text-content-primary hover:bg-menu-hover rounded-full transition-colors"
        title="设置可见平台"
      >
        <Settings size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-surface rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2">
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-content-primary bg-surface-secondary hover:bg-menu-hover rounded-md transition-colors"
              >
                全选
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-content-primary bg-surface-secondary hover:bg-menu-hover rounded-md transition-colors"
              >
                重置
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {platforms.map(platform => {
              const Icon = platform.icon;
              return (
                <button
                  key={platform.id}
                  onClick={() => handlePlatformToggle(platform.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-menu-hover transition-colors ${
                    visibility[platform.id]
                      ? 'text-content-primary'
                      : 'text-content-secondary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{platform.name}</span>
                  {visibility[platform.id] && (
                    <Check className="w-4 h-4 text-content-secondary ml-auto" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformVisibilitySelector;