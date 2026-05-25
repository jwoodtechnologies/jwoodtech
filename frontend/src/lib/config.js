const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value.replace(/\/+$/, "");
};

export const BACKEND_URL = requiredEnv("REACT_APP_BACKEND_URL");
export const API_URL = `${BACKEND_URL}/api`;

export const googleLoginUrl = ({ app, next }) => {
  const params = new URLSearchParams({ app });
  if (next) params.set("next", next);
  return `${API_URL}/auth/google/login?${params.toString()}`;
};
