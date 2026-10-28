import type * as THREE from 'three';

interface LinkedView {
    camera: THREE.Camera;
    /** Move this view's camera to the given position and redraw. */
    apply: (position: THREE.Vector3) => void;
}

/**
 * Shares one camera orientation between several Wulff3D views. Whichever view the user last
 * dragged drives the others. Kept free of runtime three.js imports so it can be created
 * outside the lazily loaded viewer.
 */
export interface CameraLink {
    views: Map<object, LinkedView>;
    driver: object | null;
}

export const createCameraLink = (): CameraLink => ({ views: new Map(), driver: null });
