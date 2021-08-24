import * as THREE from './three_js/build/three.module.js';
import {GLTFLoader} from './three_js/examples/jsm/loaders/GLTFLoader.js';
//import {SoundGeneratorAudioListener} from './sound/sound_generator_worklet.js';
import Plane from './plane.js';
import GameFlightOverTheMountains from './game_mountains.js';
import GameIsland from './game_island.js';

class Menu {

   constructor (loadingManager) {
      let menu_object = this;
      var gltfLoader = new GLTFLoader(loadingManager);
      this.menu_button_click_callback = null;

      if (Menu.gltf_play_button != null) {
         this.clone ();
         return;
      }

      gltfLoader.load("play_button.gltf", function(gltf) {
         Menu.gltf_play_button = gltf;
         menu_object.clone ();         
      }, 
      function (xhr) {
         console.log("object: "+( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      function (error) {
         console.error(error);
      });
   }

   clone () {
      let menu_object = this;
      this.animate_time = undefined;
      this.play_button_scene = Menu.gltf_play_button.scene.clone ();

      this.play_button_scene.position.x = 0;
      this.play_button_scene.position.y = 0;
      this.play_button_scene.position.z = 0;

      this.play_button_scene.traverse (function (object) {
         console.log (object.name);
         switch (object.name) {
            case "play_button":
               menu_object.play_button = object;
               break;
         }
      });
   }

   start_game1 () {
      let game = new GameFlightOverTheMountains (game1_simulationType);
      game.show ();
   }

   start_game2 () {
      let game = new GameIsland ();
      game.show ();
   }

   start_game3 () {
      window.alert ("Not implemented.");
   }

   menu_select_game_entry_click_callback (object, callback, start_time, time, interval) {
      let current_interval = time-start_time;
      object.rotation.x = -current_interval/250*2*Math.PI;

      if (time-start_time >= 250) {
         object.rotation.x = 0;
         this.menu_button_click_callback = null;
         this.plane_object.setActive(false, false);
         callback ();
      }
   }

   click (event) {
      mouse_vector.x = (event.offsetX/renderer.domElement.clientWidth)*2-1;
      mouse_vector.y = -(event.offsetY/renderer.domElement.clientHeight)*2+1;
      raycaster.setFromCamera (mouse_vector, camera);
      var intersects = raycaster.intersectObjects (scene.children, true);

      if (intersects.length > 0) {

         var object = intersects[0].object;

         while (object.parent != scene) {
            object = object.parent;
         }

         if (object == this.play_button_scene && this.menu_button_click_callback == null) {
            console.log ("play_button");

            soundGeneratorAudioListener.context.resume ();

            let start_time = window.performance.now ();
            this.menu_button_click_callback = function (time, interval) {
               this.play_button.rotation.x -= interval/500*2*Math.PI;
               let scale = interval/500*0.75;
               this.play_button.scale.x -= scale;
               this.play_button.scale.y -= scale;
               this.play_button.scale.z -= scale;
               if (time-start_time >= 500) {
                  scene.remove (this.play_button_scene);
                  this.text_help.position.x += 2;
                  this.text_help.position.y += 2.5;
                  this.menu_button_click_callback = null;
                  let select_game_menu_title = this.addText ("Select a Game", -10.5, 8.5, 5, 0.025);
                  this.select_game_menu_objects = [select_game_menu_title];
                  let menu_object = this;

                  this.addSelectGameMenuEntry ("Flight Over the Mountains", 0.01, function (object) {
                     let start_time = window.performance.now ();
                     menu_object.menu_button_click_callback = function (time, interval) {
                        menu_object.menu_select_game_entry_click_callback (object, this.start_game1, start_time, time, interval);
                     };
                  });
                  this.addSelectGameMenuEntry ("Island", 0.01, function (object) {
                     let start_time = window.performance.now ();
                     menu_object.menu_button_click_callback = function (time, interval) {
                        menu_object.menu_select_game_entry_click_callback (object, this.start_game2, start_time, time, interval);
                     };
                  });

                  this.addSelectGameMenuEntry ("Race (Multiplayer)", 0.01, function (object) {
                     let start_time = window.performance.now ();
                     menu_object.menu_button_click_callback = function (time, interval) {
                        menu_object.menu_select_game_entry_click_callback (object, this.start_game3, start_time, time, interval);
                     };
                  });

                  this.select_game_menu_entry_position_y = undefined;
               }
            };
         }
         else if (object.onclick_callback != undefined && this.menu_button_click_callback == null) {
            object.onclick_callback ();
         }
         else if (object == this.plane_object.plane_scene) {
            this.plane_object.planeRotationPosition.rotation.y -= Math.PI/4;
         }
         else if (object == this.text_help) {
            window.open("/help.htm", '_blank').focus();
         }
      }
   }

   addText (text, x, y, z, scale) {
      let text_geometry = new THREE.TextGeometry (text, {font: font});
      let text_material = new THREE.MeshPhongMaterial ();
      let text_object = new THREE.Mesh (text_geometry, text_material);
      text_object.position.set (x, y, z);
      text_object.scale.set (scale, scale, scale/10);
      scene.add (text_object);
      return text_object;
   }

   addSelectGameMenuEntry (text, scale, onclick_callback) {

      if (this.select_game_menu_entry_position_y == undefined) {
         this.select_game_menu_entry_position_y = 5;
      }

      let text_object = this.addText (text, 0, this.select_game_menu_entry_position_y, 5, scale);

      text_object.geometry.computeBoundingBox ();
      let text_background_geometry = new THREE.PlaneBufferGeometry (text_object.geometry.boundingBox.max.x-
                                                                    text_object.geometry.boundingBox.min.x,
                                                                    text_object.geometry.boundingBox.max.y-
                                                                    text_object.geometry.boundingBox.min.y);
      let text_background_material = new THREE.MeshBasicMaterial ({opacity: 0, transparent: true});
      let text_background = new THREE.Mesh (text_background_geometry, text_background_material);
      text_background.position.set (0, 0, 0);

      text_object.geometry.center ();
      let text_scene = new THREE.Scene ();
      text_scene.add (text_object);
      text_object.add (text_background);

      text_scene.onclick_callback = function () {
         onclick_callback (text_object);
      };
      this.select_game_menu_objects.push (text_object);

      scene.add (text_scene);

      this.select_game_menu_entry_position_y -= scale*175;
   }

   show () {

      scene = new THREE.Scene();
      camera.remove (soundGeneratorAudioListener);
      camera = new THREE.PerspectiveCamera(75, cameraAspect, 0.1, 1000);
      camera.add (soundGeneratorAudioListener);
      camera.position.x = 0;
      camera.position.y = 5;
      camera.position.z = 15;

      let ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      let directionalLight = new THREE.DirectionalLight(0xffffff, 2);
      directionalLight.position.x = 100;
      directionalLight.position.y = 200;
      directionalLight.position.z = 100;
      scene.add(directionalLight);

      let ground_geometry = new THREE.PlaneBufferGeometry (1000, 1000);
      let ground_material = new THREE.MeshPhongMaterial ({color: 0x004500, specular: 0x004500});
      let ground = new THREE.Mesh (ground_geometry, ground_material);
      ground.rotation.x = -1/2*Math.PI;
      scene.add (ground);

      scene.add (this.play_button_scene);

      let text_geometry_help = new THREE.TextGeometry ("?", {font: font});
      let text_help_material = new THREE.MeshPhongMaterial ();
      let text_help = new THREE.Mesh (text_geometry_help, text_help_material);
      this.text_help = text_help;
      text_help.geometry.computeBoundingBox ();

      let text_background_geometry = new THREE.PlaneBufferGeometry (text_help.geometry.boundingBox.max.x-
                                                                    text_help.geometry.boundingBox.min.x,
                                                                    text_help.geometry.boundingBox.max.y-
                                                                    text_help.geometry.boundingBox.min.y);
      let text_background_material = new THREE.MeshBasicMaterial ({opacity: 0, transparent: true});
      let text_background = new THREE.Mesh (text_background_geometry, text_background_material);
      text_background.position.set (text_help.geometry.boundingBox.max.x-text_help.geometry.boundingBox.min.x-3,
                                    0.5*(text_help.geometry.boundingBox.max.y-text_help.geometry.boundingBox.min.y), 0);
      text_help.add(text_background);

      text_help.position.set (10, 7.5, 5);
      text_help.scale.set (0.025, 0.025, 0.0025);
      scene.add (text_help);

      this.plane_object = new Plane ({lift_and_gravity_deactivated: true});
      let plane = this.plane_object.plane_scene;
      plane.rotation.y = -1/2*Math.PI;
      this.plane_object.setActive(true, false);
      this.plane_object.throttle = 1;
      plane.position.set (75, 20, -20);
      scene.add (plane);

      setCurrentScene (this);
   }

   resumeAnimation () {
      this.animate_time = window.performance.now ();
   }

   animate () {
      var time = window.performance.now ();

      var planeRotationPosition = this.plane_object.planeRotationPosition;

      if (planeRotationPosition.position.x <= -75) {
         planeRotationPosition.position.x = 75;
      }
      else if (planeRotationPosition.position.x > 75) {
         planeRotationPosition.position.x = -75;
      }
      else if (planeRotationPosition.position.z <= -200) {
         planeRotationPosition.position.z = 0;
      }
      else if (planeRotationPosition.position.z > 0) {
         planeRotationPosition.position.z = -200;
      }

      this.plane_object.animate (time, this.animate_time, time-this.animate_time);

      if (this.animate_time == null) {
         this.animate_time = time;
         return;
      }

      var interval = time-this.animate_time;
      this.animate_time = time;

      if (this.menu_button_click_callback != null) {
         this.menu_button_click_callback (time, interval);
         return;
      }

      var scale = 1.0+0.05*Math.sin (time*0.005);
      this.play_button.scale.set (scale, scale, scale);

   }
}

Menu.gltf_play_button = null;

class GameOverMenu {
   constructor () {
      this.retry_callback = null;
      this.showRecordsCallback = null;
      this.game_over_menu_scene = new THREE.Scene ();

      this.game_over_menu_scene.add (this.addTextObject ("Game Over", 0, 0.1, 0, 0.0005));

      this.showScoreboardButtonScene = this.addTextObject ("Show Scoreboard", 0, 0.05, 0, 0.0001)
      this.game_over_menu_scene.add (this.showScoreboardButtonScene);

      this.resume_button_scene = this.addTextObject ("Resume", 0.1, 0, 0, 0.00025)
      this.game_over_menu_scene.add (this.resume_button_scene);

      this.main_menu_button_scene = this.addTextObject ("Main Menu", -0.1, 0, 0, 0.00025);
      this.game_over_menu_scene.add (this.main_menu_button_scene);

      this.game_over_menu_scene.renderOrder = 1;
      this.game_over_menu_scene.visible = false;
   }

   addTextObject (text, position_x, position_y, position_z, scale) {

      let text_scene = new THREE.Scene ();
      let text_geometry = new THREE.TextGeometry (text, {font: font});
      let text_material = new THREE.MeshPhongMaterial ({emissive: 0xaaaaaa});
      let text_object = new THREE.Mesh (text_geometry, text_material);

      text_object.position.set (position_x, position_y, position_z);
      text_object.scale.set (scale, scale, scale/10);
      text_object.geometry.center ();

      var text_object_edges = new THREE.EdgesGeometry(text_object.geometry, 90);
      var text_object_line_segments = new THREE.LineSegments(text_object_edges, new THREE.LineBasicMaterial({color: 0x000000}));
      text_object.renderOrder = 1;
      text_object_line_segments.renderOrder = 2;
      text_object.add (text_object_line_segments);
      text_object.renderOrder = 1;
      text_object_line_segments.renderOrder = 2;

      text_object.updateMatrixWorld (true);

      text_scene.add (text_object);

      text_object.geometry.computeBoundingBox ();
      let text_background_geometry = new THREE.PlaneBufferGeometry (text_object.geometry.boundingBox.max.x-text_object.geometry.boundingBox.min.x,
                                                                    text_object.geometry.boundingBox.max.y-text_object.geometry.boundingBox.min.y);
      let text_background_material = new THREE.MeshBasicMaterial ({opacity: 0, transparent: true});
      let text_background = new THREE.Mesh (text_background_geometry, text_background_material);
      text_background.applyMatrix4 (text_object.matrixWorld);
      text_background.geometry.center ();
      text_scene.add (text_background);
//      let box = new THREE.BoxHelper (text_background, 0xff0000);
//      text_scene.add (box);
      return text_scene;
   }

   click (game_over_menu_object, event) {
      mouse_vector.x = (event.offsetX/renderer.domElement.clientWidth)*2-1;
      mouse_vector.y = -(event.offsetY/renderer.domElement.clientHeight)*2+1;
      raycaster.setFromCamera (mouse_vector, camera);
      var intersects = raycaster.intersectObjects ([game_over_menu_object.main_menu_button_scene,
                                                    game_over_menu_object.resume_button_scene,
                                                    game_over_menu_object.showScoreboardButtonScene], true);

      if (intersects.length > 0) {

         var object = intersects[0].object;
         while (object.parent != undefined &&
                object.parent != game_over_menu_object.game_over_menu_scene) {
            object = object.parent;
         }
         if (object == game_over_menu_object.main_menu_button_scene) {
            game_over_menu_object.main_menu_callback ();
         }
         else if (object == game_over_menu_object.resume_button_scene) {
            game_over_menu_object.retry_callback ();
         }
         else if (object == game_over_menu_object.showScoreboardButtonScene) {
            if (game_over_menu_object.showScoreboardCallback) {
               game_over_menu_object.showScoreboardCallback();
            }
            else {
               rankingDialog.show();
            }
         }
      }
   }

   setShowRecordsCallback (showRecordsCallback) {
      this.showRecordsCallback = showRecordsCallback;
   }

   setMainMenuCallback (main_menu_callback) {
      this.main_menu_callback = main_menu_callback;
   }

   setRetryCallback (retry_callback) {
      this.retry_callback = retry_callback;
   }
}

class MenuGame {
}

export {Menu, GameOverMenu}