# 🏗️ Structural Tutor

### 📐 A Local AI-Powered Structural Engineering Tutor using Tether QVAC

> **Learn structural engineering. Solve problems. Understand the steps. All locally. 🤖**

Structural Tutor is a local AI web application built for **civil engineering students** who want help understanding structural engineering concepts and solving basic engineering problems.

It combines **Tether QVAC local AI inference** with **deterministic engineering calculations**, so supported numerical problems are calculated using actual engineering formulas instead of relying entirely on AI-generated answers.

---

## ✨ Features

🧮 **Engineering Calculations**

Solve supported structural engineering problems with deterministic calculations.

🤖 **Local AI**

Uses **Tether QVAC** to run a local Llama model directly on the user's device.

📚 **Step-by-Step Solutions**

Shows the given values, formula, solution, and final answer.

🧠 **Concept Explanations**

Ask questions about basic structural engineering concepts and receive explanations from the local AI model.

📋 **Problem Library**

Includes ready-to-use examples for common engineering problems.

🔒 **Local Processing**

The QVAC model runs locally instead of requiring a remote AI API.

🎓 **Student Friendly**

Designed with civil engineering students in mind.

---

## 🧮 Supported Calculations

### 🏗️ Beam Reactions

- Full-span uniformly distributed loads
- Center point loads
- Off-center point loads
- Combined UDL and point loads

### 📈 Bending Moment

- Center point loads
- Off-center point loads
- Full-span UDL
- Combined UDL and point loads

### 🧱 Material Properties

- Stress
- Strain
- Young's Modulus
- Factor of Safety

---

## 🧠 Structural Engineering Concepts

Structural Tutor can explain concepts such as:

- 💪 Tension
- 🗜️ Compression
- 🔄 Elastic behavior
- 🧱 Plastic behavior
- 📏 Simply supported beams
- 🏗️ Fixed beams
- 🏢 Beam vs. column
- ⚖️ Dead loads
- 👥 Live loads
- ↔️ Shear force
- 📈 Bending moment
- ⚖️ Equilibrium
- 📐 Free-body diagrams

---

## 🤖 Powered by Tether QVAC

Structural Tutor uses the **Tether QVAC SDK** for local AI inference.

The application loads a local Llama model through QVAC and generates responses directly on the user's computer.

### Why QVAC?

⚡ Local inference  
🔒 User data stays on the device  
🌐 No external AI API required  
💰 No per-request AI API cost  
📱 Designed for on-device AI applications

---

## ⚙️ How Structural Tutor Works

Instead of asking the AI to calculate everything, Structural Tutor uses two approaches:

### 🧮 Supported Numerical Problems

The application recognizes supported engineering problems and performs the calculations using JavaScript formulas.

This provides consistent numerical results.

### 🤖 Conceptual / Unsupported Questions

If the question is conceptual or not currently supported by the deterministic calculator, Structural Tutor sends it to the local QVAC model.

### 🔄 Simple Flow

**👤 User**

⬇️

**🌐 Structural Tutor Web App**

⬇️

**⚙️ Node.js / Express**

↙️　　　　　　　　　↘️

**🧮 Engineering Calculator**　 **🤖 QVAC Local AI**

↘️　　　　　　　　　↙️

**📚 Step-by-Step Answer**

---

## 🧪 Example Problems

### 🏗️ Beam Reactions

```text
A simply supported beam is 8 m long and carries
a uniformly distributed load of 10 kN/m over the
entire span. Find the support reactions.