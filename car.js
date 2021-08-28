/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';
import {GLTFLoader} from './three_js/examples/jsm/loaders/GLTFLoader.js';
import {EngineSoundGenerator} from './sound/sound_generator_worklet.js';
import Engine from './engine.js';
import Vehicle from './vehicle.js';

var DISABLE_DEACTIVATION = 4;

var DefaultFilter = 1;
var StaticFilter = 2;
var AllFilter = -1;
var RigidBodyFilter = 64;

class Car extends Vehicle {

   constructor ({game, x, y, z, rotationX = 0, rotationY = 0, rotationZ = 0, loadingManager, setCameraCallback, hasSpotLights = false, vehicleName = "car", color}) {
      super ();
      this.vehicleName = vehicleName;
      this.color = color;
      this.setCameraCallback = setCameraCallback;
      this.hasSpotLights = hasSpotLights;
      this.game = game;
      this.maxEngineForce = 10000;
      this.maxBrakeTorque = 50;
      this.pilotPosition = new THREE.Vector3 (0.530666, 1.2, -0.097812);
      this.startPosition = new THREE.Vector3 (x, y, z);
      this.startRotation = new THREE.Euler (rotationX, rotationY, rotationZ);
      this.lastPositionOnGround.copy(this.startPosition);
      this.lastRotationOnGround.copy(this.startRotation);
      this._position = new THREE.Vector3();
      this._localVelocity = new THREE.Vector3();
      this._matrix4d = new THREE.Matrix4();
      this.velocity = new THREE.Vector3();
      this.angularVelocity = new THREE.Vector3();
      this.cameraIndex = 0;
      this.updateCameraBehindVehicle = true;
      this.toggleLightsCallback = null;
      this.toggleBrakingLightsCallback = null;
      this.toggleReverseGearLightCallback = null;
      this.areLightsOn = false;
      this.areBrakingLightsOn = false;
      this.isReverseGearLightOn = false;
      this.cameras = [];

      let carObject = this;

      this.engine = new Engine ();
      if (!loadingManager) {
         this.engineSoundGenerator = new EngineSoundGenerator({listener: soundGeneratorAudioListener, parameters: {cylinders: 4,

                                    intakeWaveguideLength: 100,
                                    exhaustWaveguideLength: 100,
                                    extractorWaveguideLength: 100,

                                    intakeOpenReflectionFactor: 0.01,
                                    intakeClosedReflectionFactor: 0.95,

                                    exhaustOpenReflectionFactor: 0.01,
                                    exhaustClosedReflectionFactor: 0.95,
                                    ignitionTime: 0.016,

                                    straightPipeWaveguideLength: 128,
                                    straightPipeReflectionFactor: 0.01,

                                    mufflerElementsLength: [10, 15, 20, 25],
                                    action: 0.1,

                                    outletWaveguideLength: 5,
                                    outletReflectionFactor: 0.01}});
         this.add (this.engineSoundGenerator);
         this.gainIntake = this.engineSoundGenerator.gainIntake.gain;
         this.gainEngineBlockVibrations = this.engineSoundGenerator.gainEngineBlockVibrations.gain;
         this.gainOutlet = this.engineSoundGenerator.gainOutlet.gain;
         this.rpmParam = this.engineSoundGenerator.worklet.parameters.get('rpm');
      }

      if (Car.gltfCar !== null) {
         this.clone ();
      }
      else if (loadingManager) {
         var gltfLoader = new GLTFLoader(loadingManager);

         gltfLoader.load("gltf/car.gltf", function(gltf) {
            Car.gltfCar = gltf;
         },
         function (xhr) {
//            console.log("object: "+( xhr.loaded / xhr.total * 100 ) + '% loaded' );
         },
         function (error) {
            console.error (error);
         });
         return;
      }
      else {
         throw new Error ("A THREE.LoadingManager needs to be passed as argument to load the object.");
      }

      var width = 2.05;
      var height = 1.275;
      var length = 3.85;
      this.mass = 1000;
      this.wheelRadius = 0.375;
      this.wheelRevsPerSecond = [0, 0, 0, 0];
      var wheelWidth = 0.15;

      this.FRONT_LEFT_WHEEL = 0;
      this.FRONT_RIGHT_WHEEL = 1;
      this.BACK_LEFT_WHEEL = 2;
      this.BACK_RIGHT_WHEEL = 3;
      this.max_steering = 0.35*Math.PI;
      this.steering_wheel_rotations = 1.5;

      y += 0.5*height+0.5;

      this.position.set (x, y, z);
      this.rotation.set (rotationX, rotationY, rotationZ);

      var geometry = new Ammo.btBoxShape (new Ammo.btVector3(0.5*width, 0.5*height, 0.5*length));

      var compoundShape = new Ammo.btCompoundShape();
      let transform = new Ammo.btTransform ();
      transform.setIdentity ();
      transform.setOrigin (new Ammo.btVector3 (0, 1.25, 0));
      compoundShape.addChildShape(transform, geometry);

      transform = new Ammo.btTransform ();
      transform.setIdentity ();
      transform.setOrigin (new Ammo.btVector3 (x, y, z));
      transform.setRotation (new Ammo.btQuaternion (this.quaternion.x,
                                                    this.quaternion.y,
                                                    this.quaternion.z,
                                                    this.quaternion.w));

      var motionState = new Ammo.btDefaultMotionState (transform);
      var localInertia = new Ammo.btVector3 (0, 0, 0);
      compoundShape.calculateLocalInertia (this.mass, localInertia);
      var body = new Ammo.btRigidBody (new Ammo.btRigidBodyConstructionInfo (this.mass, motionState, compoundShape, localInertia));
      body.type = "car";
      body.object3d = this;
      body.setActivationState (DISABLE_DEACTIVATION);
      game.physicsWorld.addRigidBody (body, DefaultFilter | RigidBodyFilter, AllFilter);

      let radius = 5;
      this._createGhostObjectSphere (radius);

      var tuning = new Ammo.btVehicleTuning ();
      var vehicleRaycaster = new Ammo.btDefaultVehicleRaycaster (game.physicsWorld);
      var vehicle = new Ammo.btRaycastVehicle (tuning, body, vehicleRaycaster);
      vehicle.setCoordinateSystem(0, 1, 2);

      this.addWheel (this, vehicle, tuning,
                     this.frontWheelLeft.position.x, 0.3+1.25, this.frontWheelLeft.position.z,
                     this.wheelRadius, wheelWidth, this.FRONT_LEFT_WHEEL, true, this.frontWheelLeft);
      this.addWheel (this, vehicle, tuning,
                     this.frontWheelRight.position.x, 0.3+1.25, this.frontWheelRight.position.z,
                     this.wheelRadius, wheelWidth, this.FRONT_RIGHT_WHEEL, true, this.frontWheelRight);
      this.addWheel (this, vehicle, tuning,
                     this.rearWheelLeft.position.x, 0.3+1.25, this.rearWheelLeft.position.z,
                     this.wheelRadius, wheelWidth, this.REAR_LEFT_WHEEL, false, this.rearWheelLeft);
      this.addWheel (this, vehicle, tuning,
                     this.rearWheelRight.position.x, 0.3+1.25, this.rearWheelRight.position.z,
                     this.wheelRadius, wheelWidth, this.REAR_RIGHT_WHEEL, false, this.rearWheelRight);

      game.physicsWorld.addAction (vehicle);

      this.rigidBody = body;
      this.raycastVehicle = vehicle;
      game.rigidBodies.push (this);

      this.steering = 0;
      this.throttle = 0;
      this.reverseGear = false;
      this.brakesTorque = 0;
      this.arrowUp = false;
      this.arrowDown = false;
      this.arrowLeft = false;
      this.arrowRight = false;

      this.raycastVehicle.setBrake(50, this.BACK_LEFT_WHEEL);
      this.raycastVehicle.setBrake(50, this.BACK_RIGHT_WHEEL);
   }

