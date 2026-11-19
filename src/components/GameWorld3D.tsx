import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { GameObstacleKind, PlayerAction } from '@/lib/gameMode'

export type GameWorldObstacle = {
  id: number
  lane: number
  progress: number
  kind: GameObstacleKind
}

export type GameWorldCollectible = {
  id: number
  lane: number
  progress: number
  kind: 'capsule' | 'gold'
}

type GameEvent = 'none' | 'hit' | 'dodge' | 'collect' | 'gold'

type Props = {
  running: boolean
  checkpoint: boolean
  lane: number
  action: PlayerAction
  obstacles: GameWorldObstacle[]
  collectibles: GameWorldCollectible[]
  worldIndex: number
  onSwipe: (direction: 'left' | 'right' | 'up' | 'down') => void
  /** One-shot game event used for screen shake / Lilo reaction (reset to 'none' each render). */
  event?: GameEvent
}

const LANE_POSITIONS = [-2.5, 0, 2.5]
const WORLD_SKIES = [
  { sky: 0x8bcff2, horizon: 0x356a82, fog: 0x8bcff2, fogNear: 42, fogFar: 112 }, // Pharmora Central
  { sky: 0x94d8f3, horizon: 0x457a92, fog: 0x94d8f3, fogNear: 45, fogFar: 115 }, // Riverside Station
  { sky: 0xa2dcef, horizon: 0x558aa8, fog: 0xa2dcef, fogNear: 48, fogFar: 118 }, // Garden District
]

const STREAK_COUNT = 14
const SHAKE_DURATION_FRAMES = 8

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  parent.add(mesh)
  return mesh
}

function createObstacle(kind: GameObstacleKind) {
  const group = new THREE.Group()
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x273b4a, metalness: 0.55, roughness: 0.32 })
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf3b736, roughness: 0.42 })
  const white = new THREE.MeshStandardMaterial({ color: 0xe7f0eb, roughness: 0.3 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x075985, emissiveIntensity: 0.48 })
  const warning = new THREE.MeshStandardMaterial({ color: 0xff4d4d, emissive: 0x4d0000, emissiveIntensity: 0.6 })

  if (kind === 'low') {
    addMesh(group, new THREE.CylinderGeometry(0.52, 0.62, 0.95, 14), yellow, [0, 0.48, 0])
    addMesh(group, new THREE.CylinderGeometry(0.64, 0.64, 0.16, 14), darkMetal, [0, 0.96, 0])
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.63, 0.63, 0.22, 14),
      new THREE.MeshStandardMaterial({ color: 0x202c32 }),
    )
    stripe.position.y = 0.58
    group.add(stripe)
    // Reflector strip that flashes on close approach
    const flash = addMesh(group, new THREE.RingGeometry(0.60, 0.66, 16), warning, [0, 0.99, 0.01])
    flash.rotation.x = Math.PI / 2
    ;(group as any).userData = { flash }
  } else if (kind === 'overhead') {
    addMesh(group, new THREE.BoxGeometry(0.12, 2.45, 0.12, 4, 14, 4), darkMetal, [-0.75, 2.05, 0])
    addMesh(group, new THREE.BoxGeometry(0.12, 2.45, 0.12, 4, 14, 4), darkMetal, [0.75, 2.05, 0])
    addMesh(group, new THREE.BoxGeometry(1.7, 0.82, 0.32), yellow, [0, 2.85, 0])
    addMesh(group, new THREE.BoxGeometry(1.8, 0.11, 0.4), darkMetal, [0, 1.17, 0])
    const flash = addMesh(group, new THREE.BoxGeometry(1.85, 0.16, 0.42), warning, [0, 1.17, 0])
    ;(group as any).userData = { flash }
  } else {
    addMesh(group, new THREE.BoxGeometry(1.6, 2.8, 1.15), white, [0, 1.4, 0])
    addMesh(group, new THREE.BoxGeometry(1.28, 2.3, 0.04), glass, [0, 1.45, 0.6])
    addMesh(group, new THREE.BoxGeometry(0.07, 0.18, 0.08), darkMetal, [0.5, 1.4, 0.66])
    const flash = addMesh(group, new THREE.BoxGeometry(1.68, 2.9, 1.23), warning, [0, 1.4, 0])
    flash.material.transparent = true
    flash.material.opacity = 0
    ;(group as any).userData = { flash }
  }
  return group
}

