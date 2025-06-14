// canvasSetup.js - Canvas setup and configuration
export const canvas = document.getElementById("canvas");
export const ctx = canvas.getContext("2d");

export function setupCanvas() {
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        console.log(`Canvas resized to ${canvas.width}x${canvas.height}`);
    }

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
}