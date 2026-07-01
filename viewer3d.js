/* ==========================================================================
   PLAYBIE PREMIUM REDESIGN - 3D INTERACTIVE VIEWER (WebGL / Three.js)
   Renders Bumper Bed and Playmat procedurally with soft studio lighting,
   orbit interaction, auto-rotation, and dynamic real-time color customizer.
   ========================================================================== */

(function () {
  // --- 3D VIEWER SYSTEM CLASS ---
  class Playbie3DViewer {
    constructor() {
      this.canvas = document.getElementById('customizerCanvas');
      this.container = this.canvas.parentElement;
      this.loadingEl = document.getElementById('canvasLoading');
      
      // Default configurations
      this.activeProductType = 'bumper'; // 'bumper' or 'playmat'
      this.theme = 'pastel';
      this.activeSeries = 'color-series';
      this.activeMotif = null;
      this.activeMotifWall = 'all';
      
      this.colors = {
        // Bumper Bed Parts
        alasBawah: '#FFE4E6',
        sampingLuar: '#FFF8E7',
        sampingDalam: '#FFEDD5',
        
        // Individual wall side colors
        leftWallOuter: '#FFF8E7',
        leftWallInner: '#FFEDD5',
        rightWallOuter: '#FFF8E7',
        rightWallInner: '#FFEDD5',
        frontWallOuter: '#FFF8E7',
        frontWallInner: '#FFEDD5',
        backWallOuter: '#FFF8E7',
        backWallInner: '#FFEDD5',

        // Backwards compatibility fallbacks
        leftWall: '#FFF8E7',
        rightWall: '#FFEDD5',
        frontWall: '#E0F2FE',
        backWall: '#FFF8E7',
        floorMat1: '#FFE4E6',
        floorMat2: '#FAF9F6',
        floorMat3: '#FFE4E6',
        
        // Playmat Parts
        panel1: '#FFF8E7',
        panel2: '#FFE4E6',
        panel3: '#E0F2FE',
        panel4: '#FFEDD5'
      };

      // Three.js Core Objects
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;
      
      // Scene Mesh Objects References
      this.productGroup = new THREE.Group();
      this.meshes = {};
      this.shadowPlane = null;
      
      // Stickers state
      this.stickers = {};
      this.stickerMeshes = {};
      
      // UI State
      this.autoRotate = true;
      
      // Initialize Three.js
      this.init();
    }

    init() {
      // 1. Scene setup
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(this.getCanvasBgColor());
      
      // Fog for depth
      this.scene.fog = new THREE.FogExp2(this.getCanvasBgColor(), 0.08);

      // 2. Camera Setup
      this.camera = new THREE.PerspectiveCamera(
        45,
        this.container.clientWidth / this.container.clientHeight,
        0.1,
        100
      );
      this.resetCameraPosition();

      // 3. Renderer Setup
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;

      // 4. Orbit Controls
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2.1; // Don't go below floor
      this.controls.minDistance = 3.5;
      this.controls.maxDistance = 10;
      this.controls.autoRotate = this.autoRotate;
      this.controls.autoRotateSpeed = 1.0;
      this.controls.target.set(0, 0, 0);

      // 5. Lighting Studio
      this.setupLights();

      // Add Product group to scene
      this.scene.add(this.productGroup);

      // 6. Build default product (Bumper Bed)
      this.buildBumperBed();

      // 7. Add Room Floor/Shadow Receiver
      this.buildFloor();

      // Hide Loader
      if (this.loadingEl) {
        this.loadingEl.classList.add('hidden');
      }

      // 8. Event Listeners
      window.addEventListener('resize', this.onWindowResize.bind(this));
      this.setupUIControls();
      
      // 9. Start Animation Loop
      this.animate();
    }

    getCanvasBgColor() {
      // Return canvas background color based on theme
      return this.theme === 'pastel' ? 0xEAE6DF : 0xDCD6CD;
    }

    resetCameraPosition() {
      this.camera.position.set(4, 3, 5);
      if (this.controls) {
        this.controls.target.set(0, 0, 0);
      }
    }

    setupLights() {
      // Soft Ambient Light
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      this.scene.add(ambientLight);

      // Main Sun/Studio Light (Casts soft shadows)
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(5, 8, 4);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 25;
      dirLight.shadow.camera.left = -3;
      dirLight.shadow.camera.right = 3;
      dirLight.shadow.camera.top = 3;
      dirLight.shadow.camera.bottom = -3;
      dirLight.shadow.bias = -0.0005;
      this.scene.add(dirLight);

      // Soft Warm Fill Light
      const fillLight = new THREE.PointLight(0xffedd5, 0.4, 20);
      fillLight.position.set(-4, 3, -2);
      this.scene.add(fillLight);

      // Soft Cool Bounce Light
      const bounceLight = new THREE.DirectionalLight(0xe0f2fe, 0.3);
      bounceLight.position.set(-2, -2, 2);
      this.scene.add(bounceLight);
    }

    buildFloor() {
      // Soft reflective floor plane
      const floorGeo = new THREE.PlaneGeometry(30, 30);
      const floorMat = new THREE.MeshStandardMaterial({
        color: this.theme === 'pastel' ? 0xF5ECE2 : 0xE6DED3,
        roughness: 0.85,
        metalness: 0.05
      });
      
      this.shadowPlane = new THREE.Mesh(floorGeo, floorMat);
      this.shadowPlane.rotation.x = -Math.PI / 2;
      this.shadowPlane.position.y = -0.36; // Just below model
      this.shadowPlane.receiveShadow = true;
      this.scene.add(this.shadowPlane);

      // Subtle shadow ambient ring below bed
      const ringGeo = new THREE.RingGeometry(1.6, 2.0, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide
      });
      const shadowRing = new THREE.Mesh(ringGeo, ringMat);
      shadowRing.rotation.x = -Math.PI / 2;
      shadowRing.position.y = -0.35;
      this.scene.add(shadowRing);
    }

    // --- PROCEDURAL 3D MODELS ---

    // 1. Playbie Bumper Bed (Soft Padded Box + Outlines)
    buildBumperBed() {
      this.clearProductGroup();
      this.meshes = {};

      const wallThickness = 0.18;
      const wallHeight = 0.65;
      const innerWidth = this.activeWidth !== undefined ? this.activeWidth : 1.6;
      const innerHeight = this.activeHeight !== undefined ? this.activeHeight : 1.6;
      
      // Helper to add edges outlines (seams) for realistic depth
      const addMeshOutlines = (mesh, opacity = 0.15) => {
        const edges = new THREE.EdgesGeometry(mesh.geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: opacity
        }));
        mesh.add(line);
      };

      // Materials (Realistic Matte Leather look + WebGL CORS Bypass Texture Loader)
      const createWallMaterial = (colorHex, partName, isOuter) => {
        // All series use solid colors (Polos-style)
        const hasMotif = false;
        const baseColor = hasMotif ? '#ffffff' : colorHex;

        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(baseColor),
          roughness: 0.65,
          metalness: 0.05,
          flatShading: false
        });

        if (hasMotif) {
          const loader = new THREE.TextureLoader();
          // Load texture via local Express CORS bypass proxy
          loader.load(`/api/proxy-image?id=${this.activeMotif}`, (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            // Map textures beautifully depending on wall orientation
            const repeatX = (partName === 'leftWall' || partName === 'rightWall') ? 2.5 : 2.0;
            texture.repeat.set(repeatX, 1.0);
            
            mat.map = texture;
            mat.needsUpdate = true;
          });
        }

        return mat;
      };

      // Geometry factory with soft edges
      const createPaddedBox = (w, h, d, radius = 0.04) => {
        return new THREE.BoxGeometry(w, h, d, 2, 2, 2);
      };

      // FLOOR MATTRESS (3 folding sections — Castle Series flat style)
      const matWidth = innerWidth / 3;
      const floorGeo = createPaddedBox(matWidth - 0.005, 0.12, innerHeight);
      for (let i = 1; i <= 3; i++) {
        const partName = `floorMat${i}`;
        const floorColor = this.colors[partName] || this.colors.alasBawah || '#FFE4E6';
        const matMesh = new THREE.Mesh(floorGeo, createWallMaterial(floorColor, partName));
        const xPos = -innerWidth / 3 + (i - 1) * matWidth;
        matMesh.position.set(xPos, -0.25, 0);
        matMesh.castShadow = true;
        matMesh.receiveShadow = true;
        
        addMeshOutlines(matMesh, 0.12);
        this.productGroup.add(matMesh);
        this.meshes[partName] = matMesh;
      }

      // LEFT WALL (Single panel with 6 materials: Index 0=Inner(+X), Index 1=Outer(-X))
      const leftGeo = createPaddedBox(wallThickness, wallHeight, innerHeight);  // Corner depth 1.60
      this.meshes.leftWall = new THREE.Mesh(leftGeo, [
        createWallMaterial(this.colors.leftWallInner || this.colors.sampingDalam, 'leftWall', false), // +X (Inner)
        createWallMaterial(this.colors.leftWallOuter || this.colors.sampingLuar, 'leftWall', true),  // -X (Outer)
        createWallMaterial(this.colors.leftWallOuter || this.colors.sampingLuar, 'leftWall', true),  // +Y (Top)
        createWallMaterial(this.colors.leftWallOuter || this.colors.sampingLuar, 'leftWall', true),  // -Y (Bottom)
        createWallMaterial(this.colors.leftWallOuter || this.colors.sampingLuar, 'leftWall', true),  // +Z (Front)
        createWallMaterial(this.colors.leftWallOuter || this.colors.sampingLuar, 'leftWall', true)   // -Z (Back)
      ]);
      this.meshes.leftWall.position.set(-(innerWidth / 2 + wallThickness / 2), wallHeight / 2 - 0.3, 0);
      this.meshes.leftWall.castShadow = true;
      this.meshes.leftWall.receiveShadow = true;
      addMeshOutlines(this.meshes.leftWall, 0.15);
      this.productGroup.add(this.meshes.leftWall);

      // RIGHT WALL (Single panel with 6 materials: Index 0=Outer(+X), Index 1=Inner(-X))
      const rightGeo = createPaddedBox(wallThickness, wallHeight, innerHeight);  // Corner depth 1.60
      this.meshes.rightWall = new THREE.Mesh(rightGeo, [
        createWallMaterial(this.colors.rightWallOuter || this.colors.sampingLuar, 'rightWall', true),  // +X (Outer)
        createWallMaterial(this.colors.rightWallInner || this.colors.sampingDalam, 'rightWall', false), // -X (Inner)
        createWallMaterial(this.colors.rightWallOuter || this.colors.sampingLuar, 'rightWall', true),  // +Y (Top)
        createWallMaterial(this.colors.rightWallOuter || this.colors.sampingLuar, 'rightWall', true),  // -Y (Bottom)
        createWallMaterial(this.colors.rightWallOuter || this.colors.sampingLuar, 'rightWall', true),  // +Z (Front)
        createWallMaterial(this.colors.rightWallOuter || this.colors.sampingLuar, 'rightWall', true)   // -Z (Back)
      ]);
      this.meshes.rightWall.position.set((innerWidth / 2 + wallThickness / 2), wallHeight / 2 - 0.3, 0);
      this.meshes.rightWall.castShadow = true;
      this.meshes.rightWall.receiveShadow = true;
      addMeshOutlines(this.meshes.rightWall, 0.15);
      this.productGroup.add(this.meshes.rightWall);

      // FRONT WALL (Single panel with 6 materials: Index 4=Outer(+Z), Index 5=Inner(-Z))
      const frontGeo = createPaddedBox(innerWidth, wallHeight, wallThickness);  // Width 1.60
      this.meshes.frontWall = new THREE.Mesh(frontGeo, [
        createWallMaterial(this.colors.frontWallOuter || this.colors.sampingLuar, 'frontWall', true),  // +X (Right)
        createWallMaterial(this.colors.frontWallOuter || this.colors.sampingLuar, 'frontWall', true),  // -X (Left)
        createWallMaterial(this.colors.frontWallOuter || this.colors.sampingLuar, 'frontWall', true),  // +Y (Top)
        createWallMaterial(this.colors.frontWallOuter || this.colors.sampingLuar, 'frontWall', true),  // -Y (Bottom)
        createWallMaterial(this.colors.frontWallOuter || this.colors.sampingLuar, 'frontWall', true),   // +Z (Outer)
        createWallMaterial(this.colors.frontWallInner || this.colors.sampingDalam, 'frontWall', false) // -Z (Inner)
      ]);
      this.meshes.frontWall.position.set(0, wallHeight / 2 - 0.3, (innerHeight / 2 + wallThickness / 2));
      this.meshes.frontWall.castShadow = true;
      this.meshes.frontWall.receiveShadow = true;
      addMeshOutlines(this.meshes.frontWall, 0.15);
      this.productGroup.add(this.meshes.frontWall);

      // BACK WALL (Single panel with 6 materials: Index 4=Inner(+Z), Index 5=Outer(-Z))
      const backGeo = createPaddedBox(innerWidth, wallHeight, wallThickness);  // Width 1.60
      this.meshes.backWall = new THREE.Mesh(backGeo, [
        createWallMaterial(this.colors.backWallOuter || this.colors.sampingLuar, 'backWall', true),  // +X (Right)
        createWallMaterial(this.colors.backWallOuter || this.colors.sampingLuar, 'backWall', true),  // -X (Left)
        createWallMaterial(this.colors.backWallOuter || this.colors.sampingLuar, 'backWall', true),  // +Y (Top)
        createWallMaterial(this.colors.backWallOuter || this.colors.sampingLuar, 'backWall', true),  // -Y (Bottom)
        createWallMaterial(this.colors.backWallInner || this.colors.sampingDalam, 'backWall', false), // +Z (Inner)
        createWallMaterial(this.colors.backWallOuter || this.colors.sampingLuar, 'backWall', true)   // -Z (Outer)
      ]);
      this.meshes.backWall.position.set(0, wallHeight / 2 - 0.3, -(innerHeight / 2 + wallThickness / 2));
      this.meshes.backWall.castShadow = true;
      this.meshes.backWall.receiveShadow = true;
      addMeshOutlines(this.meshes.backWall, 0.15);
      this.productGroup.add(this.meshes.backWall);

      // Centering adjustments
      this.productGroup.position.set(0, 0.05, 0);

      // Re-apply all animal stickers
      this.reapplyAllStickers();
    }

    // 2. Playbie Flat Playmat (4-Section Folding Mat)
    buildPlaymat() {
      this.clearProductGroup();
      this.meshes = {};

      const pWidth = 0.52; // Width of one folding panel
      const pHeight = 0.06; // Thickness
      const pLength = 1.8; // Length
      
      const createPanelMat = (colorHex) => {
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color(colorHex),
          roughness: 0.7,
          metalness: 0.04
        });
      };

      const panelGeo = new THREE.BoxGeometry(pWidth, pHeight, pLength);

      // Render 4 side-by-side folding panels
      for (let i = 1; i <= 4; i++) {
        const partName = `panel${i}`;
        const color = this.colors[partName] || '#FFFFFF';
        
        const panelMesh = new THREE.Mesh(panelGeo, createPanelMat(color));
        // Distribute panels side-by-side: Panel 1 to 4
        // Center of panels is at X = -0.78, -0.26, 0.26, 0.78
        const xPos = -0.78 + (i - 1) * pWidth;
        panelMesh.position.set(xPos, -0.28, 0);
        panelMesh.castShadow = true;
        panelMesh.receiveShadow = true;
        
        this.productGroup.add(panelMesh);
        this.meshes[partName] = panelMesh;
      }
      
      this.productGroup.position.set(0, 0, 0);
    }

    clearProductGroup() {
      while (this.productGroup.children.length > 0) {
        const obj = this.productGroup.children[0];
        this.productGroup.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    }

    // --- COLOR CUSTOMIZATION ---
    updatePartColor(partName, hexColor) {
      console.log(`[Viewer3D] updatePartColor called for part: ${partName} with color: ${hexColor}`);
      // Save locally
      this.colors[partName] = hexColor;
      
      let updatedCount = 0;
      // Update corresponding meshes dynamically
      if (partName === 'leftWallOuter' || partName === 'leftWallInner') {
        const mesh = this.meshes.leftWall;
        if (mesh && Array.isArray(mesh.material)) {
          if (partName === 'leftWallOuter') {
            const outerIndices = [1, 2, 3, 4, 5];
            const hasMotif = this.activeMotif && (this.activeMotifWall === 'all' || this.activeMotifWall === 'leftWall');
            outerIndices.forEach(idx => {
              const mat = mesh.material[idx];
              if (mat && !hasMotif) {
                mat.color.set(hexColor);
                if (mat.map) mat.map = null;
                mat.needsUpdate = true;
                updatedCount++;
              }
            });
          } else {
            const mat = mesh.material[0];
            const hasMotif = this.activeMotif && (this.activeMotifWall === 'all' || this.activeMotifWall === 'leftWall');
            if (mat && !hasMotif) {
              mat.color.set(hexColor);
              if (mat.map) mat.map = null;
              mat.needsUpdate = true;
              updatedCount++;
            }
          }
        }
      } else if (partName === 'rightWallOuter' || partName === 'rightWallInner') {
        const mesh = this.meshes.rightWall;
        if (mesh && Array.isArray(mesh.material)) {
          if (partName === 'rightWallOuter') {
            const outerIndices = [0, 2, 3, 4, 5];
            const hasMotif = this.activeMotif && (this.activeMotifWall === 'all' || this.activeMotifWall === 'rightWall');
            outerIndices.forEach(idx => {
              const mat = mesh.material[idx];
              if (mat && !hasMotif) {
                mat.color.set(hexColor);
                if (mat.map) mat.map = null;
                mat.needsUpdate = true;
                updatedCount++;
              }
            });
          } else {
            const mat = mesh.material[1];
            const hasMotif = this.activeMotif && (this.activeMotifWall === 'all' || this.activeMotifWall === 'rightWall');
            if (mat && !hasMotif) {
              mat.color.set(hexColor);
              if (mat.map) mat.map = null;
              mat.needsUpdate = true;
              updatedCount++;
            }
          }
        }
      } else if (partName === 'frontWallOuter' || partName === 'frontWallInner') {
        const mesh = this.meshes.frontWall;
        if (mesh && Array.isArray(mesh.material)) {
          if (partName === 'frontWallOuter') {
            const outerIndices = [0, 1, 2, 3, 4];
            const hasMotif = this.activeMotif && (this.activeMotifWall === 'all' || this.activeMotifWall === 'frontWall');
            outerIndices.forEach(idx => {
              const mat = mesh.material[idx];
              if (mat && !hasMotif) {
                mat.color.set(hexColor);
                if (mat.map) mat.map = null;
                mat.needsUpdate = true;
                updatedCount++;
              }
            });
          } else {
            const mat = mesh.material[5];
            const hasMotif = this.activeMotif && (this.activeMotifWall === 'all' || this.activeMotifWall === 'frontWall');
            if (mat && !hasMotif) {
              mat.color.set(hexColor);
              if (mat.map) mat.map = null;
              mat.needsUpdate = true;
              updatedCount++;
            }
          }
        }
      } else if (partName === 'backWallOuter' || partName === 'backWallInner') {
        const mesh = this.meshes.backWall;
        if (mesh && Array.isArray(mesh.material)) {
          if (partName === 'backWallOuter') {
            const outerIndices = [0, 1, 2, 3, 5];
            const hasMotif = this.activeMotif && (this.activeMotifWall === 'all' || this.activeMotifWall === 'backWall');
            outerIndices.forEach(idx => {
              const mat = mesh.material[idx];
              if (mat && !hasMotif) {
                mat.color.set(hexColor);
                if (mat.map) mat.map = null;
                mat.needsUpdate = true;
                updatedCount++;
              }
            });
          } else {
            const mat = mesh.material[4];
            const hasMotif = this.activeMotif && (this.activeMotifWall === 'all' || this.activeMotifWall === 'backWall');
            if (mat && !hasMotif) {
              mat.color.set(hexColor);
              if (mat.map) mat.map = null;
              mat.needsUpdate = true;
              updatedCount++;
            }
          }
        }
      } else if (partName === 'alasBawah') {
        ['floorMat1', 'floorMat2', 'floorMat3'].forEach(name => {
          const mesh = this.meshes[name];
          if (mesh && mesh.material) {
            mesh.material.color.set(hexColor);
            mesh.material.needsUpdate = true;
            updatedCount++;
          }
        });
      } else if (partName === 'sampingLuar') {
        // Keep for backward compatibility / whole wall overrides
        ['leftWall', 'rightWall', 'frontWall', 'backWall'].forEach(name => {
          const mesh = this.meshes[name];
          if (mesh && Array.isArray(mesh.material)) {
            let outerIndices = [];
            if (name === 'leftWall') outerIndices = [1, 2, 3, 4, 5];
            if (name === 'rightWall') outerIndices = [0, 2, 3, 4, 5];
            if (name === 'frontWall') outerIndices = [0, 1, 2, 3, 4];
            if (name === 'backWall') outerIndices = [0, 1, 2, 3, 5];

            const hasMotif = this.activeMotif && (this.activeMotifWall === 'all' || this.activeMotifWall === name);
            outerIndices.forEach(idx => {
              const mat = mesh.material[idx];
              if (mat && !hasMotif) {
                mat.color.set(hexColor);
                if (mat.map) mat.map = null;
                mat.needsUpdate = true;
                updatedCount++;
              }
            });
          }
        });
      } else if (partName === 'sampingDalam') {
        // Keep for backward compatibility / whole wall overrides
        ['leftWall', 'rightWall', 'frontWall', 'backWall'].forEach(name => {
          const mesh = this.meshes[name];
          if (mesh && Array.isArray(mesh.material)) {
            let innerIndex = 0;
            if (name === 'leftWall') innerIndex = 0;
            if (name === 'rightWall') innerIndex = 1;
            if (name === 'frontWall') innerIndex = 5;
            if (name === 'backWall') innerIndex = 4;

            const mat = mesh.material[innerIndex];
            const hasMotif = this.activeMotif && (this.activeMotifWall === 'all' || this.activeMotifWall === name);
            if (mat && !hasMotif) {
              mat.color.set(hexColor);
              if (mat.map) mat.map = null;
              mat.needsUpdate = true;
              updatedCount++;
            }
          }
        });
      } else {
        // Fallback for single meshes
        const mesh = this.meshes[partName];
        if (mesh && mesh.material) {
          mesh.material.color.set(hexColor);
          mesh.material.needsUpdate = true;
          updatedCount++;
        }
      }
      console.log(`[Viewer3D] Updated colors on ${updatedCount} meshes.`);
    }

    // --- UPGRADED MOTIF AND SIZE CUSTOMIZATION METHODS ---
    updateSeries(seriesName) {
      this.activeSeries = seriesName;
      this.activeMotif = null;  // Clear motif for all series
      this.stickers = {};  // Clear animal stickers when switching series
      this.stickerMeshes = {};  // Clear sticker meshes
      if (this.activeProductType === 'bumper') {
        this.buildBumperBed();
      }
    }

    updateMotif(fileId) {
      // Motif disabled — all series use solid colors
      this.activeMotif = null;
      if (this.activeProductType === 'bumper') {
        this.buildBumperBed();
      }
    }

    updateMotifWall(wallName) {
      this.activeMotifWall = wallName;
      if (this.activeProductType === 'bumper') {
        this.buildBumperBed();
      }
    }

    updateSize(sizeType) {
      if (sizeType === 'polos') {
        this.activeMotif = null;
      }
      if (this.activeProductType === 'bumper') {
        this.buildBumperBed();
      }
    }

    updateDimensions(sizeString) {
      if (sizeString === '100x100') {
        this.activeWidth = 1.0;
        this.activeHeight = 1.0;
      } else if (sizeString === '100x200') {
        this.activeWidth = 1.0;
        this.activeHeight = 2.0;
      } else if (sizeString === '200x200') {
        this.activeWidth = 2.0;
        this.activeHeight = 2.0;
      } else {
        // default 150x150
        this.activeWidth = 1.6;
        this.activeHeight = 1.6;
      }
      
      if (this.activeProductType === 'bumper') {
        this.buildBumperBed();
      }
    }

    createAnimalPlaceholderTexture(animalIndex) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      // Clear
      ctx.clearRect(0, 0, 256, 256);

      // Draw background circle
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(128, 128, 110, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw border
      ctx.strokeStyle = '#FFB7B2';
      ctx.lineWidth = 8;
      ctx.stroke();

      // Draw Emoji
      const emojis = ['🦁', '🐨', '🐰', '🐼', '🦊'];
      const emoji = emojis[animalIndex - 1] || '🦁';
      
      ctx.font = '110px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 128, 128);

      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    }

    updateAnimalSticker(surfaceName, animalId) {
      console.log(`[Viewer3D] updateAnimalSticker called for surface: ${surfaceName} with animalId: ${animalId}`);
      if (animalId === 'remove') {
        delete this.stickers[surfaceName];
      } else {
        this.stickers[surfaceName] = animalId;
      }

      this.reapplySticker(surfaceName);
    }

    reapplySticker(surfaceName) {
      const oldMesh = this.stickerMeshes[surfaceName];
      if (oldMesh) {
        this.productGroup.remove(oldMesh);
        if (oldMesh.geometry) oldMesh.geometry.dispose();
        if (oldMesh.material) oldMesh.material.dispose();
        delete this.stickerMeshes[surfaceName];
      }

      // Stickers enabled for all series

      const animalId = this.stickers[surfaceName];
      if (!animalId || animalId === 'remove') return;

      const animalIndex = parseInt(animalId);
      if (isNaN(animalIndex)) return;

      const wallThickness = 0.18;
      const wallHeight = 0.65;
      const innerWidth = this.activeWidth !== undefined ? this.activeWidth : 1.6;
      const innerHeight = this.activeHeight !== undefined ? this.activeHeight : 1.6;

      const stickerGeo = new THREE.PlaneGeometry(0.35, 0.35);
      const stickerMat = new THREE.MeshBasicMaterial({
        map: this.createAnimalPlaceholderTexture(animalIndex),
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4
      });
      const stickerMesh = new THREE.Mesh(stickerGeo, stickerMat);

      const offset = 0.005;
      let x = 0, y = 0, z = 0;
      let rotX = 0, rotY = 0, rotZ = 0;

      if (surfaceName === 'leftWallOuter') {
        x = -(innerWidth / 2 + wallThickness) - offset;
        y = wallHeight / 2 - 0.3;
        z = 0;
        rotY = -Math.PI / 2;
      } else if (surfaceName === 'leftWallInner') {
        x = -innerWidth / 2 + offset;
        y = wallHeight / 2 - 0.3;
        z = 0;
        rotY = Math.PI / 2;
      } else if (surfaceName === 'rightWallOuter') {
        x = (innerWidth / 2 + wallThickness) + offset;
        y = wallHeight / 2 - 0.3;
        z = 0;
        rotY = Math.PI / 2;
      } else if (surfaceName === 'rightWallInner') {
        x = innerWidth / 2 - offset;
        y = wallHeight / 2 - 0.3;
        z = 0;
        rotY = -Math.PI / 2;
      } else if (surfaceName === 'frontWallOuter') {
        x = 0;
        y = wallHeight / 2 - 0.3;
        z = (innerHeight / 2 + wallThickness) + offset;
        rotY = 0;
      } else if (surfaceName === 'frontWallInner') {
        x = 0;
        y = wallHeight / 2 - 0.3;
        z = innerHeight / 2 - offset;
        rotY = Math.PI;
      } else if (surfaceName === 'backWallOuter') {
        x = 0;
        y = wallHeight / 2 - 0.3;
        z = -(innerHeight / 2 + wallThickness) - offset;
        rotY = Math.PI;
      } else if (surfaceName === 'backWallInner') {
        x = 0;
        y = wallHeight / 2 - 0.3;
        z = -innerHeight / 2 + offset;
        rotY = 0;
      } else if (surfaceName === 'floorMat1') {
        x = -innerWidth / 3;
        y = -0.25 + 0.06 + offset;
        z = 0;
        rotX = -Math.PI / 2;
      } else if (surfaceName === 'floorMat2') {
        x = 0;
        y = -0.25 + 0.06 + offset;
        z = 0;
        rotX = -Math.PI / 2;
      } else if (surfaceName === 'floorMat3') {
        x = innerWidth / 3;
        y = -0.25 + 0.06 + offset;
        z = 0;
        rotX = -Math.PI / 2;
      } else {
        return;
      }

      stickerMesh.position.set(x, y, z);
      stickerMesh.rotation.set(rotX, rotY, rotZ);
      this.productGroup.add(stickerMesh);
      this.stickerMeshes[surfaceName] = stickerMesh;
    }

    reapplyAllStickers() {
      for (const surfaceName of Object.keys(this.stickerMeshes)) {
        const mesh = this.stickerMeshes[surfaceName];
        if (mesh) {
          this.productGroup.remove(mesh);
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) mesh.material.dispose();
        }
      }
      this.stickerMeshes = {};

      for (const surfaceName of Object.keys(this.stickers)) {
        this.reapplySticker(surfaceName);
      }
    }

    // --- THEME SYNCING ---
    onThemeChange(themeName) {
      this.theme = themeName;
      
      // Update canvas scene styling
      const canvasColor = this.getCanvasBgColor();
      this.scene.background.set(canvasColor);
      this.scene.fog.color.set(canvasColor);
      
      if (this.shadowPlane && this.shadowPlane.material) {
        this.shadowPlane.material.color.set(themeName === 'pastel' ? 0xF5ECE2 : 0xE6DED3);
      }

      if (themeName === 'pastel') {
        this.colors = {
          alasBawah: '#FFE4E6',
          sampingLuar: '#FFF8E7',
          sampingDalam: '#FFEDD5',
          
          leftWallOuter: '#FFF8E7',
          leftWallInner: '#FFEDD5',
          rightWallOuter: '#FFF8E7',
          rightWallInner: '#FFEDD5',
          frontWallOuter: '#FFF8E7',
          frontWallInner: '#FFEDD5',
          backWallOuter: '#FFF8E7',
          backWallInner: '#FFEDD5',
          
          leftWall: '#FFF8E7',
          rightWall: '#FFEDD5',
          frontWall: '#E0F2FE',
          backWall: '#FFF8E7',
          floorMat1: '#FFE4E6',
          floorMat2: '#FAF9F6',
          floorMat3: '#FFE4E6',
          
          panel1: '#FFF8E7',
          panel2: '#FFE4E6',
          panel3: '#E0F2FE',
          panel4: '#FFEDD5'
        };
      } else {
        // Nordic Earth Tones
        this.colors = {
          alasBawah: '#C27D58',
          sampingLuar: '#F5EFEB',
          sampingDalam: '#D7CCC8',
          
          leftWallOuter: '#F5EFEB',
          leftWallInner: '#D7CCC8',
          rightWallOuter: '#F5EFEB',
          rightWallInner: '#D7CCC8',
          frontWallOuter: '#F5EFEB',
          frontWallInner: '#D7CCC8',
          backWallOuter: '#F5EFEB',
          backWallInner: '#D7CCC8',
          
          leftWall: '#F5EFEB',
          rightWall: '#D7CCC8',
          frontWall: '#8B9A86',
          backWall: '#F5EFEB',
          floorMat1: '#C27D58',
          floorMat2: '#F5EFEB',
          floorMat3: '#C27D58',
          
          panel1: '#F5EFEB',
          panel2: '#CFD8DC',
          panel3: '#8B9A86',
          panel4: '#C27D58'
        };
      }

      // Rebuild meshes to trigger initial color map updates
      if (this.activeProductType === 'bumper') {
        this.buildBumperBed();
      } else {
        this.buildPlaymat();
      }
    }

    setProductType(type) {
      if (this.activeProductType === type) return;
      this.activeProductType = type;

      // Rebuild scene
      if (type === 'bumper') {
        this.buildBumperBed();
        this.resetCameraPosition();
      } else {
        this.buildPlaymat();
        // Adjust camera slightly for playmat flat view
        this.camera.position.set(3, 4, 3);
        this.controls.target.set(0, -0.2, 0);
      }
    }

    // --- RENDER ANIMATE LOOP ---
    animate() {
      requestAnimationFrame(this.animate.bind(this));
      
      // Update camera orbital controls
      if (this.controls) {
        this.controls.update();
      }
      
      // Render frame
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    }

    onWindowResize() {
      if (!this.camera || !this.renderer) return;
      
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    // --- SETUP CONTROL TRIGGERS ---
    setupUIControls() {
      // 1. Auto Rotate Toggle
      const autoRotateBtn = document.getElementById('btnAutoRotate');
      if (autoRotateBtn) {
        autoRotateBtn.addEventListener('click', () => {
          this.autoRotate = !this.autoRotate;
          this.controls.autoRotate = this.autoRotate;
          autoRotateBtn.classList.toggle('active', !this.autoRotate);
          autoRotateBtn.style.backgroundColor = this.autoRotate ? 'rgba(255,255,255,0.9)' : 'var(--color-primary)';
          autoRotateBtn.style.color = this.autoRotate ? 'var(--text-main)' : '#FFFFFF';
        });
      }

      // 2. Camera reset
      const resetCameraBtn = document.getElementById('btnResetCamera');
      if (resetCameraBtn) {
        resetCameraBtn.addEventListener('click', () => {
          this.resetCameraPosition();
        });
      }

      // 3. Select product type
      const selectBumperBtn = document.getElementById('selectBumperBed');
      const selectPlaymatBtn = document.getElementById('selectPlaymat');
      const partSelectorContainer = document.getElementById('partSelectorContainer');
      const customizerTitle = document.getElementById('customizerTitle');
      const customizerDesc = document.getElementById('customizerDesc');
      const customizerPrice = document.getElementById('customizerPrice');
      
      if (selectBumperBtn && selectPlaymatBtn) {
        selectBumperBtn.addEventListener('click', () => {
          selectBumperBtn.classList.add('active');
          selectPlaymatBtn.classList.remove('active');
          this.setProductType('bumper');
          
          // Sync UI
          customizerTitle.textContent = "Playbie Bumper Bed Custom";
          customizerDesc.textContent = "Sesuaikan warna untuk setiap sisi Bumper Bed yang tebal dan aman ini. Cocok untuk proteksi benturan bayi Anda.";
          customizerPrice.textContent = "Rp 3,099,900";
          
          partSelectorContainer.innerHTML = `
            <button class="part-btn active" data-part="leftWallOuter">Kiri (Luar)</button>
            <button class="part-btn" data-part="leftWallInner">Kiri (Dalam)</button>
            <button class="part-btn" data-part="rightWallOuter">Kanan (Luar)</button>
            <button class="part-btn" data-part="rightWallInner">Kanan (Dalam)</button>
            <button class="part-btn" data-part="frontWallOuter">Depan (Luar)</button>
            <button class="part-btn" data-part="frontWallInner">Depan (Dalam)</button>
            <button class="part-btn" data-part="backWallOuter">Belakang (Luar)</button>
            <button class="part-btn" data-part="backWallInner">Belakang (Dalam)</button>
            <button class="part-btn" data-part="floorMat1">Alas Kiri</button>
            <button class="part-btn" data-part="floorMat2">Alas Tengah</button>
            <button class="part-btn" data-part="floorMat3">Alas Kanan</button>
          `;
          this.setupPartButtons();
        });

        selectPlaymatBtn.addEventListener('click', () => {
          selectPlaymatBtn.classList.add('active');
          selectBumperBtn.classList.remove('active');
          this.setProductType('playmat');
          
          // Sync UI
          customizerTitle.textContent = "Playbie Playmat Lipat Custom";
          customizerDesc.textContent = "Playmat lipat 4-panel modular. Kustomisasi warna masing-masing panel matras yang tebal, empuk, dan anti-air ini.";
          customizerPrice.textContent = "Rp 1,299,900";
          
          // Re-render Part selectors
          partSelectorContainer.innerHTML = `
            <button class="part-btn active" data-part="panel1">Panel 1</button>
            <button class="part-btn" data-part="panel2">Panel 2</button>
            <button class="part-btn" data-part="panel3">Panel 3</button>
            <button class="part-btn" data-part="panel4">Panel 4</button>
          `;
          this.setupPartButtons();
        });
      }

      this.setupPartButtons();
    }

    setupPartButtons() {
      const partBtns = document.querySelectorAll('.part-btn');
      partBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          partBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          // Store selected part in viewer state
          this.selectedPart = btn.getAttribute('data-part');

          // Sync color palette highlight to active color of this part
          const partName = this.selectedPart;
          const currentColor = this.colors[partName];

          const premiumPalette = document.getElementById('playbieColoursPalette');
          if (premiumPalette) {
            premiumPalette.querySelectorAll('.color-swatch-circle').forEach(sw => {
              const hex = sw.getAttribute('data-color');
              const isActive = hex.toLowerCase() === currentColor?.toLowerCase();
              sw.classList.toggle('active', isActive);
              sw.style.transform = isActive ? 'scale(1.15)' : 'none';
              sw.style.boxShadow = isActive ? '0 0 8px rgba(0,0,0,0.2)' : 'none';

              if (isActive) {
                const selectedColorNameDisplay = document.getElementById('selectedColorNameDisplay');
                if (selectedColorNameDisplay) {
                  selectedColorNameDisplay.textContent = `Warna Terpilih: ${sw.getAttribute('title') || ''}`;
                }
              }
            });
          }
        });
      });

      // Auto-select first part on load
      if (partBtns.length > 0 && !this.selectedPart) {
        partBtns[0].click();
      }
    }

    // ---- PUBLIC: Apply color to selected part ----
    setColorToSelectedPart(hex) {
      const partName = this.selectedPart;
      if (!partName) {
        console.warn('[Viewer3D] No part selected. Click a part button first.');
        return;
      }

      const color = new THREE.Color(hex);
      this.colors[partName] = hex;

      // Map partName to mesh key and material face index
      const partMapping = {
        'leftWallOuter':   { mesh: 'leftWall',   faceIndex: 1 },
        'leftWallInner':   { mesh: 'leftWall',   faceIndex: 0 },
        'rightWallOuter':  { mesh: 'rightWall',  faceIndex: 0 },
        'rightWallInner':  { mesh: 'rightWall',  faceIndex: 1 },
        'frontWallOuter':  { mesh: 'frontWall',  faceIndex: 4 },
        'frontWallInner':  { mesh: 'frontWall',  faceIndex: 5 },
        'backWallOuter':   { mesh: 'backWall',   faceIndex: 4 },
        'backWallInner':   { mesh: 'backWall',   faceIndex: 5 },
        'floorMat1':       { mesh: 'floorMat1',  faceIndex: null },
        'floorMat2':       { mesh: 'floorMat2',  faceIndex: null },
        'floorMat3':       { mesh: 'floorMat3',  faceIndex: null },
      };

      const mapping = partMapping[partName];
      if (!mapping) {
        console.warn('[Viewer3D] Unknown part:', partName);
        return;
      }

      const mesh = this.meshes[mapping.mesh];
      if (!mesh) {
        console.warn('[Viewer3D] Mesh not found:', mapping.mesh);
        return;
      }

      if (mapping.faceIndex !== null && Array.isArray(mesh.material)) {
        // Multi-material wall: update specific face
        if (mesh.material[mapping.faceIndex]) {
          mesh.material[mapping.faceIndex].color = color;
        }
      } else if (mesh.material) {
        // Single material: update directly
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.color = color);
        } else {
          mesh.material.color = color;
        }
      }

      // Sync UI highlight
      const palette = document.getElementById('playbieColoursPalette');
      if (palette) {
        palette.querySelectorAll('.color-swatch-circle').forEach(sw => {
          const swHex = sw.getAttribute('data-color');
          const isActive = swHex.toLowerCase() === hex.toLowerCase();
          sw.classList.toggle('active', isActive);
          sw.style.transform = isActive ? 'scale(1.15)' : 'none';
          sw.style.boxShadow = isActive ? '0 0 8px rgba(0,0,0,0.3)' : 'none';
        });
      }

      const displayEl = document.getElementById('selectedColorNameDisplay');
      if (displayEl) displayEl.textContent = 'Warna Terpilih: ' + (sw.getAttribute('title') || hex);
    }

    // ---- INTERNAL: Find mesh by part name ----
    _findMeshByPartName(partName) {
      const partMapping = {
        'leftWallOuter':   'leftWall',
        'leftWallInner':   'leftWall',
        'rightWallOuter':  'rightWall',
        'rightWallInner':  'rightWall',
        'frontWallOuter':  'frontWall',
        'frontWallInner':  'frontWall',
        'backWallOuter':   'backWall',
        'backWallInner':   'backWall',
        'floorMat1':       'floorMat1',
        'floorMat2':       'floorMat2',
        'floorMat3':       'floorMat3',
      };
      const meshKey = partMapping[partName];
      return meshKey ? this.meshes[meshKey] : null;
    }

    // ---- Rebuild model with current colors ----
    rebuildModel() {
      const isBumper = document.getElementById('selectBumperBtn')?.classList.contains('active');
      this.clearProduct();
      if (isBumper) {
        this.buildBumperBed();
      } else {
        this.buildPlaymat();
      }
    }

    // ---- Get current design for cart ----
    getCurrentDesign() {
      return {
        colors: Object.assign({}, this.colors),
        selectedPart: this.selectedPart
      };
    }

    // ---- Series switcher ----
    switchSeries(series) {
      console.log('[Viewer3D] Switch to series:', series);
    }
  }

  // Launch Viewer globally (bulletproof check for dynamic scripts)
  const initViewer = () => {
    if (!window.playbie3D) {
      window.playbie3D = new Playbie3DViewer();
      console.log("[Viewer3D] playbie3D instance initialized successfully.");
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initViewer);
  } else {
    initViewer();
  }
})();