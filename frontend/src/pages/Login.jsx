import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Store, User, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import Spinner from "../components/Spinner";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(username, password);
      navigate(user.role === "admin" ? "/admin" : "/cashier");
    } catch (err) {
      setError(err.response?.data?.message || "حدث خطأ في تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-icon">
          <Store size={28} />
        </div>
        <h1>نظام نقاط البيع</h1>
        <p className="subtitle">سوبر ماركت</p>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <label>اسم المستخدم</label>
        <div className="input-with-icon">
          <User size={17} className="input-icon" />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </div>

        <label>كلمة المرور</label>
        <div className="input-with-icon">
          <Lock size={17} className="input-icon" />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="input-icon-toggle"
            onClick={() => setShowPassword((s) => !s)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? <Spinner /> : "تسجيل الدخول"}
        </button>
      </form>
    </div>
  );
}
