import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ui/App';
import './assets/fonts/fonts.css';
import './ui/theme.css';
import iconSmall from './assets/brand/icon-small.svg';

// favicon (set here so the single-file build carries it inline)
{
  const l = document.createElement('link');
  l.rel = 'icon'; l.type = 'image/svg+xml'; l.href = iconSmall;
  document.head.appendChild(l);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
