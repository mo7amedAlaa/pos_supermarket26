import { motion, AnimatePresence } from "framer-motion";

// مكوّن Modal موحّد لكل النظام - بيحل مشكلتين كانوا موجودين قبل كده:
// 1) كل صفحة كانت بتكرر نفس الـ div.modal-overlay/modal-card يدويًا
// 2) عرض المودال كان ثابت بالبكسل (440px مثلًا) فكان بيطلع لازق في حواف
//    الشاشات الصغيرة (موبايل) - دلوقتي العرض متجاوب (w-[min(92vw,Npx)])
//    ومتمركز دايمًا عن طريق flex على الـ overlay.
export default function Modal({
  open,
  onClose,
  children,
  wide,
  className = "",
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-[2px]"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className={`max-h-[90vh] ${wide ? "w-[min(92vw,720px)]" : "w-[min(92vw,440px)]"} overflow-y-auto rounded-2xl bg-white p-5 shadow-xl ${className}`}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
