# ICWE 2026 – Quantum Goes Web: A Demonstrator for Circuit Simulation, Synthesis, Optimization, and Discovery
Online appendix for a demonstration of the Virtual Quantum Table: https://quantumtable.scch.at/.

**Notes:** The term **Quantum Table** refers to the pysical, tabletop workbench, as documented under `Photos` and `Videos`. The **Virtual Quantum Table** is its digital counterpart, accessible via https://quantumtable.scch.at/.

* **`src`** Source files
  * **`v0`** The first version of the **Virtual Quantum Table** was generated with the `gpt-5.1-codex` model using `Prompts/1-DEVELOPER.md` and `Prompts/Quantum-Table.jpg`. The file `styles.css` contains 19 additional lines of CSS code that resolve layout bugs.
  * **`v1`** The latest version of the **Virtual Quantum Table** is available at https://quantumtable.scch.at/.
* **`Prompts`** These are the prompts that were used to develop the **Virtual Quantum Table**, as well as to execute its synthesis, optimization, and discovery features.
  * **`Quantum-Table.jpg`** This image and `1-DEVELOPER.md` were used to generate the first version of the **Virtual Quantum Table**.
  * **`0-CREATE.md`** This prompt was used to (automatically) create the developer message `1-DEVELOPER.md`.
  * **`1-DEVELOPER.md`** This prompt and `Quantum-Table.jpg` were used to generate the first version of the **Virtual Quantum Table**.
  * **`2-SYNTHESIS.md`** This prompt synthesizes a quantum circuit based on a set of probability states and selected gates.
  * **`3-OPTIMIZATION.md`** This prompt optimizes the current quantum circuit based on a set of probability states and selected gates.
  * **`4-DISCOVERY.md`** This prompt generates a random, interesting quantum circuit based on selected gates.
* **`Tests`** Test cases for the simulation feature: Do the computed probability states correspond to the quantum circuit?
* **`Photos`** Photos of the Quantum Table
* **`Videos`** Videos of the Quantum Table