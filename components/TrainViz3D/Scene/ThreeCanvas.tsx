"use client";

import * as THREE from "three";
import { useCallback, useEffect, useRef } from "react";
import { PALETTES, VizTheme } from "../lib/theme";

export interface ThreeSceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
}

interface ThreeCanvasProps {
  theme: VizTheme;
  /** Called once the WebGL scene exists. */
  onSceneReady: (handle: ThreeSceneHandle) => void;
  /** Called when the scene is torn down (unmount / context loss). */
  onSceneDispose?: () => void;
  /** Per-frame hook, `delta` in seconds. */
  onAnimate?: (delta: number) => void;
  /** WebGL unavailable or the GPU context was lost. */
  onError?: (message: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Thin, framework-agnostic WebGL host: renderer + scene + camera + RAF loop +
 * resize handling. Everything drawn inside is owned (and disposed) by the caller.
 */
export default function ThreeCanvas({
  theme,
  onSceneReady,
  onSceneDispose,
  onAnimate,
  onError,
  className,
  style,
}: ThreeCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Latest callbacks without re-running the setup effect.
  const cbRef = useRef({ onSceneReady, onSceneDispose, onAnimate, onError });
  cbRef.current = { onSceneReady, onSceneDispose, onAnimate, onError };
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const handleResize = useCallback((camera: THREE.PerspectiveCamera) => {
    const mount = mountRef.current;
    const renderer = rendererRef.current;
    if (!mount || !renderer) return;
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      cbRef.current.onError?.("WebGL is not available in this browser.");
      return;
    }
    const bg = PALETTES[themeRef.current].sceneBg;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(bg, 1);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bg);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.01, 100);
    camera.position.set(2.5, 1.8, 2.5);
    camera.lookAt(0, 0, 0);

    const canvas = renderer.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      cbRef.current.onError?.("The 3D graphics context was lost.");
    };
    canvas.addEventListener("webglcontextlost", onLost);

    cbRef.current.onSceneReady({ scene, camera, renderer, canvas });

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      cbRef.current.onAnimate?.(delta);
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(loop);

    const observer = new ResizeObserver(() => handleResize(camera));
    observer.observe(mount);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      cbRef.current.onSceneDispose?.();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      if (canvas.parentNode === mount) mount.removeChild(canvas);
      sceneRef.current = null;
      rendererRef.current = null;
    };
  }, [handleResize]);

  // Re-tint background on theme change (no re-init).
  useEffect(() => {
    const bg = PALETTES[theme].sceneBg;
    if (sceneRef.current) sceneRef.current.background = new THREE.Color(bg);
    rendererRef.current?.setClearColor(bg, 1);
  }, [theme]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: "100%", height: "100%", position: "relative", ...style }}
    />
  );
}
