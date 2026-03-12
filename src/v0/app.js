const qubitCount = 3;
const columnCount = 6;
const grid = Array.from({ length: qubitCount }, () => Array(columnCount).fill(null));

const c = (re, im = 0) => ({ re, im });
const cAdd = (a, b) => c(a.re + b.re, a.im + b.im);
const cMul = (a, b) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);

const gates = {
I: {
label: 'I',
description: 'Identity gate',
matrix: [
[c(1), c(0)],
[c(0), c(1)]
]
},
H: {
label: 'H',
description: 'Hadamard gate',
matrix: [
[c(Math.SQRT1_2), c(Math.SQRT1_2)],
[c(Math.SQRT1_2), c(-Math.SQRT1_2)]
]
},
X: {
label: 'X',
description: 'Pauli-X gate',
matrix: [
[c(0), c(1)],
[c(1), c(0)]
]
},
Y: {
label: 'Y',
description: 'Pauli-Y gate',
matrix: [
[c(0), c(0, -1)],
[c(0, 1), c(0)]
]
},
Z: {
label: 'Z',
description: 'Pauli-Z gate',
matrix: [
[c(1), c(0)],
[c(0), c(-1)]
]
},
S: {
label: 'S',
description: 'Phase S gate',
matrix: [
[c(1), c(0)],
[c(0), c(0, 1)]
]
},
T: {
label: 'T',
description: 'Phase T (π/4) gate',
matrix: [
[c(1), c(0)],
[c(0), c(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4))]
]
},
M: {
label: 'M',
description: 'Measurement marker (no unitary effect)',
matrix: null,
measurement: true
}
};

const paletteButtons = document.querySelectorAll('.palette button');
const slots = document.querySelectorAll('.slot');
const probabilityRows = document.querySelectorAll('.prob-row');
const leds = document.querySelectorAll('.qubit-led');
const measureValues = document.querySelectorAll('.measure-value');
const runBtn = document.getElementById('runBtn');
const clearBtn = document.getElementById('clearBtn');

let selectedGate = null;

paletteButtons.forEach((btn) => {
btn.addEventListener('click', () => toggleSelectedGate(btn.dataset.gate));
btn.addEventListener('dragstart', (event) => {
event.dataTransfer.setData('gate', btn.dataset.gate);
event.dataTransfer.effectAllowed = 'copy';
});
});

slots.forEach((slot) => {
slot.addEventListener('click', () => {
if (!selectedGate) return;
assignGate(slot.dataset.row, slot.dataset.col, selectedGate);
});

slot.addEventListener('dblclick', () => {
clearSlot(slot.dataset.row, slot.dataset.col);
});

slot.addEventListener('dragover', (event) => {
event.preventDefault();
event.dataTransfer.dropEffect = 'copy';
});

slot.addEventListener('dragenter', (event) => {
event.preventDefault();
slot.classList.add('drop-ready');
});

slot.addEventListener('dragleave', () => {
slot.classList.remove('drop-ready');
});

slot.addEventListener('drop', (event) => {
event.preventDefault();
slot.classList.remove('drop-ready');
const gateId = event.dataTransfer.getData('gate');
assignGate(slot.dataset.row, slot.dataset.col, gateId);
});
});

runBtn.addEventListener('click', runCircuit);
clearBtn.addEventListener('click', () => {
grid.forEach((row) => row.fill(null));
renderGrid();
runCircuit();
});

function toggleSelectedGate(gateId) {
selectedGate = selectedGate === gateId ? null : gateId;
paletteButtons.forEach((btn) => {
btn.classList.toggle('active', btn.dataset.gate === selectedGate);
});
}

function assignGate(row, col, gateId) {
if (!gateId) return;
grid[Number(row)][Number(col)] = gateId;
renderGrid();
runCircuit();
}

function clearSlot(row, col) {
grid[Number(row)][Number(col)] = null;
renderGrid();
runCircuit();
}

