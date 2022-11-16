/*
 * Copyright (c) 2021-2022 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/blob/main/LICENSE | GNU AGPLv3
 */

function messageDialogButtonLeftOnclick () {
   throw new Error ("not implemented");
}

function messageDialogButtonRightOnclick () {
   throw new Error ("not implemented");
}

function showMessageDialog () {
   var messageDialog = document.getElementById("div_message_dialog_with_background");
   messageDialog.style.display = "block";
}

function closeMessageDialog () {
   var messageDialog = document.getElementById("div_message_dialog_with_background");
   messageDialog.style.display = "none";
   let canvas = document.getElementById ("canvas_plane");
   canvas.focus();
}

function setMessageDialogText (title, text) {
   var messageDialogTitle = document.getElementById("div_message_dialog_title");
   var messageDialogContent = document.getElementById("div_message_dialog_content");

   messageDialogTitle.innerHTML = title;
   messageDialogContent.innerHTML = text;
}

function setMessageDialogButtonLeftText (text) {
   var messageDialogButtonLeft = document.getElementById("button_message_dialog_left");
   if (!text) {
      messageDialogButtonLeft.style.display = "none";
      return;
   }
   messageDialogButtonLeft.style.display = "inline-block";
   messageDialogButtonLeft.innerHTML = text;
}

function setMessageDialogButtonLeftOnclick (value) {
   messageDialogButtonLeftOnclick = value;
}

function setMessageDialogButtonRightText (text) {
   var messageDialogButtonRight= document.getElementById("button_message_dialog_right");
   if (!text) {
      messageDialogButtonRight.style.display = "none";
      return;
   }
   messageDialogButtonRight.style.display = "inline-block";
   messageDialogButtonRight.innerHTML = text;
}

function setMessageDialogButtonRightOnclick (value) {
   messageDialogButtonRightOnclick = value;
}