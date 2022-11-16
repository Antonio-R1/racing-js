/*
 * Copyright (c) 2021-2022 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/blob/main/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';

class Runway {

   constructor (loadingManager) {

      let runway_object = this;

      if (Runway.runway_material != null &&
          Runway.runway_material_start_end != null) {
         this.create ();
         return;
      }

      var textureLoader = new THREE.TextureLoader (loadingManager);
      textureLoader.load ("images/runway.png", function (texture) {
         texture.wrapT = THREE.RepeatWrapping;
         texture.repeat.set (1, 25);
         Runway.runway_material = new THREE.MeshPhongMaterial ({map: texture});
      }, undefined,
      function (err) {
         console.error ("Could not load the texture of the runway.");
      });

      var textureLoaderStart = new THREE.TextureLoader (loadingManager);
      textureLoaderStart.load ("images/runway_start_end.png", function (texture) {
         Runway.runway_material_start_end = new THREE.MeshPhongMaterial ({map: texture});
      }, undefined,
      function (err) {
         console.error ("Could not load the texture of the runway.");
      });
   }

   createRunwayLightAlphaMap (size) {
      var canvas = document.createElement ("canvas");
      canvas.width = size;
      canvas.height = size;
      var context = canvas.getContext ("2d");

      context.fillStyle = "#000000";
      context.fillRect(0, 0, size, size);

      var circleCenter = 0.5*size;
      var radius = 0.5*size
      context.beginPath ();
      context.arc (circleCenter, circleCenter, radius, 0, 2*Math.PI);
      context.closePath ();
      context.fillStyle = "#ffffff";
      context.fill ();
      var alphaMap = new THREE.CanvasTexture (canvas);
      alphaMap.wrapS = THREE.ClampToEdgeWrapping;
      alphaMap.wrapT = THREE.ClampToEdgeWrapping;
      return alphaMap;
   }

   create () {
      this.runway_scene = new THREE.Scene ();

      let length = 1000;
      this.width = 10;
      let runway_geometry = new THREE.PlaneBufferGeometry (this.width, length, 1, 1);
      let runway = new THREE.Mesh (runway_geometry, Runway.runway_material);

      let length_start_end = 10;
      let runway_geometry_start_end = new THREE.PlaneBufferGeometry (this.width, length_start_end, 1, length_start_end);
      let runway_start = new THREE.Mesh (runway_geometry_start_end, Runway.runway_material_start_end);
      runway_start.rotation.z = Math.PI;
      runway_start.position.y = (length+length_start_end)/2;

      let runway_end = new THREE.Mesh (runway_geometry_start_end, Runway.runway_material_start_end);
      runway_end.position.y = -(length+length_start_end)/2;

      this.length = length + length_start_end;
      this.position_y = 0;

      this.runway_scene.position.z = length/2-10;
      this.position_z = this.runway_scene.position.z;
      this.runway_scene.rotation.x = -1/2*Math.PI;
      this.runway_scene.add (runway);
      this.runway_scene.add (runway_start);
      this.runway_scene.add (runway_end);

      var pointsGeometry = new THREE.BufferGeometry ();

      var nLights = Math.floor (length/15.24);
      // lights for each side
      var lightsVertices = new Array (2*3*nLights);
      var lightPositionX = 0.5*this.width;

      for (var i=0; i<nLights; i++) {
         var lightPositionY = 0.5*length-15.24*i;
         lightsVertices[i*6] = -lightPositionX;
         lightsVertices[i*6+1] = lightPositionY;
         lightsVertices[i*6+2] = 0;
         lightsVertices[i*6+3] = lightPositionX;
         lightsVertices[i*6+4] = lightPositionY;
         lightsVertices[i*6+5] = 0;
      }

      pointsGeometry.setAttribute ("position", new THREE.Float32BufferAttribute (lightsVertices, 3));

//    compute the correct size of the lights according to https://github.com/mrdoob/three.js/issues/12150#issuecomment-327874431
      var lightsSize = 0.75/Math.tan ((Math.PI/180)*camera.fov/2);
      var pointsMaterial = new THREE.PointsMaterial ({alphaMap: this.createRunwayLightAlphaMap(16),
                                                       color: 0xffffff, alphaTest: 0.5, size: lightsSize, transparent: true});

      var lights = new THREE.Points (pointsGeometry, pointsMaterial);

      this.runway_scene.add (lights);
   }
}

Runway.runway_material = null;
Runway.runway_material_start_end = null;

export default Runway;