// CampusMap — full-screen interactive 3D campus (React Three Fiber).
// Includes a WebGL availability fallback and low-power device adjustments.

import { Suspense, useCallback, useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { SceneLights, Ground } from "./scene/Ground";
import { AreasRenderer } from "./scene/AreasRenderer";
import { PathsRenderer } from "./scene/PathsRenderer";
import { Buildings } from "./scene/Buildings";
import { Trees } from "./scene/Trees";
import { PoiMarkers } from "./scene/PoiMarkers";
import { RouteLine } from "./scene/RouteLine";
import { CameraRig, ZoomHandler } from "./scene/CameraRig";
import { useMapStore } from "@/state/store";
import { campusViewCenter, projector } from "@/services/CampusDataService";

function useWebGLAvailable(): boolean {
  return useMemo(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl2 = canvas.getContext("webgl2");
      const gl1 = gl2 ? null : canvas.getContext("webgl");
      return !!(gl2 || gl1);
    } catch {
      return false;
    }
  }, []);
}

function isSmallTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const small = typeof window !== "undefined" && Math.min(window.screen.width, window.screen.height) < 768;
  return coarse && small;
}

function WebGLFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-ink-950 p-6">
      <div className="max-w-md rounded-xl border border-ink-700 bg-ink-850 p-6 text-center">
        <div className="mb-2 text-2xl">🗺️</div>
        <h2 className="mb-2 text-lg font-semibold text-ink-200">3D view unavailable</h2>
        <p className="text-sm text-ink-400">
          Your browser does not support WebGL, which is required to render the interactive
          3D campus. Search, place details and route planning still work from the panels.
        </p>
      </div>
    </div>
  );
}

export default function CampusMap({ onReady }: { onReady?: () => void }) {
  const webglOk = useWebGLAvailable();
  const select = useMapStore((s) => s.select);
  const pickMode = useMapStore((s) => s.pickMode);
  const setOriginPoint = useMapStore((s) => s.setOriginPoint);
  const setDestPoint = useMapStore((s) => s.setDestPoint);
  const setPickMode = useMapStore((s) => s.setPickMode);
  const lowPower = useMemo(isSmallTouchDevice, []);
  const shadows = !lowPower;

  const handleGroundClick = useCallback(
    (e: { point?: THREE.Vector3; stopPropagation: () => void }) => {
      e.stopPropagation();
      if (pickMode && e.point) {
        const { lat, lon } = projector.unproject(e.point.x, e.point.z);
        if (pickMode === "origin") {
          setOriginPoint({ lat, lon }, "Map point");
        } else {
          setDestPoint({ lat, lon }, "Map point");
        }
        setPickMode(null);
        return;
      }
      select(null);
    },
    [pickMode, select, setOriginPoint, setDestPoint, setPickMode]
  );

  if (!webglOk) return <WebGLFallback />;

  return (
    <Canvas
      shadows={shadows}
      dpr={lowPower ? [1, 1.25] : [1, 1.75]}
      camera={{
        position: [campusViewCenter[0] + 160, 430, campusViewCenter[1] + 560],
        fov: 50,
        near: 1,
        far: 9000,
      }}
      onCreated={({ gl, scene, camera }) => {
        // Debug hook (dev aid): expose the live scene for inspection.
        (window as unknown as Record<string, unknown>).__vitb = { scene, camera, gl };
        onReady?.();
      }}
    >
      <color attach="background" args={["#0b0d10"]} />
      <fog attach="fog" args={["#0b0d10", 800, 2800]} />
      {/* Invisible click-catcher: map picks + click-empty-to-deselect */}
      <mesh
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleGroundClick}
      >
        <planeGeometry args={[9000, 9000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Suspense fallback={null}>
        <SceneLights shadows={shadows} />
        <Ground />
        <AreasRenderer />
        <PathsRenderer />
        <Buildings shadows={shadows} />
        <Trees />
        <PoiMarkers />
        <RouteLine />
        <CameraRig />
        <ZoomHandler />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={30}
          maxDistance={2600}
          maxPolarAngle={1.45}
          enableRotate
        />
      </Suspense>
    </Canvas>
  );
}
