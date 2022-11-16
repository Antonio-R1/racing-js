/*
 * Copyright (c) 2021-2022 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/blob/main/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';

/*
 * a bounding box class used for collision detection
 */
class BoundingBox {
   /*
    * initializes the corners of the bounding box by using
    * the values from THREE.Box3 of the THREE.Object3d
    * object passed as argument
    * The corners are stored in counterclockwise rotation
    * viewed from the face with the lowest z-values.
    * arguments:
    *   object3d   a THREE.Object3d object for which the
    *              the bounding box should be created
    */
   constructor (object3d) {

      if (!object3d) {
         throw new Error ("object3d not defined");
      }

      this.corners = new Array (8);
      this.cornersStart = new Array (8);
      this.cornersOld = new Array (8);
      this.verticesPositions = null;
      this.object3d = null;
      this.callback = null;
      let box3 = new THREE.Box3().setFromObject (object3d);

      // face with the lower z-coordinate
      this.corners[0] = new THREE.Vector3 (box3.max.x, box3.max.y, box3.min.z);
      this.corners[1] = new THREE.Vector3 (box3.max.x, box3.min.y, box3.min.z);
      this.corners[2] = new THREE.Vector3 (box3.min.x, box3.min.y, box3.min.z);
      this.corners[3] = new THREE.Vector3 (box3.min.x, box3.max.y, box3.min.z);

      // face with the higher z-coordinate
      this.corners[4] = new THREE.Vector3 (box3.max.x, box3.max.y, box3.max.z);
      this.corners[5] = new THREE.Vector3 (box3.max.x, box3.min.y, box3.max.z);
      this.corners[6] = new THREE.Vector3 (box3.min.x, box3.min.y, box3.max.z);
      this.corners[7] = new THREE.Vector3 (box3.min.x, box3.max.y, box3.max.z);

      for (let i=0; i<this.corners.length; i++) {
         this.cornersStart[i] = this.corners[i].clone ();
         this.cornersOld[i] = this.corners[i].clone ();
      }
   }

   getObject3d () {

      if (this.object3d) {
         return this.object3d;
      }

      let geometry = new THREE.BufferGeometry ();
      let vertices = []
      for (let i=0; i<this.corners.length; i++) {
         let corner = this.corners[i];
         vertices.push (corner.x, corner.y, corner.z);
      }
      this.verticesPositions = new THREE.Float32BufferAttribute (vertices, 3);
      geometry.setAttribute ("position", this.verticesPositions);
      var material = new THREE.PointsMaterial ({color: 0xff0000, size: 0.25});
      this.object3d = new THREE.Points (geometry, material);
      return this.object3d;
   }

   applyMatrix4 (object3d) {
      for (let i=0; i<this.corners.length; i++) {
         this.cornersOld[i].copy (this.corners[i]);

         this.corners[i].copy(this.cornersStart[i])
         object3d.localToWorld (this.corners[i]);
      }
   }
}

class Particle {

   constructor (position, mass, force) {
      this.position = position;
      this.mass = mass;
      if (force) {
         this.force = force;
      }
      else {
         this.force = new THREE.Vector3();
      }
      this.normalForce = new THREE.Vector3();
   }

   setForce (x, y, z) {
      this.force.set (x, y, z);
   }

   copy (particle) {
      this.position.copy(particle.position);
   }

   clone () {
      return new Particle(this.position.clone(), this.mass, this.force.clone());
   }
}

class ParticleSystem {
   constructor (particles) {

      if (!particles) {
         throw new Error ("particles not defined");
      }

      var length = particles.length;
      this.particles = new Array (length);
      this.particlesStart = new Array (length);
      this.particlesOld = new Array (length);

      this.mass = 0;
      this.inertia = 0;

      for (let i=0; i<this.particles.length; i++) {
         this.particlesStart[i] = particles[i];
         this.mass += this.particlesStart[i].mass;
      }

      this.centerOfMass = this.getCenterOfMass ();
      for (let i=0; i<this.particles.length; i++) {
         this.particlesStart[i].position.sub(this.centerOfMass);
         var radius2 = this.particlesStart[i].position.x*this.particlesStart[i].position.x+
                          this.particlesStart[i].position.y*this.particlesStart[i].position.y+
                          this.particlesStart[i].position.z*this.particlesStart[i].position.z;
         this.inertia += this.particlesStart[i].mass*radius2;
         this.particles[i] = this.particlesStart[i].clone ();
         this.particlesOld[i] = this.particlesStart[i].clone ();
      }

      this.staticFrictionCoefficient = 1;
      this.kinematicFrictionCoefficient = 1;
      this.velocity = new THREE.Vector3();
      this.angularVelocity = new THREE.Vector3();
      this.totalForce = new THREE.Vector3();
      this.totalTorque = new THREE.Vector3();
   }

