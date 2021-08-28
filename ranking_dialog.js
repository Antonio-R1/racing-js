/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

class RankingDialog {

   constructor () {
      let inputCurrentRanking = document.getElementById ("input_ranking_dialog_tabs_current");
      let inputCurrentCheckpoints = document.getElementById ("input_ranking_dialog_tabs_current_checkpoints");
      let inputCheckpoints = document.getElementById ("input_ranking_dialog_tabs_checkpoints");
      let inputRankingToday = document.getElementById ("input_ranking_dialog_tabs_today");
      let inputRankingAll = document.getElementById ("input_ranking_dialog_tabs_all");

      let onChangeCallback = (event) => this.showTab(event.currentTarget.value);
      inputCheckpoints.addEventListener("change", onChangeCallback);
      inputCurrentCheckpoints.addEventListener("change", onChangeCallback);
      inputCurrentRanking.addEventListener("change", onChangeCallback);
      inputRankingToday.addEventListener("change", onChangeCallback);
      inputRankingAll.addEventListener("change", onChangeCallback);

      this.isShown = false;
   }

   show(showCheckpoints=false, showCurrentRanking=false) {
      let inputCurrentRanking = document.getElementById ("input_ranking_dialog_tabs_current");
      let inputCurrentCheckpoints = document.getElementById ("input_ranking_dialog_tabs_current_checkpoints");
      let inputCheckpoints = document.getElementById ("input_ranking_dialog_tabs_checkpoints");
      let inputRankingToday = document.getElementById ("input_ranking_dialog_tabs_today");
      let inputRankingAll = document.getElementById ("input_ranking_dialog_tabs_all");

      let labelCurrentRanking = document.getElementById ("label_ranking_dialog_tabs_current");
      let labelCheckpoints = document.getElementById ("label_ranking_dialog_tabs_checkpoints");
      let labelCurrentCheckpoints = document.getElementById ("label_ranking_dialog_tabs_current_checkpoints");

      if (showCheckpoints) {
         labelCheckpoints.style.display = "inline-block";
         labelCurrentCheckpoints.style.display = "inline-block";
      }
      else {
         labelCheckpoints.style.display = "none";
         labelCurrentCheckpoints.style.display = "none";
      }
      if (showCurrentRanking) {
         labelCurrentRanking.style.display = "inline-block";
         inputCurrentRanking.checked = true;
      }
      else {
         labelCurrentRanking.style.display = "none";
         inputRankingAll.checked = true;
         this.showTab("ranking_all");
      }
      let rankingDialog = document.getElementById("div_ranking_dialog");
      rankingDialog.style.display = "block";

      let tableCurrentRanking = document.getElementById("table_current_ranking");
      let tableCheckpointsRanking = document.getElementById("table_checkpoints_ranking");
      let tableRankingToday = document.getElementById("table_ranking_today");
      let tableRankingAll = document.getElementById("table_ranking_all");
      this.isShown = true;
   }

   close() {
      let rankingDialog = document.getElementById("div_ranking_dialog");
      rankingDialog.style.display = "none";
      this.isShown = false;
   }

   _getRankingSuperscript (ranking) {
      switch (ranking%10) {
         case 1:
            return "st";
         case 2:
            return "nd";
         case 3:
            return "rd";
         default:
            return "th";
           
      }
   }

   _getFormattedTime (timeHundredthsOfASecond) {
      let seconds = Math.floor(timeHundredthsOfASecond/100);

      let hours = Math.floor (seconds/3600);
      hours = hours.toString();
      if (hours.length===1) {
         hours = "0"+hours;
      }

      let minutes = Math.floor (seconds/60)%60;
      minutes = minutes.toString();
      if (minutes.length===1) {
         minutes = "0"+minutes;
      }

      seconds = seconds%60;
      seconds = seconds.toString();
      if (seconds.length===1) {
         seconds = "0"+seconds;
      }

      let frac = timeHundredthsOfASecond%100;
      frac = frac.toString();
      let padding = 2-frac.length
      for (let i=0; i<padding; i++) {
         frac = "0"+frac;
      }

      return hours+":"+minutes+":"+seconds+"."+frac;
   }

