import SplineInterpolation from './spline_interpolation.js';

class Engine {

   constructor ({xAxisPowerValues = null, yAxisPowerValues = null,
                 gearRatios = [3.0, 2.0, 1.5, 1.0, 0.75, 0.61, -3.5], axleRatio = 7,
                 maxEngineBrakeTorque = 100, momentOfInertia = 1.0, engineFriction = 0.01, minRpm = 750.0, maxRpm = 7500.0} = {}) {
      this.rpm = 0.0;
      this.throttle = 0.0;
      this.clutch = 0.0;
      this._currentThrottle = 0.0;
      this.currentAxleTorque = 0.0;
      this.gear = 0;
      this.axleRatio = axleRatio;

      if ((xAxisPowerValues==null) !== (yAxisPowerValues==null)) {
         throw new Error('"xAxisPowerValues" and "yAxisPowerValues" need both to be supplied.');
      }

      if (xAxisPowerValues===null) {
         xAxisPowerValues = [0,  1000,  2000,  3500,   4500,   7500,    8750,  10000];
         yAxisPowerValues = [0, 15000, 40000, 80000, 110000, 147000, 125000,   75000];
      }

      this.powerValues = new SplineInterpolation (xAxisPowerValues, yAxisPowerValues);

      this.maxEngineBrakeTorque = maxEngineBrakeTorque;
      this.gearRatios = gearRatios;
      this.momentOfInertia = momentOfInertia;

      this.engineFriction = engineFriction;
      this.minRpm = minRpm;
      this.maxRpm = maxRpm;
      this.starting = false;
      this.started = false;
   }

   start () {
      this.rpm = 0.0;
      this.starting = true;
   }

   /*
    * shifts the gears automatically
    * only a simple solution, needs to be improved
    */
   shiftGears (axleRpm, accelerating, reverseGear) {
      if (this.rpm < 100) {
         this.starting = true;
      }
      if (this.starting) {
         this.clutch = 0;
         return;
      }
      let rpm = axleRpm*this.axleRatio;
      if (reverseGear) {
         rpm = -rpm;
         this.gear = this.gearRatios.length-1;
         if (3*rpm>750) {
            this.clutch = 1.0;
         }
         else if (this.rpm > 2750) {
            this.clutch = 0.975;
         }
         else if (this.rpm > 1750) {
            this.clutch = 0.95;
         }
         else {
            this.clutch = 0.0;
         }
         return;
      }
      if (rpm < 1250) {
         this.gear = 0;
         if (3*rpm>750) {
            this.clutch = 1.0;
         }
         else if (this.rpm > 2750) {
            this.clutch = 0.975;
         }
         else if (this.rpm > 1750) {
            this.clutch = 0.95;
         }
         else {
            this.clutch = 0.0;
         }
      }
      else if (rpm < 3000) {
         this.gear = 1;
         this.clutch = 1.0;
      }
      else if (rpm < 4000) {
         this.gear = 2;
      }
      else if (rpm < 5000) {
         this.gear = 3;
      }
      else if (rpm < 7250) {
         this.gear = 4;
      }
      else {
         this.gear = 5;
      }
      
   }

   update (dt, axleRpm, accelerating, reverseGear) {

      if (dt>0.25) {
         return;
      }

      this.shiftGears (axleRpm, accelerating, reverseGear);
      let throttle = this.throttle;

      if (!this.started || this.rpm < 100.0) {
         throttle = 0.0;
         if (this.rpm < 75.0 && !this.starting) {
            this.rpm = 0.0;
            this.currentPower = 0.0;
            return;
         }
      }
      else if (this.rpm<this.minRpm) {
         throttle = 0.35;
      }

      if (this.starting) {
         this.started = true;
         if (this.rpm<100.0) {
            this.rpm += 200.0*dt;
            throttle = 1.0;
         }
         else {
            this.starting = false;
         }
      }

      if (this.rpm > this.maxRpm) {
         throttle = 0.0;
      }

      let exponent = 0.5+1.5*(this.rpm-this.minRpm)/(this.maxRpm-this.minRpm);
      let powerPercentage = Math.pow (throttle, exponent);
      let omega = this.rpm/60.0*2*Math.PI;
      let torqueEngine = powerPercentage*(this.powerValues.evaluate(this.rpm)/omega+this.maxEngineBrakeTorque)-
                         this.maxEngineBrakeTorque;

      /*
       * L: angular momentum
       * I: moment of inertia
       * omega: angular velocity
       * P: power
       * M: torque
       * L = I*omega
       * L = M*dt
       * M = P/omega
       */
      let angularMomentum = omega*this.momentOfInertia;
      let torqueFriction = this.engineFriction;

   // clutch

      angularMomentum = angularMomentum+(torqueEngine-torqueFriction)*dt;

      let rpm = axleRpm*this.axleRatio*this.gearRatios[this.gear];
      this.rpm = angularMomentum/this.momentOfInertia*60.0/(2*Math.PI);
      if (this.clutch!==1.0) {
         this.rpm += (rpm-this.rpm)*this.clutch*dt;
      }
      else {
         this.rpm += rpm-this.rpm;
      }

      let torque = torqueEngine-torqueFriction;
      this.axleTorque = this.clutch*torque*this.axleRatio*this.gearRatios[this.gear];
   }
}

export default Engine;