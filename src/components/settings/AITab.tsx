import React, { useMemo, useState } from 'react';
import {
  Sparkles, Plus, Trash2, Edit2, Check, AlertCircle,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import SettingSection from './SettingSection';
import SettingCard from './SettingCard';
import ToggleSwitch from './ToggleSwitch';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import PasswordInput from '../forms/PasswordInput';
import { useToastStore } from '../../store/toastStore';
import { createEmptyModelInput, useAIConfigStore } from '../../store/aiConfigStore';
import { checkModelConnectivity } from '../../services/aiClient';
import type { AIModel, AIModelInput, AIThinkingMode } from '../../types/ai';

const inputClass =
  'w-full rounded-md border border-content bg-surface px-2 py-1.5 text-xs text-content-primary placeholder-text-content-tertiary focus:border-primary focus:outline-none';

const THINKING_MODE_OPTIONS: Array<{ value: AIThinkingMode; label: string }> = [
  { value: 'follow', label: '跟随默认' },
  { value: 'on', label: '开启' },
  { value: 'off', label: '关闭' },
];

function toModelInput(model: AIModel): AIModelInput {
  return {
    api_format: model.api_format,
    base_url: model.base_url,
    use_complete_url: model.use_complete_url,
    model_id: model.model_id,
    display_name: model.display_name,
    api_key: model.api_key,
    thinking_mode: model.thinking_mode,
    temperature: model.temperature,
    top_p: model.top_p,
    top_k: model.top_k,
  };
}

const AITab: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const config = useAIConfigStore((state) => state.config);
  const addModel = useAIConfigStore((state) => state.addModel);
  const updateModel = useAIConfigStore((state) => state.updateModel);
  const deleteModel = useAIConfigStore((state) => state.deleteModel);
  const setDefaultModel = useAIConfigStore((state) => state.setDefaultModel);
  const setAutoMatchEnabled = useAIConfigStore((state) => state.setAutoMatchEnabled);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [form, setForm] = useState<AIModelInput>(createEmptyModelInput());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const editingModel = useMemo(
    () => config.models.find((model) => model.id === editingModelId) ?? null,
    [config.models, editingModelId]
  );

  const openAdd = () => {
    setEditingModelId(null);
    setForm(createEmptyModelInput());
    setAdvancedOpen(false);
    setCheckResult(null);
    setModalOpen(true);
  };

  const openEdit = (model: AIModel) => {
    setEditingModelId(model.id);
    setForm(toModelInput(model));
    setAdvancedOpen(false);
    setCheckResult(null);
    setModalOpen(true);
  };

  const updateForm = (patch: Partial<AIModelInput>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setCheckResult(null);
  };

  const handleModelIdChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      model_id: value,
      display_name: prev.display_name.trim() ? prev.display_name : value,
    }));
    setCheckResult(null);
  };

  const handleSave = () => {
    const payload: AIModelInput = {
      ...form,
      base_url: form.base_url.trim(),
      model_id: form.model_id.trim(),
      display_name: form.display_name.trim() || form.model_id.trim(),
    };

    if (!payload.base_url || !payload.model_id) {
      addToast({ type: 'warning', message: '请填写模型 ID 与 API 地址' });
      return;
    }

    if (editingModelId) {
      updateModel(editingModelId, payload);
    } else {
      addModel(payload);
    }

    setModalOpen(false);
    addToast({ type: 'success', message: editingModelId ? '模型已更新' : '模型已添加' });
  };

  const handleCheck = async () => {
    if (!form.base_url.trim() || !form.model_id.trim()) {
      setCheckResult({ valid: false, message: '请填写模型 ID 与 API 地址' });
      return;
    }

    setChecking(true);
    setCheckResult(null);
    try {
      const draft: AIModel = {
        ...form,
        id: 'draft',
        is_default: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCheckResult(await checkModelConnectivity(draft));
    } finally {
      setChecking(false);
    }
  };

  const handleReset = () => {
    setForm(editingModel ? toModelInput(editingModel) : createEmptyModelInput());
    setCheckResult(null);
  };

  const requestDelete = (model: AIModel) => {
    if (config.models.length <= 1) {
      addToast({ type: 'warning', message: '至少保留一个模型' });
      return;
    }
    setDeleteId(model.id);
  };

  return (
    <SettingSection title="AI 设置" subtitle="模型配置对全项目页面生效" icon={<Sparkles size={14} />}>
      <div className="space-y-3 px-4 py-3">
        <SettingCard>
          <div className="flex items-center justify-between px-3 py-2">
            <h4 className="text-sm font-semibold text-content-primary">模型管理</h4>
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs text-button-text transition-colors hover:bg-primary-hover"
            >
              <Plus className="h-3.5 w-3.5" />
              添加模型
            </button>
          </div>

          {config.models.length === 0 ? (
            <p className="px-3 pb-3 text-xs text-content-tertiary">暂无模型，请添加第一个模型</p>
          ) : (
            <div className="border-t border-content">
              {config.models.map((model) => {
                const isDefault = model.id === config.default_model_id;
                return (
                  <div
                    key={model.id}
                    className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-menu-hover"
                  >
                    <button
                      type="button"
                      onClick={() => setDefaultModel(model.id)}
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isDefault
                          ? 'border-primary bg-primary text-button-text'
                          : 'border-content hover:border-primary'
                      }`}
                      title={isDefault ? '当前默认模型' : '设为默认模型'}
                    >
                      {isDefault && <Check className="h-3 w-3" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs font-medium text-content-primary">
                          {model.display_name || model.model_id}
                        </span>
                        {isDefault && (
                          <span className="flex-shrink-0 rounded-md bg-surface-secondary px-1 py-0.5 text-xs text-content-tertiary">
                            默认
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-content-tertiary">{model.base_url}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEdit(model)}
                      className="rounded-md p-1 text-content-tertiary transition-colors hover:bg-surface-secondary hover:text-content-primary"
                      title="编辑"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDelete(model)}
                      className="rounded-md p-1 text-content-tertiary transition-colors hover:bg-surface-secondary hover:text-error"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SettingCard>

        <SettingCard>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm text-content-primary">启用自动匹配</p>
              <p className="mt-1 text-xs text-content-tertiary">
                开启后默认使用模型列表中的第一个模型；关闭后使用标记为默认的模型
              </p>
            </div>
            <ToggleSwitch checked={config.auto_match_enabled} onChange={setAutoMatchEnabled} />
          </div>
        </SettingCard>

        <SettingCard>
          <p className="px-4 py-3 text-xs leading-relaxed text-content-secondary">
            模型配置（含 API 密钥）仅保存在本机，不会上传云端。AI 整理生成的文件会写入笔记「对话整理」目录。
          </p>
        </SettingCard>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingModelId ? '编辑模型' : '添加模型'}
        size="lg"
        confirmText={editingModelId ? '保存修改' : '添加模型'}
        cancelText="取消"
        onConfirm={handleSave}
        confirmDisabled={!form.base_url.trim() || !form.model_id.trim()}
      >
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 scrollbar-hide">
          <div>
            <label className="mb-1 block text-xs font-medium text-content-secondary">API 格式</label>
            <div className="rounded-md bg-surface-secondary px-2 py-1.5 text-xs text-content-secondary">
              OpenAI Chat Completions
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-content-secondary">请求地址</label>
            <div className="flex items-center gap-2">
              <input
                value={form.base_url}
                onChange={(e) => updateForm({ base_url: e.target.value })}
                className={inputClass}
                placeholder="https://api.example.com/v1"
              />
              <label className="flex flex-shrink-0 items-center gap-1 text-xs text-content-secondary">
                <input
                  type="checkbox"
                  checked={form.use_complete_url}
                  onChange={(e) => updateForm({ use_complete_url: e.target.checked })}
                  className="h-3.5 w-3.5 accent-primary"
                />
                完整 URL
              </label>
            </div>
            <p className="mt-1 text-xs text-content-tertiary">未勾选时自动追加 /chat/completions</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-content-secondary">
              模型 ID <span className="text-error">*</span>
            </label>
            <input
              value={form.model_id}
              onChange={(e) => handleModelIdChange(e.target.value)}
              className={inputClass}
              placeholder="例如 gpt-4o-mini"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-content-secondary">展示名称</label>
            <input
              value={form.display_name}
              maxLength={32}
              onChange={(e) => updateForm({ display_name: e.target.value })}
              className={inputClass}
              placeholder="留空则显示模型 ID"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-content-secondary">API 密钥</label>
            <PasswordInput
              value={form.api_key}
              onChange={(value) => updateForm({ api_key: value })}
              placeholder="输入 API Key"
              className={inputClass}
            />
          </div>

          <div className="border-t border-content pt-3">
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center gap-1 text-xs text-content-secondary transition-colors hover:text-content-primary"
            >
              {advancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              高级配置
            </button>

            {advancedOpen && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-content-secondary">思考模式</label>
                  <div className="flex gap-2">
                    {THINKING_MODE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateForm({ thinking_mode: option.value })}
                        className={`rounded-md px-2 py-1 text-xs transition-colors ${
                          form.thinking_mode === option.value
                            ? 'bg-primary text-button-text'
                            : 'bg-surface-secondary text-content-secondary hover:bg-menu-hover'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-content-secondary">
                    Temperature（0~2）
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={form.temperature ?? ''}
                    onChange={(e) => updateForm({ temperature: e.target.value ? Number(e.target.value) : null })}
                    className={inputClass}
                    placeholder="留空使用服务端默认"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-content-secondary">Top P（0~1）</label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={form.top_p ?? ''}
                    onChange={(e) => updateForm({ top_p: e.target.value ? Number(e.target.value) : null })}
                    className={inputClass}
                    placeholder="留空使用服务端默认"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-content-secondary">Top K（1~100）</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.top_k ?? ''}
                    onChange={(e) => updateForm({ top_k: e.target.value ? Number(e.target.value) : null })}
                    className={inputClass}
                    placeholder="留空使用服务端默认"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-content pt-3">
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="flex items-center gap-1 rounded-md border border-content px-2 py-1 text-xs text-content-secondary transition-colors hover:border-primary hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {checking ? '测试中...' : '测试连接'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md bg-surface-secondary px-2 py-1 text-xs text-content-secondary transition-colors hover:bg-menu-hover"
            >
              重置
            </button>
          </div>

          {checkResult && (
            <div
              className={`flex items-start gap-2 rounded-md bg-surface-secondary px-2 py-1.5 text-xs ${
                checkResult.valid ? 'text-success' : 'text-error'
              }`}
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{checkResult.message}</span>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteModel(deleteId);
        }}
        title="删除模型"
        message="确定要删除这个模型吗？此操作不可撤销。"
        confirmText="删除"
        variant="danger"
      />
    </SettingSection>
  );
};

export default AITab;
