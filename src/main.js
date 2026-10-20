import * as THREE from 'three';
import './style.css';
import { createPlayer } from './components/Player.js';
import { createCamera } from './components/Camera.js';
import { createRenderer } from './components/Renderer.js';
import { createMap } from './components/Map.js';
import { loadHouses, clearHouses } from './components/House.js';
import { createEnemy } from './components/Enemy.js';
import { createFireball } from './components/Fireball.js';
import { createThunderbolt } from './components/Thunderbolt.js';
import { createBoss } from './components/Boss.js';
import { fetchTopScores, checkQualifiesForTopScores, submitScore } from './highScores.js';

// Scene
const scene = new THREE.Scene();

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(-100, -100, 200);
scene.add(directionalLight);

// Components
const map = createMap();
scene.add(map);
loadHouses(map);

const player = createPlayer();
scene.add(player);

const enemies = [];
const SPAWN_CORNERS = [
    {x: -200, y: -200},
    {x: 200, y: -200},
    {x: -200, y: 200},
    {x: 200, y: 200}
];
const BASE_ENEMY_SPAWN_DELAY = 5; // seconds between enemy spawns
const MIN_ENEMY_SPAWN_DELAY = 1;
let enemySpawnDelay = BASE_ENEMY_SPAWN_DELAY;
let spawnTimer = 0;

// Increasing complexity: difficulty scales with how long the current game has been running
const DIFFICULTY_GROWTH_RATE = 0.02; // growth rate factor used to derive the difficulty factor from elapsed time
const BASE_ENEMY_SPEED = 0.5;
const BASE_PLAYER_MOVE_SPEED = 0.05;
const BASE_PLAYER_ATTACK_COOLDOWN = 1;
const BASE_PLAYER_ATTACK_RADIUS = 40;
// Cap how much the attack range can grow with difficulty so it only
// "slightly" increases (per spec) and never lets the player damage the
// boss/enemies from far outside the visible attack circle.
const MAX_PLAYER_ATTACK_RADIUS = 60;

// Enemy parameters scale slightly faster than player parameters to maintain challenge
const ENEMY_DIFFICULTY_MULTIPLIER = 1.5;
const PLAYER_DIFFICULTY_MULTIPLIER = 1;

// Each stage ends successfully after this many seconds of play, then the next (harder) stage begins
const STAGE_DURATION = 180; // 3 minutes
const STAGE_DIFFICULTY_STEP = 0.5; // extra difficulty factor added permanently per completed stage
let elapsedTime = 0;
let stage = 1;

// Supervillain boss: every 5th stage spawns a tougher boss that all the
// frog's weapons can damage. Enemies keep spawning for a grace period after
// the boss appears, then it becomes a one-on-one fight until the boss dies.
const BOSS_STAGE_INTERVAL = 5;
const BOSS_SPAWN_GRACE_PERIOD = 20; // seconds enemies keep spawning after the boss appears
const BOSS_BASE_HEALTH = 600; // health of the first boss (stage 5)
const BOSS_HEALTH_PER_TIER = 350; // extra health per additional boss tier (stage 10, 15, ...)
const BOSS_SPEED_PER_TIER = 0.04;
const BOSS_TOUCH_DISTANCE = 45;
const BOSS_TOUCH_DAMAGE = 35; // hurts the frog more than regular enemies
const BOSS_MELEE_DAMAGE = 60;
const BOSS_FIRE_DAMAGE = 45;
const BOSS_THUNDER_DAMAGE = 180;
const BOSS_KILL_SCORE = 500;
const BOSS_KILL_SCORE_STEP = 250;
let boss = null;
let isBossStage = false;
let bossOneOnOne = false;
let bossGraceTimer = 0;

const getBossTier = (s) => Math.floor(s / BOSS_STAGE_INTERVAL);

