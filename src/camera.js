/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';

var DefaultFilter = 1;
var StaticFilter = 2;
var AllFilter = -1;
var RigidBodyFilter = 64;

class Camera {

   static vectorCameraPosition = null;
   static vectorCameraTargetPosition = null;
   static closestRayResultCallback = null;

   /*
    * Updates the camera so that it is behind obj and looks at obj.
    * The distance to obj is specified with yOffset.
    * If there is another object between the camera's position
    * and obj's position, the distance is reduced, so that obj is visible.
    */
   static updateCameraBehindObject(physicsWorld, obj, camera, yOffset=0) {
      if (!this.closestRayResultCallback) {
         this.vectorCameraPosition = new Ammo.btVector3();
         this.vectorCameraTargetPosition = new Ammo.btVector3();
         this.closestRayResultCallback = new Ammo.ClosestRayResultCallback(null, null);
      }

      let cameraHorizontalDistance = -10;
      let cameraVerticalDistance = 5;
      if (obj.cameraHorizontalDistance!==undefined) {
         cameraHorizontalDistance = obj.cameraHorizontalDistance;
      }
      if (obj.cameraVerticalDistance!==undefined) {
         cameraVerticalDistance = obj.cameraVerticalDistance;
      }
      // get the direction of the z-axis
      let unitVector3 = new THREE.Vector3 (0, 0, 1);
      unitVector3.applyQuaternion (obj.quaternion);
      let unitVector2 = new THREE.Vector2 (unitVector3.x, unitVector3.z);
      unitVector2.normalize ();
      let angleY = Math.atan2(unitVector2.x, unitVector2.y);
      camera.position.set (obj.position.x+Math.sin(angleY)*cameraHorizontalDistance,
                           obj.position.y+cameraVerticalDistance,
                           obj.position.z+Math.cos(angleY)*cameraHorizontalDistance);
      camera.rotation.y = Math.PI+angleY;

      this.vectorCameraPosition.setValue(camera.position.x, camera.position.y, camera.position.z);
      this.vectorCameraTargetPosition.setValue(obj.position.x, obj.position.y+yOffset, obj.position.z);
      this.closestRayResultCallback.set_m_closestHitFraction(1);
      this.closestRayResultCallback.set_m_collisionObject(null);
      this.closestRayResultCallback.set_m_collisionFilterGroup(DefaultFilter);
      this.closestRayResultCallback.set_m_collisionFilterMask(RigidBodyFilter);
      this.closestRayResultCallback.get_m_rayFromWorld().setValue(camera.position.x, camera.position.y, camera.position.z);
      this.closestRayResultCallback.get_m_rayToWorld().setValue(obj.position.x, obj.position.y+yOffset, obj.position.z);
      physicsWorld.rayTest(this.vectorCameraPosition, this.vectorCameraTargetPosition,
                                this.closestRayResultCallback);
      let collisionObject = this.closestRayResultCallback.get_m_collisionObject();
      if (this.closestRayResultCallback.hasHit() && collisionObject) {
          collisionObject = Ammo.castObject(collisionObject, Ammo.btRigidBody);
         if (collisionObject!==obj.rigidBody) {
            let point = this.closestRayResultCallback.get_m_hitPointWorld();
            let x = point.x()-camera.position.x;
            let y = point.y()-camera.position.y;
            let z = point.z()-camera.position.z;
            let objectDistance = Math.sqrt(x*x+y*y+z*z);
            if (objectDistance<9.75) {
                let tmp = cameraHorizontalDistance;
                cameraHorizontalDistance += objectDistance+0.25;
                cameraVerticalDistance = (0.5+0.5*cameraHorizontalDistance/tmp)*cameraVerticalDistance;
                camera.position.set (obj.position.x+Math.sin(angleY)*cameraHorizontalDistance,
                                     obj.position.y+cameraVerticalDistance,
                                     obj.position.z+Math.cos(angleY)*cameraHorizontalDistance);
            }
         }
      }
   }
}

export default Camera;