import React, { createContext, useState, useContext, useEffect } from 'react';
import { api } from '@/api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      try {
        await fetch('/api/health');
      } catch {
        // Server may be offline; still allow UI (data fetches will fail until `npm run server`)
      }
      if (!cancelled) {
        setAppPublicSettings({ id: 'local', public_settings: {} });
        setIsLoadingPublicSettings(false);
      }

      setIsLoadingAuth(true);
      try {
        const currentUser = await api.auth.me();
        if (!cancelled) {
          setUser(currentUser);
          setIsAuthenticated(true);
        }
      } catch {
        if (!cancelled) {
          setUser({
            id: 'local',
            name: 'Rachelle',
            email: 'local@localhost',
            role: 'admin',
          });
          setIsAuthenticated(true);
        }
      }
      if (!cancelled) setIsLoadingAuth(false);
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const checkAppState = async () => {
    setAuthError(null);
    try {
      await fetch('/api/health');
      setAppPublicSettings({ id: 'local', public_settings: {} });
    } catch {
      setAppPublicSettings({ id: 'local', public_settings: {} });
    }
    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch {
      setUser({
        id: 'local',
        name: 'Rachelle',
        email: 'local@localhost',
        role: 'admin',
      });
      setIsAuthenticated(true);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      api.auth.logoutRedirect();
    } else {
      api.auth.logout();
    }
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
