import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const weights = [1, 2, 4, 8, 16] as const;

export function mountBalance(host: HTMLElement) {
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
  renderer.setClearColor(0, 0);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  host.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(29, 1, 0.1, 40);
  const room = new RoomEnvironment();
  const generator = new T.PMREMGenerator(renderer);
  const environment = generator.fromScene(room, 0.045);
  scene.environment = environment.texture;
  generator.dispose();
  room.dispose();

  const loader = new T.TextureLoader();
  function materialMap(name: string) {
    const texture = loader.load(import.meta.env.BASE_URL + 'materials/' + name + '.webp', () => wake());
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.MirroredRepeatWrapping;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  const grain = materialMap('waga-braz'),
    weave = materialMap('waga-len');
  weave.repeat.set(3, 1.05);
  scene.environmentIntensity = 0.64;
  const metal = (color: number, roughness: number) =>
    new T.MeshStandardMaterial({
      color,
      map: grain,
      roughness,
      metalness: 0.76,
      bumpMap: grain,
      bumpScale: 0.023,
    });
  const bronze = metal(0xd3b49b, 0.43),
    polished = metal(0xffe3ac, 0.3),
    iron = metal(0x766f67, 0.62);
  const cloth = new T.MeshStandardMaterial({
    color: 0xc2b198,
    map: weave,
    bumpMap: weave,
    bumpScale: 0.025,
    roughness: 1,
  });
  const cord = new T.MeshStandardMaterial({ color: 0x563a21, roughness: 0.9 });
  const shadowMaterial = new T.ShadowMaterial({ opacity: 0.33 });
  const floor = new T.Mesh(new T.PlaneGeometry(28, 28), shadowMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const sun = new T.DirectionalLight(0xffe4bd, 2.5);
  sun.position.set(4, 6, -0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.1, far: 16 });
  sun.shadow.normalBias = 0.012;
  sun.shadow.bias = -0.0003;
  scene.add(sun, new T.HemisphereLight(0xf5ecdd, 0x573c26, 0.82));
  const fill = new T.DirectionalLight(0xcddde3, 0.75);
  fill.position.set(-3, 3, 4);
  scene.add(fill);

  const body = new T.Group();
  scene.add(body);
  function mesh(parent: T.Object3D, geo: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0) {
    const m = new T.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  const turn = (points: number[][], segments = 64) =>
    new T.LatheGeometry(
      points.map(([r, y]) => new T.Vector2(r, y)),
      segments,
    );
  const shaft = turn([
    [0, 0],
    [0.52, 0],
    [0.52, 0.05],
    [0.48, 0.08],
    [0.44, 0.09],
    [0.42, 0.15],
    [0.28, 0.18],
    [0.23, 0.21],
    [0.2, 0.26],
    [0.15, 0.31],
    [0.18, 0.35],
    [0.18, 0.39],
    [0.12, 0.42],
    [0.096, 0.52],
    [0.087, 1.8],
    [0.14, 1.86],
    [0.15, 1.91],
    [0.095, 1.96],
    [0.071, 2.24],
    [0, 2.28],
  ]);
  mesh(body, shaft, bronze);
  for (const [height, radius] of [
    [0.055, 0.505],
    [0.145, 0.4],
    [0.37, 0.18],
    [0.445, 0.117],
    [1.9, 0.15],
  ]) {
    mesh(body, new T.TorusGeometry(radius, 0.011, 8, 64), polished, 0, height).rotation.x = Math.PI / 2;
  }
  // Fixed ivory tick plate sits just behind the moving needle.
  const dialCanvas = document.createElement('canvas');
  dialCanvas.width = 512;
  dialCanvas.height = 128;
  const dc = dialCanvas.getContext('2d')!;
  dc.fillStyle = '#8d7955';
  dc.fillRect(0, 0, 512, 128);
  dc.strokeStyle = '#302317';
  dc.lineWidth = 3;
  for (let i = -9; i <= 9; i++) {
    const x = 256 + i * 25;
    dc.beginPath();
    dc.moveTo(x, 110);
    dc.lineTo(x + (x - 256) * 0.04, i % 3 === 0 ? 35 : 68);
    dc.stroke();
  }
  dc.fillStyle = '#65291e';
  dc.fillRect(252, 21, 8, 92);
  const dialMap = new T.CanvasTexture(dialCanvas);
  dialMap.colorSpace = T.SRGBColorSpace;
  mesh(body, new T.BoxGeometry(0.82, 0.2, 0.075), bronze, 0, 2.47, -0.05);
  mesh(
    body,
    new T.PlaneGeometry(0.78, 0.16),
    new T.MeshStandardMaterial({ map: dialMap, roughness: 0.75 }),
    0,
    2.47,
    -0.008,
  );
  mesh(body, new T.CylinderGeometry(0.036, 0.052, 0.39, 16), bronze, 0, 2.29, -0.07);
  const axle = 2.025,
    arm = 1.26;
  const beam = new T.Group();
  beam.position.set(0, axle, 0.115);
  body.add(beam);
  const shape = new T.Shape();
  shape.moveTo(-arm, 0.045);
  shape.bezierCurveTo(-0.85, 0.041, -0.33, 0.092, -0.12, 0.116);
  shape.quadraticCurveTo(0, 0.18, 0.12, 0.116);
  shape.bezierCurveTo(0.45, 0.075, 0.91, 0.035, arm, 0.045);
  shape.lineTo(arm, -0.035);
  shape.bezierCurveTo(0.78, -0.018, 0.29, -0.07, 0.105, -0.095);
  shape.quadraticCurveTo(0, -0.15, -0.105, -0.095);
  shape.bezierCurveTo(-0.29, -0.07, -0.78, -0.018, -arm, -0.035);
  shape.closePath();
  for (const sign of [-1, 1]) {
    const slot = new T.Path();
    slot.absellipse(sign * 0.62, 0.011, 0.27, 0.022, 0, Math.PI * 2, true);
    shape.holes.push(slot);
  }
  mesh(
    beam,
    new T.ExtrudeGeometry(shape, {
      depth: 0.037,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.009,
      bevelSegments: 2,
      steps: 1,
    }),
    bronze,
  );
  for (const side of [-1, 1])
    for (const dist of [0.3, 0.64, 1.12]) {
      const rivet = mesh(beam, new T.SphereGeometry(0.027, 12, 8), polished, side * dist, 0.006, 0.059);
      rivet.scale.z = 0.46;
    }
  const needle = mesh(beam, new T.ConeGeometry(0.032, 0.47, 8), iron, 0, 0.24, 0.05);
  needle.rotation.y = Math.PI / 4;
  mesh(beam, new T.SphereGeometry(0.085, 28, 20), polished, 0, 0, 0.082).scale.z = 0.55;

  function pan(sign: number) {
    const cradle = new T.Group();
    beam.add(cradle);
    cradle.position.set(sign * arm, 0, 0.035);
    mesh(cradle, new T.TorusGeometry(0.047, 0.012, 8, 18), polished, 0, -0.018, 0);
    const bowl = turn([
      [0.008, -1.175],
      [0.18, -1.165],
      [0.29, -1.142],
      [0.41, -1.1],
      [0.47, -1.048],
      [0.477, -1.032],
      [0.47, -1.021],
      [0.44, -1.036],
      [0.37, -1.073],
      [0.23, -1.123],
      [0.008, -1.148],
    ]);
    mesh(cradle, bowl, polished);
    mesh(cradle, new T.TorusGeometry(0.473, 0.009, 8, 80), bronze, 0, -1.033).rotation.x = Math.PI / 2;
    const link = new T.TorusGeometry(0.024, 0.0055, 6, 12);
    const chains = new T.InstancedMesh(link, bronze, 3 * 29);
    const transform = new T.Object3D();
    let index = 0;
    for (let j = 0; j < 3; j++) {
      const phi = (Math.PI * 2 * j) / 3 - 0.15;
      const start = new T.Vector3(0, -0.052, 0),
        end = new T.Vector3(0.455 * Math.cos(phi), -1.034, 0.455 * Math.sin(phi));
      const align = new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        end.clone().sub(start).normalize(),
      );
      for (let k = 0; k < 29; k++) {
        transform.position.lerpVectors(start, end, k / 28);
        transform.quaternion.copy(align);
        transform.rotateY(k % 2 ? 0.2 : Math.PI / 2 + 0.2);
        transform.scale.set(0.58, 1.1, 1);
        transform.updateMatrix();
        chains.setMatrixAt(index++, transform.matrix);
      }
    }
    chains.castShadow = true;
    cradle.add(chains);
    return cradle;
  }
  const left = pan(-1),
    right = pan(1);
  const bag = turn(
    [
      [0.01, 0],
      [0.18, 0.009],
      [0.23, 0.06],
      [0.24, 0.14],
      [0.19, 0.28],
      [0.08, 0.38],
      [0.074, 0.417],
      [0.12, 0.48],
      [0.095, 0.495],
      [0.01, 0.47],
    ],
    56,
  );
  // Irregular seams and folds follow the cloth up to its tied neck.
  const vertex = bag.attributes.position;
  for (let i = 0; i < vertex.count; i++) {
    const x = vertex.getX(i),
      z = vertex.getZ(i),
      y = vertex.getY(i),
      a = Math.atan2(z, x);
    const fold = 1 + 0.045 * Math.cos(9 * a + y * 9) + 0.024 * Math.sin(5 * a - y * 12);
    vertex.setXYZ(i, x * fold + y * 0.115, y, z * fold * 0.9);
  }
  bag.computeVertexNormals();
  mesh(left, bag, cloth, 0, -1.144);
  for (const h of [0.382, 0.395, 0.407]) {
    mesh(left, new T.TorusGeometry(0.078, 0.01, 8, 32), cord, 0.046, h - 1.144, 0).rotation.x =
      Math.PI / 2;
  }
  const counterweights = weights.map((mass, i) => {
    const r = 0.068 + Math.cbrt(mass) * 0.039;
    const geo = turn(
      [
        [0, 0],
        [r * 0.94, 0],
        [r, 0.012],
        [r * 0.96, r * 0.8],
        [r * 0.81, r * 0.95],
        [r * 0.4, r],
        [r * 0.32, r * 1.2],
        [0, r * 1.2],
      ],
      32,
    );
    const piece = mesh(
      right,
      geo,
      i % 2 === 0 ? bronze : iron,
      [0.17, -0.15, 0.03, -0.24, 0.19][i],
      -1.12,
      [-0.2, -0.19, 0.03, 0.13, 0.16][i],
    );
    const ring = mesh(piece, new T.TorusGeometry(r * 0.34, 0.014, 8, 20), polished, 0, r * 1.43);
    ring.rotation.y = 0.2 * i;
    return piece;
  });

  const dropHeight = weights.map(() => 0);
  let mass = 0,
    target = 13,
    quiet = false,
    angle = 0.2,
    velocity = 0,
    sway = 0,
    swing = 0;
  let lookX = 0,
    lookY = 0,
    viewX = 0,
    viewY = 0,
    frame = 0,
    last = 0,
    dead = false;
  function draw(time: number) {
    frame = 0;
    if (dead || document.hidden) return;
    const dt = Math.min(0.032, (time - last) / 1000 || 0.016);
    last = time;
    const goal = T.MathUtils.clamp((target - mass) * 0.038, -0.21, 0.21);
    velocity += (goal - angle) * 79 * dt;
    velocity *= Math.exp(-6.8 * dt);
    angle += velocity * dt;
    swing += (-sway * 56 - velocity * 1.9) * dt;
    swing *= Math.exp(-5.1 * dt);
    sway += swing * dt;
    if (quiet) {
      angle = goal;
      velocity = swing = sway = 0;
      viewX = viewY = 0;
    } else {
      viewX += (lookX - viewX) * Math.min(1, dt * 6);
      viewY += (lookY - viewY) * Math.min(1, dt * 6);
    }
    for (let i = 0; i < counterweights.length; i++) {
      dropHeight[i] = quiet ? 0 : Math.max(0, dropHeight[i] - dt * 1.8);
      counterweights[i].position.y = -1.12 + dropHeight[i];
    }
    beam.rotation.z = angle;
    left.rotation.z = -angle + sway;
    right.rotation.z = -angle + sway * 0.86;
    const aspect = Math.max(0.35, camera.aspect);
    const distance = Math.max(5.95, 8.25 / aspect);
    camera.position.set(0.34 + viewX * 0.24, 1.65 + distance * 0.18 + viewY * 0.13, distance);
    camera.lookAt(0, 1.27, 0);
    renderer.render(scene, camera);
    if (
      !quiet &&
      Math.abs(goal - angle) +
        Math.abs(velocity) +
        Math.abs(sway) +
        Math.abs(swing) +
        Math.abs(viewX - lookX) +
        Math.abs(viewY - lookY) +
        Math.max(...dropHeight) >
        0.0005
    )
      wake();
  }
  function wake() {
    if (!dead && !frame && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    wake();
  }
  function move(e: PointerEvent) {
    const r = host.getBoundingClientRect();
    lookX = (e.clientX - r.left) / r.width - 0.5;
    lookY = 0.5 - (e.clientY - r.top) / r.height;
    wake();
  }
  function center() {
    lookX = lookY = 0;
    wake();
  }
  const size = new ResizeObserver(resize);
  size.observe(host);
  resize();
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerleave', center);
  document.addEventListener('visibilitychange', wake);
  return {
    set(reading: number, sample: number, reduce: boolean) {
      weights.forEach((unit, index) => {
        if (reading & unit && !(mass & unit)) dropHeight[index] = 0.23;
      });
      mass = reading;
      target = sample;
      quiet = reduce;
      counterweights.forEach((piece, i) => (piece.visible = !!(mass & weights[i])));
      wake();
    },
    dispose() {
      dead = true;
      cancelAnimationFrame(frame);
      size.disconnect();
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', center);
      document.removeEventListener('visibilitychange', wake);
      const materials = new Set<T.Material>(),
        geometries = new Set<T.BufferGeometry>();
      scene.traverse((object) => {
        if (object instanceof T.Mesh) {
          geometries.add(object.geometry);
          for (const m of Array.isArray(object.material) ? object.material : [object.material])
            materials.add(m);
          if (object instanceof T.InstancedMesh) object.dispose();
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      environment.dispose();
      sun.shadow.dispose();
      grain.dispose();
      weave.dispose();
      dialMap.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
