import axios from "axios";
import { apiClient, API } from "@/lib/api";

const TOKEN_KEY = "woodchat_token";

export const wcClient = axios.create({
  baseURL: `${API}/woodchat`,
  headers: { "Content-Type": "application/json" },
});

wcClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const setWcToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export const getWcToken = () => localStorage.getItem(TOKEN_KEY);

// Re-export apiClient for parity with other modules
export { apiClient };
