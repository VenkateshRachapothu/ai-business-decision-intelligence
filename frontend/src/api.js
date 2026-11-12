import axios from 'axios';

// Default to port 8001 (matching active uvicorn dev server) or 8000 via VITE_API_URL
const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';

const api = axios.create({
  baseURL: DEFAULT_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-fallback: if the active port is unreachable or returns 405 from a stale process, retry on alternate port
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config || config._retry) {
      return Promise.reject(error);
    }

    const isNetworkOrMethodError =
      error.code === 'ERR_NETWORK' ||
      error.message?.includes('Network Error') ||
      error.response?.status === 405;

    if (isNetworkOrMethodError && config.baseURL) {
      if (config.baseURL.includes(':8001')) {
        config._retry = true;
        config.baseURL = config.baseURL.replace(':8001', ':8000');
        if (config.url && config.url.includes(':8001')) {
          config.url = config.url.replace(':8001', ':8000');
        }
        return axios(config);
      } else if (config.baseURL.includes(':8000')) {
        config._retry = true;
        config.baseURL = config.baseURL.replace(':8000', ':8001');
        if (config.url && config.url.includes(':8000')) {
          config.url = config.url.replace(':8000', ':8001');
        }
        return axios(config);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