const applyDifficultyScaling = () => {
  const difficultyFactor = (stage - 1) * STAGE_DIFFICULTY_STEP + elapsedTime * DIFFICULTY_GROWTH_RATE;
  const enemyFactor = difficultyFactor * ENEMY_DIFFICULTY_MULTIPLIER;
  const playerFactor = difficultyFactor * PLAYER_DIFFICULTY_MULTIPLIER;

  enemySpawnDelay = Math.max(MIN_ENEMY_SPAWN_DELAY, BASE_ENEMY_SPAWN_DELAY - enemyFactor);
  const enemySpeed = BASE_ENEMY_SPEED * (1 + enemyFactor);
  enemies.forEach(enemy => {
    enemy.userData.speed = enemySpeed;
  });

  player.userData.moveSpeed = BASE_PLAYER_MOVE_SPEED * (1 + playerFactor);
  player.userData.attackCooldown = Math.max(0.2, BASE_PLAYER_ATTACK_COOLDOWN - playerFactor);
  player.userData.attackRadius = Math.min(
    MAX_PLAYER_ATTACK_RADIUS,
    BASE_PLAYER_ATTACK_RADIUS * (1 + playerFactor)
  );
  player.userData.updateAttackRadiusVisual();
};

const spawnEnemy = () => {
    const corner = SPAWN_CORNERS[Math.floor(Math.random() * SPAWN_CORNERS.length)];
    const enemy = createEnemy(player);
    enemy.position.set(corner.x, corner.y, 0);
    scene.add(enemy);
    enemies.push(enemy);
};

const spawnInitialEnemies = () => {
    SPAWN_CORNERS.forEach(corner => {
        const enemy = createEnemy(player);
        enemy.position.set(corner.x, corner.y, 0);
        scene.add(enemy);
        enemies.push(enemy);
    });
};

const clearEnemies = () => {
    enemies.forEach(enemy => scene.remove(enemy));
    enemies.length = 0;
};

// Spawn an initial enemy at each corner
spawnInitialEnemies();

const camera = createCamera();
player.add(camera);

const renderer = createRenderer();

const clock = new THREE.Clock();
let score = 0;
const SCORE_PER_SECOND = 0.1;
const SCORE_PER_KILL = 10;
const STAGE_COMPLETE_BASE_SCORE = 100; // score awarded for completing stage 1
const STAGE_COMPLETE_SCORE_STEP = 50; // extra score added per subsequent stage completed
const scoreElement = document.querySelector('.score');
const timerElement = document.querySelector('.timer');
const lifeBarContainer = document.querySelector('.life-bar-container');
const lifeBarFill = document.querySelector('.life-bar-fill');
const gameOverElement = document.querySelector('.game-over');
const finalScoreElement = document.querySelector('.final-score');
const replayButton = document.querySelector('.replay-button');
const stageCompleteElement = document.querySelector('.stage-complete');
const stageTitleElement = document.querySelector('.stage-title');
const stageFinalScoreElement = document.querySelector('.stage-final-score');
const stageReplayButton = document.querySelector('.stage-replay-button');
const fireCountElement = document.querySelector('.fire-count');
const thunderCountElement = document.querySelector('.thunder-count');
const shieldCountElement = document.querySelector('.shield-count');
const freezeCountElement = document.querySelector('.freeze-count');
const lifeCountElement = document.querySelector('.life-count');
const pauseOverlayElement = document.querySelector('.pause-overlay');
const pauseButton = document.querySelector('.pause-button');
const resumeButton = document.querySelector('.resume-button');
const controlsPanelElement = document.querySelector('.controls-panel');
const controlsToggleButton = document.querySelector('.controls-toggle-button');
const controlsCloseButton = document.querySelector('.controls-close-button');
const bossHealthBarContainer = document.querySelector('.boss-health-bar-container');
const bossHealthBarFill = document.querySelector('.boss-health-bar-fill');
const bossWarningElement = document.querySelector('.boss-warning');
const highScoreEntriesElement = document.querySelector('.high-score-entries');
const highScoreModalElement = document.querySelector('.high-score-modal');
const highScoreModalScoreElement = document.querySelector('.high-score-modal-score');
const highScoreNameInput = document.querySelector('.high-score-name-input');
const highScoreSubmitButton = document.querySelector('.high-score-submit-button');

const ENEMY_TOUCH_DISTANCE = 25;
const LOW_HEALTH_THRESHOLD = 0.3;
const LOW_TIME_THRESHOLD = 30; // seconds remaining at which the timer turns red

// Stage completion rewards: grant one fire and one thunderbolt per stage passed,
// doubled when the stage completed is stage 5 or a multiple of 5.
const STAGE_REWARD_BASE = 1;
const STAGE_REWARD_MULTIPLE_OF_5 = 2;
const FIREBALL_HIT_RADIUS = 20;

