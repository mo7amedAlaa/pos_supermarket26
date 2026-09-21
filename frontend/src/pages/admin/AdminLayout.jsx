import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import {
  Package,
  CalendarClock,
  Tags,
  Users,
  BarChart3,
  Receipt,
  ShoppingCart,
  LogOut,
  Store,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/admin/products", label: "المنتجات والمخزون", icon: Package },
  { to: "/admin/expiry", label: "تواريخ الصلاحية", icon: CalendarClock },
  { to: "/admin/categories", label: "الفئات", icon: Tags },
  { to: "/admin/users", label: "المستخدمون", icon: Users },
  { to: "/admin/reports", label: "التقارير والمبيعات", icon: BarChart3 },
  { to: "/admin/invoices", label: "الفواتير", icon: Receipt },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-title">
          <Store size={22} />
          <span>لوحة تحكم المدير</span>
        </div>
        <nav>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
          <NavLink to="/cashier" className="nav-link nav-link-accent">
            <ShoppingCart size={18} />
            <span>فتح شاشة الكاشير</span>
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar-circle">{user?.name?.charAt(0) || "?"}</div>
            <span>{user?.name}</span>
          </div>
          <button className="btn btn-secondary btn-block" onClick={handleLogout}>
            <LogOut size={15} /> تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
