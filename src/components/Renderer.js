import * as THREE from 'three';

export const createRenderer = () => {
    const canvas = document.querySelector('canvas.game');
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    return renderer;
};
