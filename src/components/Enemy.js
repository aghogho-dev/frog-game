import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const BASE_SPEED = 0.5;

export const createEnemy = (target) => {
    const enemyGroup = new THREE.Group();
    const loader = new GLTFLoader();

    enemyGroup.userData.speed = BASE_SPEED;

    loader.load('/models/enemy.glb', (gltf) => {
        const model = gltf.scene;
        model.rotation.order = 'ZXY';
        model.rotation.x = Math.PI / 2;
        model.scale.set(5, 5, 5);

        const box = new THREE.Box3().setFromObject(model);
        model.position.z = -box.min.z; 

        enemyGroup.add(model);
        enemyGroup.userData.model = model;
    });

    enemyGroup.update = (obstacles, otherEnemies) => {
        if (!enemyGroup.userData.model) return;

        // Move toward player
        const direction = new THREE.Vector3().subVectors(target.position, enemyGroup.position);
        direction.z = 0; // Move in XY plane

        if (direction.lengthSq() > 0.0001) {
            direction.normalize();

            const speed = enemyGroup.userData.speed;
            const nextPosition = enemyGroup.position.clone().add(direction.clone().multiplyScalar(speed));

            // Don't move into the player itself
            const isCollidingWithPlayer = nextPosition.distanceTo(target.position) < 20;

            // Collision checks against obstacles
            const isCollidingWithObstacle = (obstacles || []).some(obs => {
                if (obs.userData.collisionBox) {
                    return obs.userData.collisionBox.containsPoint(nextPosition);
                }
                return false;
            });

            // Collision checks against other enemies
            const isCollidingWithEnemy = (otherEnemies || []).some(other => {
                if (other === enemyGroup) return false;
                return nextPosition.distanceTo(other.position) < 20;
            });

            if (!isCollidingWithPlayer && !isCollidingWithObstacle && !isCollidingWithEnemy) {
                enemyGroup.position.copy(nextPosition);
                enemyGroup.position.z = 0; // Ensure on ground
            }

            // Rotate to face player
            const angle = Math.atan2(direction.y, direction.x);
            enemyGroup.userData.model.rotation.set(Math.PI / 2, 0, angle - Math.PI / 2);
        }
    };

    return enemyGroup;
};
