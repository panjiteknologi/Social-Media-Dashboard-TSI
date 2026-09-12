export function Placeholder({ label }: { label: string }) {
  return (
    <div className="placeholder">
      <div className="placeholder__inner">
        <div className="placeholder__mark" />
        <div className="placeholder__title">{label}</div>
        <div className="placeholder__text">This screen is planned for a follow-up pass.</div>
      </div>
    </div>
  );
}
