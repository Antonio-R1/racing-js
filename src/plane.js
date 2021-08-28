/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';
import {GLTFLoader} from './three_js/examples/jsm/loaders/GLTFLoader.js';
import {EngineSoundGenerator} from './sound/sound_generator_worklet.js';
import Vehicle from './vehicle.js';
import FlightInstruments from './flight_instruments.js';
import {BoundingBox,
        Particle,
        ParticleSystem,
        CollisionDetection,
        CollisionDetectionSphere} from './collision_detection.js';
import LinkedList from './linked_list.js';
import Rocket from './rocket.js';
import RigidBodyDynamics2d from './rigid_body_dynamics.js';
import SplineInterpolation from './spline_interpolation.js';

var DefaultFilter = 1;
var StaticFilter = 2;
var AllFilter = -1;
var RigidBodyFilter = 64;

class PropellerValues {
   constructor (thrust, torque) {
      this.thrust = thrust;
      this.torque = torque;
   }
}

class Plane extends Vehicle {

   constructor ({loadingManager, lift_and_gravity_deactivated, hasSpotLight = false, consumesFuel = false,
                 globallyUsedVariables, game, use3dPhysics = false, position, rotation,
                 setCameraCallback, vehicleName = "airplane", deactivateDepthWrite}) {
      super ();
      this.vehicleName = vehicleName;
      this.deactivateDepthWrite = deactivateDepthWrite;
      let plane_object = this;
      this.updateCameraBehindVehicle = true;
      this.engine_started = false;
      this.fuelPercentage = 100;
      this.consumesFuel = consumesFuel;
      this.globallyUsedVariables = globallyUsedVariables;
      this.game = game;
      this.setCameraCallback = setCameraCallback;
      this.use3dPhysics = use3dPhysics;
      this.ringBufferSize = 45;
      this.speedRingBuffer = new Array(this.ringBufferSize).fill(0);
      this.speedRingBufferIndex = 0;
      this.speedAverage = 0;
      this.altitudeRingBuffer = new Array(this.ringBufferSize).fill(0);
      this.altitudeRingBufferIndex = 0;
      this.altitudeAverage = 0;
      if (position) {
         this.position.copy (position);
      }
      if (rotation) {
         this.rotation.copy (rotation);
      }
      if (this.consumesFuel) {
         setFuelPercentage (this.fuelPercentage);
      }
      this.active = false;
      this.startPosition = this.position.clone();
      this.startRotation = this.rotation.clone();
      this.propeller_right_acceleration = 0;
      this.propeller_left_acceleration = 0;
      this.propeller_right_speed = 0;
      this.propeller_left_speed = 0;
      this.wheelOnRunway = true;
      this.throttle = 0.01;
      this.throttleOld = 0.01;
      this.increase_throttle = false;
      this.deactivate_increase_throttle = false;
      this.decrease_throttle = false;
      this.deactivate_decrease_throttle = false;
      this.deactivate_move_up_elevator = false;
      this.move_up_elevator = false;
      this.deactivate_move_down_elevator = false;
      this.move_down_elevator = false;
      this.airplane_mass = 4500;
      this.mass = 2750;
      this.speed = 0.0;
      this.altitude = 0.0
      this.atmosphericDensity = 1.225;
      this.total_lift = 0.0;
      this.planeRotationPosition = new THREE.Object3D ();
      this.lastPosition = new THREE.Vector3 ();
      this.lastRotation = new THREE.Vector3 ();
      this.velocity = new THREE.Vector3 ();
      this._localVelocity = new THREE.Vector3 ();
      this.origin = new THREE.Vector3 ();
      this._matrix4d = new THREE.Matrix4 ();
      this._vector2d = new THREE.Vector2 ();
      this.vectorAxisZ = new THREE.Vector3 ();
      this.lift_and_gravity_deactivated = lift_and_gravity_deactivated == true;
      this.speed_lift_gravity_equal = 100;
      this.speed_lift_gravity_equal_2 = this.speed_lift_gravity_equal*this.speed_lift_gravity_equal;
      this.propeller_radius = 1.3;
      this.propeller_blades = 2;
      this.propeller_width = 0.25;
      this.propeller_pitch = 2.25;
      this.propeller_alpha = Math.atan (this.propeller_pitch/(2*Math.PI*this.propeller_radius));
      this.propeller_moment_of_inertia = 5;
      this.motor_max_kw = 250;
      this.motorMaxW = this.motor_max_kw*1000;
      this.motorMaxKWRpm = 2500;
      this.flightInstruments = null;
      this.boundingBoxes = [];
      this.collisionDetectionSpheres = [];
      this.collisionDetectionCallback = null;
      this._createLiftCoefficientCurve (5);
      this._createDragCoefficientCurve (5);
//      this.rearWheelsMass = 200;
//      this.frontWheelMass = 100;
//      this.horizontalStabilizerMass = 500;
//      this.noseMass = 2150;
//      this.wingsMass = 1600;
      this.rearWheelsMass = 153.8;
      this.frontWheelMass = 76.9;
      this.horizontalStabilizerMass = 384.6;
      this.noseMass = 1653.8;
      this.wingsMass = 1230.8;

      this.updatesPerSeconds = 60;

      this.rockets = [];
      this.hasRockets = false;
      this.timeSetRockets = 0;

      var planeObject = this;
      this.particleGroundDistanceCallback = function (particlePositionOld, particlePosition) {
         if (planeObject.runways != undefined) {
            for (let i=0; i<planeObject.runways.length; i++) {
               if (particlePosition.z <= planeObject.runways[i].runway_scene.position.z+planeObject.runways[i].length/2 &&
                   particlePosition.z >= planeObject.runways[i].runway_scene.position.z-planeObject.runways[i].length/2) {
                   return particlePosition.y-(planeObject.runways[i].runway_scene.position.y+0.01);
               }
            }
         }
         return 1;
      }

      if (Plane.gltf_plane != null) {
         this.clone (hasSpotLight);

         let parameters = {cylinders: 4,

                           intakeWaveguideLength: 100,
                           exhaustWaveguideLength: 100,
                           extractorWaveguideLength: 100,

                           intakeOpenReflectionFactor: 0.25,
                           intakeClosedReflectionFactor: 0.95,

                           exhaustOpenReflectionFactor: 0.25,
                           exhaustClosedReflectionFactor: 0.95,
                           ignitionTime: 0.025,

                           straightPipeWaveguideLength: 5,
                           straightPipeReflectionFactor: 0.01,

                           mufflerElementsLength: [10, 15, 20, 25],
                           action: 0.1,

                           outletWaveguideLength: 5,
                           outletReflectionFactor: 0.01};

         this.engineLeftSoundGenerator = new EngineSoundGenerator({listener: soundGeneratorAudioListener, parameters: parameters});
         this.motor_left.add (this.engineLeftSoundGenerator);
         this.gainIntakeLeft = this.engineLeftSoundGenerator.gainIntake.gain;
         this.gainEngineBlockVibrationsLeft = this.engineLeftSoundGenerator.gainEngineBlockVibrations.gain;
         this.gainOutletLeft = this.engineLeftSoundGenerator.gainOutlet.gain;
         this.rpmParamLeft = this.engineLeftSoundGenerator.worklet.parameters.get('rpm');

         this.engineRightSoundGenerator = new EngineSoundGenerator({listener: soundGeneratorAudioListener, parameters: parameters});
         this.motor_right.add (this.engineRightSoundGenerator);
         this.gainIntakeRight = this.engineRightSoundGenerator.gainIntake.gain;
         this.gainEngineBlockVibrationsRight = this.engineRightSoundGenerator.gainEngineBlockVibrations.gain;
         this.gainOutletRight = this.engineRightSoundGenerator.gainOutlet.gain;
         this.rpmParamRight = this.engineRightSoundGenerator.worklet.parameters.get('rpm');

         return;
      }

      if (!loadingManager) {
         // initialize values for debugging
         this.plane_scene = new THREE.Scene();
         this.elevators = new THREE.Scene();
         if (!this.use3dPhysics) {
            this.initPhysicsParticleSystem ();
         }

         return;
      }

      var gltfLoader = new GLTFLoader(loadingManager);

      gltfLoader.load("gltf/plane.gltf", function(gltf) {
         Plane.gltf_plane = gltf;
         plane_object.clone ();
         plane_object.animate_time = null;
      }, 
      function (xhr) {
//         console.log("object: "+(xhr.loaded/xhr.total*100)+'% loaded');
      },
      function (error) {
         console.error(error);
      });
   }

   clone (hasSpotLight) {
      let obj = Plane.gltf_plane.scene.clone ();
      let plane_object = this;

      let wheelCollisionDetectionCallback = function (cornerOld, corner) {
         return plane_object.wheelCollisionDetectionCallback (cornerOld, corner);
      }

      function addBoundingBox (object, showCorners, callback) {
         var boundingBox = new BoundingBox (object);
         boundingBox.callback = callback;
         plane_object.boundingBoxes.push (boundingBox);
         if (showCorners) {
            obj.add (boundingBox.getObject3d ());
         }
      }

      function addCollisionDetectionSphere (x, y, z, radius, showSphere) {
         var collisionDetectionSphere = new CollisionDetectionSphere (x, y, z, radius);
         var objCollisionDetectionSphere = collisionDetectionSphere.getObject3d ();
         obj.add (collisionDetectionSphere.getObject3d ());

         if (showSphere) {
            var sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);
            var sphereMaterial = new THREE.MeshPhongMaterial({color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.25, opacity: 0.5, transparent: true});
            var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            sphere.position.copy (objCollisionDetectionSphere.position);
            obj.add(sphere);
         }

         plane_object.collisionDetectionSpheres.push (collisionDetectionSphere);
      }

