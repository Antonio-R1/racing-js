import * as THREE from './three_js/build/three.module.js';
import {GLTFLoader} from './three_js/examples/jsm/loaders/GLTFLoader.js';

class FlightInstruments {

   constructor (loadingManager) {
      let flightInstruments_object = this;

      if (FlightInstruments.gltf_flightInstruments != null) {
         this.clone ();
         return;
      }

      var gltfLoader = new GLTFLoader(loadingManager);

      gltfLoader.load("gltf/flight_instruments.gltf", function(gltf) {
         FlightInstruments.gltf_flightInstruments = gltf;
         flightInstruments_object.clone ();
         flightInstruments_object.animate_time = null;
      }, 
      function (xhr) {
//         console.log("object: "+( xhr.loaded / xhr.total * 100 ) + '% loaded' );
      },
      function (error) {
         console.error (error);
      });
   }

   clone () {
      let obj = FlightInstruments.gltf_flightInstruments.scene.clone ();
      let flightInstruments_object = this;

      obj.traverse (function (object) {
//         console.log (object.name);
         switch (object.name) {
            case "airspeed_indicator_pointer":
               flightInstruments_object.airspeed_indicator_pointer = object;
               break;
            case "attitude_indicator_sphere":
               flightInstruments_object.attitude_indicator_sphere = object;
               break;
            case "altitude_indicator_pointer1":
               flightInstruments_object.altimeter_pointer1 = object;
               break;
            case "altitude_indicator_pointer2":
               flightInstruments_object.altimeter_pointer2 = object;
               break;
            case "altitude_indicator_pointer3":
               flightInstruments_object.altimeter_pointer3 = object;
               break;
            case "compass_dial":
               flightInstruments_object.compass_dial = object;
               break;
            case "variometer_pointer":
               flightInstruments_object.variometer_pointer = object;
               break;
            case "throttle_slider":
               flightInstruments_object.throttle_slider = new THREE.Scene ();
               flightInstruments_object.throttle_slider.position.x = object.position.x;
               flightInstruments_object.throttle_slider.position.y = object.position.y;
               flightInstruments_object.throttle_slider.position.z = object.position.z;
               flightInstruments_object.throttle_slider.start_position_y = flightInstruments_object.throttle_slider.position.y;
               flightInstruments_object.throttle_slider.start_position_z = flightInstruments_object.throttle_slider.position.z;
               object.position.x = 0;
               object.position.y = 0;
               object.position.z = 0;
               var throttle_slider_edges = new THREE.EdgesGeometry(object.geometry, 75);
               var throttle_slider_line_segments = new THREE.LineSegments(throttle_slider_edges, new THREE.LineBasicMaterial({color: 0x000000}));
               object.updateMatrixWorld ();
               throttle_slider_line_segments.applyMatrix4 (object.matrixWorld);
               flightInstruments_object.throttle_slider_object = object;
               flightInstruments_object.throttle_slider.add (throttle_slider_line_segments);

               break;
         }
      });

      this.attitudeIndicatorSphereAxisZ = new THREE.Scene ();
      this.attitudeIndicatorSphereAxisZ.position.copy (this.attitude_indicator_sphere.position);
      this.attitude_indicator_sphere.position.set (0, 0, 0);
      obj.remove (this.attitude_indicator_sphere);
      this.attitudeIndicatorSphereAxisZ.add (this.attitude_indicator_sphere);
      obj.add (this.attitudeIndicatorSphereAxisZ);

      if (this.throttle_slider) {
         obj.remove (this.throttle_slider_object);
         this.throttle_slider.add (this.throttle_slider_object);
         obj.add (this.throttle_slider);
      }

      this.flightInstruments = obj;
      this.object3d = obj;
      this.animate_time = null;
   }

   update (interval, position_y, pitch, heading, roll, throttle, speed) {
      if (speed < 40) {
         speed = 40;
      }

      this.airspeed_indicator_pointer.rotation.y = 1/2*Math.PI-((speed-30)/180*2*Math.PI);
      let altitude = position_y*1.68781;
      let altitude_pointer_rotation = -2*Math.PI*altitude;
      this.altimeter_pointer1.rotation.z = 0.001*altitude_pointer_rotation;
      this.altimeter_pointer2.rotation.z = 0.0001*altitude_pointer_rotation;
      this.altimeter_pointer3.rotation.z = 0.00001*altitude_pointer_rotation;

      this.compass_dial.rotation.z = -heading;

      let altitude_difference = (altitude-this.last_altitude)/(0.001*interval);
      let altitude_difference_feet_per_minute = 0.01*altitude_difference*60;
      if (altitude_difference_feet_per_minute > 20) {
         altitude_difference_feet_per_minute = 20;
      }
      else if (altitude_difference_feet_per_minute < -20) {
         altitude_difference_feet_per_minute = -20;
      }
      this.variometer_pointer.rotation.z = -altitude_difference_feet_per_minute/43*2*Math.PI;
      this.last_altitude = altitude;
      let throttle_slider_position = throttle*1.5;
      this.throttle_slider.position.y = this.throttle_slider.start_position_y+throttle_slider_position;
      this.throttle_slider.position.z = this.throttle_slider.start_position_z+throttle_slider_position*Math.sin (-this.flightInstruments.rotation.x);
      this.attitude_indicator_sphere.rotation.x = -pitch;
      this.attitudeIndicatorSphereAxisZ.rotation.z = roll;
   }
}

export default FlightInstruments;