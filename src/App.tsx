import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { DashboardScreen } from './components/DashboardScreen';
import { ReaderScreen } from './components/ReaderScreen';

export const App: React.FC = () => {
  const [readingUrl, setReadingUrl] = useState<string | null>(null);

  const handleRead = (url: string) => {
    setReadingUrl(url);
  };

  const handleExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleBack = () => {
    setReadingUrl(null);
  };

  return (
    <ThemeProvider>
      {readingUrl ? (
        <ReaderScreen
          initialUrl={readingUrl}
          onBack={handleBack}
          onExternal={handleExternal}
        />
      ) : (
        <DashboardScreen
          onRead={handleRead}
          onExternal={handleExternal}
        />
      )}
    </ThemeProvider>
  );
};

export default App;
