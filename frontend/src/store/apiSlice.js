import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "./axiosBaseQuery";

// ---------------------------------------------------------------------------
// المصدر الوحيد لكل طلبات البيانات في التطبيق. الفايدة الأساسية من RTK
// Query هنا:
//   1) Caching تلقائي: لو صفحتين محتاجين نفس البيانات (مثلًا الفئات)،
//      بيتبعت طلب واحد بس ويتشارك بينهم، مش طلب لكل صفحة.
//   2) إلغاء تكرار الطلبات: التنقل بين الصفحات وبالرجوع تاني مبيعملش
//      طلب جديد لو البيانات لسه "طازة" (مش منتهية الصلاحية).
//   3) إعادة التحميل تلقائيًا بس للبيانات اللي فعلًا اتغيّرت (عن طريق
//      tags) بدل ما كل صفحة تعمل reload() يدوي لنفسها بعد كل عملية.
// ---------------------------------------------------------------------------
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Product", "Category", "User", "Invoice", "Summary", "TopProducts", "Expiring", "ProductLogs"],
  endpoints: (builder) => ({
    // ---- Auth ----
    login: builder.mutation({
      query: (credentials) => ({ url: "/auth/login", method: "POST", data: credentials }),
    }),
    getUsers: builder.query({
      query: () => ({ url: "/auth/users" }),
      providesTags: ["User"],
    }),
    createUser: builder.mutation({
      query: (body) => ({ url: "/auth/users", method: "POST", data: body }),
      invalidatesTags: ["User"],
    }),

    // ---- Categories ----
    getCategories: builder.query({
      query: () => ({ url: "/categories" }),
      providesTags: ["Category"],
    }),
    createCategory: builder.mutation({
      query: (body) => ({ url: "/categories", method: "POST", data: body }),
      invalidatesTags: ["Category"],
    }),
    deleteCategory: builder.mutation({
      query: (id) => ({ url: `/categories/${id}`, method: "DELETE" }),
      invalidatesTags: ["Category"],
    }),

    // ---- Products ----
    getProducts: builder.query({
      query: (params) => ({ url: "/products", params }),
      providesTags: ["Product"],
    }),
    scanProduct: builder.query({
      query: (code) => ({ url: `/products/scan/${encodeURIComponent(code)}` }),
    }),
    getExpiringProducts: builder.query({
      query: (params) => ({ url: "/products/expiring", params }),
      providesTags: ["Expiring"],
    }),
    getProductLogs: builder.query({
      query: (id) => ({ url: `/products/${id}/logs` }),
      providesTags: ["ProductLogs"],
    }),
    generateBarcode: builder.mutation({
      query: () => ({ url: "/products/generate-barcode", method: "POST" }),
    }),
    createProduct: builder.mutation({
      query: (body) => ({ url: "/products", method: "POST", data: body }),
      invalidatesTags: ["Product", "Summary", "Expiring"],
    }),
    updateProduct: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/products/${id}`, method: "PUT", data: body }),
      invalidatesTags: ["Product"],
    }),
    adjustStock: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/products/${id}/stock`, method: "PATCH", data: body }),
      invalidatesTags: ["Product", "Summary", "Expiring", "ProductLogs"],
    }),
    repackage: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/products/${id}/repackage`, method: "POST", data: body }),
      invalidatesTags: ["Product", "Summary", "ProductLogs"],
    }),
    deleteProduct: builder.mutation({
      query: (id) => ({ url: `/products/${id}`, method: "DELETE" }),
      invalidatesTags: ["Product", "Summary", "Expiring"],
    }),

    // ---- Invoices ----
    getInvoices: builder.query({
      query: (params) => ({ url: "/invoices", params }),
      providesTags: ["Invoice"],
    }),
    getInvoice: builder.query({
      query: (id) => ({ url: `/invoices/${id}` }),
      providesTags: ["Invoice"],
    }),
    createInvoice: builder.mutation({
      query: (body) => ({ url: "/invoices", method: "POST", data: body }),
      invalidatesTags: ["Invoice", "Product", "Summary", "TopProducts"],
    }),
    getSummary: builder.query({
      query: () => ({ url: "/invoices/stats/summary" }),
      providesTags: ["Summary"],
    }),
    getTopProducts: builder.query({
      query: (params) => ({ url: "/invoices/stats/top-products", params }),
      providesTags: ["TopProducts"],
    }),
  }),
});

export const {
  useLoginMutation,
  useGetUsersQuery,
  useCreateUserMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useGetProductsQuery,
  useLazyScanProductQuery,
  useGetExpiringProductsQuery,
  useLazyGetProductLogsQuery,
  useGenerateBarcodeMutation,
  useCreateProductMutation,
  useUpdateProductMutation,
  useAdjustStockMutation,
  useRepackageMutation,
  useDeleteProductMutation,
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useCreateInvoiceMutation,
  useGetSummaryQuery,
  useGetTopProductsQuery,
} = apiSlice;
