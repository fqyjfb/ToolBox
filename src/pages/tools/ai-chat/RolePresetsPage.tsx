import React, { useState } from 'react';
import { useAgnesStore } from '../../../store/agnesStore';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import type { RolePreset } from '../../../types/agnes';
import { Plus, Trash2, Edit2, Check, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { saveRolePreset, updateRolePresetInDb } from '../../../services/AgnesService';
import Modal from '../../../components/ui/Modal';

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [expandedPresets, setExpandedPresets] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedPresets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
                className={`relative rounded-xl border bg-white dark:bg-gray-800 p-3 transition-all ${
                  isActive
                    ? 'border-primary shadow-md ring-2 ring-primary/20'
                    : isEditing
                      ? 'border-primary shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary/30 hover:shadow-sm'
                }`}
              >
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  {!isEditing && (
                    <>
                      <button
                        onClick={() => selectRolePreset(isActive ? null : preset.id)}
                        className={`w-6 h-6 flex items-center justify-center rounded transition-all ${
                          isActive
                            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/30'
                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                        }`}
                        title={isActive ? '取消启用' : '启用角色'}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(preset.id);
                          setShowEditModal(true);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {!isDefault && (
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-800/30 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                    isActive
                      ? 'bg-primary/20 ring-2 ring-primary/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {preset.icon}
                  </div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">{preset.name}</h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-1.5">
                  {preset.description}
                </p>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">系统提示词</span>
                    <button
                      onClick={() => toggleExpand(preset.id)}
                      className="flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title={expandedPresets.has(preset.id) ? '收起' : '展开'}
                    >
                      {expandedPresets.has(preset.id) ? (
                        <ChevronUp className="w-3 h-3 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-gray-500" />
                      )}
                    </button>
                  </div>
                  <p className={`text-xs text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-wrap ${
                    expandedPresets.has(preset.id) ? '' : 'line-clamp-2'
                  }`}>
                    {preset.system_prompt}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {showEditModal && editingId && (
          <Modal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setEditingId(null);
            }}
            title="编辑角色预设"
            confirmText="保存"
            cancelText="取消"
            onConfirm={() => handleUpdatePreset(editingId!)}
            size="lg"
          >
            {(() => {
              const preset = rolePresets.find(p => p.id === editingId);
              if (!preset) return null;
              return (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">角色名称 *</label>
                    <input
                      type="text"
                      value={preset.name}
                      onChange={(e) => updateRolePreset(preset.id, { name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">角色图标</label>
                    <input
                      type="text"
                      value={preset.icon || ''}
                      onChange={(e) => updateRolePreset(preset.id, { icon: e.target.value })}
                      placeholder="输入 emoji 图标"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">角色描述</label>
                    <textarea
                      value={preset.description}
                      onChange={(e) => updateRolePreset(preset.id, { description: e.target.value })}
                      placeholder="简要描述这个角色的用途..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">系统提示词 *</label>
                    <textarea
                      value={preset.system_prompt}
                      onChange={(e) => updateRolePreset(preset.id, { system_prompt: e.target.value })}
                      placeholder="定义 AI 的角色和行为方式..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono"
                      rows={10}
                    />
                  </div>
                </div>
              );
            })()}
          </Modal>
        )}

        {showAddForm && (
          <Modal
            isOpen={showAddForm}
            onClose={() => {
              setShowAddForm(false);
              setNewPreset(defaultNewPreset);
            }}
            title="新建角色预设"
            confirmText="创建角色"
            cancelText="取消"
            onConfirm={handleSavePreset}
            size="lg"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">角色名称 *</label>
                <input
                  type="text"
                  value={newPreset.name || ''}
                  onChange={(e) => setNewPreset({ ...newPreset, name: e.target.value })}
                  placeholder="例如：文案助手"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">角色图标</label>
                <input
                  type="text"
                  value={newPreset.icon || ''}
                  onChange={(e) => setNewPreset({ ...newPreset, icon: e.target.value })}
                  placeholder="输入 emoji 图标"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">角色描述</label>
                <textarea
                  value={newPreset.description || ''}
                  onChange={(e) => setNewPreset({ ...newPreset, description: e.target.value })}
                  placeholder="简要描述这个角色的用途..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">系统提示词 *</label>
                <textarea
                  value={newPreset.system_prompt || ''}
                  onChange={(e) => setNewPreset({ ...newPreset, system_prompt: e.target.value })}
                  placeholder="定义 AI 的角色和行为方式..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono"
                  rows={10}
                />
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default RolePresetsPage;
