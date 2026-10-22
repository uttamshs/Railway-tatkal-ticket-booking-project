import * as THREE from "three";

export interface LightingHandle {
  group: THREE.Group;
  dispose: () => void;
}

/**
 * Creates scene lighting and atmosphere.
 * Returns a Group containing all lights (add to scene directly).
 * Also adds Fog to the provided scene.
 */
export function buildLightingAndAtmosphere(
  scene: THREE.Scene
): LightingHandle {
  const group = new THREE.Group();
  group.name = "LightingAndAtmosphere";

  // Soft ambient light
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  ambient.name = "AmbientLight";
  group.add(ambient);

  // Directional key light
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 8, 5);
  dirLight.name = "DirectionalLight";
  group.add(dirLight);

  // Subtle fill from below
  const fillLight = new THREE.DirectionalLight(0x8899cc, 0.2);
  fillLight.position.set(-3, -2, -3);
  group.add(fillLight);

  // Fog for depth
  scene.fog = new THREE.Fog(0x050a14, 8, 25);

  return {
    group,
    dispose: () => {
      ambient.dispose();
      dirLight.dispose();
      fillLight.dispose();
      scene.fog = null;
    },
  };
}
