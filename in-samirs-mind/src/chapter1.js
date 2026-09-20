import * as THREE from 'three';

// Chapter I — Memory Atrium (laundromat). Vertical-slice proxy geometry:
// boxes/planes carrying real wallpaper/poster textures, not final art.
// Collision is a flat set of AABB walls, independent of visual mesh count.

const ROOM = { w: 20, d: 16, h: 4.2 };
const WALK_SPEED = 3.2;
const EYE_HEIGHT = 1.6;

const JOURNAL_TEXTS = [
  "This place feels so familiar, even though you've never been here.",
  "It feels just like home. The street does. The windows do. Even the silence does.",
  'But is this house yours?'
];

export class Chapter1 {
  constructor({ canvas, dreamer, save, audio, onJournal, onTrackFound, onTV, onSave, onPromptChange }) {
    this.dreamer = dreamer;
    this.save = save;
    this.audio = audio;
    this.onJournal = onJournal;
    this.onTrackFound = onTrackFound;
    this.onTV = onTV;
    this.onSave = onSave;
    this.onPromptChange = onPromptChange;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.resize();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1c1522);
    this.scene.fog = new THREE.Fog(0x1c1522, 10, 30);

    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 100);
    this.camera.position.set(save.position.x, EYE_HEIGHT, save.position.z);
    this.yaw = save.yaw || 0;
    this.pitch = 0;

    this.clock = new THREE.Clock();
    this.keys = new Set();
    this.walls = [];
    this.interactables = [];
    this.textureLoader = new THREE.TextureLoader();

    this._buildLighting();
    this._buildRoom();
    this._buildCollectibles();
    this._buildDoubt();
    this._buildDoor();

    this._bindInput();
    this.running = true;
    this._raf = requestAnimationFrame((t) => this._tick(t));
  }

  _tex(path, repeat = [1, 1]) {
    const t = this.textureLoader.load(path);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    return t;
  }

  _buildLighting() {
    const hemi = new THREE.HemisphereLight(0xfff3e0, 0x2a2035, 0.9);
    this.scene.add(hemi);
    const fl = new THREE.PointLight(0xfff0d8, 1.1, 14, 2);
    fl.position.set(0, ROOM.h - 0.3, 0);
    this.scene.add(fl);
  }

  _buildRoom() {
    const floorTex = this._tex('assets/textures/retro_laundromat_texture_atlas.webp', [4, 4]);
    const wallTex = this._tex('assets/textures/pastel_laundromat_wall_texture_sheet.webp', [3, 1]);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM.w, ROOM.d),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM.w, ROOM.d),
      new THREE.MeshStandardMaterial({ color: 0xece0f5, roughness: 1 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ROOM.h;
    this.scene.add(ceiling);

    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 });
    const wallDefs = [
      { w: ROOM.w, pos: [0, ROOM.h / 2, -ROOM.d / 2], rot: [0, 0, 0] },
      { w: ROOM.w, pos: [0, ROOM.h / 2, ROOM.d / 2], rot: [0, Math.PI, 0] },
      { w: ROOM.d, pos: [-ROOM.w / 2, ROOM.h / 2, 0], rot: [0, Math.PI / 2, 0] },
      { w: ROOM.d, pos: [ROOM.w / 2, ROOM.h / 2, 0], rot: [0, -Math.PI / 2, 0] }
    ];
    for (const def of wallDefs) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(def.w, ROOM.h), wallMat);
      mesh.position.set(...def.pos);
      mesh.rotation.set(...def.rot);
      this.scene.add(mesh);
    }
    // Simple AABB collision box slightly inset from visual walls.
    const m = 0.4;
    this.bounds = { minX: -ROOM.w / 2 + m, maxX: ROOM.w / 2 - m, minZ: -ROOM.d / 2 + m, maxZ: ROOM.d / 2 - m };

    this._addWashers();
    this._addPosters();
    this._addTVs();
  }

  _addWashers() {
    const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf3e6d8, metalness: 0.3, roughness: 0.4 });
    const rows = 4, cols = 2;
    const inst = new THREE.InstancedMesh(geo, mat, rows * cols);
    let i = 0;
    const m4 = new THREE.Matrix4();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = -6 + r * 1.3;
        const z = -ROOM.d / 2 + 1.2 + c * 1.3;
        m4.setPosition(x, 0.45, z);
        inst.setMatrixAt(i++, m4);
        this.walls.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
      }
    }
    this.scene.add(inst);
  }

  _addPosters() {
    const posterFiles = [
      'assets/posters/Cloudside_Shampoo_Brighter_Days.webp',
      'assets/posters/Please_Do_Not_Take_A_Nap.webp',
      'assets/posters/Nightmare_Vacuum_ad.webp',
      'assets/posters/Kellerman_Fibers_The_Hold.webp'
    ];
    const spots = [
      { pos: [4, 1.8, -ROOM.d / 2 + 0.02], rot: [0, 0, 0], size: [1.1, 1.5] },
      { pos: [-ROOM.w / 2 + 0.02, 1.7, 3], rot: [0, Math.PI / 2, 0], size: [1.3, 1.0] },
      { pos: [ROOM.w / 2 - 0.02, 1.9, -2], rot: [0, -Math.PI / 2, 0], size: [1.0, 1.4] },
      { pos: [-3, 1.6, ROOM.d / 2 - 0.02], rot: [0, Math.PI, 0], size: [1.4, 1.0] }
    ];
    spots.forEach((s, i) => {
      const tex = this._tex(posterFiles[i % posterFiles.length]);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(s.size[0], s.size[1]),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })
      );
      mesh.position.set(...s.pos);
      mesh.rotation.set(...s.rot);
      this.scene.add(mesh);
    });
  }

  _addTVs() {
    // Manual TV
    this._makeTV([-7, 1.1, 5], 'assets/video/Cloudside_Shampoo_commercial.mp4', 'manual');
    // Proximity-auto TV
    this._makeTV([7, 1.1, -6], 'assets/video/Please_Do_Not_Take_A_Nap_PSA_FINAL.mp4', 'proximity');
  }

  _makeTV(pos, videoSrc, mode) {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.7, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xd8cfe0, roughness: 0.6 })
    );
    body.position.set(pos[0], pos[1], pos[2]);
    this.scene.add(body);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.68, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x111018 })
    );
    screen.position.set(pos[0], pos[1], pos[2] + 0.31);
    this.scene.add(screen);

    this.interactables.push({
      type: 'tv',
      mode,
      videoSrc,
      played: this.save.tvSeen.includes(videoSrc),
      pos: new THREE.Vector3(pos[0], pos[1], pos[2]),
      radius: mode === 'proximity' ? 2.4 : 1.6,
      prompt: mode === 'manual' ? 'Press E to watch' : null
    });
  }

  _buildCollectibles() {
    // 3 journal fragments, 1 Memory Cat, 1 inventory item, 1 Dream Track — curated, reachable, never inside collision.
    const journalSpots = [
      [3, 1.1, 2],
      [-4, 1.1, -3],
      [0, 1.1, ROOM.d / 2 - 1.5]
    ];
    journalSpots.forEach((p, i) => {
      if (this.save.journals.includes(i)) return;
      this.interactables.push(this._pickupMesh(p, 0xfff2c9, 'journal', { index: i, prompt: 'Press E to read' }));
    });

    if (!this.save.memoryCats.includes('atrium_cat_1')) {
      this.interactables.push(this._pickupMesh([-6, 0.4, 6], 0xf5f5ff, 'memoryCat', { id: 'atrium_cat_1', prompt: 'Press E to remember' }));
    }

    if (!this.save.inventory.includes('lint_roller')) {
      this.interactables.push(this._pickupMesh([5, 0.5, -5], 0xffd7e6, 'item', { id: 'lint_roller', prompt: 'Press E to pick up Lint Roller' }));
    }

    if (!this.save.dreamTracks.includes('01_lint_roller_reverie')) {
      this.interactables.push(this._pickupMesh([-2, 1.0, -6], 0xc9b8ff, 'track', {
        id: '01_lint_roller_reverie',
        name: 'Lint Roller Reverie',
        src: 'assets/audio/dream_tracks/01_lint_roller_reverie.opus',
        prompt: 'Press E to pick up'
      }));
    }
  }

  _pickupMesh(pos, color, type, extra) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 })
    );
    mesh.position.set(...pos);
    this.scene.add(mesh);
    return { type, mesh, pos: mesh.position, radius: 1.3, ...extra };
  }

  _buildDoubt() {
    // Doubt: translucent spectral black cat silhouette, glimpsed rather than chasing.
    const geo = new THREE.SphereGeometry(0.35, 10, 10);
    geo.scale(1, 1.1, 1.6);
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 });
    this.doubt = new THREE.Mesh(geo, mat);
    this.doubt.position.set(8, 0.5, 6.5);
    this.doubt.visible = false;
    this.scene.add(this.doubt);
    this._doubtTimer = 6 + Math.random() * 6;
  }

  _buildDoor() {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 2.3, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xb8a2d6, emissive: 0x3a2a55, emissiveIntensity: 0.3 })
    );
    frame.position.set(0, 1.15, -ROOM.d / 2 + 0.06);
    this.scene.add(frame);
    this.moonDoor = { pos: new THREE.Vector3(0, 1.15, -ROOM.d / 2 + 0.06), radius: 1.6, mesh: frame };
  }

  _bindInput() {
    this._keydown = (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE') this._interact();
    };
    this._keyup = (e) => this.keys.delete(e.code);
    addEventListener('keydown', this._keydown);
    addEventListener('keyup', this._keyup);

    this._mousemove = (e) => {
      if (document.pointerLockElement !== this.renderer.domElement) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch));
    };
    addEventListener('mousemove', this._mousemove);

    this._click = () => {
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.renderer.domElement.requestPointerLock();
      }
    };
    this.renderer.domElement.addEventListener('click', this._click);

    this._resize = () => this.resize();
    addEventListener('resize', this._resize);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  _nearestInteractable() {
    let best = null, bestDist = Infinity;
    for (const it of this.interactables) {
      const p = it.pos instanceof THREE.Vector3 ? it.pos : it.pos;
      const d = this.camera.position.distanceTo(p);
      if (d < it.radius && d < bestDist) { best = it; bestDist = d; }
    }
    return best;
  }

  _interact() {
    const it = this._nearestInteractable();
    if (!it) return;
    if (it.type === 'journal') {
      this.save.journals.push(it.index);
      this.onJournal(JOURNAL_TEXTS[it.index]);
      this._removeInteractable(it);
    } else if (it.type === 'memoryCat') {
      this.save.memoryCats.push(it.id);
      this.onJournal('A memory cat, curled where the light pools. You remember it now.');
      this._removeInteractable(it);
    } else if (it.type === 'item') {
      this.save.inventory.push(it.id);
      this._removeInteractable(it);
    } else if (it.type === 'track') {
      this.onTrackFound(it);
    } else if (it.type === 'tv') {
      this._playTV(it);
    }
  }

  _removeInteractable(it) {
    if (it.mesh) this.scene.remove(it.mesh);
    this.interactables = this.interactables.filter((x) => x !== it);
  }

  confirmTrackPicked(it) {
    this.save.dreamTracks.push(it.id);
    this._removeInteractable(it);
  }

  _playTV(it) {
    if (it._playing) return;
    it._playing = true;
    this.audio.duckForBroadcast();
    this.save.tvSeen = Array.from(new Set([...this.save.tvSeen, it.videoSrc]));
    this.onTV(it.videoSrc, () => {
      it._playing = false;
      this.audio.resumeAfterBroadcast();
    });
  }

  update() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    let move = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(forward);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(right);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(WALK_SPEED * dt);
      const next = this.camera.position.clone().add(move);
      next.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, next.x));
      next.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, next.z));
      if (!this._collidesWashers(next)) {
        this.camera.position.x = next.x;
        this.camera.position.z = next.z;
      }
    }

    // Doubt: rare glimpses, never sustained chase.
    this._doubtTimer -= dt;
    if (this._doubtTimer <= 0) {
      this.doubt.visible = !this.doubt.visible;
      this._doubtTimer = this.doubt.visible ? 1.5 + Math.random() * 1.5 : 8 + Math.random() * 10;
    }

    // Proximity TVs auto-play once.
    for (const it of this.interactables) {
      if (it.type === 'tv' && it.mode === 'proximity' && !it.played) {
        if (this.camera.position.distanceTo(it.pos) < it.radius) {
          it.played = true;
          this._playTV(it);
        }
      }
    }

    const near = this._nearestInteractable();
    this.onPromptChange(near && near.prompt ? near.prompt : null);

    // Moon Door: only active once all 3 journals + memory cat + item found.
    const doorReady = this.save.journals.length >= 3 && this.save.memoryCats.length >= 1;
    this.moonDoor.mesh.material.emissiveIntensity = doorReady ? 0.9 + Math.sin(performance.now() * 0.004) * 0.3 : 0.15;
    if (doorReady && this.camera.position.distanceTo(this.moonDoor.pos) < this.moonDoor.radius) {
      this.onPromptChange('The Moon Door is awake. Press E to step through.');
      if (this.keys.has('KeyE')) this._triggerDoorTransition();
    }

    this.save.position = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
    this.save.yaw = this.yaw;
  }

  _collidesWashers(pos) {
    for (const b of this.walls) {
      if (pos.x > b.minX - 0.35 && pos.x < b.maxX + 0.35 && pos.z > b.minZ - 0.35 && pos.z < b.maxZ + 0.35) return true;
    }
    return false;
  }

  _triggerDoorTransition() {
    if (this._transitioning) return;
    this._transitioning = true;
    this.onJournal('The Moon Door opens onto a hallway that was not there before.');
    this.onSave();
  }

  _tick() {
    if (!this.running) return;
    this.update();
    this.renderer.render(this.scene, this.camera);
    this._raf = requestAnimationFrame((t) => this._tick(t));
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    removeEventListener('keydown', this._keydown);
    removeEventListener('keyup', this._keyup);
    removeEventListener('mousemove', this._mousemove);
    removeEventListener('resize', this._resize);
  }
}
