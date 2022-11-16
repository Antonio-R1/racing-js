/*
 * Copyright (c) 2021-2022 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/blob/main/LICENSE | GNU AGPLv3
 */

import * as THREE from './three_js/build/three.module.js';
import LinkedList from './linked_list.js';
import Game from './game.js';
import {Menu, GameOverMenu} from './menu.js';
import Camera from './camera.js';
import Car from './car.js';
import Plane from './plane.js';
import Pilot from './pilot.js';
import Barrel from './barrel.js';
import Coin from './coin.js';
import SkySphere from './sky.js';
import Island from './island.js';
import {Water} from './three_js/examples/jsm/objects/Water.js';

var DISABLE_DEACTIVATION = 4;

var DefaultFilter = 1;
var StaticFilter = 2;
var AllFilter = -1;
var RigidBodyFilter = 64;

class GameIsland extends Game {

   constructor () {
      super ();
      this.score = 0;
      this.webSocket = null;
      this.water = null;
      this.island = null;
      this.updatesPerSecond = 240;
      this.updateInterval = 1/this.updatesPerSecond;
      this.lastTimeAnimate = 0;
      this.cameraFar = 4500;
      this.physicsWorld = null;
      this.contactResultCallback = null;
      this.clock = new THREE.Clock ();
      this.rigidBodies = [];
      this.TRANSFORM_CONST = new Ammo.btTransform();
      this.initPhysicsWorld ();
      this.islandObject3d = null;
      this.pilots = [];
      this.linkedListCollisionSpheres = new LinkedList ();
      // array of the Ammo.js objects for which we need to call Ammo.destroy
      this.ammoObjects = [];

      this.gameOverMenu = new GameOverMenu ();
      let gameOverMenuScene = this.gameOverMenu.game_over_menu_scene;
      gameOverMenuScene.position.x = 0;
      gameOverMenuScene.position.y = 0;
      gameOverMenuScene.position.z = -0.25;
      this.gameOverMenuScene = gameOverMenuScene;
   }

   initPhysicsWorld () {
      var collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
      var dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
      var broadphase = new Ammo.btDbvtBroadphase();
      var solver = new Ammo.btSequentialImpulseConstraintSolver();
      this.physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
      let overlappingPairCache = this.physicsWorld.getPairCache ();
      overlappingPairCache.setInternalGhostPairCallback (new Ammo.btGhostPairCallback ());
      this.physicsWorld.setGravity(new Ammo.btVector3(0, -9.81, 0));

      let gameIsland = this;
      this.contactResultCallback = new Ammo.ConcreteContactResultCallback ();
      this.contactResultCallback.addSingleResult = function (cp, colObj0Wrap, partId0, index0, colObj1Wrap, partId1, index1) {
         let manifoldPoint = Ammo.wrapPointer(cp, Ammo.btManifoldPoint);
         if (manifoldPoint.getDistance()>0) {
            return;
         }

         let collisionObjectWrapper0 = Ammo.wrapPointer (colObj0Wrap, Ammo.btCollisionObjectWrapper);
         let collisionObject0 = Ammo.castObject(collisionObjectWrapper0.getCollisionObject(), Ammo.btGhostObject);

         let collisionObjectWrapper1 = Ammo.wrapPointer (colObj1Wrap, Ammo.btCollisionObjectWrapper);
         let collisionObject1 = Ammo.castObject(collisionObjectWrapper1.getCollisionObject(), Ammo.btGhostObject);
         if (collisionObject1.type==="barrel" &&
             !collisionObject1.removed) {
            gameIsland.linkedListCollisionSpheres.removeNode (collisionObject1.linkedListNode);
            collisionObject1.removed = true;
            scene.remove (collisionObject1.object3d);
            gameIsland.physicsWorld.removeCollisionObject (collisionObject1);
            gameIsland.plane.fuelPercentage = 100;
            gameIsland.addRandomCollisionObject ();
         }
         else if (collisionObject1.type==="coin" &&
                  !collisionObject1.removed) {
            gameIsland.linkedListCollisionSpheres.removeNode (collisionObject1.linkedListNode);
            collisionObject1.removed = true;
            gameIsland.score += 100;
            setScore (gameIsland.score);
            scene.remove (collisionObject1.object3d);
            gameIsland.physicsWorld.removeCollisionObject (collisionObject1);
            gameIsland.addRandomCollisionObject ();
         }
      }
   }

