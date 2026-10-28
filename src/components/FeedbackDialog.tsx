// FeedbackDialog — report missing or incorrect campus locations.
// Produces a structured report that can be copied or emailed for review.

import { useState } from "react";
import { useMapStore } from "@/state/store";
import { campusMeta, searchableById } from "@/services/CampusDataService";

export default function FeedbackDialog() {
  const open = useMapStore((s) => s.feedbackOpen);
  const setOpen = useMapStore((s) => s.setFeedbackOpen);
  const selectedId = useMapStore((s) => s.selectedId);
  const [type, setType] = useState<"missing" | "incorrect" | "other">("missing");
  const [placeName, setPlaceName] = useState("");
  const [comment, setComment] = useState("");
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const selected = searchableById(selectedId);
  const email = (import.meta.env.VITE_FEEDBACK_EMAIL as string | undefined)?.trim();

  const buildReport = () => {
    return [
      "VITmap Bhopal — location feedback",
      "--------------------------------",
      `Report type: ${type === "missing" ? "Missing place" : type === "incorrect" ? "Incorrect information" : "Other"}`,
      `Place: ${placeName || (selected ? selected.name : "-")}`,
      selected ? `Selected map place: ${selected.id} (${selected.kind})` : "Selected map place: -",
      `Current date: ${new Date().toISOString()}`,
      `App data imported: ${campusMeta.importedAt}`,
      "",
      "Details:",
      comment || "(none)",
      "",
      "Submitted via the in-app feedback form. Will be reviewed before being added to trusted campus data.",
    ].join("\n");
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(buildReport());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Feedback form"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="glass slim-scroll max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-100">📣 Report a location issue</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close feedback form"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-700 hover:text-ink-200"
          >
            ✕
          </button>
        </div>

        <label className="mb-1 block text-[11px] font-medium text-ink-400">Issue type</label>
        <div className="mb-3 flex gap-1.5">
          {(
            [
              ["missing", "Missing place"],
              ["incorrect", "Wrong info"],
              ["other", "Other"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setType(k)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium ${
                type === k ? "border-accent bg-accent-dim text-white" : "border-ink-600 bg-ink-800 text-ink-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-[11px] font-medium text-ink-400">Place (optional)</label>
        <input
          type="text"
          value={placeName}
          onChange={(e) => setPlaceName(e.target.value)}
          placeholder={selected ? selected.name : "e.g. Academic Block 3"}
          className="dark-select mb-3 w-full rounded-lg border border-ink-600 px-2.5 py-2 text-xs outline-none"
        />

        <label className="mb-1 block text-[11px] font-medium text-ink-400">Details</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="What's wrong or missing? If you know the correct location, describe it as precisely as you can."
          className="dark-select mb-3 w-full rounded-lg border border-ink-600 px-2.5 py-2 text-xs outline-none"
        />

        <p className="mb-3 text-[10px] leading-relaxed text-ink-600">
          Reports are reviewed before being added to trusted campus data. You can
          also improve the map directly by editing OpenStreetMap.
        </p>

        <div className="flex gap-2">
          <button
            onClick={copyReport}
            className="flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-xs font-semibold text-ink-200 hover:border-ink-500"
          >
            {copied ? "✓ Copied" : "Copy report"}
          </button>
          {email && (
            <a
              href={`mailto:${email}?subject=${encodeURIComponent(
                `VITmap Bhopal feedback: ${type}`
              )}&body=${encodeURIComponent(buildReport())}`}
              className="flex-1 rounded-lg border border-accent/50 bg-accent-dim px-3 py-2 text-center text-xs font-semibold text-[#a8c9f5] hover:bg-accent/25"
            >
              Email report
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
