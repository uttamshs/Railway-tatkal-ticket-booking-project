import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const FLY_DURATION_MS = 800;

/** Cubic ease-in-out easing function. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Preset camera positions for named views. */
const PRESET_POSITIONS: Record<string, [number, number, number]> = {
  iso: [2.5, 1.8, 2.5],
  top: [0, 3.5, 0.001], // tiny Z offset to avoid gimbal lock
  front: [0, 0, 3.5],
  side: [3.5, 0, 0],
};

interface FlyAnimation {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  startTime: number;
  duration: number;
}

export class CameraController {
  controls: OrbitControls;
  private camera: THREE.PerspectiveCamera;
  private flyAnim: FlyAnimation | null = null;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement
  ) {
    this.camera = camera;

    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.target.set(0, 0, 0);
    controls.update();
    this.controls = controls;
  }

  /**
   * Smoothly lerp camera position and controls.target over FLY_DURATION_MS
   * using cubic easing.
   */
  flyTo(targetPos: THREE.Vector3, targetLookAt?: THREE.Vector3): void {
    const lookAt = targetLookAt ?? new THREE.Vector3(0, 0, 0);
    this.flyAnim = {
      fromPos: this.camera.position.clone(),
      toPos: targetPos.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: lookAt.clone(),
      startTime: performance.now(),
      duration: FLY_DURATION_MS,
    };
  }

  /** Must be called each frame inside the render loop. */
  update(): void {
    if (this.flyAnim) {
      const elapsed = performance.now() - this.flyAnim.startTime;
      const rawT = Math.min(elapsed / this.flyAnim.duration, 1);
      const t = easeInOutCubic(rawT);

      this.camera.position.lerpVectors(this.flyAnim.fromPos, this.flyAnim.toPos, t);
      this.controls.target.lerpVectors(
        this.flyAnim.fromTarget,
        this.flyAnim.toTarget,
        t
      );

      if (rawT >= 1) {
        this.flyAnim = null;
      }
    }

    this.controls.update();
  }

  iso(): void {
    const [x, y, z] = PRESET_POSITIONS.iso;
    this.flyTo(new THREE.Vector3(x, y, z));
  }

  top(): void {
    const [x, y, z] = PRESET_POSITIONS.top;
    this.flyTo(new THREE.Vector3(x, y, z));
  }

  front(): void {
    const [x, y, z] = PRESET_POSITIONS.front;
    this.flyTo(new THREE.Vector3(x, y, z));
  }

  side(): void {
    const [x, y, z] = PRESET_POSITIONS.side;
    this.flyTo(new THREE.Vector3(x, y, z));
  }

  dispose(): void {
    this.controls.dispose();
  }
}
