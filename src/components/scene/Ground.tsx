// Ground plane + subtle grid + scene lighting.

import { Grid } from "@react-three/drei";

export function Ground() {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color="#131820" roughness={1} metalness={0} />
      </mesh>
      <Grid
        position={[0, 0.015, 0]}
        args={[3000, 3000]}
        cellSize={40}
        cellThickness={0.5}
        cellColor="#202834"
        sectionSize={200}
        sectionThickness={1}
        sectionColor="#2a3442"
        fadeDistance={2200}
        fadeStrength={1.4}
        followCamera={false}
      />
    </group>
  );
}

export function SceneLights({ shadows }: { shadows: boolean }) {
  return (
    <>
      <hemisphereLight args={["#46505c", "#0c0e12", 1.05]} />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[-500, 700, 300]}
        intensity={1.15}
        color="#dfe8f2"
        castShadow={shadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-900}
        shadow-camera-right={900}
        shadow-camera-top={900}
        shadow-camera-bottom={-900}
        shadow-camera-far={2500}
        shadow-bias={-0.0004}
      />
    </>
  );
}
