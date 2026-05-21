import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Globe, Mail, Phone, Building, FileText, Layers, Plus, Share2 } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlatformVisibility } from '../../../types/account';
import { useAuthStore } from '../../../store/AuthStore';
import WebsitePanel from './panels/WebsitePanel';
import ShopPanel from './panels/ShopPanel';
import SocialPanel from './panels/SocialPanel';
import EmailPanel from './panels/EmailPanel';
import PhonePanel from './panels/PhonePanel';
import CompanyPanel from './panels/CompanyPanel';
import CredentialPanel from './panels/CredentialPanel';
import GeneralPanel from './panels/GeneralPanel';
import ColumnSelector, { ColumnConfig } from '../../../components/ui/ColumnSelector';
import PlatformVisibilitySelector from '../../../components/ui/PlatformVisibilitySelector';

type PlatformType = 'website_account' | 'shops' | 'social' | 'emails' | 'phones' | 'companies' | 'credentials' | 'general';

interface PanelRef {
  openModal: () => void;
  setVisibleColumns: (columns: string[]) => void;
}

const STORAGE_KEY = 'account_columns_visible';

const columnConfigs: Record<PlatformType, ColumnConfig[]> = {
  website_account: [],
  shops: [
    { key: 'platform', label: '平台', defaultVisible: true },
    { key: 'shop_name', label: '店铺名称', defaultVisible: true },
    { key: 'account', label: '账号', defaultVisible: true },
    { key: 'contact_person', label: '联系人', defaultVisible: true },
    { key: 'phone', label: '手机', defaultVisible: true },
    { key: 'email', label: '邮箱' },
    { key: 'password', label: '密码' },
    { key: 'payment_password', label: '支付密码' },
    { key: 'shop_type', label: '店铺类型' },
    { key: 'corporation', label: '公司名称' },
    { key: 'alipay_account', label: '支付宝账号' },
    { key: 'alipay_password', label: '支付宝密码' },
    { key: 'address', label: '地址' },
    { key: 'base_deposit', label: '基础保证金' },
    { key: 'risk_deposit', label: '风险保证金' },
    { key: 'remark', label: '备注' },
  ],
  social: [
    { key: 'platform', label: '平台', defaultVisible: true },
    { key: 'user_name', label: '用户名', defaultVisible: true },
    { key: 'account', label: '账号', defaultVisible: true },
    { key: 'bind_company', label: '绑定企业', defaultVisible: true },
    { key: 'account_status', label: '状态', defaultVisible: true },
    { key: 'email', label: '邮箱' },
    { key: 'password', label: '密码' },
    { key: 'phone', label: '手机号' },
    { key: 'remark', label: '备注' },
  ],
  emails: [
    { key: 'platform', label: '平台', defaultVisible: true },
    { key: 'email', label: '邮箱', defaultVisible: true },
    { key: 'phone', label: '手机号', defaultVisible: true },
    { key: 'remark', label: '备注', defaultVisible: true },
    { key: 'password', label: '密码' },
    { key: 'verification_info', label: '验证信息' },
  ],
  phones: [
    { key: 'phone_number', label: '手机号', defaultVisible: true },
    { key: 'owner', label: '归属人', defaultVisible: true },
    { key: 'phone_operator', label: '运营商', defaultVisible: true },
    { key: 'phone_region', label: '归属地', defaultVisible: true },
    { key: 'status', label: '状态', defaultVisible: true },
    { key: 'remarks', label: '备注' },
  ],
  companies: [
    { key: 'name', label: '企业名称', defaultVisible: true },
    { key: 'unified_social_credit_code', label: '统一社会信用代码', defaultVisible: true },
    { key: 'legal_person', label: '法人', defaultVisible: true },
    { key: 'establishment_date', label: '成立日期' },
    { key: 'address', label: '注册地址' },
    { key: 'registered_capital', label: '注册资本' },
    { key: 'business_scope', label: '经营范围' },
  ],
  credentials: [
    { key: 'certificate_name', label: '证件名称', defaultVisible: true },
    { key: 'id_card_number', label: '证件号码', defaultVisible: true },
    { key: 'gender', label: '性别' },
    { key: 'birth_date', label: '出生日期' },
    { key: 'id_card_address', label: '身份证地址' },
    { key: 'bank_name', label: '开户行' },
    { key: 'bank_account', label: '银行账号' },
    { key: 'phone', label: '手机号' },
    { key: 'certificate_status', label: '状态', defaultVisible: true },
    { key: 'certificate_remark', label: '备注' },
  ],
  general: [
    { key: 'platform_name', label: '平台名称', defaultVisible: true },
    { key: 'account', label: '账号', defaultVisible: true },
    { key: 'password', label: '密码', defaultVisible: true },
    { key: 'notes', label: '备注', defaultVisible: true },
    { key: 'status', label: '状态', defaultVisible: true },
    { key: 'url', label: '网址' },
    { key: 'email', label: '邮箱' },
  ],
};