      obj.traverse (function (object) {
//         console.log (object.name);

         if (object instanceof THREE.Mesh) {
            object.castShadow = true;
         }
         else {
            for (let obj of object.children) {
               obj.castShadow = true;
            }
         }

         switch (object.name) {
            case "propeller_right":
               plane_object.propeller_right = object;
               break;
            case "propeller_left":
               plane_object.propeller_left = object;
               break;
            case "motor_right":
               plane_object.motor_right = object;
               break;
            case "motor_left":
               plane_object.motor_left = object;
               break;
            case "landing_light":
               plane_object.landing_light = object;
               if (hasSpotLight) {
                  const spotLight = new THREE.SpotLight (0xffffff, 5, 250, 0.75, 0.5, 2);
                  spotLight.target = new THREE.Object3D();
                  spotLight.target.position.set (0, 0, 100);
                  spotLight.target.updateMatrixWorld();
                  object.add (spotLight.target);
                  object.add (spotLight);
//                  const spotLightHelper = new THREE.SpotLightHelper(spotLight);
//                  scene.add(spotLightHelper);
               }
               break;
            case "white_strobe_right":
               plane_object.white_strobe_right = object;
               // We use the same material for both wing strobes and the strobe on the tail.
               plane_object.white_strobe_material = object.material;
               break;
            case "white_strobe_left":
               plane_object.white_strobe_left = object;
               break;
            case "white_strobe_tail":
               plane_object.white_strobe_tail = object;
               break;
            case "red_strobe":
               plane_object.red_strobe = object;
               break;
            case "body":
               plane_object.body = object;
               plane_object.plane_body = object;
               addBoundingBox (object);
               break;
            case "body_middle":
//               addBoundingBox (object);
               break;
            case "body_tail":
               addBoundingBox (object);
               break;
            case "wheel_right":
               plane_object.wheelRight = object;
               addBoundingBox (object, false, wheelCollisionDetectionCallback);
               break;
            case "wheel_left":
               plane_object.wheelLeft = object;
               addBoundingBox (object, false, wheelCollisionDetectionCallback);
               break;
            case "wheel_middle":
               plane_object.wheelMiddle = object;;
               addBoundingBox (object, false, wheelCollisionDetectionCallback);
               break;
            case "flaps":
               plane_object.flaps = object;
               break;
            case "aileron_right":
               plane_object.aileron_right = object;
               break;
            case "aileron_left":
               plane_object.aileron_left = object;
               break;
            case "wings":
               plane_object.wings = object;
               addBoundingBox (object);
               break;
            case "winglet_left":
               break;
            case "winglet_right":
               break;
            case "vertical_stabilizer":
               addBoundingBox (object);
               break;
            case "rudder":
               plane_object.rudder = object;
               break;
            case "horizontal_stabilizer":
               plane_object.horizontalStabilizer = object;
               addBoundingBox (object);
               break;
            case "elevator":
               plane_object.elevators = object;
               break;
         }
      });

      let deactivateDepthWrite = this.deactivateDepthWrite;
      let addLightGlowing = function (object3d, size, color) { 
         var pointsGeometry = new THREE.BufferGeometry ();

         pointsGeometry.setAttribute ("position", new THREE.Float32BufferAttribute ([0, 0, 0], 3));

//       compute the correct size of the lights according to https://github.com/mrdoob/three.js/issues/12150#issuecomment-327874431
         var lightsSize = size/Math.tan ((Math.PI/180)*camera.fov/2);
         let alphaMap = new THREE.TextureLoader().load("images/light_glow_alpha_map.png");
         var pointsMaterial = new THREE.PointsMaterial ({alphaMap: alphaMap,
                                                         color: color, size: lightsSize, depthWrite: !deactivateDepthWrite, transparent: true});

         var lights = new THREE.Points (pointsGeometry, pointsMaterial);
         object3d.add (lights);
         return pointsMaterial;
      }

      this.whiteStrobeRightTextureMaterial = addLightGlowing(this.white_strobe_right, 3, 0xffffff);
      this.whiteStrobeLeftTextureMaterial = addLightGlowing(this.white_strobe_left, 3, 0xffffff);
      this.whiteStrobeTailTextureMaterial = addLightGlowing(this.white_strobe_tail, 3, 0xffffff);
      this.redStrobeTextureMaterial = addLightGlowing(this.red_strobe, 3, 0xff0000);

      this.plane = obj;
      this.plane.name = "plane obj";
      this.plane_scene = this;
      this.plane_scene.name = "plane scene";

      if (!this.use3dPhysics) {
         this.initPhysicsParticleSystem ();
      }
      else {
         this.arrowLeft = false;
         this.arrowRight = false;
         this.brakes = false;
         this.brakesForce = 0;
         this.maxSteering = 0.35*Math.PI;
         this.steering = 0;
         this.steeringWheelRotations = 1.5;
         this.pilotPosition = new THREE.Vector3 (0.45, -0.11, -0.097812);
         this.initCamera ();
         this.initPhysics3d ();
      }

