import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppWindow, Loader2, Lock, Plus, ScanLine, Trash2 } from 'lucide-react';
import SettingCard from './SettingCard';
import SettingSection from './SettingSection';
import SettingRow from './SettingRow';
import ToggleSwitch from './ToggleSwitch';
import Modal from '../ui/Modal';
import { useToastStore } from '../../store/toastStore';
import { useAppLockStore } from '../../store/appLockStore';
import { loadApps } from '../../utils/quickLaunch';
import { logError } from '../../services/loggerService';

/** 候选应用（添加弹窗数据源：快捷启动 / 桌面扫描 / 手动选择） */
interface AppLockCandidate {
  name: string;
  path: string;
  icon?: string;
}

// 与 GeneralTab 一致：lock API 暂未进 window.d.ts 全局声明，局部断言访问
interface ElectronLockAPI {
  lock?: {
    getStatus: () => Promise<{ lockPassword?: string }>;
  };
}

const STATUS_POLL_MS = 10000;

// 图标约定与快启动页统一：icon 为 PNG 裸 base64（window.electron.getFileIcon 返回值），
// 渲染时统一拼 dataURL 前缀（与 QuickLaunchBar / DesktopAppTile 同款处理）
const toIconSrc = (icon?: string): string | undefined => {
  if (!icon) return undefined;
  return icon.startsWith('data:') ? icon : `data:image/png;base64,${icon}`;
};

// 模块级 Promise 缓存：同一路径只发一次 getFileIcon IPC（设置列表与添加弹窗共用）
const iconPromises = new Map<string, Promise<string | undefined>>();
const fetchIconBase64 = (path: string): Promise<string | undefined> => {
  let pending = iconPromises.get(path);
  if (!pending) {
    pending = window.electron
      ? window.electron
          .getFileIcon(path)
          .then((base64) => base64 ?? undefined)
          .catch(() => undefined)
      : Promise.resolve(undefined);
    iconPromises.set(path, pending);
  }
  return pending;
};

const iconButtonClass =
  'w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md text-content-secondary hover:bg-menu-hover transition-colors';

const AppIcon: React.FC<{ src?: string; size?: number }> = ({ src, size = 20 }) => {
  if (src) {
    return <img src={src} alt="" width={size} height={size} className="rounded object-contain flex-shrink-0" />;
  }
  return <AppWindow size={size} className="text-content-tertiary flex-shrink-0" />;
};

