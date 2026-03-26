import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { arcVertex, arcFragment } from './arc-shaders'
import { latLngToVec3 } from './geo'

const ORIGIN_LAT = 51.2194
const ORIGIN_LNG = 4.4025
const DURATION = 2.5 // seconds for full arc animation

const COLOR_START = new THREE.Color('#c45a3c')
const COLOR_MID = new THREE.Color('#ede6db')

interface ArcProps {
  latitude: number
  longitude: number
  radius: number
  delay: number
  dimmed: boolean
}

function buildArcCurve(
  destLat: number,
  destLng: number,
  radius: number,
): THREE.CubicBezierCurve3 {
  const p0 = new THREE.Vector3(...latLngToVec3(ORIGIN_LAT, ORIGIN_LNG, radius))
  const p3 = new THREE.Vector3(...latLngToVec3(destLat, destLng, radius))

  // Arc height scales with angular distance
  const angularDist = p0.angleTo(p3)
  const liftHeight = radius + 0.15 + angularDist * 0.35

  // Control points at 1/3 and 2/3 along chord, lifted outward
  const p1 = new THREE.Vector3().lerpVectors(p0, p3, 0.33).normalize().multiplyScalar(liftHeight)
  const p2 = new THREE.Vector3().lerpVectors(p0, p3, 0.67).normalize().multiplyScalar(liftHeight)

  return new THREE.CubicBezierCurve3(p0, p1, p2, p3)
}

export function Arc({ latitude, longitude, radius, delay, dimmed }: ArcProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)
  const cardRef = useRef<THREE.Mesh>(null!)
  const startTime = useRef(-1)

  const { curve, geometry, totalIndices } = useMemo(() => {
    const c = buildArcCurve(latitude, longitude, radius)
    const geo = new THREE.TubeGeometry(c, 64, 0.008, 4, false)
    return {
      curve: c,
      geometry: geo,
      totalIndices: geo.index ? geo.index.count : 0,
    }
  }, [latitude, longitude, radius])

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uColorStart: { value: COLOR_START },
      uColorMid: { value: COLOR_MID },
      uDimmed: { value: 0 },
    }),
    [],
  )

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime

    if (startTime.current < 0) {
      startTime.current = elapsed + delay
    }

    const t = elapsed - startTime.current
    if (t < 0) {
      geometry.setDrawRange(0, 0)
      if (cardRef.current) cardRef.current.visible = false
      return
    }

    const progress = Math.min(t / DURATION, 1)

    materialRef.current.uniforms.uProgress.value = progress
    materialRef.current.uniforms.uTime.value = elapsed
    materialRef.current.uniforms.uDimmed.value = dimmed ? 1 : 0

    const indexCount = Math.floor(progress * totalIndices)
    geometry.setDrawRange(0, indexCount)

    // Card particle
    if (cardRef.current) {
      if (progress < 1) {
        cardRef.current.visible = true
        const pos = curve.getPointAt(progress)
        cardRef.current.position.copy(pos)

        // Flutter — gentle wobble like a leaf
        const f = t * 3
        cardRef.current.lookAt(0, 0, 0)
        cardRef.current.rotateX(Math.sin(f * 1.7) * 0.3)
        cardRef.current.rotateZ(Math.cos(f * 1.1) * 0.2)
      } else {
        cardRef.current.visible = false
      }
    }
  })

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={arcVertex}
          fragmentShader={arcFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={cardRef} visible={false}>
        <planeGeometry args={[0.04, 0.03]} />
        <meshBasicMaterial
          color="#ede6db"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
