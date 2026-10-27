import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const FLY_DURATION_MS = 800;
/** Keeps panning from losing the data cube off-screen. */
const PAN_LIMIT = 1.6;

/** Cubic ease-in-out easing function. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export type CameraPreset = "reset" | "top" | "front" | "side";

/** Preset camera positions for named views. */
const PRESET_POSITIONS: Record<CameraPreset, [number, number, number]> = {
  reset: [2.5, 1.8, 2.5],
  top: [0, 3.5, 0.001], // tiny Z offset avoids gimbal lock
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

/**
 * Google-Earth-style camera: drag = orbit, right-drag / two-finger = pan,
 * wheel / pinch = zoom (towards the cursor), with damping and click-to-fly.
 */
export class CameraController {
  controls: OrbitControls;
  private camera: THREE.PerspectiveCamera;
  private flyAnim: FlyAnimation | null = null;
  private readonly cancelFly = () => {
    this.flyAnim = null;
  };

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;

    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.zoomToCursor = true;
    controls.minDistance = 0.8;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.target.set(0, 0, 0);
    controls.update();
    // Grabbing the scene mid-flight hands control straight back to the user.
    controls.addEventListener("start", this.cancelFly);
    this.controls = controls;
  }

  /** Smoothly moves the camera (and look-at target) with cubic easing. */
  flyTo(position: THREE.Vector3, lookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 0)): void {
    this.flyAnim = {
      fromPos: this.camera.position.clone(),
      toPos: position.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: lookAt.clone(),
      startTime: performance.now(),
      duration: FLY_DURATION_MS,
    };
  }

  setAutoRotate(on: boolean): void {
    this.controls.autoRotate = on;
    this.controls.autoRotateSpeed = 1.0;
  }

  /** Must be called each frame inside the render loop. */
  update(): void {
    if (this.flyAnim) {
      const rawT = Math.min((performance.now() - this.flyAnim.startTime) / this.flyAnim.duration, 1);
      const t = easeInOutCubic(rawT);
      this.camera.position.lerpVectors(this.flyAnim.fromPos, this.flyAnim.toPos, t);
      this.controls.target.lerpVectors(this.flyAnim.fromTarget, this.flyAnim.toTarget, t);
      if (rawT >= 1) this.flyAnim = null;
    }
    this.controls.target.clampScalar(-PAN_LIMIT, PAN_LIMIT);
    this.controls.update();
  }

  preset(name: CameraPreset): void {
    const [x, y, z] = PRESET_POSITIONS[name];
    this.flyTo(new THREE.Vector3(x, y, z));
  }

  dispose(): void {
    this.controls.removeEventListener("start", this.cancelFly);
    this.controls.dispose();
  }
}