   clone () {
      let obj = Car.gltfCar.scene.clone ();
      let carObject = this;
      var carObjects3d = [];
      this.boundingBoxes = [];

      obj.traverse (function (object) {
//         console.log (object.name);
         if (object.material) {
            if (object.material.name === "car_material") {
               if (!carObject.carMaterial) {
                  carObject.carMaterial = object.material.clone ();
                  if (carObject.color) {
                     carObject.carMaterial.color = carObject.color;
                  }
               }
               object.material = carObject.carMaterial;
            }
            else if (object.material.name === "front_lights_material") {
               if (!carObject.frontLightsMaterial) {
                  carObject.frontLightsMaterial = object.material.clone ();
                  carObject.frontLightsMaterial.emissiveIntensity = 0;
               }
               object.material = carObject.frontLightsMaterial;
            }
            else if (object.material.name === "braking_light_material") {
               if (!carObject.brakingLightMaterial) {
                  carObject.brakingLightMaterial = object.material.clone ();
                  carObject.brakingLightMaterial.emissiveIntensity = 0;
               }
               object.material = carObject.brakingLightMaterial;
            }
            else if (object.material.name === "tail_light_material") {
               if (!carObject.tailLightMaterial) {
                  carObject.tailLightMaterial = object.material.clone ();
                  carObject.tailLightMaterial.emissiveIntensity = 0;
               }
               object.material = carObject.tailLightMaterial;
            }
            else if (object.material.name === "reversing_light_material") {
               if (!carObject.reversingLightMaterial) {
                  carObject.reversingLightMaterial = object.material.clone ();
                  carObject.reversingLightMaterial.emissiveIntensity = 0;
               }
               object.material = carObject.reversingLightMaterial;
            }
         }

         let setReceiveShadow = (object) => {
            if (object instanceof THREE.Mesh) {
               object.receiveShadow = true;
            }
            else {
               for (let i=0; i<object.children.length; i++) {
                  object.children[i].receiveShadow = true;
               }
            }
         };

         switch (object.name) {
            case "car":
               for (let i=0; i<object.children.length; i++) {
                  object.children[i].castShadow = true;
               }
               setReceiveShadow(object);
               break;
            case "bottom_side":
               object.castShadow = true;
               setReceiveShadow(object);
               break;
            case "front_light_left":
               if (carObject.hasSpotLights) {
                  const spotLight = new THREE.SpotLight (0xffffff, 3, 250, 0.75, 0.5, 2);
                  carObject.spotLightLeft = spotLight;
                  spotLight.target = new THREE.Object3D();
                  spotLight.target.position.set (0, 0, 75);
                  spotLight.target.updateMatrixWorld();
                  spotLight.visible = false;
                  object.add (spotLight.target);
                  object.add (spotLight);
               }
               object.receiveShadow = true;
               break;
            case "front_light_right":
               if (carObject.hasSpotLights) {
                  const spotLight = new THREE.SpotLight (0xffffff, 3, 250, 0.75, 0.5, 2);
                  carObject.spotLightRight = spotLight;
                  spotLight.target = new THREE.Object3D();
                  spotLight.target.position.set (0, 0, 75);
                  spotLight.target.updateMatrixWorld();
                  spotLight.visible = false;
                  object.add (spotLight.target);
                  object.add (spotLight);
               }
               object.receiveShadow = true;
               break;
            case "front_wheel_left":
               carObject.frontWheelLeft = object;
               object.castShadow = true;
               object.receiveShadow = true;
               break;
            case "front_wheel_right":
               carObject.frontWheelRight = object;
               object.castShadow = true;
               object.receiveShadow = true;
               break;
            case "rear_wheel_left":
               carObject.rearWheelLeft = object;
               object.castShadow = true;
               object.receiveShadow = true;
               break;
            case "rear_wheel_right":
               carObject.rearWheelRight = object;
               object.castShadow = true;
               object.receiveShadow = true;
               break;
            case "speedometer_pointer":
               carObject.speedometerPointer = object;
               carObject.speedometerPointerStartRotationZ = object.rotation.z;
               break;
            case "tachometer_pointer":
               carObject.tachometerPointer = object;
               carObject.tachometerPointerStartRotationZ = object.rotation.z;
               break;
            case "steering_wheel":
               carObject.steeringWheel = object;
               break;
            case "door_left":
            case "door_right":
               for (let i=0; i<object.children.length; i++) {
                  object.children[i].castShadow = true;
               }
            case "rear_lights_left":
            case "rear_lights_right":
            case "front_seat_left":
            case "front_seat_right":
            case "rear_seat":
               setReceiveShadow(object);
               break;
            default:
               carObjects3d.push (object);
         }

         if (object.name.startsWith ("Camera") && object.name.endsWith ("Orientation")) {
            object.far = 4500;
            object.updateProjectionMatrix();
            carObject.cameras.push (object);
         }
         else if (object.name.startsWith ("boundingbox")) {
            carObject.boundingBoxes.push (object);
         }
      });

      this.tailLightMaterial.emissiveIntensity = 0;
      this.brakingLightMaterial.emissiveIntensity = 0;
      this.reversingLightMaterial.emissiveIntensity = 0;

      obj.position.y = 0.485;
      obj.remove (...carObject.boundingBoxes);
      this.add (obj);
   }

