import api from "../api/axios";

// RTK Query محتاج "baseQuery" - دالة بتنفّذ الطلب فعليًا. بدل ما نستخدم
// fetchBaseQuery الجاهزة، بنلف axios instance بتاعنا (اللي عنده أصلًا
// interceptor بيحط التوكن ويتعامل مع انتهاء الجلسة (401))، عشان منكررش
// نفس المنطق مرتين بطريقتين مختلفتين.
export function axiosBaseQuery() {
  return async ({ url, method = "GET", data, params }) => {
    try {
      const result = await api({ url, method, data, params });
      return { data: result.data };
    } catch (axiosError) {
      const err = axiosError;
      return {
        error: {
          status: err.response?.status,
          data: err.response?.data || { message: err.message },
        },
      };
    }
  };
}
