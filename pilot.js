import * as THREE from './three_js/build/three.module.js';
import {GLTFLoader} from './three_js/examples/jsm/loaders/GLTFLoader.js';
import Camera from './camera.js';

var DISABLE_DEACTIVATION = 4;
var CF_CHARACTER_OBJECT = 16;

class Pilot extends THREE.Object3D {

   constructor ({game, x, y, z, loadingManager, setCameraCallback, player}) {
      super ();
      this.game = game;
      this.player = player;
      if (this.player) {
         this.player.pilot = this;
      }
      this.position.x = x;
      this.position.y = y;
      this.position.z = z;
      this.active = false;
      this.index = 0;
      this.setCameraCallback = setCameraCallback;
      this.startWalkingCallback = null;
      this.stopWalkingCallback = null;
      this.enterVehicleCallback = null;
      this.exitVehicleCallback = null;
      this.updateNearbyVehiclesCallback = null;
      this.camera = new THREE.PerspectiveCamera(75, camera.aspect, 0.1, camera.far);
      this.camera.position.set(x, y, z-5);
      this.cameraHorizontalDistance = -5;
      this.cameraVerticalDistance = 0;
      this.camera.rotation.y = Math.PI;
      this.action = null;
      this.arrowUp = false;
      this.arrowDown = false;
      this.arrowLeft = false;
      this.arrowRight = false;
      this.vehiclesNearby = [];
      this.vehicle = null;
      this.btVectorWalkDirection = new Ammo.btVector3();
      this.btVectorAngularVelocity = new Ammo.btVector3();
      this.positionInVehicleSent = false;
      this.currentCheckpoint = 0;
      this.checkpointTimes = [];
      let pilot_object = this;

      this.contactResultCallback = new Ammo.ConcreteContactResultCallback ();
      this.contactResultCallback.addSingleResult = function (cp, colObj0Wrap, partId0, index0, colObj1Wrap, partId1, index1) {
         let manifoldPoint = Ammo.wrapPointer(cp, Ammo.btManifoldPoint);
         if (manifoldPoint.getDistance()>0) {
            return;
         }

         let collisionObjectWrapper1 = Ammo.wrapPointer (colObj1Wrap, Ammo.btCollisionObjectWrapper);
         let collisionObject1 = Ammo.castObject(collisionObjectWrapper1.getCollisionObject(), Ammo.btGhostObject);

         if (collisionObject1.type === "vehicle") {
            pilot_object.vehiclesNearby.push (collisionObject1.vehicle);
         }
      }

      var gltfLoader = new GLTFLoader(loadingManager);

      gltfLoader.load("gltf/pilot.gltf", function(gltf) {
         pilot_object.gltf = gltf;
         if (pilot_object.game) {
            pilot_object.addCharacterController ();
            pilot_object.initKeyboardMappingPanel ();
         }
         pilot_object.animationMixer = new THREE.AnimationMixer(gltf.scene);
         pilot_object.add (gltf.scene);
         pilot_object.animate_time = null;
         if (pilot_object.player) {
            pilot_object._addTextUsername();
         }
         gltf.scene.traverse (function (object) {
            if (object instanceof THREE.SkinnedMesh) {
               object.castShadow = true;
            }
         });
         pilot_object.setAnimation ("standing", false);
      }, 
      function (xhr) {
         console.log("object: "+( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      function (error) {
         console.error (error);
      });
   }

   _drawText (context, text, x, y) {
      context.fillText (text, x, y);
      context.strokeText (text, x, y);
   }

   _addTextUsername () {
      let canvasUsername = document.createElement ("canvas");
      let canvasUsernameContext = canvasUsername.getContext ("2d");
      canvasUsername.height = 5;
      let username = this.player.username;
      canvasUsername.height = 35;
      canvasUsernameContext.font = "32px sans-serif";
      canvasUsername.width = canvasUsernameContext.measureText(username).width+3;
      canvasUsernameContext.font = "32px sans-serif";
      var texture = new THREE.CanvasTexture(canvasUsername);
      texture.minFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      canvasUsernameContext.strokeStyle = "rgba(0, 0, 0, 0.75)";
      canvasUsernameContext.fillStyle = "rgba(255, 255, 255, 0.75)";
      this._drawText (canvasUsernameContext, username, 0, 25);
      let material = new THREE.SpriteMaterial ({map: texture, transparent: true});
      this.spriteUsername = new THREE.Sprite(material);
      this.spriteUsername.position.set(0, 2, 0);
      let scale = 0.5;
      this.spriteUsername.scale.set(scale*canvasUsername.width/canvasUsername.height, scale, 1);
      this.add(this.spriteUsername);
   }

   initKeyboardMappingPanel () {
      let width = 250;
      let height = 350;
      let mapGeometry = new THREE.PlaneGeometry (0.075, 0.075*height/width);
      this.canvasKeyboardMapping = document.createElement ("canvas");
      this.keyboardMappingPanelWidth = width;
      this.keyboardMappingPanelHeight = height;
      this.canvasKeyboardMapping.width = width;
      this.canvasKeyboardMapping.height = height;
      this.canvasKeyboardMappingContext = this.canvasKeyboardMapping.getContext ("2d");

      var texture = new THREE.CanvasTexture (this.canvasKeyboardMapping);
      this.keyboardMappingTexture = texture;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      let mapMaterial = new THREE.MeshBasicMaterial ({map: texture, transparent: true});
      this.keyboardMappingPanel = new THREE.Mesh (mapGeometry, mapMaterial);
      this.camera.add (this.keyboardMappingPanel);

      this.keyboardMappingPanel.position.x = -0.15;
      this.keyboardMappingPanel.position.y = 0.0;
      this.keyboardMappingPanel.position.z = -0.15;
      this.keyboardMappingPanel.rotation.x = 0;

      this.keyboardMappingPanelTime = 0;
      this.updateKeyboardMappingPanel (window.performance.now ());
   }

   updateKeyboardMappingPanel (time) {

      if (time-this.keyboardMappingPanelTime<500) {
         return;
      }
      this.keyboardMappingPanelTime = time;

      let transform = this.ghostObjectSphere.getWorldTransform()
      transform.getOrigin().setValue(this.position.x, this.position.y, this.position.z);
      this.ghostObjectSphere.setWorldTransform (transform);
      this.vehiclesNearby = [];
      this.game.physicsWorld.contactTest (this.ghostObjectSphere, this.contactResultCallback);
      this.vehiclesNearby.sort((obj1, obj2)=> {
         if (obj1.vehicleName>obj2.vehicleName) {
            return 1;
         }
         if (obj1.vehicleName<obj2.vehicleName) {
            return -1;
         }
         return 0;
      });
      let width = this.keyboardMappingPanelWidth;
      let height = this.keyboardMappingPanelHeight;
      this.canvasKeyboardMappingContext.clearRect (0, 0, width, height);

      this.canvasKeyboardMappingContext.font = "32px sans-serif";
      this.canvasKeyboardMappingContext.strokeStyle = "rgba(0, 0, 0, 0.75)";
      this.canvasKeyboardMappingContext.fillStyle = "rgba(255, 255, 255, 0.75)";

      if (this.vehiclesNearby.size==0) {
         this.keyboardMappingTexture.needsUpdate = true;
         return;
      }

      if (this.updateNearbyVehiclesCallback) {
         this.updateNearbyVehiclesCallback(this.vehiclesNearby);
         return;
      }

      let index = 0;
      for (let vehicle of this.vehiclesNearby) {
         let text = index+" "+vehicle.vehicleName;
         this._drawText (this.canvasKeyboardMappingContext, text, 5, 25+index*30);
         index++;
      }
      this.keyboardMappingTexture.needsUpdate = true;
   }

   updateKeyboardMappingPanelClient (airplaneIndices, carIndices) {
      this.vehiclesNearby = [];

      if (!this.canvasKeyboardMappingContext) {
         return;
      }

      for (let airplaneIndex of airplaneIndices) {
         this.vehiclesNearby.push (this.game.airplanes[airplaneIndex]);
      }

      for (let carIndex of carIndices) {
         this.vehiclesNearby.push (this.game.cars[carIndex]);
      }

      this.vehiclesNearby.sort((obj1, obj2)=> {
         if (obj1.vehicleName>obj2.vehicleName) {
            return 1;
         }
         if (obj1.vehicleName<obj2.vehicleName) {
            return -1;
         }
         return 0;
      });

      let width = this.keyboardMappingPanelWidth;
      let height = this.keyboardMappingPanelHeight;
      this.canvasKeyboardMappingContext.clearRect (0, 0, width, height);

      this.canvasKeyboardMappingContext.font = "32px sans-serif";
      this.canvasKeyboardMappingContext.strokeStyle = "rgba(0, 0, 0, 0.75)";
      this.canvasKeyboardMappingContext.fillStyle = "rgba(255, 255, 255, 0.75)";

      let index = 0;
      for (let vehicle of this.vehiclesNearby) {
         let text = index+" "+vehicle.vehicleName;
         this._drawText (this.canvasKeyboardMappingContext, text, 5, 25+index*30);
         index++;
      }
      this.keyboardMappingTexture.needsUpdate = true;
   }

   enterVehicle (index) {
      this.arrowUp = false;
      this.arrowDown = false;
      this.arrowLeft = false;
      this.arrowRight = false;
      this.stopAnimation();
      let vehicles = Array.from (this.vehiclesNearby);
      if (index>=vehicles.length) {
         return;
      }

      let vehicle = vehicles[index];
      if (vehicle.pilot) {
         return;
      }
      this.vehicle = vehicle;
      this.setSittingAnimation ();
      this.game.physicsWorld.removeCollisionObject (this.ghostObject);
      this.game.physicsWorld.removeAction (this.characterController);
      scene.remove (this);
      this.rotation.set (0, 0, 0);
      this.position.copy (this.vehicle.pilotPosition);
      this.vehicle.add (this);
      this.vehicle.pilot = this;
      index = this.game.rigidBodies.indexOf (this);
      if (index !== -1) {
         this.game.rigidBodies.splice (index, 1);
      }

      if (this.enterVehicleCallback) {
         this.positionInVehicleSent = false;
         this.enterVehicleCallback(this.vehicle);
         if (this.index != 0) {
            this.vehicle.setActive (true, false);
            return;
         }
      }
      this.vehicle.setActive (true);
   }

   exitVehicle () {

      this.position.x = 2.5;
      this.vehicle.localToWorld (this.position);
      let transform = this.ghostObject.getWorldTransform ();
      transform.getOrigin().setValue (this.position.x, this.position.y, this.position.z);

      this.vehicle.updateMatrixWorld ();
      let elements = this.vehicle.matrixWorld.elements;
      this.rotation.y = Math.atan2 (elements[8], elements[10]);

      let quaternion = this.quaternion;
      transform.setRotation(new Ammo.btQuaternion (quaternion.x, quaternion.y, quaternion.z, quaternion.w));
      this.ghostObject.setWorldTransform (transform);
      this.vehicle.remove (this);
      this.vehicle.pilot = null;
      scene.add (this);
      this.game.rigidBodies.push (this);
      this.action.stop ();

      let STATIC_FILTER = 1;
      let KINEMATIC_FILTER = 2;
      this.game.physicsWorld.addCollisionObject (this.ghostObject, STATIC_FILTER, STATIC_FILTER | KINEMATIC_FILTER);
      this.game.physicsWorld.addAction (this.characterController);

      Camera.updateCameraBehindObject(this.game.physicsWorld, this.vehicle, this.camera);

      if (this.exitVehicleCallback) {
         this.exitVehicleCallback();
         if (this.index != 0) {
            this.vehicle.setActive (false, false);
            this.vehicle = null;
            return;
         }
      }
      this.vehicle.setActive (false);
      this.setActive (true);
      this.vehicle = null;
   }

   keyDown (event) {
      this.keyDownString(event.key);
   }

   setWalkingAnimation () {
      this.setAnimation ("walking", true, 1);
   }

   setSittingAnimation () {
      this.setAnimation ("sitting", false);
   }

   stopWalkingAnimation () {
      this.setAnimation ("standing", false, 1);
   }

   stopAnimation () {
      this.action.stop ();
   }

   setStartWalkingCallback (startWalkingCallback) {
      this.startWalkingCallback = startWalkingCallback;
   }

   setStopWalkingCallback (stopWalkingCallback) {
      this.stopWalkingCallback = stopWalkingCallback;
   }

   setEnterVehicleCallback (enterVehicleCallback) {
      this.enterVehicleCallback = enterVehicleCallback;
   }

   setUpdateNearbyVehiclesCallback (updateNearbyVehiclesCallback) {
      this.updateNearbyVehiclesCallback = updateNearbyVehiclesCallback;
   }

   setExitVehicleCallback (exitVehicleCallback) {
      this.exitVehicleCallback = exitVehicleCallback;
   }

   keyDownString (key) {
      switch (key) {
         case "ArrowUp":
            if (!this.arrowUp) {
               this.setWalkingAnimation ();
               if (this.startWalkingCallback) {
                  this.startWalkingCallback();
               }
               this.arrowUp = true;
            }
            break;
         case "ArrowDown":
            this.arrowDown = true;
            break;
         case "ArrowLeft":
            this.arrowLeft = true;
            break;
         case "ArrowRight":
            this.arrowRight = true;
            break;
         case " ":
            if (this.characterController.onGround ()) {
               this.characterController.jump();
            }
            break;
      }
   }

   keyUp (event) {
      this.keyUpString (event.key);
   }

   keyUpString (key) {

      if (key.length===1) {
         let pressedChar = key.charAt(0);
         if (pressedChar>='0' && pressedChar<='9') {
            let index = parseInt (key);
            this.enterVehicle (index);
            return;
         }
      }

      switch (key) {
         case "ArrowUp":
            this.arrowUp = false;
            this.stopWalkingAnimation ();
            if (this.stopWalkingCallback) {
               this.stopWalkingCallback();
            }
            break;
         case "ArrowDown":
            this.arrowDown = false;
         case "ArrowLeft":
            this.arrowLeft = false;
            break;
         case "ArrowRight":
            this.arrowRight = false;
            break;
      }
   }

   setActive (active) {
      this.active = active;
      if (active) {
         scene.add(this.camera);
         this.setCameraCallback (this.camera);
      }
      else {
         scene.remove(this.camera);
         this.setCameraCallback ();
      }
   }

   _createGhostObjectSphere (radius) {
      var transform = new Ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(new Ammo.btVector3(this.position.x, this.position.y, this.position.z));
      var sphereShape = new Ammo.btSphereShape(radius);
      var ghostObject = new Ammo.btGhostObject();
      ghostObject.setCollisionShape (sphereShape);
      let CF_NO_CONTACT_RESPONSE = 4;
      ghostObject.setCollisionFlags (CF_NO_CONTACT_RESPONSE);
      ghostObject.setWorldTransform (transform);
      this.ghostObjectSphere = ghostObject;
      this.game.physicsWorld.addCollisionObject (ghostObject);
   }

   addCharacterController () {
      let transform = new Ammo.btTransform ();
      transform.setIdentity ();
      transform.setOrigin (new Ammo.btVector3 (this.position.x, this.position.y, this.position.z));
      transform.setRotation (new Ammo.btQuaternion (this.quaternion.x, this.quaternion.y, this.quaternion.z, this.quaternion.w));
      let box3 = new THREE.Box3().setFromObject (this.gltf.scene);
      let radius = 0.5*Math.max (box3.max.x-box3.min.x, box3.max.z-box3.min.z);
      radius = 0.35;
      let height = box3.max.y-box3.min.y;
      this.gltf.scene.position.y = -0.5*height;
      let shape = new Ammo.btCapsuleShape (radius, 0.5*height);
      let ghostObject = new Ammo.btPairCachingGhostObject ();
      this.ghostObject = ghostObject;
      ghostObject.setCollisionShape (shape);
      ghostObject.setCollisionFlags (ghostObject.getCollisionFlags () | CF_CHARACTER_OBJECT);
      ghostObject.setActivationState (DISABLE_DEACTIVATION);
      ghostObject.activate (true);
      this.characterController = new Ammo.btKinematicCharacterController (ghostObject, shape, 0.25, new Ammo.btVector3 (0, 1, 0));
      ghostObject.setWorldTransform (transform);
      this.characterController.setUseGhostSweepTest (true);
//      this.characterController.setGravity (new Ammo.btVector3 (0, 9.81, 0));
      this.game.rigidBodies.push (this);
      this.collisionObject = ghostObject;
      this._createGhostObjectSphere (5);
      let STATIC_FILTER = 1;
      let KINEMATIC_FILTER = 2;
      this.game.physicsWorld.addCollisionObject (ghostObject, STATIC_FILTER, STATIC_FILTER | KINEMATIC_FILTER);
      this.game.physicsWorld.addAction (this.characterController);
   }

   setAnimation (animationName, loop=true, fadeInSeconds=0) {
      const animation = THREE.AnimationClip.findByName (this.gltf.animations, animationName);
      let lastAction = this.action;
      this.action = this.animationMixer.clipAction(animation);
      if (!loop) {
         this.action.loop = THREE.LoopOnce;
         this.action.clampWhenFinished = true;
      }
      this.action.reset ();
      this.action.play ();
      if (fadeInSeconds>0) {
         lastAction.crossFadeTo (this.action, fadeInSeconds);
      }
   }

   animateClient (interval) {
      this.animationMixer.update (2*interval);
      if (this.active) {
         Camera.updateCameraBehindObject(this.game.physicsWorld, this, this.camera);
         let time = window.performance.now ();
      }
   }

   animate (interval, fixedTimeStep, steps, active) {

      if (this.animationMixer) {
         this.animationMixer.update (2*interval);
      }

      if (!active || !this.characterController) {
         return;
      }

      if (!this.characterController.onGround ()) {
         return;
      }

      let time = window.performance.now ();
      this.updateKeyboardMappingPanel (time);

      let speed = 5.0;
      let angularSpeed = 100;
      if (this.arrowUp) {
         var elements = this.matrixWorld.elements;
         speed = speed*fixedTimeStep;
         this.btVectorWalkDirection.setValue (speed*elements[8], speed*elements[9], speed*elements[10]);
      }
      else {
         this.btVectorWalkDirection.setValue(0, 0, 0);
      }
      this.characterController.setWalkDirection (this.btVectorWalkDirection);

      if (this.arrowLeft && this.arrowRight ||
          !this.arrowLeft && !this.arrowRight) {
         this.btVectorAngularVelocity.setValue(0, 0, 0);
      }
      else if (this.arrowLeft) {
         this.btVectorAngularVelocity.setValue(0, angularSpeed*fixedTimeStep, 0);
      }
      else if (this.arrowRight) {
         this.btVectorAngularVelocity.setValue(0, -angularSpeed*fixedTimeStep, 0);
      }
      this.characterController.setAngularVelocity (this.btVectorAngularVelocity);
      Camera.updateCameraBehindObject(this.game.physicsWorld, this, this.camera);
   }
}

export default Pilot;