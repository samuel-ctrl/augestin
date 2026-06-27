import axios from "axios";
import { API_URL } from "./config";

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // No response at all — server is unreachable (network down)
      error.serverUnreachable = true;
      return Promise.reject(error);
    }
    if (error.response.status === 502 || error.response.status === 503) {
      // Proxy/load-balancer could not reach the backend (service stopped or scaling)
      error.serverUnreachable = true;
      return Promise.reject(error);
    }
    if (error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      const { pathname } = window.location;
      const skip = ["/login", "/session-expired", "/logout"];
      if (!skip.includes(pathname)) {
        window.location.href = "/session-expired";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
