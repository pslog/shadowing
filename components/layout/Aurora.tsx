// Fixed decorative background: drifting gradient blobs + faint grid.
// Purely visual, behind all content, non-interactive.
export function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
    </div>
  );
}