function renderGrid() {
slots.forEach((slot) => {
const row = Number(slot.dataset.row);
const col = Number(slot.dataset.col);
const gateId = grid[row][col];
const gateInfo = gateId ? gates[gateId] : null;

slot.textContent = gateInfo ? gateInfo.label : '';
slot.title = gateInfo ? gateInfo.description : 'Empty slot';
slot.classList.toggle('filled', Boolean(gateId));
slot.classList.toggle('measure', gateId === 'M');
});
}

function runCircuit() {
const { state, measurements } = simulateCircuit();
updateProbabilityList(state);
updateQubitIndicators(state, measurements);
}

function simulateCircuit() {
let state = Array.from({ length: 2 ** qubitCount }, (_, idx) => (idx === 0 ? c(1, 0) : c(0, 0)));
const measurements = Array(qubitCount).fill(null);

for (let col = 0; col < columnCount; col++) {
const { matrix, measuredQubits, controlledPairs } = buildColumnOperation(col);
state = multiplyMatrixVector(matrix, state);
controlledPairs.forEach(({ controlRow, targetRow }) => {
state = applyControlledX(state, controlRow, targetRow);
});
measuredQubits.forEach((qubit) => {
const { state: collapsed, outcome } = measureQubit(state, qubit);
state = collapsed;
measurements[qubit] = outcome;
});
}

return { state, measurements };
}

function buildColumnOperation(col) {
const matrices = [];
const measuredQubits = [];
const identityRows = [];
const xRows = [];
const gateIds = [];

for (let row = 0; row < qubitCount; row++) {
const gateId = grid[row][col];
gateIds[row] = gateId;
if (gateId === 'I') identityRows.push(row);
if (gateId === 'X') xRows.push(row);
}

const controlledPairs = pairControls(identityRows, xRows);

for (let row = 0; row < qubitCount; row++) {
const gateId = gateIds[row];
const gate = gateId ? gates[gateId] : null;
const isControlledTarget = controlledPairs.some((pair) => pair.targetRow === row);

if (gate && gate.measurement) {
matrices.push(gates.I.matrix);
measuredQubits.push(row);
} else if (isControlledTarget) {
matrices.push(gates.I.matrix);
} else {
matrices.push(gate && gate.matrix ? gate.matrix : gates.I.matrix);
}
}

return {
matrix: matrices.reduce((acc, mat) => tensorProduct(acc, mat)),
measuredQubits,
controlledPairs
};
}

function pairControls(identityRows, targetRows) {
if (!identityRows.length || !targetRows.length) return [];

const availableControls = [...identityRows];
const pairs = [];

targetRows.forEach((targetRow) => {
if (!availableControls.length) return;
let bestIdx = 0;
let bestDistance = Math.abs(targetRow - availableControls[0]);

for (let i = 1; i < availableControls.length; i++) {
const distance = Math.abs(targetRow - availableControls[i]);
if (distance < bestDistance) {
bestIdx = i;
bestDistance = distance;
}
}

const [controlRow] = availableControls.splice(bestIdx, 1);
pairs.push({ controlRow, targetRow });
});

return pairs;
}

function measureQubit(state, qubit) {
const bitMask = qubitCount - 1 - qubit;
let probZero = 0;
let probOne = 0;

for (let basis = 0; basis < state.length; basis++) {
const amp = state[basis];
const prob = probability(amp);
const bit = (basis >> bitMask) & 1;
if (bit === 0) probZero += prob;
else probOne += prob;
}

const totalProb = probZero + probOne;
if (totalProb === 0) {
return { state, outcome: 0 };
}

let outcome;
if (probZero === 0) {
outcome = 1;
} else if (probOne === 0) {
outcome = 0;
} else {
const rand = Math.random();
outcome = rand < probOne / totalProb ? 1 : 0;
}

const targetProb = outcome === 1 ? probOne : probZero;
const normalization = targetProb > 0 ? 1 / Math.sqrt(targetProb) : 0;

const collapsed = state.map((amp, basis) => {
const bit = (basis >> bitMask) & 1;
if (bit !== outcome || normalization === 0) {
return c(0, 0);
}
return c(amp.re * normalization, amp.im * normalization);
});

return { state: collapsed, outcome };
}

