import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "../components/Modal";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null); // { message, resolve }
  const resolverRef = useRef(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({ message, ...options });
    });
  }, []);

  const handleClose = (result) => {
    resolverRef.current?.(result);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal open={!!dialog} onClose={() => handleClose(false)} className="confirm-card">
        {dialog && (
          <>
            <p className="confirm-message">{dialog.message}</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => handleClose(false)}>
                {dialog.cancelLabel || "إلغاء"}
              </button>
              <button
                className={`btn ${dialog.danger ? "btn-danger" : "btn-primary"}`}
                onClick={() => handleClose(true)}
              >
                {dialog.confirmLabel || "تأكيد"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext).confirm;
