import * as THREE from 'three';

const FIREBALL_SPEED = 4;

// Fire shape dimensions: made long and thin (large surface area relative to
// its volume) so the flame covers more ground along its path, making it
// easier to consume an enemy even if the aim isn't pixel-perfect.
const FIREBALL_LENGTH = 70;
const FIREBALL_WIDTH = 20;

// Effective hit radius used for capsule-style collision against the flame's
// full length (see `userData.length`/`userData.direction` in main.js),
// rather than just its tip, further widening the forgiving hitbox.
const FIREBALL_HIT_RADIUS = FIREBALL_WIDTH;

export const createFireball = (origin, direction) => {
    const fireball = new THREE.Group();

    // Build a flame-like silhouette out of stacked, tapering cones so the
    // shape reads as "fire" rather than a plain ball, while staying thin
    // (large surface-area-to-volume ratio) for a sleek, fast-looking flame.
    const outerCone = new THREE.Mesh(
        new THREE.ConeGeometry(FIREBALL_WIDTH * 0.5, FIREBALL_LENGTH, 10),
        new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.85 })
    );
    const innerCone = new THREE.Mesh(
        new THREE.ConeGeometry(FIREBALL_WIDTH * 0.28, FIREBALL_LENGTH * 0.6, 10),
        new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.95 })
    );

    // Cones point up the local Y axis by default; rotate so they point
    // along the local X axis (the direction of travel) instead. The cone's
    // apex (narrow tip) is placed near the frog (local x = 0) and its base
    // (wide end) extends toward the travel direction, matching the look of
    // the fire icon — small near its source, wider further away.
    outerCone.rotation.z = Math.PI / 2;
    innerCone.rotation.z = Math.PI / 2;
    outerCone.position.x = FIREBALL_LENGTH / 2;
    innerCone.position.x = (FIREBALL_LENGTH * 0.6) / 2 + FIREBALL_LENGTH * 0.25;

    fireball.add(outerCone);
    fireball.add(innerCone);

    fireball.position.copy(origin);
    fireball.position.z = 20;

    const normalizedDirection = direction.clone();
    normalizedDirection.z = 0;
    if (normalizedDirection.lengthSq() < 0.0001) {
        normalizedDirection.set(0, 1, 0);
    }
    normalizedDirection.normalize();

    // Orient the whole flame group to face its travel direction.
    fireball.rotation.z = Math.atan2(normalizedDirection.y, normalizedDirection.x);

    fireball.userData.direction = normalizedDirection;
    fireball.userData.speed = FIREBALL_SPEED;
    fireball.userData.length = FIREBALL_LENGTH;
    fireball.userData.hitRadius = FIREBALL_HIT_RADIUS;

    let flickerTime = 0;

    fireball.update = (delta = 0.016) => {
        fireball.position.addScaledVector(fireball.userData.direction, fireball.userData.speed);

        // Subtle flicker so the flame feels alive while traveling.
        flickerTime += delta;
        const flicker = 1 + Math.sin(flickerTime * 25) * 0.08;
        outerCone.scale.set(flicker, 1, flicker);
        innerCone.scale.set(flicker, 1, flicker);
    };

    // Returns the closest point on the flame's full length (a segment from
    // the tail to the tip) to the given point — used for capsule-style
    // collision so enemies can be "consumed" along the whole flame, not
    // just at its tip.
    fireball.getClosestPointOnSegment = (point) => {
        const tail = fireball.position.clone();
        const tip = fireball.position.clone().addScaledVector(fireball.userData.direction, fireball.userData.length);
        const segment = new THREE.Vector3().subVectors(tip, tail);
        const segmentLengthSq = segment.lengthSq();
        if (segmentLengthSq < 0.0001) return tail;

        const t = THREE.MathUtils.clamp(
            new THREE.Vector3().subVectors(point, tail).dot(segment) / segmentLengthSq,
            0,
            1
        );
        return tail.addScaledVector(segment, t);
    };

    return fireball;
};
