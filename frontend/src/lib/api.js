import axios from "axios";
import { API_URL } from "./config";

export const API = API_URL;

export const apiClient = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

export default apiClient;
