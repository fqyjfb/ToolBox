import React, { useEffect, useState } from 'react';
import { pluginApi, PanelRegistration } from '../../services/pluginApi';

const PluginPanels: React.FC = () => {
  const [panels, setPanels] = useState<PanelRegistration[]>([]);

  useEffect(() => {
    const handlePanelsChange = (newPanels: PanelRegistration[]) => {
      setPanels(newPanels);
    };

    pluginApi.addPanelListener(handlePanelsChange);
    return () => pluginApi.removePanelListener(handlePanelsChange);
  }, []);

  if (panels.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {panels.map((panel) => (
        <div key={panel.id} className="pointer-events-auto">
          {panel.render()}
        </div>
      ))}
    </div>
  );
};

export default PluginPanels;