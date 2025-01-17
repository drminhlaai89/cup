(async function() {
  const isArSessionSupported = navigator.xr && navigator.xr.isSessionSupported && await navigator.xr.isSessionSupported("immersive-ar");
  if (isArSessionSupported) {
    document.getElementById("enter-ar").addEventListener("click", window.app.activateXR)
  } else {
    onNoXRDevice();
  }
})();

let buttonEnabled = true;
/**
 * Container class to manage connecting to the WebXR Device API
 * and handle rendering on every frame.
 */
class App {
  /**
   * Run when the Start AR button is pressed.
   */

  constructor() {
    // Initialize an array to store spawned objects
    this.spawnedObjects = [];
    // Flag to track if a specific object is selected
    this.selectedObject = null;
    // Track the index of the currently selected object
    this.currentObjectIndex = 0; 

   // Store the original scale information for each object
    this.objectOriginalScales = new Map();

    this.reticleVisible = true;
  }

  //   highlightObject(object) {
  //     // Reset scale for all objects
  //     this.spawnedObjects.forEach(obj => {
  //       if (obj !== object) {
  //         obj.scale.set(1, 1, 1); // Reset scale
  //       }
  //     });

  //   // Apply a scale change to the selected object
  //   if (object) {
  //     object.scale.set(1.4, 1.4, 1.4); // Set a larger scale (you can customize)
  //   }
  // }

  highlightObject(object) {
    // Check if the object has been scaled due to user interaction
    const isScaledByInteraction = this.objectScales.has(object);
  
    // Reset scale for all objects
    this.spawnedObjects.forEach(obj => {
      const originalScale = this.objectOriginalScales.get(obj);
  
      if (obj !== object && originalScale) {
        obj.scale.copy(originalScale); // Reset scale to original
      }
    });
  
    // Apply a scale change to the selected object if not scaled by interaction
    if (object && !isScaledByInteraction) {
      // Store the original scale before changing it
      this.objectOriginalScales.set(object, object.scale.clone());
      object.scale.set(1.4, 1.4, 1.4); // Set a larger scale (you can customize)
    }
  }

  changeSelectedObject(offset) {
    // Increment or decrement the current index
    this.currentObjectIndex += offset;

    // Ensure the index is within bounds
    if (this.currentObjectIndex < 0) {
      this.currentObjectIndex = this.spawnedObjects.length - 1;
    } else if (this.currentObjectIndex >= this.spawnedObjects.length) {
      this.currentObjectIndex = 0;
    }

    // Set the selected object based on the updated index
    this.selectedObject = this.spawnedObjects[this.currentObjectIndex];

    // Do something with the selectedObject (e.g., update UI, etc.)
    console.log('Selected Object:', this.selectedObject);
  }

  onClickNext = () => {
    this.changeSelectedObject(1);
    this.highlightObject(this.selectedObject);  // Move to the next object
  }

  onClickPrevious = () => {
    this.changeSelectedObject(-1);
    this.highlightObject(this.selectedObject);  // Move to the previous object
  }
  
  activateXR = async () => {
    try {
      // Initialize a WebXR session using "immersive-ar".
      this.xrSession = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ['hit-test', 'dom-overlay'],
        domOverlay: { root: document.body }
      });

      // Create the canvas that will contain our camera's background and our virtual scene.
      this.createXRCanvas();

      const selectButton = document.getElementById('selectButton');
      selectButton.style.display = 'inline-block';

      const toggleReticleButton = document.getElementById('toggleReticleButton');
      toggleReticleButton.style.display = 'inline-block';

