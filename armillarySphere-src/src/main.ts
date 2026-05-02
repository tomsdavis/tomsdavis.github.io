import * as THREE from 'three';

const canvas = document.getElementById('scene') as HTMLCanvasElement;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.01,
  100,
);
camera.position.set(3, 2, 4);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(1, 48, 32),
  new THREE.MeshNormalMaterial(),
);
scene.add(earth);

const celestialSphere = new THREE.Mesh(
  new THREE.SphereGeometry(2, 48, 32),
  new THREE.MeshBasicMaterial({
    color: 0x223355,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
    wireframe: true,
  }),
);
scene.add(celestialSphere);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

renderer.setAnimationLoop((t) => {
  earth.rotation.y = t * 0.0002;
  renderer.render(scene, camera);
});