   addBox ({x, y, z, width, height, depth,
            color, opacity = 1, transparent = false, mass, isKinematicObject = false, receiveShadow, castShadow,
            addObjectToScene = true}) {
      let box = new THREE.Mesh (new THREE.BoxBufferGeometry (width, height, depth),
                                new THREE.MeshPhongMaterial({color: color, opacity: opacity,
                                                             transparent: transparent}));
      box.position.x = x;
      box.position.y = y;
      box.position.z = z;
      box.receiveShadow = receiveShadow;
      box.castShadow = castShadow;
      if (addObjectToScene) {
         scene.add (box);
      }
      var transform = new Ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(new Ammo.btVector3(box.position.x, box.position.y, box.position.z));
      transform.setRotation(new Ammo.btQuaternion(box.quaternion.x, box.quaternion.y, box.quaternion.z,
                                                  box.quaternion.w));
      var motionState = new Ammo.btDefaultMotionState(transform);
      var boxShape = new Ammo.btBoxShape(new Ammo.btVector3 (0.5*width, 0.5*height, 0.5*depth));

      var localInertia = new Ammo.btVector3(0, 0, 0);
      boxShape.calculateLocalInertia(mass, localInertia);

      var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, boxShape, localInertia);
      var body = new Ammo.btRigidBody(rbInfo);
//      body.setRestitution (1);
//      body.setRollingFriction (10000);
//      body.setCcdMotionThreshold(1e-7);
//      body.setCcdSweptSphereRadius(Math.sqrt(height*height+length*length+depth*depth));
      if (isKinematicObject) {
         body.setActivationState(DISABLE_DEACTIVATION);
         const KINEMATIC_OBJECT = 2;
         body.setCollisionFlags(KINEMATIC_OBJECT);
      }

      this.physicsWorld.addRigidBody (body);

      if (mass > 0 || isKinematicObject) {
         box.rigidBody = body;
         this.rigidBodies.push (box);
      }