      this.plane_scene.add(this.plane);
      this.animateTime = null;
      addCollisionDetectionSphere (0.0, 1.0,  2.0, 1.0);
      addCollisionDetectionSphere (0.0, 1.0,  0.0, 1.0);
      addCollisionDetectionSphere (0.0, 2.5, -5.0, 1.0);
   }

   disposeObjects () {
      this.engineLeftSoundGenerator.stop ();
      this.engineRightSoundGenerator.stop ();
   }

   initPhysicsParticleSystem () {
      this.g = 9.81;

      this.forceMotor = new THREE.Vector3( 0.0, 0.0, 0.0);
      this.particleMotor = new Particle(new THREE.Vector3( 0.0, 0, 0.67), 0,
                                        this.forceMotor);

      this.forceWings = new THREE.Vector3( 0.0, -this.wingsMass*this.g, 0.0);
      this.particleWings = new Particle(new THREE.Vector3( 0.0, 2.7, 0.5), this.wingsMass,
                                        this.forceWings);

      this.forceHorizontalStabilizer = new THREE.Vector3( 0.0, -this.horizontalStabilizerMass*this.g, 0.0);
      this.particleHorizontalStabilizer = new Particle(new THREE.Vector3( 0.0, 2.5, -5.3), this.horizontalStabilizerMass,
                                           this.forceHorizontalStabilizer);

      this.particleSystem = new ParticleSystem ([new Particle(new THREE.Vector3( 0.0, 0.0, -1.7), this.rearWheelsMass, // rear wheels
                                                              new THREE.Vector3( 0.0, -this.rearWheelsMass*this.g, 0.0)),
                                                 new Particle(new THREE.Vector3( 0.0, 0.0, 1.5), this.frontWheelMass,  // front wheel
                                                              new THREE.Vector3( 0.0, -this.frontWheelMass*this.g, 0.0)),
                                                 this.particleHorizontalStabilizer,
                                                 new Particle(new THREE.Vector3( 0.0, 1.3, 2.5), this.noseMass, // nose
                                                              new THREE.Vector3( 0.0, -this.noseMass*this.g, 0.0)),
                                                 this.particleMotor,
                                                 this.particleWings]);

      this.centerOfMass = this.particleSystem.centerOfMass;
      this.particleMotor.position.y = this.centerOfMass.y - this.centerOfMass.y;
      if (this.globallyUsedVariables) {
         this.globallyUsedVariables.scene.add (this.planeRotationPosition);
      }
      else {
         scene.add (this.planeRotationPosition);
      }
   }

   _drawText (context, text, x, y) {
      context.fillText (text, x, y);
      context.strokeText (text, x, y);
   }

   _drawCircle (context, x, y, radius, fillStyle) {
      context.fillStyle = fillStyle;
      context.beginPath ();
      context.arc (x, y, radius, 0, 2*Math.PI);
      context.fill ();
   }

   initMap () {
      this.linkedListCollisionSpheres = null;
      let mapGeometry = new THREE.PlaneGeometry (0.075, 0.075);
      this.canvasMap = document.createElement ("canvas");
      let size = 250;
      this.mapSize = size;
      this.canvasMap.width = size;
      this.canvasMap.height = size;
      this.canvasMapContext = this.canvasMap.getContext ("2d");

      var mapTexture = new THREE.CanvasTexture (this.canvasMap);
      this.mapTexture = mapTexture;
      mapTexture.wrapS = THREE.ClampToEdgeWrapping;
      mapTexture.wrapT = THREE.ClampToEdgeWrapping;
      let mapMaterial = new THREE.MeshBasicMaterial ({map: mapTexture, transparent: true});
      this.map = new THREE.Mesh (mapGeometry, mapMaterial);

      this.map.position.x = -0.15;
      this.map.position.y = -0.0125;
      this.map.position.z = -0.15;
      this.map.rotation.x = 0;

      this.mapLastUpdateTime = 0;
      this.updateMap (window.performance.now ());
   }

   updateMap (time) {

      if (time-this.mapLastUpdateTime<1000 || !this.linkedListCollisionSpheres) {
         return;
      }
      this.mapLastUpdateTime = time;

      let size = this.mapSize;
      this.canvasMapContext.clearRect (0, 0, size, size);
      this.canvasMapContext.fillStyle = "rgba(0, 0, 0, 0.25)";
      this.canvasMapContext.fillRect(0, 0, size, size);

      this.canvasMapContext.font = "32px sans-serif";
      this.canvasMapContext.strokeStyle = "rgba(0, 0, 0, 0.75)";
      this.canvasMapContext.fillStyle = "rgba(0, 255, 0, 0.75)";

      let text = "N";
      let textMetrics = this.canvasMapContext.measureText(text);
      let textHeight = 23;
      this._drawText (this.canvasMapContext, text, 0.5*size-0.5*textMetrics.width, 5+textHeight);

      text = "E";
      textMetrics = this.canvasMapContext.measureText(text);
      this._drawText (this.canvasMapContext, text, size-textMetrics.width-5, 0.5*size+0.5*textHeight);

      text = "S";
      textMetrics = this.canvasMapContext.measureText(text);
      this._drawText (this.canvasMapContext, text, 0.5*size-0.5*textMetrics.width+5, size-5);

      text = "W";
      this._drawText (this.canvasMapContext, text, 5, 0.5*size+0.5*textHeight);
      let currentCollisionSphere = this.linkedListCollisionSpheres.first;
      while (currentCollisionSphere) {
         let x = 0.5*size-currentCollisionSphere.value.x/1000*0.5*size;
         let y = 0.5*size-currentCollisionSphere.value.z/1000*0.5*size;
         this._drawCircle (this.canvasMapContext, x, y, 2, "rgba(0, 255, 0, 0.75)");
         currentCollisionSphere = currentCollisionSphere.next;
      }

      let positionX = this.position.x;
      let positionY = this.position.z;
      let xAbs = Math.abs (positionX);
      let yAbs = Math.abs (positionY);
      let maxSize = 1000;
      if (xAbs > maxSize || yAbs > maxSize) {
         let maxValue = Math.max (xAbs, yAbs);

         let scalingFactor = maxSize/maxValue;
         positionX = scalingFactor*positionX;
         positionY = scalingFactor*positionY;
      }

      let x = 0.5*size-positionX/maxSize*0.5*size;
      let y = 0.5*size-positionY/maxSize*0.5*size;

      this._drawCircle (this.canvasMapContext, x, y, 5, "rgba(255, 0, 0, 0.75)");

      this.mapTexture.needsUpdate = true;
   }

   setLinkedListCollisionSpheres (linkedListCollisionSpheres) {
      this.linkedListCollisionSpheres = linkedListCollisionSpheres;
   }

   initCamera () {
     this.flightInstruments = new FlightInstruments ();
     let flightInstruments = this.flightInstruments.object3d;
     flightInstruments.scale.set (0.1, 0.1, 0.1);
     flightInstruments.position.x = 0;
     flightInstruments.position.y = -0.11;
     flightInstruments.position.z = -0.15;
     flightInstruments.rotation.x = -0.2;
     this.camera = new THREE.PerspectiveCamera(75, camera.aspect, 0.1, camera.far);
     this.cameraIndex = 0;
     this.cameraHorizontalDistance = -25;
     let cockpitCameraPosition = new THREE.Vector3 (0, 0.26, 1.095);
     this.cockpitCameraPosition = cockpitCameraPosition;
     this.camera.position.copy (cockpitCameraPosition);
     this.camera.rotation.y = Math.PI;
     this.camera.add (this.flightInstruments.object3d);
     this.initMap ();
     this.camera.add (this.map);
   }

   initPhysics3d () {

      this.centerOfMass = new THREE.Vector3 (0.0, 1.84, 0.73);
      this.plane.position.set (0, 0, 0);
      this.plane.position.sub (this.centerOfMass);
      this._createCompoundShape (new Ammo.btVector3 (this.position.x,
                                                    this.position.y,
                                                    this.position.z));
      this._addRigidBodyFromBoundingBox (this.body);
      this._addRigidBodyFromBoundingBox (this.wings);
      this._addRigidBodyFromBoundingBox (this.motor_right);
      this._addRigidBodyFromBoundingBox (this.motor_left);
      this._addRigidBodyFromBoundingBox (this.horizontalStabilizer);
      this._createRigidBody ();
      this._createRaycastVehicle ();
      this.MIDDLE_WHEEL = 0;
      this.LEFT_WHEEL = 1;
      this.RIGHT_WHEEL = 2;
      this.max_steering = 0.35*Math.PI;
      this._addWheelFromBoundingBox (this.wheelMiddle, Vehicle.WHEEL_CONNECTION_POINT_UP, this.MIDDLE_WHEEL, true);
      this._addWheelFromBoundingBox (this.wheelLeft, Vehicle.WHEEL_CONNECTION_POINT_UP, this.LEFT_WHEEL, false);
      this._addWheelFromBoundingBox (this.wheelRight, Vehicle.WHEEL_CONNECTION_POINT_UP, this.RIGHT_WHEEL, false);
      this.forcesVector = new THREE.Vector3 ();
      let wingPositionZ = -1.25;
      this._position = new THREE.Vector3 ();
      this.angularVelocity = new THREE.Vector3 ();
      this.wingRightFlapPosition = new THREE.Vector3 (-2.5, 0.7, wingPositionZ);
      this.wingLeftFlapPosition = new THREE.Vector3 (2.5, 0.7, wingPositionZ);
      this.wingRightAileronPosition = new THREE.Vector3 (-7.5, 0.7, wingPositionZ);
      this.wingLeftAileronPosition = new THREE.Vector3 (7.5, 0.7, wingPositionZ);
      this.horizontalStabilizerPosition = new THREE.Vector3 (0, 0.5, -5.5);
      this.verticalStabilizerPosition = new THREE.Vector3 (0, 0, -5.5);
      this.btVectorForce = new Ammo.btVector3();
      this.btVectorPosition = new Ammo.btVector3();
      this.WING = 0;
      this.HORIZONTAL_STABILIZER = 1;
      this.VERTICAL_STABILIZER = 2;

      let radius = 5;
      this._createGhostObjectSphere (radius);

//this.rigidBody.setAngularFactor (new Ammo.btVector3 (1, 0, 0));

      this.raycastVehicle.setBrake(100, this.LEFT_WHEEL);
      this.raycastVehicle.setBrake(100, this.RIGHT_WHEEL);

      this.motorRightForceVector3 = new THREE.Vector3 ();
      this.motorLeftForceVector3 = new THREE.Vector3 ();
      this.animate = this.animate3d;
   }

   setActive (active, updateCamera=true) {
      this.active = active;
      if (active) {
         if (updateCamera) {
            this.camera.position.copy(this.cockpitCameraPosition);
            this.camera.rotation.set (0, Math.PI, 0);
            this.cameraIndex = 0;
            this.updateCameraBehindVehicle = false;
            this.add(this.camera);
            this.setCameraCallback (this.camera);
            this.updateCameraBehindVehicle = false;
            showMenuBar (true);
            selectCameraPositionSpan ("cockpit", false);
            showDivThrottle (true);
         }

         let gainNode = this.engineLeftSoundGenerator.gain;
         gainNode.gain.value = 0.5;
         this.updateGainValues ();
         this.engineLeftSoundGenerator.play();
         this.engineRightSoundGenerator.play();

         this.startEngine ();
      }
      else {
         if (updateCamera) {
            if (this.cameraIndex===0) {
               this.remove(this.camera);
            }
            else {
               scene.remove(this.camera);
            }
            showMenuBar (false);
            showDivThrottle (false);
         }
         this.stopEngine ();
         if (this.raycastVehicle) {
            this.raycastVehicle.setBrake(100, this.LEFT_WHEEL);
            this.raycastVehicle.setBrake(100, this.RIGHT_WHEEL);
         }

         this.engineLeftSoundGenerator.stop ();
         this.engineRightSoundGenerator.stop ();
      }
   }

   getLocalVelocity (velocity, angularVelocity, position) {
      this._position.copy (position);
      this.plane_scene.localToWorld (this._position);
      this._position.sub (this.plane_scene.position);
      let localVelocity = this._localVelocity;
      localVelocity.copy (angularVelocity)
                   .cross (this._position)
                   .add (velocity);
      localVelocity.copy (velocity);
      let length = velocity.length ();
      localVelocity.transformDirection (this._matrix4d.copy(this.plane_scene.matrixWorld).invert());
      localVelocity.multiplyScalar (length);
      return localVelocity;
   }

   setDrag (velocity, angularVelocity) {
      this._position.set (0, 0, 0);
      let localVelocity = this.getLocalVelocity (velocity, angularVelocity, this._position);

      this.forcesVector.set (localVelocity.x*localVelocity.x, localVelocity.y*localVelocity.y, localVelocity.z*localVelocity.z);
      this.forcesVector.multiplyScalar (-1);
      this.plane_scene.localToWorld (this.forcesVector);
      this.origin.set (0, 0, 0);
      this.plane_scene.localToWorld (this.origin);
      this.forcesVector.sub (this.origin);

      this._position.set (0, 0, 0);
      this.plane_scene.localToWorld (this._position);
      this._position.sub (this.plane_scene.position);

      this.btVectorForce.setValue (this.forcesVector.x, this.forcesVector.y, this.forcesVector.z);
      this.btVectorPosition.setValue (this._position.x, this._position.y, this._position.z);
      this.rigidBody.applyForce (this.btVectorForce, this.btVectorPosition);
   }

   setFlightControlSurfaceForces (velocity, angularVelocity, position, angleOfAttackAtZero, type) {

      let localVelocity = this.getLocalVelocity (velocity, angularVelocity, position);

      let angleOfAttack = this._getAngleOfAttack3d(angularVelocity, localVelocity, position, type==this.VERTICAL_STABILIZER)+angleOfAttackAtZero;

      while (angleOfAttack>2*Math.PI) {
         angleOfAttack -= 2*Math.PI;
      }
      while (angleOfAttack<0) {
         angleOfAttack += 2*Math.PI;
      }

      let lift;
      let drag;
      if (type==this.WING) {
         lift = this._getWingsLift3d (localVelocity, angleOfAttack);
         drag = this._getWingsDrag3d (localVelocity, angleOfAttack);
      }
      else if (type==this.HORIZONTAL_STABILIZER) {
         lift = this._getHorizontalStabilizerLift3d (localVelocity, angleOfAttack);
         drag = this._getHorizontalStabilizerDrag3d (localVelocity, angleOfAttack);
      }
      else if (type==this.VERTICAL_STABILIZER) {
         lift = this._getHorizontalStabilizerLift3d (localVelocity, angleOfAttack)*2;
         drag = this._getHorizontalStabilizerDrag3d (localVelocity, angleOfAttack)*2;
      }
      else {
         return;
      }

      let normalForce = this._getNormalForce (lift, drag, angleOfAttack);
      let axialForce = this._getAxialForce (lift, drag, angleOfAttack);

      if (type==this.WING || type==this.HORIZONTAL_STABILIZER) {
         this.forcesVector.set (0, normalForce, axialForce);
      }
      else {
         this.forcesVector.set (normalForce, 0, axialForce);
      }

      this.plane_scene.localToWorld (this.forcesVector);
      this.origin.set (0, 0, 0);
      this.plane_scene.localToWorld (this.origin);
      this.forcesVector.sub (this.origin);

//      length = this.forcesVector.length();
//      this.forcesVector.transformDirection (this.matrixWorld);
//      this.forcesVector.multiplyScalar (length);

      this._position.copy (position);
      this.plane_scene.localToWorld (this._position);
      this._position.sub (this.plane_scene.position);


      this.btVectorForce.setValue (this.forcesVector.x, this.forcesVector.y, this.forcesVector.z);
      this.btVectorPosition.setValue (this._position.x, this._position.y, this._position.z);
      this.rigidBody.applyForce (this.btVectorForce, this.btVectorPosition);
   }

   resetTransform () {
      this.game.physicsWorld.removeAction (this.vehicle);
      this.game.physicsWorld.removeRigidBody (this.rigidBody);
      let transform = this.rigidBody.getWorldTransform()
      transform.getOrigin().setValue(this.startPosition.x, this.startPosition.y, this.startPosition.z);
      this.rotation.copy (this.startRotation);
      let quaternion = this.quaternion;
      Ammo.destroy (transform.getRotation());
      transform.setRotation(new Ammo.btQuaternion (quaternion.x, quaternion.y, quaternion.z, quaternion.w));
      this.rigidBody.getLinearVelocity().setValue (0, 0, 0);
      this.rigidBody.getAngularVelocity().setValue (0, 0, 0);
      this.rigidBody.setWorldTransform (transform);
      this.game.physicsWorld.addRigidBody (this.rigidBody, DefaultFilter | RigidBodyFilter, AllFilter);
      this.game.physicsWorld.addAction (this.raycastVehicle);
   }

   handleWheelTouchObject (type) {

      if (type==="water") {
         this.resetTransform ();
         return true;
      }
      return false;
   }

   animateClient3d (time, interval) {
      this.updateLights (time);

      // We calculate an estimation of the speed at the clients.
      let elements = this.plane_scene.matrixWorld.elements;
      this.vectorAxisZ.set (elements[8], elements[9], elements[10]);
      this.velocity.copy (this.position).sub(this.lastPosition);
      this.velocity.projectOnVector (this.vectorAxisZ);
      this.speed = this.velocity.length ()/interval;
      this.speedAverage += (this.speed-this.speedRingBuffer[this.speedRingBufferIndex])/this.ringBufferSize;
      this.speedRingBuffer[this.speedRingBufferIndex] = this.speed;
      this.speedRingBufferIndex++;
      if (this.speedRingBufferIndex==this.ringBufferSize) {
         this.speedRingBufferIndex = 0;
      }

      this.altitudeAverage += (this.position.y-this.altitudeRingBuffer[this.altitudeRingBufferIndex])/this.ringBufferSize;
      this.altitudeRingBuffer[this.altitudeRingBufferIndex] = this.position.y;
      this.altitudeRingBufferIndex++;
      if (this.altitudeRingBufferIndex==this.ringBufferSize) {
         this.altitudeRingBufferIndex = 0;
      }
      this.lastPosition.copy (this.position);

      if (!this.active) {
         return;
      }

      let attitude = this._getAttitude();

      this.flightInstruments.update (1000*interval,
                           this.metersPerSecondToKnots(this.altitudeAverage),
                           attitude.pitch, attitude.heading, attitude.roll,
                           this.throttle,
                           this.metersPerSecondToKnots(this.speedAverage));
   }

   animate3d (interval, fixedTimeStep, steps, active) {

      this._updateGhostObjectSphere ();
      let time = window.performance.now ();
      this.updateLights (time);
      this.updatePropellerAcceleration (1000*interval);
      this.updatePropellerSpeed ();
      this.propeller_right.rotation.y -= this.propeller_right_speed*interval;
      this.propeller_left.rotation.y += this.propeller_left_speed*interval;

      this.rpmParamLeft.value = this.propeller_left_speed/(2*Math.PI)*60;
      this.rpmParamRight.value = this.propeller_right_speed/(2*Math.PI)*60;

      let linearVelocity = this.rigidBody.getLinearVelocity ();
      this.velocity.set (linearVelocity.x(), linearVelocity.y(), linearVelocity.z());
      let angularVelocity = this.rigidBody.getAngularVelocity ();
      this.angularVelocity.set (angularVelocity.x(), angularVelocity.y(), angularVelocity.z());

      this.plane_scene.updateMatrixWorld ();
      this.setFlightControlSurfaceForces (this.velocity, this.angularVelocity, this.wingRightFlapPosition, 5/180*Math.PI, this.WING);
      this.setFlightControlSurfaceForces (this.velocity, this.angularVelocity, this.wingRightAileronPosition,
                          5/180*Math.PI-0.01*this.aileron_right.rotation.x, this.WING);
      this.setFlightControlSurfaceForces (this.velocity, this.angularVelocity, this.wingLeftFlapPosition, 5/180*Math.PI, this.WING);
      this.setFlightControlSurfaceForces (this.velocity, this.angularVelocity, this.wingLeftAileronPosition,
                          5/180*Math.PI-0.01*this.aileron_left.rotation.x, this.WING);
      this.setFlightControlSurfaceForces (this.velocity, this.angularVelocity, this.horizontalStabilizerPosition,
                          -5/180*Math.PI-this.elevators.rotation.x, this.HORIZONTAL_STABILIZER);
      this.setFlightControlSurfaceForces (this.velocity, this.angularVelocity, this.verticalStabilizerPosition,
                                          this.rudder.rotation.y, this.VERTICAL_STABILIZER);
      this.setDrag (this.velocity, this.angularVelocity);

      if (!active) {
         return;
      }

      this.updateMap (time);

      this.updateThrottle (1000*interval);
      if (this.consumesFuel) {
         this.updateFuelLevel3d (interval);
      }

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

      this.rudder.rotation.y = -this.steering;

      if (this.brakes) {
         this.brakesForce += 1000*interval;
         if (this.brakesForce > 250)  {
            this.brakesForce = 250;
         }
      }
      else {
         this.brakesForce -= 2000*interval;
         if (this.brakesForce < 0)  {
            this.brakesForce = 0;
         }
      }
      this.raycastVehicle.setBrake(this.brakesForce, this.LEFT_WHEEL);
      this.raycastVehicle.setBrake(this.brakesForce, this.RIGHT_WHEEL);

      this.raycastVehicle.setSteeringValue(this.steering, this.MIDDLE_WHEEL);

      // We apply the forces from both propellers at the y-coordinate of the center of mass for not
      // generating any torque.
      this.motorLeftForceVector3.set (0, 0, this.propeller_left_thrust);
      length = this.motorLeftForceVector3.length();
      this.motorLeftForceVector3.transformDirection (this.matrixWorld);
      this.motorLeftForceVector3.multiplyScalar (length);

      this._position.copy (this.propeller_left.position);
      this.plane_scene.localToWorld (this._position);
      this._position.sub (this.plane_scene.position);

      this.btVectorForce.setValue (this.motorLeftForceVector3.x, this.motorLeftForceVector3.y, this.motorLeftForceVector3.z);
      this.btVectorPosition.setValue (this._position.x, 0, this._position.z);
      this.rigidBody.applyForce (this.btVectorForce, this.btVectorPosition);

      this.motorRightForceVector3.set (0, 0, this.propeller_right_thrust);
      length = this.motorRightForceVector3.length();
      this.motorRightForceVector3.transformDirection (this.matrixWorld);
      this.motorRightForceVector3.multiplyScalar (length);

      this._position.copy (this.propeller_right.position);
      this.plane_scene.localToWorld (this._position);
      this._position.sub (this.plane_scene.position);

      this.btVectorForce.setValue (this.motorRightForceVector3.x, this.motorRightForceVector3.y, this.motorRightForceVector3.z);
      this.btVectorPosition.setValue (this._position.x, 0, this._position.z);
      this.rigidBody.applyForce (this.btVectorForce, this.btVectorPosition);

      let elements = this.plane_scene.matrixWorld.elements;
      this.vectorAxisZ.set (elements[8], elements[9], elements[10]);
      this.velocity.set (linearVelocity.x(), linearVelocity.y(), linearVelocity.z());
      this.velocity.projectOnVector (this.vectorAxisZ);
      this.speed = this.velocity.length ();

      let attitude = this._getAttitude();
      this.flightInstruments.update (steps*1000*fixedTimeStep,
                           this.metersPerSecondToKnots(this.plane_scene.position.y),
                           attitude.pitch, attitude.heading, attitude.roll,
                           this.throttle,
                           this.metersPerSecondToKnots(this.speed));
   }

   /*
    * create a curve for the lift coefficient similar to as explained in
    * https://aviation.stackexchange.com/a/41047
    */
   _createLiftCoefficientCurve (alphaCambered = 0, scale = 1) {
      var xAxis = [  0,   1,  7.5,    15,   17,  20,  27,
                    30,  45,   70,    90,  110, 135, 150,
                   160, 163,  165, 172.5,  179, 180];
      var yAxis = [   0,  0.1,  0.55,     1,  0.75,   0.7,  0.8,
                    0.9,  1.1,  0.55,     0, -0.55, -0.95, -0.9,
                   -0.5, -0.7, -0.85, -0.55,  -0.1,   0];

      var length = xAxis.length-1;
      for (var i=0; i<length; i++) {
         xAxis.push(180+xAxis[i+1]);
         yAxis.push(-yAxis[length-i]);
      }

      for (var i=0; i<xAxis.length; i++) {
         xAxis[i] = xAxis[i]/360*2*Math.PI;
         if (xAxis[i]>2*Math.PI) {
            xAxis[i] -= 2*Math.PI;
         }
      }

      if (scale) {
         for (var i=0; i<yAxis.length; i++) {
            yAxis[i] *= scale;
         }
      }

      this.liftCoefficientCurve = new SplineInterpolation (xAxis, yAxis);
   }

   /*
    * create a curve for the drag coefficient similar to as explained in
    * https://aviation.stackexchange.com/a/41047
    */
   _createDragCoefficientCurve (alphaCambered = 0, scale = 1) {

      var xAxis = [  0,  10,  15,  45,   60,  90,
                   120, 135, 160, 170,  180];
      var yAxis = [   0, 0.01, 0.02, 1.3, 1.75, 2,
                   1.75,  1.4, 0.45, 0.2,    0];

      for (var i=0; i<xAxis.length; i++) {
         xAxis[i] = xAxis[i]/360*2*Math.PI;
         if (xAxis[i]>2*Math.PI) {
            xAxis[i] -= 2*Math.PI;
         }
      }

      if (scale) {
         for (var i=0; i<yAxis.length; i++) {
            yAxis[i] *= scale;
         }
      }

      this.dragCoefficientCurve = new SplineInterpolation (xAxis, yAxis);
   }

   _getLiftCoefficient (angleOfAttack) {
      if (angleOfAttack<=Math.PI) {
         return this.liftCoefficientCurve.evaluate(angleOfAttack);
      }

      return -this.liftCoefficientCurve.evaluate(2*Math.PI-angleOfAttack);
   }

   _getDragCoefficient (angleOfAttack) {
      if (angleOfAttack<=Math.PI) {
         return this.dragCoefficientCurve.evaluate(angleOfAttack);
      }

      return this.dragCoefficientCurve.evaluate(2*Math.PI-angleOfAttack);
   }

   _getAngleOfAttack () {
      return -(Math.atan2 (this.particleSystem.velocity.y, this.particleSystem.velocity.z)+this.plane_scene.rotation.x);
   }

   _getAngleOfAttack3d (angularVelocity, velocity, position, vertical) {
      if (!vertical) {
         this._vector2d.set (velocity.y, velocity.z);
      }
      else {
         this._vector2d.set (velocity.x, velocity.z);
      }
      return -Math.atan2 (this._vector2d.x, this._vector2d.y);
   }

   _getWingsLift3d (velocity, angleOfAttack) {
      return velocity.lengthSq()*this._getLiftCoefficient(angleOfAttack)*0.5*this.getAtmosphericDensity ()*29.0;
   }

   _getWingsDrag3d (velocity, angleOfAttack) {
      return velocity.lengthSq()*this._getDragCoefficient(angleOfAttack)*0.5*this.getAtmosphericDensity ()*29.0;
   }

   _getHorizontalStabilizerLift3d (velocity, angleOfAttack) {
      return velocity.lengthSq()*this._getLiftCoefficient(angleOfAttack)*4.0*this.getAtmosphericDensity ();
   }

   _getHorizontalStabilizerDrag3d (velocity, angleOfAttack) {
      return velocity.lengthSq()*this._getDragCoefficient(angleOfAttack)*4.0*this.getAtmosphericDensity ();
   }

   _getWingsLift (angleOfAttackWings) {
      return this.particleSystem.velocity.lengthSq()*this._getLiftCoefficient(angleOfAttackWings)*61.0*
             this.getAtmosphericDensity ();
   }

   _getWingsDrag (angleOfAttackWings) {
      return this.particleSystem.velocity.lengthSq()*this._getDragCoefficient(angleOfAttackWings)*61.0*
             this.getAtmosphericDensity ();
   }

   _getHorizontalStabilizerLift (angleOfAttackHorizontalStabilizer) {
      var angleOfAttack = angleOfAttackHorizontalStabilizer;
      while (angleOfAttack>2*Math.PI) {
         angleOfAttack -= 2*Math.PI;
      }
      while (angleOfAttack<0) {
         angleOfAttack+= 2*Math.PI;
      }
      return this.particleSystem.velocity.lengthSq()*this._getLiftCoefficient(angleOfAttack)*0.8*this.getAtmosphericDensity ();
   }

   _getHorizontalStabilizerDrag (angleOfAttackHorizontalStabilizer) {
      var angleOfAttack = angleOfAttackHorizontalStabilizer;
      while (angleOfAttack>2*Math.PI) {
         angleOfAttack -= 2*Math.PI;
      }
      while (angleOfAttack<0) {
         angleOfAttack+= 2*Math.PI;
      }
      return this.particleSystem.velocity.lengthSq()*this._getDragCoefficient(angleOfAttack)*0.8*this.getAtmosphericDensity ();
   }

   _getNormalForce (lift, drag, angleOfAttack) {
      return lift*Math.cos(angleOfAttack)+drag*Math.sin(angleOfAttack);
   }

   _getAxialForce (lift, drag, angleOfAttack) {
      return -lift*Math.sin(angleOfAttack)+drag*Math.cos(angleOfAttack);
   }

   setPlaneScene (plane_scene) {
      this.plane_scene = plane_scene;
   }

   setRockets (hasRockets) {
      if (hasRockets) {
         if (this.hasRockets) {
            console.warn("cannot add the rockets");
            return;
         }

         if (this.rockets.length == 0) {
            this.rockets= [new Rocket ().object3d,
                           new Rocket ().object3d];
            this.rockets[0].scale.set(0.5, 0.5, 0.5);
            this.rockets[0].position.x = -3.5;
            this.rockets[0].position.y = 1.75;
            this.rockets[0].rotation.x = 0.5*Math.PI;
            this.rockets[1].scale.set(0.5, 0.5, 0.5);
            this.rockets[1].position.x = 3.5;
            this.rockets[1].position.y = 1.75;
            this.rockets[1].rotation.x = 0.5*Math.PI;
         }
         this.plane.add(this.rockets[0]);
         this.plane.add(this.rockets[1]);
         this.timeSetRockets = window.performance.now();
      }
      else if (this.hasRockets) {
         this.plane.remove(this.rockets[0]);
         this.plane.remove(this.rockets[1]);
      }
      else {
         console.warn("cannot remove the rockets");
      }
      this.hasRockets = hasRockets;
   }

   setIntersectObjects (intersect_objects) {
      this.intersect_objects = intersect_objects;
   }

   setFlightInstruments (flightInstruments) {
      this.flightInstruments = flightInstruments;
   }

   mouseMove (x, y, width, height) {
      x = (x - 0.5*width)/(0.5*width);
      y = (y - 0.5*height)/(0.5*height);
      this.mouseMoveCentered (x, y);
   }

   mouseMoveCentered (x, y) {
      this.elevators.rotation.x = 0.25*y*Math.PI;
      this.aileron_left.rotation.x = -0.25*x*Math.PI;
      this.aileron_right.rotation.x = 0.25*x*Math.PI;
   }

   keyUp (event) {
      this.keyUpString(event.key);
   }

   keyUpString (key) {
      switch (key) {
         case "+":
            this.increaseThrottle (false);
            break;
         case "-":
            this.decreaseThrottle (false);
            break;
         case "ArrowLeft":
            this.arrowLeft = false;
            break;
         case "ArrowRight":
            this.arrowRight = false;
            break;
         case "b":
            this.brakes = false;
            break;
         case "c":
            this.cameraIndex++;
            if (this.cameraIndex > 1) {
               this.cameraIndex = 0;
            }
            this.updateGainValues ();
            if (this.cameraIndex == 0) {
               selectCameraPositionSpan ("cockpit", false);
               scene.remove(this.camera);
               this.add(this.camera);
               this.camera.position.copy(this.cockpitCameraPosition);
               this.camera.rotation.set (0, Math.PI, 0);
               this.setCameraCallback (this.camera);
               this.updateCameraBehindVehicle = false;
            }
            else {
               selectCameraPositionSpan ("behind", false);
               this.remove(this.camera);
               this.updateCameraBehindVehicle = true;
               scene.add(this.camera);
               this.setCameraCallback (this.camera);
            }
            break;
         case "s":
            this.resetTransform ();
            break;
      }
   }

   keyDown (event) {
      this.keyDownString (event.key);
   }

   keyDownString (key) {
      switch (key) {
         case "+":
            this.increaseThrottle (true);
            break;
         case "-":
            this.decreaseThrottle (true);
            break;
         case "ArrowLeft":
            this.arrowLeft = true;
            break;
         case "ArrowRight":
            this.arrowRight = true;
            break;
         case "b":
            this.brakes = true;
            break;
      }
   }

   updateGainValues () {
      if (this.cameraIndex === 0) {
               this.gainIntakeLeft.value = 0.1;
               this.gainEngineBlockVibrationsLeft.value = 1.0;
               this.gainOutletLeft.value = 1.0;

               this.gainIntakeRight.value = 0.1;
               this.gainEngineBlockVibrationsRight.value = 1.0;
               this.gainOutletRight.value = 1.0;
      }
      else {
               this.gainIntakeLeft.value = 0.1;
               this.gainEngineBlockVibrationsLeft.value = 1.0;
               this.gainOutletLeft.value = 1.0;

               this.gainIntakeRight.value = 0.1;
               this.gainEngineBlockVibrationsRight.value = 1.0;
               this.gainOutletRight.value = 1.0;
      }

   }

   startEngine () {
      console.log ("startEngine");
      this.engine_started = true;
      this.throttle = 0.1;
      var rpm = 750;
      var angularVelocity = rpm/60*2*Math.PI;
      this.propeller_right_speed = angularVelocity;
      this.propeller_left_speed = angularVelocity;
   }

   stopEngine () {
      console.log ("stopEngine");
      this.throttle = 0;
      this.engine_started = false;
   }

   increaseThrottle (value) {
      if (!value) {
         this.deactivate_increase_throttle = true;
         return;
      }
      this.increase_throttle = value;
   }

   decreaseThrottle (value) {
      if (!value) {
         this.deactivate_decrease_throttle = true;
         return;
      }
      this.decrease_throttle = value;
   }

   moveUpElevator (value) {
      this.move_up_elevator = value;
   }

   moveDownElevator (value) {
      this.move_down_elevator = value;
   }

   updateFlightControlSurfaces (interval) {
      if (this.move_up_elevator) {
         if (this.elevators.rotation.x < Math.PI/4) {
            this.elevators.rotation.x += interval/1000;
            if (this.elevators.rotation.x > Math.PI/4) {
               this.elevators.rotation.x = Math.PI/4;
            }
         }

         if (this.deactivate_move_up_elevator) {
            this.move_up_elevator = false;
            this.deactivate_move_up_elevator = false;
         }
      }
      else if (this.move_down_elevator) {
         if (this.elevators.rotation.x > -Math.PI/4) {
            this.elevators.rotation.x -= interval/1000;
            if (this.elevators.rotation.x < -Math.PI/4) {
               this.elevators.rotation.x = -Math.PI/4;
            }
         }
      }

      if (this.deactivate_move_down_elevator) {
         this.move_down_elevator = false;
         this.deactivate_move_down_elevator = false;
      }
   }

   updateThrottle (interval) {

      if (this.engine_started == false) {
         this.throttle = 0;
         return;
      }

      if (this.increase_throttle) {
         if (this.throttle < 1) {
            this.throttle += interval/1000;
            if (this.throttle > 1) {
               this.throttle = 1;
            }
         }

         if (this.deactivate_increase_throttle) {
            this.increase_throttle = false;
            this.deactivate_increase_throttle = false;
         }
      }
      else if (this.decrease_throttle) {
         if (this.throttle > 0.1) {
            this.throttle -= interval/1000;
            if (this.throttle < 0.1) {
               this.throttle = 0.1;
            }
         }

         if (this.deactivate_decrease_throttle) {
            this.decrease_throttle = false;
            this.deactivate_decrease_throttle = false;
         }
      }
   }

   takeOffRigidBodyDynamics () {
      if (this.elevators_set==undefined && this.metersPerSecondToKnots (this.speed) >= 110) {
         this.elevators.rotation.x = Math.PI/4;
         this.start_altitude = this.plane_scene.position.y;
         this.elevators_set = 0;
      }
      else if (this.elevators_set==0 && this.plane_scene.rotation.x <= Math.PI/180*350 &&
                                        this.plane_scene.rotation.x > Math.PI) {
         this.elevators.rotation.x = 0;
         this.elevators_set = 1;
      }
      else if (this.elevators_set==1 && this.plane_scene.position.y-this.start_altitude >= 100) {
         this.elevators.rotation.x = -Math.PI/4;
         this.elevators_set = 2;
      }
      else if (this.elevators_set==2 && this.plane_scene.rotation.x <= 0.25*Math.PI) {
         this.elevators.rotation.x = 0;
         this.elevators_set = 3;
         this.updatesPerSeconds = 60;
         return false;
      }
      else if (this.elevators_set==3) {
         return false;
      }
      return true;
   }

   takeOff () {
      if (this.elevators_set==undefined && this.metersPerSecondToKnots (this.speed) >=
          3/4*this.speed_lift_gravity_equal) {
         this.elevators.rotation.x = Math.PI/4;
         this.start_altitude = this.plane_scene.position.y;
         this.elevators_set = 0;
      }
      else if (this.elevators_set==0 && this.plane_scene.rotation.x <= -2*Math.PI/360*10) {
         this.elevators.rotation.x = 0;
         this.plane_scene.rotation.x = -2*Math.PI/360*10;
         this.elevators_set = 1;
      }
      else if (this.elevators_set==1 && this.plane_scene.position.y-this.start_altitude >= 100) {
         this.elevators.rotation.x = -Math.PI/4;
         this.elevators_set = 2;
      }
      else if (this.elevators_set==2 && this.plane_scene.rotation.x >= -0.01) {
         this.elevators.rotation.x = 0;
         this.plane_scene.rotation.x = 0;
         this.elevators_set = 3;
         return false;
      }
      return true;
   }

   getMotorFuelConsumptionPercentagePerSecond3d () {
      var rightMotorConsumption = this.propeller_right_speed/(2*Math.PI)*60/this.motorMaxKWRpm;
      var leftMotorConsumption = this.propeller_left_speed/(2*Math.PI)*60/this.motorMaxKWRpm;
      return 0.25*this.throttle*(rightMotorConsumption+leftMotorConsumption);
   }

   updateFuelLevel3d (interval) {
      var fuelConsumption = this.getMotorFuelConsumptionPercentagePerSecond3d ();
      this.fuelPercentage -= interval*fuelConsumption;
      if (this.fuelPercentage < 0) {
         this.fuelPercentage = 0;
      }
      setFuelPercentage (this.fuelPercentage);
   }

   getMotorFuelConsumptionPercentagePerSecond () {
      var rightMotorConsumption = this.propeller_right_speed/(2*Math.PI)*60/this.motorMaxKWRpm;
      var leftMotorConsumption = this.propeller_left_speed/(2*Math.PI)*60/this.motorMaxKWRpm;
      return 0.7*this.throttle*(rightMotorConsumption+leftMotorConsumption);
   }

   updateFuelLevel (interval) {
      var fuelConsumption = this.getMotorFuelConsumptionPercentagePerSecond ();
      this.fuelPercentage -= interval/1000*fuelConsumption;
      if (this.fuelPercentage < 0) {
         this.fuelPercentage = 0;
      }
      setFuelPercentage (this.fuelPercentage);
   }

   getMotorPower (throttle, current_rounds_per_minute) {
      if (this.fuelPercentage === 0) {
         return 0;
      }
      throttle = throttle*(1-0.05+0.1*Math.random ());

      if (current_rounds_per_minute > 2750) {
         throttle = 0;
      }
      let x = (1/this.motorMaxKWRpm*current_rounds_per_minute-1);
      return -this.motorMaxW*throttle*x*x+this.motorMaxW*throttle;
   }

   getMotorTorque (throttle, current_rounds_per_minute) {
      let angular_velocity = current_rounds_per_minute/60*Math.PI;
      let torque = this.getMotorPower (throttle, current_rounds_per_minute)/angular_velocity;
      if (isNaN (torque)) {
         torque = 0;
      }
      return torque;
   }

   /*
    * computes the atmospperic density depending on the current altitude
    * https://en.wikipedia.org/wiki/Barometric_formula
    */
   getAtmosphericDensity () {
      let altitude = this.plane_scene.position.y;
      if (Math.abs(this.altitude-altitude)<0.5) {
         return this.atmosphericDensity;
      }

      let densitySeaLevel = 1.225;
      let standardTemperature = 288.15;
      let temperatureLapseRate = -0.0065;
      let universalGasConstant = 8.3144598;
      let g = 9.81;
      let airMolarMass = 0.0289644;
      this.altitude = altitude;
      this.atmosphericDensity = 1.225;
      return densitySeaLevel*Math.pow((standardTemperature+temperatureLapseRate*altitude)/standardTemperature,
                -g*airMolarMass/(universalGasConstant*temperatureLapseRate));
   }

   /*
    * uses the blade element momentum theory for calcuting the thrust and torque generated
    * by the propeller
    */
   getBladeElementTheoryThrustAndTorque (elements, airDensity, airSpeed, propellerBlades,
                                               propellerRadius, propellerPitch, bladeChord, angularVelocity) {
      let thrust = 0;
      let torque = 0;

      if (airSpeed < 0.1) {
         airSpeed = 0.1;
      }

      let radiusInterval = propellerRadius/elements;
      let elementRadius = radiusInterval/2;
      let zeroLiftDragCoefficient = 0.01;
      for (let i=0; i<elements; i++) {
         let phi = Math.atan (propellerPitch/(2*Math.PI*elementRadius));
         let axialInductionFactor = 0.01;
         let tangentialInductionFactor = 0.01;

         let thrustElement;
         let torqueElement;

         for (let i=0; i<1000; i++) {
            let v_axial = airSpeed*(1+axialInductionFactor);
            let v_tangential = angularVelocity*elementRadius*(1-tangentialInductionFactor);
            let beta = Math.atan2 (v_axial, v_tangential);
            let alpha = phi-beta; // angle of attack;

            let liftCoefficient = 2*Math.PI*alpha*0.8;
            let v_apparentWindSpeed = Math.sqrt(v_axial*v_axial+v_tangential*v_tangential);
            let dragCoefficient = zeroLiftDragCoefficient+0.2*liftCoefficient*liftCoefficient;

            // delta*F_thrust = delta*L*sin(beta)-delta*D*cos(beta)
            // delta*L = 0.5*c_L*rho*v_apparent_wind_speed^2*propeller_blades*blade_chord
            // delta*D = 0.5*c_D*rho*v_apparent_wind_speed^2*propeller_blades*blade_chord
            thrustElement = 0.5*airDensity*v_apparentWindSpeed*v_apparentWindSpeed*propellerBlades*bladeChord*
                                    (liftCoefficient*Math.cos (beta)-
                                     dragCoefficient*Math.sin (beta));
            // delta*F_thrust = 4*pi*rho*v_apparent_wind_speed^2*(1+axialInductionFactor)*axialInductionFactor
            // axialInductionFactor = 4*pi*rho*v_air_speed^2*(1+axialInductionFactor)/(delta*F_thrust)
            let axialInductionFactorNew = 0.5*(axialInductionFactor+thrustElement/(4*Math.PI*elementRadius*airDensity*airSpeed*airSpeed*(1+axialInductionFactor)));

            // delta*F_torque = delta*L*cos(beta)+delta*D*sin(beta)
            // torque = force*radius
            torqueElement = elementRadius*0.5*airDensity*v_apparentWindSpeed*v_apparentWindSpeed*propellerBlades*bladeChord*elementRadius*
                                    (dragCoefficient*Math.cos (beta) + liftCoefficient*Math.sin (beta));
            // delta*torque = 4*pi*radius^3*v_air_speed*angular_velocity*(1+axial_induction_factor)*tangential_induction_factor
            // tangential_induction_factor = 4*pi*radius^3*v_air_speed*angular_velocity*(1+axial_induction_factor/(delta*torque)
            let tangentialInductionFactorNew = 0.5*(tangentialInductionFactor+torqueElement/(4*Math.PI*Math.pow (elementRadius, 3)*airDensity*airSpeed*angularVelocity*(1+axialInductionFactor)));

            if (Math.abs (axialInductionFactorNew-axialInductionFactor)<0.001 &&
                Math.abs (tangentialInductionFactorNew-tangentialInductionFactor)<0.001) {
               break;
            }
            axialInductionFactor = axialInductionFactorNew;
            tangentialInductionFactor = tangentialInductionFactorNew;
         }

         thrust += radiusInterval*thrustElement;
         torque += radiusInterval*torqueElement;

         elementRadius += radiusInterval;
      }

      if (isNaN (thrust)) {
         thrust = 0;
      }
      if (isNaN (torque)) {
         torque = 0;
      }

      return new PropellerValues (thrust, torque);
   }

   getPropellerValues (angular_velocity) {
      return this.getBladeElementTheoryThrustAndTorque (10, this.getAtmosphericDensity (), this.speed, this.propeller_blades,
                                                              this.propeller_radius, this.propeller_pitch, 0.1, angular_velocity);
   }

   updatePropellerAcceleration (interval) {
      let rpm_right = this.propeller_right_speed/(2*Math.PI)*60;
      this.motor_right_torque = this.getMotorTorque (this.throttle, rpm_right);
      let propeller_right_values = this.getPropellerValues (this.propeller_right_speed);
      this.propeller_right_thrust = propeller_right_values.thrust;
      this.propeller_right_torque = propeller_right_values.torque;
      this.propeller_right_acceleration = interval/1000*((this.motor_right_torque-this.propeller_right_torque)/(this.propeller_moment_of_inertia));

      let rpm_left = this.propeller_left_speed/(2*Math.PI)*60;
      this.motor_left_torque = this.getMotorTorque (this.throttle, rpm_left);
      let propeller_left_values = this.getPropellerValues (this.propeller_left_speed);
      this.propeller_left_thrust = propeller_left_values.thrust;
      this.propeller_left_torque = propeller_left_values.torque;
      this.propeller_left_acceleration = interval/1000*((this.motor_left_torque-this.propeller_left_torque)/this.propeller_moment_of_inertia);
   }

   updatePropellerSpeed () {

      this.propeller_right_speed += this.propeller_right_acceleration;
      if (this.propeller_right_speed < 0) {
         this.propeller_right_speed = 0;
      }

      this.propeller_left_speed += this.propeller_left_acceleration;
      if (this.propeller_left_speed < 0) {
         this.propeller_left_speed = 0;
      }
   }

   get_propeller_force () {
      return this.propeller_right_thrust+this.propeller_left_thrust;
   }

   setRunways (runways) {
      this.runways = runways;
   }

   get_rolling_friction () {
     if (this.wheelOnRunway) {
        return 0.001;
     }

      return 0;
   }

   setCollisionDetectionCallback (collisionDetectionCallback) {
      this.collisionDetectionCallback = collisionDetectionCallback;
   }

   performCollisionDetectionRigidBodyDynamics (interval) {
      for (var i=0; i<this.boundingBoxes.length; i++) {
         this.boundingBoxes[i].applyMatrix4 (this.plane_scene);
      }

      for (var i=0; i<this.collisionDetectionSpheres.length; i++) {
         this.collisionDetectionSpheres[i].updatePosition ();
      }

      this.collisionDetectionCallback (interval, this.boundingBoxes, this.collisionDetectionSpheres, null, false);
   }

   performCollisionDetection (interval, lastPosition, new_position) {
      for (var i=0; i<this.boundingBoxes.length; i++) {
         this.boundingBoxes[i].applyMatrix4 (this.planeRotationPosition);
      }

      for (var i=0; i<this.collisionDetectionSpheres.length; i++) {
         this.collisionDetectionSpheres[i].updatePosition ();
      }

      this.collisionDetectionCallback (interval, this.boundingBoxes, this.collisionDetectionSpheres, null);
   }

   wheelCollisionDetectionCallback (cornerOld, corner) {
      if (this.runways != undefined) {
         for (let i=0; i<this.runways.length; i++) {
            if (corner.y <= this.runways[i].runway_scene.position.y+0.01 &&
                corner.z <= this.runways[i].runway_scene.position.z+this.runways[i].length/2 &&
                corner.z >= this.runways[i].runway_scene.position.z-this.runways[i].length/2) {
                this.wheelOnRunway = true;
                return false;
            }
            if (cornerOld.y <= this.runways[i].runway_scene.position.y+0.01 &&
                cornerOld.z <= this.runways[i].runway_scene.position.z+this.runways[i].length/2 &&
                cornerOld.z >= this.runways[i].runway_scene.position.z-this.runways[i].length/2) {
                return false;
            }
         }
      }
      return true;
   }

   getGravitationalForce () {
      return 9.81*this.airplane_mass;
   }

   getLeftWingLiftForce (speed) {
      return speed*speed*(1+0.01*this.flaps.rotation.x+0.01*this.aileron_left.rotation.x)*
               (7/8*this.getGravitationalForce()/2/this.speed_lift_gravity_equal_2);
   }

   getRightWingLiftForce (speed) {
      return speed*speed*(1+0.01*this.flaps.rotation.x+0.01*this.aileron_right.rotation.x)*
               (7/8*this.getGravitationalForce()/2/this.speed_lift_gravity_equal_2);
   }

   getHorizontalStabilizerLiftForce (speed) {
      return 0.25*speed*speed*(1+0.001*this.elevators.rotation.x)*
               (7/8*this.getGravitationalForce()/2/this.speed_lift_gravity_equal_2);
   }

   getDragYAxis () {
      return 0;
   }

   getDragZAxis (speed_z) {
      let drag_z_axis_coefficient = 1;
      if (speed_z >= 0) {
         return speed_z*speed_z*drag_z_axis_coefficient;
      }

      return -speed_z*speed_z*drag_z_axis_coefficient;
   }

   getLiftInducedDrag () {
      return this.total_lift*0;
   }

   _getAttitude () {
      this.plane_scene.updateMatrixWorld ();
      let elements = this.plane_scene.matrixWorld.elements;

      let tmp = Math.sqrt(elements[8]*elements[8]+elements[10]*elements[10]);
      if (elements[5] < 0) {
         tmp = -tmp;
      }

      let pitch = -Math.atan2 (elements[9], tmp);

      this._vector2d.set(elements[8], elements[10])
                     .normalize();
      let heading = Math.atan2 (this._vector2d.x, this._vector2d.y);

      tmp = Math.sqrt (elements[0]*elements[0]+elements[2]*elements[2]);

      let roll;
      if (elements[5] >= 0) {
         roll = Math.atan2 (elements[1], tmp);
      }
      else {
         roll = Math.atan2 (-elements[1], tmp);
      }

      return {pitch: pitch, heading: heading, roll: roll};
   }

   knotsToMetersPerSecond (value) {
      return value*0.514;
   }

   metersPerSecondToKnots (value) {
      return value/0.514;
   }

   updatePlaneValues (interval) {
      this.updateFlightControlSurfaces (interval);
      this.updatePropellerAcceleration (interval);
      this.updatePropellerSpeed ();

      var intervalSeconds = 0.001*interval;
      this.propeller_right.rotation.y -= intervalSeconds*this.propeller_right_speed;
      this.propeller_left.rotation.y += intervalSeconds*this.propeller_left_speed;

      let position_x = 0;
      let position_y = 0;
      let position_z = 1;
      let rotation_x = this.planeRotationPosition.rotation.x;
      let rotation_y = this.planeRotationPosition.rotation.y;
      let rotation_z = this.planeRotationPosition.rotation.z;

      this.planeRotationPosition.worldToLocal (this.velocity);
      this.origin.set (0, 0, 0);
      this.planeRotationPosition.worldToLocal (this.origin);
      this.velocity.sub (this.origin);
      this.speed = this.velocity.z;
      let airplane_acceleration = interval/1000*(this.get_propeller_force() / this.airplane_mass);
      if (airplane_acceleration > 0) {
         this.speed += airplane_acceleration;
      }
      this.speed -= interval/1000*(this.getDragZAxis (this.velocity.z)+this.getLiftInducedDrag ())/this.airplane_mass;
      this.velocity.x = this.velocity.x/2;
      this.velocity.y = 0.95*this.velocity.y;
      this.velocity.z = this.speed;

      let rolling_friction = this.get_rolling_friction ();
      if (rolling_friction >= 0.001) {
         this.velocity.x = this.velocity.x*(1-(interval/1000)*rolling_friction);
         this.velocity.y = this.velocity.y*(1-(interval/1000)*rolling_friction);
         this.velocity.z = this.velocity.z*(1-(interval/1000)*rolling_friction);
         this.speed = this.velocity.z;
      }

      let speed_knots = this.metersPerSecondToKnots (this.speed);
      let left_wing_lift_force = this.getLeftWingLiftForce (speed_knots);
      let right_wing_lift_force = this.getRightWingLiftForce (speed_knots);
      let wings_lift_force = left_wing_lift_force+right_wing_lift_force;
      let horizontal_stabilizer_lift_force = this.getHorizontalStabilizerLiftForce (speed_knots);

      this.total_lift = wings_lift_force+horizontal_stabilizer_lift_force;

      let gravitational_force = this.getGravitationalForce ();
      if (rolling_friction < 0.001 || 7/8*gravitational_force < wings_lift_force || true) {
         if (!this.lift_and_gravity_deactivated) {
            this.velocity.y += interval/1000*((wings_lift_force+horizontal_stabilizer_lift_force)/this.airplane_mass);
         }
         this.planeRotationPosition.rotation.x -= interval/1000*Math.atan((horizontal_stabilizer_lift_force-1/8*wings_lift_force)/5);

         if (this.planeRotationPosition.rotation.x >= 2*Math.PI) {
            this.planeRotationPosition.rotation.x -= 2*Math.PI;
         }
         else if (this.planeRotationPosition.rotation.x <= -2*Math.PI) {
            this.planeRotationPosition.rotation.x += 2*Math.PI;
         }
      }

      this.planeRotationPosition.updateMatrixWorld ();

      this.planeRotationPosition.localToWorld (this.velocity);
      this.origin.set (0, 0, 0);
      this.planeRotationPosition.localToWorld (this.origin);
      this.velocity.sub (this.origin);

      if (!this.lift_and_gravity_deactivated) {
         this.velocity.y -= interval/1000*(gravitational_force/this.airplane_mass);
      }

      let current_speed_x = interval/1000*this.velocity.x;
      let current_speed_y = interval/1000*this.velocity.y;
      let current_speed_z = interval/1000*this.velocity.z;

      let lastPosition = this.planeRotationPosition.position.clone ();

      this.planeRotationPosition.position.x += current_speed_x;
      this.planeRotationPosition.position.y += current_speed_y;
      this.planeRotationPosition.position.z += current_speed_z;

     if (this.collisionDetectionCallback != undefined) {
        this.wheelOnRunway = false;
        this.planeRotationPosition.updateMatrixWorld ();
        this.performCollisionDetection (interval, lastPosition, this.planeRotationPosition.position);
        if (this.wheelOnRunway) {
           this.velocity.y = 0;
        }
     }
   }

   setParticleGroundDistanceCallback(particleGroundDistanceCallback) {
      this.particleGroundDistanceCallback = particleGroundDistanceCallback;
   }

   updateValuesRigidBodyDynamics (time, interval) {
      this.takeOffRigidBodyDynamics ();
      interval = interval/1000;

      this.updateFlightControlSurfaces (1000*interval);
      this.updatePropellerAcceleration (1000*interval);
      this.updatePropellerSpeed ();
      this.propeller_right.rotation.y -= interval*this.propeller_right_speed;
      this.propeller_left.rotation.y += interval*this.propeller_left_speed;

      var speedKnots = this.metersPerSecondToKnots(this.speed);

      var angleOfAttack = this._getAngleOfAttack();
      var angleOfAttackWings = angleOfAttack+5/360*2*Math.PI;
      while (angleOfAttack>2*Math.PI) {
         angleOfAttack -= 2*Math.PI;
      }
      while (angleOfAttack<0) {
         angleOfAttack+= 2*Math.PI;
      }

      while (angleOfAttackWings>2*Math.PI) {
         angleOfAttackWings -= 2*Math.PI;
      }
      while (angleOfAttackWings<0) {
         angleOfAttackWings += 2*Math.PI;
      }

      var wingsLift = this._getWingsLift(angleOfAttackWings);
      var wingsDrag = this._getWingsDrag(angleOfAttackWings);
      var wingsNormalForce = this._getNormalForce(wingsLift, wingsDrag, angleOfAttackWings);
      var wingsAxialForce = this._getAxialForce(wingsLift, wingsDrag, angleOfAttackWings);
      this.particleWings.force.set(0, wingsNormalForce, wingsAxialForce)
                              .sub(this.particleWings.position)
                              .applyQuaternion(this.plane_scene.quaternion)
                              .add(this.particleWings.position);
      this.particleWings.force.y -= this.wingsMass*this.g;

      var angleOfAttackHorizontalStabilizer = angleOfAttack-5/360*2*Math.PI-0.25*this.elevators.rotation.x;
      while (angleOfAttackHorizontalStabilizer>2*Math.PI) {
         angleOfAttackHorizontalStabilizer -= 2*Math.PI;
      }
      while (angleOfAttackHorizontalStabilizer<0) {
         angleOfAttackHorizontalStabilizer += 2*Math.PI;
      }

      var horizontalStabilizerLift = this._getHorizontalStabilizerLift(angleOfAttackHorizontalStabilizer);
      var horizontalStabilizerDrag = this._getHorizontalStabilizerDrag(angleOfAttackHorizontalStabilizer);
      var horizontalStabilizerNormalForce = this._getNormalForce(horizontalStabilizerLift, horizontalStabilizerDrag, angleOfAttackHorizontalStabilizer);
      var horizontalStabilizerAxialForce = this._getAxialForce(horizontalStabilizerLift, horizontalStabilizerDrag, angleOfAttackHorizontalStabilizer);

      this.particleHorizontalStabilizer.force.set(0, horizontalStabilizerNormalForce, horizontalStabilizerAxialForce)
                              .sub(this.particleHorizontalStabilizer.position)
                              .applyQuaternion(this.plane_scene.quaternion)
                              .add(this.particleHorizontalStabilizer.position);
      this.particleHorizontalStabilizer.force.y -= this.horizontalStabilizerMass*this.g;

      // subtract the drag from the force on particleMotor
      var drag = 0.5*this.getAtmosphericDensity()*this.speed*this.speed*1.5;
      var rocketsForce = 0;
      if (this.hasRockets) {
         if (time-this.timeSetRockets > 5000) {
            this.setRockets(false);
         }
         else {
            rocketsForce = 50000;
         }
      }
      this.particleMotor.force.set(0, 0, this.get_propeller_force()+rocketsForce-drag)
                              .sub(this.particleMotor.position)
                              .applyQuaternion(this.plane_scene.quaternion)
                              .add(this.particleMotor.position);

      this.updateThrottle (1000*interval);

      var updateIntervalSeconds = 1.0/this.updatesPerSeconds;
      RigidBodyDynamics2d.performStep(updateIntervalSeconds, this.plane_scene, this.particleSystem, this.particleGroundDistanceCallback);

      this.velocity.copy(this.particleSystem.velocity);
      this.plane_scene.updateMatrixWorld();
      this.plane_scene.worldToLocal (this.velocity);
      this.origin.set (0, 0, 0);
      this.plane_scene.worldToLocal (this.origin);
      this.velocity.sub (this.origin);
      this.speed = this.velocity.z;

      if (this.consumesFuel) {
         this.updateFuelLevel (1000*interval);
      }

      if (this.collisionDetectionCallback != undefined) {
         this.wheelOnRunway = false;
         this.performCollisionDetectionRigidBodyDynamics (1000*interval);
      }
   }

   updateLights (time) {
      if (Math.floor (time/750) % 2) {
         this.white_strobe_material.emissiveIntensity = time%750<100?1:0;
      }
      else {
         this.white_strobe_material.emissiveIntensity = 0;
      }

      this.whiteStrobeRightTextureMaterial.opacity = this.white_strobe_material.emissiveIntensity;
      this.whiteStrobeLeftTextureMaterial.opacity = this.white_strobe_material.emissiveIntensity;
      this.whiteStrobeTailTextureMaterial.opacity = this.white_strobe_material.emissiveIntensity;

      if (Math.floor ((time+500)/1000) % 2) {
         this.red_strobe.material.emissiveIntensity = (time+500)%1000<100?1:0;
      }
      else {
         this.red_strobe.material.emissiveIntensity = 0;
      }

      this.redStrobeTextureMaterial.opacity = this.red_strobe.material.emissiveIntensity;
   }

   animateRigidBodyDynamics (time, animate_time, interval) {

      if (this.animateTime == null) {
         this.animateTime = time;
         this.lastFrame = time;
         this.plane_scene.updateMatrixWorld();
         this.particleSystem.applyMatrix4(this.plane_scene);
         this.particleSystem.setPivotPointAtCenterOfMass(this.plane_scene, this.centerOfMass);
//         this.particleSystem.addPoints(this.plane_scene, 0);

         this.plane_scene.updateMatrixWorld ();
         for (var i=0; i<this.boundingBoxes.length; i++) {
            this.boundingBoxes[i].applyMatrix4 (this.plane_scene);
         }
         for (var i=0; i<this.collisionDetectionSpheres.length; i++) {
            this.collisionDetectionSpheres[i].updatePosition ();
         }
      }

      this.updateLights (time);

      var updateInterval = 1000.0/this.updatesPerSeconds;
      var lastFrameInterval = time-this.lastFrame;
      if (lastFrameInterval < updateInterval) {
         return;
      }

      var frames = Math.floor (lastFrameInterval/updateInterval);
      for (var i=0; i<frames; i++) {
         this.updateValuesRigidBodyDynamics (time, updateInterval);
      }

      this.rpmParamLeft.value = Math.min(2500.0, this.propeller_left_speed/(2*Math.PI)*60);
      this.rpmParamRight.value = Math.min(2500.0, this.propeller_right_speed/(2*Math.PI)*60);

      this.lastFrame += frames*updateInterval;
      this.animateTime = time;

      if (this.flightInstruments != null) {
         let attitude = this._getAttitude();
         this.flightInstruments.update (frames*updateInterval,
                              this.metersPerSecondToKnots(this.plane_scene.position.y),
                              attitude.pitch, attitude.heading, attitude.roll,
                              this.throttle,
                              this.metersPerSecondToKnots(this.speed));
      }
   }

   resumeAnimation (time) {
      this.lastFrame = time;
   }

   animate (time, animate_time, interval) {
      if (this.animateTime == null) {
         this.animateTime = time;
         this.lastFrame = time;
         this.lastPosition.copy (this.plane_scene.position);
         this.lastRotation.copy (this.plane_scene.rotation);
         this.planeRotationPosition.position.copy (this.plane_scene.position);
         this.planeRotationPosition.rotation.copy (this.plane_scene.rotation);
         this.plane_scene.updateMatrixWorld ();
         for (var i=0; i<this.boundingBoxes.length; i++) {
            this.boundingBoxes[i].applyMatrix4 (this.planeRotationPosition);
         }
         for (var i=0; i<this.collisionDetectionSpheres.length; i++) {
            this.collisionDetectionSpheres[i].updatePosition ();
         }
         return;
      }

      this.updateLights (time);

      var updatesPerSeconds = 30.0;
      var updateInterval = 1000.0/updatesPerSeconds;

      this.updateThrottle (interval);

      var lastFrameInterval = time-this.lastFrame;
      if (lastFrameInterval < updateInterval) {
         return;
      }

      var frames = Math.floor (lastFrameInterval/updateInterval);
      for (var i=0; i<frames; i++) {
         this.updatePlaneValues (updatesPerSeconds);
      }
      this.plane_scene.position.copy (this.planeRotationPosition.position);
      this.plane_scene.rotation.copy (this.planeRotationPosition.rotation);

      if (this.consumesFuel) {
         this.updateFuelLevel (frames*updateInterval);
      }

      if (this.cockpit != null) {
         let attitude = this._getAttitude();
         this.cockpit.update (frames*updateInterval,
                              this.metersPerSecondToKnots(this.plane_scene.position.y),
                              attitude.pitch, attitude.heading, attitude.roll,
                              this.throttle,
                              this.metersPerSecondToKnots(this.speed));
      }

      this.lastFrame += frames*updateInterval;
      this.animateTime = time;
   }
}

Plane.gltf_plane = null;

export default Plane;