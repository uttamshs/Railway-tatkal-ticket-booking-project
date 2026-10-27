import * as THREE from "three";
import { PALETTES, VizTheme } from "../lib/theme";

export interface LightingHandle {
  group: THREE.Group;
  /** Re-tints fog and light intensity for the given theme without rebuilding. */
  updateTheme: (theme: VizTheme) => void;
  dispose: () => void;
}

/** Soft ambient + key + fill lights and theme-matched depth fog. */
export function buildLightingAndAtmosphere(scene: THREE.Scene, theme: VizTheme): LightingHandle {
  const group = new THREE.Group();
  group.name = "LightingAndAtmosphere";

  const ambient = new THREE.AmbientLight(0xffffff, PALETTES[theme].ambient);
  const key = new THREE.DirectionalLight(0xffffff, PALETTES[theme].keyLight);
  key.position.set(5, 8, 5);
  const fill = new THREE.DirectionalLight(0x8899cc, 0.2);
  fill.position.set(-3, -2, -3);
  group.add(ambient, key, fill);

  scene.fog = new THREE.Fog(PALETTES[theme].fog, 7, 22);

  return {
    group,
    updateTheme: (next) => {
      const p = PALETTES[next];
      if (scene.fog) scene.fog.color.setHex(p.fog);
      else scene.fog = new THREE.Fog(p.fog, 7, 22);
      ambient.intensity = p.ambient;
      key.intensity = p.keyLight;
    },
    dispose: () => {
      group.removeFromParent();
      scene.fog = null;
    },
  };
}
