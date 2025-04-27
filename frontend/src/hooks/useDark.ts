import { useState, useEffect } from 'react';

export const useDark = () => {
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    // Check if user prefers dark mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Check if dark mode is saved in localStorage
    const storedDarkMode = localStorage.getItem('darkMode');
    const initialDarkMode = storedDarkMode 
      ? storedDarkMode === 'true' 
      : prefersDark;
    
    setIsDark(initialDarkMode);
    
    // Listen for changes in system preferences
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if no user preference is stored
      if (!localStorage.getItem('darkMode')) {
        setIsDark(e.matches);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);
  
  const toggleDarkMode = () => {
    setIsDark(!isDark);
    localStorage.setItem('darkMode', (!isDark).toString());
  };
  
  return { isDark, toggleDarkMode };
}; 