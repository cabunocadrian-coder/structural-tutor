\# Structural Tutor



\### A Local AI-Powered Structural Engineering Tutor using Tether QVAC



Structural Tutor is a small local AI web application designed to help civil engineering students understand basic structural engineering concepts and solve common engineering problems.



It uses \*\*Tether QVAC\*\* to run AI inference locally while using deterministic JavaScript calculations for supported engineering problems to provide reliable numerical results.



\---



\## Features



\- Local AI inference using Tether QVAC

\- No external AI API required

\- Step-by-step engineering solutions

\- Deterministic calculations for supported problems

\- Structural engineering concept explanations

\- Simple and student-friendly interface

\- Problem Library with example questions

\- Works locally on a computer



\---



\## Supported Engineering Calculations



Structural Tutor currently supports deterministic calculations for:



\### Beam Reactions



\- Full-span uniformly distributed loads

\- Center point loads

\- Off-center point loads

\- Combined UDL and point loads



\### Bending Moment



\- Center point loads

\- Off-center point loads

\- Full-span UDL

\- Combined UDL and point loads



\### Material Properties



\- Stress

\- Strain

\- Young's Modulus

\- Factor of Safety



For supported numerical problems, calculations are performed using JavaScript formulas instead of relying entirely on the small local AI model.



\---



\## Structural Concepts



Structural Tutor can also explain basic concepts using the local QVAC model, including:



\- Tension

\- Compression

\- Elastic behavior

\- Plastic behavior

\- Simply supported beams

\- Fixed beams

\- Beam vs. column

\- Dead loads

\- Live loads

\- Shear force

\- Bending moment

\- Equilibrium

\- Free-body diagrams

\- Other basic structural engineering concepts



\---



\## How It Works



```text

User

&#x20; |

&#x20; v

Structural Tutor Web Interface

&#x20; |

&#x20; v

Node.js / Express Server

&#x20; |

&#x20; +-------------------------+

&#x20; |                         |

&#x20; v                         v

Deterministic              Tether QVAC

Calculations               Local AI

&#x20; |                         |

&#x20; +------------+------------+

&#x20;              |

&#x20;              v

&#x20;         Step-by-Step Answer

