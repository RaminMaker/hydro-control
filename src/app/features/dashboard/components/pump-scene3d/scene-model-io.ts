import * as THREE from 'three';

export type SceneFormat = 'glb' | 'gltf' | 'obj' | 'stl';
const allowed = new Set<SceneFormat>(['glb', 'gltf', 'obj', 'stl']);
const MAX_SINGLE_BYTES = 40 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

function extension(name: string): string { return name.split('.').pop()?.toLowerCase() || ''; }

export function detectPrimaryFile(files: File[]): File {
  if (files.length === 0) throw new Error('Please select a 3D model.');
  if (files.some(file => file.size > MAX_SINGLE_BYTES) || files.reduce((size, f) => size + f.size, 0) > MAX_TOTAL_BYTES) {
    throw new Error('Model is too large (40 MB per file, 100 MB total).');
  }
  const main = files.find(file => allowed.has(extension(file.name) as SceneFormat));
  if (!main) throw new Error('Choose a .glb, .gltf, .obj or .stl model.');
  return main;
}


export async function readSceneModel(files: File[]): Promise<{ object: THREE.Group; name: string }> {
  const main = detectPrimaryFile(files);
  const ext = extension(main.name) as SceneFormat;
  const temporaryUrls: string[] = [];
  const lookup = new Map(files.map(f => [f.name.replace(/\\/g, '/').split('/').at(-1)!.toLowerCase(), f]));
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => {
    const name = decodeURIComponent(url.split('?')[0].split('#')[0].replace(/\\/g, '/').split('/').at(-1) || '').toLowerCase();
    const companion = lookup.get(name);
    if (companion) {
      const objectUrl = URL.createObjectURL(companion);
      temporaryUrls.push(objectUrl);
      return objectUrl;
    }
    if (/^(data:|blob:)/i.test(url)) return url;
    throw new Error(`Missing companion asset: ${name}`);
  });
  try {
    let object: THREE.Group;
    if (ext === 'glb' || ext === 'gltf') {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader(manager);
      const input = ext === 'glb' ? await main.arrayBuffer() : await main.text();
      const result = await new Promise<THREE.Group>((resolve, reject) => {
        loader.parse(input, '', data => resolve(data.scene), reject);
      });
      object = result;
    } else if (ext === 'obj') {
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      const loader = new OBJLoader(manager);
      const mtl = files.find(f => extension(f.name) === 'mtl');
      if (mtl) {
        const { MTLLoader } = await import('three/examples/jsm/loaders/MTLLoader.js');
        const mats = new MTLLoader(manager).parse(await mtl.text(), '');
        mats.preload(); loader.setMaterials(mats);
      }
      object = loader.parse(await main.text());
    } else {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const geometry = new STLLoader(manager).parse(await main.arrayBuffer());
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x48b9c6, metalness: .35, roughness: .55, side: THREE.DoubleSide }));
      object = new THREE.Group(); object.add(mesh);
    }
    let meshes = 0;
    object.traverse(item => { if (item instanceof THREE.Mesh) meshes++; });
    if (!meshes) throw new Error('No mesh geometry was found in the selected file.');
    object.name = main.name;
    return { object, name: main.name };
  } finally {
    if (ext === 'obj') setTimeout(() => temporaryUrls.forEach(url => URL.revokeObjectURL(url)), 30_000);
    else temporaryUrls.forEach(url => URL.revokeObjectURL(url));
  }
}

export async function writeSceneModel(root: THREE.Object3D, format: SceneFormat): Promise<Blob> {
  if (format === 'glb' || format === 'gltf') {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const data = await new Promise<ArrayBuffer | object>((resolve, reject) => {
      new GLTFExporter().parse(root, result => resolve(result), error => reject(error), {
        binary: format === 'glb', onlyVisible: true, trs: false, maxTextureSize: 2048
      });
    });
    return format === 'glb'
      ? new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' })
      : new Blob([JSON.stringify(data, null, 2)], { type: 'model/gltf+json' });
  }
  if (format === 'obj') {
    const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js');
    return new Blob([new OBJExporter().parse(root)], { type: 'text/plain' });
  }
  const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
  const result = new STLExporter().parse(root, { binary: true });
  if (typeof result === 'string') return new Blob([result], { type: 'model/stl' });
  const bytes = new Uint8Array(result.byteLength);
  bytes.set(new Uint8Array(result.buffer, result.byteOffset, result.byteLength));
  return new Blob([bytes], { type: 'model/stl' });
}

export function downloadModelBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function releaseSceneObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(item => {
    if (!(item instanceof THREE.Mesh)) return;
    if (item.geometry) geometries.add(item.geometry);
    const list = Array.isArray(item.material) ? item.material : [item.material];
    list.forEach(material => {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    });
  });
  textures.forEach(t => t.dispose());
  materials.forEach(m => m.dispose());
  geometries.forEach(g => g.dispose());
}
