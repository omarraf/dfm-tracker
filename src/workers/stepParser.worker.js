import initOcct from 'occt-import-js'

let occtInstance = null

async function getOcct() {
  if (occtInstance) return occtInstance
  occtInstance = await initOcct({
    // Use absolute origin so the WASM resolves correctly from the worker's URL
    locateFile: (file) => `${self.location.origin}/${file}`,
  })
  return occtInstance
}

self.onmessage = async ({ data }) => {
  try {
    const occt = await getOcct()
    const fileBuffer = new Uint8Array(data.buffer)
    const result = occt.ReadStepFile(fileBuffer, null)

    if (!result || result.meshCount === 0) {
      self.postMessage({ success: false, error: 'File parsed but contains no geometry meshes.' })
      return
    }

    const allPositions = []
    const allNormals   = []
    const allIndices   = []
    let vertexOffset   = 0

    for (let i = 0; i < result.meshCount; i++) {
      const mesh = result.GetMesh(i)
      const { attributes } = mesh

      const hasPos  = attributes.position && attributes.position.count > 0
      const hasNorm = attributes.normal   && attributes.normal.count   > 0

      if (!hasPos) continue

      const posCount = attributes.position.count

      for (let v = 0; v < posCount; v++) {
        const c = attributes.position.GetCoord(v)
        allPositions.push(c.x, c.y, c.z)
      }

      if (hasNorm) {
        for (let v = 0; v < attributes.normal.count; v++) {
          const c = attributes.normal.GetCoord(v)
          allNormals.push(c.x, c.y, c.z)
        }
      } else {
        for (let v = 0; v < posCount; v++) allNormals.push(0, 0, 0)
      }

      for (let f = 0; f < mesh.index.count; f++) {
        allIndices.push(mesh.GetFaceIndex(f) + vertexOffset)
      }

      vertexOffset += posCount
    }

    if (allPositions.length === 0) {
      self.postMessage({ success: false, error: 'Parsed file has no vertex data.' })
      return
    }

    const positions = new Float32Array(allPositions)
    const normals   = new Float32Array(allNormals)
    const indices   = new Uint32Array(allIndices)

    self.postMessage(
      {
        success: true,
        positionBuffer: positions.buffer,
        normalBuffer:   normals.buffer,
        indexBuffer:    indices.buffer,
      },
      [positions.buffer, normals.buffer, indices.buffer]
    )
  } catch (err) {
    self.postMessage({ success: false, error: err.message || String(err) })
  }
}
