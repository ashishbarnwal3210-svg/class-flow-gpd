import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThemeStore } from '../../lib/theme-store';

export function AcademicCanvas3D({ interactive = true }: { interactive?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      return; // WebGL not supported, fallback gracefully
    }

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 340;

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    // Main Cluster Group
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    const isDark = theme === 'dark';

    // Lights
    const ambientLight = new THREE.AmbientLight(isDark ? 0x223344 : 0xffffff, isDark ? 1.4 : 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(isDark ? 0x6ee7b7 : 0x7c9a82, isDark ? 2.2 : 2.0);
    dirLight.position.set(5, 6, 6);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(isDark ? 0x38bdf8 : 0xdf9961, 2.5, 12);
    pointLight.position.set(-4, -2, 4);
    scene.add(pointLight);

    // 1. Procedural 3D Academic Book
    const bookGroup = new THREE.Group();

    // Cover Leather/Hardcover
    const coverMaterial = new THREE.MeshStandardMaterial({
      color: isDark ? 0x1e293b : 0x3d332a,
      roughness: 0.35,
      metalness: 0.25,
    });
    const pagesMaterial = new THREE.MeshStandardMaterial({
      color: isDark ? 0xd1d5db : 0xfcf9ee,
      roughness: 0.7,
      metalness: 0.05,
    });
    const goldAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.2,
    });

    // Book Covers (Front and Back)
    const coverGeo = new THREE.BoxGeometry(1.6, 2.1, 0.05);
    const frontCover = new THREE.Mesh(coverGeo, coverMaterial);
    frontCover.position.set(0, 0, 0.18);
    bookGroup.add(frontCover);

    const backCover = new THREE.Mesh(coverGeo, coverMaterial);
    backCover.position.set(0, 0, -0.18);
    bookGroup.add(backCover);

    // Spine
    const spineGeo = new THREE.BoxGeometry(0.06, 2.1, 0.41);
    const spine = new THREE.Mesh(spineGeo, coverMaterial);
    spine.position.set(-0.8, 0, 0);
    bookGroup.add(spine);

    // Paper Pages Block
    const pagesGeo = new THREE.BoxGeometry(1.5, 1.98, 0.32);
    const pagesBlock = new THREE.Mesh(pagesGeo, pagesMaterial);
    pagesBlock.position.set(0.04, 0, 0);
    bookGroup.add(pagesBlock);

    // Gold Emblem on Cover
    const emblemGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.02, 16);
    const emblem = new THREE.Mesh(emblemGeo, goldAccentMaterial);
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, 0.2, 0.21);
    bookGroup.add(emblem);

    bookGroup.position.set(-1.3, -0.1, 0.2);
    bookGroup.rotation.set(0.3, 0.5, -0.2);
    mainGroup.add(bookGroup);

    // 2. 3D Graduation Cap (Mortarboard)
    const capGroup = new THREE.Group();
    const capMaterial = new THREE.MeshStandardMaterial({
      color: isDark ? 0x0f172a : 0x23201d,
      roughness: 0.4,
      metalness: 0.3,
    });

    // Diamond Top Board
    const boardGeo = new THREE.BoxGeometry(1.4, 0.06, 1.4);
    const board = new THREE.Mesh(boardGeo, capMaterial);
    board.rotation.y = Math.PI / 4;
    capGroup.add(board);

    // Skull Cap (Bottom Cylinder)
    const skullGeo = new THREE.CylinderGeometry(0.48, 0.42, 0.4, 24);
    const skull = new THREE.Mesh(skullGeo, capMaterial);
    skull.position.set(0, -0.22, 0);
    capGroup.add(skull);

    // Button on top
    const buttonGeo = new THREE.SphereGeometry(0.07, 16, 16);
    const button = new THREE.Mesh(buttonGeo, goldAccentMaterial);
    button.position.set(0, 0.05, 0);
    capGroup.add(button);

    // Tassel Cord & Hanging Ribbon
    const tasselCordGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.65, 8);
    const tasselCord = new THREE.Mesh(tasselCordGeo, goldAccentMaterial);
    tasselCord.position.set(0.35, -0.25, 0.35);
    tasselCord.rotation.z = -0.5;
    capGroup.add(tasselCord);

    capGroup.position.set(1.4, 0.6, 0.3);
    capGroup.rotation.set(-0.25, -0.4, 0.15);
    mainGroup.add(capGroup);

    // 3. Central Glowing Knowledge Node (Icosahedron + Orbital Rings)
    const nodeGroup = new THREE.Group();
    const crystalGeo = new THREE.IcosahedronGeometry(0.55, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x10b981 : 0x688d71,
      roughness: 0.15,
      metalness: 0.8,
      wireframe: false,
    });
    const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
    nodeGroup.add(crystalMesh);

    const wireGeo = new THREE.IcosahedronGeometry(0.65, 0);
    const wireMat = new THREE.MeshBasicMaterial({
      color: isDark ? 0x38bdf8 : 0xdfaf78,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    nodeGroup.add(wireMesh);

    // Orbital Rings
    const ringGeo1 = new THREE.TorusGeometry(1.05, 0.02, 12, 64);
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: isDark ? 0x38bdf8 : 0x93a896,
      metalness: 0.9,
      roughness: 0.1,
    });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.rotation.x = Math.PI / 3;
    nodeGroup.add(ringMesh1);

    const ringGeo2 = new THREE.TorusGeometry(1.2, 0.018, 12, 64);
    const ringMesh2 = new THREE.Mesh(ringGeo2, goldAccentMaterial);
    ringMesh2.rotation.y = Math.PI / 3;
    nodeGroup.add(ringMesh2);

    nodeGroup.position.set(0.1, -0.4, -0.3);
    mainGroup.add(nodeGroup);

    // 4. Background Star / Particle Field
    const particleCount = 140;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (Math.random() - 0.5) * 12;
      particlePos[i + 1] = (Math.random() - 0.5) * 8;
      particlePos[i + 2] = (Math.random() - 0.5) * 6;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.045,
      color: isDark ? 0x93c5fd : 0x829785,
      transparent: true,
      opacity: isDark ? 0.65 : 0.45,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // Mouse & Touch interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    };

    window.addEventListener('mousemove', onPointerMove, { passive: true });
    container.addEventListener('touchmove', onPointerMove, { passive: true });

    // Resize Handler
    const onResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 400;
      const newH = container.clientHeight || 340;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Damped Lerp rotation
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      mainGroup.rotation.y = targetX * 0.45;
      mainGroup.rotation.x = -targetY * 0.35;

      // Floating wave motion
      bookGroup.position.y = -0.1 + Math.sin(elapsed * 1.4) * 0.08;
      bookGroup.rotation.y = 0.5 + Math.cos(elapsed * 1.1) * 0.06;

      capGroup.position.y = 0.6 + Math.cos(elapsed * 1.6) * 0.07;
      capGroup.rotation.z = 0.15 + Math.sin(elapsed * 1.3) * 0.05;

      // Knowledge Core Spin
      crystalMesh.rotation.y = elapsed * 0.5;
      crystalMesh.rotation.x = elapsed * 0.3;
      wireMesh.rotation.y = -elapsed * 0.4;
      ringMesh1.rotation.z = elapsed * 0.6;
      ringMesh2.rotation.x = elapsed * 0.5;

      // Twinkle particles slowly
      particleSystem.rotation.y = elapsed * 0.04;
      particleSystem.rotation.x = elapsed * 0.02;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onPointerMove);
      container.removeEventListener('touchmove', onPointerMove);
      resizeObserver.disconnect();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
      coverGeo.dispose();
      spineGeo.dispose();
      pagesGeo.dispose();
      emblemGeo.dispose();
      boardGeo.dispose();
      skullGeo.dispose();
      buttonGeo.dispose();
      tasselCordGeo.dispose();
      crystalGeo.dispose();
      wireGeo.dispose();
      ringGeo1.dispose();
      ringGeo2.dispose();
      particleGeo.dispose();
      coverMaterial.dispose();
      pagesMaterial.dispose();
      goldAccentMaterial.dispose();
      capMaterial.dispose();
      crystalMat.dispose();
      wireMat.dispose();
      ringMat1.dispose();
      particleMat.dispose();
    };
  }, [theme, interactive]);

  return (
    <div
      ref={containerRef}
      className="academic-3d-viewport"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '340px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        touchAction: 'none',
      }}
    />
  );
}
