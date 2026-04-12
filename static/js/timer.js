/* ============================================================
   timer.js — timer · sound
   ============================================================ */

let d_minutes = document.getElementsByClassName("minutes")[0];
let d_seconds = document.getElementsByClassName("seconds")[0];
let b_home = document.getElementById("return");

let audio = document.getElementById("MyAudio");

let minutes = parseInt(d_minutes.textContent);
let seconds = parseInt(d_seconds.textContent);

const endTime = Date.now() + (minutes * 60 + seconds) * 1000;

intervalId = setInterval(() => {
    const remaining = Math.round((endTime - Date.now()) / 1000);
    if (remaining <= 0) {
        clearInterval(intervalId);
        d_minutes.textContent = "00";
        d_seconds.textContent = "00";
        audio.play();
        b_home.disabled = false;
        return;
    }
    d_minutes.textContent = ('0' + Math.floor(remaining / 60)).slice(-2);
    d_seconds.textContent = ('0' + (remaining % 60)).slice(-2);
}, 1000);