   disposeObjects () {
      this.engineSoundGenerator.stop ();
   }

   /*
    * Sets whether the car is controlled by the user.
    * The second parameter is used to specify
    * whether the camera needs to be updated
    * when setting to active.
    * When the "active" paramater is false,
    * the handbrake is also set.
    */
   setActive (active, updateCamera=true) {
      if (active) {
         if (updateCamera) {
            this.updateCameraBehindVehicle = true;
            this.cameraIndex = 0;
            this.setCameraCallback ();
         }

         let gainNode = this.engineSoundGenerator.gain;
         gainNode.gain.value = 0.5;
         this.updateGainValues ();
         this.engineSoundGenerator.play();
         this.engine.start ();
      }
      else {
         this.throttle = 0;
         this.arrowUp = false;
         this.arrowDown = false;
         this.arrowLeft = false;
         this.arrowRight = false;
         this.reverseGear = false;
         if (this.hasSpotLights) {
            this.spotLightLeft.visible = false;
            this.spotLightRight.visible = false;
            this.frontLightsMaterial.emissiveIntensity = 0;
         }
         this.brakingLightMaterial.emissiveIntensity = 0;
         this.tailLightMaterial.emissiveIntensity = 0;
         this.reversingLightMaterial.emissiveIntensity = 0;
         this.raycastVehicle.setBrake(50, this.BACK_LEFT_WHEEL);
         this.raycastVehicle.setBrake(50, this.BACK_RIGHT_WHEEL);

         this.areLightsOn = false;
         this.areBrakingLightsOn = false;
         this.isReverseGearLightOn = false;
         this.tailLightMaterial.emissiveIntensity = 0;
         this.brakingLightMaterial.emissiveIntensity = 0;
         this.reversingLightMaterial.emissiveIntensity = 0;

         this.engineSoundGenerator.stop ();
         this.engine.starting = false;
         this.engine.started = false;
      }
   }

