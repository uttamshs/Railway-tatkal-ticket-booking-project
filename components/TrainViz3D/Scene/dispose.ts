import * as THREE from "three";

/** Recursively disposes geometries, materials and textures under `root` and detaches it from its parent. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    const geometry = (child as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    geometry?.dispose();

    const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const m of materials) {
      (m as THREE.SpriteMaterial).map?.dispose();
      m.dispose();
    }
  });
  root.removeFromParent();
}