const fireballs = [];
const thunderbolts = [];

const spawnBoss = () => {
  boss = createBoss(player);
  const tier = getBossTier(stage);
  const maxHealth = BOSS_BASE_HEALTH + (tier - 1) * BOSS_HEALTH_PER_TIER;
  boss.userData.maxHealth = maxHealth;
  boss.userData.health = maxHealth;
  boss.userData.speed += (tier - 1) * BOSS_SPEED_PER_TIER;
  boss.position.set(0, 250, 0);
  scene.add(boss);
  bossHealthBarContainer.style.display = 'block';
  updateBossHealthBar();
};

const clearBoss = () => {
  if (boss) {
    scene.remove(boss);
    boss = null;
  }
  bossHealthBarContainer.style.display = 'none';
};

const updateBossHealthBar = () => {
  if (!boss) return;
  const ratio = boss.userData.health / boss.userData.maxHealth;
  bossHealthBarFill.style.width = `${Math.max(0, ratio) * 100}%`;

  const screenPosition = boss.position.clone();
  screenPosition.z += 90;
  screenPosition.project(camera);
  const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
  const y = (1 - (screenPosition.y * 0.5 + 0.5)) * window.innerHeight;
  bossHealthBarContainer.style.left = `${x}px`;
  bossHealthBarContainer.style.top = `${y}px`;
};

const showBossWarning = () => {
  bossWarningElement.style.display = 'block';
  setTimeout(() => {
    bossWarningElement.style.display = 'none';
  }, 2500);
};

// Sets up (or clears) the supervillain for the current stage. Called whenever
// a new stage begins.
const setupBossForStage = () => {
  isBossStage = (stage % BOSS_STAGE_INTERVAL === 0);
  bossOneOnOne = false;
  bossGraceTimer = 0;
  clearBoss();
  if (isBossStage) {
    showBossWarning();
    spawnBoss();
  }
};

const defeatBoss = () => {
  if (!boss) return;
  const tier = getBossTier(stage);
  const bossScore = BOSS_KILL_SCORE + (tier - 1) * BOSS_KILL_SCORE_STEP;
  showScorePopup(boss.position, bossScore);
  score += bossScore;
  scoreElement.textContent = `Score: ${Math.floor(score)}`;
  clearBoss();
  triggerStageComplete();
};

// Random stage rewards: from stage 3 onward, completing a stage has a
// chance to grant a bonus gift on top of the usual fire/thunderbolt rewards.
const RANDOM_REWARD_MIN_STAGE = 3;
const RANDOM_REWARD_CHANCE = 0.5;
const FREEZE_DURATION = 30; // seconds enemy movement is paused when used
let isEnemiesFrozen = false;
let freezeTimer = 0;

const updateInventoryDisplay = () => {
  fireCountElement.textContent = `\ud83d\udd25 x${player.userData.fireCount}`;
  thunderCountElement.textContent = `\u26a1 x${player.userData.thunderboltCount}`;
  shieldCountElement.textContent = `\ud83d\udee1\ufe0f x${player.userData.shieldCount}`;
  freezeCountElement.textContent = `\u2744\ufe0f x${player.userData.freezeCount}`;
  lifeCountElement.textContent = `\u2764\ufe0f x${player.userData.extraLives}`;
};

const showRewardToast = (text) => {
  const toast = document.createElement('div');
  toast.className = 'reward-toast';
  toast.textContent = text;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
  }, 2000);

  setTimeout(() => {
    toast.remove();
  }, 2600);
};

