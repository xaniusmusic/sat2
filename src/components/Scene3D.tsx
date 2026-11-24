import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { HARDWARE_CATALOG } from '../data/hardwareCatalog';
import { BROADCAST_SATELLITES } from '../data/locationsAndSatellites';
import {
  BroadcastSatellite,
  CameraPreset,
  CityLocation,
  DishOrientation,
  InstalledRig,
  ScannedChannel,
  SignalMetrics,
  WeatherCondition,
} from '../types/simulator';
import { calculateLookAngles } from '../utils/rfPhysics';

interface Scene3DProps {
  city: CityLocation;
  orientation: DishOrientation;
  onChangeOrientation: (next: DishOrientation) => void;
  rig: InstalledRig;
  signalMetrics: SignalMetrics;
  cameraPreset: CameraPreset;
  weather: WeatherCondition;
  activeChannel: ScannedChannel | null;
  isScanning: boolean;
  scanProgress: number;
  onOpenTvOsd: () => void;
  onOpenHardwareDrawer: () => void;
  onSelectSatelliteTarget: (sat: BroadcastSatellite) => void;
  selectedTargetSat: BroadcastSatellite;
}

// Helper to create a crisp canvas texture for the compass rose on the rooftop floor
function createCompassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 1024, 1024);
  const cx = 512;
  const cy = 512;

  // Outer technical rings
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 460, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 380, 0, Math.PI * 2);
  ctx.stroke();

  // Degree ticks every 5 degrees
  for (let deg = 0; deg < 360; deg += 5) {
    // Let 0 deg (North) be at -Z (top of canvas = -Y in 2D)
    const rad = ((deg - 90) * Math.PI) / 180;
    const isMajor = deg % 30 === 0;
    const isCardinal = deg % 90 === 0;
    const rInner = isCardinal ? 395 : isMajor ? 420 : 440;
    const rOuter = 460;

    ctx.strokeStyle = isCardinal
      ? '#00F0FF'
      : isMajor
      ? 'rgba(241, 245, 249, 0.65)'
      : 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = isCardinal ? 5 : isMajor ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * rInner, cy + Math.sin(rad) * rInner);
    ctx.lineTo(cx + Math.cos(rad) * rOuter, cy + Math.sin(rad) * rOuter);
    ctx.stroke();

    if (isMajor && !isCardinal) {
      ctx.save();
      ctx.translate(cx + Math.cos(rad) * 355, cy + Math.sin(rad) * 355);
      ctx.rotate(rad + Math.PI / 2);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.font = 'bold 24px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${deg}°`, 0, 0);
      ctx.restore();
    }
  }

  // Cardinal labels: N (0°), E (90°), S (180°), W (270°)
  const cardinals = [
    { label: 'N 0°', deg: 0, color: '#EF4444' },
    { label: 'E 90°', deg: 90, color: '#00F0FF' },
    { label: 'S 180°', deg: 180, color: '#10B981' },
    { label: 'W 270°', deg: 270, color: '#00F0FF' },
  ];

  for (const c of cardinals) {
    const rad = ((c.deg - 90) * Math.PI) / 180;
    ctx.save();
    ctx.translate(cx + Math.cos(rad) * 335, cy + Math.sin(rad) * 335);
    ctx.rotate(rad + Math.PI / 2);
    ctx.fillStyle = c.color;
    ctx.font = 'bold 34px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.label, 0, 0);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

// Helper to create satellite sky label sprite
function createSatelliteLabelSprite(
  name: string,
  slot: string,
  isTarget: boolean,
  isLocked: boolean
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const borderColor = isLocked ? '#10B981' : isTarget ? '#00F0FF' : 'rgba(148,163,184,0.5)';
  const bgColor = isLocked
    ? 'rgba(6, 78, 59, 0.88)'
    : isTarget
    ? 'rgba(8, 47, 73, 0.88)'
    : 'rgba(15, 23, 42, 0.78)';

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(12, 16, 488, 96, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isLocked ? '#34D399' : isTarget ? '#00F0FF' : '#CBD5E1';
  ctx.font = 'bold 30px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${slot} • ${name.slice(0, 18)}`, 256, 58);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '22px "Inter", sans-serif';
  ctx.fillText(
    isLocked ? '● TRANSPONDER LOCKED' : isTarget ? '◎ SELECTED TARGET' : 'GEO TV BROADCAST SAT',
    256,
    94
  );

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(5.2, 1.3, 1);
  return sprite;
}

export const Scene3D: React.FC<Scene3DProps> = ({
  city,
  orientation,
  onChangeOrientation,
  rig,
  signalMetrics,
  cameraPreset,
  weather,
  activeChannel,
  isScanning,
  scanProgress,
  onOpenTvOsd,
  onOpenHardwareDrawer,
  selectedTargetSat,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoverHint, setHoverHint] = useState<string | null>(null);
  const [isDraggingDish, setIsDraggingDish] = useState(false);

  // Refs to keep mutable access inside requestAnimationFrame without recreating the WebGL scene
  const stateRef = useRef({
    city,
    orientation,
    rig,
    signalMetrics,
    cameraPreset,
    weather,
    activeChannel,
    isScanning,
    scanProgress,
    selectedTargetSat,
  });

  useEffect(() => {
    stateRef.current = {
      city,
      orientation,
      rig,
      signalMetrics,
      cameraPreset,
      weather,
      activeChannel,
      isScanning,
      scanProgress,
      selectedTargetSat,
    };
  }, [
    city,
    orientation,
    rig,
    signalMetrics,
    cameraPreset,
    weather,
    activeChannel,
    isScanning,
    scanProgress,
    selectedTargetSat,
  ]);

  // Refs to 3D groups updated dynamically
  const dishYawGroupRef = useRef<THREE.Group | null>(null);
  const dishPitchGroupRef = useRef<THREE.Group | null>(null);
  const dishReflectorMeshRef = useRef<THREE.Mesh | null>(null);
  const dishWireMeshRef = useRef<THREE.Mesh | null>(null);
  const lnbGroupRef = useRef<THREE.Group | null>(null);
  const mastGroupRef = useRef<THREE.Group | null>(null);
  const coaxTubeRef = useRef<THREE.Mesh | null>(null);
  const coaxPulseRef = useRef<THREE.Mesh | null>(null);
  const receiverGroupRef = useRef<THREE.Group | null>(null);
  const beamConeRef = useRef<THREE.Mesh | null>(null);
  const beamLineRef = useRef<THREE.Line | null>(null);
  const skySatellitesGroupRef = useRef<THREE.Group | null>(null);
  const rainParticlesRef = useRef<THREE.Points | null>(null);
  const tvScreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tvScreenTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const tvGlowLightRef = useRef<THREE.PointLight | null>(null);
  const stbLedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stbLedTextureRef = useRef<THREE.CanvasTexture | null>(null);

  // Camera orbit control state
  const camSphericalRef = useRef({
    target: new THREE.Vector3(-3.2, 1.35, 1.2),
    desiredTarget: new THREE.Vector3(-3.2, 1.35, 1.2),
    radius: 5.2,
    desiredRadius: 5.2,
    theta: 0.65,
    desiredTheta: 0.65,
    phi: 1.18,
    desiredPhi: 1.18,
  });

  // Update camera preset targets smoothly when `cameraPreset` changes
  useEffect(() => {
    const cam = camSphericalRef.current;
    if (cameraPreset === 'rooftop') {
      // Over-the-shoulder view of rooftop dish, mast, compass rose & sky arc
      cam.desiredTarget.set(-3.4, 1.45, 1.5);
      cam.desiredRadius = 4.6;
      cam.desiredTheta = 0.55;
      cam.desiredPhi = 1.16;
    } else if (cameraPreset === 'living_room') {
      // Wide architectural view of the living room, TV stand, Samsung TV, receiver & balcony
      cam.desiredTarget.set(1.2, 1.35, -0.4);
      cam.desiredRadius = 6.2;
      cam.desiredTheta = 0.25;
      cam.desiredPhi = 1.22;
    } else if (cameraPreset === 'tv_closeup') {
      // Front-and-center view of Samsung 65" QLED TV and DVB-S2 Receiver on the TV stand
      cam.desiredTarget.set(2.5, 1.48, -1.85);
      cam.desiredRadius = 2.85;
      cam.desiredTheta = 0.0;
      cam.desiredPhi = 1.36;
    }
  }, [cameraPreset]);

  // Rebuild 3D geostationary satellite markers in the sky whenever city, target sat, or lock status changes
  useEffect(() => {
    const skyGroup = skySatellitesGroupRef.current;
    if (!skyGroup) return;

    while (skyGroup.children.length > 0) {
      const child = skyGroup.children[0];
      skyGroup.remove(child);
    }

    const mastOrigin = new THREE.Vector3(-3.4, 1.55, 1.5);
    const skyRadius = 28;

    // Draw geostationary Clarke Belt arc curve across the sky
    const arcPoints: THREE.Vector3[] = [];

    for (const sat of BROADCAST_SATELLITES) {
      const look = calculateLookAngles(city, sat);
      if (!look.isAboveHorizon) continue;

      // Convert Azimuth (0=N=-Z, 90=E=+X, 180=S=+Z, 270=W=-X) & Elevation to 3D direction vector
      const azRad = (look.azimuth * Math.PI) / 180;
      const elRad = (look.elevation * Math.PI) / 180;

      const dirX = Math.sin(azRad) * Math.cos(elRad);
      const dirY = Math.sin(elRad);
      const dirZ = -Math.cos(azRad) * Math.cos(elRad);

      const satPos = new THREE.Vector3(
        mastOrigin.x + dirX * skyRadius,
        mastOrigin.y + dirY * skyRadius,
        mastOrigin.z + dirZ * skyRadius
      );
      arcPoints.push(satPos);

      const isLocked = signalMetrics.lockedSatellite?.id === sat.id;
      const isTarget = selectedTargetSat.id === sat.id;

      const satNode = new THREE.Group();
      satNode.position.copy(satPos);
      satNode.userData = { type: 'sky_satellite', satellite: sat };

      // Spacecraft bus body
      const bodyGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: isLocked ? 0x10b981 : isTarget ? 0x00f0ff : 0xf59e0b,
        emissive: isLocked ? 0x10b981 : isTarget ? 0x00f0ff : 0xd97706,
        emissiveIntensity: isLocked ? 0.9 : isTarget ? 0.75 : 0.35,
        metalness: 0.8,
        roughness: 0.2,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      satNode.add(bodyMesh);

      // Solar panel wings
      const wingGeo = new THREE.BoxGeometry(1.9, 0.22, 0.05);
      const wingMat = new THREE.MeshStandardMaterial({
        color: 0x1e3a8a,
        emissive: isTarget || isLocked ? 0x0284c7 : 0x172554,
        emissiveIntensity: 0.5,
        metalness: 0.9,
        roughness: 0.15,
      });
      const wingMesh = new THREE.Mesh(wingGeo, wingMat);
      satNode.add(wingMesh);

      // Target reticle ring around target or locked satellite
      if (isTarget || isLocked) {
        const ringGeo = new THREE.RingGeometry(0.75, 0.92, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: isLocked ? 0x10b981 : 0x00f0ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.lookAt(mastOrigin);
        satNode.add(ringMesh);
      }

      // Label sprite above spacecraft
      const sprite = createSatelliteLabelSprite(sat.name, sat.orbitalSlot, isTarget, isLocked);
      sprite.position.set(0, 1.25, 0);
      satNode.add(sprite);

      skyGroup.add(satNode);
    }

    // Sort arc points by longitude and connect with a subtle Clarke Belt orbital line
    if (arcPoints.length >= 2) {
      const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
      const arcMat = new THREE.LineDashedMaterial({
        color: 0x00f0ff,
        dashSize: 0.8,
        gapSize: 0.5,
        transparent: true,
        opacity: 0.28,
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      arcLine.computeLineDistances();
      skyGroup.add(arcLine);
    }
  }, [city, selectedTargetSat, signalMetrics.lockedSatellite]);

  // Main Three.js setup effect
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b12);
    scene.fog = new THREE.FogExp2(0x070b12, 0.014);

    const camera = new THREE.PerspectiveCamera(
      48,
      container.clientWidth / container.clientHeight,
      0.1,
      150
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // ================= LIGHTING =================
    const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.75);
    scene.add(ambientLight);

    // Moonlight / Skylight from upper south-west
    const dirLight = new THREE.DirectionalLight(0xe2e8f0, 1.35);
    dirLight.position.set(-12, 18, 14);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Warm indoor living room ceiling downlight
    const livingRoomLight = new THREE.PointLight(0xffedd5, 2.2, 12);
    livingRoomLight.position.set(2.2, 3.3, -0.2);
    livingRoomLight.castShadow = true;
    scene.add(livingRoomLight);

    // Rooftop work floodlight illuminating the satellite dish & compass
    const roofWorkLight = new THREE.PointLight(0x38bdf8, 1.5, 10);
    roofWorkLight.position.set(-2.0, 3.2, 0.2);
    scene.add(roofWorkLight);

    // Dynamic glow from the Samsung QLED TV screen into the living room
    const tvGlowLight = new THREE.PointLight(0x00f0ff, 1.4, 6.5);
    tvGlowLight.position.set(2.5, 1.5, -1.2);
    scene.add(tvGlowLight);
    tvGlowLightRef.current = tvGlowLight;

    // ================= STARFIELD & SKY DOME =================
    const starCount = 900;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 55 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.46; // Upper hemisphere
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi) + 2;
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.18,
      transparent: true,
      opacity: 0.75,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Sky Satellites Group
    const skySatGroup = new THREE.Group();
    scene.add(skySatGroup);
    skySatellitesGroupRef.current = skySatGroup;

    // Weather Rain Particles (visible when weather === 'rain_fade')
    const rainCount = 600;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 24;
      rainPos[i * 3 + 1] = Math.random() * 14;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.08,
      transparent: true,
      opacity: 0.0,
    });
    const rainParticles = new THREE.Points(rainGeo, rainMat);
    scene.add(rainParticles);
    rainParticlesRef.current = rainParticles;

    // ================= OUTDOOR ROOFTOP TERRACE (X: -6.5 to -0.5) =================
    const roofDeckGeo = new THREE.BoxGeometry(6.4, 0.25, 7.2);
    const roofDeckMat = new THREE.MeshStandardMaterial({
      color: 0x161f2e,
      roughness: 0.75,
      metalness: 0.15,
    });
    const roofDeck = new THREE.Mesh(roofDeckGeo, roofDeckMat);
    roofDeck.position.set(-3.5, -0.125, 0.6);
    roofDeck.receiveShadow = true;
    scene.add(roofDeck);

    // Subtle rooftop architectural grid lines
    const gridHelper = new THREE.GridHelper(6.2, 12, 0x00f0ff, 0x1e293b);
    gridHelper.position.set(-3.5, 0.01, 0.6);
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.25;
    scene.add(gridHelper);

    // 360° Cardinal Compass Rose under the Dish Mast at (-3.4, 0.02, 1.5)
    const compassGeo = new THREE.PlaneGeometry(3.3, 3.3);
    const compassMat = new THREE.MeshBasicMaterial({
      map: createCompassTexture(),
      transparent: true,
      depthWrite: false,
    });
    const compassMesh = new THREE.Mesh(compassGeo, compassMat);
    compassMesh.rotation.x = -Math.PI / 2;
    compassMesh.position.set(-3.4, 0.02, 1.5);
    scene.add(compassMesh);

    // Rooftop Glass & Aluminum Safety Railings
    const railingPostMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.7,
      roughness: 0.3,
    });
    const railingGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      roughness: 0.1,
      transmission: 0.6,
    });

    // West & South outer terrace glass barriers
    const southGlass = new THREE.Mesh(new THREE.BoxGeometry(6.3, 1.05, 0.05), railingGlassMat);
    southGlass.position.set(-3.5, 0.52, 4.15);
    scene.add(southGlass);

    const westGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.05, 7.1), railingGlassMat);
    westGlass.position.set(-6.65, 0.52, 0.6);
    scene.add(westGlass);

    const topRailSouth = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.06, 0.08), railingPostMat);
    topRailSouth.position.set(-3.5, 1.06, 4.15);
    scene.add(topRailSouth);

    const topRailWest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 7.2), railingPostMat);
    topRailWest.position.set(-6.65, 1.06, 0.6);
    scene.add(topRailWest);

    // ================= SATELLITE MAST, PARABOLIC DISH & LNB RIG =================
    const mastRoot = new THREE.Group();
    mastRoot.position.set(-3.4, 0.0, 1.5);
    scene.add(mastRoot);
    mastGroupRef.current = mastRoot;

    // Galvanized Tripod Base & Vertical Pole Mast
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.25,
    });
    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.08, 24), steelMat);
    basePlate.position.y = 0.04;
    mastRoot.add(basePlate);

    const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.45, 20), steelMat);
    poleMesh.position.y = 0.75;
    poleMesh.castShadow = true;
    mastRoot.add(poleMesh);

    // Tripod stabilizer struts
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 12), steelMat);
      strut.position.set(Math.cos(angle) * 0.2, 0.32, Math.sin(angle) * 0.2);
      strut.rotation.z = -Math.cos(angle) * 0.48;
      strut.rotation.x = Math.sin(angle) * 0.48;
      mastRoot.add(strut);
    }

    // Azimuth Yaw Rotating Collar at top of mast (Y = 1.48)
    const dishYawGroup = new THREE.Group();
    dishYawGroup.position.set(0, 1.48, 0);
    mastRoot.add(dishYawGroup);
    dishYawGroupRef.current = dishYawGroup;

    // Azimuth U-bracket
    const bracketMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.22, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 })
    );
    dishYawGroup.add(bracketMesh);

    // Elevation Pitch Pivot Group
    const dishPitchGroup = new THREE.Group();
    dishYawGroup.add(dishPitchGroup);
    dishPitchGroupRef.current = dishPitchGroup;

    // Parabolic Dish Reflector Geometry (concave bowl facing -Z in local coordinates so Az=0 points North -Z)
    const dishRadius = 0.65;
    const dishGeo = new THREE.SphereGeometry(
      dishRadius * 1.35,
      36,
      24,
      0,
      Math.PI * 2,
      0,
      0.52
    );
    // Rotate sphere cap so its concave interior faces forward along -Z
    dishGeo.rotateX(-Math.PI / 2);
    dishGeo.translate(0, 0, dishRadius * 1.18);

    const dishMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.55,
      roughness: 0.32,
      side: THREE.DoubleSide,
    });
    const dishMesh = new THREE.Mesh(dishGeo, dishMat);
    dishMesh.castShadow = true;
    dishMesh.userData = { type: 'dish' };
    dishPitchGroup.add(dishMesh);
    dishReflectorMeshRef.current = dishMesh;

    // Mesh wireframe overlay for Prime-Focus 180cm Mesh Dish
    const dishWireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.0,
    });
    const dishWireMesh = new THREE.Mesh(dishGeo, dishWireMat);
    dishPitchGroup.add(dishWireMesh);
    dishWireMeshRef.current = dishWireMesh;

    // Back mounting ring on dish
    const backRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.03, 12, 28),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 })
    );
    backRing.position.set(0, 0, 0.05);
    dishPitchGroup.add(backRing);

    // Feedhorn Support Arm extending from bottom of dish to focal point (0, -0.05, -0.78)
    const feedArmGeo = new THREE.BoxGeometry(0.04, 0.04, 0.88);
    const feedArm = new THREE.Mesh(feedArmGeo, steelMat);
    feedArm.position.set(0, -0.22, -0.42);
    feedArm.rotation.x = 0.24;
    dishPitchGroup.add(feedArm);

    // LNB Holder & Skew Rotation Group at the focal point
    const lnbGroup = new THREE.Group();
    lnbGroup.position.set(0, -0.08, -0.82);
    dishPitchGroup.add(lnbGroup);
    lnbGroupRef.current = lnbGroup;

    // LNB Body + Feedhorn Scalar Cone
    const lnbBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.22, 16),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.4, roughness: 0.3 })
    );
    lnbBody.rotation.x = Math.PI / 2;
    lnbBody.userData = { type: 'lnb' };
    lnbGroup.add(lnbBody);

    const lnbCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.045, 0.07, 20),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 })
    );
    lnbCap.rotation.x = Math.PI / 2;
    lnbCap.position.z = 0.12;
    lnbGroup.add(lnbCap);

    // Skew Polarization Indicator Fin on top of LNB so user clearly sees LNB skew rotation!
    const skewFin = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.11, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    skewFin.position.set(0, 0.06, 0);
    lnbGroup.add(skewFin);

    // 3D Volumetric RF Boresight Cone & Laser Vector extending from Dish into Sky
    const coneHeight = 26;
    const coneGeo = new THREE.ConeGeometry(1.15, coneHeight, 28, 1, true);
    coneGeo.translate(0, -coneHeight / 2, 0);
    coneGeo.rotateX(Math.PI / 2); // Point along -Z
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beamCone = new THREE.Mesh(coneGeo, coneMat);
    dishPitchGroup.add(beamCone);
    beamConeRef.current = beamCone;

    const beamLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -0.2),
      new THREE.Vector3(0, 0, -28),
    ]);
    const beamLineMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.75,
    });
    const beamLine = new THREE.Line(beamLineGeo, beamLineMat);
    dishPitchGroup.add(beamLine);
    beamLineRef.current = beamLine;

    // ================= INDOOR LIVING ROOM ZONE (X: -0.3 to +5.8) =================
    // Warm Walnut Hardwood Floor
    const indoorFloorGeo = new THREE.BoxGeometry(6.4, 0.26, 7.2);
    const indoorFloorMat = new THREE.MeshStandardMaterial({
      color: 0x2c1d14,
      roughness: 0.45,
      metalness: 0.08,
    });
    const indoorFloor = new THREE.Mesh(indoorFloorGeo, indoorFloorMat);
    indoorFloor.position.set(2.8, -0.12, 0.6);
    indoorFloor.receiveShadow = true;
    scene.add(indoorFloor);

    // Woven Modern Area Rug in front of TV Stand
    const rugGeo = new THREE.BoxGeometry(3.8, 0.02, 2.8);
    const rugMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
    });
    const rugMesh = new THREE.Mesh(rugGeo, rugMat);
    rugMesh.position.set(2.5, 0.02, -0.2);
    rugMesh.receiveShadow = true;
    scene.add(rugMesh);

    // Back Accent Wall behind Samsung TV & TV Stand (Z = -2.85)
    const backWallGeo = new THREE.BoxGeometry(6.4, 3.6, 0.22);
    const backWallMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.6,
    });
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(2.8, 1.8, -2.85);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Acoustic Walnut Wood Slats on the TV Wall
    const slatMat = new THREE.MeshStandardMaterial({
      color: 0x452715,
      roughness: 0.45,
    });
    for (let sx = 0.2; sx <= 5.2; sx += 0.22) {
      if (sx > 1.2 && sx < 3.8) continue; // Frame around the Samsung TV
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.09, 3.4, 0.06), slatMat);
      slat.position.set(sx, 1.8, -2.72);
      scene.add(slat);
    }

    // Balcony Glass Partition Divider between Rooftop & Living Room (at X = -0.35)
    const doorFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.25,
    });
    const headerBeam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 7.2), doorFrameMat);
    headerBeam.position.set(-0.35, 3.45, 0.6);
    scene.add(headerBeam);

    const glassDoorRear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.35, 3.1), railingGlassMat);
    glassDoorRear.position.set(-0.35, 1.68, -1.2);
    scene.add(glassDoorRear);

    // ================= TV STAND (ARCHITECTURAL MEDIA CONSOLE) =================
    const tvStandGroup = new THREE.Group();
    tvStandGroup.position.set(2.5, 0, -2.25);
    scene.add(tvStandGroup);

    const walnutMat = new THREE.MeshStandardMaterial({
      color: 0x4a2c18,
      roughness: 0.38,
      metalness: 0.1,
    });
    const matteSlateMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.5,
    });

    // Top console plank
    const consoleTop = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.06, 0.68), walnutMat);
    consoleTop.position.set(0, 0.68, 0);
    consoleTop.castShadow = true;
    consoleTop.receiveShadow = true;
    tvStandGroup.add(consoleTop);

    // Bottom console plank
    const consoleBottom = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.06, 0.68), walnutMat);
    consoleBottom.position.set(0, 0.18, 0);
    consoleBottom.castShadow = true;
    tvStandGroup.add(consoleBottom);

    // Side & divider panels + cabinet doors
    const leftCabinet = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.44, 0.64), matteSlateMat);
    leftCabinet.position.set(-0.92, 0.43, 0);
    tvStandGroup.add(leftCabinet);

    const rightCabinet = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.44, 0.64), matteSlateMat);
    rightCabinet.position.set(0.92, 0.43, 0);
    tvStandGroup.add(rightCabinet);

    // Center open shelf for DVB-S2 Satellite Receiver
    const centerShelf = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.03, 0.62), walnutMat);
    centerShelf.position.set(0, 0.42, 0);
    tvStandGroup.add(centerShelf);

    // Steel legs
    for (const lx of [-1.2, 1.2]) {
      for (const lz of [-0.26, 0.26]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.18, 12), steelMat);
        leg.position.set(lx, 0.09, lz);
        tvStandGroup.add(leg);
      }
    }

    // ================= DIGITAL DVB-S2 SATELLITE RECEIVER (SET-TOP BOX) =================
    const receiverGroup = new THREE.Group();
    receiverGroup.position.set(2.5, 0.48, -2.18);
    scene.add(receiverGroup);
    receiverGroupRef.current = receiverGroup;

    const stbChassis = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.11, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.7, roughness: 0.25 })
    );
    stbChassis.userData = { type: 'receiver' };
    receiverGroup.add(stbChassis);

    // 7-Segment LED Front Panel Canvas Texture on DVB-S2 Receiver
    const stbCanvas = document.createElement('canvas');
    stbCanvas.width = 256;
    stbCanvas.height = 64;
    stbLedCanvasRef.current = stbCanvas;
    const stbTex = new THREE.CanvasTexture(stbCanvas);
    stbLedTextureRef.current = stbTex;

    const stbFrontPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.085),
      new THREE.MeshBasicMaterial({ map: stbTex })
    );
    stbFrontPanel.position.set(0, 0, 0.182);
    stbFrontPanel.userData = { type: 'receiver' };
    receiverGroup.add(stbFrontPanel);

    // ================= SAMSUNG 65" NEO QLED 4K SMART TV =================
    const samsungTvGroup = new THREE.Group();
    samsungTvGroup.position.set(2.5, 1.56, -2.28);
    scene.add(samsungTvGroup);

    // Brushed metallic pedestal neck & base plate sitting on the TV stand
    const pedestalBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.025, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2 })
    );
    pedestalBase.position.set(0, -0.84, 0.04);
    samsungTvGroup.add(pedestalBase);

    const pedestalNeck = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.26, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 })
    );
    pedestalNeck.position.set(0, -0.72, -0.02);
    samsungTvGroup.add(pedestalNeck);

    // Ultra-thin Samsung Neo QLED Outer Metallic Bezel (16:9 ratio: 2.24m x 1.28m)
    const tvBezel = new THREE.Mesh(
      new THREE.BoxGeometry(2.26, 1.3, 0.045),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.2 })
    );
    tvBezel.castShadow = true;
    tvBezel.userData = { type: 'samsung_tv' };
    samsungTvGroup.add(tvBezel);

    // Bottom Chrome Chin with "SAMSUNG" Logo Badge
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 256;
    badgeCanvas.height = 48;
    const bCtx = badgeCanvas.getContext('2d')!;
    bCtx.fillStyle = '#0f172a';
    bCtx.fillRect(0, 0, 256, 48);
    bCtx.fillStyle = '#e2e8f0';
    bCtx.font = 'bold 24px "Space Grotesk", sans-serif';
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.letterSpacing = '4px';
    bCtx.fillText('SAMSUNG', 128, 24);
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);

    const samsungBadgeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.045),
      new THREE.MeshBasicMaterial({ map: badgeTex })
    );
    samsungBadgeMesh.position.set(0, -0.635, 0.026);
    samsungTvGroup.add(samsungBadgeMesh);

    // Red/Cyan Standby Eye LED under Samsung badge
    const standbyLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.008, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    standbyLed.position.set(0.18, -0.635, 0.026);
    samsungTvGroup.add(standbyLed);

    // Live Dynamic 2D Canvas Screen on the Samsung TV
    const tvCanvas = document.createElement('canvas');
    tvCanvas.width = 1024;
    tvCanvas.height = 576;
    tvScreenCanvasRef.current = tvCanvas;
    const tvScreenTex = new THREE.CanvasTexture(tvCanvas);
    tvScreenTex.minFilter = THREE.LinearFilter;
    tvScreenTextureRef.current = tvScreenTex;

    const tvScreenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.18, 1.22),
      new THREE.MeshBasicMaterial({ map: tvScreenTex })
    );
    tvScreenMesh.position.set(0, 0.01, 0.025);
    tvScreenMesh.userData = { type: 'samsung_tv' };
    samsungTvGroup.add(tvScreenMesh);

    // ================= RG-6 COAXIAL CABLE ROUTING (LNB -> MAST -> WALL -> RECEIVER) =================
    const coaxCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.4, 1.35, 0.85), // Near LNB / Dish arm
      new THREE.Vector3(-3.4, 0.85, 1.45), // Down mast pole
      new THREE.Vector3(-3.4, 0.08, 1.48), // Mast base
      new THREE.Vector3(-1.8, 0.06, -1.8), // Across rooftop deck
      new THREE.Vector3(-0.35, 0.14, -2.55), // Wall weatherproof conduit feed-through
      new THREE.Vector3(1.4, 0.14, -2.55), // Along living room baseboard
      new THREE.Vector3(2.5, 0.48, -2.35), // Into LNB-IN port on back of DVB-S2 Receiver
    ]);
    const coaxGeo = new THREE.TubeGeometry(coaxCurve, 64, 0.022, 8, false);
    const coaxMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    });
    const coaxMesh = new THREE.Mesh(coaxGeo, coaxMat);
    scene.add(coaxMesh);
    coaxTubeRef.current = coaxMesh;

    // Animated RF Signal Pulse Sphere traveling along Coaxial Cable when Locked
    const pulseSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    scene.add(pulseSphere);
    coaxPulseRef.current = pulseSphere;

    // ================= POINTER INTERACTION (ORBIT, CLICK INSPECTION & DIRECT DISH DRAG) =================
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let isPointerDown = false;
    let dragMode: 'orbit' | 'dish' | null = null;
    let downX = 0;
    let downY = 0;
    let lastX = 0;
    let lastY = 0;

    const getIntersections = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(scene.children, true);
    };

    const handlePointerDown = (e: PointerEvent) => {
      isPointerDown = true;
      downX = e.clientX;
      downY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;

      const hits = getIntersections(e.clientX, e.clientY);
      const hitDish = hits.find(
        (h) => h.object.userData?.type === 'dish' || h.object.userData?.type === 'lnb'
      );

      if (hitDish && stateRef.current.rig.dishMounted) {
        dragMode = 'dish';
        setIsDraggingDish(true);
      } else {
        dragMode = 'orbit';
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPointerDown) {
        // Hover detection for helpful tooltip hints
        const hits = getIntersections(e.clientX, e.clientY);
        const interactiveHit = hits.find((h) => h.object.userData?.type);
        if (interactiveHit) {
          const t = interactiveHit.object.userData.type;
          if (t === 'samsung_tv') {
            setHoverHint('Click Samsung 65" QLED TV to open DVB-S2 OSD & Live IPTV Player');
            renderer.domElement.style.cursor = 'pointer';
          } else if (t === 'receiver') {
            setHoverHint('Click DVB-S2 Receiver to scan Satellite Transponders & Channels');
            renderer.domElement.style.cursor = 'pointer';
          } else if (t === 'dish' || t === 'lnb') {
            setHoverHint('Drag Dish directly to align Azimuth/Elevation (or use precision gimbal)');
            renderer.domElement.style.cursor = 'grab';
          }
        } else {
          setHoverHint(null);
          renderer.domElement.style.cursor = 'default';
        }
        return;
      }

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (dragMode === 'dish') {
        // Direct 3D dish manipulation: horizontal drag adjusts Azimuth, vertical drag adjusts Elevation
        const cur = stateRef.current.orientation;
        const nextAz = Number(((cur.azimuth + dx * 0.25 + 360) % 360).toFixed(1));
        const nextEl = Number(Math.max(0, Math.min(90, cur.elevation - dy * 0.2)).toFixed(1));
        onChangeOrientation({
          ...cur,
          azimuth: nextAz,
          elevation: nextEl,
        });
      } else if (dragMode === 'orbit') {
        const cam = camSphericalRef.current;
        cam.desiredTheta -= dx * 0.0055;
        cam.desiredPhi = Math.max(0.35, Math.min(1.52, cam.desiredPhi - dy * 0.0055));
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const movedDist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (isPointerDown && movedDist < 6) {
        // Treat as a click! Check what 3D object was clicked
        const hits = getIntersections(e.clientX, e.clientY);
        const interactiveHit = hits.find((h) => h.object.userData?.type);
        if (interactiveHit) {
          const t = interactiveHit.object.userData.type;
          if (t === 'samsung_tv' || t === 'receiver') {
            onOpenTvOsd();
          } else if (t === 'dish' || t === 'lnb') {
            if (!stateRef.current.rig.dishMounted) {
              onOpenHardwareDrawer();
            }
          }
        }
      }
      isPointerDown = false;
      dragMode = null;
      setIsDraggingDish(false);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camSphericalRef.current;
      cam.desiredRadius = Math.max(1.8, Math.min(13.5, cam.desiredRadius + e.deltaY * 0.0035));
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    domElem.addEventListener('wheel', handleWheel, { passive: false });

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ================= ANIMATION & DYNAMIC TEXTURE LOOP =================
    let animFrameId = 0;
    let clock = 0;

    const updateDynamicCanvases = (t: number) => {
      const st = stateRef.current;

      // 1. Update DVB-S2 Receiver 7-Segment LED Display
      const stbCanvasEl = stbLedCanvasRef.current;
      if (stbCanvasEl && stbLedTextureRef.current) {
        const ctx = stbCanvasEl.getContext('2d')!;
        ctx.fillStyle = '#050811';
        ctx.fillRect(0, 0, 256, 64);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 252, 60);

        if (!st.rig.receiverConnected) {
          ctx.fillStyle = '#475569';
          ctx.font = 'bold 22px "JetBrains Mono", monospace';
          ctx.fillText('OFFLINE', 24, 40);
        } else {
          // Power & Lock LEDs
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(22, 32, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = st.signalMetrics.isLocked ? '#00f0ff' : '#ef4444';
          ctx.beginPath();
          ctx.arc(42, 32, 6, 0, Math.PI * 2);
          ctx.fill();

          // 7-segment style text
          ctx.fillStyle = st.signalMetrics.isLocked ? '#10b981' : '#f59e0b';
          ctx.font = 'bold 28px "JetBrains Mono", monospace';
          const ledText = st.isScanning
            ? `SC${String(st.scanProgress).padStart(2, '0')}`
            : st.activeChannel
            ? `CH${String(st.activeChannel.channelNumber).padStart(2, '0')}`
            : st.signalMetrics.isLocked
            ? 'LOCK'
            : 'noSG';
          ctx.fillText(ledText, 66, 42);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '14px "JetBrains Mono", monospace';
          ctx.fillText(`${st.signalMetrics.snrDb.toFixed(1)}dB`, 178, 38);
        }
        stbLedTextureRef.current.needsUpdate = true;
      }

      // 2. Update 3D Samsung TV Screen Texture
      const tvCanvasEl = tvScreenCanvasRef.current;
      if (tvCanvasEl && tvScreenTextureRef.current) {
        const ctx = tvCanvasEl.getContext('2d')!;
        const w = tvCanvasEl.width;
        const h = tvCanvasEl.height;

        if (!st.rig.receiverConnected) {
          ctx.fillStyle = '#070b14';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 42px "Space Grotesk", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SAMSUNG Neo QLED', w / 2, h / 2 - 40);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '26px "Inter", sans-serif';
          ctx.fillText('HDMI 1: No DVB-S2 Receiver Connected', w / 2, h / 2 + 20);
          ctx.fillStyle = '#00f0ff';
          ctx.font = '22px "JetBrains Mono", monospace';
          ctx.fillText('[ Install & Connect Receiver in Hardware Drawer ]', w / 2, h / 2 + 75);
        } else if (!st.signalMetrics.isLocked) {
          // Animated RF Snow / No Signal Diagnostic Screen on 3D TV
          ctx.fillStyle = '#090f1d';
          ctx.fillRect(0, 0, w, h);

          // Spectrum analyzer wave across the screen
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let x = 40; x < w - 40; x += 12) {
            const noise =
              Math.sin(x * 0.04 + t * 5) * 22 +
              Math.cos(x * 0.11 - t * 3) * (st.signalMetrics.signalStrengthPct * 0.45);
            const y = h * 0.55 - noise;
            if (x === 40) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Diagnostic Box
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.fillRect(w / 2 - 310, h / 2 - 120, 620, 190);
          ctx.strokeRect(w / 2 - 310, h / 2 - 120, 620, 190);

          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 34px "Space Grotesk", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('NO SATELLITE TRANSPONDER LOCK', w / 2, h / 2 - 60);

          ctx.fillStyle = '#f1f5f9';
          ctx.font = '24px "JetBrains Mono", monospace';
          ctx.fillText(
            `AZ: ${st.orientation.azimuth.toFixed(1)}°  |  EL: ${st.orientation.elevation.toFixed(1)}°  |  SNR: ${st.signalMetrics.snrDb.toFixed(1)} dB`,
            w / 2,
            h / 2 - 8
          );

          ctx.fillStyle = '#00f0ff';
          ctx.font = '22px "Inter", sans-serif';
          ctx.fillText('Align rooftop dish or click TV to open DVB-S2 OSD Menu', w / 2, h / 2 + 40);
        } else {
          // Locked onto Satellite! Render dynamic broadcast visualization + OSD banner on 3D TV
          const grad = ctx.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, '#061a2e');
          grad.addColorStop(0.5, '#0b2b40');
          grad.addColorStop(1, '#081c24');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);

          // Animated orbital broadcast rings on the 3D TV canvas
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
          ctx.lineWidth = 3;
          for (let r = 60; r <= 240; r += 60) {
            ctx.beginPath();
            ctx.arc(w / 2, h / 2 - 30, r + Math.sin(t * 2 + r) * 8, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 28px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(
            `● SIGNAL LOCKED: ${st.signalMetrics.lockedSatellite?.name} (${st.signalMetrics.lockedSatellite?.orbitalSlot})`,
            w / 2,
            90
          );

          if (st.activeChannel) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 52px "Space Grotesk", sans-serif';
            ctx.fillText(st.activeChannel.name, w / 2, h / 2 - 20);

            ctx.fillStyle = '#00f0ff';
            ctx.font = '28px "JetBrains Mono", monospace';
            ctx.fillText(
              `CH ${st.activeChannel.channelNumber} • ${st.activeChannel.transponderFreq} MHz ${st.activeChannel.polarization} • ${st.activeChannel.resolution}`,
              w / 2,
              h / 2 + 35
            );

            ctx.fillStyle = '#34d399';
            ctx.font = 'bold 24px "Inter", sans-serif';
            ctx.fillText(
              '▶ CLICK SAMSUNG TV FOR FULL LIVE HLS IPTV STREAM & REMOTE',
              w / 2,
              h / 2 + 95
            );
          } else {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 42px "Space Grotesk", sans-serif';
            ctx.fillText('TRANSPONDER LOCKED & READY', w / 2, h / 2 - 10);

            ctx.fillStyle = '#00f0ff';
            ctx.font = 'bold 28px "Inter", sans-serif';
            ctx.fillText(
              '▶ Click Samsung TV or Receiver to Scan Frequencies & Watch IPTV',
              w / 2,
              h / 2 + 50
            );
          }

          // Bottom DVB-S2 OSD Info Bar on 3D TV
          ctx.fillStyle = 'rgba(11, 15, 23, 0.92)';
          ctx.fillRect(30, h - 110, w - 60, 84);
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2;
          ctx.strokeRect(30, h - 110, w - 60, 84);

          ctx.fillStyle = '#f1f5f9';
          ctx.font = 'bold 24px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(
            `SNR: ${st.signalMetrics.snrDb.toFixed(1)} dB   STR: ${st.signalMetrics.signalStrengthPct}%   QUAL: ${st.signalMetrics.signalQualityPct}%   BER: ${st.signalMetrics.ber}`,
            60,
            h - 58
          );
        }

        tvScreenTextureRef.current.needsUpdate = true;
      }
    };

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      clock += 0.016;
      const st = stateRef.current;

      // Smoothly interpolate camera spherical coordinates
      const cam = camSphericalRef.current;
      cam.target.lerp(cam.desiredTarget, 0.08);
      cam.radius += (cam.desiredRadius - cam.radius) * 0.08;
      cam.theta += (cam.desiredTheta - cam.theta) * 0.08;
      cam.phi += (cam.desiredPhi - cam.phi) * 0.08;

      camera.position.x = cam.target.x + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta);
      camera.position.y = cam.target.y + cam.radius * Math.cos(cam.phi);
      camera.position.z = cam.target.z + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta);
      camera.lookAt(cam.target);

      // Update 3D hardware visibility & scale based on InstalledRig
      if (mastGroupRef.current) {
        mastGroupRef.current.visible = st.rig.mastBolted;
      }

      if (dishYawGroupRef.current && dishPitchGroupRef.current) {
        dishPitchGroupRef.current.visible = st.rig.dishMounted;
        // Azimuth 0° = North (-Z), 90° = East (+X), 180° = South (+Z), 270° = West (-X)
        // Since dish local forward is -Z, rotating around Y by -azimuth*DEG2RAD points local -Z toward (sin(Az), 0, -cos(Az))!
        const targetYaw = -(st.orientation.azimuth * Math.PI) / 180;
        const targetPitch = (st.orientation.elevation * Math.PI) / 180;
        dishYawGroupRef.current.rotation.y = targetYaw;
        dishPitchGroupRef.current.rotation.x = targetPitch;

        // Scale dish mesh according to purchased dish diameter (60cm -> 0.82, 90cm -> 1.0, 120cm -> 1.24, 180cm -> 1.55)
        const dishItem = HARDWARE_CATALOG.find((h) => h.id === st.rig.activeDishId);
        const diam = dishItem?.specs.diameterCm ?? 90;
        const scaleFactor =
          diam === 60 ? 0.8 : diam === 90 ? 1.0 : diam === 120 ? 1.22 : 1.52;
        if (dishReflectorMeshRef.current && dishWireMeshRef.current) {
          dishReflectorMeshRef.current.scale.setScalar(scaleFactor);
          dishWireMeshRef.current.scale.setScalar(scaleFactor);
          const isMesh = Boolean(dishItem?.specs.meshDish);
          (dishReflectorMeshRef.current.material as THREE.MeshStandardMaterial).opacity = isMesh
            ? 0.45
            : 1.0;
          (dishReflectorMeshRef.current.material as THREE.MeshStandardMaterial).transparent =
            isMesh;
          (dishWireMeshRef.current.material as THREE.MeshBasicMaterial).opacity = isMesh
            ? 0.55
            : 0.0;
        }
      }

      if (lnbGroupRef.current) {
        lnbGroupRef.current.visible = st.rig.lnbAttached;
        lnbGroupRef.current.rotation.z = (st.orientation.skew * Math.PI) / 180;
      }

      if (coaxTubeRef.current && coaxPulseRef.current) {
        coaxTubeRef.current.visible = st.rig.cableRouted;
        coaxPulseRef.current.visible = st.rig.cableRouted && st.signalMetrics.isLocked;
        if (coaxPulseRef.current.visible) {
          const u = (clock * 0.65) % 1;
          const pt = coaxCurve.getPointAt(u);
          coaxPulseRef.current.position.copy(pt);
        }
      }

      if (receiverGroupRef.current) {
        receiverGroupRef.current.visible = st.rig.receiverConnected;
      }

      // Update 3D RF Boresight Cone color based on Signal Lock / SNR
      if (beamConeRef.current && beamLineRef.current) {
        const coneMat = beamConeRef.current.material as THREE.MeshBasicMaterial;
        const lineMat = beamLineRef.current.material as THREE.LineBasicMaterial;
        if (!st.rig.dishMounted || !st.rig.lnbAttached) {
          beamConeRef.current.visible = false;
          beamLineRef.current.visible = false;
        } else {
          beamConeRef.current.visible = true;
          beamLineRef.current.visible = true;
          if (st.signalMetrics.isLocked) {
            coneMat.color.setHex(0x10b981);
            coneMat.opacity = 0.22 + Math.sin(clock * 6) * 0.04;
            lineMat.color.setHex(0x10b981);
          } else if (st.signalMetrics.snrDb >= 3.5) {
            coneMat.color.setHex(0xf59e0b);
            coneMat.opacity = 0.17;
            lineMat.color.setHex(0xf59e0b);
          } else {
            coneMat.color.setHex(0xef4444);
            coneMat.opacity = 0.11;
            lineMat.color.setHex(0x00f0ff);
          }
        }
      }

      // Update Weather Rain Fade particles
      if (rainParticlesRef.current) {
        const rMat = rainParticlesRef.current.material as THREE.PointsMaterial;
        rMat.opacity = st.weather === 'rain_fade' ? 0.65 : st.weather === 'cloudy' ? 0.18 : 0.0;
        if (rMat.opacity > 0) {
          const posAttr = rainParticlesRef.current.geometry.getAttribute(
            'position'
          ) as THREE.BufferAttribute;
          for (let i = 0; i < posAttr.count; i++) {
            let y = posAttr.getY(i) - 0.18;
            if (y < 0) y = 14;
            posAttr.setY(i, y);
          }
          posAttr.needsUpdate = true;
        }
      }

      // Update TV Screen & STB LED canvas textures every ~4 frames
      if (Math.floor(clock * 60) % 4 === 0) {
        updateDynamicCanvases(clock);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameId);
      domElem.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      domElem.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Three.js WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Interactive 3D Hover / Drag Status Pill */}
      {(hoverHint || isDraggingDish) && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-[#0B0F17]/90 border border-[#00F0FF]/50 text-xs font-mono-tech text-[#00F0FF] shadow-lg backdrop-blur-md flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-ping" />
          <span>
            {isDraggingDish
              ? `DIRECT 3D GIMBAL DRAG — AZ: ${orientation.azimuth.toFixed(1)}° | EL: ${orientation.elevation.toFixed(1)}°`
              : hoverHint}
          </span>
        </div>
      )}
    </div>
  );
};
