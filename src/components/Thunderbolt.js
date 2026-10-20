import * as THREE from 'three';

// How long the bolt stays visible before fading out completely.
const STRIKE_DURATION = 0.4; // seconds
const BOLT_HEIGHT = 400;
const SEGMENTS = 8;

// Builds a single jagged lightning bolt mesh, zig-zagging slightly as it
// travels from high in the sky down to the ground at `position`.
const buildBoltMesh = () => {
    const points = [];
    for (let i = 0; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS;
        const jitter = i === 0 || i === SEGMENTS ? 0 : (Math.random() - 0.5) * 14;
        points.push(new THREE.Vector3(jitter, jitter * 0.6, BOLT_HEIGHT * (1 - t)));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, SEGMENTS * 2, 2.5, 6, false);
    const material = new THREE.MeshBasicMaterial({
        color: 0xbfefff,
        transparent: true,
        opacity: 0.95
    });
    return new THREE.Mesh(geometry, material);
};

// Creates a thunderbolt strike effect that comes down from the sky and
// hits the ground at `position`. The provided `onImpact` callback fires
// once, shortly after the bolt visually reaches the ground, so the caller
// can apply damage/removal in sync with the strike.
export const createThunderbolt = (position, onImpact) => {
    const group = new THREE.Group();
    group.position.set(position.x, position.y, 0);

    const bolt = buildBoltMesh();
    group.add(bolt);

    // A bright flash/glow at the impact point on the ground.
    const flash = new THREE.Mesh(
        new THREE.CircleGeometry(30, 20),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
    );
    flash.position.z = 1;
    group.add(flash);

    let elapsed = 0;
    let impactTriggered = false;
    const IMPACT_TIME = STRIKE_DURATION * 0.35;

    group.userData.isFinished = false;

    group.update = (delta) => {
        elapsed += delta;

        if (!impactTriggered && elapsed >= IMPACT_TIME) {
            impactTriggered = true;
            flash.material.opacity = 0.9;
            if (typeof onImpact === 'function') {
                onImpact();
            }
        }

        if (elapsed < IMPACT_TIME) {
            bolt.material.opacity = 0.95;
        } else {
            const fadeProgress = Math.min((elapsed - IMPACT_TIME) / (STRIKE_DURATION - IMPACT_TIME), 1);
            bolt.material.opacity = 0.95 * (1 - fadeProgress);
            flash.material.opacity = Math.max(0, 0.9 * (1 - fadeProgress));
        }

        if (elapsed >= STRIKE_DURATION) {
            group.userData.isFinished = true;
        }
    };

    return group;
};
