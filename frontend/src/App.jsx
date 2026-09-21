import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Provider } from "react-redux";
import { store } from "./store/store";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import PrivateRoute from "./components/PrivateRoute";
import RealtimeListener from "./components/RealtimeListener";
import PageLoader from "./components/PageLoader";
import ErrorBoundary from "./components/ErrorBoundary";

import Login from "./pages/Login";
import AdminLayout from "./pages/admin/AdminLayout";

// ---------------------------------------------------------------------------
// Code splitting: كل صفحة أدمن وشاشة الكاشير بتتحمّل في ملف JS منفصل
// (chunk) بس لما المستخدم يفتحها فعليًا، بدل ما كل حاجة تتحمل مرة واحدة
// أول ما الموقع يفتح. ده بيقلل حجم أول تحميل بشكل كبير خصوصًا إن
// html5-qrcode (مكتبة الكاميرا) تقيلة ومستخدمة بس في صفحتين.
// ---------------------------------------------------------------------------
const ProductsPage = lazy(() => import("./pages/admin/ProductsPage"));
const CategoriesPage = lazy(() => import("./pages/admin/CategoriesPage"));
const ExpiryPage = lazy(() => import("./pages/admin/ExpiryPage"));
const UsersPage = lazy(() => import("./pages/admin/UsersPage"));
const ReportsPage = lazy(() => import("./pages/admin/ReportsPage"));
const InvoicesPage = lazy(() => import("./pages/admin/InvoicesPage"));
const CashierPage = lazy(() => import("./pages/cashier/CashierPage"));

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin/products" : "/cashier"} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* Provider في أعلى الشجرة عشان أي مكوّن (حتى في AuthContext) يقدر
          يستخدم RTK Query hooks أو يبعت invalidateTags */}
      <Provider store={store}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <ConfirmProvider>
                <RealtimeListener />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<HomeRedirect />} />

                    <Route
                      path="/admin"
                      element={
                        <PrivateRoute roles={["admin"]}>
                          <AdminLayout />
                        </PrivateRoute>
                      }
                    >
                      <Route index element={<Navigate to="products" replace />} />
                      <Route path="products" element={<ProductsPage />} />
                      <Route path="expiry" element={<ExpiryPage />} />
                      <Route path="categories" element={<CategoriesPage />} />
                      <Route path="users" element={<UsersPage />} />
                      <Route path="reports" element={<ReportsPage />} />
                      <Route path="invoices" element={<InvoicesPage />} />
                    </Route>

                    <Route
                      path="/cashier"
                      element={
                        <PrivateRoute roles={["admin", "cashier"]}>
                          <CashierPage />
                        </PrivateRoute>
                      }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </ConfirmProvider>
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  );
}
