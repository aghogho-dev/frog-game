import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// The supervillain reuses the regular enemy model but much bigger and
// tinted red so it clearly reads as a special, more dangerous foe.
const BOSS_SCALE = 14;
const BASE_SPEED = 0.35;

export const createBoss = (target) => {
    const bossGroup = new THREE.Group();
    const loader = new GLTFLoader();

    bossGroup.userData.isBoss = true;
    bossGroup.userData.speed = BASE_SPEED;
    bossGroup.userData.maxHealth = 100;
    bossGroup.userData.health = 100;

    loader.load('/models/enemy.glb', (gltf) => {
        const model = gltf.scene;
        model.rotation.order = 'ZXY';
        model.rotation.x = Math.PI / 2;
        model.scale.set(BOSS_SCALE, BOSS_SCALE, BOSS_SCALE);

        // Tint the villain red so it's visually distinct from regular enemies.
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((mat) => {
                    if (mat.color) mat.color.set(0x8b0000);
                    if ('emissive' in mat) mat.emissive = new THREE.Color(0x330000);
                });
            }
        });

        const box = new THREE.Box3().setFromObject(model);
        model.position.z = -box.min.z;

        bossGroup.add(model);
        bossGroup.userData.model = model;
    });

    bossGroup.userData.takeHit = (amount) => {
        bossGroup.userData.health = Math.max(0, bossGroup.userData.health - amount);
        return bossGroup.userData.health <= 0;
    };

    bossGroup.update = (obstacles) => {
        if (!bossGroup.userData.model) return;

        const direction = new THREE.Vector3().subVectors(target.position, bossGroup.position);
        direction.z = 0;

        if (direction.lengthSq() > 0.0001) {
            direction.normalize();

            const speed = bossGroup.userData.speed;
            const nextPosition = bossGroup.position.clone().add(direction.clone().multiplyScalar(speed));

            const isCollidingWithPlayer = nextPosition.distanceTo(target.position) < 45;

            const isCollidingWithObstacle = (obstacles || []).some(obs => {
                if (obs.userData.collisionBox) {
                    return obs.userData.collisionBox.containsPoint(nextPosition);
                }
                return false;
            });

            if (!isCollidingWithPlayer && !isCollidingWithObstacle) {
                bossGroup.position.copy(nextPosition);
                bossGroup.position.z = 0;
            }

            const angle = Math.atan2(direction.y, direction.x);
            bossGroup.userData.model.rotation.set(Math.PI / 2, 0, angle - Math.PI / 2);
        }
    };

    return bossGroup;
};
