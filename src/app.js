const qubitCount = 3;
const columnCount = 6;
const grid = Array.from({ length: qubitCount }, () => Array(columnCount).fill(null));

const c = (re, im = 0) => ({ re, im });
const cAdd = (a, b) => c(a.re + b.re, a.im + b.im);
const cMul = (a, b) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);

const gates = {
C: {
label: '◎',
description: 'Control gate',
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

const enabledGates = new Set(Object.keys(gates).filter((id) => id !== 'M'));

const paletteButtons = document.querySelectorAll('.palette button');
const slots = document.querySelectorAll('.slot');
const probabilityRows = document.querySelectorAll('.prob-row');
const leds = document.querySelectorAll('.qubit-led');
const measureValues = document.querySelectorAll('.measure-value');
const runBtn = document.getElementById('runBtn');
const generateBtn = document.getElementById('generateBtn');
const simplifyBtn = document.getElementById('simplifyBtn');
const clearBtn = document.getElementById('clearBtn');
const simplifyStatus = document.getElementById('simplifyStatus');
const luckyBtn = document.getElementById('luckBtn');

let isReady = false;
let targetProbabilities = null;
let previousGrid = null;

paletteButtons.forEach((btn) => {
btn.classList.toggle('active', enabledGates.has(btn.dataset.gate));
btn.addEventListener('click', () => {
if (!isReady) return;
toggleGateEnabled(btn.dataset.gate);
});
btn.addEventListener('dragstart', (event) => {
if (!isReady) {
  event.preventDefault();
  return;
}
event.dataTransfer.setData('gate', btn.dataset.gate);
event.dataTransfer.effectAllowed = 'copy';
});
});

slots.forEach((slot) => {
slot.addEventListener('click', () => {
if (!isReady) return;
clearSlot(slot.dataset.row, slot.dataset.col);
});

slot.addEventListener('dblclick', () => {
if (!isReady) return;
clearSlot(slot.dataset.row, slot.dataset.col);
});

slot.addEventListener('dragover', (event) => {
if (!isReady) return;
event.preventDefault();
event.dataTransfer.dropEffect = 'copy';
});

slot.addEventListener('dragenter', (event) => {
if (!isReady) return;
event.preventDefault();
slot.classList.add('drop-ready');
});

slot.addEventListener('dragleave', () => {
slot.classList.remove('drop-ready');
});

slot.addEventListener('drop', (event) => {
if (!isReady) return;
event.preventDefault();
slot.classList.remove('drop-ready');
const gateId = event.dataTransfer.getData('gate');
assignGate(slot.dataset.row, slot.dataset.col, gateId);
});
});

runBtn.addEventListener('click', () => {
if (!isReady) return;
runCircuit();
});
if (generateBtn) {
generateBtn.addEventListener('click', () => {
  if (!isReady) return;
  requestGeneratedCircuit();
});
}
if (simplifyBtn) {
simplifyBtn.addEventListener('click', () => {
  if (!isReady) return;
  requestSimplifiedCircuit();
});
}
clearBtn.addEventListener('click', () => {
if (!isReady) return;
clearAll();
});
luckyBtn.addEventListener('click', () => {
if (!isReady) return;
  requestLuckyCircuit();
});

function toggleGateEnabled(gateId) {
if (enabledGates.has(gateId)) {
enabledGates.delete(gateId);
} else {
enabledGates.add(gateId);
}
paletteButtons.forEach((btn) => {
if (btn.dataset.gate === gateId) {
btn.classList.toggle('active', enabledGates.has(gateId));
}
});
}

function assignGate(row, col, gateId) {
if (!gateId) return;
previousGrid = null;
targetProbabilities = null;
grid[Number(row)][Number(col)] = gateId;
renderGrid();
runCircuit();
}

function clearSlot(row, col) {
previousGrid = null;
grid[Number(row)][Number(col)] = null;
renderGrid();
runCircuit();
}

function renderGrid() {
  slots.forEach((slot) => {
    const row = Number(slot.dataset.row);
    const col = Number(slot.dataset.col);

    const gateId = grid[row][col] ?? null; // current
    const oldGateId = previousGrid ? (previousGrid[row][col] ?? null) : null; // old

    const gateInfo = gateId ? gates[gateId] : null;
    const oldGateInfo = oldGateId ? gates[oldGateId] : null;

    const oldHadValue = Boolean(oldGateId);
    const nowHasValue = Boolean(gateId);

    const isOldOnly = oldHadValue && !nowHasValue;                 // now empty -> blue-only
    const isDual = oldHadValue && nowHasValue;                     // both exist -> show both
    const isFromOld = isDual && gateId === oldGateId;              // same marker

    // Classes
    slot.classList.toggle('filled', nowHasValue);                  // keeps default green look for new ones
    slot.classList.toggle('measure', gateId === 'M' || (!gateId && oldGateId === 'M'));
    slot.classList.toggle('old-only', isOldOnly);
    slot.classList.toggle('from-old', isFromOld);

    // IMPORTANT: dual only when both exist
    slot.classList.toggle('dual', isDual);

    // Content + title
    if (isOldOnly) {
      // show ONLY old (blue-only look)
      slot.textContent = oldGateInfo ? oldGateInfo.label : (oldGateId ?? '');
      slot.title = oldGateInfo ? oldGateInfo.description : 'Old slot';
      return;
    }

    if (isDual) {
      // show BOTH (old top-left, new bottom-right)
      const oldText = oldGateInfo?.label ?? oldGateId ?? '';
      const newText = gateInfo?.label ?? gateId ?? '';

      slot.innerHTML = `
        <span class="code old">${oldText}</span>
        <span class="code new">${newText}</span>
      `;

      const oldTitle = oldGateInfo
        ? `Old: ${oldGateInfo.label} — ${oldGateInfo.description}`
        : `Old: ${oldGateId}`;

      const newTitle = gateInfo
        ? `New: ${gateInfo.label} — ${gateInfo.description}`
        : `New: ${gateId}`;

      slot.title = `${oldTitle}\n${newTitle}`;
      return;
    }

    // old empty here:
    // - if now has value: completely new -> default green look (single label)
    // - if now empty: truly empty
    if (nowHasValue) {
      slot.textContent = gateInfo ? gateInfo.label : '';
      slot.title = gateInfo ? gateInfo.description : 'Slot';
    } else {
      slot.textContent = '';
      slot.title = 'Empty slot';
    }
  });
}

function clampProbability(value) {
if (Number.isNaN(value)) return null;
return Math.min(1, Math.max(0, value));
}

function updateProbabilityBar(row, value) {
const bar = row.querySelector('.bar');
if (!bar) return;
const clamped = clampProbability(value);
const width = clamped === null ? 0 : clamped * 100;
bar.style.width = `${width.toFixed(1)}%`;
}

function sanitizeProbabilityInput(input) {
const raw = parseFloat(input.value);
const clamped = clampProbability(raw);
if (clamped === null) {
  input.value = '';
  return null;
}
input.value = clamped.toFixed(3);
return clamped;
}

function attachProbabilityInputHandlers() {
probabilityRows.forEach((row) => {
const input = row.querySelector('.value');
if (!input) return;

function commitValue() {
  const clamped = sanitizeProbabilityInput(input);
  updateProbabilityBar(row, clamped);
  targetProbabilities = null;
  if (isReady) {
    clearAll();
  }
}

input.addEventListener('input', () => {
  const raw = parseFloat(input.value);
  const clamped = clampProbability(raw);
  updateProbabilityBar(row, clamped);
});

input.addEventListener('blur', commitValue);

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    input.blur();
  }
});
});
}

