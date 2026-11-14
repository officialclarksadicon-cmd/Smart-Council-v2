import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ThemeMode } from '../App';
import { siteConfig } from '../siteConfig';
import { resolveImageUrl, stripImageFramingHash } from '../utils/imagekit';

interface HeroOffice3DProps {
  theme: ThemeMode;
  customLogoUrl?: string;
  isActive?: boolean;
  onToggleTheme?: () => void;
}

/**
 * Cached software WebGL detection so it only runs once per browser session.
 */
let cachedSoftwareGl: boolean | null = null;
function detectSoftwareGl(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl =
      /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = false;
    return false;
  }
}

/**
 * Cached procedural textures so navigating or re-rendering never regenerates 2D canvases.
 */
let sharedWoodTex: THREE.CanvasTexture | null = null;
let sharedBrickTex: THREE.CanvasTexture | null = null;
let sharedLightPoolTex: THREE.CanvasTexture | null = null;

function getWoodFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  if (sharedWoodTex) return sharedWoodTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#8c583a';
    ctx.fillRect(0, 0, 512, 512);

    const plankRows = 8;
    const rowH = 512 / plankRows;
    const tones = ['#945f40', '#845135', '#9d6747', '#7c4b30', '#8f5a3c'];

    for (let r = 0; r < plankRows; r++) {
      const y = r * rowH;
      const offset = (r % 2) * 128;
      for (let c = -1; c < 4; c++) {
        const x = c * 170 + offset;
        ctx.fillStyle = tones[(r * 3 + c + 10) % tones.length];
        ctx.fillRect(x, y, 168, rowH - 2);

        ctx.strokeStyle = 'rgba(52, 28, 14, 0.22)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + rowH * 0.35);
        ctx.lineTo(x + 158, y + rowH * 0.42);
        ctx.moveTo(x + 16, y + rowH * 0.7);
        ctx.lineTo(x + 148, y + rowH * 0.66);
        ctx.stroke();
      }
      ctx.fillStyle = '#4e2c18';
      ctx.fillRect(0, y + rowH - 2, 512, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAnisotropy;
  sharedWoodTex = tex;
  return tex;
}

function getBrickWallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  if (sharedBrickTex) return sharedBrickTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#4a2b22';
    ctx.fillRect(0, 0, 512, 512);

    const rows = 16;
    const cols = 8;
    const brickH = 512 / rows;
    const brickW = 512 / cols;
    const brickColors = ['#8c3f2b', '#7b3423', '#9b4933', '#6e2d1e', '#853a28'];

    for (let r = 0; r < rows; r++) {
      const y = r * brickH;
      const shift = (r % 2) * (brickW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * brickW + shift;
        ctx.fillStyle = brickColors[(r * 5 + c + 8) % brickColors.length];
        ctx.fillRect(x + 2, y + 2, brickW - 4, brickH - 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1.4);
  tex.anisotropy = maxAnisotropy;
  sharedBrickTex = tex;
  return tex;
}

function getLightPoolTexture(): THREE.CanvasTexture {
  if (sharedLightPoolTex) return sharedLightPoolTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 124);
    grad.addColorStop(0, 'rgba(255, 224, 150, 0.72)');
    grad.addColorStop(0.45, 'rgba(255, 198, 105, 0.28)');
    grad.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedLightPoolTex = tex;
  return tex;
}

/**
 * Creates a high-resolution SLAC Supreme Student Council Emblem texture
 * that shifts to the opposite contrast when switching between Light (Day) and Dark (Night) themes.
 */
function createContrastAwareSlacLogoTexture(
  logoUrl: string | undefined,
  maxAnisotropy: number,
  initialIsNight: boolean,
  onImageLoaded?: (img: HTMLImageElement) => void
): {
  texture: THREE.CanvasTexture;
  updateContrast: (isNight: boolean) => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  let loadedImg: HTMLImageElement | null = null;
  let currentIsNight = initialIsNight;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;

  const drawSeal = (isNight: boolean) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, 512, 512);

    const discBg = isNight ? '#141820' : '#f5f3ee';
    const primaryInk = isNight ? '#f5f3ee' : '#171816';
    const accentGreen = isNight ? '#3ddc97' : '#2b5b42';
    const accentGold = isNight ? '#facc15' : '#8e631d';

    ctx.fillStyle = discBg;
    ctx.beginPath();
    ctx.arc(256, 256, 248, 0, Math.PI * 2);
    ctx.fill();

    if (loadedImg) {
      const off = document.createElement('canvas');
      off.width = 480;
      off.height = 480;
      const offCtx = off.getContext('2d');
      if (offCtx) {
        offCtx.clearRect(0, 0, 480, 480);
        offCtx.filter = isNight
          ? 'brightness(0) invert(1)'
          : 'brightness(0)';
        offCtx.drawImage(loadedImg, 0, 0, 480, 480);

        ctx.save();
        ctx.beginPath();
        ctx.arc(256, 256, 238, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(off, 16, 16, 480, 480);
        ctx.restore();
      }
    } else {
      ctx.strokeStyle = primaryInk;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(256, 256, 236, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = accentGreen;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(256, 256, 218, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = primaryInk;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(256, 256, 152, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = accentGold;
      for (let s = -2; s <= 2; s++) {
        const ang = -Math.PI / 2 + s * 0.24;
        const sx = 256 + Math.cos(ang) * 124;
        const sy = 256 + Math.sin(ang) * 124;
        ctx.beginPath();
        ctx.arc(sx, sy, 6.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const drawFigure = (
        cx: number,
        cy: number,
        scale: number,
        color: string
      ) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy - 34 * scale, 14 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 12 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 28 * scale, cy - 16 * scale);
        ctx.lineTo(cx, cy - 8 * scale);
        ctx.lineTo(cx + 28 * scale, cy - 16 * scale);
        ctx.stroke();

        ctx.fillRect(cx - 12 * scale, cy - 14 * scale, 24 * scale, 44 * scale);
      };

      drawFigure(202, 268, 0.86, accentGreen);
      drawFigure(310, 268, 0.86, accentGreen);
      drawFigure(256, 260, 1.0, primaryInk);

      ctx.fillStyle = primaryInk;
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SUPREME STUDENT COUNCIL', 256, 76);
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText('ST. LOUIS ANNE COLLEGES', 256, 448);
      ctx.fillStyle = accentGold;
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.fillText('1986', 256, 366);
    }

    tex.needsUpdate = true;
  };

  drawSeal(currentIsNight);

  const activeInput = logoUrl || siteConfig.brand.customLogoUrl;
  const resolvedSrc =
    resolveImageUrl(activeInput, 'w-512,c-at_max,f-auto,q-95') ||
    stripImageFramingHash(activeInput);

  if (resolvedSrc) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImg = img;
      drawSeal(currentIsNight);
      onImageLoaded?.(img);
    };
    img.src = resolvedSrc;
  }

  return {
    texture: tex,
    updateContrast: (isNight: boolean) => {
      if (currentIsNight !== isNight) {
        currentIsNight = isNight;
        drawSeal(isNight);
      }
    },
  };
}

/**
 * Interactive 3D Isometric Council Office Diorama:
 * - Uses transparent WebGL alpha (`alpha: true`) so the 3D Isometric Office sits cleanly ABOVE
 *   the body section without any clipping or solid cutoff at the bottom.
 * - Automatically pauses its WebGL animation loop when the user navigates to another page (`!isActive`)
 *   or scrolls past the Hero section (`IntersectionObserver`), eliminating all CPU/GPU overhead and
 *   making navigation back to Home instantaneous.
 */
export function HeroOffice3D({
  theme,
  customLogoUrl,
  isActive = true,
}: HeroOffice3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<ThemeMode>(theme);
  const isActiveRef = useRef<boolean>(isActive);
  const resumeLoopRef = useRef<(() => void) | null>(null);
  const logoContrastUpdaterRef = useRef<((isNight: boolean) => void) | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    themeRef.current = theme;
    logoContrastUpdaterRef.current?.(theme === 'dark');
  }, [theme]);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (isActive) {
      resumeLoopRef.current?.();
    }
  }, [isActive]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 680;

    // Transparent WebGL scene (`scene.background = null`) so the 3D Office sits ABOVE the body
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(32, width / height, 0.5, 140);
    const defaultCamPos = new THREE.Vector3(14.5, 10.4, 14.5);
    const defaultTarget = new THREE.Vector3(0, 1.8, 0);
    camera.position.copy(defaultCamPos);
    camera.lookAt(defaultTarget);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75)
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'pan-y';
    container.appendChild(renderer.domElement);

    // Studio Environment Map (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const woodTex = getWoodFloorTexture(maxAniso);
    const brickTex = getBrickWallTexture(maxAniso);
    const lightPoolTex = getLightPoolTexture();

    let loadedLogoImg: HTMLImageElement | null = null;
    const { texture: logoTex, updateContrast: updateLogoContrast } =
      createContrastAwareSlacLogoTexture(
        customLogoUrl,
        maxAniso,
        themeRef.current === 'dark',
        (img) => {
          loadedLogoImg = img;
        }
      );
    logoContrastUpdaterRef.current = updateLogoContrast;

    // Optimized 256x128 Wall Smart-Screen Canvas Texture (updated at 4Hz)
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 256;
    screenCanvas.height = 128;
    const screenCtx = screenCanvas.getContext('2d');
    const screenTex = new THREE.CanvasTexture(screenCanvas);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    screenTex.anisotropy = maxAniso;

    const drawSmartBoard = (t: number, isNight: boolean) => {
      if (!screenCtx) return;
      screenCtx.fillStyle = isNight ? '#111622' : '#182030';
      screenCtx.fillRect(0, 0, 256, 128);

      // Header strip with SLAC SSC branding
      screenCtx.fillStyle = '#243046';
      screenCtx.fillRect(10, 8, 236, 17);
      screenCtx.fillStyle = '#e05a47';
      screenCtx.beginPath();
      screenCtx.arc(19, 16.5, 2.5, 0, Math.PI * 2);
      screenCtx.fill();
      screenCtx.fillStyle = '#e8aa42';
      screenCtx.beginPath();
      screenCtx.arc(27, 16.5, 2.5, 0, Math.PI * 2);
      screenCtx.fill();
      screenCtx.fillStyle = '#4ba368';
      screenCtx.beginPath();
      screenCtx.arc(35, 16.5, 2.5, 0, Math.PI * 2);
      screenCtx.fill();

      if (loadedLogoImg) {
        screenCtx.save();
        screenCtx.filter = 'brightness(0) invert(1)';
        screenCtx.drawImage(loadedLogoImg, 45, 10, 13, 13);
        screenCtx.restore();
      }

      screenCtx.fillStyle = '#f5f3ee';
      screenCtx.font = 'bold 7px Inter, sans-serif';
      screenCtx.fillText('SLAC SUPREME STUDENT COUNCIL', 62, 19);

      // Animated Bar Charts
      const barColors = ['#e05a47', '#e8aa42', '#4ba368', '#56b4e9', '#e8985e'];
      const baseHeights = [52, 70, 46, 63, 57];
      for (let i = 0; i < 5; i++) {
        const wave = Math.sin(t * 2.2 + i * 1.1) * 8;
        const h = Math.max(18, baseHeights[i] + wave);
        const bx = 23 + i * 26;
        const by = 113 - h;
        screenCtx.fillStyle = barColors[i];
        screenCtx.fillRect(bx, by, 16, h);
      }

      // Right side KPI cards on smart board
      screenCtx.fillStyle = '#222d42';
      screenCtx.fillRect(163, 33, 82, 34);
      screenCtx.fillRect(163, 75, 82, 37);

      screenCtx.fillStyle = '#4ba368';
      screenCtx.fillRect(171, 43, 48, 6);
      screenCtx.fillStyle = '#94a3b8';
      screenCtx.fillRect(171, 53, 62, 4);

      screenCtx.fillStyle = '#e8aa42';
      screenCtx.fillRect(171, 85, 56, 6);
      screenCtx.fillStyle = '#94a3b8';
      screenCtx.fillRect(171, 95, 44, 4);

      screenTex.needsUpdate = true;
    };
    drawSmartBoard(0, themeRef.current === 'dark');

    // OrbitControls for responsive mouse & touch dragging
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(defaultTarget);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI * 0.16;
    controls.maxPolarAngle = Math.PI * 0.45;
    controls.minAzimuthAngle = -Math.PI * 0.12;
    controls.maxAzimuthAngle = Math.PI * 0.62;
    controls.rotateSpeed = 0.72;

    // Pendulum Lamp Physics state
    let lampAngleX = 0.06;
    let lampAngleZ = -0.05;
    let lampVelX = 0;
    let lampVelZ = 0;
    let prevAzimuth = controls.getAzimuthalAngle();
    let prevPolar = controls.getPolarAngle();

    let userInteracting = false;
    const onControlStart = () => {
      userInteracting = true;
      setIsDragging(true);
    };
    const onControlEnd = () => {
      userInteracting = false;
      setIsDragging(false);
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('end', onControlEnd);

    // Master Diorama Group
    // - On Desktop (>= 1024px): shifted to the right (+X, -Z) and elevated so the entire 3D office
    //   sits cleanly beside the transparent blur Hero card and above the body.
    // - On Mobile (< 1024px): elevated in the upper half of the Hero stage so the entire 3D office
    //   is visible above and behind the transparent blur Hero card.
    const diorama = new THREE.Group();
    const updateDioramaPlacement = (viewportW: number, viewportH: number) => {
      if (viewportW >= 1024) {
        diorama.position.set(2.35, -0.05, -2.35);
        diorama.scale.setScalar(0.95);
        camera.fov = 31;
      } else if (viewportW >= 640) {
        diorama.position.set(0.15, 1.25, -0.15);
        diorama.scale.setScalar(0.84);
        camera.fov = 34;
      } else {
        diorama.position.set(0.15, 1.48, -0.15);
        diorama.scale.setScalar(0.78);
        camera.fov = 36;
      }
      camera.aspect = viewportW / Math.max(1, viewportH);
      camera.updateProjectionMatrix();
    };
    updateDioramaPlacement(width, height);
    scene.add(diorama);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      materials.push(m);
      return m;
    };

    // =========================================================================
    // SKY ENVIRONMENT: SUNNY SKY WITH 3D CLOUDS & SUN (DAY) + MOON & STARS (NIGHT)
    // =========================================================================
    const skyWorldGroup = new THREE.Group();
    diorama.add(skyWorldGroup);

    // 1. 3D Glowing Sun (Visible in Day Mode / Light Theme)
    const sunOrbGroup = new THREE.Group();
    sunOrbGroup.position.set(-6.4, 7.2, -7.2);
    const sunCoreMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfff59d,
        transparent: true,
        opacity: themeRef.current === 'dark' ? 0 : 1,
      })
    );
    const sunHaloMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: themeRef.current === 'dark' ? 0 : 0.34,
        depthWrite: false,
      })
    );
    const sunCore = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.95, 18, 18)),
      sunCoreMat
    );
    const sunHalo = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(1.65, 18, 18)),
      sunHaloMat
    );
    sunOrbGroup.add(sunCore, sunHalo);
    skyWorldGroup.add(sunOrbGroup);

    // 2. 3D Glowing Moon (Visible in Night Mode / Dark Theme)
    const moonOrbGroup = new THREE.Group();
    moonOrbGroup.position.set(-6.2, 7.1, -7.0);
    const moonCoreMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfef9c3,
        transparent: true,
        opacity: themeRef.current === 'dark' ? 1 : 0,
      })
    );
    const moonHaloMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: themeRef.current === 'dark' ? 0.28 : 0,
        depthWrite: false,
      })
    );
    const moonCore = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.82, 18, 18)),
      moonCoreMat
    );
    const moonHalo = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(1.48, 18, 18)),
      moonHaloMat
    );
    moonOrbGroup.add(moonCore, moonHalo);
    skyWorldGroup.add(moonOrbGroup);

    // 3. Twinkling 3D Starfield (Visible in Night Mode)
    const starCount = 85;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const angle = -Math.PI * 0.15 + Math.random() * Math.PI * 1.15;
      const radius = 12 + Math.random() * 14;
      starPositions[i * 3] = -Math.cos(angle) * radius;
      starPositions[i * 3 + 1] = 3.2 + Math.random() * 9.5;
      starPositions[i * 3 + 2] = -Math.sin(angle) * radius;
    }
    const starGeo = trackGeo(new THREE.BufferGeometry());
    starGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(starPositions, 3)
    );
    const starMat = trackMat(
      new THREE.PointsMaterial({
        color: 0xfef08a,
        size: 0.24,
        transparent: true,
        opacity: themeRef.current === 'dark' ? 0.9 : 0,
        depthWrite: false,
      })
    );
    const starField = new THREE.Points(starGeo, starMat);
    skyWorldGroup.add(starField);

    // 4. Drifting 3D Puffy Clouds
    const cloudMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: themeRef.current === 'dark' ? 0x283856 : 0xffffff,
        emissive: new THREE.Color(
          themeRef.current === 'dark' ? 0x111a2e : 0xdbeafe
        ),
        emissiveIntensity: 0.28,
        roughness: 0.85,
        metalness: 0.02,
      })
    );

    interface DriftingCloud {
      group: THREE.Group;
      baseY: number;
      speed: number;
      phase: number;
    }
    const driftingClouds: DriftingCloud[] = [];

    const createPuffyCloud = (scale: number): THREE.Group => {
      const cGroup = new THREE.Group();
      const puffs = [
        { x: 0, y: 0.18, z: 0, r: 0.68 },
        { x: -0.58, y: 0.02, z: 0.08, r: 0.52 },
        { x: 0.62, y: 0.04, z: -0.06, r: 0.54 },
        { x: -0.25, y: 0.28, z: -0.18, r: 0.48 },
        { x: 0.28, y: 0.24, z: 0.18, r: 0.46 },
        { x: -0.95, y: -0.08, z: 0, r: 0.38 },
        { x: 0.98, y: -0.06, z: 0.04, r: 0.4 },
      ];
      puffs.forEach((p) => {
        const mesh = new THREE.Mesh(
          trackGeo(new THREE.SphereGeometry(p.r, 12, 12)),
          cloudMat
        );
        mesh.position.set(p.x, p.y, p.z);
        cGroup.add(mesh);
      });
      cGroup.scale.setScalar(scale);
      return cGroup;
    };

    const cloudConfigs = [
      { x: -7.2, y: 6.8, z: -6.4, s: 1.0, speed: 0.22, rotY: 0.35 },
      { x: -2.2, y: 7.4, z: -7.2, s: 1.15, speed: 0.18, rotY: 0.12 },
      { x: 2.8, y: 6.9, z: -6.8, s: 0.92, speed: 0.25, rotY: -0.15 },
      { x: -6.8, y: 3.8, z: -1.7, s: 0.85, speed: 0.16, rotY: Math.PI / 2 },
      { x: -7.0, y: 4.1, z: 1.8, s: 0.92, speed: 0.19, rotY: Math.PI / 2 },
    ];

    cloudConfigs.forEach((cfg, idx) => {
      const cloud = createPuffyCloud(cfg.s);
      cloud.position.set(cfg.x, cfg.y, cfg.z);
      cloud.rotation.y = cfg.rotY;
      skyWorldGroup.add(cloud);
      driftingClouds.push({
        group: cloud,
        baseY: cfg.y,
        speed: cfg.speed,
        phase: idx * 1.3,
      });
    });

    // Shared Office Materials
    const floorMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.55,
        metalness: 0.05,
      })
    );
    const baseTrimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd8cfc2,
        roughness: 0.7,
        metalness: 0.05,
      })
    );
    const outlineDarkMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x231f20,
        roughness: 0.8,
        metalness: 0.1,
      })
    );
    const brickWallMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: brickTex,
        roughness: 0.85,
        metalness: 0.02,
      })
    );
    const rightWallMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf4f1ea,
        roughness: 0.75,
        metalness: 0.02,
      })
    );
    const windowPaneMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        emissive: new THREE.Color(0x7dd3fc),
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.26,
        roughness: 0.15,
        metalness: 0.1,
        depthWrite: false,
      })
    );
    const deskWoodMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xdf9b52,
        roughness: 0.5,
        metalness: 0.06,
      })
    );
    const cabinetOrangeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe07a3c,
        roughness: 0.48,
        metalness: 0.08,
      })
    );
    const whitePanelMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf5f3ee,
        roughness: 0.4,
        metalness: 0.05,
      })
    );
    const darkMetalMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2c323d,
        roughness: 0.35,
        metalness: 0.75,
      })
    );
    const chairTealMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2d6a54,
        roughness: 0.6,
        metalness: 0.08,
      })
    );
    const chairAmberMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc97b42,
        roughness: 0.6,
        metalness: 0.08,
      })
    );
    const monitorScreenMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: new THREE.Color(0x38bdf8),
        emissiveIntensity: 0.65,
        roughness: 0.2,
        metalness: 0.1,
      })
    );
    const lampBulbMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfff7d6,
        emissive: new THREE.Color(0xffb74d),
        emissiveIntensity: 1.8,
        roughness: 0.15,
      })
    );
    const volumetricBeamMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffe099,
        transparent: true,
        opacity: themeRef.current === 'dark' ? 0.13 : 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const dynamicLightPoolMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: lightPoolTex,
        transparent: true,
        opacity: themeRef.current === 'dark' ? 0.58 : 0.22,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    const foliageMat1 = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x4ba368,
        roughness: 0.65,
        metalness: 0.02,
      })
    );
    const foliageMat2 = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x62b678,
        roughness: 0.6,
        metalness: 0.02,
      })
    );
    const logoFaceMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: logoTex,
        roughness: 0.32,
        metalness: 0.08,
      })
    );
    const goldRimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xd9a441,
        roughness: 0.3,
        metalness: 0.65,
      })
    );

    // Character Materials for 3D Council Officers
    const skinToneMats = [
      trackMat(
        new THREE.MeshStandardMaterial({ color: 0xf1c29b, roughness: 0.55 })
      ),
      trackMat(
        new THREE.MeshStandardMaterial({ color: 0xe5b187, roughness: 0.55 })
      ),
      trackMat(
        new THREE.MeshStandardMaterial({ color: 0xd99e73, roughness: 0.55 })
      ),
    ];
    const hairMats = [
      trackMat(
        new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.7 })
      ),
      trackMat(
        new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.7 })
      ),
      trackMat(
        new THREE.MeshStandardMaterial({ color: 0x262322, roughness: 0.7 })
      ),
    ];
    const jacketGreenMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x2b5b42, roughness: 0.55 })
    );
    const jacketAmberMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xd98246, roughness: 0.55 })
    );
    const jacketNavyMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x27364f, roughness: 0.55 })
    );
    const jacketCreamMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xede6d6, roughness: 0.55 })
    );

    // 1. ISOMETRIC CUTAWAY ROOM SHELL
    const roomSize = 8.4;
    const wallHeight = 5.4;
    const wallThick = 0.36;

    const platformMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(roomSize + 0.36, 0.32, roomSize + 0.36)),
      baseTrimMat
    );
    platformMesh.position.set(0, -0.18, 0);
    platformMesh.receiveShadow = true;
    diorama.add(platformMesh);

    const floorMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(roomSize, 0.14, roomSize)),
      floorMat
    );
    floorMesh.position.set(0, 0, 0);
    floorMesh.receiveShadow = true;
    diorama.add(floorMesh);

    // Left Wall (-X side) with 2 Industrial Loft Windows
    const leftWallGroup = new THREE.Group();
    leftWallGroup.position.set(-roomSize / 2 + wallThick / 2, 0, 0);
    diorama.add(leftWallGroup);

    const sillMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(wallThick, 1.15, roomSize)),
      brickWallMat
    );
    sillMesh.position.set(0, 1.15 / 2, 0);
    sillMesh.castShadow = true;
    sillMesh.receiveShadow = true;
    leftWallGroup.add(sillMesh);

    const lintelMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(wallThick, 0.85, roomSize)),
      brickWallMat
    );
    lintelMesh.position.set(0, wallHeight - 0.85 / 2, 0);
    lintelMesh.castShadow = true;
    lintelMesh.receiveShadow = true;
    leftWallGroup.add(lintelMesh);

    const pierPositionsZ = [-3.45, 0, 3.45];
    const pierWidths = [1.5, 1.3, 1.5];
    pierPositionsZ.forEach((pz, idx) => {
      const pier = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(wallThick, 3.4, pierWidths[idx])),
        brickWallMat
      );
      pier.position.set(0, 1.15 + 1.7, pz);
      pier.castShadow = true;
      pier.receiveShadow = true;
      leftWallGroup.add(pier);
    });

    [-1.72, 1.72].forEach((winZ) => {
      const winGroup = new THREE.Group();
      winGroup.position.set(0, 2.85, winZ);

      const pane = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.06, 3.25, 2.1)),
        windowPaneMat
      );
      winGroup.add(pane);

      const vBar = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.14, 3.25, 0.08)),
        outlineDarkMat
      );
      winGroup.add(vBar);

      [-0.75, 0.15, 1.0].forEach((hy) => {
        const hBar = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.14, 0.08, 2.1)),
          outlineDarkMat
        );
        hBar.position.y = hy;
        winGroup.add(hBar);
      });

      const blind = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.22, 0.36, 2.12)),
        deskWoodMat
      );
      blind.position.set(0.08, 1.48, 0);
      winGroup.add(blind);

      leftWallGroup.add(winGroup);
    });

    const lightShaftMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffe8a3,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    [-1.72, 1.72].forEach((winZ) => {
      const shaft = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(2.6, 1.95)),
        lightShaftMat
      );
      shaft.rotation.x = -Math.PI / 2;
      shaft.position.set(-2.15, 0.08, winZ + 0.25);
      diorama.add(shaft);
    });

    // Right Wall (-Z side)
    const rightWallMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(roomSize, wallHeight, wallThick)),
      rightWallMat
    );
    rightWallMesh.position.set(
      0,
      wallHeight / 2,
      -roomSize / 2 + wallThick / 2
    );
    rightWallMesh.castShadow = true;
    rightWallMesh.receiveShadow = true;
    diorama.add(rightWallMesh);

    const leftWallCap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(wallThick + 0.06, 0.1, roomSize + 0.04)),
      outlineDarkMat
    );
    leftWallCap.position.set(
      -roomSize / 2 + wallThick / 2,
      wallHeight + 0.05,
      0
    );
    diorama.add(leftWallCap);

    const rightWallCap = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(roomSize + 0.04, 0.1, wallThick + 0.06)),
      outlineDarkMat
    );
    rightWallCap.position.set(
      0,
      wallHeight + 0.05,
      -roomSize / 2 + wallThick / 2
    );
    diorama.add(rightWallCap);

    // 2. OFFICIAL SLAC SSC 3D WALL SEAL PLAQUE + SMART PRESENTATION BOARD + CREDENZA
    const wallSealGroup = new THREE.Group();
    wallSealGroup.position.set(-2.35, 3.6, -roomSize / 2 + wallThick + 0.06);
    const sealRim = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.76, 0.76, 0.1, 32)),
      goldRimMat
    );
    sealRim.rotation.x = Math.PI / 2;
    sealRim.castShadow = true;
    wallSealGroup.add(sealRim);

    const sealFace = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.7, 32)),
      logoFaceMat
    );
    sealFace.position.z = 0.055;
    wallSealGroup.add(sealFace);
    diorama.add(wallSealGroup);

    const boardGroup = new THREE.Group();
    boardGroup.position.set(0.85, 3.55, -roomSize / 2 + wallThick + 0.08);
    const boardBezel = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(3.5, 1.75, 0.12)),
      outlineDarkMat
    );
    boardBezel.castShadow = true;
    boardGroup.add(boardBezel);

    const boardScreen = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(3.28, 1.54)),
      trackMat(
        new THREE.MeshBasicMaterial({
          map: screenTex,
        })
      )
    );
    boardScreen.position.z = 0.065;
    boardGroup.add(boardScreen);
    diorama.add(boardGroup);

    const credenzaGroup = new THREE.Group();
    credenzaGroup.position.set(0.55, 0.07, -roomSize / 2 + wallThick + 0.58);
    diorama.add(credenzaGroup);

    const credenzaBody = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(5.6, 1.55, 0.92)),
      whitePanelMat
    );
    credenzaBody.position.y = 1.55 / 2;
    credenzaBody.castShadow = true;
    credenzaBody.receiveShadow = true;
    credenzaGroup.add(credenzaBody);

    const credenzaTop = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(5.72, 0.12, 1.0)),
      deskWoodMat
    );
    credenzaTop.position.y = 1.58;
    credenzaTop.castShadow = true;
    credenzaGroup.add(credenzaTop);

    [-2.05, -0.7, 0.7, 2.05].forEach((cx, idx) => {
      const door = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.18, 0.68, 0.06)),
        idx % 2 === 0 ? cabinetOrangeMat : deskWoodMat
      );
      door.position.set(cx, 0.44, 0.45);
      credenzaGroup.add(door);
    });

    const bookPalette = [0x3b82f6, 0xe05a47, 0x4ba368, 0xe8aa42, 0xf4f1ea];
    for (let b = 0; b < 18; b++) {
      const bookMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: bookPalette[b % bookPalette.length],
          roughness: 0.5,
        })
      );
      const book = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.12, 0.42 + (b % 3) * 0.05, 0.55)),
        bookMat
      );
      book.position.set(-2.3 + b * 0.26, 1.15, 0.12);
      book.rotation.z = b % 5 === 0 ? 0.12 : 0;
      credenzaGroup.add(book);
    }

    [-0.4, 0.25].forEach((fx, i) => {
      const frame = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.42, 0.54, 0.06)),
        outlineDarkMat
      );
      frame.position.set(fx, 1.9, 0);
      const inner = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.32, 0.44, 0.07)),
        whitePanelMat
      );
      inner.position.set(fx, 1.9, 0);
      if (i === 1) {
        frame.scale.set(0.85, 0.78, 1);
        inner.scale.set(0.85, 0.78, 1);
      }
      credenzaGroup.add(frame, inner);
    });

    interface AnimatedOfficerParts {
      headGroup: THREE.Group;
      leftArm: THREE.Group;
      rightArm: THREE.Group;
      mode: 'seated' | 'presenter';
      phase: number;
    }
    const animatedOfficers: AnimatedOfficerParts[] = [];

    const createStylizedOfficer = (opts: {
      skinIdx: number;
      hairIdx: number;
      jacketMat: THREE.Material;
      mode: 'seated' | 'presenter';
      phase: number;
    }): THREE.Group => {
      const root = new THREE.Group();
      const skinMat = skinToneMats[opts.skinIdx % skinToneMats.length];
      const hairMat = hairMats[opts.hairIdx % hairMats.length];

      const torso = new THREE.Mesh(
        trackGeo(new THREE.CapsuleGeometry(0.19, 0.34, 6, 12)),
        opts.jacketMat
      );
      torso.position.y = opts.mode === 'seated' ? 0.36 : 0.92;
      torso.castShadow = true;
      root.add(torso);

      const lanyardCard = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.09, 0.12, 0.02)),
        goldRimMat
      );
      lanyardCard.position.set(
        0,
        opts.mode === 'seated' ? 0.36 : 0.92,
        0.19
      );
      root.add(lanyardCard);

      const headGroup = new THREE.Group();
      headGroup.position.set(0, opts.mode === 'seated' ? 0.78 : 1.34, 0);

      const headMesh = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.19, 16, 16)),
        skinMat
      );
      headMesh.castShadow = true;
      headGroup.add(headMesh);

      const hairCap = new THREE.Mesh(
        trackGeo(
          new THREE.SphereGeometry(
            0.202,
            14,
            14,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.58
          )
        ),
        hairMat
      );
      hairCap.position.y = 0.02;
      hairCap.rotation.x = -0.18;
      headGroup.add(hairCap);

      [-0.065, 0.065].forEach((ex) => {
        const eye = new THREE.Mesh(
          trackGeo(new THREE.SphereGeometry(0.022, 8, 8)),
          outlineDarkMat
        );
        eye.position.set(ex, 0.02, 0.175);
        headGroup.add(eye);
      });

      root.add(headGroup);

      const leftArm = new THREE.Group();
      leftArm.position.set(-0.23, opts.mode === 'seated' ? 0.48 : 1.06, 0);
      const leftLimb = new THREE.Mesh(
        trackGeo(new THREE.CapsuleGeometry(0.055, 0.28, 6, 10)),
        opts.jacketMat
      );
      leftLimb.position.set(0, -0.14, 0.12);
      leftLimb.rotation.x = -Math.PI * 0.36;
      leftArm.add(leftLimb);
      root.add(leftArm);

      const rightArm = new THREE.Group();
      rightArm.position.set(0.23, opts.mode === 'seated' ? 0.48 : 1.06, 0);
      const rightLimb = new THREE.Mesh(
        trackGeo(new THREE.CapsuleGeometry(0.055, 0.28, 6, 10)),
        opts.jacketMat
      );
      if (opts.mode === 'presenter') {
        rightLimb.position.set(0.08, 0.12, 0.14);
        rightLimb.rotation.z = -0.65;
        rightLimb.rotation.x = -0.45;
      } else {
        rightLimb.position.set(0, -0.14, 0.12);
        rightLimb.rotation.x = -Math.PI * 0.36;
      }
      rightArm.add(rightLimb);
      root.add(rightArm);

      if (opts.mode === 'seated') {
        [-0.09, 0.09].forEach((lx) => {
          const thigh = new THREE.Mesh(
            trackGeo(new THREE.CapsuleGeometry(0.065, 0.24, 6, 10)),
            darkMetalMat
          );
          thigh.rotation.x = Math.PI / 2;
          thigh.position.set(lx, 0.1, 0.16);
          root.add(thigh);
        });
      } else {
        [-0.09, 0.09].forEach((lx) => {
          const leg = new THREE.Mesh(
            trackGeo(new THREE.CapsuleGeometry(0.07, 0.48, 6, 10)),
            darkMetalMat
          );
          leg.position.set(lx, 0.34, 0);
          leg.castShadow = true;
          root.add(leg);
        });
      }

      animatedOfficers.push({
        headGroup,
        leftArm,
        rightArm,
        mode: opts.mode,
        phase: opts.phase,
      });

      return root;
    };

    const presenterOfficer = createStylizedOfficer({
      skinIdx: 0,
      hairIdx: 1,
      jacketMat: jacketGreenMat,
      mode: 'presenter',
      phase: 0.5,
    });
    presenterOfficer.position.set(-1.35, 0.07, -2.35);
    presenterOfficer.rotation.y = 0.38;
    diorama.add(presenterOfficer);

    // 3. CENTRAL 4-DESK COLLABORATIVE WORKSTATION ISLAND
    const islandGroup = new THREE.Group();
    islandGroup.position.set(-0.2, 0.07, 0.55);
    diorama.add(islandGroup);

    const deskWidth = 1.95;
    const deskDepth = 1.25;
    const deskHeight = 0.92;
    const deskOffsets = [
      { x: -deskWidth / 2 - 0.04, z: -deskDepth / 2 - 0.04, dir: 1 },
      { x: deskWidth / 2 + 0.04, z: -deskDepth / 2 - 0.04, dir: 1 },
      { x: -deskWidth / 2 - 0.04, z: deskDepth / 2 + 0.04, dir: -1 },
      { x: deskWidth / 2 + 0.04, z: deskDepth / 2 + 0.04, dir: -1 },
    ];

    const officerJackets = [
      jacketAmberMat,
      jacketNavyMat,
      jacketCreamMat,
      jacketGreenMat,
    ];
    const swivelChairs: THREE.Group[] = [];

    deskOffsets.forEach((pos, idx) => {
      const dGroup = new THREE.Group();
      dGroup.position.set(pos.x, 0, pos.z);
      islandGroup.add(dGroup);

      const top = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(deskWidth, 0.09, deskDepth)),
        deskWoodMat
      );
      top.position.y = deskHeight;
      top.castShadow = true;
      top.receiveShadow = true;
      dGroup.add(top);

      [-deskWidth / 2 + 0.08, deskWidth / 2 - 0.08].forEach((lx) => {
        const legPanel = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.08, deskHeight, deskDepth - 0.12)),
          whitePanelMat
        );
        legPanel.position.set(lx, deskHeight / 2, 0);
        legPanel.castShadow = true;
        legPanel.receiveShadow = true;
        dGroup.add(legPanel);
      });

      const monitorGroup = new THREE.Group();
      monitorGroup.position.set(
        idx % 2 === 0 ? -0.15 : 0.15,
        deskHeight + 0.05,
        -pos.dir * 0.28
      );
      if (pos.dir === -1) {
        monitorGroup.rotation.y = Math.PI;
      }

      const standBase = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.28, 0.03, 0.22)),
        darkMetalMat
      );
      const standNeck = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.06, 0.28, 0.06)),
        darkMetalMat
      );
      standNeck.position.y = 0.14;
      const screenCase = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.76, 0.48, 0.05)),
        whitePanelMat
      );
      screenCase.position.y = 0.36;
      screenCase.castShadow = true;

      const screenGlow = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(0.68, 0.4)),
        monitorScreenMat
      );
      screenGlow.position.set(0, 0.36, 0.028);

      monitorGroup.add(standBase, standNeck, screenCase, screenGlow);
      dGroup.add(monitorGroup);

      const keyboard = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.42, 0.025, 0.16)),
        whitePanelMat
      );
      keyboard.position.set(
        idx % 2 === 0 ? -0.15 : 0.15,
        deskHeight + 0.055,
        pos.dir * 0.14
      );
      dGroup.add(keyboard);

      const mug = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.065, 0.055, 0.13, 12)),
        idx % 2 === 0 ? cabinetOrangeMat : chairTealMat
      );
      mug.position.set(
        idx % 2 === 0 ? 0.52 : -0.52,
        deskHeight + 0.11,
        pos.dir * 0.18
      );
      mug.castShadow = true;
      dGroup.add(mug);

      const chair = new THREE.Group();
      chair.position.set(
        idx % 2 === 0 ? -0.1 : 0.1,
        0,
        pos.dir * (deskDepth / 2 + 0.46)
      );
      chair.rotation.y = pos.dir === 1 ? Math.PI : 0;

      const chairMat = idx % 2 === 0 ? chairTealMat : chairAmberMat;

      const post = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.46, 10)),
        darkMetalMat
      );
      post.position.y = 0.23;
      chair.add(post);

      for (let legIdx = 0; legIdx < 5; legIdx++) {
        const angle = (legIdx / 5) * Math.PI * 2;
        const spoke = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.32, 0.035, 0.045)),
          darkMetalMat
        );
        spoke.position.set(
          Math.cos(angle) * 0.14,
          0.06,
          Math.sin(angle) * 0.14
        );
        spoke.rotation.y = -angle;
        chair.add(spoke);
      }

      const seatTop = new THREE.Group();
      seatTop.position.y = 0.48;

      const cushion = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.56, 0.09, 0.54)),
        chairMat
      );
      cushion.castShadow = true;
      seatTop.add(cushion);

      const backrest = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.52, 0.62, 0.09)),
        chairMat
      );
      backrest.position.set(0, 0.34, -0.24);
      backrest.rotation.x = -0.08;
      backrest.castShadow = true;
      seatTop.add(backrest);

      [-0.28, 0.28].forEach((ax) => {
        const arm = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.05, 0.24, 0.34)),
          darkMetalMat
        );
        arm.position.set(ax, 0.14, -0.04);
        seatTop.add(arm);
      });

      if (idx < 3) {
        const seatedOfficer = createStylizedOfficer({
          skinIdx: idx,
          hairIdx: idx,
          jacketMat: officerJackets[idx],
          mode: 'seated',
          phase: idx * 1.4,
        });
        seatedOfficer.position.set(0, 0.05, 0.02);
        seatTop.add(seatedOfficer);
      }

      chair.add(seatTop);
      swivelChairs.push(seatTop);
      dGroup.add(chair);
    });

    const centerDivider = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(deskWidth * 2 + 0.06, 0.46, 0.06)),
      whitePanelMat
    );
    centerDivider.position.set(0, deskHeight + 0.23, 0);
    centerDivider.castShadow = true;
    islandGroup.add(centerDivider);

    const dividerMedallion = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.18, 24)),
      logoFaceMat
    );
    dividerMedallion.position.set(0, deskHeight + 0.24, 0.035);
    islandGroup.add(dividerMedallion);

    // 4. INTERACTIVE LAMP & LIGHT PHYSICS
    const deskLampGroup = new THREE.Group();
    deskLampGroup.position.set(-0.85, deskHeight + 0.05, 0);
    const lampFoot = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 14)),
      darkMetalMat
    );
    const lampStem = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.58, 10)),
      darkMetalMat
    );
    lampStem.position.set(0, 0.28, 0);
    lampStem.rotation.z = -0.18;

    const deskLampHeadPivot = new THREE.Group();
    deskLampHeadPivot.position.set(0.08, 0.56, 0);
    const lampShade = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.19, 0.25, 16)),
      darkMetalMat
    );
    lampShade.rotation.z = -0.42;
    const lampBulb = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.08, 10, 10)),
      lampBulbMat
    );
    lampBulb.position.set(0.04, -0.08, 0);

    const deskBeamCone = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.55, 0.68, 16, 1, true)),
      volumetricBeamMat
    );
    deskBeamCone.position.set(0.16, -0.34, 0);
    deskBeamCone.rotation.z = -0.42;

    deskLampHeadPivot.add(lampShade, lampBulb, deskBeamCone);
    deskLampGroup.add(lampFoot, lampStem, deskLampHeadPivot);
    islandGroup.add(deskLampGroup);

    const pendantSupportArm = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.08, 0.08, 4.6)),
      darkMetalMat
    );
    pendantSupportArm.position.set(-0.2, wallHeight - 0.12, -1.85);
    diorama.add(pendantSupportArm);

    const pendantPivot = new THREE.Group();
    pendantPivot.position.set(-0.2, wallHeight - 0.15, 0.42);
    diorama.add(pendantPivot);

    const cordLength = 1.65;
    const pendantCord = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.018, 0.018, cordLength, 8)),
      outlineDarkMat
    );
    pendantCord.position.y = -cordLength / 2;
    pendantPivot.add(pendantCord);

    const pendantShadeGroup = new THREE.Group();
    pendantShadeGroup.position.y = -cordLength;
    pendantPivot.add(pendantShadeGroup);

    const pendantDome = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.46, 0.34, 20)),
      darkMetalMat
    );
    pendantDome.castShadow = true;
    const pendantGoldCollar = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.09, 0.12, 0.12, 14)),
      goldRimMat
    );
    pendantGoldCollar.position.y = 0.18;
    const pendantBulb = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.13, 12, 12)),
      lampBulbMat
    );
    pendantBulb.position.y = -0.12;

    const pendantVolumetricCone = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(1.85, 2.75, 20, 1, true)),
      volumetricBeamMat
    );
    pendantVolumetricCone.position.y = -1.48;

    pendantShadeGroup.add(
      pendantDome,
      pendantGoldCollar,
      pendantBulb,
      pendantVolumetricCone
    );

    const dynamicLightPool = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(2.9, 2.9)),
      dynamicLightPoolMat
    );
    dynamicLightPool.rotation.x = -Math.PI / 2;
    dynamicLightPool.position.set(-0.2, deskHeight + 0.12, 0.42);
    diorama.add(dynamicLightPool);

    const floorLampGroup = new THREE.Group();
    floorLampGroup.position.set(-2.85, 0.07, -2.75);
    const flBase = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.28, 0.3, 0.06, 14)),
      darkMetalMat
    );
    flBase.position.y = 0.03;
    const flPole = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 2.75, 10)),
      darkMetalMat
    );
    flPole.position.y = 1.4;

    const flHeadPivot = new THREE.Group();
    flHeadPivot.position.set(0.16, 2.72, 0.12);
    const flShade = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.38, 0.44, 16)),
      darkMetalMat
    );
    flShade.rotation.z = -0.28;
    const flBulb = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.12, 10, 10)),
      lampBulbMat
    );
    flBulb.position.set(0.02, -0.14, 0);

    const flVolumetricCone = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(1.35, 2.55, 16, 1, true)),
      volumetricBeamMat
    );
    flVolumetricCone.position.set(0.35, -1.32, 0);
    flVolumetricCone.rotation.z = -0.28;

    flHeadPivot.add(flShade, flBulb, flVolumetricCone);
    floorLampGroup.add(flBase, flPole, flHeadPivot);
    diorama.add(floorLampGroup);

    const cornerFloorPool = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(2.6, 2.6)),
      dynamicLightPoolMat
    );
    cornerFloorPool.rotation.x = -Math.PI / 2;
    cornerFloorPool.position.set(-2.35, 0.085, -2.55);
    diorama.add(cornerFloorPool);

    // 5. CORNER POTTED FICUS TREE
    const plantGroup = new THREE.Group();
    plantGroup.position.set(-2.95, 0.07, 2.35);
    diorama.add(plantGroup);

    const potBody = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.46, 0.36, 0.72, 16)),
      whitePanelMat
    );
    potBody.position.y = 0.36;
    potBody.castShadow = true;
    potBody.receiveShadow = true;
    plantGroup.add(potBody);

    const soil = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 14)),
      outlineDarkMat
    );
    soil.position.y = 0.71;
    plantGroup.add(soil);

    const trunk = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.07, 0.11, 1.35, 10)),
      deskWoodMat
    );
    trunk.position.y = 1.25;
    trunk.castShadow = true;
    plantGroup.add(trunk);

    const foliageCrown = new THREE.Group();
    foliageCrown.position.y = 1.95;
    const puffCoords = [
      { x: 0, y: 0.22, z: 0, r: 0.58, mat: foliageMat1 },
      { x: -0.34, y: -0.05, z: 0.22, r: 0.44, mat: foliageMat2 },
      { x: 0.36, y: 0.02, z: -0.18, r: 0.46, mat: foliageMat2 },
      { x: 0.15, y: -0.12, z: 0.34, r: 0.4, mat: foliageMat1 },
      { x: -0.22, y: 0.18, z: -0.28, r: 0.42, mat: foliageMat1 },
    ];
    puffCoords.forEach((p) => {
      const puff = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(p.r, 14, 14)),
        p.mat
      );
      puff.position.set(p.x, p.y, p.z);
      puff.castShadow = true;
      foliageCrown.add(puff);
    });
    plantGroup.add(foliageCrown);

    // 6. DAY / NIGHT LIGHTING RIG + PHYSICAL PENDANT SPOTLIGHT
    const hemiLight = new THREE.HemisphereLight(0xfffbf0, 0x6e553e, 0.95);
    hemiLight.position.set(0, 18, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff0d4, 2.2);
    sunLight.position.set(9, 15, 10);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    const d = 7.2;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 32;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const windowFillLight = new THREE.DirectionalLight(0xffdf9e, 1.1);
    windowFillLight.position.set(-10, 8, -4);
    scene.add(windowFillLight);

    const pendantSpotLight = new THREE.SpotLight(
      0xffb85c,
      themeRef.current === 'dark' ? 5.2 : 1.4,
      11,
      Math.PI / 3.1,
      0.65,
      1.5
    );
    pendantSpotLight.position.set(0, -0.14, 0);
    pendantShadeGroup.add(pendantSpotLight);

    const pendantSpotTarget = new THREE.Object3D();
    pendantSpotTarget.position.set(-0.2, 0.5, 0.42);
    diorama.add(pendantSpotTarget);
    pendantSpotLight.target = pendantSpotTarget;

    const deskPointLight = new THREE.PointLight(0xffa94d, 0.9, 8.5, 1.5);
    deskPointLight.position.set(0.1, -0.12, 0);
    deskLampHeadPivot.add(deskPointLight);

    const cornerLampLight = new THREE.PointLight(0xff9e44, 0.8, 9.5, 1.5);
    cornerLampLight.position.set(0.05, -0.18, 0);
    flHeadPivot.add(cornerLampLight);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const dayWindowColor = new THREE.Color(0xbae6fd);
    const nightWindowColor = new THREE.Color(0x1e3a6e);

    const daySunColor = new THREE.Color(0xfff2d6);
    const nightMoonColor = new THREE.Color(0x6b8fd4);

    const dayWallColor = new THREE.Color(0xf4f1ea);
    const nightWallColor = new THREE.Color(0xd5d2cb);

    const dayCloudColor = new THREE.Color(0xffffff);
    const nightCloudColor = new THREE.Color(0x283856);
    const dayCloudEmissive = new THREE.Color(0xdbeafe);
    const nightCloudEmissive = new THREE.Color(0x111a2e);

    const clock = new THREE.Clock();
    let frameId = 0;
    let isLoopRunning = false;
    let isInViewport = true;
    let lastBoardDraw = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const shouldAnimate = () =>
      isActiveRef.current && isInViewport && !document.hidden;

    const tick = () => {
      if (!shouldAnimate()) {
        isLoopRunning = false;
        return;
      }

      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const isNight = themeRef.current === 'dark';
      const lerpAlpha = 1 - Math.exp(-4.5 * dt);

      // 1. Smoothly transition Sun, Moon, Stars & 3D Clouds
      sunCoreMat.opacity = THREE.MathUtils.lerp(
        sunCoreMat.opacity,
        isNight ? 0 : 1,
        lerpAlpha
      );
      sunHaloMat.opacity = THREE.MathUtils.lerp(
        sunHaloMat.opacity,
        isNight ? 0 : 0.34,
        lerpAlpha
      );
      sunOrbGroup.position.y = THREE.MathUtils.lerp(
        sunOrbGroup.position.y,
        isNight ? 4.2 : 7.2,
        lerpAlpha
      );

      moonCoreMat.opacity = THREE.MathUtils.lerp(
        moonCoreMat.opacity,
        isNight ? 1 : 0,
        lerpAlpha
      );
      moonHaloMat.opacity = THREE.MathUtils.lerp(
        moonHaloMat.opacity,
        isNight ? 0.28 : 0,
        lerpAlpha
      );
      moonOrbGroup.position.y = THREE.MathUtils.lerp(
        moonOrbGroup.position.y,
        isNight ? 7.1 : 4.2,
        lerpAlpha
      );

      const twinkle = 0.78 + Math.sin(elapsed * 2.6) * 0.18;
      starMat.opacity = THREE.MathUtils.lerp(
        starMat.opacity,
        isNight ? twinkle : 0,
        lerpAlpha
      );

      cloudMat.color.lerp(isNight ? nightCloudColor : dayCloudColor, lerpAlpha);
      cloudMat.emissive.lerp(
        isNight ? nightCloudEmissive : dayCloudEmissive,
        lerpAlpha
      );

      driftingClouds.forEach((c) => {
        c.group.position.y =
          c.baseY + Math.sin(elapsed * 0.9 + c.phase) * 0.16;
        c.group.position.x += Math.sin(elapsed * 0.25 + c.phase) * 0.0025;
      });

      // 2. LAMP PENDULUM & LIGHT PHYSICS SIMULATION
      const curAzimuth = controls.getAzimuthalAngle();
      const curPolar = controls.getPolarAngle();
      const deltaAzimuth = curAzimuth - prevAzimuth;
      const deltaPolar = curPolar - prevPolar;
      prevAzimuth = curAzimuth;
      prevPolar = curPolar;

      const breezeX = Math.sin(elapsed * 1.65) * 0.18;
      const breezeZ = Math.cos(elapsed * 1.35) * 0.18;
      const gravityOverL = 14.5;
      const damping = 2.6;

      lampVelZ +=
        (-gravityOverL * lampAngleZ -
          damping * lampVelZ +
          deltaAzimuth * 18 +
          breezeZ) *
        dt;
      lampVelX +=
        (-gravityOverL * lampAngleX -
          damping * lampVelX +
          deltaPolar * 14 +
          breezeX) *
        dt;

      lampAngleZ = THREE.MathUtils.clamp(
        lampAngleZ + lampVelZ * dt,
        -0.42,
        0.42
      );
      lampAngleX = THREE.MathUtils.clamp(
        lampAngleX + lampVelX * dt,
        -0.42,
        0.42
      );

      pendantPivot.rotation.z = lampAngleZ;
      pendantPivot.rotation.x = lampAngleX;

      const swingOffsetX = Math.sin(lampAngleZ) * 2.4;
      const swingOffsetZ = -Math.sin(lampAngleX) * 2.4;
      pendantSpotTarget.position.set(
        -0.2 + swingOffsetX,
        deskHeight,
        0.42 + swingOffsetZ
      );
      dynamicLightPool.position.set(
        -0.2 + swingOffsetX * 0.55,
        deskHeight + 0.105,
        0.42 + swingOffsetZ * 0.55
      );

      deskLampHeadPivot.rotation.z = Math.sin(elapsed * 1.9) * 0.05;
      flHeadPivot.rotation.z = Math.cos(elapsed * 1.4) * 0.04;
      cornerFloorPool.position.x = -2.35 + Math.cos(elapsed * 1.4) * 0.12;

      const filamentPulse =
        1 + Math.sin(elapsed * 7.5) * 0.03 + Math.cos(elapsed * 13.0) * 0.015;

      // 3. Smoothly transition Window Panes & Interior Lamp Intensities
      windowPaneMat.color.lerp(
        isNight ? nightWindowColor : dayWindowColor,
        lerpAlpha
      );
      windowPaneMat.opacity = THREE.MathUtils.lerp(
        windowPaneMat.opacity,
        isNight ? 0.34 : 0.22,
        lerpAlpha
      );

      rightWallMat.color.lerp(
        isNight ? nightWallColor : dayWallColor,
        lerpAlpha
      );

      sunLight.color.lerp(isNight ? nightMoonColor : daySunColor, lerpAlpha);
      sunLight.intensity = THREE.MathUtils.lerp(
        sunLight.intensity,
        isNight ? 0.52 : 2.35,
        lerpAlpha
      );

      hemiLight.intensity = THREE.MathUtils.lerp(
        hemiLight.intensity,
        isNight ? 0.36 : 1.05,
        lerpAlpha
      );

      windowFillLight.intensity = THREE.MathUtils.lerp(
        windowFillLight.intensity,
        isNight ? 0.32 : 1.15,
        lerpAlpha
      );

      pendantSpotLight.intensity =
        THREE.MathUtils.lerp(
          pendantSpotLight.intensity,
          isNight ? 5.6 : 1.6,
          lerpAlpha
        ) * filamentPulse;

      deskPointLight.intensity =
        THREE.MathUtils.lerp(
          deskPointLight.intensity,
          isNight ? 3.8 : 0.85,
          lerpAlpha
        ) * filamentPulse;

      cornerLampLight.intensity =
        THREE.MathUtils.lerp(
          cornerLampLight.intensity,
          isNight ? 3.4 : 0.75,
          lerpAlpha
        ) * filamentPulse;

      lampBulbMat.emissiveIntensity =
        THREE.MathUtils.lerp(
          lampBulbMat.emissiveIntensity,
          isNight ? 2.8 : 1.15,
          lerpAlpha
        ) * filamentPulse;

      volumetricBeamMat.opacity = THREE.MathUtils.lerp(
        volumetricBeamMat.opacity,
        isNight ? 0.14 : 0.055,
        lerpAlpha
      );

      dynamicLightPoolMat.opacity = THREE.MathUtils.lerp(
        dynamicLightPoolMat.opacity,
        isNight ? 0.62 : 0.24,
        lerpAlpha
      );

      monitorScreenMat.emissiveIntensity = THREE.MathUtils.lerp(
        monitorScreenMat.emissiveIntensity,
        isNight ? 1.15 : 0.55,
        lerpAlpha
      );
      lightShaftMat.opacity = THREE.MathUtils.lerp(
        lightShaftMat.opacity,
        isNight ? 0.05 : 0.2,
        lerpAlpha
      );
      lightShaftMat.color.lerp(
        isNight ? new THREE.Color(0x6b93d6) : new THREE.Color(0xffe8a3),
        lerpAlpha
      );

      // 4. Lively animations inside the office
      swivelChairs.forEach((chair, idx) => {
        chair.rotation.y = Math.sin(elapsed * 1.1 + idx * 1.7) * 0.16;
      });

      animatedOfficers.forEach((off) => {
        off.headGroup.rotation.y =
          Math.sin(elapsed * 1.3 + off.phase) * 0.18;
        off.headGroup.rotation.x =
          Math.cos(elapsed * 1.8 + off.phase) * 0.06;
        if (off.mode === 'seated') {
          off.leftArm.rotation.x =
            Math.sin(elapsed * 6.5 + off.phase) * 0.08;
          off.rightArm.rotation.x =
            Math.cos(elapsed * 6.5 + off.phase) * 0.08;
        } else {
          off.rightArm.rotation.z =
            Math.sin(elapsed * 2.2 + off.phase) * 0.12;
        }
      });

      foliageCrown.rotation.z = Math.sin(elapsed * 1.4) * 0.035;
      foliageCrown.rotation.x = Math.cos(elapsed * 1.1) * 0.025;

      // 5. AUTOMATIC CAMERA ANGLE RESET WHEN USER IS NOT HOLDING/DRAGGING
      if (!userInteracting) {
        const springReturnAlpha = 1 - Math.exp(-3.8 * dt);
        camera.position.lerp(defaultCamPos, springReturnAlpha);
        controls.target.lerp(defaultTarget, springReturnAlpha);

        diorama.rotation.y = THREE.MathUtils.lerp(
          diorama.rotation.y,
          Math.sin(elapsed * 0.45) * 0.06,
          lerpAlpha
        );
      }

      if (elapsed - lastBoardDraw > 0.25) {
        lastBoardDraw = elapsed;
        drawSmartBoard(elapsed, isNight);
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    const startLoopIfNeeded = () => {
      if (!isLoopRunning && shouldAnimate()) {
        isLoopRunning = true;
        clock.getDelta();
        frameId = window.requestAnimationFrame(tick);
      }
    };

    resumeLoopRef.current = () => {
      if (container) {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || 680;
        if (w > 0 && h > 0) {
          renderer.setSize(w, h);
          updateDioramaPlacement(w, h);
        }
      }
      startLoopIfNeeded();
    };

    startLoopIfNeeded();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || 680;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      updateDioramaPlacement(w, h);
      renderer.render(scene, camera);
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
    window.addEventListener('resize', handleResize, { passive: true });

    // Pause WebGL render loop automatically when Hero section is scrolled out of view
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        isInViewport = entry.isIntersecting;
        if (isInViewport) {
          startLoopIfNeeded();
        }
      },
      { threshold: 0.01 }
    );
    io.observe(container);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        startLoopIfNeeded();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      resumeLoopRef.current = null;
      isLoopRunning = false;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('end', onControlEnd);
      controls.dispose();

      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      logoTex.dispose();
      screenTex.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, [customLogoUrl]);

  return (
    <div className="relative h-full w-full select-none">
      {/* Dedicated WebGL Mount Container */}
      <div
        ref={mountRef}
        aria-label="Interactive 3D Council Office — Drag to rotate, release to auto-reset"
        className={`h-full w-full ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      />
    </div>
  );
}
