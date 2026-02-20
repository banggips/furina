// script gerak furina
let currentVrm = null;
let walkTime = 0;
let mode = "APPROACH"; 
let posX = 0, posZ = -5;
let opacityVal = 0;
let isTransitioning = false; 

// 1. Inisialisasi Scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

// 2. Pencahayaan
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const light = new THREE.DirectionalLight(0xffffff, 0.6);
light.position.set(0, 5, 5);
scene.add(light);

camera.position.set(0, 1.2, 6); 
camera.lookAt(0, 0.5, 0);

// 3. Load Model VRM
new THREE.GLTFLoader().load('model.vrm', (gltf) => {
    THREE.VRM.from(gltf).then((vrm) => {
        currentVrm = vrm;
        scene.add(vrm.scene);
        vrm.scene.position.y = -0.9; 
    });
});

// 4. Fungsi Efek Visual (Opacity & Blur)
function applyVisuals() {
    if (!currentVrm) return;
    
    const blurAmt = (1 - opacityVal) * 10;
    renderer.domElement.style.filter = opacityVal < 0.9 ? `blur(${blurAmt}px)` : 'none';

    currentVrm.scene.traverse((obj) => {
        if (obj.isMesh && obj.material) {
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            materials.forEach(m => {
                m.transparent = true;
                m.opacity = opacityVal;
            });
        }
    });
}

const clock = new THREE.Clock();

// 5. Loop Animasi Utama
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (currentVrm) {
        const walkSpeed = 4.0;
        walkTime += delta * walkSpeed;
        const swing = Math.sin(walkTime); 
        const screenBoundary = 3.2;

        if (!isTransitioning) {
            if (mode === "APPROACH") {
                posZ += 0.018;
                currentVrm.scene.rotation.y = Math.PI;
                opacityVal = THREE.MathUtils.lerp(opacityVal, 1, 0.05);
                if (posZ > 3.5) isTransitioning = true;
            } 
            else if (mode === "WALK_RIGHT") {
                posX += 0.015;
                currentVrm.scene.rotation.y = -1.57;
                opacityVal = THREE.MathUtils.lerp(opacityVal, 1, 0.05);
                if (posX > screenBoundary) isTransitioning = true;
            } 
            else if (mode === "WALK_LEFT") {
                posX -= 0.015;
                currentVrm.scene.rotation.y = 1.57;
                opacityVal = THREE.MathUtils.lerp(opacityVal, 1, 0.05);
                if (posX < -screenBoundary) isTransitioning = true;
            }
            currentVrm.scene.position.set(posX, -0.9, posZ);
        } else {
            opacityVal -= 0.04; 
            if (opacityVal <= 0) {
                opacityVal = 0;
                isTransitioning = false;
                
                if (mode === "APPROACH") {
                    mode = "WALK_RIGHT"; posX = -screenBoundary; posZ = 0;
                } else if (mode === "WALK_RIGHT") {
                    mode = "WALK_LEFT";
                } else if (mode === "WALK_LEFT") {
                    mode = "APPROACH"; posZ = -5; posX = 0;
                }
            }
        }

        applyVisuals();

        // --- Logika Tulang ---
        const humanoid = currentVrm.humanoid;
        const bones = THREE.VRMSchema.HumanoidBoneName;
        const lLeg = humanoid.getBoneNode(bones.LeftUpperLeg);
        const rLeg = humanoid.getBoneNode(bones.RightUpperLeg);
        const lKnee = humanoid.getBoneNode(bones.LeftLowerLeg);
        const rKnee = humanoid.getBoneNode(bones.RightLowerLeg);

        if (lLeg && rLeg && lKnee && rKnee) {
            lLeg.rotation.x = swing * 0.4;
            rLeg.rotation.x = -swing * 0.4;
            lKnee.rotation.x = Math.min(0, swing * 0.9); 
            rKnee.rotation.x = Math.min(0, -swing * 0.9);
        }

        const lArm = humanoid.getBoneNode(bones.LeftUpperArm);
        const rArm = humanoid.getBoneNode(bones.RightUpperArm);
        if (lArm && rArm) {
            lArm.rotation.z = 0.5; rArm.rotation.z = -0.5;
            lArm.rotation.x = -swing * 0.3; rArm.rotation.x = swing * 0.3;
        }

        currentVrm.update(delta);
    }
    renderer.render(scene, camera);
}

// 6. Handle Resize Layar
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();