      // With everything set up, start the app.
      await this.onSessionStarted();
    } catch(e) {
      console.log(e);
      onNoXRDevice();
    }
  }

  /**
   * Add a canvas element and initialize a WebGL context that is compatible with WebXR.
   */
  createXRCanvas() {
    this.canvas = document.createElement("canvas");
    document.body.appendChild(this.canvas);
    this.gl = this.canvas.getContext("webgl", {xrCompatible: true});
 
    this.xrSession.updateRenderState({
      baseLayer: new XRWebGLLayer(this.xrSession, this.gl)
    });
  }

  /**
   * Called when the XRSession has begun. Here we set up our three.js
   * renderer, scene, and camera and attach our XRWebGLLayer to the
   * XRSession and kick off the render loop.
   */
  onSessionStarted = async () => {
    // Add the `ar` class to our body, which will hide our 2D components
    document.body.classList.add('ar');

    // To help with working with 3D on the web, we'll use three.js.
    this.setupThreeJs();

    // Setup an XRReferenceSpace using the "local" coordinate system.
    this.localReferenceSpace = await this.xrSession.requestReferenceSpace('local');

    // Create another XRReferenceSpace that has the viewer as the origin.
    this.viewerSpace = await this.xrSession.requestReferenceSpace('viewer');
    // Perform hit testing using the viewer as origin.
    this.hitTestSource = await this.xrSession.requestHitTestSource({ space: this.viewerSpace });

    // Start a rendering loop using this.onXRFrame.
    this.xrSession.requestAnimationFrame(this.onXRFrame);

    //Comment
    const selectButton = document.getElementById('selectButton');
    selectButton.addEventListener('click',  this.onClickSelect);
    this.showNavigationButtons(true);   

    // Add the event listener for the "Show Reticle" button
const toggleReticleButton = document.getElementById('toggleReticleButton');
toggleReticleButton.addEventListener('click', this.onClickShowReticle);
  
    console.log('XR session started');
  }

  onClickSelect = (event) => {
    // Prevent the event from propagating to the touch screen
    if (!buttonEnabled) {
      return;
    }
  
    // Prevent the event from propagating to the touch screen
    event.stopPropagation();
  
    // this.xrSession.addEventListener("select", this.onSelect);
  
    // // Disable the button to prevent further interactions
    // buttonEnabled = false;

     // Toggle the buttonEnabled state
  buttonEnabled = !buttonEnabled;

  if (buttonEnabled) {
    // If button is enabled again, remove the 'select' event listener
    this.xrSession.removeEventListener("select", this.onSelect);
  } else {
    // If button is not enabled, add the 'select' event listener
    this.xrSession.addEventListener("select", this.onSelect);
  }
  
    console.log('Button clicked');
  }

  /** Place a sunflower when the screen is tapped. */
  onSelect = () => {
    if (window.sunflower) {
      console.log("App.js sunflower");
      this.xrSession.removeEventListener("select", this.onSelect);
      const clone = window.sunflower.clone();
      clone.position.copy(this.reticle.position);
      this.scene.add(clone);
      clone.name = 'object' + this.spawnedObjects.length;
      this.spawnedObjects.push(clone);

      console.log(clone.name);

      console.log(this.spawnedObjects);

      // Highlight the selected object (change its scale)
      this.highlightObject(clone);

      // Enable rotation for the spawned object
    this.enableRotation(clone);

     // Set the selected object to the newly spawned clone
      this.selectedObject = clone;

      const shadowMesh = this.scene.children.find(c => c.name === 'shadowMesh');
      shadowMesh.position.y = clone.position.y;

      console.log('Select event handled');
      console.log(window.sunflower);

      // Re-enable the button after handling the 'select' event
    buttonEnabled = true;
    }
  }

  showNavigationButtons(show) {
    const previousButton = document.getElementById('previousButton');
    const nextButton = document.getElementById('nextButton');

    if (show) {
      previousButton.style.display = 'inline-block';
      nextButton.style.display = 'inline-block';
    } else {
      previousButton.style.display = 'none';
      nextButton.style.display = 'none';
    }
  }

  changeSelectedObject(offset) {
    // Increment or decrement the current index
    this.currentObjectIndex += offset;

    // Ensure the index is within bounds
    if (this.currentObjectIndex < 0) {
      this.currentObjectIndex = this.spawnedObjects.length - 1;
    } else if (this.currentObjectIndex >= this.spawnedObjects.length) {
      this.currentObjectIndex = 0;
    }

    // Set the selected object based on the updated index
    this.selectedObject = this.spawnedObjects[this.currentObjectIndex];

    // Do something with the selectedObject (e.g., change its appearance, update UI, etc.)
    console.log('Selected Object:', this.selectedObject);
  }

  onClickShowReticle = () => {
    // Toggle the reticle visibility state
    this.reticleVisible = !this.reticleVisible;

    // Update button text based on reticle visibility
    const toggleReticleButton = document.getElementById('toggleReticleButton');
    toggleReticleButton.textContent = this.reticleVisible ? 'Hide ' : 'Show ';

    // Hide or show the reticle based on the updated visibility state
    this.reticle.visible = this.reticleVisible;

    if (this.reticleVisible) {
        // If reticle is visible, update its position
        const hitTestResults = this.xrSession.requestHitTestSource({ space: this.viewerSpace });
        if (hitTestResults.length > 0) {
            const hitPose = hitTestResults[0].getPose(this.localReferenceSpace);
            this.reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
            this.reticle.updateMatrixWorld(true);
        }
    }
}



  //Enable rotation and Scaling
  enableRotation(object) {
    let isScaling = false;
    let initialPinchDistance = 0;
    let previousTouchPosition = { x: 0, y: 0 };
    let scaleSensitivity = 0.008;
  
    const calculateDistance = (touches) => {
      const [touch1, touch2] = touches;
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
  
    const handleTouchStart = (event) => {
      if (event.touches.length === 2) {
        isScaling = true;
        initialPinchDistance = calculateDistance(event.touches);
      } else {
        isScaling = false;
        previousTouchPosition = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY
        };
      }
    };
  
    const handleTouchMove = (event) => {
      if (isScaling && event.touches.length === 2) {
        // Check if the current object matches the selected object
        if (object === this.selectedObject) {
          const currentPinchDistance = calculateDistance(event.touches);
          const distanceChange = currentPinchDistance - initialPinchDistance;
          const scaleFactor = object.scale.x * (1 + distanceChange * scaleSensitivity);
    
          object.scale.setScalar(scaleFactor);
          initialPinchDistance = currentPinchDistance;
        }
      } else if (event.touches.length === 1 && !isScaling) {
        // Apply rotation only to the selected object
        if (this.selectedObject) {
          const deltaMove = {
            x: event.touches[0].clientX - previousTouchPosition.x,
            y: event.touches[0].clientY - previousTouchPosition.y,
          };
    
          this.selectedObject.rotation.y += deltaMove.x * 0.01;
          this.selectedObject.rotation.x += deltaMove.y * 0.01;
        }
    
        previousTouchPosition = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY
        };
      }
    };
  
    const handleTouchEnd = () => {
      isScaling = false;
    };
  
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
  }

  /**
   * Called on the XRSession's requestAnimationFrame.
   * Called with the time and XRPresentationFrame.
   */
  onXRFrame = (time, frame) => {
    // Queue up the next draw request.
    this.xrSession.requestAnimationFrame(this.onXRFrame);

    // Bind the graphics framebuffer to the baseLayer's framebuffer.
    const framebuffer = this.xrSession.renderState.baseLayer.framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer)
    this.renderer.setFramebuffer(framebuffer);

    // Retrieve the pose of the device.
    // XRFrame.getViewerPose can return null while the session attempts to establish tracking.
    const pose = frame.getViewerPose(this.localReferenceSpace);
    if (pose) {
      // In mobile AR, we only have one view.
      const view = pose.views[0];

      const viewport = this.xrSession.renderState.baseLayer.getViewport(view);
      this.renderer.setSize(viewport.width, viewport.height)

      // Use the view's transform matrix and projection matrix to configure the THREE.camera.
      this.camera.matrix.fromArray(view.transform.matrix)
      this.camera.projectionMatrix.fromArray(view.projectionMatrix);
      this.camera.updateMatrixWorld(true);

      // Conduct hit test.
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);

      if (hitTestResults.length > 0) {
        const hitPose = hitTestResults[0].getPose(this.localReferenceSpace);

        // Update the reticle position
        this.reticle.visible = this.reticleVisible;;
        if (this.reticleVisible) {
          // Update the reticle position only if it should be visible
          this.reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
          this.reticle.updateMatrixWorld(true);
        }
        console.log("This is reticle");
      }

      // Render the scene with THREE.WebGLRenderer.
      this.renderer.render(this.scene, this.camera)
    }
  }

  /**
   * Initialize three.js specific rendering code, including a WebGLRenderer,
   * a demo scene, and a camera for viewing the 3D content.
   */
  setupThreeJs() {
    // To help with working with 3D on the web, we'll use three.js.
    // Set up the WebGLRenderer, which handles rendering to our session's base layer.
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true,
      canvas: this.canvas,
      context: this.gl
    });
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Initialize our demo scene.
    this.scene = DemoUtils.createLitScene();
    this.reticle = new Reticle();
    this.scene.add(this.reticle);

    // We'll update the camera matrices directly from API, so
    // disable matrix auto updates so three.js doesn't attempt
    // to handle the matrices independently.
    this.camera = new THREE.PerspectiveCamera();
    this.camera.matrixAutoUpdate = false;
  }
};

window.app = new App();
document.getElementById('nextButton').addEventListener('click', window.app.onClickNext);
document.getElementById('previousButton').addEventListener('click', window.app.onClickPrevious);