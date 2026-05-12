import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Globe, Mail, Phone, Building, FileText, Layers, Plus } from 'lucide-react';
import { useAuthStore } from '../../../store/AuthStore';
import { useNavSearch } from '../../../contexts/NavSearchContext';
import PasswordPanel from './panels/PasswordPanel';
import ShopPanel from './panels/ShopPanel';
import SocialPanel from './panels/SocialPanel';
import EmailPanel from './panels/EmailPanel';
import PhonePanel from './panels/PhonePanel';
import CompanyPanel from './panels/CompanyPanel';
import CredentialPanel from './panels/CredentialPanel';
import GeneralPanel from './panels/GeneralPanel';

type PlatformType = 'password' | 'shops' | 'social' | 'emails' | 'phones' | 'companies' | 'credentials' | 'general';

interface PanelRef {
  openModal: () => void;
}

const AccountManagerPage: React.FC = () => {
  const navigate = useNavigate();
  const admin = useAuthStore((state) => state.admin);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { searchQuery, isSearchActive } = useNavSearch();

  const [activePlatform, setActivePlatform] = useState<PlatformType>('password');

  const passwordPanelRef = useRef<PanelRef>(null);
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
  }, [searchQuery, isSearchActive, activePlatform]);

  const platforms = [
    { id: 'password' as PlatformType, name: '网站', icon: Globe, showAddButton: true, addLabel: '添加网站账号' },
    { id: 'shops' as PlatformType, name: '店铺', icon: Store, showAddButton: true, addLabel: '添加店铺' },
    { id: 'social' as PlatformType, name: '社媒', icon: Globe, showAddButton: true, addLabel: '添加社媒账号' },
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
      case 'password':
        passwordPanelRef.current?.openModal?.();
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

  const renderPanel = () => {
    if (!admin) return null;
    
    switch (activePlatform) {
      case 'password':
        return <PasswordPanel userId={admin.id} ref={passwordPanelRef} />;
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

  const currentPlatform = platforms.find(p => p.id === activePlatform);

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col h-full">
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 overflow-x-auto">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                return (
                  <button
                    key={platform.id}
                    onClick={() => setActivePlatform(platform.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activePlatform === platform.id
                        ? 'bg-gray-800 text-white dark:bg-gray-600'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {platform.name}
                  </button>
                );
              })}
            </div>
            {currentPlatform?.showAddButton && (
              <button
                onClick={handleAddClick}
                className="p-2 text-white bg-gray-800 hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 rounded-full transition-colors ml-4"
                title={currentPlatform.addLabel}
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-6">
          {renderPanel()}
        </div>
      </div>
    </div>
  );
};

export default AccountManagerPage;