   setToggleLightsCallback (toggleLightsCallback) {
      this.toggleLightsCallback = toggleLightsCallback;
   }

   setToggleBrakingLightsCallback (toggleBrakingLightsCallback) {
      this.toggleBrakingLightsCallback = toggleBrakingLightsCallback;
   }

   setToggleReverseGearLightCallback (toggleReverseGearLightCallback) {
      this.toggleReverseGearLightCallback = toggleReverseGearLightCallback;
   }

   keyDown (event) {
      this.keyDownString(event.key);
   }

   keyDownString (key) {
      switch (key) {
         case "ArrowUp":
            this.arrowUp = true;
            break;
         case "ArrowDown":
            if (!this.arrowDown) {
               this.toggleBrakingLights();
            }
            this.arrowDown = true;
            break;
         case "ArrowLeft":
            this.arrowLeft = true;
            break;
         case "ArrowRight":
            this.arrowRight = true;
            break;
         case "r":
            if (!this.reverseGear) {
               this.throttle = 0;
               this.reverseGear = true;
               this.toggleReverseGearLight ();
            }
            break;
      }
   }

   keyUp (event) {
      this.keyUpString(event.key);
   }

   keyUpString (key) {
      switch (key) {
         case "ArrowUp":
            this.arrowUp = false;
            break;
         case "ArrowDown":
            this.toggleBrakingLights();
            this.arrowDown = false;
            break;
         case "ArrowLeft":
            this.arrowLeft = false;
            break;
         case "ArrowRight":
            this.arrowRight = false;
            break;
         case "c":
            this.cameraIndex++;
            if (this.cameraIndex > this.cameras.length) {
               this.cameraIndex = 0;
            }
            this.updateGainValues ();
            if (this.cameraIndex == 0) {
               this.updateCameraBehindVehicle = true;
               this.setCameraCallback ();
            }
            else {
               this.updateCameraBehindVehicle = false;
               this.cameras[0].position.y = -0.1;
               this.setCameraCallback (this.cameras[this.cameraIndex-1]);
            }
            break;
         case "l":
            this.toggleLights ();
            break;
         case "r":
            this.throttle = 0;
            this.toggleReverseGearLight ();
            this.reverseGear = false;
            break;
         case "s":
            this.resetTransform ();
            break;
      }
   }

