/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

class UsernameRecordDialog {

   constructor () {
      let buttonOk = document.getElementById ("div_username_record_dialog_ok");
      buttonOk.addEventListener("click", ()=>this.onOkClick());
      let buttonCancel = document.getElementById ("div_username_record_dialog_cancel");
      buttonCancel.addEventListener("click", ()=>this.onCancelClick());

      this.inputUsernameRecord = document.getElementById ("input_username_record");
      this.onOkClickCallback = null;
   }

   onOkClick () {
      if (this.onOkClickCallback) {
         if (this.onOkClickCallback(this.getUsername())) {
            this.close();
         }
         return;
      }
      this.close();
   }

   onCancelClick () {
      this.close();
   }

   getUsername () {
      return this.inputUsernameRecord.value;
   }

   show () {
      var messageDialog = document.getElementById("div_username_record_dialog_with_background");
      messageDialog.style.display = "block";
   }

   close () {
      var messageDialog = document.getElementById("div_username_record_dialog_with_background");
      messageDialog.style.display = "none";
      let canvas = document.getElementById ("canvas_plane");
      canvas.focus();
   }
}