function applyControlledX(state, controlRow, targetRow) {
const controlShift = qubitCount - 1 - controlRow;
const targetShift = qubitCount - 1 - targetRow;
const targetMask = 1 << targetShift;
const result = Array.from({ length: state.length }, () => c(0, 0));

for (let basis = 0; basis < state.length; basis++) {
const amp = state[basis];
if (((basis >> controlShift) & 1) === 1) {
const flipped = basis ^ targetMask;
result[flipped] = cAdd(result[flipped], amp);
} else {
result[basis] = cAdd(result[basis], amp);
}
}

return result;
}

function tensorProduct(a, b) {
const rows = a.length;
const cols = a[0].length;
const rowsB = b.length;
const colsB = b[0].length;
const result = Array.from({ length: rows * rowsB }, () => Array(cols * colsB));

for (let i = 0; i < rows; i++) {
for (let j = 0; j < cols; j++) {
for (let k = 0; k < rowsB; k++) {
for (let l = 0; l < colsB; l++) {
result[i * rowsB + k][j * colsB + l] = cMul(a[i][j], b[k][l]);
}
}
}
}

return result;
}

function multiplyMatrixVector(matrix, vector) {
return matrix.map((row) =>
row.reduce((sum, entry, idx) => cAdd(sum, cMul(entry, vector[idx])), c(0, 0))
);
}

function probability(amp) {
return amp.re * amp.re + amp.im * amp.im;
}

function updateProbabilityList(state) {
probabilityRows.forEach((row) => {
const index = Number(row.dataset.index);
const amp = state[index];
const prob = probability(amp);
const bits = index.toString(2).padStart(qubitCount, '0');

row.querySelector('.state-tag').textContent = bits;
row.querySelector('.bar').style.width = `${(prob * 100).toFixed(1)}%`;
row.querySelector('.value').textContent = prob.toFixed(3);
});
}

function updateQubitIndicators(state, measurements = []) {
for (let qubit = 0; qubit < qubitCount; qubit++) {
let probOne = 0;
let expectation = 0;

for (let basis = 0; basis < state.length; basis++) {
  const amp = state[basis];
  const prob = probability(amp);
  const bit = (basis >> (qubitCount - 1 - qubit)) & 1;
  if (bit === 1) probOne += prob;
  expectation += bit === 0 ? prob : -prob;
}

const led = leds[qubit];
if (led) {
  const intensity = probOne;
  led.style.background = `rgba(183, 255, 90, ${0.2 + 0.7 * intensity})`;
  led.style.boxShadow = `0 0 ${6 + intensity * 20}px rgba(183, 255, 90, ${0.35 + 0.5 * intensity})`;
  led.title = `P(|1⟩)=${probOne.toFixed(2)}`;
}

const measurement = measureValues[qubit];
if (measurement) {
  const measuredValue = measurements[qubit];
  if (measuredValue === null || measuredValue === undefined) {
    measurement.textContent = expectation.toFixed(2);
  } else {
    measurement.textContent = Number(measuredValue).toFixed(2);
  }
}
}
}

function positionPalette() {
const table = document.querySelector('.quantum-table');
if (!table) return;

const radius = table.clientWidth / 2 - 60;

paletteButtons.forEach((btn, index) => {
const angle = (index / paletteButtons.length) * Math.PI * 2 - Math.PI / 2;
const size = btn.offsetWidth || 60;
const half = size / 2;
const x = Math.cos(angle) * radius;
const y = Math.sin(angle) * radius;

btn.style.left = `calc(50% + ${x.toFixed(2)}px - ${half.toFixed(2)}px)`;
btn.style.top = `calc(50% + ${y.toFixed(2)}px - ${half.toFixed(2)}px)`;
});
}

renderGrid();
runCircuit();
window.addEventListener('resize', positionPalette);
requestAnimationFrame(positionPalette);