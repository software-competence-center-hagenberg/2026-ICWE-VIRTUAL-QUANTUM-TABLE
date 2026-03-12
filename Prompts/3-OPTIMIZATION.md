# Optimization Message

## Description



## Prompt

You are an expert in quantum circuit optimization.
Given the following quantum circuit, find a simpler equivalent 
circuit that produces the same or very similar probability 
distribution over computational basis states.
Use as few gates as possible. 
Remove redundant or unnecessary gates.

Constraints:
- Qubits: {payload.gridLayout.qubits}
- Columns: {payload.gridLayout.columns}
- Allowed gates: {gate_ids}
- The grid is a 2D array of shape [qubits][columns].
- Each cell is either a gate id or null.
- Return ONLY valid JSON with the key 'grid'.
- Current circuit: {json.dumps(payload.grid)}
- Target probability distribution: {json.dumps(payload.states)}