/*
 * Copyright (c) 2021 Antonio-R1
 * License: https://github.com/Antonio-R1/racing-js/LICENSE | GNU AGPLv3
 */

import {Menu} from './menu.js';

export function showPauseDialog () {
   dialogShown = true;
   var pauseDialog = document.getElementById("div_pause_dialog_with_background");
   pauseDialog.style.display = "block";
}

export function pauseDialogResume () {
   dialogShown = false;
   var pauseDialog = document.getElementById("div_pause_dialog_with_background");
   pauseDialog.style.display = "none";
   let canvas = document.getElementById ("canvas_plane");
   canvas.focus();
}

export function pauseDialogMainMenu () {
   dialogShown = false;
   var pauseDialog = document.getElementById("div_pause_dialog_with_background");
   pauseDialog.style.display = "none";
   let canvas = document.getElementById ("canvas_plane");
   canvas.focus();
   setCurrentScene(new Menu ());
   current_scene.show ();
}

window.showPauseDialog = showPauseDialog;
window.pauseDialogResume = pauseDialogResume;
window.pauseDialogMainMenu = pauseDialogMainMenu;