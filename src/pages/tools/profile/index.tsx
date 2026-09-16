import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Lock, Save, AlertCircle, Edit2, Check, X, LogOut } from 'lucide-react';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import { useNavigate } from 'react-router-dom';

type MemberLevel = '普通' | 'VIP' | 'SVIP';

const LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  '普通': { label: '普通', color: 'var(--color-text-secondary)' },
  'VIP': { label: 'VIP', color: 'var(--color-accent)' },
  'SVIP': { label: 'SVIP', color: 'var(--color-secondary)' }
};

const ADMIN_BADGE_COLOR = 'var(--color-success)';

const ProfilePage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const admin = useAuthStore((s) => s.admin);
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    if (!validateForm()) return;

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
        if (formData.password) updateData.password = formData.password;
      } else {
        if (formData.name.trim()) updateData.name = formData.name.trim();
        if (formData.email.trim()) updateData.email = formData.email.trim();
        if (formData.phone.trim()) updateData.phone = formData.phone.trim();
        if (formData.password) updateData.password = formData.password;
      }

      const success = await updateUserProfile(updateData);
      if (success) {
        addToast({ message: '更新成功', type: 'success' });
        if (field) setEditingField(null);
        if (field === 'password') {
          setEditingPassword(false);
          setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        }
      } else {
        addToast({ message: '更新失败，请稍后重试', type: 'error' });
      }
    } catch {
      addToast({ message: '网络错误，请稍后重试', type: 'error' });
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLogout = async () => {
    await logout();
    addToast({ message: '已退出登录', type: 'success' });
    navigate('/login');
  };

  const resetField = (field: string) => {
    setEditingField(null);
    setFormData(prev => ({
      ...prev,
      name: field === 'name' ? user?.name || '' : prev.name,
      email: field === 'email' ? user?.email || '' : prev.email,
      phone: field === 'phone' ? user?.phone || '' : prev.phone
    }));
  };

  const isFieldEditing = (field: string) =>
    editingField === field || (field === 'password' && editingPassword);

  const inputClassName = (field: string) =>
    `flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border rounded text-gray-900 dark:text-white focus:outline-none transition-all duration-200 ${
      errors[field]
        ? 'border-red-400 focus:border-red-400'
        : 'border-gray-200 dark:border-gray-600 focus:border-gray-400 dark:focus:border-gray-400'
    }`;

  const currentLevel = (user?.memberLevel as MemberLevel) || '普通';
  const levelConfig = LEVEL_CONFIG[currentLevel] || LEVEL_CONFIG['普通'];

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

  const fieldData = [
    {
      key: 'username',
      label: '用户名',
      icon: <User className="w-4 h-4" />,
      value: user.username || '未设置',
      editable: false
    },
    {
      key: 'name',
      label: '姓名',
      icon: <Edit2 className="w-4 h-4" />,
      value: formData.name || '未设置',
      editable: true,
      type: 'text',
      placeholder: '输入姓名'
    },
    {
      key: 'email',
      label: '邮箱',
      icon: <Mail className="w-4 h-4" />,
      value: formData.email || '未设置',
      editable: true,
      type: 'email',
      placeholder: '输入邮箱'
    },
    {
      key: 'phone',
      label: '手机',
      icon: <Phone className="w-4 h-4" />,
      value: formData.phone || '未设置',
      editable: true,
      type: 'tel',
      placeholder: '输入手机号'
    }
  ];

  const badgeStyle = (color: string): React.CSSProperties => ({
    '--badge-color': color
  } as React.CSSProperties);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <style>{`
        @keyframes profileFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes profileSlideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .profile-header { animation: profileFadeIn 0.4s ease-out; }
        .profile-section { animation: profileFadeIn 0.4s ease-out; }
        .profile-field { animation: profileSlideIn 0.3s ease-out; }
        .profile-field-1 { animation-delay: 0.05s; }
        .profile-field-2 { animation-delay: 0.1s; }
        .profile-field-3 { animation-delay: 0.15s; }
        .profile-field-4 { animation-delay: 0.2s; }
        .profile-field-5 { animation-delay: 0.25s; }
        .profile-field-6 { animation-delay: 0.3s; }
        .profile-avatar {
          width: 48px;
          height: 48px;
          border: 1px solid var(--color-border);
          background: var(--color-bg-primary);
        }
        .profile-badge {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          color: var(--color-bg-primary);
          background: var(--badge-color, var(--color-text-secondary));
        }
      `}</style>

      <div className={`flex items-center justify-between px-8 py-5 ${mounted ? 'profile-header' : 'opacity-0'}`}>
        <div className="flex items-center gap-4">
          <div className="profile-avatar rounded-full flex items-center justify-center overflow-hidden">
            <svg viewBox="0 0 1088 1024" preserveAspectRatio="xMidYMid meet" className="w-9 h-9 relative z-10">
              <path d="M972.298912 790.448083c-31.060997 45.726663-76.791953 32.988092-76.791952 32.988093 9.171943 27.429989-5.07311 65.113498-5.07311 65.113498-31.400063 62.950345-26.97504 101.711139-26.975041 101.711139-43.91116-21.906222-50.108766-110.930293-36.005348-139.205801s-16.193608-48.452065-16.193608-48.452065l23.66593-74.19531s42.675072 70.027806 105.136132 16.708644c52.332007-44.662255 108.260687-26.42996 108.260687-26.42996s-30.829231 5.223329-76.02369 71.761762z" fill="#B1CFE0"/>
              <path d="M856.158166 762.872167c55.327804 67.735893 94.57359 12.64844 94.57359 12.64844 33.430165-50.50792 97.582262-56.834285 97.582262-56.834286-18.103535 6.05168-40.889612 23.095098-73.409879 73.598726-21.361142 33.176939-81.33715 38.09983-81.33715 38.099831s26.75615 6.425081-3.137431 58.164796c-29.902165 51.735423-26.979332 101.711139-26.979333 101.711139-35.855129-17.888937-58.490986-89.058407-40.456122-125.213974s-40.314487-85.337268-40.314488-85.337268c48.383394-0.639504 73.478551-16.837404 73.478551-16.837404z" fill="#88ADC2"/>
              <path d="M600.910334 247.801262c149.236138-7.14184 272.771951 160.476811 256.106226 193.864056 0 0-100.784073-77.753354-198.065897-69.654404-91.839604 7.639709-117.222323-45.95843-100.56089-79.345675 16.652849-33.391538-49.52935-40.451831 42.520561-44.863977z" fill="#9FC1D4"/>
              <path d="M723.519081 305.257883c136.128457 67.92474 133.497479 136.411727 133.497479 136.411727 16.665725-33.387246-106.870088-201.005897-256.106226-193.864056-10.802892 0.519329-19.343915 1.072993-26.176734 1.69962 18.498397 64.52979 113.75441 122.501448 113.853126 122.565828 0 0.004292 0 0 0 0-0.012876-0.034336-46.288912-107.342205 34.932355-66.813119z" fill="#C0DDED"/>
              <path d="M564.329861 257.217847c-0.703883-1.012905-1.652409-2.403504-1.897051-2.909957 0.317606 0.656672 0.93565 2.957168-0.017168 5.686862-0.93565 2.661022-2.738278 4.017285-3.356321 4.30914 2.450716-1.176 11.798629-2.888497 42.434721-4.356351 102.646788-4.914307 187.99264 76.585938 222.229696 125.518704 20.451244 29.215449 23.940617 47.117262 22.404091 50.795481l0.008584-0.030043 18.313842-4.197548c-4.270512-3.291942-105.685504-80.534552-206.499621-72.14804-40.868152 3.399241-72.075076-6.107475-85.607662-26.08231-7.528118-11.116206-8.674074-24.464237-3.060176-35.713494 9.708439-19.498426-0.188847-33.932326-4.952935-40.872444z m-24.142339-6.983038c-4.261928 8.583943 0.969986 16.1979 4.090249 20.74739 4.661081 6.798483 6.261986 10.171972 3.227563 16.257988-9.450921 18.931886-7.648293 42.001232 4.691124 60.212067 10.935943 16.133521 39.468969 42.361758 107.754235 36.674896 91.324568-7.601081 188.662187 66.42255 189.627881 67.16506l11.71279 9.030308 6.601052-13.227856c9.030308-18.099243-5.553811-47.181642-19.386835-68.388272-47.185934-72.358346-144.97421-147.987174-248.178955-143.051407-44.572123 2.137402-55.250548 4.725461-60.139104 14.579826z" fill="#6E6E96"/>
              <path d="M95.084335 449.841524c-7.14184-11.511067-12.914542-22.760324-17.318105-33.691976-17.197929-35.189874-39.606312-86.84375-30.395741-100.548014C61.705673 294.27902 91.487663 304.72997 91.487663 304.72997v0.017168c11.644118-12.609812 27.464325-23.464208 47.559335-32.202661 101.324861-44.065671 250.629671-101.857066 389.427734 41.863889 138.815231 143.733831 355.791554 560.527175 278.321471 481.752331-149.369189-151.910036-390.303297-79.487311-566.123906-203.782802-68.933353-48.731043-117.501301-97.419167-145.381948-142.205889v0.042919l-0.206014-0.373401z" fill="#D4DBDE"/>
              <path d="M579.841046 201.023065c124.544427 128.956573 146.613744 306.777241 207.297928 441.085902 57.01884 126.175376 98.586583 123.492894 68.160798 152.880022-79.487311 76.761909-285.802377-349.654035-563.385628-435.351828-151.249073-46.696649-205.945956-74.989325-241.389057-133.815085C-0.394861 141.295991 16.575594 31.060997 81.659048 28.039449c121.428455-5.643942 296.36921-35.96672 498.181998 172.983616z" fill="#B1CFE0"/>
              <path d="M322.228338 372.933688s-42.739451 27.700384-118.188017 20.502748C114.651432 384.91258 7.957315 302.184831 41.915393 207.830132" fill="#F0F0FF"/>
              <path d="M316.391257 363.929132l0.034336-0.02146c-0.403445 0.257518-41.044123 25.55869-111.368075 18.846047-55.662577-5.304877-113.930381-39.597728-141.699436-83.388713-12.511097-19.725901-24.631624-50.98862-11.347972-87.899574l-20.189434-7.266308c-12.84587 35.679158-8.206249 72.564361 13.416703 106.65549 31.082457 49.014314 95.964189 87.363078 157.785745 93.260247 78.264099 7.46803 123.166704-20.96628 125.042295-22.176617l-11.674162-18.009112z" fill="#6E6E96"/>
              <path d="M104.488044 50.76973c0 45.71808 50.980036 93.127196 50.980037 93.127196-73.551514-108.385154 42.872502-86.569063 42.872502-86.569064S104.488044 5.047358 104.488044 50.76973z" fill="#C0DDED"/>
              <path d="M50.520796 225.817784c35.4431 58.82576 90.139984 87.118436 241.384764 133.815085 277.587543 85.702085 483.906901 512.113737 563.381336 435.35612 17.511243-16.901783 10.2106-18.953346-9.180527-45.280298 0 0-7.274892 51.739715-56.748446-3.008672-49.460679-54.748387-201.804204-387.264581-437.90126-483.095719-206.928818-83.989589-209.117723-137.905334-239.37183-200.353517-8.669782-17.918981-23.974952-32.945173-46.894079-31.824968C14.06479 50.846985 4.210424 148.95716 50.520796 225.817784z" fill="#9FC1D4"/>
              <path d="M361.989161 190.284553m-22.494222 0a22.494222 22.494222 0 1 0 44.988444 0 22.494222 22.494222 0 1 0-44.988444 0Z" fill="#6E6E96"/>
              <path d="M346.4651 576.252958C243.826896 558.067875 67.040593 382.912522 86.646319 386.384727c54.825643 9.712731 153.983058 48.28897 219.27682 34.949523 128.86215-26.322661 316.932045 228.577522 316.932045 228.577521 85.792217 86.933881-103.874292-43.095685-276.390084-73.658813z" fill="#E8EFF2"/>
              <path d="M466.262607 635.267565c0.626628 28.610281-33.777815 53.877117-63.053352-18.326718-29.271245-72.199543-4.729752-157.322212-4.729753-157.322212 22.047857-47.125846 67.139309 147.030065 67.783105 175.64893z" fill="#DCE3E6"/>
              <path d="M505.941882 802.4141c62.422432 53.782694 6.927242-93.813911 76.852041-233.963946 27.442865-54.988738-102.556657-130.205537-102.556657-130.205537-136.059786-117.020601-36.709232 310.373913 25.704616 364.169483z" fill="#9FC1D4"/>
              <path d="M505.941882 802.4141c48.782547 36.245699 27.528705-13.571214 37.580502-75.555865-0.004292 0.02146 0.004292-0.034336 0 0-21.399769 196.379152-69.62436-111.724308-77.688975-190.941224-13.880236-136.270092 61.967483-68.280973 61.967484-68.280974 0.93565-41.572035 12.850162 10.382279-3.849899-11.519651-25.455682-22.863332-43.709437-17.871769-43.709436-17.871769-12.62698-10.858688-23.219565-17.013375-32.005231-19.228032-3.128847-0.472117-6.223359-0.716759-9.304994-0.811182-69.834667 6.648264 9.369374 341.374822 67.010549 384.208697z" fill="#B1CFE0"/>
              <path d="M488.168829 420.917929c-43.941203-28.614573-60.864447-16.601345-72.336887-3.279067-31.468734 36.550429-8.455184 153.22338 2.901373 201.684029 18.116411 77.332741 49.653817 166.764549 79.272712 192.293196 10.171972 8.768498 23.502835 18.133579 36.33583 12.678483 16.077725-6.83711 17.270893-28.331303 19.455507-67.341031 2.588059-46.254576 6.489461-116.157914 39.872414-183.069749 31.627537-63.392418-91.187225-144.678064-105.500949-152.965861z m-53.902869 12.58406c8.07749-9.382250 29.138194 1.970015 39.880998 11.210629 0 0-0.004292-0.004292 0 0 31.151129 18.043448 115.969068 81.822143 97.762525 118.3039-35.623363 71.401236-39.696444 144.321831-42.391802 192.567882-1.064409 19.034893-2.386336 42.717991-5.957256 47.177349 0.54508-0.678131 2.085898-1.300467 2.948584-1.180292-0.145927-0.017168-3.532292-0.553664-12.631272-8.390804-46.696649-40.241524-116.599987-316.726031-79.611777-359.688664z" fill="#6E6E96"/>
              <path d="M513.787606 957.169713c10.82006 17.777346 6.274862 27.206807-2.970044 32.829289-9.25349 5.635358-19.725901 5.330628-30.537377-12.429549-10.82006-17.773054-19.339623-48.662372-10.090425-54.284854 9.25349-5.63965 32.777786 16.120645 43.597846 33.885114z" fill="#61A7D9"/>
              <path d="M602.021954 831.376323c6.399329 10.506746 4.373519 15.708615-0.309022 18.545608-4.669665 2.849869-10.2106 2.270453-16.614221-8.249169s-12.099067-28.408559-7.42511-31.245552c4.665373-2.849869 17.940441 10.416615 24.348353 20.949113z" fill="#61A7D9"/>
              <path d="M804.976407 163.429688c9.189111 5.918629 7.644001 13.8459 2.639562 21.61866s-11.575447 12.451009-20.777433 6.53238c-9.201987-5.918629-18.751623-20.992032-13.742893-28.764792 5.004439-7.77276 22.674485-5.304877 31.880764 0.613752z" fill="#61A7D9"/>
              <path d="M952.225362 638.611011c6.403621 10.511038 4.373519 15.708615-0.30473 18.5499-4.669665 2.845577-10.214892 2.266161-16.618513-8.253461-6.395037-10.51533-12.094775-28.404267-7.420819-31.245552 4.661081-2.845577 17.940441 10.429491 24.344062 20.949113z" fill="#61A7D9"/>
              <path d="M325.176922 780.559381c6.047388 9.923038 2.193197 16.021929-4.613869 20.155098-6.794191 4.150336-13.966075 4.772672-20.017755-5.163241-6.05168-9.935914-9.502425-28.017989-2.69965-32.159742 6.794191-4.150336 21.279594 7.214804 27.331274 17.167885z" fill="#61A7D9"/>
              <path d="M131.231318 359.675789s-75.749003-59.418052-19.558514-40.232941c56.19049 19.185112 165.052053 55.825672 186.396027 52.851336 0 0-209.692847-70.671601-252.183365-147.420634 0.004292 0-17.073462 95.543576 85.345852 134.802239z" fill="#6E6E96"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{user.name || '未设置'}</h1>
              <span
                className="profile-badge"
                style={badgeStyle(levelConfig.color)}
              >
                {levelConfig.label}
              </span>
              {admin && (
                <span
                  className="profile-badge"
                  style={badgeStyle(ADMIN_BADGE_COLOR)}
                >
                  {admin.role === 'super' ? '超级管理员' : '管理员'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user.username}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-all duration-200 rounded"
        >
          <LogOut className="w-4 h-4" />
          登出
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm">

          <div className="profile-section px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--color-secondary)' }}></span>
              账户信息
            </h2>
            <div className="mt-3">
              {fieldData[0] && (
                <div
                  className={`flex items-center gap-4 py-3 px-2 rounded transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 profile-field profile-field-1 ${
                    isFieldEditing(fieldData[0].key) ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                  }`}
                >
                  <span className="w-8 h-8 flex items-center justify-center text-gray-400 shrink-0 rounded">
                    {fieldData[0].icon}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-12 shrink-0">
                    {fieldData[0].label}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">
                    {fieldData[0].value}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="profile-section px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--color-secondary)' }}></span>
              基本信息
            </h2>
            <div className="mt-3 space-y-1">
              {fieldData.slice(1).map((field, idx) => (
                <div
                  key={field.key}
                  className={`flex items-center gap-4 py-3 px-2 rounded transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 profile-field profile-field-${idx + 2} ${
                    isFieldEditing(field.key) ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                  }`}
                >
                  <span className="w-8 h-8 flex items-center justify-center text-gray-400 shrink-0 rounded">
                    {field.icon}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-12 shrink-0">
                    {field.label}
                  </span>
                  {editingField === field.key ? (
                    <>
                      <input
                        type={field.type}
                        value={formData[field.key as 'name' | 'email' | 'phone']}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className={inputClassName(field.key)}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSave(field.key)}
                        className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors shrink-0"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => resetField(field.key)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">
                        {field.value}
                      </span>
                      {field.editable && (
                        <button
                          onClick={() => setEditingField(field.key)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-600 rounded transition-colors shrink-0"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="profile-section px-6 py-4">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--color-secondary)' }}></span>
              修改密码
            </h2>
            <div className="mt-3">
              <div
                className={`flex items-center gap-4 py-3 px-2 rounded transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 profile-field profile-field-5 ${
                  editingPassword ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                }`}
              >
                <span className="w-8 h-8 flex items-center justify-center text-gray-400 shrink-0 rounded">
                  <Lock className="w-4 h-4" />
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 w-12 shrink-0">
                  密码
                </span>
                {editingPassword ? (
                  <div className="flex-1 flex flex-col gap-2">
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      placeholder="输入新密码（至少6位）"
                      className={inputClassName('password')}
                    />
                    {errors.password && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {errors.password}
                      </p>
                    )}
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleChange('confirmPassword', e.target.value)}
                      placeholder="再次输入新密码"
                      className={inputClassName('confirmPassword')}
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {errors.confirmPassword}
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => {
                          setEditingPassword(false);
                          setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
                        }}
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleSave('password')}
                        className="px-3 py-1.5 text-sm bg-primary hover:bg-primary-hover text-button-text rounded transition-colors inline-flex items-center gap-1 font-medium"
                      >
                        <Save className="w-3.5 h-3.5" />
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-500 dark:text-gray-400">
                      点击编辑按钮修改密码
                    </span>
                    <button
                      onClick={() => setEditingPassword(true)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-600 rounded transition-colors shrink-0"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
