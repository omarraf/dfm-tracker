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

// Computes geometry stats from flat position and index arrays (regular JS arrays).
// Uses signed-tetrahedra volume, per-triangle cross-product for area + normal direction.
function computeGeometryStats(positions, indices) {
  let vol = 0, area = 0, downArea = 0;
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  const buckets = {};

  for (let i = 0; i < indices.length; i += 3) {
    const i0=indices[i]*3, i1=indices[i+1]*3, i2=indices[i+2]*3;
    const x0=positions[i0],y0=positions[i0+1],z0=positions[i0+2];
    const x1=positions[i1],y1=positions[i1+1],z1=positions[i1+2];
    const x2=positions[i2],y2=positions[i2+1],z2=positions[i2+2];

    // Signed volume contribution via divergence theorem
    vol += (x0*(y1*z2-y2*z1) + x1*(y2*z0-y0*z2) + x2*(y0*z1-y1*z0)) / 6;

    // Face normal + area from cross product
    const ax=x1-x0, ay=y1-y0, az=z1-z0;
    const bx=x2-x0, by=y2-y0, bz=z2-z0;
    const cx=ay*bz-az*by, cy=az*bx-ax*bz, cz=ax*by-ay*bx;
    const len=Math.sqrt(cx*cx+cy*cy+cz*cz);
    const triArea=len/2;
    area += triArea;

    if (len > 1e-12) {
      const uny=cy/len;
      // Downward-facing: Y-normal < -0.5 (≥60° below horizontal in viewer coords)
      if (uny < -0.5) downArea += triArea;
      // Bucket into 27-direction grid (each axis: positive/zero/negative)
      const unx=cx/len, unz=cz/len;
      const key=(unx>0.5?'p':unx<-0.5?'n':'0')+(uny>0.5?'p':uny<-0.5?'n':'0')+(unz>0.5?'p':unz<-0.5?'n':'0');
      buckets[key]=(buckets[key]||0)+triArea;
    }

    // Bounding box update (all 3 verts of each triangle)
    if(x0<minX)minX=x0; if(x0>maxX)maxX=x0; if(y0<minY)minY=y0; if(y0>maxY)maxY=y0; if(z0<minZ)minZ=z0; if(z0>maxZ)maxZ=z0;
    if(x1<minX)minX=x1; if(x1>maxX)maxX=x1; if(y1<minY)minY=y1; if(y1>maxY)maxY=y1; if(z1<minZ)minZ=z1; if(z1>maxZ)maxZ=z1;
    if(x2<minX)minX=x2; if(x2>maxX)maxX=x2; if(y2<minY)minY=y2; if(y2>maxY)maxY=y2; if(z2<minZ)minZ=z2; if(z2>maxZ)maxZ=z2;
  }

  vol = Math.abs(vol);
  const bboxVol = (maxX-minX)*(maxY-minY)*(maxZ-minZ);
  // Count face-orientation clusters that account for ≥2% of surface area
  const distinctNormalDirections = Object.values(buckets).filter(a => a > area*0.02).length;

  return {
    triangleCount:            (indices.length/3)|0,
    volumeMm3:                Math.round(vol),
    surfaceAreaMm2:           Math.round(area),
    savRatio:                 (area>0&&vol>0) ? +(area/Math.pow(vol,2/3)).toFixed(2) : 0,
    downwardFaceRatio:        area>0 ? +(downArea/area).toFixed(3) : 0,
    distinctNormalDirections,
    bboxVolumeMm3:            Math.round(bboxVol),
    fillRatio:                bboxVol>0 ? +(vol/bboxVol).toFixed(3) : 0,
  };
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

    const geometryStats = computeGeometryStats(allPositions, allIndices);

    const positions = new Float32Array(allPositions);
    const normals   = new Float32Array(allNormals);
    const indices   = new Uint32Array(allIndices);

    self.postMessage(
      { success: true, positionBuffer: positions.buffer, normalBuffer: normals.buffer, indexBuffer: indices.buffer, geometryStats },
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