const AppLockTab: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);

  // 配置数据来自共享 store（与快启动右键菜单同步）；仅状态徽标为本页局部轮询
  const masterEnabled = useAppLockStore((state) => state.masterEnabled);
  const apps = useAppLockStore((state) => state.apps);
  const reloadConfig = useAppLockStore((state) => state.load);
  const storeSetMasterEnabled = useAppLockStore((state) => state.setMasterEnabled);
  const storeAddApp = useAppLockStore((state) => state.addApp);
  const storeRemoveApp = useAppLockStore((state) => state.removeApp);
  const storeToggleApp = useAppLockStore((state) => state.toggleApp);

  const [statuses, setStatuses] = useState<Record<string, AppLockStatus>>({});
  // 运行时解析的图标（path → dataURL）：覆盖快启动库没有图标或扫描候选无图标的场景
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [hasPassword, setHasPassword] = useState(true);
  const [loading, setLoading] = useState(true);

  // 添加应用弹窗
  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<AppLockCandidate[]>([]);
  const [selected, setSelected] = useState<AppLockCandidate | null>(null);
  const [resolved, setResolved] = useState<AppLockResolvedApp | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<AppLockAppConfig | null>(null);
  // 组件卸载后不再回写状态
  const mountedRef = useRef(true);

  const refreshStatuses = useCallback(async () => {
    if (!window.electron) return;
    try {
      const list = await window.electron.appLock.getStatus();
      if (!mountedRef.current) return;
      setStatuses(Object.fromEntries(list.map((item) => [item.appId, item])));
    } catch (error) {
      logError('Failed to load app lock status', 'AppLockTab', error as Error);
    }
  }, []);

  const loadAll = useCallback(async () => {
    if (!window.electron) { setLoading(false); return; }
    try {
      const [, lockStatus] = await Promise.all([
        reloadConfig(),
        (window.electron as ElectronLockAPI).lock?.getStatus(),
      ]);
      if (!mountedRef.current) return;
      if (lockStatus) setHasPassword(Boolean(lockStatus.lockPassword));
      await refreshStatuses();
    } catch (error) {
      logError('Failed to load app lock config', 'AppLockTab', error as Error);
      addToast({ type: 'error', message: '应用锁配置加载失败' });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [addToast, refreshStatuses, reloadConfig]);

  useEffect(() => {
    mountedRef.current = true;
    void loadAll();
    const timer = window.setInterval(() => { void refreshStatuses(); }, STATUS_POLL_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
    };
  }, [loadAll, refreshStatuses]);

  // 补齐缺失图标：配置列表条目 + 添加弹窗候选（弹窗打开时），经缓存去重后走 getFileIcon
  useEffect(() => {
    const paths = [
      ...apps.filter((app) => !app.icon).map((app) => app.exePath),
      ...(addOpen ? candidates.filter((candidate) => !candidate.icon).map((candidate) => candidate.path) : []),
    ].filter((path) => !(path in icons));
    if (!paths.length) return;
    void (async () => {
      const entries = await Promise.all(
        paths.map(async (path) => [path, (await fetchIconBase64(path)) ?? ''] as const),
      );
      setIcons((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
    })();
  }, [apps, candidates, addOpen, icons]);

  /** 渲染用图标：优先条目自带 icon，其次运行时解析结果（均为 dataURL 或 undefined） */
  const iconSrcOf = (path: string, icon?: string): string | undefined =>
    toIconSrc(icon) ?? (icons[path] || undefined);

  // ── 开关操作 ────────────────────────────────────────────────────────────────

  const handleMasterToggle = async (enabled: boolean) => {
    if (!hasPassword) {
      addToast({ type: 'warning', message: '请先在通用设置中设置锁定密码' });
      return;
    }
    const result = await storeSetMasterEnabled(enabled); // 乐观更新/回滚在 store 内
    if (result.success) {
      addToast({ type: 'success', message: enabled ? '应用锁已开启' : '应用锁已关闭' });
      void refreshStatuses();
    } else {
      addToast({ type: 'error', message: result.error || '设置失败，请重试' });
    }
  };

  const handleAppToggle = async (app: AppLockAppConfig, enabled: boolean) => {
    const result = await storeToggleApp(app.id, enabled); // 乐观更新/回滚在 store 内
    if (result.success) {
      void refreshStatuses();
    } else {
      addToast({ type: 'error', message: result.error || '设置失败，请重试' });
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoveTarget(null);
    const result = await storeRemoveApp(target.id);
    if (result.success) {
      addToast({ type: 'success', message: `已移除「${target.name}」` });
      void refreshStatuses();
    } else {
      addToast({ type: 'error', message: result.error || '移除失败' });
    }
  };

  // ── 添加应用 ────────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setSelected(null);
    setResolved(null);
    // 默认数据源：快捷启动应用库（与 FloatWindowTab 的应用选择器一致）
    const quickApps = loadApps().map((item) => ({ name: item.name, path: item.path, icon: item.icon }));
    setCandidates(quickApps);
    setAddOpen(true);
  };

  const scanDesktopApps = async () => {
    if (scanning || !window.electron) return;
    setScanning(true);
    try {
      const scanned = await window.electron.scanDesktopApps();
      setCandidates((previous) => {
        const known = new Set(previous.map((item) => item.path.toLowerCase()));
        const merged = [...previous];
        for (const item of scanned) {
          if (item.path && !known.has(item.path.toLowerCase())) {
            known.add(item.path.toLowerCase());
            merged.push({ name: item.name, path: item.path });
          }
        }
        return merged;
      });
    } catch (error) {
      logError('Failed to scan desktop apps', 'AppLockTab', error as Error);
      addToast({ type: 'error', message: '扫描失败，请重试' });
    } finally {
      setScanning(false);
    }
  };

  const browseFile = async () => {
    if (!window.electron) return;
    try {
      const filePath = await window.electron.selectFile();
      if (!filePath) return;
      const resolvedPreview = await window.electron.appLock.resolveApp(filePath);
      const icon = await fetchIconBase64(filePath); // 与快启动添加应用同款取图标方式
      const candidate = { name: resolvedPreview.name || filePath, path: filePath, icon };
      setCandidates((previous) => {
        if (previous.some((item) => item.path.toLowerCase() === filePath.toLowerCase())) return previous;
        return [...previous, candidate];
      });
      handleSelect(candidate);
    } catch (error) {
      logError('Failed to select exe file', 'AppLockTab', error as Error);
    }
  };

  const handleSelect = async (candidate: AppLockCandidate) => {
    setSelected(candidate);
    setResolved(null);
    try {
      const preview = await window.electron?.appLock.resolveApp(candidate.path);
      setResolved(preview ?? null);
    } catch (error) {
      logError('Failed to resolve app', 'AppLockTab', error as Error);
    }
  };

  const alreadyAdded = useMemo(
    () => (selected ? apps.some((item) => item.exePath.toLowerCase() === selected.path.toLowerCase()) : false),
    [apps, selected],
  );

  const confirmAdd = async () => {
    if (!selected || !resolved || resolved.protected || alreadyAdded || submitting) return;
    setSubmitting(true);
    try {
      const result = await storeAddApp({
        name: selected.name,
        exePath: selected.path,
        icon: selected.icon || '',
      });
      if (result.success) {
        addToast({ type: 'success', message: `已添加「${selected.name}」` });
        setAddOpen(false);
      } else {
        addToast({ type: 'error', message: result.error || '添加失败' });
      }
    } catch (error) {
      logError('Failed to add locked app', 'AppLockTab', error as Error);
      addToast({ type: 'error', message: '添加失败' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── 渲染 ───────────────────────────────────────────────────────────────────

  const renderStatusBadge = (app: AppLockAppConfig) => {
    const status = statuses[app.id];
    if (!app.enabled) return <span className="text-xs text-content-tertiary">未启用</span>;
    if (status?.blocked) return <span className="text-xs text-amber-500">未能锁定（权限不足）</span>;
    if (status?.locked) return <span className="text-xs text-red-500">{status.partial ? '部分锁定' : '已锁定'}</span>;
    if (status?.running) return <span className="text-xs text-content-secondary">运行中</span>;
    return <span className="text-xs text-content-tertiary">未运行</span>;
  };

  return (
    <SettingCard className="p-0">
      <SettingSection
        title="应用锁"
        subtitle="本应用锁定时，自动锁定以下已启用的外部应用；解锁时同步恢复"
        icon={<Lock size={16} />}
      >
        <SettingRow
          label={
            <div>
              <div>联动锁定外部应用</div>
              <div className="text-xs text-content-tertiary mt-0.5">
                运行中的应用会被冻结并显示「已锁定」遮罩；未运行的应用不处理
              </div>
            </div>
          }
        >
          <ToggleSwitch enabled={masterEnabled} onChange={handleMasterToggle} />
        </SettingRow>

        {!hasPassword && (
          <SettingRow label={<span className="text-xs text-amber-500">尚未设置锁定密码，请先在「通用设置 → 安全设置」中设置</span>}>
            <span />
          </SettingRow>
        )}
      </SettingSection>

      <SettingSection
        title="锁定应用"
        subtitle="支持统一开关（上方总开关）与单独开关；锁定期间新启动的应用也会被捕获"
      >
        <SettingRow label="添加要联动锁定的应用">
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md text-button-text bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} />
            添加应用
          </button>
        </SettingRow>

        {loading ? (
          <SettingRow label={<span className="text-content-tertiary text-sm">加载中…</span>}>
            <span />
          </SettingRow>
        ) : apps.length === 0 ? (
          <SettingRow label={<span className="text-content-tertiary text-sm">尚未添加应用，点击「添加应用」从快捷启动或桌面应用中选择</span>}>
            <span />
          </SettingRow>
        ) : (
          apps.map((app) => (
            <SettingRow
              key={app.id}
              label={
                <div className="flex items-center gap-2 min-w-0">
                  <AppIcon src={iconSrcOf(app.exePath, app.icon)} />
                  <div className="min-w-0">
                    <div className="truncate">{app.name}</div>
                    <div className="text-xs text-content-tertiary truncate">{renderStatusBadge(app)}</div>
                  </div>
                </div>
              }
            >
              <div className="flex items-center gap-1">
                <ToggleSwitch enabled={app.enabled} onChange={(enabled) => handleAppToggle(app, enabled)} />
                <button
                  type="button"
                  className={`${iconButtonClass} hover:text-red-500`}
                  onClick={() => setRemoveTarget(app)}
                  title={`移除「${app.name}」`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </SettingRow>
          ))
        )}
      </SettingSection>

      {/* 添加应用弹窗 */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="添加应用"
        confirmText={submitting ? '添加中…' : '确认添加'}
        confirmDisabled={!selected || !resolved || resolved.protected || alreadyAdded || submitting}
        onConfirm={confirmAdd}
        size="lg"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-content-secondary">从列表选择，或选择 exe 文件</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={scanDesktopApps}
              disabled={scanning}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-content-secondary hover:text-content-primary hover:bg-menu-hover transition-colors disabled:opacity-50"
            >
              {scanning ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
              扫描桌面应用
            </button>
            <button
              type="button"
              onClick={browseFile}
              className="px-2 py-1 text-xs rounded-md text-content-secondary hover:text-content-primary hover:bg-menu-hover transition-colors"
            >
              选择文件…
            </button>
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto rounded-md border border-content">
          {candidates.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-content-tertiary">
              暂无候选应用，请扫描桌面应用或选择 exe 文件
            </div>
          ) : (
            candidates.map((candidate) => {
              const isSelected = selected?.path === candidate.path;
              const added = apps.some((item) => item.exePath.toLowerCase() === candidate.path.toLowerCase());
              return (
                <button
                  key={candidate.path}
                  type="button"
                  onClick={() => handleSelect(candidate)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-t border-content first:border-t-0 ${
                    isSelected ? 'bg-menu-hover' : 'hover:bg-menu-hover'
                  }`}
                >
                  <AppIcon src={iconSrcOf(candidate.path, candidate.icon)} size={18} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-content-primary truncate">{candidate.name}</div>
                    <div className="text-xs text-content-tertiary truncate">{candidate.path}</div>
                  </div>
                  {added && <span className="text-xs text-content-tertiary flex-shrink-0">已添加</span>}
                </button>
              );
            })
          )}
        </div>

        {selected && (
          <div className="mt-3 px-3 py-2 rounded-md bg-surface-60 text-xs text-content-secondary">
            {resolved ? (
              resolved.protected ? (
                <span className="text-red-500">系统关键进程不允许锁定</span>
              ) : (
                <span>
                  将锁定进程：<span className="text-content-primary">{resolved.processNames.join('、')}</span>.exe
                </span>
              )
            ) : (
              <span>正在解析进程信息…</span>
            )}
            {alreadyAdded && <span className="ml-2 text-amber-500">该应用已在列表中</span>}
          </div>
        )}
      </Modal>

      {/* 移除确认 */}
      <Modal
        isOpen={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title="移除应用"
        confirmText="移除"
        confirmVariant="danger"
        onConfirm={confirmRemove}
        size="sm"
      >
        <p className="text-sm text-content-primary">
          确定移除「{removeTarget?.name}」？若该应用正被联动锁定，将先恢复其运行。
        </p>
      </Modal>
    </SettingCard>
  );
};

export default AppLockTab;