function createCollectible(kind: GameWorldCollectible['kind']) {
  const group = new THREE.Group()
  const baseColor = kind === 'gold' ? 0xfbbf24 : 0x22d3ee
  const emissiveColor = kind === 'gold' ? 0xb45309 : 0x0369a1
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    emissive: emissiveColor,
    emissiveIntensity: 0.55,
    metalness: 0.48,
    roughness: 0.25,
  })
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: kind === 'gold' ? 0xfde047 : 0x67e8f9,
    transparent: true,
    opacity: 0,
  })
  if (kind === 'gold') {
    addMesh(group, new THREE.CylinderGeometry(0.3, 0.2, 0.3, 20), material, [0, 0, 0])
    addMesh(group, new THREE.CylinderGeometry(0.07, 0.1, 0.46, 16), material, [0.09, 0.17, 0]).rotation.z = -0.48
  } else {
    const capsule = addMesh(group, new THREE.CapsuleGeometry(0.2, 0.42, 6, 12), material, [0, 0, 0])
    capsule.rotation.z = -0.42
  }
  const halo = addMesh(
    group,
    new THREE.TorusGeometry(0.48, 0.035, 10, 30),
    new THREE.MeshBasicMaterial({ color: kind === 'gold' ? 0xfde047 : 0x67e8f9 }),
    [0, 0, 0],
  )
  halo.rotation.x = Math.PI / 2
  const glow = addMesh(
    group,
    new THREE.SphereGeometry(0.55, 16, 16),
    glowMaterial,
    [0, 0, 0],
  )
  ;(group as any).userData = { glow, halo, kind }
  return group
}

function createTree(leafColor: number) {
  const group = new THREE.Group()
  const bark = new THREE.MeshStandardMaterial({ color: 0x76513a, roughness: 0.92 })
  const leaves = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.88 })
  addMesh(group, new THREE.CylinderGeometry(0.15, 0.24, 2.3, 10), bark, [0, 1.15, 0])
  addMesh(group, new THREE.SphereGeometry(0.9, 14, 12), leaves, [0, 2.7, 0]).scale.set(1.1, 1.25, 1)
  addMesh(group, new THREE.SphereGeometry(0.72, 14, 12), leaves, [-0.55, 2.35, 0.08])
  addMesh(group, new THREE.SphereGeometry(0.72, 14, 12), leaves, [0.55, 2.35, -0.08])
  return group
}

function createBuilding(color: number) {
  const group = new THREE.Group()
  const facade = new THREE.MeshStandardMaterial({ color, roughness: 0.86 })
  const glass = new THREE.MeshStandardMaterial({
    color: 0x91cce0,
    emissive: 0x356a78,
    emissiveIntensity: 0.16,
    metalness: 0.12,
    roughness: 0.25,
  })
  const trim = new THREE.MeshStandardMaterial({ color: 0xf0e3c9, roughness: 0.72 })
  addMesh(group, new THREE.BoxGeometry(5.8, 7.6, 8), facade, [0, 3.8, 0])
  addMesh(group, new THREE.BoxGeometry(6.1, 0.3, 8.3), trim, [0, 7.75, 0])
  for (const x of [-1.55, 1.55]) {
    for (const y of [1.65, 3.65, 5.65]) {
      addMesh(group, new THREE.BoxGeometry(1.05, 1.24, 0.07), glass, [x, y, 4.04])
    }
  }
  addMesh(group, new THREE.BoxGeometry(1.15, 1.9, 0.08), trim, [0, 0.95, 4.05])
  return group
}

function createParkedCar(color: number) {
  const group = new THREE.Group()
  const body = new THREE.MeshStandardMaterial({ color, metalness: 0.18, roughness: 0.34 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x9bd4e4, metalness: 0.2, roughness: 0.2 })
  const tire = new THREE.MeshStandardMaterial({ color: 0x202c32, roughness: 0.86 })
  addMesh(group, new THREE.BoxGeometry(2.15, 0.68, 3.8), body, [0, 0.64, 0])
  addMesh(group, new THREE.BoxGeometry(1.72, 0.72, 2.05), body, [0, 1.22, -0.12])
  addMesh(group, new THREE.BoxGeometry(1.42, 0.42, 0.08), glass, [0, 1.63, 0.93])
  addMesh(group, new THREE.BoxGeometry(1.35, 0.38, 0.08), glass, [0, 1.62, -1.16])
  for (const x of [-0.9, 0.9]) {
    for (const z of [-1.18, 1.18]) {
      const wheel = addMesh(group, new THREE.CylinderGeometry(0.32, 0.32, 0.18, 14), tire, [x, 0.34, z])
      wheel.rotation.x = Math.PI / 2
    }
  }
  return group
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.geometry.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => material.dispose())
  })
}

