import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const API = `${BASE}/api`;

export const apiClient = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

export default apiClient;
