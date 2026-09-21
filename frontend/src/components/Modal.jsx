import { motion, AnimatePresence } from "framer-motion";

// مكوّن Modal موحّد لكل النظام - بيحل مشكلتين كانوا موجودين قبل كده:
// 1) كل صفحة كانت بتكرر نفس الـ div.modal-overlay/modal-card يدويًا
// 2) عرض المودال كان ثابت بالبكسل (440px مثلًا) فكان بيطلع لازق في حواف
//    الشاشات الصغيرة (موبايل) - دلوقتي العرض متجاوب (min(92vw, Npx))
//    ومتمركز دايمًا عن طريق flex على الـ overlay.
export default function Modal({ open, onClose, children, wide, className = "" }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className={`modal-card ${wide ? "modal-wide" : ""} ${className}`}
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
