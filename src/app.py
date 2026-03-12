import os
import json
import math
from typing import Dict, List, Optional, Any

import anyio
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator, model_validator
from openai import OpenAI
from passlib.apache import HtpasswdFile


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="Quantum Circuit Demonstrator", version="1.0.0")

# -----------------------------
# Pydantic models
# -----------------------------
class Gate(BaseModel):
    id: str = Field(..., min_length=1)
    label: str
    description: str

class GridLayout(BaseModel):
    qubits: int = Field(..., ge=1)
    columns: int = Field(..., ge=1)

class CircuitRequest(BaseModel):
    states: Dict[str, float]
    availableGates: List[Gate]
    gridLayout: GridLayout

@field_validator("states")
@classmethod
def validate_states_nonempty(cls, v: Dict[str, float]) -> Dict[str, float]:
    if not v:
        raise ValueError("states must not be empty")
    return v

@model_validator(mode="after")
def validate_states(self) -> "CircuitRequest":
    qubits = self.gridLayout.qubits
    expected_states_count = 2 ** qubits

    # Validate count equals 2^qubits
    if len(self.states) != expected_states_count:
        raise ValueError(f"states must contain exactly {expected_states_count} entries")

    # Validate each key has length == qubits and only 0/1
    for key, prob in self.states.items():
        if len(key) != qubits:
            raise ValueError("Each state key must match gridLayout.qubits in length")
        if any(ch not in ("0", "1") for ch in key):
            raise ValueError("State keys must only contain '0' or '1'")
        if not isinstance(prob, (int, float)) or prob < 0.0 or prob > 1.0:
            raise ValueError("State probabilities must be between 0 and 1")

    # Validate probabilities sum to 1.0 within tolerance
    total = sum(self.states.values())
    if not math.isclose(total, 1.0, abs_tol=1e-6):
        raise ValueError("State probabilities must sum to 1.0 within tolerance")

    return self

class SimplifyRequest(BaseModel):
    grid: List[List[Optional[str]]]
    states: Dict[str, float]
    availableGates: List[Gate]
    gridLayout: GridLayout

class LuckyRequest(BaseModel):
    availableGates: List[Gate]
    gridLayout: GridLayout

class CircuitResponse(BaseModel):
    grid: List[List[Optional[str]]]

class LuckyResponse(BaseModel):
    grid: List[List[Optional[str]]]
    description: str

# -----------------------------
# OpenAI client dependency
# -----------------------------
def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not set.")
    return OpenAI(api_key=api_key)

# -----------------------------
# Helpers
# -----------------------------
def build_simplify_prompt(payload: SimplifyRequest) -> str:
    gate_ids = [g.id for g in payload.availableGates]
    return (
        "You are an expert in quantum circuit optimization. "
        "Given the following quantum circuit, find a simpler equivalent circuit "
        "that produces the same or very similar probability distribution over computational basis states. "
        "Use as few gates as possible. Remove redundant or unnecessary gates. "
        "Constraints:\n"
        f"- Qubits: {payload.gridLayout.qubits}\n"
        f"- Columns: {payload.gridLayout.columns}\n"
        f"- Allowed gates: {gate_ids}\n"
        "- The grid is a 2D array of shape [qubits][columns].\n"
        "- Each cell is either a gate id or null.\n"
        "- Return ONLY valid JSON with the key 'grid'.\n"
        f"- Current circuit: {json.dumps(payload.grid)}\n"
        f"- Target probability distribution: {json.dumps(payload.states)}\n"
    )

def build_prompt(payload: CircuitRequest) -> str:
    gate_ids = [g.id for g in payload.availableGates]
    return (
        "You are an expert in quantum circuit design. "
        "Generate a quantum circuit grid that matches the target probability distribution "
        "over computational basis states. "
        "Constraints:\n"
        f"- Qubits: {payload.gridLayout.qubits}\n"
        f"- Columns: {payload.gridLayout.columns}\n"
        f"- Allowed gates: {gate_ids}\n"
        "- The grid is a 2D array of shape [qubits][columns].\n"
        "- Each cell is either a gate id or null.\n"
        "- Return ONLY valid JSON with the key 'grid'.\n"
        f"- Target states: {json.dumps(payload.states)}\n"
    )

def build_lucky_prompt(payload: LuckyRequest) -> str:
    gate_ids = [g.id for g in payload.availableGates]
    return (
        "You are an expert in quantum computing. "
        "Generate a random, interesting quantum circuit using the available gates. "
        "Pick something that demonstrates a notable quantum effect (e.g. superposition, entanglement, interference). "
        "Constraints:\n"
        f"- Qubits: {payload.gridLayout.qubits}\n"
        f"- Columns: {payload.gridLayout.columns}\n"
        f"- Allowed gates: {gate_ids}\n"
        "- The grid is a 2D array of shape [qubits][columns].\n"
        "- Each cell is either a gate id or null.\n"
        "- Return ONLY valid JSON with keys 'grid' and 'description'.\n"
        "- 'description' must be a single short sentence (max 8 words) naming the circuit or effect.\n"
    )

