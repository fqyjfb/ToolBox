import React, { useState } from 'react';
import { User, Mail, Phone, Lock, Save, AlertCircle, Edit2, Check, X, LogOut } from 'lucide-react';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import { useNavigate } from 'react-router-dom';

const ProfilePage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);
  const logout = useAuthStore((s) => s.logout);
  const addToast = useToastStore((state) => state.addToast);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingPassword, setEditingPassword] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (formData.password && formData.password.length < 6) {
      newErrors.password = '密码长度至少为6位';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '邮箱格式不正确';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (field?: string) => {
    if (!validateForm()) {
      return;
    }

    try {
      const updateData: { id: string; name?: string; email?: string; phone?: string; password?: string } = {
        id: user!.id
      };

      if (field === 'name' && formData.name.trim()) {
        updateData.name = formData.name.trim();
      } else if (field === 'email' && formData.email.trim()) {
        updateData.email = formData.email.trim();
      } else if (field === 'phone' && formData.phone.trim()) {
        updateData.phone = formData.phone.trim();
      } else if (field === 'password') {
        if (formData.password) {
          updateData.password = formData.password;
        }
      } else {
        if (formData.name.trim()) updateData.name = formData.name.trim();
        if (formData.email.trim()) updateData.email = formData.email.trim();
        if (formData.phone.trim()) updateData.phone = formData.phone.trim();
        if (formData.password) updateData.password = formData.password;
      }

      const success = await updateUserProfile(updateData);
      
      if (success) {
        addToast({ message: '更新成功', type: 'success' });
        if (field) {
          setEditingField(null);
        }
        if (field === 'password') {
          setEditingPassword(false);
          setFormData(prev => ({
            ...prev,
            password: '',
            confirmPassword: ''
          }));
        }
      } else {
        addToast({ message: '更新失败，请稍后重试', type: 'error' });
      }
    } catch {
      addToast({ message: '网络错误，请稍后重试', type: 'error' });
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleLogout = async () => {
    await logout();
    addToast({ message: '已退出登录', type: 'success' });
    navigate('/login');
  };

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>请先登录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">个人信息</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3 h-3" />
            登出
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            <div className=" px-3 py-1.5 ">
              <h2 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">账户信息</h2>
            </div>
            <div className="flex items-center gap-3 px-3 py-2   ">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500 dark:text-gray-400 w-16 shrink-0">用户名</span>
              <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{user.username}</span>
            </div>

            <div className=" px-3 py-1.5 ">
              <h2 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">基本信息</h2>
            </div>

            <div className="flex items-center gap-3 px-3 py-2   ">
              <Edit2 className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500 dark:text-gray-400 w-16 shrink-0">姓名</span>
              {editingField === 'name' ? (
                <>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="输入姓名"
                    className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500 focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 text-gray-900 dark:text-white"
                    autoFocus
                  />
                  <button onClick={() => handleSave('name')} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setEditingField(null); setFormData(prev => ({ ...prev, name: user?.name || '' })); }} className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{formData.name || '未设置'}</span>
                  <button onClick={() => setEditingField('name')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 px-3 py-2   ">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500 dark:text-gray-400 w-16 shrink-0">邮箱</span>
              {editingField === 'email' ? (
                <>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="输入邮箱"
                    className={`flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-600 rounded border text-gray-900 dark:text-white focus:outline-none transition-colors ${errors.email ? 'border-red-400 focus:border-red-400' : 'border-gray-200 dark:border-gray-500 focus:border-gray-300 dark:focus:border-gray-400'}`}
                    autoFocus
                  />
                  <button onClick={() => handleSave('email')} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setEditingField(null); setFormData(prev => ({ ...prev, email: user?.email || '' })); }} className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{formData.email || '未设置'}</span>
                  <button onClick={() => setEditingField('email')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 px-3 py-2   ">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500 dark:text-gray-400 w-16 shrink-0">手机</span>
              {editingField === 'phone' ? (
                <>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="输入手机号"
                    className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500 focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 text-gray-900 dark:text-white"
                    autoFocus
                  />
                  <button onClick={() => handleSave('phone')} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setEditingField(null); setFormData(prev => ({ ...prev, phone: user?.phone || '' })); }} className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{formData.phone || '未设置'}</span>
                  <button onClick={() => setEditingField('phone')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            <div className=" px-3 py-1.5 ">
              <h2 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">修改密码</h2>
            </div>
            {editingPassword ? (
              <div className="px-3 py-2    space-y-3">
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-16 shrink-0">新密码</span>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="输入新密码（至少6位）"
                    className={`flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-600 rounded border text-gray-900 dark:text-white focus:outline-none transition-colors ${errors.password ? 'border-red-400 focus:border-red-400' : 'border-gray-200 dark:border-gray-500 focus:border-gray-300 dark:focus:border-gray-400'}`}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 flex items-center gap-1 ml-7">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-16 shrink-0">确认</span>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    placeholder="再次输入新密码"
                    className={`flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-600 rounded border text-gray-900 dark:text-white focus:outline-none transition-colors ${errors.confirmPassword ? 'border-red-400 focus:border-red-400' : 'border-gray-200 dark:border-gray-500 focus:border-gray-300 dark:focus:border-gray-400'}`}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-500 flex items-center gap-1 ml-7">
                    <AlertCircle className="w-3 h-3" />
                    {errors.confirmPassword}
                  </p>
                )}

                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => handleSave('password')} className="px-2 py-1 bg-primary dark:bg-primary hover:bg-primary-hover dark:hover:bg-primary-hover text-button-text rounded text-xs font-medium transition-colors inline-flex items-center gap-1">
                    <Save className="w-3 h-3" />
                    保存
                  </button>
                  <button onClick={() => { setEditingPassword(false); setFormData(prev => ({ ...prev, password: '', confirmPassword: '' })); }} className="px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-xs transition-colors">
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2   ">
                <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="flex-1 text-sm text-gray-500 dark:text-gray-400">点击编辑按钮修改密码</span>
                <button onClick={() => setEditingPassword(true)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
    </div>
  );
};

export default ProfilePage;