/**
 * networkConfig 缓存失效订阅的统一出口。
 *
 * baseApi（热点新闻数据源）与 PluginService（插件市场源）都需要
 * 「用户在设置里改了 networkConfig 之后立刻改用新配置」，
 * 两者原先各自复制一份 `window.electron.onSettingChanged` 注册。
 * 收敛到这里，避免两处实现漂移，也避免注册顺序互相影响。
 *
 * 只负责「收到变更 → 调 invalidate」，各模块自己的缓存变量与默认值降级逻辑保持不变。
 *
 * @returns 退订函数（非 Electron 环境返回一个空实现，便于调用方统一处理）
 */
export function subscribeNetworkConfigInvalidate(invalidate: () => void): () => void {
  if (!window.electron?.onSettingChanged) return () => {};

  const unsubscribe = window.electron.onSettingChanged((setting) => {
    if (setting?.name === 'networkConfig') invalidate();
  });

  return typeof unsubscribe === 'function' ? unsubscribe : () => {};
}
