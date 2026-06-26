import React, { useState } from 'react';
import { useAgnesStore } from '../../../store/agnesStore';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import type { RolePreset } from '../../../types/agnes';
import { Plus, Trash2, Edit2, X, Check, Sparkles } from 'lucide-react';
import { saveRolePreset, updateRolePresetInDb } from '../../../services/AgnesService';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const defaultNewPreset: Partial<RolePreset> = {
  name: '',
  description: '',
  system_prompt: '',
  format: 'markdown',
  icon: '🤖',
};

const defaultPresetIds = ['copywriter', 'translator', 'xiaohongshu', 'social-title'];

const RolePresetsPage: React.FC = () => {
  const { rolePresets, addRolePreset, updateRolePreset, deleteRolePreset, selectRolePreset, activeRolePresetId } = useAgnesStore();
  const admin = useAuthStore((state) => state.admin);
  const addToast = useToastStore((state) => state.addToast);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPreset, setNewPreset] = useState<Partial<RolePreset>>(defaultNewPreset);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleSavePreset = async () => {
    if (!newPreset.name?.trim() || !newPreset.system_prompt?.trim()) {
      addToast({ type: 'error', message: '请填写角色名称和系统提示词' });
      return;
    }

    const presetId = generateId();
    const preset: RolePreset = {
      id: presetId,
      user_id: admin?.id,
      preset_id: presetId,
      name: newPreset.name,
      description: newPreset.description || '',
      system_prompt: newPreset.system_prompt,
      format: newPreset.format || 'markdown',
      icon: newPreset.icon || '🤖',
      is_default: false,
      is_system: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 先添加到本地状态
    addRolePreset(preset);
    setNewPreset(defaultNewPreset);
    setShowAddForm(false);

    // 异步保存到数据库
    if (admin?.id) {
      try {
        await saveRolePreset(admin.id, {
          preset_id: preset.preset_id,
          name: preset.name,
          description: preset.description,
          system_prompt: preset.system_prompt,
          format: preset.format,
          icon: preset.icon,
          is_default: preset.is_default,
          is_system: preset.is_system,
        });
        addToast({ type: 'success', message: '角色预设创建成功' });
      } catch (error) {
        console.error('保存角色预设到数据库失败:', error);
        addToast({ type: 'error', message: '角色预设已创建，但同步保存失败' });
      }
    } else {
      addToast({ type: 'success', message: '角色预设创建成功' });
    }
  };

  const handleUpdatePreset = async (id: string) => {
    const preset = rolePresets.find(p => p.id === id);
    if (!preset) return;

    // 先更新本地状态的时间戳
    updateRolePreset(id, {
      updated_at: new Date().toISOString(),
    });
    setEditingId(null);

    // 异步更新数据库（仅更新用户创建的预设，系统预设不更新数据库）
    if (admin?.id && !preset.is_system) {
      try {
        await updateRolePresetInDb(admin.id, id, {
          name: preset.name,
          description: preset.description,
          system_prompt: preset.system_prompt,
        });
        addToast({ type: 'success', message: '角色预设更新成功' });
      } catch (error) {
        console.error('更新角色预设到数据库失败:', error);
        addToast({ type: 'error', message: '角色预设已更新，但同步保存失败' });
      }
    } else {
      addToast({ type: 'success', message: '角色预设更新成功' });
    }
  };

  const handleDeletePreset = (id: string) => {
    if (defaultPresetIds.includes(id)) {
      addToast({ type: 'error', message: '默认角色不能删除' });
      return;
    }
    if (confirm('确定要删除这个角色预设吗？')) {
      deleteRolePreset(id, admin?.id);
      addToast({ type: 'success', message: '角色预设已删除' });
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">角色预设</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">管理和自定义 AI 助手的角色设定</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium text-sm">新建角色</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rolePresets.map((preset) => {
            const isDefault = defaultPresetIds.includes(preset.id);
            const isEditing = editingId === preset.id;
            const isActive = activeRolePresetId === preset.id;

            return (
              <div
                key={preset.id}
                className={`relative rounded-xl border bg-white dark:bg-gray-800 transition-all ${
                  isActive
                    ? 'border-primary shadow-md ring-2 ring-primary/20'
                    : isEditing
                      ? 'border-primary shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary/30 hover:shadow-sm'
                }`}
              >
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {!isEditing && (
                    <>
                      <button
                        onClick={() => selectRolePreset(isActive ? null : preset.id)}
                        className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${
                          isActive
                            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/30'
                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                        }`}
                        title={isActive ? '取消启用' : '启用角色'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(preset.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!isDefault && (
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-800/30 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                      isActive
                        ? 'bg-primary/20 ring-2 ring-primary/30'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      {preset.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            value={preset.name}
                            onChange={(e) => updateRolePreset(preset.id, { name: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2"
                          />
                          <textarea
                            value={preset.description}
                            onChange={(e) => updateRolePreset(preset.id, { description: e.target.value })}
                            placeholder="角色描述..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-2 resize-none"
                            rows={2}
                          />
                          <textarea
                            value={preset.system_prompt}
                            onChange={(e) => updateRolePreset(preset.id, { system_prompt: e.target.value })}
                            placeholder="系统提示词..."
                            className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                            rows={3}
                          />
                        </>
                      ) : (
                        <>
                          <h3 className="font-semibold text-gray-800 dark:text-gray-200">{preset.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                            {preset.description}
                          </p>
                          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                              {preset.system_prompt}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => handleUpdatePreset(preset.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                        title="保存"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="取消"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
              <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">新建角色预设</h2>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewPreset(defaultNewPreset);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">角色名称 *</label>
                  <input
                    type="text"
                    value={newPreset.name || ''}
                    onChange={(e) => setNewPreset({ ...newPreset, name: e.target.value })}
                    placeholder="例如：文案助手"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">角色图标</label>
                  <input
                    type="text"
                    value={newPreset.icon || ''}
                    onChange={(e) => setNewPreset({ ...newPreset, icon: e.target.value })}
                    placeholder="输入 emoji 图标"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">角色描述</label>
                  <textarea
                    value={newPreset.description || ''}
                    onChange={(e) => setNewPreset({ ...newPreset, description: e.target.value })}
                    placeholder="简要描述这个角色的用途..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">系统提示词 *</label>
                  <textarea
                    value={newPreset.system_prompt || ''}
                    onChange={(e) => setNewPreset({ ...newPreset, system_prompt: e.target.value })}
                    placeholder="定义 AI 的角色和行为方式..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    rows={4}
                  />
                </div>
              </div>

              <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewPreset(defaultNewPreset);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleSavePreset}
                  className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  创建角色
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RolePresetsPage;
