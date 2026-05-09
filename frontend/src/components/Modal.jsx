export default function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{title}</h2>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