async function requestGeneratedCircuit() {
setInteractionEnabled(false);
setGenerateLoading(true);

previousGrid = null;
targetProbabilities = {};
probabilityRows.forEach((row) => {
const index = Number(row.dataset.index);
const input = row.querySelector('.value');
targetProbabilities[index] = input ? (clampProbability(parseFloat(input.value)) ?? 0) : 0;
});

if (simplifyStatus) simplifyStatus.textContent = '';

try {
const payload = buildProbabilityPayload();
const response = await fetch('/api/generate-circuit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  let message = `Generate failed: ${response.status}`;
  try {
    const errData = await response.json();
    if (errData && errData.detail) message = errData.detail;
  } catch (_) {}
  if (simplifyStatus) {
    simplifyStatus.innerHTML = `<span>${message}</span><span>Please try again!</span>`;
  }
  throw new Error(message);
}

const data = await response.json();
if (!data || !applyGridData(data.grid)) {
  throw new Error('Invalid circuit payload');
}

renderGrid();
runCircuit();
} catch (error) {
console.error('Failed to generate circuit.', error);
} finally {
setGenerateLoading(false);
setInteractionEnabled(true);
}
}

async function requestLuckyCircuit() {
  setInteractionEnabled(false);
  setGettingLuckyLoading(true);
  clearAll();

  if (simplifyStatus) simplifyStatus.textContent = '';
  try {
    const payload = buildLuckyPayload();
    const response = await fetch('/api/lucky-circuit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if(!response.ok) {
      let message = `We are not lucky: ${response.status}`;
      try {
        const errData = await response.json();
        if (errData && errData.detail) message = errData.detail;
      } catch (_) {}

      if(simplifyStatus) {
        simplifyStatus.innerHTML = `<span style="color:#ff6b6b">${message}</span><span style="color:#ff6b6b">Please try again!</span>`;
      }
      throw new Error(message);
    }

    const data = await response.json();
    if (!data || !applyGridData(data.grid)) {
      throw new Error('Invalid circuit payload');
    } 
    if(data.description && simplifyStatus) {
      simplifyStatus.innerHTML = `<span>Lucky Circuit:</span><span style="color: white">${data.description}</span>`;
    }

    renderGrid();
    runCircuit();
    
  } catch (error) {    
    console.error('Failed to get lucky circuit.', error);
  } finally {
    setGettingLuckyLoading(false);
    setInteractionEnabled(true);
  }
}

