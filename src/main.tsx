import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import App from './App.tsx';
import './index.css';

const NextThemesProvider = ThemeProvider as any;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NextThemesProvider attribute="class" defaultTheme="light">
      <App />
    </NextThemesProvider>
  </StrictMode>,
);
