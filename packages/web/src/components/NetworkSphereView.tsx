import { Canvas } from "@react-three/fiber";
import { DottedGlobe } from "@kaartje/shared";

export function NetworkSphereView() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <DottedGlobe />
      </Canvas>
    </div>
  );
}