// Rolls for a random bonus gift when a stage is completed. Health is only
// eligible while the player isn't already at full health. Freeze (pausing
// enemy movement for up to 30 seconds) is intentionally rare since it is a
// very powerful, special gift.
const maybeGrantRandomReward = (completedStage) => {
  if (completedStage < RANDOM_REWARD_MIN_STAGE) return;
  if (Math.random() > RANDOM_REWARD_CHANCE) return;

  const pool = [
    { type: 'health', weight: 50 },
    { type: 'shield', weight: 35 },
    { type: 'freeze', weight: 15 }
  ];
  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return;

  let roll = Math.random() * totalWeight;
  let chosen = null;
  for (const entry of pool) {
    if (entry.weight <= 0) continue;
    if (roll < entry.weight) {
      chosen = entry.type;
      break;
    }
    roll -= entry.weight;
  }
  if (!chosen) return;

  if (chosen === 'health') {
    // The health gift grants an extra life instead of an instant heal: it's
    // the only way to keep playing on the current stage after dying,
    // instead of being sent all the way back to stage 1.
    player.userData.extraLives += 1;
    showRewardToast('\u2764\ufe0f +1 Extra Life!');
  } else if (chosen === 'shield') {
    player.userData.shieldCount += 1;
    showRewardToast('\ud83d\udee1\ufe0f Shield Gift! (tap H to use)');
  } else if (chosen === 'freeze') {
    player.userData.freezeCount += 1;
    showRewardToast('\u2744\ufe0f Time Freeze Gift! (Ctrl+Shift+F to use)');
  }
  updateInventoryDisplay();
};

const clearFireballs = () => {
  fireballs.forEach(fireball => scene.remove(fireball));
  fireballs.length = 0;
};

const clearThunderbolts = () => {
  thunderbolts.forEach(bolt => scene.remove(bolt));
  thunderbolts.length = 0;
};

const grantStageRewards = (completedStage) => {
  const amount = (completedStage % 5 === 0) ? STAGE_REWARD_MULTIPLE_OF_5 : STAGE_REWARD_BASE;
  player.userData.fireCount += amount;
  player.userData.thunderboltCount += amount;
  updateInventoryDisplay();
};

