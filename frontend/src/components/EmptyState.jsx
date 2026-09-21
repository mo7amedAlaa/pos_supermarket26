export default function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state-icon">
          <Icon size={32} strokeWidth={1.5} />
        </div>
      )}
      <div className="empty-state-title">{title}</div>
      {subtitle && <div className="empty-state-subtitle">{subtitle}</div>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
