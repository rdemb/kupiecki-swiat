import * as THREE from 'three';
import type { getLightingAtmosphere } from './terrainAndShaders';

// Linear HDR radiance sampled over the full sphere. PMREM prefilters this for
// the different roughnesses of stone, glazed tiles, brass and ice.
export function outdoorReflections(
  generator: THREE.PMREMGenerator,
  atmosphere: ReturnType<typeof getLightingAtmosphere>,
) {
  const width = 256,
    height = 128;
  const data = new Float32Array(width * height * 4);
  const ground = new THREE.Color(atmosphere.hemiGround);
  const horizon = new THREE.Color(atmosphere.horizonColor);
  const zenith = new THREE.Color(atmosphere.topColor);
  const sun = new THREE.Color(atmosphere.sunColor);
  const direction = new THREE.Vector3(...atmosphere.sunPos).normalize();
  const sky = new THREE.Color();
  for (let row = 0; row < height; row++) {
    const elevation = ((row + 0.5) / height - 0.5) * Math.PI;
    const y = Math.sin(elevation),
      radius = Math.cos(elevation);
    for (let col = 0; col < width; col++) {
      const azimuth = ((col + 0.5) / width - 0.5) * 2 * Math.PI;
      const align = Math.max(
        0,
        direction.x * radius * Math.cos(azimuth) +
          direction.y * y +
          direction.z * radius * Math.sin(azimuth),
      );
      if (y < 0) sky.copy(horizon).lerp(ground, Math.min(1, -y * 7));
      else sky.copy(horizon).lerp(zenith, Math.sqrt(y));
      const glow = (Math.pow(align, 24) * 0.32 + Math.pow(align, 1300) * 16) * atmosphere.sunIntensity;
      const at = (row * width + col) * 4;
      data[at] = sky.r + sun.r * glow;
      data[at + 1] = sky.g + sun.g * glow;
      data[at + 2] = sky.b + sun.b * glow;
      data[at + 3] = 1;
    }
  }
  const panorama = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  panorama.mapping = THREE.EquirectangularReflectionMapping;
  panorama.needsUpdate = true;
  const environment = generator.fromEquirectangular(panorama);
  panorama.dispose();
  return environment;
}
