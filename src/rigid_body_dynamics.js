/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';

class RigidBodyDynamics2d {

   static getTotalForce(particleSystem) {
      particleSystem.totalForce.set(0, 0, 0);
      for(var i=0; i<particleSystem.particles.length; i++) {
         particleSystem.totalForce.add(particleSystem.particlesStart[i].force);
      }
      return particleSystem.totalForce;
   }

   static getTotalTorque(particleSystem, object3d) {
      particleSystem.totalTorque.set(0, 0, 0);
      for(var i=0; i<particleSystem.particles.length; i++) {
         RigidBodyDynamics2d._vector3.crossVectors(RigidBodyDynamics2d._vector3.copy(particleSystem.particles[i].position)
                                                                               .sub(object3d.position),
                                                   particleSystem.particlesStart[i].force);
         particleSystem.totalTorque.add(RigidBodyDynamics2d._vector3);
      }
      return particleSystem.totalTorque;
   }

   static getCollision (particleSystem, collisionDetectionCallback) {
      var index = NaN;
      var distance = NaN;
      for (var i=0; i<particleSystem.particles.length; i++) {
         var currentDistance = collisionDetectionCallback (particleSystem.particlesOld[i].position,
                                                    particleSystem.particles[i].position);
         if (isNaN(distance) || currentDistance < distance) {
            index = i;
            distance = currentDistance;
         }
      }
      return [index, distance];
   }

   static _setPositionRotation (interval, object3d, particleSystem) {
      object3d.rotation.setFromVector3(this._rotation);

      object3d.position.copy(particleSystem.totalForce)
                       .multiplyScalar(interval*1.0/particleSystem.mass);
      object3d.position.add(particleSystem.velocity)
                       .multiplyScalar(interval);
      object3d.position.add(this._position);

      this._angularAcceleration.copy(particleSystem.totalTorque)
                               .multiplyScalar(interval*1.0/particleSystem.inertia);

      this._vector3.copy(particleSystem.angularVelocity)
                   .add(this._angularAcceleration)
                   .multiplyScalar(interval)
                   .add(this._rotation);
      object3d.rotation.setFromVector3(this._vector3);

      object3d.updateMatrixWorld();
      particleSystem.applyMatrix4(object3d);
   }

   static _performStepCollision(interval, object3d, particleSystem, collisionDetectionCallback) {
      RigidBodyDynamics2d.getTotalForce(particleSystem);
      RigidBodyDynamics2d.getTotalTorque(particleSystem, object3d);

      this._position.copy(object3d.position);
      object3d.rotation.toVector3(this._rotation);

      RigidBodyDynamics2d._setPositionRotation(interval, object3d, particleSystem);

      var [index, distance] = RigidBodyDynamics2d.getCollision (particleSystem, collisionDetectionCallback);
      var currentInterval = interval;
      var min = 0.0;
      var max = interval;
      var i = 0;
      var maxIterations = 10;
      while ((distance < 0 || min != max && distance > 0.001) && i < maxIterations) {
         if (distance < 0) {
            max = currentInterval;
            currentInterval = min+0.5*(currentInterval-min);
         }
         else {
            min = currentInterval;
            currentInterval = currentInterval+0.5*(max-currentInterval);
         }
         RigidBodyDynamics2d._setPositionRotation(currentInterval, object3d, particleSystem);
         [index, distance] = RigidBodyDynamics2d.getCollision (particleSystem, collisionDetectionCallback);
         i++;
      }

      if (currentInterval > 0.001*interval) {
         particleSystem.velocity.copy(object3d.position)
                                .sub(this._position)
                                .multiplyScalar(1.0/currentInterval);
         object3d.rotation.toVector3(particleSystem.angularVelocity);
         particleSystem.angularVelocity.sub(this._rotation)
                                       .multiplyScalar(1.0/currentInterval);
      }
      else {
         particleSystem.velocity.y = 0;
         particleSystem.angularVelocity.x = 0;
      }

      return [index, currentInterval];
   }

   static _getParticleVelocity(object3d, particleSystem, index) {
      RigidBodyDynamics2d._particleVelocity.crossVectors(particleSystem.angularVelocity,
                                                         RigidBodyDynamics2d._vector3.copy(particleSystem.particles[index].position)
                                                                                     .sub(object3d.position))
                                                                                     .add(particleSystem.velocity);
   }

   static performStep(interval, object3d, particleSystem, collisionDetectionCallback) {
      var index;
      var currentInterval = 0;
      [index, currentInterval] = RigidBodyDynamics2d._performStepCollision(interval, object3d, particleSystem, collisionDetectionCallback);
      currentInterval = interval-currentInterval;
      var i=0;
      var maxIterations = 1;
      while (i<maxIterations && currentInterval > 0.01 && currentInterval < interval) {
         RigidBodyDynamics2d.getTotalForce(particleSystem);
         RigidBodyDynamics2d.getTotalTorque(particleSystem, object3d);
         RigidBodyDynamics2d._getParticleVelocity(object3d, particleSystem, index);
         var impulse = -this._particleVelocity.y*particleSystem.particlesStart[index].mass;
         var indexOld = index;
         var forceY = particleSystem.particlesStart[index].force.y;
         var radius = particleSystem.particlesStart[index].position.length();
         particleSystem.particlesStart[index].force.y = impulse/currentInterval-(particleSystem.totalForce.y+particleSystem.totalTorque.x*radius);
         var lastInterval = currentInterval;
         [index, currentInterval] = RigidBodyDynamics2d._performStepCollision(currentInterval, object3d, particleSystem, collisionDetectionCallback);
         currentInterval = lastInterval-currentInterval;
         particleSystem.particlesStart[indexOld].force.y = forceY;
         i++;
      }

      if (currentInterval > 0.1*interval) {
         // friction on contact
         var velocityZ = particleSystem.totalForce.z/particleSystem.mass*currentInterval;
         particleSystem.velocity.z += velocityZ;
         object3d.position.z += particleSystem.velocity.z*currentInterval;
      }

      if (object3d.rotation.x>2*Math.PI) {
         object3d.rotation.x -= 2*Math.PI;
      }
      else if (object3d.rotation.x<0) {
         object3d.rotation.x += 2*Math.PI;
      }
   }
}

RigidBodyDynamics2d._vector3 = new THREE.Vector3();
RigidBodyDynamics2d._angularAcceleration = new THREE.Vector3();
RigidBodyDynamics2d._particleVelocity = new THREE.Vector3();
RigidBodyDynamics2d._position = new THREE.Vector3();
RigidBodyDynamics2d._rotation = new THREE.Vector3();

export default RigidBodyDynamics2d;