   /*
    * Updates the gain values of the engine sound generator depending
    * on the current camera.
    */
   updateGainValues () {
      if (this.cameraIndex === 0) {
               this.gainIntake.value = 1.0;
               this.gainEngineBlockVibrations.value = 1.0;
               this.gainOutlet.value = 1.0;
      }
      else {
               this.gainIntake.value = 0.1;
               this.gainEngineBlockVibrations.value = 1.0;
               this.gainOutlet.value = 1.0;
      }
   }

   toggleLights () {

      if (this.toggleLightsCallback) {
         this.toggleLightsCallback(this.index);
      }

      if (!this.areLightsOn) {
         this.tailLightMaterial.emissiveIntensity = 0.5;
         this.brakingLightMaterial.emissiveIntensity += 0.5;
      }
      else {
         this.tailLightMaterial.emissiveIntensity = 0;
         this.brakingLightMaterial.emissiveIntensity -= 0.5;
      }
      this.areLightsOn = !this.areLightsOn;

      if (this.hasSpotLights) {
         this.spotLightLeft.visible = this.areLightsOn;
         this.spotLightRight.visible = this.areLightsOn;
         this.frontLightsMaterial.emissiveIntensity = this.areLightsOn ? 1 : 0;
      }
   }

   toggleBrakingLights () {

      if (this.toggleBrakingLightsCallback) {
         this.toggleBrakingLightsCallback(this.index);
      }

      if (!this.areBrakingLightsOn) {
         this.brakingLightMaterial.emissiveIntensity += 0.5;
      }
      else {
         this.brakingLightMaterial.emissiveIntensity -= 0.5;
      }
      this.areBrakingLightsOn = !this.areBrakingLightsOn;
   }

   toggleReverseGearLight () {

      if (this.toggleReverseGearLightCallback) {
         this.toggleReverseGearLightCallback(this.index);
      }

      if (!this.isReverseGearLightOn) {
         this.reversingLightMaterial.emissiveIntensity = 1;
      }
      else {
         this.reversingLightMaterial.emissiveIntensity = 0;
      }
      this.isReverseGearLightOn = !this.isReverseGearLightOn;
   }

   addWheel (vehicleScene, vehicle, tuning, x, y, z, radius, width, index, isFrontWheel, wheel) {
      var connectionPointCS0 = new Ammo.btVector3 (x, y, z);
      var wheelDirectionCS0 = new Ammo.btVector3 (0, -1, 0);
      var wheelAxleCS = new Ammo.btVector3 (-1, 0, 0);
      var suspensionRestLength = 1.25;
      var wheelInfo = vehicle.addWheel (connectionPointCS0,
                                        wheelDirectionCS0,
                                        wheelAxleCS,
                                        suspensionRestLength,
                                        radius,
                                        tuning,
                                        isFrontWheel);

      if (!wheel) {
         var wheelGeometry = new THREE.CylinderBufferGeometry (radius, radius, width, 32);
         wheelGeometry.rotateZ (Math.PI/2);
         wheel = new THREE.Mesh (wheelGeometry, new THREE.MeshPhongMaterial({color: 0x000000}));
         wheel.position.x = x;
         wheel.position.y = y;
         wheel.position.z = z;
      }

      let suspensionStiffness = 100;
      let suspensionDamping = 1000;
      let suspensionCompression = 100;
      let rollInfluence = 0.01;
      let friction = 100;

      wheelInfo.set_m_maxSuspensionForce(this.mass*9.81);
      wheelInfo.set_m_maxSuspensionTravelCm(75);
      wheelInfo.set_m_suspensionStiffness(suspensionStiffness);
      wheelInfo.set_m_wheelsDampingCompression(suspensionCompression);
      wheelInfo.set_m_wheelsDampingRelaxation(suspensionDamping);
      wheelInfo.set_m_frictionSlip(friction);
      wheelInfo.set_m_rollInfluence(rollInfluence);

      this.wheels.push (wheel);
      scene.add (wheel);
   }