def validate_circuit_output(
    grid: Any, qubits: int, columns: int, allowed_gate_ids: set
) -> CircuitResponse:
    if not isinstance(grid, list) or len(grid) != qubits:
        raise ValueError("Grid must be a list with length equal to number of qubits")
    for row in grid:
        if not isinstance(row, list) or len(row) != columns:
            raise ValueError("Each row must be a list with length equal to columns")
    for row in grid:
        for cell in row:
            if cell is not None and cell not in allowed_gate_ids:
                raise ValueError("Grid contains invalid gate id")
    return CircuitResponse(grid=grid)

# -----------------------------
# Endpoint
# -----------------------------
@app.get("/")
def serve_index() -> FileResponse:
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/favicon.ico", include_in_schema=False)
def serve_favicon() -> FileResponse:
    return FileResponse(os.path.join(BASE_DIR, "favicon.ico"), media_type="image/x-icon")

@app.get("/index.html")
def serve_index_html() -> FileResponse:
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/config.json")
def serve_config() -> FileResponse:
    return FileResponse(os.path.join(BASE_DIR, "config.json"))

@app.get("/app.js")
def serve_app_js() -> FileResponse:
    return FileResponse(os.path.join(BASE_DIR, "app.js"))

@app.get("/styles.css")
def serve_styles_css() -> FileResponse:
    return FileResponse(os.path.join(BASE_DIR, "styles.css"))

@app.post("/api/lucky-circuit", response_model=LuckyResponse)
async def lucky_circuit(payload: LuckyRequest) -> LuckyResponse:
    client = get_openai_client()
    prompt = build_lucky_prompt(payload)
    allowed_gate_ids = {g.id for g in payload.availableGates}
    try:
        def _call_openai():
            return client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Return only JSON. No extra text."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"}
            )

        response = await anyio.to_thread.run_sync(_call_openai)
        data = json.loads(response.choices[0].message.content)

        if "grid" not in data or "description" not in data:
            raise ValueError("Response JSON must contain 'grid' and 'description'")

        circuit = validate_circuit_output(
            data["grid"],
            payload.gridLayout.qubits,
            payload.gridLayout.columns,
            allowed_gate_ids,
        )
        return LuckyResponse(grid=circuit.grid, description=str(data["description"]))

    except Exception as error:
        raise HTTPException(status_code=500, detail="Failed to generate lucky circuit.")

@app.post("/api/generate-circuit", response_model=CircuitResponse)
async def generate_circuit(payload: CircuitRequest) -> CircuitResponse:
    client = get_openai_client()
    prompt = build_prompt(payload)
    allowed_gate_ids = {g.id for g in payload.availableGates}
    try:
        # Use a thread to avoid blocking the event loop
        def _call_openai():
            return client.chat.completions.create(
                model="gpt-5.2-chat-latest",
                messages=[
                    {"role": "system", "content": "Return only JSON. No extra text."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"}
            )

        response = await anyio.to_thread.run_sync(_call_openai)
        content = response.choices[0].message.content

        data = json.loads(content)
        if "grid" not in data:
            raise ValueError("Response JSON must contain 'grid'")

        return validate_circuit_output(
            data["grid"],
            payload.gridLayout.qubits,
            payload.gridLayout.columns,
            allowed_gate_ids,
        )

    except Exception as error:
        raise HTTPException(status_code=500, detail="Failed to generate valid circuit.")

@app.post("/api/simplify-circuit", response_model=CircuitResponse)
async def simplify_circuit(payload: SimplifyRequest) -> CircuitResponse:
    client = get_openai_client()
    prompt = build_simplify_prompt(payload)
    allowed_gate_ids = {g.id for g in payload.availableGates}

    try:
        def _call_openai():
            return client.chat.completions.create(
                model="gpt-5.2-chat-latest",
                messages=[
                    {"role": "system", "content": "Return only JSON. No extra text."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"}
            )

        response = await anyio.to_thread.run_sync(_call_openai)
        content = response.choices[0].message.content

        data = json.loads(content)
        if "grid" not in data:
            raise ValueError("Response JSON must contain 'grid'")

        return validate_circuit_output(
            data["grid"],
            payload.gridLayout.qubits,
            payload.gridLayout.columns,
            allowed_gate_ids,
        )

    except Exception as _:
        raise HTTPException(status_code=500, detail="Failed to optimize circuit.")
