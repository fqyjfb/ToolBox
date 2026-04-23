import React, { useEffect, useCallback, useState, useRef } from 'react';

export interface SubMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

export interface ContextMenuItem {
  id: string;
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  divider?: boolean;
  subMenu?: SubMenuItem[];
}

export interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, x, y, items, onClose }) => {
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.context-menu-container')) {
      onClose();
      setActiveSubMenu(null);
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClickOutside]);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      const menu = menuRef.current;
      
      const padding = 8;
      const maxWidth = document.documentElement.clientWidth || window.innerWidth;
      const maxHeight = document.documentElement.clientHeight || window.innerHeight;
      
      const itemHeight = 36;
      const menuWindowPadding = 16;
      const dividerHeight = 8;
      
      const dividerCount = items.filter(item => item.divider).length;
      const estimatedHeight = items.length * itemHeight + dividerCount * dividerHeight + menuWindowPadding;
      const estimatedWidth = 160;
      
      let newX = x + 8;
      let newY: number;
      
      const viewportCenterY = maxHeight / 2;
      
      if (y < viewportCenterY) {
        newY = y + 8;
      } else {
        newY = y - estimatedHeight - 8;
      }
      
      if (newX + estimatedWidth > maxWidth) {
        newX = x - estimatedWidth - 8;
      }
      if (newX < padding) {
        newX = padding;
      }
      
      if (newY < padding) {
        newY = padding;
      }
      if (newY + estimatedHeight > maxHeight) {
        newY = maxHeight - estimatedHeight;
      }
      
      menu.style.left = `${newX}px`;
      menu.style.top = `${newY}px`;
    }
  }, [isOpen, x, y, items.length]);

  if (!isOpen) return null;

  return (
    <div 
      ref={menuRef}
      className="context-menu-container" 
      style={{ 
        left: x + 8, 
        top: y + 8 
      }}
    >
      <div className="popup-menu-window">
        <ul className="popup-menu-list">
          {items.map((item) => (
            <React.Fragment key={item.id}>
              {item.divider ? (
                <li className="popup-menu-divider"></li>
              ) : (
                <li className={`relative ${item.subMenu ? 'has-submenu' : ''}`}>
                  <button 
                    className="popup-menu-item w-full" 
                    onClick={() => {
                      if (item.subMenu) {
                        setActiveSubMenu(activeSubMenu === item.id ? null : item.id);
                      } else {
                        item.onClick?.();
                        onClose();
                      }
                    }}
                    onMouseEnter={() => {
                      if (item.subMenu) {
                        setActiveSubMenu(item.id);
                      } else {
                        setActiveSubMenu(null);
                      }
                    }}
                  >
                    <span className="popup-menu-icon">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    {item.subMenu && <span>▶</span>}
                  </button>
                  {item.subMenu && activeSubMenu === item.id && (
                    <div 
                      className="popup-menu-window context-submenu"
                      onMouseLeave={() => {
                        setActiveSubMenu(null);
                      }}
                    >
                      <ul className="popup-menu-list">
                        {item.subMenu.map((subItem) => (
                          <li key={subItem.id}>
                            <button 
                              className="popup-menu-item w-full" 
                              onClick={() => {
                                subItem.onClick();
                                onClose();
                                setActiveSubMenu(null);
                              }}
                            >
                              <span className="popup-menu-icon">
                                {subItem.icon}
                              </span>
                              <span>{subItem.label}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              )}
            </React.Fragment>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ContextMenu;