      return {body: body, object3d: box, motionState: motionState, transform: transform};
   }

   addBall ({x, y, z}) {
      var radius = 1;
      var mass = 1;
      let sphere = new THREE.Mesh (new THREE.SphereBufferGeometry(radius, 32, 32), new THREE.MeshPhongMaterial({color: 0xffffff}));
      sphere.position.x = x;
      sphere.position.y = y;
      sphere.position.z = z;
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      scene.add (sphere);

      var transform = new Ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(new Ammo.btVector3(sphere.position.x, sphere.position.y, sphere.position.z));
      transform.setRotation(new Ammo.btQuaternion(sphere.quaternion.x, sphere.quaternion.y, sphere.quaternion.z,
                                                  sphere.quaternion.w));
      var motionState = new Ammo.btDefaultMotionState(transform);
      var sphereShape = new Ammo.btSphereShape(radius);

      var localInertia = new Ammo.btVector3(0, 0, 0);
      sphereShape.calculateLocalInertia(mass, localInertia);

      var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, sphereShape, localInertia);
      var body = new Ammo.btRigidBody(rbInfo);
      body.setRestitution (0.875);
      body.setRollingFriction (0.1);
      body.setLinearVelocity (new Ammo.btVector3(1, 0, 0));

      this.physicsWorld.addRigidBody (body);

      sphere.rigidBody = body;
      this.rigidBodies.push (sphere);
   }

   addCollisionSphere ({object3d, radius, color, type}) {

      let linkedListNode = this.linkedListCollisionSpheres.addLast (object3d.position);

      var sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);
      var sphereMaterial = new THREE.MeshPhongMaterial({color: color, emissive: color, emissiveIntensity: 0.25, opacity: 0.25, transparent: true});
      var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      object3d.add (sphere);
      scene.add (object3d);

      var transform = new Ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(new Ammo.btVector3(object3d.position.x, object3d.position.y, object3d.position.z));
      var sphereShape = new Ammo.btSphereShape(radius);
      var ghostObject = new Ammo.btGhostObject();
      ghostObject.type = type;
      ghostObject.removed = false;
      ghostObject.linkedListNode = linkedListNode;
      ghostObject.object3d = object3d;
      ghostObject.setCollisionShape (sphereShape);
      let CF_NO_CONTACT_RESPONSE = 4;
      ghostObject.setCollisionFlags (CF_NO_CONTACT_RESPONSE);
      ghostObject.setWorldTransform (transform);
      this.physicsWorld.addCollisionObject (ghostObject, DefaultFilter^StaticFilter, AllFilter^StaticFilter^RigidBodyFilter);
   }

   addRandomCollisionObject () {
      let randomNumber = Math.random ();
      let x = 2000*Math.random()-1000;
      let y = 450*Math.random()+100;
      let z = 2000*Math.random()-1000;
      let position = new THREE.Vector3(x, y, z);
      if (randomNumber < 0.75) {
         this.addCoin (position);
      }
      else {
         this.addBarrel (position);
      }
   }

   addCoin (position) {
      let coin = new Coin ();
      coin.object3d.position.copy (position);
      this.addCollisionSphere ({object3d: coin.object3d, radius: 16, color: 0xffdf00, type: "coin"});
   }

   addBarrel (position) {
      let barrel = new Barrel ();
      barrel.object3d.position.copy (position);
      this.addCollisionSphere ({object3d: barrel.object3d, radius: 16, color: 0x000000, type: "barrel"});
   }

   addObject ({object3d, position, scale, mass, isKinematicObject = false, receiveShadow = false, castShadow = false,
               showVertices = false, type}) {
      var transform = new Ammo.btTransform();
      transform.setIdentity();
      position = new THREE.Vector3 (object3d.position.x*scale.x+position.x,
                                    object3d.position.y*scale.y+position.y,
                                    object3d.position.z*scale.z+position.z);
      transform.setOrigin(new Ammo.btVector3(position.x,
                                             position.y,
                                             position.z));
      transform.setRotation(new Ammo.btQuaternion(object3d.quaternion.x, object3d.quaternion.y, object3d.quaternion.z,
                                                  object3d.quaternion.w));
      var motionState = new Ammo.btDefaultMotionState(transform);

      let triangles = new Ammo.btTriangleMesh ();
      this.ammoObjects.push(triangles);
      var positionsArray = object3d.geometry.attributes.position.array;
      var index = object3d.geometry.index.array;
      let vertices = [];

      for (let i=0; i*3<index.length; i++) {
         let triangle1 = new Ammo.btVector3 (positionsArray[index[i*3]*3],
                                             positionsArray[index[i*3]*3+1],
                                             positionsArray[index[i*3]*3+2]);
         let triangle2 = new Ammo.btVector3 (positionsArray[index[i*3+1]*3],
                                             positionsArray[index[i*3+1]*3+1],
                                             positionsArray[index[i*3+1]*3+2]);
         let triangle3 = new Ammo.btVector3 (positionsArray[index[i*3+2]*3],
                                             positionsArray[index[i*3+2]*3+1],
                                             positionsArray[index[i*3+2]*3+2]);

         vertices.push (positionsArray[index[i*3]*3],
                        positionsArray[index[i*3]*3+1],
                        positionsArray[index[i*3]*3+2]);
         vertices.push (positionsArray[index[i*3+1]*3],
                        positionsArray[index[i*3+1]*3+1],
                        positionsArray[index[i*3+1]*3+2]);
         vertices.push (positionsArray[index[i*3+2]*3],
                        positionsArray[index[i*3+2]*3+1],
                        positionsArray[index[i*3+2]*3+2]);
         triangles.addTriangle (triangle1, triangle2, triangle3);
         Ammo.destroy (triangle1);
         Ammo.destroy (triangle2);
         Ammo.destroy (triangle3);
      }

      if (showVertices) {
         this.points_geometry = new THREE.BufferGeometry ();
         this.points_geometry.setAttribute ("position", new THREE.Float32BufferAttribute (vertices, 3));
         var points_material = new THREE.PointsMaterial ({color: 0xff0000, size: 0.25});
         this.objectPoints = new THREE.Points (this.points_geometry, points_material);
         this.objectPoints.position.copy (position);
         this.objectPoints.scale.copy (scale);
         this.objectPoints.rotation.copy (object3d.rotation);
         scene.add (this.objectPoints);
      }

      let triangleShape = new Ammo.btBvhTriangleMeshShape(triangles, true, true);
      this.ammoObjects.push(triangleShape);
      triangleShape.setLocalScaling(new Ammo.btVector3(scale.x, scale.y, scale.z));

      var localInertia = new Ammo.btVector3(0, 0, 0);
      triangleShape.calculateLocalInertia(mass, localInertia);

      var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, triangleShape, localInertia);
      this.ammoObjects.push(rbInfo);
      var body = new Ammo.btRigidBody(rbInfo);
      this.ammoObjects.push(body);
      body.type = type;
      body.setRestitution (1);
      body.setRollingFriction (1);

      if (isKinematicObject) {
         body.setActivationState(DISABLE_DEACTIVATION);
         const KINEMATIC_OBJECT = 2;
         body.setCollisionFlags(KINEMATIC_OBJECT);
      }

      let isDynamicObject = mass>0;
      this.physicsWorld.addRigidBody (body, isDynamicObject ? DefaultFilter | RigidBodyFilter : StaticFilter | RigidBodyFilter,
                                            isDynamicObject ? AllFilter : AllFilter^StaticFilter^RigidBodyFilter);

      if (mass > 0 || isKinematicObject) {
         object3d.rigidBody = body;
         this.rigidBodies.push (object3d);
      }
   }

   addTextObject (text, position_x, position_y, position_z, scale, center) {
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

   mouseDown (event) {

      var mouseX = event.offsetX/renderer.domElement.clientWidth;
      var mouseY = event.offsetY/renderer.domElement.clientHeight;
      if (mouseX>0.725 && mouseY<0.2) {
         showSettingsMenu();
      }

      if (!this.started) {
         return;
      }
   }

   mouseMove (x, y, width, height) {
      let pilot = this.pilots[0];
      if (pilot.vehicle) {
         pilot.vehicle.mouseMove (x, y, width, height);
         return;
      }
   }

   cameraButtonOnclick () {
      let pilot = this.pilots[0]
      if (pilot.vehicle) {
         pilot.vehicle.keyUpString ("c");
      }
   }

   keyDown (event) {

      let pilot = this.pilots[0];
      if (pilot.vehicle) {
         pilot.vehicle.keyDown (event);
         return;
      }
      this.pilot.keyDown (event);
   }

   keyUp (event) {
      if (event.type != "keyup") {
         return;
      }

      let pilot = this.pilots[0];
      if (pilot.vehicle) {
         if (event.key === "e") {
            pilot.exitVehicle ();
            setStatusBar (true, this.pilotStatusBarText);
            return;
         }
         pilot.vehicle.keyUp (event);
         return;
      }
      this.pilot.keyUp (event);
   }

   addWaterObject3d ({x, y, z, width, height}) {
      const waterGeometry = new THREE.PlaneGeometry(width, height, 10, 10);

      this.water = new Water(waterGeometry,
                        {textureWidth: 512, textureHeight: 512,
                         waterNormals: new THREE.TextureLoader().load("three_js/textures/waternormals.jpg", function (texture) {
                         texture.wrapS = texture.wrapT = THREE.RepeatWrapping;}),
                         waterColor: 0x001e0f,
                         alpha: 1.0,
                         sunDirection: new THREE.Vector3(),
                         sunColor: 0xffffff,
                         distortionScale: 3.7,
                         fog: scene.fog !== undefined});
      this.water.rotation.x = -Math.PI/2;
      this.water.position.set (x, y, z);
      scene.add (this.water);
   }

   show () {
      setCurrentScene (this);
      showMenuBar (false);
      showDivThrottle (false);
      setScore (this.score);
      this.pilotStatusBarText = "&uarr;&nbsp;walk | &larr;&nbsp;&rarr;&nbsp;turn&nbsp;left&nbsp;or&nbsp;right | SPACE&nbsp;jump | P&nbsp;pause";
      setStatusBar (true, this.pilotStatusBarText);
      scene = new THREE.Scene();
      scene.fog = new THREE.Fog (0x7575ff, 2000, this.cameraFar);

      camera = new THREE.PerspectiveCamera(75, cameraAspect, 0.1, this.cameraFar);
      this.cameraStartFocalLength = camera.getFocalLength();
      camera.rotation.y = Math.PI;
      camera.position.set (0, 5, -10);
      this.sceneCamera = camera;
      var skySphere = new SkySphere (this.cameraFar);

      let sunPositionX = 5000;
      let sunPositionY = 2500;
      let sunPositionZ = -3500;
      if (Math.random()<0.2) {
         sunPositionX = 5000;
         sunPositionY = 125;
         sunPositionZ = 2500;
      }

      skySphere.setSunPosition (sunPositionX, sunPositionY, sunPositionZ);
      this.skySphere = skySphere;
      scene.add (skySphere);
      camera.add (this.gameOverMenuScene);

      this.textMenu = this.addTextObject ("Menu", 0.15, 0.125, -0.25,
                                            0.0005);
      this.textMenuStartPositionZ = -0.25;
      camera.add (this.textMenu);

      scene.add (camera);

      this.addWaterObject3d ({x: 0, y: 0, z: 0, width: 100000, height: 100000});

      let island = new Island ();
      let islandRigidBodies = [];
      let gameIsland = this;
      island.object3d.traverse (function (obj) {
         if (obj.name=="Landscape") {
            gameIsland.islandObject3d = obj;
         }
         else if (obj.name.startsWith("fence") ||
                  obj.name.startsWith("wall") ||
                  obj.name === "runway") {
            islandRigidBodies.push (obj);
         }
      });
      island.object3d.position.multiplyVectors (this.islandObject3d.position, island.object3d.scale).negate();
      this.addObject ({object3d: this.islandObject3d,
                       position: island.object3d.position, scale: island.object3d.scale, mass: 0, type: "island"});
      for (let i=0; i<islandRigidBodies.length; i++) {
         let obj = islandRigidBodies[i];
         this.addObject ({object3d: obj,
                          position: island.object3d.position, scale: island.object3d.scale, mass: 0});
      }
      scene.add(island.object3d);

      var staticPlaneShape = new Ammo.btStaticPlaneShape(new Ammo.btVector3(0, 1, 0), 0);
      this.ammoObjects.push(staticPlaneShape);
      var transform = new Ammo.btTransform ();
      transform.setIdentity ();
      var motionState = new Ammo.btDefaultMotionState (transform);
      var localInertia = new Ammo.btVector3 (0, 0, 0);
      var body = new Ammo.btRigidBody (new Ammo.btRigidBodyConstructionInfo (0, motionState, staticPlaneShape, localInertia));
      this.ammoObjects.push(body);
      body.type = "water";
      this.physicsWorld.addRigidBody (body, StaticFilter | RigidBodyFilter, AllFilter ^ StaticFilter ^ RigidBodyFilter);
//      this.addBox ({x: 0, y: -5, z: -250*0, width: 100, height: 10, depth: 100,
//                    color: 0xffffff, opacity: 1, transparent: true, mass: 0, isKinematicObject: true, receiveShadow: true, castShadow: false,
//                    addObjectToScene: true});

//      this.addBall({x: 0, y: 25, z: 10});

      let setCameraCallback = function (camera) {
         gameIsland.setCamera (camera);
      }

      let carStatusBarText = "&uarr;&nbsp;accelerate | &darr;&nbsp;brake | &larr;&nbsp;&rarr;&nbsp;steering | R&nbsp;reverse&nbsp;gear | S&nbsp;reset&nbsp;position | C&nbsp;change&nbsp;camera | L&nbsp;toggle&nbsp;lights | P&nbsp;pause";
      let car = new Car ({game: this, x: 0, y: 11, z: -25, hasSpotLights: true,
                          setCameraCallback: setCameraCallback, statusBarText: carStatusBarText});
      this.car = car;
//      this.currentVehicle = car;
      scene.add (car);

      let planeStatusBarText = " +&nbsp;-&nbsp;throttle | B&nbsp;brake | &larr;&nbsp;&rarr;&nbsp;steering wheel, rudder | mouse&nbsp;&darr;&nbsp;&uarr;&nbsp;elevator | mouse&nbsp;&larr;&nbsp;&rarr;&nbsp;ailerons | S&nbsp;reset&nbsp;position | C&nbsp;change&nbsp;camera | P&nbsp;pause";
      let plane = new Plane ({game: this, use3dPhysics: true, position: new THREE.Vector3 (85, 10, -100),
                              rotation: new THREE.Euler (0, 0.7*Math.PI, 0),
                              setCameraCallback: setCameraCallback, hasSpotLight: true, consumesFuel: true,
                              statusBarText: planeStatusBarText});
      this.plane = plane;
      this.plane.setLinkedListCollisionSpheres (this.linkedListCollisionSpheres);
      scene.add (plane);


      this.addCoin (new THREE.Vector3 (227, 10, -250));
      for (let i=0; i<2; i++) {
         this.addRandomCollisionObject ();
      }

      this.pilot = new Pilot ({game: this, x: 20, y: 16, z: -35,
                               setCameraCallback: setCameraCallback});
      this.pilot.setActive (true);
      this.pilots.push (this.pilot);
      scene.add (this.pilot);

      this.lastTimeAnimate = window.performance.now ();
   }

   close () {
      renderer.setClearColor(0x0000ff, 1);
      if (this.webSocket) {
         this.webSocket.close ();
      }

      for (let i=0; i<this.ammoObjects; i++) {
         Ammo.destroy(this.ammoObjects[i]);
      }

      this.car.disposeObjects ();
      this.plane.disposeObjects ();
   }

   resumeAnimation () {
      this.lastTimeAnimate = window.performance.now ();
   }

   /*
    * Sets the camera used by the renderer.
    * If this method is called without any argument,
    * "this.sceneCamera" is set for being
    * used by the renderer.
    */
   setCamera (newCamera) {
      camera.remove (this.textMenu);
      camera.remove (this.gameOverMenuScene);
      camera.remove (soundGeneratorAudioListener);
      if (!newCamera) {
         camera = this.sceneCamera;
      }
      else {
         newCamera.aspect = camera.aspect;
         newCamera.updateProjectionMatrix();
         camera = newCamera;
      }
      camera.add (soundGeneratorAudioListener);
      let focalLength = camera.getFocalLength();
      this.textMenu.position.z = this.textMenuStartPositionZ*focalLength/this.cameraStartFocalLength;
      camera.add (this.textMenu);
      camera.add (this.gameOverMenuScene);
   }

   showPauseDialog () {
      return !this.gameOverMenu.game_over_menu_scene.visible;
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
                  this.webSocket.send(JSON.stringify({type: "game_island_score", username: username, score: this.score}));
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

   click (event) {
      if (this.clickCallback != undefined) {
         this.clickCallback (event);
      }
   }

   openMainMenu () {
      setRocketButtonVisible (false);
      setCurrentScene(new Menu ());
      current_scene.show ();
   }

   retry () {
      let game = new GameIsland ();
      game.show ();
   }

   getAndUpdateScoreboard () {

      this.gameOverMenu.game_over_menu_scene.visible = true;
      this.clickCallback = (event) => {
         this.gameOverMenu.click (this.gameOverMenu, event);
      };
      this.gameOverMenu.setRetryCallback (this.retry);
      this.gameOverMenu.setMainMenuCallback (this.openMainMenu);

      this.webSocket = new WebSocket("wss://"+window.location.host);
      this.webSocket.onopen = (event) => {
         try {
            this.webSocket.send(JSON.stringify({type: "game_island_scoreboard"}));
         }
         catch (e) {
            console.warn(e);
         }
      };
      this.webSocket.onerror = (event) => console.warn(event);
      this.webSocket.onmessage = (event) => this.showUsernameDialogOnNewRecord (JSON.parse(event.data).scoreboard);
   }

   updateCameraBehindVehicle () {
      let pilot = this.pilot;
      if (pilot.vehicle) {
         if (pilot.vehicle.updateCameraBehindVehicle) {
            Camera.updateCameraBehindObject(this.physicsWorld, pilot.vehicle, camera, 1.75);
         }
      }
   }

   animate () {
      if (this.plane.fuelPercentage===0) {
         this.animate = this.updateCameraBehindVehicle;
         this.getAndUpdateScoreboard ();
         return;
      }

      let time = window.performance.now ();
      let interval = 0.001*(time-this.lastTimeAnimate);
      this.water.material.uniforms["time"].value += interval;
      this.lastTimeAnimate = time;


      var dt = this.clock.getDelta ();
      let fixedTimeStep = this.updateInterval;
      let steps = this.physicsWorld.stepSimulation (dt, 100, fixedTimeStep);

      let pilot = this.pilots[0];
      pilot.animate (dt, fixedTimeStep, steps, !pilot.vehicle);
      for (var i=0; i<this.rigidBodies.length; i++) {
         var obj = this.rigidBodies[i];

         if (obj.rigidBody) {
            let rigidBody = obj.rigidBody;
            let motionState = rigidBody.getMotionState ();

            if (motionState) {
               motionState.getWorldTransform (this.TRANSFORM_CONST);
               var position = this.TRANSFORM_CONST.getOrigin ();
               var quaternion = this.TRANSFORM_CONST.getRotation ();
               obj.position.set (position.x(), position.y(), position.z());
               obj.quaternion.set (quaternion.x(), quaternion.y(), quaternion.z(), quaternion.w());
            }
         }
         else if (obj.collisionObject) {
            let collisionObject = obj.collisionObject;
            let transform = collisionObject.getWorldTransform ();
            var position = transform.getOrigin ();
            var quaternion = transform.getRotation ();
            obj.position.set (position.x(), position.y(), position.z());
            obj.quaternion.set (quaternion.x(), quaternion.y(), quaternion.z(), quaternion.w());
         }

         var raycastVehicle = obj.raycastVehicle;
         if (raycastVehicle) {
            obj.animate (dt, fixedTimeStep, steps, obj.pilot);
            obj.updateTransform();
            if (pilot.vehicle) {
               this.physicsWorld.contactTest (pilot.vehicle.rigidBody, this.contactResultCallback);
               if (raycastVehicle==pilot.vehicle.raycastVehicle &&
                  obj.updateCameraBehindVehicle) {
                  Camera.updateCameraBehindObject(this.physicsWorld, obj, camera, 1.75);
               }
            }
         }
      }

      camera.getWorldPosition(this.skySphere.position);

   }
}

export default GameIsland;