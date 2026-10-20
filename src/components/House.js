import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Minimum gap (in world units) that must remain between two houses so the
// player always has room to move between them.
const MIN_HOUSE_GAP = 60;
const MAX_PLACEMENT_ATTEMPTS = 50;

// Generates `count` positions within the map bounds, making sure every pair
// of positions stays at least MIN_HOUSE_GAP apart (measured center to center,
// which also accounts for the houses' own footprint plus the required gap).
const generateHousePositions = (count) => {
    const positions = [];

    for (let i = 0; i < count; i++) {
        let position = null;

        for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
            const candidate = {
                x: (Math.random() - 0.5) * 400,
                y: (Math.random() - 0.5) * 400
            };

            const tooClose = positions.some(existing => {
                const dx = candidate.x - existing.x;
                const dy = candidate.y - existing.y;
                return Math.sqrt(dx * dx + dy * dy) < MIN_HOUSE_GAP;
            });

            if (!tooClose) {
                position = candidate;
                break;
            }
        }

        // Fall back to the last candidate even if it didn't satisfy the
        // minimum gap, so we never fail to produce a position.
        positions.push(position || {
            x: (Math.random() - 0.5) * 400,
            y: (Math.random() - 0.5) * 400
        });
    }

    return positions;
};

export const loadHouses = (mapGroup, count = 3) => {
    const loader = new GLTFLoader();
    mapGroup.userData.houses = mapGroup.userData.houses || [];

    // Precompute all positions up-front (synchronously) so spacing can be
    // guaranteed regardless of the order in which the async model loads finish.
    const positions = generateHousePositions(count);

    for (let i = 0; i < count; i++) {
        const position = positions[i];
        loader.load('/models/small_house.glb', (gltf) => {
            const model = gltf.scene;
            model.rotation.x = Math.PI / 2;
            model.scale.set(65, 65, 65);
            model.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);

            // Position within the map, spaced out from the other houses
            model.position.x = position.x;
            model.position.y = position.y;

            // Adjust position to sit on the ground (use a temporary box to find the
            // ground offset before the final world-space box is computed below)
            const groundBox = new THREE.Box3().setFromObject(model);
            model.position.z = -groundBox.min.z;

            mapGroup.add(model);
            model.updateMatrixWorld(true);

            // Compute the final world-space collision box now that the model is
            // fully positioned/rotated/scaled. This box is already in world space,
            // so it must be used directly (no further matrixWorld transform needed).
            model.userData.collisionBox = new THREE.Box3().setFromObject(model);

            mapGroup.userData.houses.push(model);
        });
    }
};

export const clearHouses = (mapGroup) => {
    const houses = mapGroup.userData.houses || [];
    houses.forEach(house => mapGroup.remove(house));
    houses.length = 0;
};
