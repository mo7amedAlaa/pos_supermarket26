import { useState } from "react";
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
  Menu,
  X,
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
  // القايمة الجانبية على الموبايل بتبقى دُرج مخفي، وعلى الشاشات الكبيرة
  // (lg فأعلى) بتبقى ظاهرة دايمًا وثابتة - نفس المكوّن، سلوك مختلف بالـ CSS بس
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-[#F2F4F1] lg:flex">
      {/* شريط علوي - يظهر على الموبايل والتابلت بس (لحد lg) */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-1.5 text-zinc-600 transition hover:bg-zinc-100"
          aria-label="فتح القائمة"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <Store size={17} className="text-emerald-600" />
          لوحة تحكم المدير
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
          {user?.name?.charAt(0) || "?"}
        </div>
      </div>

      {/* الخلفية المعتمة خلف الدُرج - موبايل بس */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-zinc-900/40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSidebar}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-64 shrink-0 flex-col border-l border-zinc-200 bg-white transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-zinc-800">
            <Store size={20} className="text-emerald-600" />
            <span>لوحة تحكم المدير</span>
          </div>
          <button
            onClick={closeSidebar}
            className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X size={18} />
          </button>
        </div>

        <nav
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3"
          onClick={closeSidebar}
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                }`
              }
            >
              <Icon size={17} className="shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}

          <NavLink
            to="/cashier"
            className="mt-2 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
          >
            <ShoppingCart size={17} className="shrink-0" />
            <span>فتح شاشة الكاشير</span>
          </NavLink>
        </nav>

        <div className="border-t border-zinc-100 p-3">
          <div className="mb-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
              {user?.name?.charAt(0) || "?"}
            </div>
            <span className="truncate text-sm text-zinc-700">{user?.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            <LogOut size={15} /> تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden p-4 pt-20 lg:p-6 lg:pt-6">
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