   resetTransform () {
      this.game.physicsWorld.removeAction (this.vehicle);
      this.game.physicsWorld.removeRigidBody (this.rigidBody);
      let transform = this.rigidBody.getWorldTransform()
      transform.getOrigin().setValue(this.lastPositionOnGround.x, this.lastPositionOnGround.y+1, this.lastPositionOnGround.z);
      this.rotation.copy (this.lastRotationOnGround);
      let quaternion = this.quaternion;
      Ammo.destroy (transform.getRotation());
      transform.setRotation(new Ammo.btQuaternion (quaternion.x, quaternion.y, quaternion.z, quaternion.w));
      this.rigidBody.getLinearVelocity().setValue (0, 0, 0);
      this.rigidBody.getAngularVelocity().setValue (0, 0, 0);
      this.rigidBody.setWorldTransform (transform);
      this.game.physicsWorld.addRigidBody (this.rigidBody, DefaultFilter | RigidBodyFilter, AllFilter);
      this.game.physicsWorld.addAction (this.raycastVehicle);
   }

   /*
    * Resets the car's position the last position
    * where all four wheels were on the ground
    * when some wheels are on the water.
    */
   handleWheelTouchObject (type) {
      if (type==="water") {
         this.resetTransform ();
         return true;
      }
      return false;
   }

   getLocalVelocity (velocity, angularVelocity, position) {
      this._position.copy (position);
      this.localToWorld (this._position);
      this._position.sub (this.position);
      let localVelocity = this._localVelocity;
      localVelocity.copy (angularVelocity)
                   .cross (this._position)
                   .add (velocity);
      localVelocity.copy (velocity);
      let length = velocity.length ();
      this.updateMatrixWorld();
      localVelocity.transformDirection (this._matrix4d.copy(this.matrixWorld).invert());
      localVelocity.multiplyScalar (length);
      return localVelocity;
   }

   /*
    * returns revs_per_second*radius*2*pi pf the corresponding wheel
    */
   getWheelSpeed(wheelIndex) {
      let raycastInfo = this.raycastVehicle.getWheelInfo(wheelIndex)
                                           .get_m_raycastInfo();
      if (!raycastInfo.get_m_isInContact()) {
         return this.wheelRevsPerSecond[wheelIndex]*2*Math.PI*this.wheelRadius;
      }

      let wheelPosition = raycastInfo.get_m_hardPointWS();
      let linearVelocity = this.rigidBody.getLinearVelocity ();
      this.velocity.set (linearVelocity.x(), linearVelocity.y(), linearVelocity.z());
      let angularVelocity = this.rigidBody.getAngularVelocity ();
      this.angularVelocity.set (angularVelocity.x(), angularVelocity.y(), angularVelocity.z());
      this._position.set (wheelPosition.x(), wheelPosition.y(), wheelPosition.z());
      let speed = this.getLocalVelocity (this.velocity, this.angularVelocity, this._position).z;
      this.wheelRevsPerSecond[wheelIndex]= speed/(2*Math.PI*this.wheelRadius);
      return speed;
   }