   addPoints(object3d, rotationY = 0) {
      var pointsGeometry = new THREE.BufferGeometry ();

      var vertices = [];
      for (let i=0; i<this.particlesStart.length; i++) {
         var particlePosition = this.particlesStart[i].position;
         vertices.push(particlePosition.x, particlePosition.y, particlePosition.z);
      }

      pointsGeometry.setAttribute ("position", new THREE.Float32BufferAttribute (vertices, 3));
      var pointsMaterial = new THREE.PointsMaterial ({color: 0xff0000, size: 0.25});
      pointsMaterial.depthTest = false;
      var objectPoints = new THREE.Points (pointsGeometry, pointsMaterial);
      objectPoints.rotation.y = rotationY;
      objectPoints.renderOrder = 256;
      object3d.add (objectPoints);

      var pointsGeometryCenterOfMass = new THREE.BufferGeometry ();
      var centerOfMass = this.getCenterOfMass();
      vertices = [];
      vertices.push(centerOfMass.x, centerOfMass.y, centerOfMass.z);
      pointsGeometryCenterOfMass.setAttribute ("position", new THREE.Float32BufferAttribute (vertices, 3));
      var pointsMaterialCenterOfMass = new THREE.PointsMaterial ({color: 0xffff00, size: 0.25});
      pointsMaterialCenterOfMass.depthTest = false;
      var objectCenterOfMass = new THREE.Points (pointsGeometryCenterOfMass, pointsMaterialCenterOfMass);
      objectCenterOfMass.rotation.y = rotationY;
      objectCenterOfMass.renderOrder = 256;
      object3d.add (objectCenterOfMass);
   }

   setPivotPointAtCenterOfMass(scene) {
      for (var i=0; i<scene.children.length; i++) {
         scene.children[i].position.x = -this.centerOfMass.x;
         scene.children[i].position.y = -this.centerOfMass.y;
         scene.children[i].position.z = -this.centerOfMass.z;
      }
   }

   getCenterOfMass () {
      var centerOfMass = new THREE.Vector3();
      for(var i=0; i<this.particles.length; i++) {
         centerOfMass.addScaledVector(this.particlesStart[i].position, this.particlesStart[i].mass);
      }
      return centerOfMass.multiplyScalar(1.0/this.mass);
   }

   applyMatrix4 (object3d) {
      for (let i=0; i<this.particles.length; i++) {
         this.particlesOld[i].copy (this.particles[i]);

         this.particles[i].copy(this.particlesStart[i]);
         object3d.localToWorld (this.particles[i].position);
      }
   }
}

class CollisionDetectionSphere {

   constructor (x, y, z, radius) {
      this.object3d = new THREE.Object3D ();
      this.object3d.position.set (x, y, z);
      this.lastPosition = new THREE.Vector3 ();
      this.object3d.getWorldPosition (this.lastPosition);
      this.currentPosition = this.object3d.position.clone ();
      this.object3d.getWorldPosition (this.currentPosition);
      this.radius = radius;
   }

   updatePosition () {
      this.lastPosition.copy (this.currentPosition);
      this.object3d.getWorldPosition (this.currentPosition);
   }

   getObject3d () {
      return this.object3d;
   }

}

class CollisionDetection {

   static getSpheresCollision (x1, y1, z1, radius1, u1, v1, w1,
                               x2, y2, z2, radius2, u2, v2, w2) {
      var a = x2-x1;
      var b = u1-u2;
      var c = y2-y1;
      var d = v1-v2;
      var e = z2-z1;
      var f = w1-w2;
      var r = radius1+radius2;
      var rootDiscriminant = Math.pow (2*(a*b+c*d+e*f), 2)-4*(b*b+d*d+f*f)*(a*a+c*c+e*e-r*r);

      if (rootDiscriminant < 0) {
         return NaN;
      }

      var term1 = a*b+c*d+e*f;
      var term2 = 0.5*Math.sqrt (rootDiscriminant);
      var t0 = (term1-term2)/(b*b+d*d+f*f);
      var t1 = (term1+term2)/(b*b+d*d+f*f);
      if (t0 < t1) {
         return t0;
      }

      return t1;
   }

