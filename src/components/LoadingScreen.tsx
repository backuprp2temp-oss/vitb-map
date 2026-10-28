// Full-screen loading indicator shown during map initialization.

export default function LoadingScreen({ fading = false }: { fading?: boolean }) {
  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-ink-950 transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      aria-live="polite"
      aria-busy={!fading}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="text-3xl">🎓</span>
        <div>
          <div className="text-lg font-semibold tracking-wide text-ink-200">VITmap Bhopal</div>
          <div className="text-xs text-ink-400">3D Campus Map & Navigation</div>
        </div>
      </div>
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-accent"
        role="status"
        aria-label="Loading campus map"
      />
    </div>
  );
}
