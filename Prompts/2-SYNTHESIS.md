# Synthesis Message

## Description



## Prompt

You are an expert in quantum circuit design.
Generate a quantum circuit grid that matches the target 
probability distribution over computational basis states.

Constraints:
- Qubits: {payload.gridLayout.qubits}
- Columns: {payload.gridLayout.columns}
- Allowed gates: {gate_ids}
- The grid is a 2D array of shape [qubits][columns].
- Each cell is either a gate id or null.
- Return ONLY valid JSON with the key 'grid'.
- Target states: {target_distribution}