   /*
    * returns the time a which a point at (x, y, z) with
    * velocity (u, v, w) intersects with the heightmap
    * The origin of the coordinate system is
    * at the bottom left corner of the height map.
    * For the arguments "mapWidth" and "mapHeight" the size of
    * the height map without border should be passed.
    * The argument "border" is the number of segments of the border.
    */
   static _getPointHeightMapCollision (heightMap, mapWidth, mapHeight, mapPositionX, mapPositionY, border,
                                       x, y, z, u, v, w, xStartHeightMap, yStartHeightMap) {
      var widthSegments = heightMap.cols-1-2*border;
      var heightSegments = heightMap.rows-1-2*border;

      x = x*widthSegments/mapWidth;
      u = u*widthSegments/mapWidth;
      y = y*heightSegments/mapHeight;
      v = v*heightSegments/mapHeight;

      var xStart = x;
      var yStart = y;

      if (xStartHeightMap) {
         x = xStartHeightMap-mapPositionX;
         x = x*widthSegments/mapWidth;
      }
      if (yStartHeightMap) {
         y = yStartHeightMap-mapPositionY;
         y = y*widthSegments/mapHeight;
      }

      var xEnd = x+u;
      var yEnd = y+v;

      if (xEnd>=widthSegments) {
         xEnd = widthSegments-1;
      }
      if (yEnd>=heightSegments) {
         yEnd = heightSegments-1;
      }

      var t = NaN;

      function getIntersection1 (x1, y1, z1, u11, u12, u13, v1, v2, v3,
                                 x2, y2, z2, u21, u22, u23) {

         var denominator = (u21*u12-u22*u11)*(v1*u13-v3*u11)-(u21*u13-u23*u11)*(v1*u12-v2*u11);
         if (denominator == 0) {
            return NaN;
         }

         var numerator = ((x2-x1)*u13-(z2-z1)*u11)*(v1*u12-v2*u11)-((x2-x1)*u12-(y2-y1)*u11)*(v1*u12-v2*u11);
         var t = numerator/denominator;
         if (t < 0) {
            return NaN;
         }

         return t;
      }

      function getIntersection (x1, y1, z1, u11, u12, u13, v1, v2, v3,
                                x2, y2, z2, u21, u22, u23) {

         var denominator = v1*u12*u23+v2*u13*u21+v3*u11*u22-v1*u13*u22-v2*u11*u23-v3*u12*u21;
         if (denominator == 0) {
            return NaN;
         }

         var numerator = v2*x1*u13-v3*x1*u12+v3*x2*u12-v2*x2*u13+v3*y1*u11-v1*y1*u13+v1*y2*u13-
                              v3*y2*u11+v1*z1*u12-v2*z1*u11+v2*z2*u11-v1*z2*u12;
         var t = numerator/denominator;
         if (t < 0) {
            return NaN;
         }

         return t;
      }

      function getTriangleCollision (currentX, currentY) {
         function isInUpperTriangle (topLeftVertexX, topLeftVertexY, topLeftVertexZ,
                                     bottomLeftVertexX, bottomLeftVertexY, bottomLeftVertexZ,
                                     topRightVertexX, topRightVertexY, topRightVertexZ,
                                     pointX, pointY, pointZ) {
            if (topLeftVertexX > pointX || topLeftVertexY <= pointY ||
                pointY - bottomLeftVertexY < pointX - bottomLeftVertexX) {
               return false;
            }
            return true;
         }

         function isInLowerTriangle (topLeftVertexX, topLeftVertexY, topLeftVertexZ,
                                     bottomLeftVertexX, bottomLeftVertexY, bottomLeftVertexZ,
                                     topRightVertexX, topRightVertexY, topRightVertexZ,
                                     pointX, pointY, pointZ) {
            if (topRightVertexX <= pointX || bottomLeftVertexY > pointY ||
                pointY - bottomLeftVertexY > pointX - bottomLeftVertexX) {
               return false;
            }
            return true;
         }

         var x = Math.floor (currentX)+border;
         var y = Math.floor (currentY)+border;

         var topLeftVertexX = x;
         var topLeftVertexY = y+1;

         var topLeftVertexZ = heightMap.get (topLeftVertexY, topLeftVertexX);

         var topRightVertexX = x+1;
         var topRightVertexY = y+1;
         var topRightVertexZ = heightMap.get (topRightVertexY, topRightVertexX);

         var bottomLeftVertexX = x;
         var bottomLeftVertexY = y;
         var bottomLeftVertexZ = heightMap.get (bottomLeftVertexY, bottomLeftVertexX);

         var bottomRightVertexX = x+1;
         var bottomRightVertexY = y;
         var bottomRightVertexZ = heightMap.get (bottomRightVertexY, bottomRightVertexX);

         x += mapPositionX*widthSegments/mapWidth-border;
         y += mapPositionY*heightSegments/mapHeight-border;

         topLeftVertexX = x;
         topLeftVertexY = y+1;
         topRightVertexX = x+1;
         topRightVertexY = y+1;
         bottomLeftVertexX = x;
         bottomLeftVertexY = y;
         bottomRightVertexX = x+1;
         bottomRightVertexY = y;

         var x1, y1, z1;
         var u11, u12, u13;
         var v1, v2, v3;
         var x2, y2, z2;
         var u21, u22, u23;
         var pointX, pointY, pointZ;

         x2 = xStart;
         y2 = yStart;
         z2 = z;
         u21 = u;
         u22 = v;
         u23 = w;

         // upper triangle
         x1 = topLeftVertexX;
         y1 = topLeftVertexY;
         z1 = topLeftVertexZ;
         u11 = bottomLeftVertexX-x1;
         u12 = bottomLeftVertexY-y1;
         u13 = bottomLeftVertexZ-z1;
         v1 = topRightVertexX-x1;
         v2 = topRightVertexY-y1;
         v3 = topRightVertexZ-z1;

         var t1 = getIntersection (x1, y1, z1, u11, u12, u13, v1, v2, v3,
                                   x2, y2, z2, u21, u22, u23);

         pointX = x2 + t1*u21;
         pointY = y2 + t1*u22;
         pointZ = z2 + t1*u23;

         if (!isNaN (t1) &&
             !isInUpperTriangle (topLeftVertexX, topLeftVertexY, topLeftVertexZ,
                                 bottomLeftVertexX, bottomLeftVertexY, bottomLeftVertexZ,
                                 topRightVertexX, topRightVertexY, topRightVertexZ,
                                 pointX, pointY, pointZ)) {
            t1 = NaN;
         }

         // lower triangle
         x1 = bottomRightVertexX;
         y1 = bottomRightVertexY;
         z1 = bottomRightVertexZ;
         u11 = bottomLeftVertexX-x1;
         u12 = bottomLeftVertexY-y1;
         u13 = bottomLeftVertexZ-z1;
         v1 = topRightVertexX-x1;
         v2 = topRightVertexY-y1;
         v3 = topRightVertexZ-z1;

         var t2 = getIntersection (x1, y1, z1, u11, u12, u13, v1, v2, v3,
                                   x2, y2, z2, u21, u22, u23);

         pointX = x2 + t2*u21;
         pointY = y2 + t2*u22;
         pointZ = z2 + t2*u23;

         if (!isNaN (t2) &&
             !isInLowerTriangle (bottomRightVertexX, bottomRightVertexY, bottomRightVertexZ,
                                 bottomLeftVertexX, bottomLeftVertexY, bottomLeftVertexZ,
                                 topRightVertexX, topRightVertexY, topRightVertexZ,
                                 pointX, pointY, pointZ)) {
            t2 = NaN;
         }

         if (t1 < t2 || isNaN (t2)) {
            return t1;
         }

         return t2;
      }

      var isInRangeX;
      var isInRangeY;
      if (u >= 0) {
         isInRangeX = function (x, xEnd) {
            return x <= xEnd;
         }
      }
      else {
         isInRangeX = function (x, xEnd) {
            return x >= Math.floor(xEnd);
         }
      }

      if (v >= 0) {
         isInRangeY = function (y, yEnd) {
            return y <= yEnd;
         }
      }
      else {
         isInRangeY = function (y, yEnd) {
            return y >= Math.floor (yEnd);
         }
      }

      while (isInRangeX(x, xEnd) && isInRangeY(y, yEnd)) {
         var currentX = x;
         if (u < 0 && currentX-Math.floor (currentX)==0) {
            currentX--;
         }
         var currentY = y;
         if (v < 0 && currentY-Math.floor (currentY)==0) {
            currentY--;
         }

         var tmp = getTriangleCollision (currentX, currentY);
         if (t > tmp || isNaN (t)) {
            t = tmp;
         }

         var dx;
         if (u>=0) {
            dx = Math.ceil (x)-x;
         }
         else {
            dx = Math.floor (x)-x;
         }

         if (dx == 0) {
            if (u >= 0) {
               dx = 1;
            }
            else {
               dx = -1;
            }
         }

         var dy;
         if (v>=0) {
            dy = Math.ceil (y)-y;
         }
         else {
            dy = Math.floor (y)-y;
         }

         if (dy == 0) {
            if (v >= 0) {
               dy = 1;
            }
            else {
               dy = -1;
            }
         }

         var t1 = dx/u;
         var t2 = dy/v;
         if (t1 < t2 || isNaN (t2)) {
            var tmp = x;
            x += dx;
            y += (x-tmp)/u*v;
         }
         else {
            var tmp = y;
            y += dy;
            x += (y-tmp)/v*u;
         }
      }

      return t;

   }

