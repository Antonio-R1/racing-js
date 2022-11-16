/*
 * Copyright (c) 2021-2022 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/blob/main/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';
import Game from './game.js';
import {Menu, GameOverMenu} from './menu.js';
import LinkedList from './linked_list.js';
import {Array2d} from './convolution.js';
import {BoundingBox,
        Particle,
        ParticleSystem,
        CollisionDetection,
        CollisionDetectionSphere} from './collision_detection.js';
import Plane from './plane.js';
import FlightInstruments from './flight_instruments.js';
import Runway from './runway.js';
import Barrel from './barrel.js';
import Coin from './coin.js';
import Rocket from './rocket.js';
import Terrain from './terrain.js';
import Trees from './tree.js';
import {Clouds, Fog} from './cloud.js';
import RigidBodyDynamics2d from './rigid_body_dynamics.js';
import SkySphere from './sky.js';

const messageDialogText = `The yellow spheres containig the coins increase the score, the blue spheres containing the barrels fill up the fuel by 50% or 100%.
The are also red spheres with the rockets inside. Going through these sphere will make the rockets available and add a "rocket"
<img width="25px" height="25px" src="images/rocket.svg"> button. You can click on that button or press the "R" key on
the keyboard for using the rockets which will boost your speed. The red spheres containing the text "Game Over" have to be avoided.
Press the space bar or the left mouse button for tilting the elevators up,
leave the space bar or the left mouse button for tilting the elevators down. You can also set the throttle by pressing the "+" or "-" keys on the
keyboard or by clicking on the gray bar on the right. Reduce the throttle for consuming less fuel.
The game is over when the airplane goes through the red spheres containing the text "Game Over" or when the airplane touches the ground.`;

class GameFlightOverTheMountains extends Game {

   constructor (simulationType, skipTakeoff = false) {
      super();
      if (simulationType==="simple") {
         this.currentUpdatePlane = this.updatePlane;
      }
      else if (simulationType==="particle_system") {
         this.currentUpdatePlane = this.updatePlaneRigidBodyDynamics;
      }
      else {
         throw new Error("unknown simulation type: \""+simulationType+"\"");
      }
      this.simulationType = simulationType;
      this.skipTakeoff = skipTakeoff;
      this.skipTakeoffSpeedFactor = 10;
      this.skipTakeoffUpdatesPerSeconds = 15;
      this.takingoff = true;
      this.animateFunctions = [];
      this.planeObject = null;
      this.terrainWebWorker = new Worker ("terrain_web_worker.js", {type: "module"});
      this.terrain = [];
      this.heightMaps = [];
      this.terrainWebWorkerTerrainLastAddedX = 0;
      this.terrainLastAddedY = 0;
      this.cameraFar = 4500;
      this.cameraPosition = null;
      this.cockpitCameraPosition = new THREE.Vector3 (0, 2.1, 1.825);
      this.score = 0;
      this.webSocket = null;
      this.hasRockets = true;
      setRocketButtonVisible (true);
      this.linkedListObjects = new LinkedList ();
      this.currentlinkedListObject = null;
      this.velocity = new THREE.Vector3 ();
      if (GameFlightOverTheMountains.gameOverText === null) {
         let textGeometry = new THREE.TextGeometry ("Game Over", {font: font, height: 0.25, size: 0.5});
         textGeometry.center ();
         let textMaterial = new THREE.MeshPhongMaterial ({emissive: 0xaaaaaa});
         GameFlightOverTheMountains.gameOverText = new THREE.Mesh (textGeometry, textMaterial);
      }
   }

   add_animate_function (animate_function) {
      this.animateFunctions.push (animate_function);
   }

   remove_animate_function (animate_function) {
      let index = this.animateFunctions.indexOf (animate_function);
      if (index >= 0) {
         this.animateFunctions.splice (index, 1);
      }
      else {
         console.error ("The function could not be removed.");
      }
   }

   takeOffRigidBodyDynamics (game1_object, time, interval) {
      if (!game1_object.planeObject.takeOffRigidBodyDynamics ()) {
         game1_object.takingoff = false;
         if (game1_object.skipTakeoff) {
            game1_object.resumeAnimation ();
         }
         closeMessageDialog ();
         game1_object.remove_animate_function (game1_object.takeOffRigidBodyDynamics);
         game1_object.add_animate_function (game1_object.count);
         return true;
      }
   }

   takeOff (game1_object, time, interval) {
      if (!game1_object.planeObject.takeOff ()) {
         game1_object.takingoff = false;
         if (game1_object.skipTakeoff) {
            game1_object.resumeAnimation ();
         }
         game1_object.remove_animate_function (game1_object.takeOff);
         game1_object.add_animate_function (game1_object.count);
      }
   }

   count (game1_object, time, interval) {
      if (game1_object.count_number == undefined) {
         game1_object.start_time = time;
         game1_object.count_number = 3;
         game1_object.text_object_number3.visible = true;
      }
      else if (game1_object.count_number == 3 &&
               time-game1_object.start_time > 1000) {
         game1_object.count_number = 2;
         game1_object.text_object_number3.visible = false;
         game1_object.text_object_number2.visible = true;
      }
      else if (game1_object.count_number == 2 &&
               time-game1_object.start_time > 2000) {
         game1_object.count_number = 1;
         game1_object.text_object_number2.visible = false;
         game1_object.text_object_number1.visible = true;
      }
      else if (game1_object.count_number == 1 &&
               time-game1_object.start_time > 3000) {
         game1_object.text_object_number1.visible = false;
         game1_object.remove_animate_function (game1_object.count);
         game1_object.started = true;
      }
   }

   updatePlaneRigidBodyDynamics (game1_object, time, animate_time, interval) {
      game1_object.planeObject.animateRigidBodyDynamics (time, animate_time, interval);
   }

   updatePlane (game1_object, time, animate_time, interval) {
      game1_object.planeObject.animate (time, animate_time, interval);
   }

   add_text_object (text, position_x, position_y, position_z, scale, center) {
      let text_geometry = new THREE.TextGeometry (text, {font: font});
      let text_material = new THREE.MeshPhongMaterial ({emissive: 0xaaaaaa});
      let text_object = new THREE.Mesh (text_geometry, text_material);
      text_object.position.set (position_x, position_y, position_z);
      text_object.scale.set (scale, scale, scale/10);

      if (center) {
         text_geometry.center ();
      }

      var text_object_edges = new THREE.EdgesGeometry(text_object.geometry, 90);
      var text_object_line_segments = new THREE.LineSegments(text_object_edges, new THREE.LineBasicMaterial({color: 0x000000}));
      text_object.renderOrder = 1;
      text_object_line_segments.renderOrder = 2;
      text_object.add (text_object_line_segments);

      return text_object;
   }

   click (event) {
      if (this.click_callback != undefined) {
         this.click_callback (event);
      }
   }

   keyDown (event) {

      if (!this.started) {
         return;
      }

      if (event.key === "+") {
         this.planeObject.increaseThrottle (true);
      }
      else if (event.key === "-") {
         this.planeObject.decreaseThrottle (true);
      }
      else if (event.key === " ") {
         this.planeObject.moveDownElevator (false);
         this.planeObject.moveUpElevator (true);
      }
      else if (event.key === "r") {
         if (this.hasRockets) {
            this.rocketButtonOnclick ();
         }
      }
   }

   keyUp (event) {

      if (event.key === "c") {
         this.cameraButtonOnclick ();
         return;
      }

      if (!this.started) {
         return;
      }

      if (event.key === "+") {
         this.planeObject.increaseThrottle (false);
      }
      else if (event.key === "-") {
         this.planeObject.decreaseThrottle (false);
      }
      else if (event.key === " ") {
         this.planeObject.moveUpElevator (false);
         this.planeObject.moveDownElevator (true);
      }
   }

   onMouseMoveThrottleSlider (positionY, height) {
      if (!this.started) {
         return;
      }

      if (positionY < 0) {
         positionY = 0;
      }
      else if (positionY>height) {
         positionY=height;
      }
      this.planeObject.throttle = (height-positionY)/height;
   }

   mouseDown (event) {

      var mouseX = event.offsetX/renderer.domElement.clientWidth;
      var mouseY = event.offsetY/renderer.domElement.clientHeight;
      if (mouseX>0.725 && mouseY<0.2) {
         showSettingsMenu();
      }

      if (!this.started) {
         return;
      }
      this.planeObject.moveDownElevator (false);
      this.planeObject.moveUpElevator (true);
   }

   mouseUp (event) {
      if (!this.started) {
         return;
      }
      this.planeObject.moveUpElevator (false);
      this.planeObject.moveDownElevator (true);
   }

   updateSideCameraPosition (game1_object) {
      camera.position.x = game1_object.plane_scene.position.x-45;
      camera.position.y = game1_object.plane_scene.position.y+2;
      camera.position.z = game1_object.plane_scene.position.z;
   }

   updateFollowUpCameraPosition (game1_object) {
      camera.position.x = game1_object.plane_scene.position.x;
      camera.position.y = game1_object.plane_scene.position.y+2;
      camera.position.z = game1_object.plane_scene.position.z-15;
   }

   rocketButtonOnclick () {
      if (this.started) {
         this.hasRockets = false;
         this.planeObject.setRockets (true);
         setRocketButtonVisible (false);
      }
   }

   cameraButtonOnclick () {
      if (this.cameraPosition === "cockpit") {
         camera.rotation.y = -Math.PI/2;
         this.cameraAnimateFunction = this.updateSideCameraPosition;
         this.add_animate_function (this.updateSideCameraPosition);
         this.planeObject.plane.remove (camera);
         scene.add (camera);
         this.cameraPosition = "right";
         selectCameraPositionSpan (this.cameraPosition);
         return;
      }
      else if (this.cameraPosition === "right") {
         camera.rotation.y = Math.PI;
         this.remove_animate_function (this.updateSideCameraPosition);
         this.cameraAnimateFunction = this.updateFollowUpCameraPosition;
         this.add_animate_function (this.updateFollowUpCameraPosition);
         this.planeObject.plane.remove (camera);
         scene.add (camera);
         this.cameraPosition = "behind";
         selectCameraPositionSpan (this.cameraPosition);
         return;
      }
      this.remove_animate_function (this.updateFollowUpCameraPosition);
      this.cameraAnimateFunction = null;
      camera.rotation.y = Math.PI;
      camera.position.copy (this.cockpitCameraPosition);
      scene.remove (camera);
      this.planeObject.plane.add (camera);
      this.cameraPosition = "cockpit";
      selectCameraPositionSpan (this.cameraPosition);
   }

   showPauseDialog () {
      return !this.game_over_menu.game_over_menu_scene.visible;
   }

   openMainMenu () {
      setRocketButtonVisible (false);
      setCurrentScene(new Menu ());
      current_scene.show ();
   }

   retry () {
      let game = new GameFlightOverTheMountains (game1_simulationType, this.skipTakeoff);
      game.show ();
   }

   planeRaycastCallback (game1_object, time, interval, intersects, direction_vector) {
      this.terrainWebWorker.terminate ();
      this.remove_animate_function (this.currentUpdatePlane);
      this.game_over_menu.game_over_menu_scene.visible = true;
      this.click_callback = function (event) {
         this.game_over_menu.click (this.game_over_menu, event);
      };
      this.game_over_menu.setRetryCallback (this.retry);
      this.game_over_menu.setMainMenuCallback (this.openMainMenu);
   }

   collisionDetectionCallback (game1_object, interval, boundingBoxes, collisionDetectionSpheres, velocity, handleWheelsOnRunway) {
      interval = interval/1000;
      var minWheelY = NaN;

      function checkBoundingBoxCollision (boundingBox) {
         for (let i=0; i<boundingBox.corners.length; i++) {
            let corner = boundingBox.corners[i];
            let cornerOld = boundingBox.cornersOld[i];

            this.velocity.set (corner.x-cornerOld.x, corner.y-cornerOld.y, corner.z-cornerOld.z);

            let t = CollisionDetection.getPointCenteredHeightMapsCollision (this.heightMaps, 10000, 10000, 8,
                                                                            cornerOld.x, cornerOld.y, cornerOld.z,
                                                                            this.velocity.x,
                                                                            this.velocity.y,
                                                                            this.velocity.z);
            if (t-1 <= Number.EPSILON) {
               if (boundingBox.callback && !boundingBox.callback (cornerOld, corner)) {
                  if (!(corner.y>=minWheelY)) {
                     minWheelY = corner.y;
                  }
                  continue;
               }
//               console.log (t);
               return t;
            }
         }
         return NaN;
      }

      let showGameOverMenu = false;

      this.performCollisionDetectionObjects (collisionDetectionSpheres);

      for (var i=0; i<boundingBoxes.length; i++) {
         var boundingBox = boundingBoxes[i];

         if (!isNaN (checkBoundingBoxCollision.call (this, boundingBox))) {
            showGameOverMenu = true;
         }
      }

      if (!isNaN (minWheelY) && handleWheelsOnRunway) {
         this.planeObject.planeRotationPosition.position.y = this.runway.runway_scene.position.y+this.planeObject.planeRotationPosition.position.y-minWheelY+0.001;
         this.planeObject.planeRotationPosition.updateMatrixWorld ();
         for (let i=0; i<boundingBoxes.length; i++) {
            boundingBoxes[i].applyMatrix4 (this.planeObject.planeRotationPosition);
         }
         return;
      }

      if (showGameOverMenu) {
         this.stopGameAndShowGameOverMenu ();
      }

   }

   showUsernameDialogOnNewRecord (scoreboard) {
      let rankingToday = 0;
      let rankingAll = 0;
      for (rankingToday=0; rankingToday<scoreboard.today.length; rankingToday++) {
         if (scoreboard.today[rankingToday].score<this.score) {
            break;
         }
      }

      for (rankingAll=0; rankingAll<scoreboard.all.length; rankingAll++) {
         if (scoreboard.all[rankingAll].score<this.score) {
            break;
         }
      }

      if (rankingToday<10 || rankingAll<10) {
         usernameRecordDialog.onOkClickCallback = (username) => {
            if (username.length===0) {
               window.alert ("Please enter an username.");
               return false;
            }
            if (username.length<=10) {
               try {
                  this.webSocket.send(JSON.stringify({type: "game_flight_over_the_mountains_score", username: username, score: this.score}));
               }
               catch (e) {
                  window.alert ("An error occured.");
                  return false;
               }
               let scoreboardEntry = {username: username, score: this.score};
               if (rankingToday<10) {
                  if (rankingToday<scoreboard.today.length) {
                     scoreboard.today.splice(rankingToday, 0, scoreboardEntry);
                     if (scoreboard.today.length>10) {
                        scoreboard.today.pop();
                     }
                  }
                  else {
                     scoreboard.today.push(scoreboardEntry);
                  }
               }
               if (rankingAll<10) {
                  if (rankingAll<scoreboard.all.length) {
                     scoreboard.all.splice(rankingAll, 0, scoreboardEntry);
                     if (scoreboard.all.length>10) {
                        scoreboard.all.pop();
                     }
                  }
                  else {
                     scoreboard.all.push(scoreboardEntry);
                  }
               }
               rankingDialog.updateTableRankingToday (scoreboard.today, true);
               rankingDialog.updateTableRankingAll (scoreboard.all, true);
               rankingDialog.show();
               return true;
            }
            window.alert ("Please enter a shorter username. The username may not contain more than 10 characters.");
            return false;
         };
         usernameRecordDialog.show();
      }
      rankingDialog.updateTableRankingToday (scoreboard.today, true);
      rankingDialog.updateTableRankingAll (scoreboard.all, true);
   }

   getAndUpdateScoreboard () {
      this.webSocket = new WebSocket("wss://"+window.location.host);
      this.webSocket.onopen = (event) => {
         try {
            this.webSocket.send(JSON.stringify({type: "game_flight_over_the_mountains_scoreboard"}));
         }
         catch (e) {
            console.warn(e);
         }
      };
      this.webSocket.onerror = (event) => console.warn(event);
      this.webSocket.onmessage = (event) => this.showUsernameDialogOnNewRecord (JSON.parse(event.data).scoreboard);
   }

   stopGameAndShowGameOverMenu () {
      if (this.showingGameOverMenu) {
         return;
      }
      this.showingGameOverMenu = true;
      this.terrainWebWorker.terminate ();
      this.remove_animate_function (this.currentUpdatePlane);
      this.game_over_menu.game_over_menu_scene.visible = true;
      this.click_callback = function (event) {
         this.game_over_menu.click (this.game_over_menu, event);
      };
      var game1_object = this;
      this.game_over_menu.setRetryCallback (function () {
         game1_object.retry ();
      });
      this.game_over_menu.setMainMenuCallback (this.openMainMenu);
      this.getAndUpdateScoreboard ();
   }

   performCollisionDetectionObjects (collisionDetectionSpheres) {
      if (!current) {
         current = this.linkedListObjects.first;
      }

      for (var i=0; i<collisionDetectionSpheres.length; i++) {
         this.velocity.copy (collisionDetectionSpheres[i].currentPosition).sub (collisionDetectionSpheres[i].lastPosition);
         var currentPosition = collisionDetectionSpheres[i].currentPosition;
         var current = this.currentlinkedListObject;

         if (!current) {
            current = this.linkedListObjects.first;
         }

         if (!current) {
            continue;
         }

         while (current.prev && currentPosition.z-collisionDetectionSpheres[i].radius < current.prev.value.position.z) {
            current = current.prev;
         }

         while (current && currentPosition.z+collisionDetectionSpheres[i].radius > current.value.position.z-current.value.sphereRadius) {
            var t = CollisionDetection.getSpheresCollision (currentPosition.x, currentPosition.y, currentPosition.z,
                                                            collisionDetectionSpheres[i].radius,
                                                            this.velocity.x, this.velocity.y, this.velocity.z,
                                                            current.value.position.x, current.value.position.y, current.value.position.z, current.value.sphereRadius,
                                                            0, 0, 0);
            if (Math.abs (t) < 1.0) {
               if (current.value.collisionCallback (current.value)) {
                  this.linkedListObjects.removeNode (current);
                  scene.remove (current.value);
               }
            }
            current = current.next;
         }
         this.currentlinkedListObject = current;
      }
   }

   getTerrainAltitude (positionX, positionZ) {
      let maxAltitude = 2048;
      let velocityY = -maxAltitude;
      let t = CollisionDetection.getPointCenteredHeightMapsCollision (this.heightMaps, 10000, 10000, 8,
                                                                      positionX, maxAltitude, positionZ,
                                                                      0, velocityY, 0);
      return maxAltitude*(1-t);
   }

   addTrees (positionY) {
      var mapWidth = 10000;
      var mapHeight = 10000;
      var positions = [];
      var countX = 25;
      var countY = 25;
      var distanceX = mapWidth/countX;
      var distanceY = mapWidth/countY;
      var minAltitude = 10000;

      for (let j=0; j<countY; j++) {
         for (let i=0; i<countX; i++) {
            let x = i*distanceX-0.5*mapWidth+Math.random()*100;
            let y = j*distanceY-0.5*mapHeight+Math.random()*100;
            let altitude;
            let direction = null;
            for (var k=0; k<100; k++) {
               let t = CollisionDetection.getPointCenteredHeightMapsCollision (this.heightMaps, mapWidth, mapHeight, 8,
                                                                               x, 10000, y+positionY,
                                                                               0,
                                                                               -10000,
                                                                               0);
               altitude = 10000*(1-t);
               if (altitude<1000 && (Math.abs (y+positionY)>1500 || Math.abs (x) > 150)) {
                  minAltitude = Math.min (minAltitude, altitude);
                  break;
               }

               if (direction==null) {
                  direction = Math.floor (Math.random ()*2);
               }

               if (direction == 0) {
                  x += 100;
                  if (x>0.5*mapWidth) {
                     x = 0;
                  }
               }
               else {
                  x -= 100;
                  if (x<-0.5*mapWidth) {
                     x = 0.5*mapWidth;
                  }
               }
            }

            positions.push (new THREE.Vector3 (Math.min (x, 0.5*mapWidth),
                            altitude,
                            Math.min (y), 0.5*mapHeight));
         }
      }
      let boundingSpherePosition = new THREE.Vector3 (0, 0, 0);
      let boundingSphereRadius = Math.sqrt(2)*Math.max (mapHeight, mapWidth);

      let size = 100;
      let trees = new Trees (positions, size, boundingSpherePosition, boundingSphereRadius);
      trees.position.z = positionY;
      scene.add (trees);
   }

   addForest (positionY) {
      var mapWidth = 10000;
      var mapHeight = 10000;
      var positions = [];
      var countX = 25;
      var countY = 25;
      var forestPositionX = Math.random ()*mapWidth-0.5*mapWidth;
      var forestPositionY = Math.random ()*mapHeight-0.5*mapHeight;
      var maxDistanceX = 750;
      var maxDistanceY = 750;
      var minAltitude = 10000;

      for (let j=0; j<countY; j++) {
         for (let i=0; i<countX; i++) {
            let x = forestPositionX+maxDistanceX*(Math.random ()-0.5);
            let y = forestPositionY+maxDistanceY*(Math.random ()-0.5);
            while (x < -0.5*mapWidth || x > 0.5*mapWidth) {
               x = forestPositionX+maxDistanceX*(Math.random ()-0.5);
            }
            while (y < -0.5*mapHeight || y > 0.5*mapHeight) {
               y = forestPositionY+maxDistanceY*(Math.random ()-0.5);
            }

            let altitude;
            let direction = null;
            for (var k=0; k<100; k++) {
               let t = CollisionDetection.getPointCenteredHeightMapsCollision (this.heightMaps, mapWidth, mapHeight, 8,
                                                                               x, 10000, y+positionY,
                                                                               0,
                                                                               -10000,
                                                                               0);
               altitude = 10000*(1-t);
               if (altitude<1000 && (Math.abs (y+positionY)>1500 || Math.abs (x) > 150)) {
                  minAltitude = Math.min (minAltitude, altitude);
                  break;
               }

               if (direction==null) {
                  direction = Math.floor (Math.random ()*2);
               }

               if (direction == 0) {
                  x += 100;
                  if (x>0.5*mapWidth) {
                     x = 0;
                  }
               }
               else {
                  x -= 100;
                  if (x<-0.5*mapWidth) {
                     x = 0.5*mapWidth;
                  }
               }
            }

            positions.push (new THREE.Vector3 (Math.min (x, 0.5*mapWidth),
                            altitude,
                            Math.min (y), 0.5*mapHeight));
         }
      }

      let boundingSpherePosition = new THREE.Vector3 (0, 0, 0);
      let boundingSphereRadius = Math.sqrt(2)*Math.max (maxDistanceX*0+10000, maxDistanceY*0+10000);

      let size = 100;
      let trees = new Trees (positions, size, boundingSpherePosition, boundingSphereRadius);
      trees.position.z = positionY;
      scene.add (trees);
   }

   addObject (obj, positionY, positionZ) {
      obj.object3d.scale.x = 2;
      obj.object3d.scale.y = 2;
      obj.object3d.scale.z = 2;
      obj.object3d.position.y = positionY;
      obj.object3d.position.z = positionZ;
      return obj;
   }

   addBarrel (positionY, positionZ) {
      var barrel = new Barrel ();
      this.addObject (barrel, positionY, positionZ);
      return barrel.object3d;
   }

   addCoin (positionY, positionZ) {
      var coin = new Coin ();
      this.addObject (coin, positionY, positionZ);
      return coin.object3d;
   }

   addRocket (positionY, positionZ) {
      var rocket = new Rocket ();
      this.addObject (rocket, positionY, positionZ);
      rocket.object3d.rotation.z = 0.25*Math.PI;
      return rocket.object3d;
   }

   addGameOverText (positionY, positionZ) {
      let textObject = GameFlightOverTheMountains.gameOverText.clone ();
      textObject.rotation.y = Math.PI;
      textObject.position.y = positionY;
      textObject.position.z = positionZ;
      return textObject;
   }

   addFog (positionX, positionY, positionZ) {
      var cloud = new Fog (250);
      cloud.setPosition (positionX, positionY, positionZ);
      scene.add(cloud);
   }

   addClouds (positionY, height, width) {
      let max = 5;
      let count = Math.floor (Math.random ()*max)*0+5;
      let positions = [];
      for (let i=0; i<count; i++) {
         var x = Math.random()*width-0.5*width;
         var y = Math.random()*height-0.5*height;
         positions.push (new THREE.Vector2(x, y));
      }
      let boundingSpherePosition = new THREE.Vector3 (0, 0, 0);
      let boundingSphereRadius = Math.sqrt(2)*Math.max (height, width);
      let size = 1000;
      let clouds = new Clouds (positions, size, boundingSpherePosition, boundingSphereRadius);
      clouds.position.z = positionY;
      scene.add (clouds)
   }

   addCollisionObjectWithSphere (obj, color) {
      var sphereGeometry = new THREE.SphereGeometry(obj.sphereRadius, 32, 32);
      var sphereMaterial = new THREE.MeshPhongMaterial({color: color, emissive: color, emissiveIntensity: 0.25, opacity: 0.25, transparent: true});
      var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      obj.add(sphere);

      scene.add (obj);
      this.linkedListObjects.addLast (obj);
   }

   addObjectsAndClouds (positionX, positionY, height, minAltitude, fineHeightMap) {
      var position;

      if (positionY==0) {
         position = 2000;
      }
      else {
         position = positionY-0.5*height;
      }

      var coinCollisionCallback = function () {
         game1.score += 100;
         setScore(game1.score);
         return true;
      };

      var game1 = this;
      var barrelCollisionCallback = function (object3d) {
         if (object3d.sphereRadius == 3) {
            game1.planeObject.fuelPercentage += 50;
            if (game1.planeObject.fuelPercentage > 100) {
               game1.planeObject.fuelPercentage = 100;
            }
         }
         else {
            game1.planeObject.fuelPercentage = 100;
         }
         return true;
      };

      var gameOverCollisionCallback = function () {
         game1.stopGameAndShowGameOverMenu ();
         return false;
      };

      var rocketCollisionCallback = function () {
         game1.hasRockets = true;
         setRocketButtonVisible (true);
         return true;
      };

      for (let i=0; i<5; i++) {
         this.addClouds (positionY, height, height);
      }

      var maxPosition = positionY+0.5*height;
      while (position<maxPosition) {
         let randomNumberObjectType = Math.random ();
         let addedObject;
         let color;
         if (randomNumberObjectType < 0.5) {
            addedObject = this.addCoin (this.getTerrainAltitude (0, position)+100, position);
            addedObject.collisionCallback = coinCollisionCallback;
            addedObject.sphereRadius = 5;
            color = 0xffdf00;
            this.addCollisionObjectWithSphere (addedObject, color);

            if (positionY > 10000) {
               let randomNumber = Math.random ();
               if (randomNumber < 0.25) {
                  let count = Math.floor (Math.random()*5)+5;
                  let type = 0;
                  let distance = 50;
                  for (let i=0; i<count; i++) {
                     if (type==0) {
                        addedObject = this.addCoin (this.getTerrainAltitude (0, position)+100, position);
                        addedObject.collisionCallback = coinCollisionCallback;
                        addedObject.sphereRadius = 5;
                        color = 0xffdf00;
                        this.addCollisionObjectWithSphere (addedObject, color);
                     }
                     else {
                        addedObject = this.addGameOverText (this.getTerrainAltitude (0, position)+100, position);
                        addedObject.collisionCallback = gameOverCollisionCallback;
                        addedObject.sphereRadius = 5;
                        color = 0xff0000;
                        this.addCollisionObjectWithSphere (addedObject, color);
                     }
                     type = Math.floor (Math.random ()*2);
                     position += distance;
                  }
               }
               else if (randomNumber < 0.5) {
                  addedObject = this.addGameOverText (this.getTerrainAltitude (0, position)+75, position);
                  addedObject.collisionCallback = coinCollisionCallback;
                  addedObject.sphereRadius = 5;
                  color = 0xff0000;
                  this.addCollisionObjectWithSphere (addedObject, color);
                  addedObject = this.addGameOverText (this.getTerrainAltitude (0, position)+125, position);
                  addedObject.collisionCallback = gameOverCollisionCallback;
                  addedObject.sphereRadius = 5;
                  color = 0xff0000;
                  this.addCollisionObjectWithSphere (addedObject, color);
               }
            }
         }
         else if (randomNumberObjectType < 0.9) {
            addedObject = this.addGameOverText (this.getTerrainAltitude (0, position)+100, position);
            addedObject.collisionCallback = gameOverCollisionCallback;
            addedObject.sphereRadius = 5;
            color = 0xff0000;
            this.addCollisionObjectWithSphere (addedObject, color);
         }
         else if (randomNumberObjectType < 0.975) {
            addedObject = this.addBarrel (this.getTerrainAltitude (0, position)+100, position);
            addedObject.collisionCallback = barrelCollisionCallback;
            if (randomNumberObjectType < 0.85) {
               addedObject.sphereRadius = 3;
            }
            else {
               addedObject.sphereRadius = 5;
            }
            color = 0x0000ff;
            this.addCollisionObjectWithSphere (addedObject, color);
         }
         else {
            addedObject = this.addRocket (this.getTerrainAltitude (0, position)+100, position);
            addedObject.collisionCallback = rocketCollisionCallback;
            addedObject.sphereRadius = 5;
            color = 0xff0000;
            this.addCollisionObjectWithSphere (addedObject, color);
         }

         position += 125;
      }

      if (positionY==0) {
         this.addFog (0, this.getTerrainAltitude (0, 3000)+100, 3000);
      }
   }

   show () {
      setCurrentScene (this);
      showMenuBar (true);
      showDivThrottle (true);
      setScore (this.score);
      var game1_object = this;
      if (!this.skipTakeoff) {
         showMessageDialog ();
         setMessageDialogText ("Taking off...", messageDialogText);
         setMessageDialogButtonLeftText ("skip takeoff");
         setMessageDialogButtonLeftOnclick (function () {
            game1_object.planeObject.updatesPerSeconds = game1_object.skipTakeoffUpdatesPerSeconds;
            game1_object.skipTakeoff = true;
            game1_object.resumeAnimation ();
            closeMessageDialog ();
         });
         setMessageDialogButtonRightText ("ok");
         setMessageDialogButtonRightOnclick (closeMessageDialog);
      }

      this.started = false;
      scene = new THREE.Scene();
      scene.fog = new THREE.Fog (0x7575ff, 2000, this.cameraFar);

      this.planeObject = new Plane ({lift_and_gravity_deactivated: false, hasSpotLight: true, consumesFuel: true, deactivateDepthWrite: true});
      this.planeObject.setActive(true, false);
      let plane = this.planeObject.plane;

      camera.remove (soundGeneratorAudioListener);
      camera = new THREE.PerspectiveCamera(75, cameraAspect, 0.1, this.cameraFar);
      camera.add (soundGeneratorAudioListener);
      var skySphere = new SkySphere (this.cameraFar);
      this.skySphere = skySphere;
      skySphere.setSunPosition (5000, 2500, -2500);
      scene.add (skySphere);

      this.cameraPosition = "cockpit";
      selectCameraPositionSpan (this.cameraPosition);
      camera.position.copy (this.cockpitCameraPosition);

      let text_object = this.add_text_object ("Menu", 0.15, 0.125, -0.25,
                                              0.0005);
      camera.add (text_object);

      this.flight_instruments_object = new FlightInstruments ();
      let flightInstruments = this.flight_instruments_object.flightInstruments;

      flightInstruments.scale.set (0.1, 0.1, 0.1);
      flightInstruments.position.x = 0;
      flightInstruments.position.y = -0.11;
      flightInstruments.position.z = -0.15;
      flightInstruments.rotation.x = -0.2;
      camera.add (flightInstruments);
      this.planeObject.setFlightInstruments (this.flight_instruments_object);

      this.plane_scene = new THREE.Scene();

      this.text_object_number1 = this.add_text_object ("1", 0, 0, -0.5,
                                              0.0025, true);
      this.text_object_number1.visible = false;
      camera.add (this.text_object_number1);

      this.text_object_number2 = this.add_text_object ("2", 0, 0, -0.5,
                                              0.0025, true);
      this.text_object_number2.visible = false;
      camera.add (this.text_object_number2);

      this.text_object_number3 = this.add_text_object ("3", 0, 0, -0.5,
                                              0.0025, true);
      this.text_object_number3.visible = false;
      camera.add (this.text_object_number3);

      this.game_over_menu = new GameOverMenu ();
      let game_over_menu_scene = this.game_over_menu.game_over_menu_scene;
      game_over_menu_scene.position.x = 0;
      game_over_menu_scene.position.y = 0;
      game_over_menu_scene.position.z = -0.25;
      camera.add (game_over_menu_scene);

      camera.rotation.y = Math.PI;
      this.plane_scene.add (plane);
      this.planeObject.plane.add (camera);

      this.planeObject.setPlaneScene (this.plane_scene);
      this.planeObject.startEngine ();
      this.planeObject.throttle = 1;
      if (this.skipTakeoff) {
         this.planeObject.updatesPerSeconds = this.skipTakeoffUpdatesPerSeconds;
      }

      scene.add (this.plane_scene);

      let game1 = this;
      let add_terrain = function (event) {
         let values = event.data;
         let terrain = new Terrain (values.width, values.height,
                                    values.width_segments, values.height_segments);
         terrain.fine_height_map = new Array2d (values.fine_height_map_height, values.fine_height_map_width,
                                                values.fine_height_map_array, true);
         game1.heightMaps[(-values.position_y/values.height)+" "+values.position_x/values.width] = terrain.fine_height_map;
         terrain.scale_x = values.scale_x;
         terrain.scale_y = values.scale_y;
         terrain.coarse_map_divisor = values.coarse_map_divisor;
         terrain.runway_altitude = values.runway_altitude;
         terrain.ground_geometry = new THREE.BufferGeometry ();
         terrain.ground_geometry.index = new THREE.Uint16BufferAttribute(values.geometry_index, 1);
         terrain.ground_geometry.setAttribute ("position", new THREE.Float32BufferAttribute (values.vertex_position, 3));
         terrain.ground_geometry.setAttribute ("color", new THREE.Float32BufferAttribute (values.vertex_color, 3));
         terrain.ground_geometry.setAttribute ("normal", new THREE.Float32BufferAttribute(values.normal, 3));
         terrain.ground_geometry.setAttribute ("uv", new THREE.Float32BufferAttribute(values.uv, 2));
         terrain.createGround ();
//         terrain.drawHeightMap ();
         terrain.ground.position.y = -0.025;
         terrain.ground.rotation.x = -1/2*Math.PI;
         terrain.ground.position.z = values.position_y;
         scene.add (terrain.ground);
         game1.addTrees (values.position_y);
         if (game1_renderForests) {
            for (let i=0; i<50; i++) {
               game1.addForest (values.position_y);
            }
         }
         game1.addObjectsAndClouds (values.position_x, values.position_y, values.height,
                                    values.min_altitude, terrain.fine_height_map);
         return terrain;
      }

      this.terrainWebWorker.onmessage = function (event) {

         let terrain = add_terrain (event);

         game1.runway = new Runway ();
         game1.planeObject.setRunways ([game1.runway]);
         game1.runway.runway_scene.position.y = terrain.runway_altitude;

         game1.planeObject.plane_scene.position.set (0, terrain.runway_altitude+0.01+game1.planeObject.centerOfMass.y, game1.planeObject.centerOfMass.z);
         scene.add (game1.runway.runway_scene);

//         let airport = new Airport().object3d;
//         airport.scale.x = 0.45;
//         airport.scale.y = 0.45;
//         airport.scale.z = 0.45;
//         airport.position.x = -7;
//         airport.position.y = terrain.runway_altitude+0.1;
//         airport.position.z = 495;
//         airport.rotation.y = Math.PI;
//         scene.add (airport);

         game1.ground = terrain.ground;
         let game1_object = game1;
         game1.planeObject.setCollisionDetectionCallback (function (interval, boundingBoxes, collisionDetectionSpheres, velocity, handleWheelsOnRunway = true) {
            game1.collisionDetectionCallback (game1_object, interval, boundingBoxes, collisionDetectionSpheres, velocity, handleWheelsOnRunway);
         });

         game1.add_animate_function (game1.currentUpdatePlane);
         if (game1.simulationType!=="particle_system") {
            game1.add_animate_function (game1.takeOff);
         }
         else {
            game1.planeObject.elevators.rotation.x = -Math.PI/32;
            game1.add_animate_function (game1.takeOffRigidBodyDynamics);
         }

         game1.terrainWebWorker.onmessage = add_terrain;
      }
      this.terrainWebWorker.postMessage ({width: 10000, height: 10000,
                                                width_segments: 128, height_segments: 128,
                                                additional_segments: 3});
      this.terrainWebWorker.postMessage ({position_x: 0, position_y: 0, 
                                            min_altitude: 250, max_altitude: 1500, runway: true});

      current_scene = this;
   }

   close () {
      this.terrainWebWorker.terminate ();
      if (this.webSocket) {
         this.webSocket.close ();
      }
      this.planeObject.disposeObjects();
   }

   addTerrain () {
      if (this.planeObject.plane_scene.position.z-this.terrainLastAddedY>500) {
         this.terrainWebWorker.postMessage ({position_x: this.planeObject.plane_scene.position.x,
                                               position_y: this.terrainLastAddedY+10000, 
                                               min_altitude: 250, max_altitude: 1500, runway: false});
         this.terrainLastAddedY = this.terrainLastAddedY+10000;
      }
   }

   resumeAnimation () {
      var time = window.performance.now ();
      if (this.takingoff && this.skipTakeoff) {
         time = time*this.skipTakeoffSpeedFactor;
      }
      this.animate_time = time;
      this.planeObject.resumeAnimation(time);
   }

   animate () {
      var time = window.performance.now ();

      if (this.takingoff && this.skipTakeoff) {
         time = time*this.skipTakeoffSpeedFactor;
      }

      if (this.animate_time == null) {
         this.animate_time = time;
         return;
      }

      let interval = time-this.animate_time;

      for (let i=0; i<this.animateFunctions.length; i++) {
         if (this.animateFunctions[i] (this, time, this.animate_time, interval)) {
            if (this.cameraAnimateFunction) {
               this.cameraAnimateFunction (this);
            }
            break;
         }
      }

      this.addTerrain ();

      camera.getWorldPosition(this.skySphere.position);

      this.animate_time = time;
   }
}

GameFlightOverTheMountains.gameOverText = null;
Plane.gltf_plane = null;

export default GameFlightOverTheMountains;