import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const createPlayer = () => {
    const playerGroup = new THREE.Group();
    const loader = new GLTFLoader();
    
    let model = null;
    
    playerGroup.userData.moveQueue = [];
    playerGroup.userData.currentMove = null;
    playerGroup.userData.facingDirection = new THREE.Vector3(0, 1, 0);

    // Tracks which arrow keys are currently held, so that pressing two
    // adjacent keys together (e.g. Up + Right) produces a smooth 45-degree
    // diagonal jump instead of two separate 90-degree jumps.
    const heldDirectionKeys = new Set();
    const computeHeldDirectionVector = () => {
        let x = 0;
        let y = 0;
        if (heldDirectionKeys.has('ArrowUp')) y += 1;
        if (heldDirectionKeys.has('ArrowDown')) y -= 1;
        if (heldDirectionKeys.has('ArrowLeft')) x -= 1;
        if (heldDirectionKeys.has('ArrowRight')) x += 1;
        return { x, y };
    };
    
    const MOVE_SPEED = 0.05;
    const JUMP_HEIGHT = 50;
    const JUMP_DISTANCE = 50;

    const ATTACK_COOLDOWN = 1; // seconds
    const ATTACK_RADIUS = 40;
    const ATTACK_DISPLAY_TIME = 0.2; // seconds the circle stays visible

    const FIRE_COOLDOWN = 1; // seconds between fire spits
    const SHIELD_DURATION = 5; // seconds of invulnerability granted by the shield gift

    playerGroup.userData.moveSpeed = MOVE_SPEED;
    playerGroup.userData.attackCooldown = ATTACK_COOLDOWN;
    playerGroup.userData.attackRadius = ATTACK_RADIUS;
    playerGroup.userData.attackTriggered = false;
    playerGroup.userData.lastAttackTime = -ATTACK_COOLDOWN;
    let attackTimer = 0;

    // Special attacks inventory: fireballs and thunderbolts, earned by completing stages.
    playerGroup.userData.fireCount = 0;
    playerGroup.userData.thunderboltCount = 0;
    playerGroup.userData.fireTriggered = false;
    playerGroup.userData.thunderboltTriggered = false;
    playerGroup.userData.lastFireTime = -FIRE_COOLDOWN;

    // Random stage-reward gifts: a shield (temporary invulnerability, simple
    // key tap) and a time-freeze (very special gift, requires its own
    // keyboard combination since it is rare/powerful).
    playerGroup.userData.shieldCount = 0;
    playerGroup.userData.freezeCount = 0;
    playerGroup.userData.freezeTriggered = false;
    playerGroup.userData.shieldActiveUntil = -Infinity;

    // Extra lives: granted by the "health" random stage gift. Unlike a full
    // game over, using an extra life lets the player keep playing on the
    // same stage instead of being sent back to stage 1.
    playerGroup.userData.extraLives = 0;

    const MAX_HEALTH = 100;
    const DAMAGE_PER_HIT = 20;
    const DAMAGE_COOLDOWN = 1; // seconds of invulnerability after being hit
    playerGroup.userData.maxHealth = MAX_HEALTH;
    playerGroup.userData.health = MAX_HEALTH;
    playerGroup.userData.isDead = false;
    let lastDamageTime = -DAMAGE_COOLDOWN;

    playerGroup.userData.takeDamage = (now, damageAmount = DAMAGE_PER_HIT) => {
        if (playerGroup.userData.isDead) return false;
        if (now < playerGroup.userData.shieldActiveUntil) return false;
        if (now - lastDamageTime < DAMAGE_COOLDOWN) return false;
        lastDamageTime = now;
        playerGroup.userData.health = Math.max(0, playerGroup.userData.health - damageAmount);
        if (playerGroup.userData.health <= 0) {
            playerGroup.userData.isDead = true;
            playerGroup.visible = false;
        }
        return true;
    };

    // Consumes one extra life (if available) to revive the player on the
    // current stage instead of triggering a full game over. Returns true
    // when a revive happened.
    playerGroup.userData.reviveWithExtraLife = () => {
        if (playerGroup.userData.extraLives <= 0) return false;
        playerGroup.userData.extraLives -= 1;
        playerGroup.userData.health = MAX_HEALTH;
        playerGroup.userData.isDead = false;
        playerGroup.visible = true;
        lastDamageTime = -DAMAGE_COOLDOWN;
        return true;
    };

    playerGroup.userData.reset = () => {
        playerGroup.userData.health = MAX_HEALTH;
        playerGroup.userData.isDead = false;
        lastDamageTime = -DAMAGE_COOLDOWN;
        playerGroup.visible = true;
        playerGroup.position.set(0, 0, 0);
        playerGroup.userData.moveQueue = [];
        playerGroup.userData.currentMove = null;
        playerGroup.userData.facingDirection.set(0, 1, 0);
        heldDirectionKeys.clear();
        playerGroup.userData.moveSpeed = MOVE_SPEED;
        playerGroup.userData.attackCooldown = ATTACK_COOLDOWN;
        playerGroup.userData.attackRadius = ATTACK_RADIUS;
        playerGroup.userData.fireCount = 0;
        playerGroup.userData.thunderboltCount = 0;
        playerGroup.userData.fireTriggered = false;
        playerGroup.userData.thunderboltTriggered = false;
        playerGroup.userData.lastFireTime = -FIRE_COOLDOWN;
        playerGroup.userData.shieldCount = 0;
        playerGroup.userData.freezeCount = 0;
        playerGroup.userData.freezeTriggered = false;
        playerGroup.userData.shieldActiveUntil = -Infinity;
        playerGroup.userData.extraLives = 0;
        shieldMesh.visible = false;
    };

    const attackCircle = new THREE.Mesh(
        new THREE.CircleGeometry(ATTACK_RADIUS, 32),
        new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 })
    );
    attackCircle.position.set(0, 0, 0.25);
    attackCircle.visible = false;
    playerGroup.add(attackCircle);

    // Keeps the visible attack circle in sync with the actual hit-detection
    // radius (which can grow slightly with difficulty), so the player always
    // sees exactly how far their attack reaches and never "hits" something
    // that doesn't visually touch the circle.
    playerGroup.userData.updateAttackRadiusVisual = () => {
        const radius = playerGroup.userData.attackRadius;
        if (attackCircle.geometry.parameters.radius !== radius) {
            attackCircle.geometry.dispose();
            attackCircle.geometry = new THREE.CircleGeometry(radius, 32);
        }
    };

    // Visual effect for the shield gift: a translucent glowing bubble that
    // surrounds the frog while the shield is active, so the player can see
    // the invulnerability effect (instead of it being invisible).
    const SHIELD_RADIUS = 35;
    const shieldMesh = new THREE.Mesh(
        new THREE.SphereGeometry(SHIELD_RADIUS, 24, 16),
        new THREE.MeshBasicMaterial({
            color: 0x33ccff,
            transparent: true,
            opacity: 0.35,
            wireframe: false,
            depthWrite: false,
        })
    );
    shieldMesh.position.set(0, 0, 25);
    shieldMesh.visible = false;
    playerGroup.add(shieldMesh);

    const shieldWireframe = new THREE.Mesh(
        new THREE.SphereGeometry(SHIELD_RADIUS, 12, 8),
        new THREE.MeshBasicMaterial({
            color: 0xaaeeff,
            transparent: true,
            opacity: 0.6,
            wireframe: true,
            depthWrite: false,
        })
    );
    shieldMesh.add(shieldWireframe);

    // Secret cheats: single-key combos (Alt + digit) instead of typed words,
    // so they are quick and reliable to trigger (a single simultaneous key
    // press rather than a sequence of separate keystrokes that can be
    // dropped/mistimed). Intentionally undocumented (not shown in the
    // controls panel/menu/README).
    // Alt+1 (was "mimi")  -> shield
    // Alt+2 (was "agh")   -> extra life
    // Alt+3 (was "pre")   -> time freeze
    // Alt+4 (was "mama")  -> alternate fireball / thunderbolt
    let mamaAlternateIsFire = true;
    window.addEventListener('keydown', (e) => {
        if (e.altKey && !e.ctrlKey && !e.shiftKey) {
            if (e.code === 'Digit1' || e.code === 'Numpad1') {
                playerGroup.userData.shieldCount += 1;
            } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
                playerGroup.userData.extraLives += 1;
            } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
                playerGroup.userData.freezeCount += 1;
            } else if (e.code === 'Digit4' || e.code === 'Numpad4') {
                if (mamaAlternateIsFire) {
                    playerGroup.userData.fireCount += 1;
                } else {
                    playerGroup.userData.thunderboltCount += 1;
                }
                mamaAlternateIsFire = !mamaAlternateIsFire;
            }
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            if (!e.repeat) {
                heldDirectionKeys.add(e.key);
                const dir = computeHeldDirectionVector();
                if (dir.x !== 0 || dir.y !== 0) {
                    playerGroup.userData.moveQueue.push(dir);
                }
            }
        } else if (e.code === 'Space') {
            if (playerGroup.userData.isDead) return;
            const now = performance.now() / 1000;

            if (e.ctrlKey) {
                // Fire attack: Control + Spacebar spits fire toward the nearest enemy.
                if (playerGroup.userData.fireCount > 0 && now - playerGroup.userData.lastFireTime >= FIRE_COOLDOWN) {
                    playerGroup.userData.lastFireTime = now;
                    playerGroup.userData.fireCount -= 1;
                    playerGroup.userData.fireTriggered = true;
                }
                return;
            }

            if (now - playerGroup.userData.lastAttackTime >= playerGroup.userData.attackCooldown) {
                playerGroup.userData.lastAttackTime = now;
                playerGroup.userData.attackTriggered = true;
                attackCircle.visible = true;
                attackCircle.material.opacity = 0.6;
                attackTimer = 0;
            }
        } else if (e.code === 'KeyT') {
            // Thunderbolt: destroys all enemies currently on screen.
            if (playerGroup.userData.isDead) return;
            if (playerGroup.userData.thunderboltCount > 0) {
                playerGroup.userData.thunderboltCount -= 1;
                playerGroup.userData.thunderboltTriggered = true;
            }
        } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyF') {
            // Time Freeze: a very special, rare gift, so it requires its own
            // keyboard combination (Ctrl + Shift + F) rather than a simple tap.
            if (playerGroup.userData.isDead) return;
            if (playerGroup.userData.freezeCount > 0) {
                playerGroup.userData.freezeCount -= 1;
                playerGroup.userData.freezeTriggered = true;
            }
        } else if (e.code === 'KeyH') {
            // Shield: a simple gift, activated with a single key tap, granting
            // temporary invulnerability.
            if (playerGroup.userData.isDead) return;
            if (playerGroup.userData.shieldCount > 0) {
                playerGroup.userData.shieldCount -= 1;
                playerGroup.userData.shieldActiveUntil = performance.now() / 1000 + SHIELD_DURATION;
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            heldDirectionKeys.delete(e.key);
        }
    });

    loader.load('/models/tode.glb', (gltf) => {
        model = gltf.scene;
        model.rotation.order = 'ZXY';
        model.rotation.x = Math.PI / 2;
        model.scale.set(20, 20, 20);

        const box = new THREE.Box3().setFromObject(model);
        model.position.z = -box.min.z; 

        playerGroup.add(model);
    });

    playerGroup.update = (obstacles, enemies, delta = 0) => {
        if (playerGroup.userData.isDead) {
            shieldMesh.visible = false;
            return;
        }

        const now = performance.now() / 1000;
        const isShieldActive = now < playerGroup.userData.shieldActiveUntil;
        shieldMesh.visible = isShieldActive;
        if (isShieldActive) {
            shieldMesh.rotation.z += delta * 1.5;
            shieldWireframe.rotation.x += delta * 0.8;
            const pulse = 1 + Math.sin(now * 6) * 0.05;
            shieldMesh.scale.set(pulse, pulse, pulse);
        }

        if (attackCircle.visible) {
            attackTimer += delta;
            const fadeProgress = Math.min(attackTimer / ATTACK_DISPLAY_TIME, 1);
            attackCircle.material.opacity = 0.6 * (1 - fadeProgress);
            if (fadeProgress >= 1) {
                attackCircle.visible = false;
            }
        }

        if (!playerGroup.userData.currentMove && playerGroup.userData.moveQueue.length > 0) {
            const nextMove = playerGroup.userData.moveQueue.shift();

            // Normalize so diagonal (45-degree) jumps cover the same distance
            // as cardinal (90-degree) jumps, instead of sqrt(2) times further.
            const moveLength = Math.hypot(nextMove.x, nextMove.y) || 1;
            const unitDirection = { x: nextMove.x / moveLength, y: nextMove.y / moveLength };

            // Calculate potential new position
            const potentialPos = playerGroup.position.clone();
            potentialPos.x += unitDirection.x * JUMP_DISTANCE;
            potentialPos.y += unitDirection.y * JUMP_DISTANCE;

            // Boundary checks
            if (potentialPos.x < -250 || potentialPos.x > 250 || potentialPos.y < -250 || potentialPos.y > 250) {
                return; // Prevent moving out of bounds
            }
            
            // Collision checks
            const isColliding = obstacles.some(obs => {
                if (obs.userData.collisionBox) {
                    return obs.userData.collisionBox.containsPoint(potentialPos);
                }
                return false;
            }) || enemies.some(enemy => {
                return potentialPos.distanceTo(enemy.position) < 20;
            });

            if (!isColliding) {
                playerGroup.userData.currentMove = {
                    direction: unitDirection,
                    progress: 0,
                    startPos: playerGroup.position.clone()
                };
            }
        }

        if (playerGroup.userData.currentMove) {
            const move = playerGroup.userData.currentMove;
            move.progress += playerGroup.userData.moveSpeed;
            
            const progress = Math.min(move.progress, 1);
            
            // Jump logic
            playerGroup.position.z = Math.sin(progress * Math.PI) * JUMP_HEIGHT;
            
            // Directional movement (unit direction, possibly diagonal at 45 degrees)
            const direction = { x: move.direction.x * JUMP_DISTANCE, y: move.direction.y * JUMP_DISTANCE };

            playerGroup.userData.facingDirection.set(direction.x, direction.y, 0).normalize();

            playerGroup.position.x = move.startPos.x + direction.x * progress;
            playerGroup.position.y = move.startPos.y + direction.y * progress;
            
            // Rotate model to face the direction of movement/jump. The tode.glb
            // model's forward axis is offset by 180 degrees compared to the
            // enemy/boss models, so the angle here is offset by +PI/2 instead
            // of -PI/2 to make the frog visually face the same direction as
            // `facingDirection` (which is what fire attacks aim along).
            if (model) {
                const angle = Math.atan2(direction.y, direction.x);
                const zAngle = angle + Math.PI / 2;

                model.rotation.set(Math.PI / 2, 0, zAngle);
            }
            
            if (move.progress >= 1) {
                playerGroup.userData.currentMove = null;
                playerGroup.position.z = 0; // Ensure back on ground
            }
        }
    };

    return playerGroup;
};