   /*
    * returns the time a which a point at (x, y, z) with
    * velocity (u, v, w) intersects with one of the heightmaps
    * The origin of the coordinate system is
    * at the bottom left corner of the height map.
    * For the arguments "mapWidth" and "mapHeight" the size of
    * the height map without border should be passed.
    */
   static getPointHeightMapsCollision (heightMaps, mapWidth, mapHeight, border,
                                       x, y, z, u, v, w) {
      var currentX = x/mapWidth;
      var scaledU = u/mapWidth;
      var currentY = y/mapHeight;
      var scaledV = v/mapHeight;

      var xEnd = currentX+scaledU;
      var yEnd = currentY+scaledV;

      var t = NaN;

      var isInRangeX;
      var isInRangeY;
      if (u >= 0) {
         isInRangeX = function (x, xEnd) {
            return x <= xEnd;
         }
      }
      else {
         isInRangeX = function (x, xEnd) {
            return x >= Math.floor(xEnd);
         }
      }

      if (v >= 0) {
         isInRangeY = function (y, yEnd) {
            return y <= yEnd;
         }
      }
      else {
         isInRangeY = function (y, yEnd) {
            return y >= Math.floor (yEnd);
         }
      }

      while (isInRangeX(currentX, xEnd) && isInRangeY(currentY, yEnd)) {

         var positionX = Math.floor (currentX);
         var positionY = Math.floor (currentY);

         if (u < 0 && currentX-positionX==0) {
            positionX--;
         }
         if (v < 0 && currentY-positionY==0) {
            positionY--;
         }

         var heightMap = heightMaps[(-positionY)+" "+positionX];

         if (!heightMap) {
            break;
         }

         var tmp = CollisionDetection._getPointHeightMapCollision (heightMap,
                                                                   mapWidth, mapHeight,
                                                                   positionX*mapWidth, positionY*mapHeight, border,
                                                                   x, y, z, u, v, w, currentX*mapWidth, currentY*mapHeight);

         if (t > tmp || isNaN (t)) {
            t = tmp;
         }

         var dx;
         if (u>=0) {
            dx = Math.ceil (x)-x;
         }
         else {
            dx = Math.floor (x)-x;
         }

         if (dx == 0) {
            if (u >= 0) {
               dx = 1;
            }
            else {
               dx = -1;
            }
         }

         var dy;
         if (v>=0) {
            dy = Math.ceil (y)-y;
         }
         else {
            dy = Math.floor (y)-y;
         }

         if (dy == 0) {
            if (v >= 0) {
               dy = 1;
            }
            else {
               dy = -1;
            }
         }

         var t1 = dx/u;
         var t2 = dy/v;
         if (t1 < t2 || isNaN (t2)) {
            var tmp = currentX;
            currentX += dx;
            currentY += (currentX-tmp)/scaledU*scaledV;
         }
         else {
            var tmp = currentY;
            currentY += dy;
            currentX += (currentY-tmp)/scaledV*scaledU;
         }
      }

      return t;
   }

   static getPointCenteredHeightMapsCollision (heightMaps, mapWidth, mapHeight, border,
                                       x, y, z, u, v, w) {
      return CollisionDetection.getPointHeightMapsCollision (heightMaps, mapWidth, mapHeight, border,
                                       x+0.5*mapWidth, z+0.5*mapHeight, y, u, w, v);
   }
}

export {BoundingBox, Particle, ParticleSystem, CollisionDetection, CollisionDetectionSphere};