   _updateRankingTable(table, rankingArray, score) {
      table.innerHTML = "";
      for (let i=0; i<rankingArray.length; i++) {
         let ranking = rankingArray[i];
         var row = table.insertRow(-1);
         var cell = row.insertCell(-1);
         cell.innerHTML = (i+1)+"<sup>"+this._getRankingSuperscript(i+1)+"</sup>";

         cell = row.insertCell(-1);
         let textUsername = document.createTextNode (ranking.username);
         cell.appendChild (textUsername);

         cell = row.insertCell(-1);
         if (!score) {
            let textTime = document.createTextNode (this._getFormattedTime (ranking.time));
            cell.appendChild (textTime);
         }
         else {
            let textScore = document.createTextNode (ranking.score);
            cell.appendChild (textScore);
         }
      }
   }

   updateCurrentRankingTable (currentRankingArray) {
      let tableCurrentRanking = document.getElementById("table_current_ranking");
      this._updateRankingTable(tableCurrentRanking, currentRankingArray);
   }

   updateTableRankingToday (rankingArray, score=false) {
      let table = document.getElementById("table_ranking_today");
      this._updateRankingTable(table, rankingArray, score);
   }

   updateTableRankingAll (rankingArray, score=false) {
      let table = document.getElementById("table_ranking_all");
      this._updateRankingTable(table, rankingArray, score);
   }

   updateCheckpointsTimingTable (checkpointTimeArray) {
      let tableCheckpointsRanking = document.getElementById("table_checkpoints_timing");
      tableCheckpointsRanking.innerHTML = "";
      for (let i=0; i<checkpointTimeArray.length; i++) {
         let checkpointTime = checkpointTimeArray[i];
         var row = tableCheckpointsRanking.insertRow(-1);
         var cell = row.insertCell(-1);
         cell.innerHTML = i+1;

         cell = row.insertCell(-1);
         let textTime = document.createTextNode (this._getFormattedTime (checkpointTime));
         cell.appendChild (textTime);
      }
   }

   updateCheckpointsRankingTable (currentRankingArray) {
      let tableCheckpointsRanking = document.getElementById("table_checkpoints_ranking");
      tableCheckpointsRanking.innerHTML = "";
      for (let i=0; i<currentRankingArray.length; i++) {
         let currentRanking = currentRankingArray[i];
         var row = tableCheckpointsRanking.insertRow(-1);
         var cell = row.insertCell(-1);
         cell.innerHTML = i+1;

         cell = row.insertCell(-1);
         let textUsername = document.createTextNode (currentRanking.username);
         cell.appendChild (textUsername);

         cell = row.insertCell(-1);
         let textTime = document.createTextNode (this._getFormattedTime (currentRanking.time));
         cell.appendChild (textTime);
      }
   }

   showTab(tab) {
      let tableCurrentRanking = document.getElementById("table_current_ranking");
      let tableCheckpointsRanking = document.getElementById("table_checkpoints_ranking");
      let tableCheckpointsTiming = document.getElementById("table_checkpoints_timing");
      let tableRankingToday = document.getElementById("table_ranking_today");
      let tableRankingAll = document.getElementById("table_ranking_all");

      tableCurrentRanking.style.display = "none";
      tableCheckpointsRanking.style.display = "none";
      tableCheckpointsTiming.style.display = "none";
      tableRankingToday.style.display = "none";
      tableRankingAll.style.display = "none";

      switch (tab) {
         case "current_ranking":
            tableCurrentRanking.style.display = "table";
            break;
         case "checkpoints_timing":
            tableCheckpointsTiming.style.display = "table";
            break;
         case "checkpoints_ranking":
            tableCheckpointsRanking.style.display = "table";
            break;
         case "ranking_today":
            tableRankingToday.style.display = "table";
            break;
         case "ranking_all":
            tableRankingAll.style.display = "table";
            break;
      }
   }
}