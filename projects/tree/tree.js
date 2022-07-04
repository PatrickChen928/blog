const WIDTH = 400;
const HEIGHT = 400;

const rad15 = Math.PI / 12;
const rad90 = Math.PI / 2;

const { random } = Math;

let steps = [];
let pregStep = [];
let i = 0;

const len = 5;
const init = 5;

const ctx = initCanvas();

function initCanvas() {
  const canvas = document.getElementById('myCanvas');
  canvas.style.width = WIDTH;
  canvas.style.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1
  const bsr = ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio || ctx.msBackingStorePixelRatio || ctx.oBackingStorePixelRatio || ctx.backingStorePixelRatio || 1

  const dpi = dpr / bsr

  canvas.style.width = `${WIDTH}px`
  canvas.style.height = `${HEIGHT}px`
  canvas.width = dpi * WIDTH
  canvas.height = dpi * HEIGHT
  ctx.scale(dpi, dpi)
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  return ctx;
}

function draw(x, y, nx, ny) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(nx, ny);
  ctx.stroke();
}

function getEndPosition(x, y, len, deg) {
  const nx = x + Math.cos(deg) * len;
  const ny = y + Math.sin(deg) * len;
  return { nx, ny };
}

function start() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  random() < 0.5
    ? steps = [() => step(400 * random() , 0, rad90), () => step(400 * random(), 400, -rad90)]
    :  steps = [() => step(0 , 400 * random(), 0), () => step(400, 400 * random(), Math.PI)];
  // steps = [() => step(0 , 400 * random(), 0), () => step(400, 400 * random(), Math.PI)]
    requestAnimationFrame(frame);
}

function step(x, y, deg) {
  let { nx, ny } = getEndPosition(x, y, len * random(), deg);
  draw(x, y, nx, ny);
  if (nx > 400 || nx < 0 || ny > 400 || ny < 0) {
    return ;
  }
  // if (nx < -100 || nx > 500 || ny < -100 || ny > 500)
  //     return
  let rad1 = deg + random() * rad15
  let rad2 = deg - random() * rad15
  if (i < init || random() < 0.5) {
    steps.push(() => step(nx, ny, rad1));
  }
  if (i < init || random() < 0.5) {
    steps.push(() => step(nx, ny, rad2));
  }
}

function frame() {
  if (!steps.length) {
    return ;
  }
  i++;
  pregStep = steps;
  steps = [];
  pregStep.forEach(s => {
    s();
  });
  requestAnimationFrame(frame);
  // if (i < 200) {
  //   requestAnimationFrame(frame);
  // }
}


start();