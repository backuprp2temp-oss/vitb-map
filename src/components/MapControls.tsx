// Map control stack: zoom, camera reset, 2D/3D toggle, fullscreen, locate.

import { useEffect, useState } from "react";
import { useMapStore } from "@/state/store";
import { campusViewCenter, campusMeta, projector } from "@/services/CampusDataService";
import { DEFAULT_VIEW_DISTANCE } from "./scene/CameraRig";

function ControlButton({
  onClick,
  label,
  children,
  active = false,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-lg border text-base shadow-md shadow-black/40 transition-colors ${
        active
          ? "border-accent bg-accent-dim text-white"
          : "glass text-ink-300 hover:border-ink-500 hover:text-ink-100"
      }`}
    >
      {children}
    </button>
  );
}

export default function MapControls() {
  const zoom = useMapStore((s) => s.zoom);
  const setViewMode = useMapStore((s) => s.setViewMode);
  const viewMode = useMapStore((s) => s.viewMode);
  const focusOn = useMapStore((s) => s.focusOn);
  const setUserLocation = useMapStore((s) => s.setUserLocation);
  const userLocationStatus = useMapStore((s) => s.userLocationStatus);

  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    function onFs() {
      setFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        // Fullscreen denied — no-op.
      });
    }
  };

  const resetCamera = () => {
    focusOn(campusViewCenter[0], campusViewCenter[1], DEFAULT_VIEW_DISTANCE, false, 0.95);
    if (viewMode !== "3d") setViewMode("3d");
  };

  const locate = () => {
    if (userLocationStatus === "locating") return;
    if (!("geolocation" in navigator)) {
      setUserLocation(null, "denied");
      return;
    }
    setUserLocation(null, "locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const b = campusMeta.campusBbox;
        const within =
          latitude >= b.south - 0.01 &&
          latitude <= b.north + 0.01 &&
          longitude >= b.west - 0.01 &&
          longitude <= b.east + 0.01;
        if (!within) {
          setUserLocation({ lat: latitude, lon: longitude, accuracy }, "outside");
          return;
        }
        setUserLocation({ lat: latitude, lon: longitude, accuracy }, "granted");
        const [x, z] = projector.project(latitude, longitude);
        focusOn(x, z, 300);
      },
      () => setUserLocation(null, "denied"),
      { timeout: 10000, maximumAge: 30000 }
    );
  };

  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label="Map controls">
      <ControlButton onClick={() => zoom(1)} label="Zoom in">＋</ControlButton>
      <ControlButton onClick={() => zoom(-1)} label="Zoom out">－</ControlButton>
      <ControlButton onClick={resetCamera} label="Reset camera to campus view">⟲</ControlButton>
      <ControlButton
        onClick={() => setViewMode(viewMode === "3d" ? "2d" : "3d")}
        label={viewMode === "3d" ? "Switch to simplified 2D view" : "Switch to 3D view"}
        active={viewMode === "2d"}
      >
        {viewMode === "3d" ? "3D" : "2D"}
      </ControlButton>
      <ControlButton onClick={toggleFullscreen} label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
        ⛶
      </ControlButton>
      <ControlButton onClick={locate} label="Use my current location">
        {userLocationStatus === "locating" ? "…" : "◎"}
      </ControlButton>
    </div>
  );
}