const getDefaultColumns = (platform: PlatformType): string[] => {
  return columnConfigs[platform]
    .filter(c => c.defaultVisible)
    .map(c => c.key);
};

const loadSavedColumns = (): Record<PlatformType, string[]> | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load saved columns:', e);
  }
  return null;
};

const saveColumns = (columns: Record<PlatformType, string[]>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch (e) {
    console.error('Failed to save columns:', e);
  }
};

const VISIBILITY_STORAGE_KEY = 'account_platform_visibility';
const PLATFORM_ORDER_KEY = 'account_platform_order';

const loadPlatformVisibility = (): PlatformVisibility | null => {
  try {
    const saved = localStorage.getItem(VISIBILITY_STORAGE_KEY);
    if (saved) {
      const visibility = JSON.parse(saved);
      
      // 确保旧数据中的 'password' 被替换为 'website_account'
      if ('password' in visibility) {
        visibility.website_account = visibility.password;
        delete visibility.password;
      }
      
      return visibility;
    }
  } catch (e) {
    console.error('Failed to load platform visibility:', e);
  }
  return null;
};

const savePlatformVisibility = (visibility: PlatformVisibility) => {
  try {
    localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(visibility));
  } catch (e) {
    console.error('Failed to save platform visibility:', e);
  }
};

const loadPlatformOrder = (): PlatformType[] => {
  try {
    const saved = localStorage.getItem(PLATFORM_ORDER_KEY);
    if (saved) {
      let order: string[] = JSON.parse(saved);
      
      // 过滤掉无效的平台 ID，并将 'password' 替换为 'website_account'
      const validPlatforms: PlatformType[] = ['website_account', 'shops', 'social', 'emails', 'phones', 'companies', 'credentials', 'general'];
      order = order.map(p => p === 'password' ? 'website_account' : p)
                   .filter(p => validPlatforms.includes(p as PlatformType));
      
      // 确保所有平台都在列表中，按默认顺序补充缺失的平台
      const defaultOrder: PlatformType[] = ['website_account', 'shops', 'social', 'emails', 'phones', 'companies', 'credentials', 'general'];
      defaultOrder.forEach(p => {
        if (!order.includes(p)) {
          order.push(p);
        }
      });
      
      return order as PlatformType[];
    }
  } catch (e) {
    console.error('Failed to load platform order:', e);
  }
  return ['website_account', 'shops', 'social', 'emails', 'phones', 'companies', 'credentials', 'general'];
};

const savePlatformOrder = (order: PlatformType[]) => {
  try {
    localStorage.setItem(PLATFORM_ORDER_KEY, JSON.stringify(order));
  } catch (e) {
    console.error('Failed to save platform order:', e);
  }
};