   /*
    * Updates the ghost object used for detecting,
    * when a car is next to a pilot.
    * The position of the car is reset, when
    * the angular velocity is too high.
    * When the "active" parameter is true
    * also the value of the steering wheel,
    * the throttle and the brakes are updated
    * depending on the user input.
    */
   animate (interval, fixedTimeStep, steps, active) {

      let angularVelocity = this.rigidBody.getAngularVelocity();
      if (Math.abs(angularVelocity.x())>10 ||
          Math.abs(angularVelocity.z())>10) {
         this.resetTransform ();
      }

      this._updateGhostObjectSphere ();
      if (!active) {
         return;
      }
      this.steeringWheel.rotation.z = -this.steering/this.max_steering*this.steering_wheel_rotations*2*Math.PI;
      let currentInterval = steps*fixedTimeStep;
      let leftWheelSpeed = this.getWheelSpeed(this.FRONT_LEFT_WHEEL);
      let rightWheelSpeed = this.getWheelSpeed(this.FRONT_RIGHT_WHEEL);
      let speedMetersPerSecond = 0.5*(leftWheelSpeed+rightWheelSpeed);
      let speed = speedMetersPerSecond*3.6;
      this.speedometerPointer.rotation.z = this.speedometerPointerStartRotationZ+Math.abs(Math.min(speed, 240))/35/10*2*Math.PI;

      let wheelsRevPerSecond = 0.5*(this.wheelRevsPerSecond[this.FRONT_LEFT_WHEEL]+this.wheelRevsPerSecond[this.FRONT_RIGHT_WHEEL]);

      if (this.arrowUp) {
         this.brakesTorque = 0;
         this.throttle += 0.2*interval;
         this.throttle = 1;
         if (this.throttle > 1)  {
            this.throttle = 1;
         }
      }
      else {
         this.throttle -= 0.2*interval;
         if (this.throttle < 0)  {
            this.throttle = 0;
         }
      }

      if (speed>230) {
         this.throttle = 0;
      }

      this.engine.throttle = this.throttle;
      this.engine.update (interval, 60*wheelsRevPerSecond, this.arrowUp, this.reverseGear);
      let rpm = this.engine.rpm;
      this.rpmParam.value = rpm;
      this.tachometerPointer.rotation.z = this.tachometerPointerStartRotationZ+Math.min(rpm, 7500)*0.0001*2*Math.PI;

      if (this.arrowDown) {
         this.throttle = 0;
         this.brakesTorque += 1000*interval;
         if (this.brakesTorque > this.maxBrakeTorque)  {
            this.brakesTorque = this.maxBrakeTorque;
         }
      }
      else {
         this.brakesTorque -= 2000*interval;
         if (this.brakesTorque < 0)  {
            this.brakesTorque = 0;
         }
      }

      let engineTorqueWheel = 0.5*this.engine.axleTorque;
      let brakesTorque;
      if (speed >= 0) {
         brakesTorque = 20*this.brakesTorque;
      }
      else {
         brakesTorque = -20*this.brakesTorque;
      }
      let engineForceWheel = (engineTorqueWheel-brakesTorque)/this.wheelRadius;
      this.raycastVehicle.applyEngineForce (engineForceWheel, this.FRONT_LEFT_WHEEL);
      this.raycastVehicle.applyEngineForce (engineForceWheel, this.FRONT_RIGHT_WHEEL);

//      this.raycastVehicle.setBrake(this.brakesTorque, this.FRONT_LEFT_WHEEL);
//      this.raycastVehicle.setBrake(this.brakesTorque, this.FRONT_RIGHT_WHEEL);
      this.raycastVehicle.setBrake(0.25*this.brakesTorque, this.BACK_LEFT_WHEEL);
      this.raycastVehicle.setBrake(0.25*this.brakesTorque, this.BACK_RIGHT_WHEEL);

      if (this.arrowLeft) {
         this.steering += (0.1+Math.abs(this.steering))*interval;
         if (this.steering > this.max_steering) {
            this.steering = this.max_steering;
         }
      }
      if (this.arrowRight) {
         this.steering -= (0.1+Math.abs(this.steering))*interval;
         if (this.steering < -this.max_steering) {
            this.steering = -this.max_steering;
         }
      }
      if (!this.arrowRight && !this.arrowLeft) {
         if (this.steering < 0) {
            this.steering += (0.1+Math.abs(this.steering))*interval;
            if (this.steering>0) {
               this.steering = 0;
            }
         }
         else if (this.steering > 0) {
            this.steering -= (0.1+Math.abs(this.steering))*interval;
            if (this.steering<0) {
               this.steering = 0;
            }
         }
      }

      this.raycastVehicle.setSteeringValue(this.steering, this.FRONT_LEFT_WHEEL);
      this.raycastVehicle.setSteeringValue(this.steering, this.FRONT_RIGHT_WHEEL);
   }
}

Car.gltfCar = null;

export default Car;