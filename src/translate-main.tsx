import React from 'react';
import { createRoot } from 'react-dom/client';
import TranslatePopup from './pages/translate-popup';
import './styles/theme.css';
import './pages/translate-popup/translate-popup.css';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <TranslatePopup />
    </React.StrictMode>,
  );
}