async function requestSimplifiedCircuit() {
if (isGridClear()) return;
targetProbabilities = {};
previousGrid = grid.map((row) => [...row]);
probabilityRows.forEach((row) => {
  const index = Number(row.dataset.index);
  const input = row.querySelector('.value');
  targetProbabilities[index] = input ? (clampProbability(parseFloat(input.value)) ?? 0) : 0;
});
setInteractionEnabled(false);
setSimplifyLoading(true);
if (simplifyStatus) simplifyStatus.textContent = '';

try {
const payload = buildSimplifyPayload();
const response = await fetch('/api/simplify-circuit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  let message = `Simplify failed: ${response.status}`;
  try {
    const errData = await response.json();
    if (errData && errData.detail) message = errData.detail;
  } catch (_) {}
  if (simplifyStatus) {
    simplifyStatus.innerHTML = `<span>${message}</span><span>Please try again!</span>`;
  }
  throw new Error(message);
}

const data = await response.json();
if (!data || !applyGridData(data.grid)) {
  throw new Error('Invalid circuit payload');
}

renderGrid();
runCircuit();
} catch (error) {
console.error('Failed to simplify circuit.', error);
previousGrid = null;
renderGrid();
} finally {
setSimplifyLoading(false);
setInteractionEnabled(true);
}
}

function buildSimplifyPayload() {
const base = buildProbabilityPayload();
return {
...base,
grid: grid.map((row) => [...row])
};
}

function buildProbabilityPayload() {
const states = {};

probabilityRows.forEach((row) => {
const state = row.querySelector('.state-tag')?.textContent?.trim() ?? '';
const input = row.querySelector('.value');
const value = input ? clampProbability(parseFloat(input.value)) : null;
if (state) {
  states[state] = value ?? 0;
}
});

const availableGates = Object.entries(gates)
.filter(([id]) => enabledGates.has(id))
.map(([id, gate]) => ({
id,
label: gate.label,
description: gate.description
}));

return {
states,
availableGates,
gridLayout: {
qubits: qubitCount,
columns: columnCount
}
};
}

function buildLuckyPayload() {
  const availableGates = Object.entries(gates)
    .filter(([id]) => enabledGates.has(id))
    .map(([id, gate]) => ({
      id,
      label: gate.label,
      description: gate.description
    }));

  return {
    availableGates,
    gridLayout: { qubits: qubitCount, columns: columnCount }
  };
}

