import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { request } from '../utils/api';

const AuthContext = createContext();
const USER_STORAGE_KEY = 'collabspace_current_user';

export async function api(path, options = {}) {
  return request(path, options);
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const payload = await request('/api/auth/me', { method: 'GET' });
      setCurrentUser(payload.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(payload.user));
      return payload.user;
    } catch {
      setCurrentUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email, password) => {
    const payload = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setCurrentUser(payload.user);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(payload.user));
    return payload;
  }, []);

  const register = useCallback(async (userData) => {
    const payload = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    setCurrentUser(payload.user);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(payload.user));
    return payload;
  }, []);

  const logout = useCallback(async () => {
    try {
      await request('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch {
      // Ignore
    }
    setCurrentUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  }, []);

  const setUser = useCallback((user) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser: setUser,
        user: currentUser,
        setUser,
        loading,
        checkAuth,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