function createLilo() {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  const darkBrown = new THREE.MeshStandardMaterial({ color: 0x51331f, roughness: 0.62 })
  const brown = new THREE.MeshStandardMaterial({ color: 0x895432, roughness: 0.58 })
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff0d2, roughness: 0.62 })
  const coat = new THREE.MeshStandardMaterial({ color: 0xf6f7f1, roughness: 0.5 })
  const orange = new THREE.MeshStandardMaterial({ color: 0xf4a62a, roughness: 0.38 })
  const gold = new THREE.MeshStandardMaterial({ color: 0xffbd3d, metalness: 0.12, roughness: 0.28 })
  const black = new THREE.MeshStandardMaterial({ color: 0x101b23, roughness: 0.2 })
  const highlight = new THREE.MeshBasicMaterial({ color: 0xffffff })

  addMesh(body, new THREE.SphereGeometry(0.59, 26, 20), brown, [0, 1.05, 0])
  addMesh(body, new THREE.SphereGeometry(0.48, 26, 20), cream, [0, 0.88, 0.31]).scale.set(0.84, 0.9, 0.54)
  addMesh(body, new THREE.SphereGeometry(0.55, 22, 18), coat, [0, 0.96, -0.41]).scale.set(0.92, 1.05, 0.5)
  addMesh(body, new THREE.TorusGeometry(0.34, 0.055, 10, 26), coat, [0, 1.48, -0.05])
  addMesh(body, new THREE.SphereGeometry(0.69, 26, 20), darkBrown, [0, 1.86, 0.02]).scale.set(1, 0.85, 0.78)
  addMesh(body, new THREE.ConeGeometry(0.2, 0.44, 6), darkBrown, [-0.36, 2.37, 0.01]).rotation.z = 0.38
  addMesh(body, new THREE.ConeGeometry(0.2, 0.44, 6), darkBrown, [0.36, 2.37, 0.01]).rotation.z = -0.38
  addMesh(body, new THREE.SphereGeometry(0.3, 18, 14), brown, [-0.55, 1.04, 0.02]).scale.set(0.48, 1.1, 0.55)
  addMesh(body, new THREE.SphereGeometry(0.3, 18, 14), brown, [0.55, 1.04, 0.02]).scale.set(0.48, 1.1, 0.55)

  const eyeMeshes: THREE.Mesh[] = []
  for (const eyeX of [-0.25, 0.25]) {
    const white = addMesh(body, new THREE.SphereGeometry(0.28, 22, 16), cream, [eyeX, 1.91, 0.54])
    const iris = addMesh(body, new THREE.SphereGeometry(0.17, 20, 16), gold, [eyeX + 0.025, 1.9, 0.76])
    const pupil = addMesh(body, new THREE.SphereGeometry(0.09, 18, 14), black, [eyeX + 0.04, 1.9, 0.88])
    addMesh(body, new THREE.SphereGeometry(0.035, 12, 10), highlight, [eyeX + 0.015, 1.96, 0.95])
    eyeMeshes.push(white, iris, pupil)
  }

  const beak = addMesh(body, new THREE.ConeGeometry(0.14, 0.27, 6), orange, [0, 1.59, 0.69])
  beak.rotation.x = Math.PI / 2
  const headphoneBand = addMesh(body, new THREE.TorusGeometry(0.64, 0.075, 12, 36, Math.PI), darkBrown, [0, 2.01, 0.04])
  addMesh(body, new THREE.BoxGeometry(0.2, 0.57, 0.31), darkBrown, [-0.68, 1.83, 0.04])
  addMesh(body, new THREE.BoxGeometry(0.2, 0.57, 0.31), darkBrown, [0.68, 1.83, 0.04])
  addMesh(body, new THREE.BoxGeometry(0.26, 0.12, 0.12), gold, [0.44, 0.88, 0.64])

  const leftArm = addMesh(body, new THREE.CapsuleGeometry(0.13, 0.52, 6, 8), coat, [-0.58, 0.95, 0.02])
  leftArm.rotation.z = 0.45
  const rightArm = addMesh(body, new THREE.CapsuleGeometry(0.13, 0.52, 6, 8), coat, [0.58, 0.95, 0.02])
  rightArm.rotation.z = -0.45
  const leftLeg = addMesh(root, new THREE.CylinderGeometry(0.1, 0.13, 0.39, 12), orange, [-0.25, 0.28, 0.02])
  const rightLeg = addMesh(root, new THREE.CylinderGeometry(0.1, 0.13, 0.39, 12), orange, [0.25, 0.28, 0.02])
  addMesh(root, new THREE.SphereGeometry(0.2, 14, 12), orange, [-0.25, 0.1, 0.16]).scale.set(1.15, 0.48, 1.3)
  addMesh(root, new THREE.SphereGeometry(0.2, 14, 12), orange, [0.25, 0.1, 0.16]).scale.set(1.15, 0.48, 1.3)

  // Shadow plane beneath Lilo
  const shadow = addMesh(
    root,
    new THREE.PlaneGeometry(0.7, 1.0),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
    [0, 0.02, 0],
  )
  shadow.rotation.x = -Math.PI / 2

  root.userData = {
    body,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    headphoneBand,
    eyeMeshes,
    shadow,
  }
  return root
}

