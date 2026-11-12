import React, { createContext, useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data);
        } catch (error) {
          console.error('Failed to fetch user', error);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const login = async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username ? username.trim() : '');
    formData.append('password', password);
    
    const res = await api.post('/auth/login', formData);
    localStorage.setItem('token', res.data.access_token);
    
    const userRes = await api.get('/auth/me');
    setUser(userRes.data);
    return userRes.data;
  };

  const register = async (username, email, password) => {
    await api.post('/auth/register', { 
      username: username ? username.trim() : '', 
      email: email ? email.trim() : '', 
      password 
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