const updateTimerDisplay = () => {
  if (isBossStage) {
    timerElement.textContent = bossOneOnOne
      ? '⚔️ Boss Fight!'
      : `Boss in ${Math.max(0, Math.ceil(BOSS_SPAWN_GRACE_PERIOD - bossGraceTimer))}s`;
    timerElement.classList.remove('low');
    return;
  }
  const remaining = Math.max(0, Math.ceil(STAGE_DURATION - elapsedTime));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  timerElement.textContent = `Time: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  timerElement.classList.toggle('low', remaining <= LOW_TIME_THRESHOLD);
};
let isGameOver = false;
let isStageComplete = false;
let isPaused = false;

const updateLifeBar = () => {
  const ratio = player.userData.health / player.userData.maxHealth;
  lifeBarFill.style.width = `${Math.max(0, ratio) * 100}%`;
  lifeBarFill.classList.toggle('low', ratio <= LOW_HEALTH_THRESHOLD);

  const screenPosition = player.position.clone();
  screenPosition.z += 70;
  screenPosition.project(camera);
  const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
  const y = (1 - (screenPosition.y * 0.5 + 0.5)) * window.innerHeight;
  lifeBarContainer.style.left = `${x}px`;
  lifeBarContainer.style.top = `${y}px`;
};

// Renders the given list of { name, score } entries into the top-10 list
// shown on the game-over screen.
const renderHighScores = (entries) => {
  highScoreEntriesElement.innerHTML = '';
  entries.forEach((entry) => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'hs-name';
    nameSpan.textContent = entry.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'hs-score';
    scoreSpan.textContent = Math.floor(entry.score);
    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    highScoreEntriesElement.appendChild(li);
  });
};

const refreshHighScoreList = async () => {
  const entries = await fetchTopScores();
  renderHighScores(entries);
};

// Opens the name-entry modal so the player can save their qualifying score,
// then refreshes and shows the top 10 list on the game-over screen.
const promptForHighScoreName = (finalScore) => {
  highScoreModalScoreElement.textContent = `Score: ${Math.floor(finalScore)}`;
  highScoreNameInput.value = '';
  highScoreModalElement.style.display = 'flex';
  highScoreNameInput.focus();

  const submit = async () => {
    const name = highScoreNameInput.value.trim() || 'Anonymous';
    highScoreModalElement.style.display = 'none';
    const leaderboard = await submitScore(name, finalScore, stage);
    renderHighScores(leaderboard.length ? leaderboard : await fetchTopScores());
    highScoreSubmitButton.removeEventListener('click', submit);
    highScoreNameInput.removeEventListener('keydown', onKeyDown);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter') submit();
  };

  highScoreSubmitButton.addEventListener('click', submit);
  highScoreNameInput.addEventListener('keydown', onKeyDown);
};

const triggerGameOver = () => {
  isGameOver = true;
  lifeBarContainer.style.display = 'none';
  finalScoreElement.textContent = `Score: ${Math.floor(score)}`;
  gameOverElement.style.display = 'flex';

  const finalScore = score;
  checkQualifiesForTopScores(finalScore).then((qualifies) => {
    if (qualifies) {
      promptForHighScoreName(finalScore);
    } else {
      refreshHighScoreList();
    }
  });
};

const triggerStageComplete = () => {
  isStageComplete = true;
  lifeBarContainer.style.display = 'none';
  const stageBonus = STAGE_COMPLETE_BASE_SCORE + (stage - 1) * STAGE_COMPLETE_SCORE_STEP;
  score += stageBonus;
  scoreElement.textContent = `Score: ${Math.floor(score)}`;
  grantStageRewards(stage);
  maybeGrantRandomReward(stage);
  stageTitleElement.textContent = `Stage ${stage} Complete!`;
  stageFinalScoreElement.textContent = `Score: ${Math.floor(score)}`;
  stageCompleteElement.style.display = 'flex';
};

const advanceStage = () => {
  stage += 1;
  elapsedTime = 0;
  spawnTimer = 0;
  clearEnemies();
  spawnInitialEnemies();
  clearHouses(map);
  loadHouses(map);
  clearFireballs();
  clearThunderbolts();
  isEnemiesFrozen = false;
  freezeTimer = 0;
  setupBossForStage();
  player.userData.health = player.userData.maxHealth;
  player.userData.isDead = false;
  lifeBarContainer.style.display = 'block';
  stageCompleteElement.style.display = 'none';
  isStageComplete = false;
  updateTimerDisplay();
  clock.getDelta();
};

const resetGame = () => {
  player.userData.reset();
  clearEnemies();
  spawnInitialEnemies();
  clearHouses(map);
  loadHouses(map);
  clearFireballs();
  clearThunderbolts();
  isEnemiesFrozen = false;
  freezeTimer = 0;
  spawnTimer = 0;
  enemySpawnDelay = BASE_ENEMY_SPAWN_DELAY;
  score = 0;
  elapsedTime = 0;
  stage = 1;
  setupBossForStage();
  scoreElement.textContent = `Score: ${Math.floor(score)}`;
  lifeBarContainer.style.display = 'block';
  gameOverElement.style.display = 'none';
  highScoreModalElement.style.display = 'none';
  stageCompleteElement.style.display = 'none';
  isGameOver = false;
  isStageComplete = false;
  isPaused = false;
  pauseOverlayElement.style.display = 'none';
  controlsPanelElement.style.display = 'none';
  updateTimerDisplay();
  updateInventoryDisplay();
  clock.getDelta();
};

replayButton.addEventListener('click', resetGame);
stageReplayButton.addEventListener('click', advanceStage);

updateInventoryDisplay();

const togglePause = () => {
  if (isGameOver || isStageComplete) return;
  isPaused = !isPaused;
  pauseOverlayElement.style.display = isPaused ? 'flex' : 'none';
  if (!isPaused) {
    // Avoid a large delta jump accumulating while the game was paused.
    clock.getDelta();
  }
};

pauseButton.addEventListener('click', togglePause);
resumeButton.addEventListener('click', togglePause);

let wasPausedBeforeControls = false;

const toggleControlsPanel = () => {
  const isOpening = controlsPanelElement.style.display === 'none';
  if (isOpening) {
    wasPausedBeforeControls = isPaused;
    if (!isPaused && !isGameOver && !isStageComplete) {
      isPaused = true;
    }
    controlsPanelElement.style.display = 'flex';
  } else {
    controlsPanelElement.style.display = 'none';
    if (isPaused && !wasPausedBeforeControls) {
      isPaused = false;
      clock.getDelta();
    }
  }
};

controlsToggleButton.addEventListener('click', toggleControlsPanel);
controlsCloseButton.addEventListener('click', toggleControlsPanel);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (controlsPanelElement.style.display !== 'none') return;
    if (isGameOver) {
      resetGame();
    } else if (isStageComplete) {
      advanceStage();
    }
  } else if (e.code === 'KeyP') {
    if (controlsPanelElement.style.display !== 'none') return;
    togglePause();
  } else if (e.code === 'Slash' || e.key === '?') {
    toggleControlsPanel();
  }
});

const showScorePopup = (worldPosition, points) => {
  const popup = document.createElement('div');
  popup.className = 'score-popup';
  popup.textContent = `+${points}`;

  const screenPosition = worldPosition.clone().project(camera);
  const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
  const y = (1 - (screenPosition.y * 0.5 + 0.5)) * window.innerHeight;
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;

  document.body.appendChild(popup);

  requestAnimationFrame(() => {
    popup.style.opacity = '0';
    popup.style.transform = 'translate(-50%, -100%)';
  });

  setTimeout(() => {
    popup.remove();
  }, 1000);
};

// Animation
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (isGameOver || isStageComplete) {
    renderer.render(scene, camera);
    return;
  }

  if (isPaused) {
    renderer.render(scene, camera);
    return;
  }

  score += delta * SCORE_PER_SECOND;
  scoreElement.textContent = `Score: ${Math.floor(score)}`;

  elapsedTime += delta;
  if (!isBossStage && elapsedTime >= STAGE_DURATION) {
    elapsedTime = STAGE_DURATION;
    updateTimerDisplay();
    triggerStageComplete();
    renderer.render(scene, camera);
    return;
  }

  // Boss stages: enemies keep spawning for a grace period after the boss
  // appears, then it becomes a strict one-on-one fight against the boss.
  if (isBossStage && !bossOneOnOne) {
    bossGraceTimer += delta;
    if (bossGraceTimer >= BOSS_SPAWN_GRACE_PERIOD) {
      bossOneOnOne = true;
      clearEnemies();
    }
  }
  updateTimerDisplay();

  const canSpawnRegularEnemies = !isBossStage || !bossOneOnOne;
  if (canSpawnRegularEnemies) {
    spawnTimer += delta;
    if (spawnTimer >= enemySpawnDelay) {
      spawnTimer = 0;
      spawnEnemy();
    }
  }

  applyDifficultyScaling();

  if (isEnemiesFrozen) {
    freezeTimer += delta;
    if (freezeTimer >= FREEZE_DURATION) {
      isEnemiesFrozen = false;
      freezeTimer = 0;
    }
  }

  if (player.userData.freezeTriggered) {
    player.userData.freezeTriggered = false;
    isEnemiesFrozen = true;
    freezeTimer = 0;
    updateInventoryDisplay();
    showRewardToast('\u2744\ufe0f Enemies Frozen!');
  }

  player.update(map.children, enemies, delta);
  if (!isEnemiesFrozen) {
    enemies.forEach(enemy => enemy.update(map.children, enemies));
  }
  if (boss) {
    boss.update(map.children);
    updateBossHealthBar();
  }

  if (player.userData.attackTriggered) {
    player.userData.attackTriggered = false;
    const attackRadius = player.userData.attackRadius;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (player.position.distanceTo(enemy.position) <= attackRadius) {
        showScorePopup(enemy.position, SCORE_PER_KILL);
        scene.remove(enemy);
        enemies.splice(i, 1);
        score += SCORE_PER_KILL;
        scoreElement.textContent = `Score: ${Math.floor(score)}`;
      }
    }
    if (boss && player.position.distanceTo(boss.position) <= attackRadius) {
      showScorePopup(boss.position, BOSS_MELEE_DAMAGE);
      const bossDied = boss.userData.takeHit(BOSS_MELEE_DAMAGE);
      if (bossDied) {
        defeatBoss();
      } else {
        updateBossHealthBar();
      }
    }
  }

  if (player.userData.fireTriggered) {
    player.userData.fireTriggered = false;
    updateInventoryDisplay();

    // Aim toward the nearest enemy (or the boss), falling back to the
    // direction the player is facing.
    let aimDirection = player.userData.facingDirection.clone();
    let nearestDistance = Infinity;
    enemies.forEach(enemy => {
      const distance = player.position.distanceTo(enemy.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        aimDirection = new THREE.Vector3().subVectors(enemy.position, player.position);
      }
    });
    if (boss) {
      const bossDistance = player.position.distanceTo(boss.position);
      if (bossDistance < nearestDistance) {
        nearestDistance = bossDistance;
        aimDirection = new THREE.Vector3().subVectors(boss.position, player.position);
      }
    }

    const fireball = createFireball(player.position, aimDirection);
    scene.add(fireball);
    fireballs.push(fireball);
  }

  if (player.userData.thunderboltTriggered) {
    player.userData.thunderboltTriggered = false;
    updateInventoryDisplay();

    // Strike every enemy currently on screen with a bolt coming down from
    // the sky. Each enemy is only removed once its own bolt visually hits.
    enemies.slice().forEach(enemy => {
      const bolt = createThunderbolt(enemy.position, () => {
        const index = enemies.indexOf(enemy);
        if (index === -1) return;
        showScorePopup(enemy.position, SCORE_PER_KILL);
        scene.remove(enemy);
        enemies.splice(index, 1);
        score += SCORE_PER_KILL;
        scoreElement.textContent = `Score: ${Math.floor(score)}`;
      });
      scene.add(bolt);
      thunderbolts.push(bolt);
    });

    // The thunderbolt is powerful enough to also strike the supervillain,
    // though it only chips away at its health rather than destroying it instantly.
    if (boss) {
      const bolt = createThunderbolt(boss.position, () => {
        if (!boss) return;
        showScorePopup(boss.position, BOSS_THUNDER_DAMAGE);
        const bossDied = boss.userData.takeHit(BOSS_THUNDER_DAMAGE);
        if (bossDied) {
          defeatBoss();
        } else {
          updateBossHealthBar();
        }
      });
      scene.add(bolt);
      thunderbolts.push(bolt);
    }
  }

  for (let i = thunderbolts.length - 1; i >= 0; i--) {
    const bolt = thunderbolts[i];
    bolt.update(delta);
    if (bolt.userData.isFinished) {
      scene.remove(bolt);
      thunderbolts.splice(i, 1);
    }
  }

  for (let i = fireballs.length - 1; i >= 0; i--) {
    const fireball = fireballs[i];
    fireball.update(delta);

    // The flame has a large surface area along its whole length, so check
    // collision against the closest point on its full body (not just its
    // center), making it much more forgiving to aim.
    let hit = false;
    const hitRadius = fireball.userData.hitRadius || FIREBALL_HIT_RADIUS;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      const closestPoint = fireball.getClosestPointOnSegment(enemy.position);
      if (closestPoint.distanceTo(enemy.position) <= hitRadius) {
        showScorePopup(enemy.position, SCORE_PER_KILL);
        scene.remove(enemy);
        enemies.splice(j, 1);
        score += SCORE_PER_KILL;
        scoreElement.textContent = `Score: ${Math.floor(score)}`;
        hit = true;
        break;
      }
    }

    if (!hit && boss) {
      const closestPoint = fireball.getClosestPointOnSegment(boss.position);
      if (closestPoint.distanceTo(boss.position) <= hitRadius) {
        showScorePopup(boss.position, BOSS_FIRE_DAMAGE);
        const bossDied = boss.userData.takeHit(BOSS_FIRE_DAMAGE);
        if (bossDied) {
          defeatBoss();
        } else {
          updateBossHealthBar();
        }
        hit = true;
      }
    }

    const outOfBounds = Math.abs(fireball.position.x) > 300 || Math.abs(fireball.position.y) > 300;
    if (hit || outOfBounds) {
      scene.remove(fireball);
      fireballs.splice(i, 1);
    }
  }

  const now = performance.now() / 1000;
  const touchingEnemy = enemies.some(enemy => player.position.distanceTo(enemy.position) < ENEMY_TOUCH_DISTANCE);
  if (touchingEnemy) {
    player.userData.takeDamage(now);
  }
  if (boss && player.position.distanceTo(boss.position) < BOSS_TOUCH_DISTANCE) {
    player.userData.takeDamage(now, BOSS_TOUCH_DAMAGE);
  }

  if (player.userData.isDead) {
    // Spend an extra life (from the "health" gift) if available, so the
    // player keeps playing on the current stage instead of a full game over.
    if (player.userData.reviveWithExtraLife()) {
      updateInventoryDisplay();
      showRewardToast('\u2764\ufe0f Extra Life Used!');
      updateLifeBar();
    } else {
      triggerGameOver();
    }
  } else {
    updateLifeBar();
  }

  renderer.render(scene, camera);
}
animate();

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
