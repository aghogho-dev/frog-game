import * as THREE from 'three';

export const createMap = () => {
    const mapGroup = new THREE.Group();
    const size = 500;
    const divisions = 20;
    const tileSize = size / divisions;

    for (let i = 0; i < divisions; i++) {
        for (let j = 0; j < divisions; j++) {
            // The frog model is green, so the floor must stay far away from
            // green/mid-tone colors to meet WCAG contrast guidelines. Using
            // two very light, near-white tones keeps the floor's relative
            // luminance high (>=0.88) so the contrast ratio against a
            // typical mid-tone green frog stays at or above the WCAG AA
            // 4.5:1 threshold, while still forming a visible checkerboard.
            const color = (i + j) % 2 === 0 ? '#FFFFFF' : '#F5F5F5';
            const geometry = new THREE.PlaneGeometry(tileSize, tileSize);
            const material = new THREE.MeshBasicMaterial({ color: color });
            const tile = new THREE.Mesh(geometry, material);
            tile.position.x = i * tileSize - size / 2 + tileSize / 2;
            tile.position.y = j * tileSize - size / 2 + tileSize / 2;
            mapGroup.add(tile);
        }
    }
    return mapGroup;
};
