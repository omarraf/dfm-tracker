import {
  forwardRef,
  useEffect,
  useRef,
  useImperativeHandle,
  useCallback,
} from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { createStepWorker } from '../lib/createStepWorker'

const Viewer3D = forwardRef(function Viewer3D(
  { modelBuffer, onModelLoaded, onError },
  ref
) {
  const wrapRef          = useRef(null)
  const rendererRef      = useRef(null)
  const sceneRef         = useRef(null)
  const cameraRef        = useRef(null)
  const controlsRef      = useRef(null)
  const modelRef         = useRef(null)  // Group holding the mesh
  const rafRef           = useRef(null)
  const workerRef        = useRef(null)
  const geometryStatsRef = useRef(null)

  // ── Scene setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    wrap.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x07090b)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 2000)
    camera.position.set(6, 5, 8)
    cameraRef.current = camera

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 0.05
    controls.maxDistance = 800
    controlsRef.current = controls

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambient)

    const key = new THREE.DirectionalLight(0xfff0e0, 1.4)
    key.position.set(6, 12, 8)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)

    const fill = new THREE.DirectionalLight(0xc0d8ff, 0.5)
    fill.position.set(-8, -4, -6)
    scene.add(fill)

    const rim = new THREE.DirectionalLight(0xffeedd, 0.3)
    rim.position.set(0, -6, 8)
    scene.add(rim)

    // Grid
    const grid = new THREE.GridHelper(40, 40, 0x1a1e24, 0x12151a)
    scene.add(grid)

    // Model group
    const modelGroup = new THREE.Group()
    scene.add(modelGroup)
    modelRef.current = modelGroup

    // Resize handling
    const resize = () => {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    // Render loop
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      controls.update()
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  // ── Load model when buffer changes ─────────────────────────────────────────
  useEffect(() => {
    if (!modelBuffer) return

    // Clear previous mesh
    const group = modelRef.current
    if (group) {
      while (group.children.length) {
        const c = group.children[0]
        c.geometry?.dispose()
        c.material?.dispose()
        group.remove(c)
      }
    }

    // Terminate previous worker
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }

    const worker = createStepWorker()
    workerRef.current = worker

    worker.onmessage = (e) => {
      const { success, positionBuffer, normalBuffer, indexBuffer, geometryStats, error: parseError } = e.data

      if (!success) {
        onError?.(parseError || 'STEP parsing failed')
        return
      }

      // Always use the current ref value — avoids stale closure in StrictMode double-mount
      const targetGroup = modelRef.current
      if (!targetGroup) {
        onError?.('Viewer not ready — please try again')
        return
      }

      const positions = new Float32Array(positionBuffer)
      const normals   = new Float32Array(normalBuffer)
      const indices   = new Uint32Array(indexBuffer)

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('normal',   new THREE.BufferAttribute(normals, 3))
      geometry.setIndex(new THREE.BufferAttribute(indices, 1))

      const hasRealNormals = normals.some((v) => v !== 0)
      if (!hasRealNormals) geometry.computeVertexNormals()

      geometry.computeBoundingBox()
      geometry.computeBoundingSphere()

      const material = new THREE.MeshStandardMaterial({
        color:     0x8fa4b8,
        metalness: 0.65,
        roughness: 0.28,
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow    = true
      mesh.receiveShadow = true

      // Center at origin
      const center = new THREE.Vector3()
      geometry.boundingBox.getCenter(center)
      mesh.position.sub(center)

      // Align base to y=0
      const halfHeight = (geometry.boundingBox.max.y - geometry.boundingBox.min.y) / 2
      mesh.position.y += halfHeight

      targetGroup.add(mesh)

      // Edge overlay — makes features visible for Claude's analysis
      const edgesGeo = new THREE.EdgesGeometry(geometry, 15)
      const edgesMat = new THREE.LineBasicMaterial({
        color: 0xc8dae8,
        transparent: true,
        opacity: 0.55,
      })
      const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat)
      edgeLines.position.copy(mesh.position)
      targetGroup.add(edgeLines)

      // Update grid size to match the model
      const currentScene = sceneRef.current
      if (currentScene) {
        const oldGrid = currentScene.getObjectByName('baseGrid')
        if (oldGrid) currentScene.remove(oldGrid)
        const size = geometry.boundingSphere.radius * 4
        const newGrid = new THREE.GridHelper(size, 20, 0x1a1e24, 0x12151a)
        newGrid.name = 'baseGrid'
        currentScene.add(newGrid)
      }

      geometryStatsRef.current = geometryStats ?? null
      fitCamera()
      onModelLoaded?.(geometryStats ?? null)
    }

    worker.onerror = (e) => {
      onError?.(e.message || 'Worker crashed — check console for details')
    }

    // Transfer a copy of the buffer to the worker
    const copy = modelBuffer.slice(0)
    worker.postMessage({ buffer: copy }, [copy])

    return () => {
      worker.terminate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelBuffer])

  // ── Camera fit ─────────────────────────────────────────────────────────────
  const fitCamera = useCallback(() => {
    const group    = modelRef.current
    const camera   = cameraRef.current
    const controls = controlsRef.current
    if (!group || !camera || !controls || group.children.length === 0) return

    const box    = new THREE.Box3().setFromObject(group)
    const sphere = new THREE.Sphere()
    box.getBoundingSphere(sphere)

    const fov      = camera.fov * (Math.PI / 180)
    const distance = (sphere.radius * 2.8) / Math.tan(fov / 2)
    const center   = sphere.center

    camera.position.set(
      center.x + distance * 0.55,
      center.y + distance * 0.45,
      center.z + distance * 0.75
    )
    camera.lookAt(center)
    controls.target.copy(center)
    controls.update()

    return { sphere, distance, center }
  }, [])

  // ── Screenshot capture ──────────────────────────────────────────────────────
  const captureScreenshots = useCallback(async () => {
    const group    = modelRef.current
    const camera   = cameraRef.current
    const controls = controlsRef.current
    const renderer = rendererRef.current
    const scene    = sceneRef.current

    if (!group || group.children.length === 0) {
      throw new Error('No model loaded. Upload and parse a STEP file first.')
    }

    const box    = new THREE.Box3().setFromObject(group)
    const sphere = new THREE.Sphere()
    box.getBoundingSphere(sphere)
    const center   = sphere.center.clone()
    const fov      = camera.fov * (Math.PI / 180)
    const distance = (sphere.radius * 3.2) / Math.tan(fov / 2)

    // Bounding box dimensions (STEP files are in mm)
    const size = new THREE.Vector3()
    box.getSize(size)
    const dims = {
      x: Math.round(size.x * 10) / 10,
      y: Math.round(size.y * 10) / 10,
      z: Math.round(size.z * 10) / 10,
    }

    const savedPos    = camera.position.clone()
    const savedTarget = controls.target.clone()
    const savedUp     = camera.up.clone()

    // Each view: offset from center + optional camera.up override (avoids gimbal lock)
    const views = [
      { offset: new THREE.Vector3(0,            0,             distance),       up: null },
      { offset: new THREE.Vector3(distance,     0,             0),              up: null },
      { offset: new THREE.Vector3(0,            distance*1.1,  0),              up: new THREE.Vector3(0, 0, -1) },
      { offset: new THREE.Vector3(distance*0.65, distance*0.65, distance*0.65), up: null },
      { offset: new THREE.Vector3(0,            -distance*1.1, 0),              up: new THREE.Vector3(0, 0,  1) },
    ]

    // Capture at a fixed 800×800 so screenshots are always crisp regardless of viewport size
    const domEl = renderer.domElement
    const cssW  = domEl.clientWidth
    const cssH  = domEl.clientHeight
    const origPR = renderer.getPixelRatio()
    renderer.setPixelRatio(1)
    renderer.setSize(800, 800, false)
    camera.aspect = 1
    camera.updateProjectionMatrix()

    const shots = []
    for (const { offset, up } of views) {
      if (up) camera.up.copy(up)
      else camera.up.set(0, 1, 0)
      camera.position.copy(center).add(offset)
      camera.lookAt(center)
      controls.target.copy(center)
      controls.update()
      renderer.render(scene, camera)
      shots.push(renderer.domElement.toDataURL('image/png'))
    }

    // Restore renderer + camera
    renderer.setPixelRatio(origPR)
    renderer.setSize(cssW, cssH, false)
    camera.up.copy(savedUp)
    camera.aspect = cssW / cssH
    camera.updateProjectionMatrix()
    camera.position.copy(savedPos)
    controls.target.copy(savedTarget)
    controls.update()

    return { shots, dims, geometryStats: geometryStatsRef.current }
  }, [])

  useImperativeHandle(ref, () => ({ captureScreenshots, fitCamera }), [
    captureScreenshots,
    fitCamera,
  ])

  return (
    <div
      ref={wrapRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  )
})

export default Viewer3D
