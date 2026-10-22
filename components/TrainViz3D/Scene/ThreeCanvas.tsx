"use client";

import * as THREE from "three";
import { useEffect, useRef, useCallback } from "react";

export interface ThreeSceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
}

interface ThreeCanvasProps {
  theme: "light" | "dark";
  onSceneReady: (handle: ThreeSceneHandle) => void;
  onAnimate?: (delta: number) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function ThreeCanvas({
  theme,
  onSceneReady,
  onAnimate,
  className,
  style,
}: ThreeCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const onAnimateRef = useRef(onAnimate);
  onAnimateRef.current = onAnimate;

  const bgColor = theme === "dark" ? "#050a14" : "#f0f6ff";

  const handleResize = useCallback(() => {
    const mount = mountRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!mount || !renderer || !camera) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(bgColor, 1);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── Scene ─────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);
    sceneRef.current = scene;

    // ── Camera ────────────────────────────────────────────────────────────
    const aspect = mount.clientWidth / mount.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.01, 100);
    camera.position.set(2.5, 1.8, 2.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // ── Notify parent ────────────────────────────────────────────────────
    onSceneReady({ scene, camera, renderer, canvas: renderer.domElement });

    // ── Animate loop ─────────────────────────────────────────────────────
    const animate = (time: number) => {
      frameIdRef.current = requestAnimationFrame(animate);
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      onAnimateRef.current?.(delta);
      renderer.render(scene, camera);
    };
    frameIdRef.current = requestAnimationFrame(animate);

    // ── ResizeObserver ────────────────────────────────────────────────────
    const observer = new ResizeObserver(handleResize);
    observer.observe(mount);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      observer.disconnect();
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update background when theme changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(bgColor);
    }
    if (rendererRef.current) {
      rendererRef.current.setClearColor(bgColor, 1);
    }
  }, [bgColor]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: "100%", height: "100%", position: "relative", ...style }}
    />
  );
}