const AccountManagerPage: React.FC = () => {
  const navigate = useNavigate();
  const admin = useAuthStore((state) => state.admin);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [activePlatform, setActivePlatform] = useState<PlatformType>('website_account');
  const savedColumns = loadSavedColumns();
  
  const [visibleColumns, setVisibleColumns] = useState<Record<PlatformType, string[]>>(() => {
    if (savedColumns) {
      return savedColumns;
    }
    return {
      website_account: [],
      shops: getDefaultColumns('shops'),
      social: getDefaultColumns('social'),
      emails: getDefaultColumns('emails'),
      phones: getDefaultColumns('phones'),
      companies: getDefaultColumns('companies'),
      credentials: getDefaultColumns('credentials'),
      general: getDefaultColumns('general'),
    };
  });

  const [platformVisibility, setPlatformVisibility] = useState<PlatformVisibility>(() => {
    const saved = loadPlatformVisibility();
    if (saved) {
      return saved;
    }
    return {
      website_account: true,
      shops: true,
      social: true,
      emails: true,
      phones: true,
      companies: true,
      credentials: true,
      general: true,
    };
  });

  const [platformOrder, setPlatformOrder] = useState<PlatformType[]>(loadPlatformOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = platformOrder.findIndex(p => p === active.id);
      const newIndex = platformOrder.findIndex(p => p === over.id);
      const newOrder = arrayMove(platformOrder, oldIndex, newIndex);
      setPlatformOrder(newOrder);
      savePlatformOrder(newOrder);
    }
  }, [platformOrder]);

  const columnsRef = useRef<Record<PlatformType, string[]>>(visibleColumns);
  
  useEffect(() => {
    columnsRef.current = visibleColumns;
  }, [visibleColumns]);

  const websitePanelRef = useRef<PanelRef>(null);
  const shopPanelRef = useRef<PanelRef>(null);
  const socialPanelRef = useRef<PanelRef>(null);
  const emailPanelRef = useRef<PanelRef>(null);
  const phonePanelRef = useRef<PanelRef>(null);
  const companyPanelRef = useRef<PanelRef>(null);
  const credentialPanelRef = useRef<PanelRef>(null);
  const generalPanelRef = useRef<PanelRef>(null);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    saveColumns(columnsRef.current);
  }, [visibleColumns]);

  const updatePanelColumns = useCallback((columns?: string[]) => {
    const panels: Record<PlatformType, React.RefObject<PanelRef | null>> = {
      website_account: websitePanelRef,
      shops: shopPanelRef,
      social: socialPanelRef,
      emails: emailPanelRef,
      phones: phonePanelRef,
      companies: companyPanelRef,
      credentials: credentialPanelRef,
      general: generalPanelRef,
    };
    
    const currentPanel = panels[activePlatform];
    if (currentPanel?.current?.setVisibleColumns) {
      const targetColumns = columns || columnsRef.current[activePlatform];
      currentPanel.current.setVisibleColumns(targetColumns);
    }
  }, [activePlatform]);

  useEffect(() => {
    updatePanelColumns();
  }, [activePlatform, updatePanelColumns]);

  const handleColumnsChange = (columns: string[]) => {
    const newColumns = {
      ...columnsRef.current,
      [activePlatform]: columns
    };
    columnsRef.current = newColumns;
    updatePanelColumns(columns);
    setVisibleColumns(newColumns);
  };

  const platforms = [
    { id: 'website_account' as PlatformType, name: '网站', icon: Globe, showAddButton: true, addLabel: '添加网站账号' },
    { id: 'shops' as PlatformType, name: '店铺', icon: Store, showAddButton: true, addLabel: '添加店铺' },
    { id: 'social' as PlatformType, name: '社媒', icon: Share2, showAddButton: true, addLabel: '添加社媒账号' },
    { id: 'emails' as PlatformType, name: '邮箱', icon: Mail, showAddButton: true, addLabel: '添加邮箱' },
    { id: 'phones' as PlatformType, name: '手机号', icon: Phone, showAddButton: true, addLabel: '添加手机号' },
    { id: 'companies' as PlatformType, name: '企业信息', icon: Building, showAddButton: true, addLabel: '添加企业信息' },
    { id: 'credentials' as PlatformType, name: '证件信息', icon: FileText, showAddButton: true, addLabel: '添加证件信息' },
    { id: 'general' as PlatformType, name: '通用', icon: Layers, showAddButton: true, addLabel: '添加通用账号' },
  ];

  const handleAddClick = () => {
    const currentPlatform = platforms.find(p => p.id === activePlatform);
    if (!currentPlatform?.showAddButton) return;

    switch (activePlatform) {
      case 'website_account':
        websitePanelRef.current?.openModal?.();
        break;
      case 'shops':
        shopPanelRef.current?.openModal?.();
        break;
      case 'social':
        socialPanelRef.current?.openModal?.();
        break;
      case 'emails':
        emailPanelRef.current?.openModal?.();
        break;
      case 'phones':
        phonePanelRef.current?.openModal?.();
        break;
      case 'companies':
        companyPanelRef.current?.openModal?.();
        break;
      case 'credentials':
        credentialPanelRef.current?.openModal?.();
        break;
      case 'general':
        generalPanelRef.current?.openModal?.();
        break;
    }
  };

  const SortablePlatformTab: React.FC<{
    platform: typeof platforms[0];
    isActive: boolean;
    onClick: () => void;
  }> = ({ platform, isActive, onClick }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: platform.id });
    const Icon = platform.icon;

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 50 : 'auto',
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <button
          onClick={onClick}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            isActive
              ? 'bg-gray-800 text-white dark:bg-gray-600'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Icon className="w-4 h-4" />
          {platform.name}
        </button>
      </div>
    );
  };

  const renderPanel = () => {
    if (!admin) return null;
    
    switch (activePlatform) {
      case 'website_account':
        return <WebsitePanel userId={admin.id} ref={websitePanelRef} />;
      case 'shops':
        return <ShopPanel userId={admin.id} ref={shopPanelRef} />;
      case 'social':
        return <SocialPanel userId={admin.id} ref={socialPanelRef} />;
      case 'emails':
        return <EmailPanel userId={admin.id} ref={emailPanelRef} />;
      case 'phones':
        return <PhonePanel userId={admin.id} ref={phonePanelRef} />;
      case 'companies':
        return <CompanyPanel userId={admin.id} ref={companyPanelRef} />;
      case 'credentials':
        return <CredentialPanel userId={admin.id} ref={credentialPanelRef} />;
      case 'general':
        return <GeneralPanel userId={admin.id} ref={generalPanelRef} />;
      default:
        return null;
    }
  };

  const visiblePlatforms = platforms
    .filter(p => platformVisibility[p.id])
    .sort((a, b) => platformOrder.indexOf(a.id) - platformOrder.indexOf(b.id));

  const currentPlatform = platforms.find(p => p.id === activePlatform);

  return (
    <>
      <div className="h-full flex flex-col p-6 overflow-hidden">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col h-full">
          <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
            <div className="flex items-center justify-between">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={visiblePlatforms.map(p => p.id)} strategy={horizontalListSortingStrategy}>
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {visiblePlatforms.map((platform) => (
                      <SortablePlatformTab
                        key={platform.id}
                        platform={platform}
                        isActive={activePlatform === platform.id}
                        onClick={() => setActivePlatform(platform.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <div className="flex items-center gap-1">
                <PlatformVisibilitySelector
                  platforms={platforms}
                  visibility={platformVisibility}
                  onVisibilityChange={(visibility) => {
                    setPlatformVisibility(visibility);
                    savePlatformVisibility(visibility);
                  }}
                />
                {currentPlatform?.showAddButton && (
                  <button
                    onClick={handleAddClick}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    title={currentPlatform.addLabel}
                  >
                    <Plus size={16} />
                  </button>
                )}
                {activePlatform !== 'website_account' && columnConfigs[activePlatform].length > 0 && (
                  <ColumnSelector
                    columns={columnConfigs[activePlatform]}
                    visibleColumns={visibleColumns[activePlatform]}
                    onColumnsChange={handleColumnsChange}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-6">
          {renderPanel()}
        </div>
        </div>
      </div>
    </>
  );
};

export default AccountManagerPage;