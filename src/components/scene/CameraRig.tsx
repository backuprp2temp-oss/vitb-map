// CameraRig — smooth camera transitions for search focus, reset, 2D/3D
// switches and manual picks. Reads focusRequest from the store and eases the
// OrbitControls target + camera position until converged.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useMapStore } from "@/state/store";
import { campusViewCenter } from "@/services/CampusDataService";

export const DEFAULT_VIEW_DISTANCE = 540;
export const TOPDOWN_VIEW_DISTANCE = 1500;

const tmpTarget = new THREE.Vector3();
const tmpOffset = new THREE.Vector3();
const tmpSpherical = new THREE.Spherical();
const tmpPos = new THREE.Vector3();

export function CameraRig() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const focusRequest = useMapStore((s) => s.focusRequest);
  const viewMode = useMapStore((s) => s.viewMode);
  const clearFocus = useMapStore((s) => s.clearFocus);
  const focusOn = useMapStore((s) => s.focusOn);
  const firstRun = useRef(true);

  // Centre the default view on the actual built campus (feature centroid),
  // not the raw campus-centre coordinate.
  useEffect(() => {
    if (!controls) return;
    controls.target.set(campusViewCenter[0], 0, campusViewCenter[1]);
    controls.update();
  }, [controls]);

  // Smooth transition when switching 3D ⇄ 2D.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    focusOn(
      campusViewCenter[0],
      campusViewCenter[1],
      viewMode === "2d" ? TOPDOWN_VIEW_DISTANCE : DEFAULT_VIEW_DISTANCE,
      viewMode === "2d"
    );
  }, [viewMode, focusOn]);

  useFrame((_, dt) => {
    if (!controls || !focusRequest) return;
    const { x, z, distance, topDown, phi } = focusRequest;
    const damping = 1 - Math.pow(0.0002, Math.min(dt, 0.05));

    tmpTarget.set(x, 0, z);
    controls.target.lerp(tmpTarget, damping);

    // Keep the azimuth; ease polar angle (top-down or explicit) and distance.
    tmpOffset.copy(camera.position).sub(controls.target);
    tmpSpherical.setFromVector3(tmpOffset);
    const desiredPhi = topDown ? 0.06 : phi ?? tmpSpherical.phi;
    const desiredDist = distance ?? tmpSpherical.radius;
    tmpSpherical.phi += (desiredPhi - tmpSpherical.phi) * damping;
    tmpSpherical.radius += (desiredDist - tmpSpherical.radius) * damping;
    tmpSpherical.phi = Math.min(tmpSpherical.phi, 1.45);
    tmpSpherical.makeSafe();
    tmpPos.setFromSpherical(tmpSpherical).add(controls.target);
    camera.position.copy(tmpPos);
    controls.update();

    if (
      controls.target.distanceTo(tmpTarget) < 1 &&
      Math.abs(tmpSpherical.phi - desiredPhi) < 0.01 &&
      Math.abs(tmpSpherical.radius - desiredDist) < 2
    ) {
      clearFocus();
    }
  });

  return null;
}

/** Consumes zoom requests (from MapControls) by easing the camera distance. */
export function ZoomHandler() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const zoomRequest = useMapStore((s) => s.zoomRequest);
  const focusOn = useMapStore((s) => s.focusOn);
  const lastNonce = useRef(0);

  useEffect(() => {
    if (!controls || !zoomRequest) return;
    if (zoomRequest.nonce === lastNonce.current) return;
    lastNonce.current = zoomRequest.nonce;
    const factor = zoomRequest.direction > 0 ? 0.62 : 1.6;
    const dist = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * factor, 30, 2600);
    focusOn(controls.target.x, controls.target.z, dist);
  }, [zoomRequest, controls, camera, focusOn]);

  return null;
}
