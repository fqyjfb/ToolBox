import React, { useEffect, useCallback, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

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
  className?: string;
}

export interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}

const VIEWPORT_PADDING = 8;

const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, x, y, items, onClose }) => {
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const [position, setPosition] = useState({ x, y });
  const menuRef = useRef<HTMLDivElement>(null);
  const subMenuRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.context-menu-container')) {
      onClose();
      setActiveSubMenu(null);
    }
  }, [onClose]);

  const adjustSubMenuPosition = useCallback((subMenuId: string) => {
    if (!menuRef.current) return;

    const subMenu = subMenuRefs.current.get(subMenuId);
    if (!subMenu) return;

    requestAnimationFrame(() => {
      try {
        const menuRect = menuRef.current?.getBoundingClientRect();
        // 子菜单 absolute 的包含块是触发项 li，垂直翻转需以触发项位置为基准
        const triggerRect = subMenu.parentElement?.getBoundingClientRect();
        const subMenuRect = subMenu.getBoundingClientRect();

        if (!menuRect || !triggerRect) return;

        const maxWidth = document.documentElement.clientWidth || window.innerWidth;
        const maxHeight = document.documentElement.clientHeight || window.innerHeight;
        const padding = VIEWPORT_PADDING;
        const subMenuRight = menuRect.right + subMenuRect.width;
        const subMenuBottom = triggerRect.top + subMenuRect.height;

        if (subMenuRight > maxWidth - padding) {
          subMenu.style.setProperty('left', 'auto');
          subMenu.style.setProperty('right', '100%');
          subMenu.style.setProperty('margin-left', '0');
          subMenu.style.setProperty('margin-right', '1px');
        } else {
          subMenu.style.setProperty('left', '100%');
          subMenu.style.setProperty('right', 'auto');
          subMenu.style.setProperty('margin-left', '1px');
          subMenu.style.setProperty('margin-right', '0');
        }

        if (subMenuBottom > maxHeight - padding) {
          subMenu.style.setProperty('top', 'auto');
          subMenu.style.setProperty('bottom', '0');
        } else {
          subMenu.style.setProperty('top', '0');
          subMenu.style.setProperty('bottom', 'auto');
        }
      } catch (error) {
        console.warn('Failed to adjust submenu position:', error);
      }
    });
  }, []);

  useEffect(() => {
    if (activeSubMenu) {
      adjustSubMenuPosition(activeSubMenu);
    }
  }, [activeSubMenu, adjustSubMenuPosition]);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (activeSubMenu) {
          adjustSubMenuPosition(activeSubMenu);
        }
      });

      resizeObserverRef.current.observe(document.body);

      return () => {
        resizeObserverRef.current?.disconnect();
      };
    }
  }, [isOpen, activeSubMenu, adjustSubMenuPosition]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClickOutside]);

  // 绘制前根据菜单实际尺寸将位置约束在视口内（右侧/底部溢出时向左/向上翻转），避免闪烁
  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    const maxWidth = document.documentElement.clientWidth || window.innerWidth;
    const maxHeight = document.documentElement.clientHeight || window.innerHeight;
    const padding = VIEWPORT_PADDING;

    let newX = x;
    let newY = y;

    if (newX + rect.width > maxWidth - padding) {
      newX = Math.max(padding, maxWidth - rect.width - padding);
    }
    if (newY + rect.height > maxHeight - padding) {
      newY = Math.max(padding, maxHeight - rect.height - padding);
    }

    setPosition({ x: newX, y: newY });
  }, [isOpen, x, y, items]);

  useEffect(() => {
    const refs = subMenuRefs.current;
    return () => {
      refs.clear();
    };
  }, []);

  if (!isOpen) return null;

  // 通过 Portal 渲染到 document.body，脱离祖先元素的 transform 包含块与 overflow 裁剪，
  // 保证 position: fixed 始终基于真实视口定位
  return createPortal(
    <div
      ref={menuRef}
      className="context-menu-container"
      style={{
        left: position.x,
        top: position.y,
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
                    className={`popup-menu-item w-full ${item.className || ''}`}
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
                    {item.subMenu && (
                      <span>
                        <svg
                          className="submenu-arrow-icon"
                          viewBox="0 0 1024 1024"
                          fill="currentColor"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M326.2 960L267 900.8 655.9 512 267.1 123.2 326.2 64l418.4 418.4c16.3 16.3 16.3 42.8 0 59.2L326.2 960z" />
                        </svg>
                      </span>
                    )}
                  </button>
                  {item.subMenu && activeSubMenu === item.id && (
                    <div
                      ref={(el) => {
                        if (el) {
                          subMenuRefs.current.set(item.id, el as HTMLDivElement);
                        }
                      }}
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
    </div>,
    document.body
  );
};

export default ContextMenu;
