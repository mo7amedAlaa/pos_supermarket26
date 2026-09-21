import { createContext, useContext, useState } from "react";
import { useLoginMutation } from "../store/apiSlice";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loginMutation] = useLoginMutation();

  const login = async (username, password) => {
    try {
      const data = await loginMutation({ username, password }).unwrap();
      localStorage.setItem("token", data.token);
      const userData = { _id: data._id, name: data.name, username: data.username, role: data.role };
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (err) {
      // نطبّع شكل الخطأ زي شكل أخطاء axios القديمة عشان صفحة تسجيل
      // الدخول تفضل شغالة زي ما هي من غير أي تعديل فيها
      throw { response: { data: err.data } };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
