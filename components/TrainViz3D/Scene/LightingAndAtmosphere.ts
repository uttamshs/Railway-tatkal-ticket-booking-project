import * as THREE from "three";

export interface LightingHandle {
  group: THREE.Group;
  updateTheme: (theme: "light" | "dark") => void;
  dispose: () => void;
}

/**
 * Creates scene lighting and atmosphere.
 * Returns a Group containing all lights (add to scene directly).
 * Also adds Fog to the provided scene matching the current theme.
 */
export function buildLightingAndAtmosphere(
  scene: THREE.Scene,
  theme: "light" | "dark" = "dark"
): LightingHandle {
  const group = new THREE.Group();
  group.name = "LightingAndAtmosphere";

  // Soft ambient light
  const ambient = new THREE.AmbientLight(0xffffff, theme === "dark" ? 0.6 : 0.85);
  ambient.name = "AmbientLight";
  group.add(ambient);

  // Directional key light
  const dirLight = new THREE.DirectionalLight(0xffffff, theme === "dark" ? 0.8 : 0.95);
  dirLight.position.set(5, 8, 5);
  dirLight.name = "DirectionalLight";
  group.add(dirLight);

  // Subtle fill from below
  const fillLight = new THREE.DirectionalLight(0x8899cc, 0.2);
  fillLight.position.set(-3, -2, -3);
  group.add(fillLight);

  // Theme-aware fog for depth
  const fogColor = theme === "dark" ? 0x050a14 : 0xf0f6ff;
  scene.fog = new THREE.Fog(fogColor, 8, 25);

  return {
    group,
    updateTheme: (newTheme: "light" | "dark") => {
      const hex = newTheme === "dark" ? 0x050a14 : 0xf0f6ff;
      if (scene.fog) {
        scene.fog.color.setHex(hex);
      } else {
        scene.fog = new THREE.Fog(hex, 8, 25);
      }
      ambient.intensity = newTheme === "dark" ? 0.6 : 0.85;
      dirLight.intensity = newTheme === "dark" ? 0.8 : 0.95;
    },
    dispose: () => {
      ambient.dispose();
      dirLight.dispose();
      fillLight.dispose();
      scene.fog = null;
    },
  };
}
