/*
 * Copyright (c) 2021-2022 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/blob/main/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';

var DISABLE_DEACTIVATION = 4;

var DefaultFilter = 1;
var StaticFilter = 2;
var AllFilter = -1;
var RigidBodyFilter = 64;

class Vehicle extends THREE.Object3D {

   constructor () {
      super ();
      this.game = null;
      this.pilot = null;
      this.vehicleName = "vehicle";
      this.mass = null;
      this.centerOfMass = null;
      this.rigidBody = null;
      this.tuning = null;
      this.raycastVehicle = null;
      this.lastPositionOnGround = new THREE.Vector3 (0, 0, 0);
      this.lastRotationOnGround = new THREE.Euler (0, 0, 0);
      this.lastTimeWheelsOnGround = window.performance.now ();
      this.wheels = [];
   }

   disposeObjects () {
      console.warn ("disposeObjects not implemented");
   }

   _createCompoundShape () {
      this.compoundShape = new Ammo.btCompoundShape();
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
      ghostObject.type = "vehicle";
      ghostObject.vehicle = this;
      this.ghostObjectSphere = ghostObject;
      this.game.physicsWorld.addCollisionObject (ghostObject, StaticFilter, AllFilter^StaticFilter^RigidBodyFilter);
   }

   _updateGhostObjectSphere () {
      let transform = this.ghostObjectSphere.getWorldTransform()
      transform.getOrigin().setValue(this.position.x, this.position.y, this.position.z);
      this.ghostObjectSphere.setWorldTransform (transform);
   }

   _createRigidBody () {
      let transform = new Ammo.btTransform ();
      transform.setOrigin (new Ammo.btVector3 (this.position.x,
                                               this.position.y,
                                               this.position.z));
      transform.setRotation (new Ammo.btQuaternion (this.quaternion.x,
                                                    this.quaternion.y,
                                                    this.quaternion.z,
                                                    this.quaternion.w));
      var motionState = new Ammo.btDefaultMotionState (transform);
      var localInertia = new Ammo.btVector3 (0, 0, 0);
      this.compoundShape.calculateLocalInertia (this.mass, localInertia);
      var body = new Ammo.btRigidBody (new Ammo.btRigidBodyConstructionInfo (this.mass, motionState, this.compoundShape, localInertia));
      body.setActivationState (DISABLE_DEACTIVATION);
      this.game.physicsWorld.addRigidBody (body, DefaultFilter | RigidBodyFilter, AllFilter);
      this.rigidBody = body;
   }

   _createRaycastVehicle () {
      var tuning = new Ammo.btVehicleTuning ();
      this.tuning = tuning;
      var vehicleRaycaster = new Ammo.btDefaultVehicleRaycaster (this.game.physicsWorld);
      var vehicle = new Ammo.btRaycastVehicle (tuning, this.rigidBody, vehicleRaycaster);
      vehicle.setCoordinateSystem(0, 1, 2);
      this.raycastVehicle = vehicle;
      this.game.rigidBodies.push (this);
      this.game.physicsWorld.addAction (vehicle);
   }

   _getBoundingBoxSize (object3d) {
      let box3 = new THREE.Box3().setFromObject (object3d);
      let width = box3.max.x-box3.min.x;
      let height = box3.max.y-box3.min.y;
      let depth = box3.max.z-box3.min.z;

      return {width: width, height: height, depth: depth};
   }

   _addWheelFromBoundingBox (object3d, connectionPoint, index, isFrontWheel) {
      let box3 = new THREE.Box3().setFromObject (object3d);
      let x, y, z;

      var suspensionRestLength = 0.5;
      if (connectionPoint == Vehicle.WHEEL_CONNECTION_POINT_UP) {
         x = object3d.position.x;
         y = object3d.position.y+suspensionRestLength;
         z = object3d.position.z;
      }
      else if (connectionPoint == Vehicle.WHEEL_CONNECTION_POINT_LEFT) {
         x = object3d.position.x;
         y = object3d.position.y+suspensionRestLength;
         z = object3d.position.z;
      }
      else if (connectionPoint == Vehicle.WHEEL_CONNECTION_POINT_RIGHT) {
         x = object3d.position.x;
         y = object3d.position.y+suspensionRestLength;
         z = object3d.position.z;
      }
      else {
         console.error ('The value of "connectionPoint" is not valid.');
         return;
      }
      x -= this.centerOfMass.x;
      y -= this.centerOfMass.y;
      z -= this.centerOfMass.z;

      let radius = 0.5*(box3.max.x-box3.min.x);
      var connectionPointCS0 = new Ammo.btVector3 (x, y, z);
      var wheelDirectionCS0 = new Ammo.btVector3 (0, -1, 0);
      var wheelAxleCS = new Ammo.btVector3 (-1, 0, 0);
      var wheelInfo = this.raycastVehicle.addWheel (connectionPointCS0,
                                                    wheelDirectionCS0,
                                                    wheelAxleCS,
                                                    suspensionRestLength,
                                                    radius,
                                                    this.tuning,
                                                    isFrontWheel);

      let suspensionStiffness = 100;
      let suspensionDamping = 10;
      let suspensionCompression = 1000;
      let rollInfluence = 0.01;
      let friction = 100;

      wheelInfo.set_m_suspensionStiffness(suspensionStiffness);
      wheelInfo.set_m_maxSuspensionForce(2*this.mass*9.81);
      wheelInfo.set_m_wheelsDampingCompression(suspensionCompression);
      wheelInfo.set_m_wheelsDampingRelaxation(suspensionDamping);
      wheelInfo.set_m_frictionSlip(friction);
      wheelInfo.set_m_rollInfluence(rollInfluence);

      let wheel = object3d;
      this.wheels.push (wheel);
      this.remove (wheel);
      scene.add (wheel);
   }

   _addRigidBodyFromBoundingBox (object3d) {
      let boundingBox = this._getBoundingBoxSize (object3d);

      var geometry = new Ammo.btBoxShape (new Ammo.btVector3(0.5*boundingBox.width,
                                                             0.5*boundingBox.height,
                                                             0.5*boundingBox.depth));
      let transform = new Ammo.btTransform ();
      transform.setIdentity ();
      transform.setOrigin (new Ammo.btVector3 (object3d.position.x-this.centerOfMass.x,
                                               object3d.position.y-this.centerOfMass.y,
                                               object3d.position.z-this.centerOfMass.z));
      this.compoundShape.addChildShape(transform, geometry);
   }

   changeCamera () {
      throw new Error ("not implemented");
   }

   setActive () {
      throw new Error ("not implemented");
   }

   mouseMove () {
   }

   keyDown () {
      throw new Error ("not implemented");
   }

   keyUp () {
      throw new Error ("not implemented");
   }

   animate () {
      throw new Error ("not implemented");
   }

   handleWheelTouchObject (groundObject) {
   }

   updateTransform () {
      let raycastVehicle = this.raycastVehicle;

      var chassisWorldTransform = raycastVehicle.getChassisWorldTransform ();
      var position = chassisWorldTransform.getOrigin ();
      var quaternion = chassisWorldTransform.getRotation ();
      this.position.set (position.x(), position.y(), position.z());
      this.quaternion.set (quaternion.x(), quaternion.y(), quaternion.z(), quaternion.w());

      let wheelsOnGround = true;

      var n = raycastVehicle.getNumWheels();
      for (let j = 0; j < n; j++) {
         raycastVehicle.updateWheelTransform(j, false);
//         let tm = raycastVehicle.getWheelTransformWS(j);
         let wheelInfo = raycastVehicle.getWheelInfo(j);
         let transform = wheelInfo.get_m_worldTransform();
         let p = transform.getOrigin();
         let q = transform.getRotation();
         this.wheels[j].position.set(p.x(), p.y(), p.z());
         this.wheels[j].quaternion.set(q.x(), q.y(), q.z(), q.w());
         let raycastInfo = wheelInfo.get_m_raycastInfo();
         let groundObject = raycastInfo.get_m_groundObject();
         if (groundObject) {
            groundObject = Ammo.btRigidBody.prototype.upcast(groundObject);
            if (this.handleWheelTouchObject(groundObject.type, groundObject.objectIndex)) {
               wheelsOnGround = false;
               break;
            }
         }
         else {
            wheelsOnGround = false;
         }
      }
      if (wheelsOnGround) {
         this.lastPositionOnGround.copy (this.position);
         this.lastRotationOnGround.copy (this.rotation);
      }
   }
}

Vehicle.WHEEL_CONNECTION_POINT_UP = 0;
Vehicle.WHEEL_CONNECTION_POINT_LEFT = 1;
Vehicle.WHEEL_CONNECTION_POINT_RIGHT = 2;

export default Vehicle;