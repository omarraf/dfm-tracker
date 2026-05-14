// Creates an inline classic worker that loads occt-import-js via importScripts.
// This avoids Vite bundling the Emscripten module, which crashes in worker context.

// Result structure from occt-import-js:
// result.success (bool)
// result.meshes[i].attributes.position.array  — flat number array [x,y,z, x,y,z, ...]
// result.meshes[i].attributes.normal?.array   — flat number array
// result.meshes[i].index.array               — flat index array [i0,i1,i2, ...]

const WORKER_SRC = /* js */`
const origin = self.location.origin;
let occtInstance = null;

async function getOcct() {
  if (occtInstance) return occtInstance;
  importScripts(origin + '/occt-import-js.js');
  occtInstance = await self.occtimportjs({
    locateFile: (file) => origin + '/' + file,
  });
  return occtInstance;
}

self.onmessage = async ({ data }) => {
  try {
    const occt = await getOcct();
    const fileBuffer = new Uint8Array(data.buffer);
    const result = occt.ReadStepFile(fileBuffer, null);

    if (!result.success || !result.meshes || result.meshes.length === 0) {
      self.postMessage({ success: false, error: 'File parsed but contains no meshes. Is this a valid STEP file?' });
      return;
    }

    const allPositions = [];
    const allNormals   = [];
    const allIndices   = [];
    let vertexOffset   = 0;

    for (const mesh of result.meshes) {
      const posArr  = mesh.attributes.position.array;
      const normArr = mesh.attributes.normal ? mesh.attributes.normal.array : null;
      const idxArr  = mesh.index.array;

      const vertexCount = posArr.length / 3;

      for (let i = 0; i < posArr.length; i++)  allPositions.push(posArr[i]);

      if (normArr && normArr.length === posArr.length) {
        for (let i = 0; i < normArr.length; i++) allNormals.push(normArr[i]);
      } else {
        for (let i = 0; i < posArr.length; i++)  allNormals.push(0);
      }

      for (let i = 0; i < idxArr.length; i++) allIndices.push(idxArr[i] + vertexOffset);

      vertexOffset += vertexCount;
    }

    if (allPositions.length === 0) {
      self.postMessage({ success: false, error: 'No vertex data found in file.' });
      return;
    }

    const positions = new Float32Array(allPositions);
    const normals   = new Float32Array(allNormals);
    const indices   = new Uint32Array(allIndices);

    self.postMessage(
      { success: true, positionBuffer: positions.buffer, normalBuffer: normals.buffer, indexBuffer: indices.buffer },
      [positions.buffer, normals.buffer, indices.buffer]
    );
  } catch (err) {
    self.postMessage({ success: false, error: err.message || String(err) });
  }
};
`;

let blobUrl = null;

export function createStepWorker() {
  if (!blobUrl) {
    const blob = new Blob([WORKER_SRC], { type: 'application/javascript' });
    blobUrl = URL.createObjectURL(blob);
  }
  return new Worker(blobUrl);
}
