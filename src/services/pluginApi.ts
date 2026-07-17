interface ToolRegistration {
  id: string;
  name: string;
  iconName: string;
  color: string;
  textColor: string;
  path: string;
  component?: any;
}

interface SidebarButtonRegistration {
  id: string;
  icon: string;
  label: string;
  onClick: (e?: Event, anchorRect?: DOMRect) => void;
}

export interface PanelRegistration {
  id: string;
  render: () => React.ReactNode;
}

interface SettingsPanelRegistration {
  id: string;
  render: () => React.ReactNode;
}

type PanelListener = (panels: PanelRegistration[]) => void;
type SidebarButtonListener = (buttons: SidebarButtonRegistration[]) => void;

class PluginApi {
  private registeredTools: Map<string, ToolRegistration> = new Map();
  private registeredSidebarButtons: Map<string, SidebarButtonRegistration> = new Map();
  private registeredPanels: Map<string, PanelRegistration> = new Map();
  private registeredSettingsPanels: Map<string, SettingsPanelRegistration> = new Map();
  private panelListeners: PanelListener[] = [];
  private sidebarButtonListeners: SidebarButtonListener[] = [];
  private navigateFn: ((path: string) => void) | null = null;

  setNavigate(fn: (path: string) => void): void {
    this.navigateFn = fn;
  }

  navigate(path: string): void {
    if (this.navigateFn) {
      this.navigateFn(path);
    } else {
      window.location.hash = path;
    }
  }

  registerTool(tool: ToolRegistration): void {
    this.registeredTools.set(tool.id, tool);
  }

  registerSidebarButton(button: SidebarButtonRegistration): void {
    this.registeredSidebarButtons.set(button.id, button);
    this.notifySidebarButtonListeners();
  }

  registerPanel(id: string, panel: PanelRegistration): void {
    this.registeredPanels.set(id, panel);
    this.notifyPanelListeners();
  }

  unregisterPanel(id: string): void {
    this.registeredPanels.delete(id);
    this.notifyPanelListeners();
  }

  registerSettingsPanel(id: string, panel: SettingsPanelRegistration): void {
    this.registeredSettingsPanels.set(id, panel);
  }

  addPanelListener(listener: PanelListener): void {
    this.panelListeners.push(listener);
    listener(this.getAllPanels());
  }

  removePanelListener(listener: PanelListener): void {
    this.panelListeners = this.panelListeners.filter(l => l !== listener);
  }

  addSidebarButtonListener(listener: SidebarButtonListener): void {
    this.sidebarButtonListeners.push(listener);
    listener(this.getAllSidebarButtons());
  }

  removeSidebarButtonListener(listener: SidebarButtonListener): void {
    this.sidebarButtonListeners = this.sidebarButtonListeners.filter(l => l !== listener);
  }

  private notifyPanelListeners(): void {
    const panels = this.getAllPanels();
    this.panelListeners.forEach(listener => listener(panels));
  }

  private notifySidebarButtonListeners(): void {
    const buttons = this.getAllSidebarButtons();
    this.sidebarButtonListeners.forEach(listener => listener(buttons));
  }

  getTool(id: string): ToolRegistration | undefined {
    return this.registeredTools.get(id);
  }

  getAllTools(): ToolRegistration[] {
    return Array.from(this.registeredTools.values());
  }

  getSidebarButton(id: string): SidebarButtonRegistration | undefined {
    return this.registeredSidebarButtons.get(id);
  }

  getAllSidebarButtons(): SidebarButtonRegistration[] {
    return Array.from(this.registeredSidebarButtons.values());
  }

  getPanel(id: string): PanelRegistration | undefined {
    return this.registeredPanels.get(id);
  }

  getAllPanels(): PanelRegistration[] {
    return Array.from(this.registeredPanels.values());
  }

  getSettingsPanel(id: string): SettingsPanelRegistration | undefined {
    return this.registeredSettingsPanels.get(id);
  }

  clear(): void {
    this.registeredTools.clear();
    this.registeredSidebarButtons.clear();
    this.registeredPanels.clear();
    this.registeredSettingsPanels.clear();
    this.notifyPanelListeners();
  }

  async openPluginWindow(pluginId: string): Promise<void> {
    try {
      await (window as any).electron?.plugin?.openWindow(pluginId);
    } catch (error) {
      console.error('Failed to open plugin window:', error);
    }
  }
}

export const pluginApi = new PluginApi();

(window as any).toolboxApi = pluginApi;