function createStreak() {
  const group = new THREE.Group()
  const length = 0.35 + Math.random() * 0.6
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
  })
  const mesh = addMesh(group, new THREE.BoxGeometry(0.04, 0.04, length), material, [0, 0, 0])
  ;(group as any).userData = { mesh, length, baseOpacity: 0 }
  return group
}

export default function GameWorld3D({
  running,
  checkpoint,
  lane,
  action,
  obstacles,
  collectibles,
  worldIndex,
  onSwipe,
  event = 'none',
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const latestRef = useRef({ running, checkpoint, lane, action, obstacles, collectibles, worldIndex, onSwipe, event })
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const [sceneError, setSceneError] = useState('')
  latestRef.current = { running, checkpoint, lane, action, obstacles, collectibles, worldIndex, onSwipe, event }

  // Internal animation state
  const blinkRef = useRef(0) // time until next blink
  const leanRef = useRef(0) // target lean angle
  const prevLaneRef = useRef(lane)
  const shakeRef = useRef(0) // frames of shake remaining
  const prevEventRef = useRef<GameEvent>('none')
  const streakMeshes: THREE.Group[] = []

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer | null = null
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    } catch (error) {
      setSceneError(error instanceof Error ? error.message : 'WebGL is unavailable in this browser.')
      return
    }

    setSceneError('')
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.shadowMap.enabled = false
    renderer.domElement.setAttribute('aria-hidden', 'true')
    renderer.domElement.style.touchAction = 'none'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const world = WORLD_SKIES[worldIndex] ?? WORLD_SKIES[0]
    const backgroundColor = new THREE.Color(world.sky)
    scene.background = backgroundColor
    scene.fog = new THREE.Fog(world.fog, world.fogNear, world.fogFar)
    const camera = new THREE.PerspectiveCamera(58, host.clientWidth / host.clientHeight, 0.1, 150)
    camera.position.set(0, 4.25, 8.5)
    camera.lookAt(0, 1.3, -13)

    scene.add(new THREE.HemisphereLight(0xc9edff, 0x587958, 2.5))
    const keyLight = new THREE.DirectionalLight(0xfff4d8, 3.2)
    keyLight.position.set(-8, 16, 5)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0x8bcff2, 1.2)
    fillLight.position.set(8, -4, -5)
    scene.add(fillLight)

    // ---- Sky / horizon gradient band ----
    const horizonColor = new THREE.Color(world.horizon)
    const horizonGeometry = new THREE.PlaneGeometry(120, 22)
    const horizonColors: number[] = []
    const positionAttribute = horizonGeometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < positionAttribute.count; i++) {
      const y = positionAttribute.getY(i)
      const t = (y + 11) / 22 // 0 at bottom, 1 at top
      horizonColors.push(horizonColor.r, horizonColor.g, horizonColor.b, t)
    }
    horizonGeometry.setAttribute('color', new THREE.Float32BufferAttribute(horizonColors, 4))
    const horizonMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    const horizon = new THREE.Mesh(horizonGeometry, horizonMaterial)
    horizon.position.set(0, -0.05, -26)
    horizon.rotation.x = -Math.PI / 2
    scene.add(horizon)

    const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x6da96a, roughness: 1 })
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x465057, roughness: 0.94 })
    const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c6bd, roughness: 0.9 })
    const curbMaterial = new THREE.MeshStandardMaterial({ color: 0xe7e2cf, roughness: 0.8 })
    const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xffe6a3, roughness: 0.72 })
    const glowLineMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe6a3,
      transparent: true,
      opacity: 0.35,
    })
    const ground = addMesh(scene, new THREE.PlaneGeometry(70, 150), grassMaterial, [0, -0.22, -53])
    ground.rotation.x = -Math.PI / 2
    const road = addMesh(scene, new THREE.PlaneGeometry(10.4, 145), roadMaterial, [0, -0.08, -53])
    road.rotation.x = -Math.PI / 2
    for (const side of [-1, 1]) {
      const sidewalk = addMesh(scene, new THREE.PlaneGeometry(2.6, 145), sidewalkMaterial, [side * 6.5, -0.06, -53])
      sidewalk.rotation.x = -Math.PI / 2
      addMesh(scene, new THREE.BoxGeometry(0.18, 0.16, 145), curbMaterial, [side * 5.2, -0.01, -53])
      // Road-edge glow
      const edgeGlow = addMesh(
        scene,
        new THREE.PlaneGeometry(0.12, 145),
        glowLineMaterial,
        [side * 5.28, 0.01, -53],
      )
      edgeGlow.rotation.x = -Math.PI / 2
    }

    const roadMarkings: THREE.Mesh[] = []
    for (let index = 0; index < 28; index++) {
      const z = 8 - index * 5
      for (const x of [-1.25, 1.25]) {
        roadMarkings.push(addMesh(scene, new THREE.BoxGeometry(0.1, 0.025, 2.4), lineMaterial, [x, -0.055, z]))
      }
    }

    // Speed streaks (motion lines) — only visible while running
    for (let i = 0; i < STREAK_COUNT; i++) {
      const streak = createStreak()
      streak.position.set(
        (Math.random() - 0.5) * 6,
        0.1 + Math.random() * 1.2,
        -20 - Math.random() * 60,
      )
      streak.userData.baseOpacity = 0.18 + Math.random() * 0.25
      scene.add(streak)
      streakMeshes.push(streak)
    }

    const player = createLilo()
    player.position.set(0, 0.08, 1.6)
    player.rotation.y = Math.PI
    scene.add(player)

    const sideScenery: Array<{ group: THREE.Group; wrapLength: number }> = []
    const leafColors = [0x4c9850, 0x5ca957, 0x6cae5b]
    const buildingColors = [0xe8cda8, 0xd7e6e5, 0xe2d6c6, 0xcddfce]
    const carColors = [0xc64e45, 0x397d91, 0xe1b94c, 0x66767b]
    for (const side of [-1, 1]) {
      for (let index = 0; index < 10; index++) {
        const tree = createTree(leafColors[index % leafColors.length])
        tree.position.set(side * 8.7, -0.2, 8 - index * 13)
        scene.add(tree)
        sideScenery.push({ group: tree, wrapLength: 130 })
      }
      for (let index = 0; index < 6; index++) {
        const building = createBuilding(buildingColors[index % buildingColors.length])
        building.position.set(side * (13.5 + (index % 2) * 1.8), -0.2, 8 - index * 22)
        building.rotation.y = side * -0.06
        scene.add(building)
        sideScenery.push({ group: building, wrapLength: 132 })
      }
      for (let index = 0; index < 4; index++) {
        const car = createParkedCar(carColors[(index + (side > 0 ? 1 : 0)) % carColors.length])
        car.position.set(side * 6.5, -0.08, 4 - index * 32)
        scene.add(car)
        sideScenery.push({ group: car, wrapLength: 128 })
      }
    }

    const gate = new THREE.Group()
    const gateMaterial = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.82,
    })
    const gatePulseMaterial = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0,
    })
    addMesh(gate, new THREE.BoxGeometry(0.34, 4.5, 0.4), gateMaterial, [-4.1, 2.25, 0])
    addMesh(gate, new THREE.BoxGeometry(0.34, 4.5, 0.4), gateMaterial, [4.1, 2.25, 0])
    addMesh(gate, new THREE.BoxGeometry(8.5, 0.34, 0.4), gateMaterial, [0, 4.42, 0])
    const gateRing = addMesh(gate, new THREE.RingGeometry(3.6, 4.0, 24), gatePulseMaterial, [0, 2.25, 0])
    gateRing.rotation.x = Math.PI / 2
    gateRing.material.side = THREE.DoubleSide
    gate.position.set(0, 0, -12)
    scene.add(gate)

    const obstacleMeshes = new Map<number, { kind: GameObstacleKind; mesh: THREE.Group }>()
    const collectibleMeshes = new Map<number, { kind: GameWorldCollectible['kind']; mesh: THREE.Group }>()
    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return
      camera.aspect = host.clientWidth / host.clientHeight
      camera.updateProjectionMatrix()
      renderer?.setSize(host.clientWidth, host.clientHeight)
    }
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    resizeObserver?.observe(host)
    if (!resizeObserver) window.addEventListener('resize', resize)

    let lastFrame = 0
    let frameId = 0
    let activeWorldIndex = -1
    let blinkTimer = 0
    const animate = (time: number) => {
      frameId = window.requestAnimationFrame(animate)
      const delta = Math.min((time - lastFrame) / 1000, 0.05)
      lastFrame = time
      const current = latestRef.current

      // World / background / fog transitions
      if (activeWorldIndex !== current.worldIndex) {
        const world = WORLD_SKIES[current.worldIndex] ?? WORLD_SKIES[0]
        backgroundColor.setHex(world.sky)
        horizonColor.setHex(world.horizon)
        if (scene.fog instanceof THREE.Fog) {
          scene.fog.color.setHex(world.fog)
          scene.fog.near = world.fogNear
          scene.fog.far = world.fogFar
        }
        activeWorldIndex = current.worldIndex
      }

      // Screen shake (one-shot event reaction)
      const shakeFrames = shakeRef.current
      let shakeX = 0
      let shakeY = 0
      if (shakeFrames > 0) {
        shakeRef.current = shakeFrames - 1
        const shakeAmount = 0.14 * (shakeFrames / SHAKE_DURATION_FRAMES)
        shakeX = (Math.random() - 0.5) * shakeAmount
        shakeY = (Math.random() - 0.5) * shakeAmount
      }
      camera.position.set(shakeX, 4.25 + shakeY, 8.5)
      camera.lookAt(shakeX, 1.3, -13)

      // Detect new event for one-shot reactions
      if (current.event !== prevEventRef.current && current.event !== 'none') {
        shakeRef.current = SHAKE_DURATION_FRAMES
        prevEventRef.current = current.event
      } else if (current.event === 'none') {
        prevEventRef.current = 'none'
      }

      // Background color lerp toward world sky
      backgroundColor.lerpColors(backgroundColor, new THREE.Color(WORLD_SKIES[current.worldIndex]?.sky ?? world.sky), 0.06)
      scene.background = backgroundColor

      if (current.running) {
        for (const marking of roadMarkings) {
          marking.position.z += delta * 22
          if (marking.position.z > 10) marking.position.z -= 140
        }
        for (const scenery of sideScenery) {
          scenery.group.position.z += delta * 22
          if (scenery.group.position.z > 12) scenery.group.position.z -= scenery.wrapLength
        }
        // Speed streaks move toward camera
        for (const streak of streakMeshes) {
          streak.position.z += delta * 28
          if (streak.position.z > 10) {
            streak.position.z = -45 - Math.random() * 25
            streak.position.x = (Math.random() - 0.5) * 7
            streak.position.y = 0.1 + Math.random() * 1.4
          }
          const mesh = (streak as any).userData.mesh
          const t = (10 - streak.position.z) / 55 // 0 far, 1 near
          mesh.material.opacity = (streak as any).userData.baseOpacity * t * t
          mesh.scale.z = 0.5 + t * 1.5
        }
        // Gate pulse when checkpoint approaching
        if (current.checkpoint) {
          const pulse = 0.5 + Math.sin(time * 0.006) * 0.35
          gateRing.material.opacity = pulse
          gateRing.scale.setScalar(0.85 + pulse * 0.25)
        } else {
          gateRing.material.opacity = 0
        }
      } else {
        gateRing.material.opacity = 0
      }

      // ---- Player (Lilo) animation ----
      const playerData = player.userData as {
        body: THREE.Group
        leftLeg: THREE.Mesh
        rightLeg: THREE.Mesh
        leftArm: THREE.Mesh
        rightArm: THREE.Mesh
        headphoneBand: THREE.Mesh
        eyeMeshes: THREE.Mesh[]
        shadow: THREE.Mesh
      }
      const targetX = LANE_POSITIONS[current.lane]
      player.position.x += (targetX - player.position.x) * Math.min(1, delta * 12)

      // Lane lean: lean into the turn when changing lanes
      const laneDelta = targetX - player.position.x
      const targetLean = clamp(laneDelta * 0.1, -0.2, 0.2)
      leanRef.current += (targetLean - leanRef.current) * Math.min(1, delta * 8)
      player.rotation.z = leanRef.current
      player.rotation.y = Math.PI + leanRef.current * 0.25

      const isJumping = current.action === 'jump'
      const isSliding = current.action === 'slide'
      const jumpHeight = isJumping ? 1.35 : isSliding ? 0.04 : 0.09
      player.position.y += (jumpHeight - player.position.y) * Math.min(1, delta * 11)

      // Idle vertical bounce when running
      const idleBounce = isJumping || isSliding ? 0 : Math.sin(time * 0.014) * 0.045
      playerData.body.position.y = isSliding ? 0.08 : idleBounce

      // Squash & stretch on jump / land
      if (isJumping) {
        playerData.body.scale.y += ((1.18) - playerData.body.scale.y) * Math.min(1, delta * 10)
        playerData.body.scale.x += ((0.92) - playerData.body.scale.x) * Math.min(1, delta * 10)
      } else if (isSliding) {
        playerData.body.scale.y += ((0.6) - playerData.body.scale.y) * Math.min(1, delta * 10)
        playerData.body.scale.x += ((1.18) - playerData.body.scale.x) * Math.min(1, delta * 10)
      } else {
        playerData.body.scale.y += ((1) - playerData.body.scale.y) * Math.min(1, delta * 10)
        playerData.body.scale.x += ((1) - playerData.body.scale.x) * Math.min(1, delta * 10)
      }

      // Run cycle
      const runCycle = time * 0.013
      const runAmount = isRunning(current.action) ? 1 : 0
      playerData.leftLeg.rotation.x = Math.sin(runCycle) * (runAmount * 0.52)
      playerData.rightLeg.rotation.x = -Math.sin(runCycle) * (runAmount * 0.52)
      playerData.leftArm.rotation.z = 0.45 + Math.sin(runCycle) * (runAmount * 0.18)
      playerData.rightArm.rotation.z = -0.45 - Math.sin(runCycle) * (runAmount * 0.18)

      // Blink: close eyes briefly every ~3 seconds when not jumping/hit
      blinkTimer -= delta
      const blink = current.action === 'jump' || current.action === 'slide' ? 0 : Math.max(0, 1 - (blinkTimer % 0.15) / 0.15)
      const blinkScale = shakeRef.current > 0 ? 0 : (blinkTimer > 0 ? 1 : 0.02)
      if (blinkTimer <= 0) blinkTimer = 3.2 + Math.random() * 2.2
      for (const eye of playerData.eyeMeshes) {
        eye.scale.y = blinkScale
      }

      // Shadow scales with height (jump = smaller/fainter)
      const height = player.position.y
      const shadowScale = Math.max(0.4, 1 - height * 0.6)
      const shadowOpacity = Math.max(0.05, 0.22 * shadowScale)
      playerData.shadow.scale.setScalar(shadowScale)
      ;(playerData.shadow.material as THREE.MeshBasicMaterial).opacity = shadowOpacity
      playerData.shadow.position.x = player.position.x
      playerData.shadow.position.z = player.position.z - 0.6

      const activeIds = new Set<number>()
      for (const obstacle of current.obstacles) {
        activeIds.add(obstacle.id)
        let entry = obstacleMeshes.get(obstacle.id)
        if (!entry || entry.kind !== obstacle.kind) {
          if (entry) {
            scene.remove(entry.mesh)
            disposeObject(entry.mesh)
          }
          const mesh = createObstacle(obstacle.kind)
          scene.add(mesh)
          entry = { kind: obstacle.kind, mesh }
          obstacleMeshes.set(obstacle.id, entry)
        }
        entry.mesh.position.set(
          LANE_POSITIONS[obstacle.lane],
          0,
          -32 + obstacle.progress * 0.42,
        )
        const scale = Math.max(0.48, Math.min(1.3, 0.6 + obstacle.progress / 150))
        entry.mesh.scale.setScalar(scale)

        // Close-approach warning flash (red pulse)
        const close = obstacle.progress > 70 && obstacle.progress < 91
        const flash = (entry.mesh as any).userData?.flash
        if (flash) {
          const pulse = close ? 0.5 + Math.sin(time * 0.012) * 0.4 : 0
          if (flash.material) {
            flash.material.opacity = pulse
            flash.material.transparent = pulse < 1
          }
          if (flash instanceof THREE.Mesh && (flash.geometry as any).type === 'RingGeometry') {
            flash.scale.setScalar(1 + pulse * 0.6)
          }
        }
      }
      for (const [id, entry] of obstacleMeshes) {
        if (!activeIds.has(id)) {
          scene.remove(entry.mesh)
          disposeObject(entry.mesh)
          obstacleMeshes.delete(id)
        }
      }

      const activeCollectibleIds = new Set<number>()
      for (const collectible of current.collectibles) {
        activeCollectibleIds.add(collectible.id)
        let entry = collectibleMeshes.get(collectible.id)
        if (!entry || entry.kind !== collectible.kind) {
          if (entry) {
            scene.remove(entry.mesh)
            disposeObject(entry.mesh)
          }
          const mesh = createCollectible(collectible.kind)
          scene.add(mesh)
          entry = { kind: collectible.kind, mesh }
          collectibleMeshes.set(collectible.id, entry)
        }
        const hover = 1.15 + Math.sin(time * 0.005 + collectible.id) * 0.12
        const bob = current.running ? Math.sin(time * 0.01 + collectible.id) * 0.06 : 0
        entry.mesh.position.set(
          LANE_POSITIONS[collectible.lane],
          hover + bob,
          -32 + collectible.progress * 0.42,
        )
        entry.mesh.rotation.y += delta * 1.8
        entry.mesh.rotation.z += delta * 1.0
        const scale = Math.max(0.48, Math.min(1.15, 0.62 + collectible.progress / 180))
        entry.mesh.scale.setScalar(scale)

        // Glow pulse on collectibles
        const glow = (entry.mesh as any).userData?.glow
        const halo = (entry.mesh as any).userData?.halo
        if (glow) {
          const gPulse = 0.4 + Math.sin(time * 0.008 + collectible.id) * 0.3
          ;(glow.material as THREE.MeshBasicMaterial).opacity = gPulse * scale
          glow.scale.setScalar(0.9 + gPulse * 0.4)
        }
        if (halo) {
          halo.scale.setScalar(1 + Math.sin(time * 0.01 + collectible.id) * 0.15)
        }
      }
      for (const [id, entry] of collectibleMeshes) {
        if (!activeCollectibleIds.has(id)) {
          scene.remove(entry.mesh)
          disposeObject(entry.mesh)
          collectibleMeshes.delete(id)
        }
      }

      gate.position.z = -12 + Math.sin(time * 0.003) * 0.12
      renderer?.render(scene, camera)
    }
    frameId = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      if (!resizeObserver) window.removeEventListener('resize', resize)
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      renderer?.dispose()
      renderer?.domElement.remove()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className="game-world-3d"
      aria-label="Three-dimensional pharmacy runner"
      onTouchStart={event => {
        const touch = event.touches[0]
        if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY }
      }}
      onTouchEnd={event => {
        const start = touchStartRef.current
        const touch = event.changedTouches[0]
        touchStartRef.current = null
        if (!start || !touch || !running) return
        const dx = touch.clientX - start.x
        const dy = touch.clientY - start.y
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return
        onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'))
      }}
    >
      {sceneError && (
        <div className="game-world-error" role="alert">
          The 3D runner could not start: {sceneError}
        </div>
      )}
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function isRunning(action: PlayerAction) {
  return action === 'run'
}
