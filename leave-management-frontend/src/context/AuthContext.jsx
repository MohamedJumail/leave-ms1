import React, { createContext, useState, useContext} from "react";
import api from "../services/api";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [error, setError] = useState("");
  
  const login = async (email, password) => {
    try {
      const response = await api.post("/api/login", { email, password });
      const { token, user } = response.data;

      if (token && user) {
        localStorage.setItem("token", token);
        setToken(token);
        setUser(user);
    
        setError("");
        return { success: true };
      }
      
      setError(response.data.message || "Login failed");
      return { success: false };
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Login failed";
      setError(errorMsg);
      return { success: false };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setError("");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, error, setError }}>
      {children}
    </AuthContext.Provider>
  );
};