function setInteractionEnabled(enabled) {
isReady = enabled;
paletteButtons.forEach((btn) => {
btn.disabled = !enabled;
btn.draggable = enabled;
btn.classList.toggle('disabled', !enabled);
});
slots.forEach((slot) => slot.classList.toggle('disabled', !enabled));
if (runBtn) runBtn.disabled = !enabled;
if (generateBtn) generateBtn.disabled = !enabled;
if (simplifyBtn) simplifyBtn.disabled = !enabled;
if (clearBtn) clearBtn.disabled = !enabled;
if (luckyBtn) luckyBtn.disabled = !enabled;
}

function setGenerateLoading(isLoading) {
if (!generateBtn) return;
generateBtn.classList.toggle('loading', isLoading);
}

function setGettingLuckyLoading(isLoading) {
  if (!luckyBtn) return;
  luckyBtn.classList.toggle('loading', isLoading);
}

function setSimplifyLoading(isLoading) {
if (!simplifyBtn) return;
simplifyBtn.classList.toggle('loading', isLoading);
}

function isGridClear() {
return grid.every((row) => row.every((cell) => cell === null));
}

function clearAll() {
targetProbabilities = null;
previousGrid = null;
if (simplifyStatus) simplifyStatus.textContent = '';
if (!isGridClear())
  grid.forEach((row) => row.fill(null));
renderGrid();
runCircuit();
}


function applyConfig(config) {
if (!config || !applyGridData(config.grid)) {
  return;
}
}

function applyGridData(gridData) {
if (!Array.isArray(gridData) || gridData.length !== qubitCount) {
  return false;
}

for (let row = 0; row < qubitCount; row++) {
  const rowData = Array.isArray(gridData[row]) ? gridData[row] : null;
  if (!rowData || rowData.length !== columnCount) {
    return false;
  }

  for (let col = 0; col < columnCount; col++) {
    const gateId = rowData[col];
    grid[row][col] = gateId && gates[gateId] ? gateId : null;
  }
}

return true;
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
if (gateId === 'C') identityRows.push(row);
if (gateId === 'X') xRows.push(row);
}

const controlledPairs = pairControls(identityRows, xRows);

for (let row = 0; row < qubitCount; row++) {
const gateId = gateIds[row];
const gate = gateId ? gates[gateId] : null;
const isControlledTarget = controlledPairs.some((pair) => pair.targetRow === row);

if (gate && gate.measurement) {
matrices.push(gates.C.matrix);
measuredQubits.push(row);
} else if (isControlledTarget) {
matrices.push(gates.C.matrix);
} else {
matrices.push(gate && gate.matrix ? gate.matrix : gates.C.matrix);
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
const targets = targetProbabilities;
probabilityRows.forEach((row) => {
const index = Number(row.dataset.index);
const amp = state[index];
const prob = probability(amp);
const bits = index.toString(2).padStart(qubitCount, '0');

row.querySelector('.state-tag').textContent = bits;

const bar = row.querySelector('.bar');
const targetBar = row.querySelector('.target-bar');
const probPct = prob * 100;
bar.style.width = `${probPct.toFixed(1)}%`;

const target = targets?.[index];
const targetPct = target !== undefined && target !== null ? target * 100 : 0;
if (targetBar) {
  const prob = Math.round(probPct * 1000) / 1000;
  const target = Math.round(targetPct * 1000) / 1000;
  targetBar.style.width = `${targetPct.toFixed(1)}%`;
  bar.style.zIndex = prob <= target ? 1 : 0;
  targetBar.style.zIndex = target < prob ? 1 : 0;
}

const input = row.querySelector('.value');
if (input) input.value = prob.toFixed(3);

const targetValue = row.querySelector('.target-value');
if (targetValue) {
  if (target !== undefined && target !== null) {
    targetValue.innerHTML = `${target.toFixed(3)}`;
  } else {
    targetValue.textContent = '';
  }
}
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

attachProbabilityInputHandlers();
renderGrid();
runCircuit();
setInteractionEnabled(true);
window.addEventListener('resize', positionPalette);
requestAnimationFrame(positionPalette);
