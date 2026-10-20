import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const createEnemy = (target) => {
    const enemyGroup = new THREE.Group();
    const loader = new GLTFLoader();

    loader.load('/models/enemy.glb', (gltf) => {
        const model = gltf.scene;
        model.rotation.x = Math.PI / 2;
        model.scale.set(5, 5, 5);

        const box = new THREE.Box3().setFromObject(model);
        model.position.z = -box.min.z; 

        enemyGroup.add(model);
        enemyGroup.userData.model = model;
    });

    enemyGroup.update = (target, obstacles, otherEnemies) => {
        if (!enemyGroup.userData.model) return;

        // Move toward player
        const direction = new THREE.Vector3().subVectors(target.position, enemyGroup.position);
        direction.z = 0; 
        direction.normalize();
        
        const speed = 0.5;
        const nextPosition = enemyGroup.position.clone().add(direction.multiplyScalar(speed));
        
        // Boundary checks
        if (nextPosition.x < -250 || nextPosition.x > 250 || nextPosition.y < -250 || nextPosition.y > 250) {
            return; // Stay within boundaries
        }

        // Collision checks (simplified using distance)
        const isColliding = obstacles.some(obs => {
            if (obs.userData.collisionBox) {
                const box = obs.userData.collisionBox.clone().applyMatrix4(obs.matrixWorld);
                return box.containsPoint(nextPosition);
            }
            return false;
        }) || otherEnemies.some(other => {
            if (other === enemyGroup) return false;
            return nextPosition.distanceTo(other.position) < 20; // Collision distance
        });

        if (!isColliding) {
            enemyGroup.position.copy(nextPosition);
            enemyGroup.position.z = 0; // Ensure on ground
        }
        
        // Rotate to face player
        const angle = Math.atan2(direction.y, direction.x);
        enemyGroup.userData.model.rotation.z = angle - Math.PI / 2;
    };

    return enemyGroup;
};
