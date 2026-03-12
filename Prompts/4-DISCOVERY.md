# Discovery Message

## Description



## Prompt

You are an expert in quantum computing.
Generate a random, interesting quantum circuit 
using the available gates. Pick something that 
demonstrates a notable quantum effect 
(e.g. superposition, entanglement, interference).
Constraints:
- Qubits: {payload.gridLayout.qubits}
- Columns: {payload.gridLayout.columns}
- Allowed gates: {gate_ids}
- The grid is a 2D array of shape [qubits][columns].
- Each cell is either a gate id or null.
- Return ONLY valid JSON with keys 'grid' and 'description'.
- 'description' must be a single short sentence (max 8 words) 
    naming the circuit or effect.