import express from "express";
import cors from "cors";
import {
  loadModel,
  completion,
  LLAMA_3_2_1B_INST_Q4_0
} from "@qvac/sdk";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

let modelId = null;

/* =========================
   BASIC NUMBER HELPERS
========================= */

function round(value, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function cleanNumber(value) {
  return Number.isInteger(value)
    ? String(value)
    : String(round(value));
}

/* =========================
   FORCE / LOAD HELPERS
========================= */

function getForceValue(text) {
  if (typeof text !== "string") return null;

  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(kN|KN|kn|N)\b/i
  );

  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  return unit === "kn" ? value * 1000 : value;
}

/* =========================
   AREA HELPER
========================= */

function getAreaValue(text) {
  if (typeof text !== "string") return null;

  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(mm2|mm²|cm2|cm²|m2|m²)\b/i
  );

  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === "mm2" || unit === "mm²") {
    return value;
  }

  if (unit === "cm2" || unit === "cm²") {
    return value * 100;
  }

  if (unit === "m2" || unit === "m²") {
    return value * 1000000;
  }

  return null;
}

/* =========================
   LENGTH HELPERS
========================= */

function getChangeInLength(text) {
  if (typeof text !== "string") return null;

  const patterns = [
    /(?:change in length|elongation|elongates?|elongated|extension|extends?|extended|deformation|deforms?|increase in length)\s*(?:is|of|by|=)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/i,
    /(?:length|elongation|extension|deformation)\s*(?:increased|changed)?\s*(?:by|of|is|=)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();

      if (unit === "mm") return value;
      if (unit === "cm") return value * 10;
      if (unit === "m") return value * 1000;
    }
  }

  return null;
}

function getOriginalLength(text) {
  if (typeof text !== "string") return null;

  const patterns = [
    /(?:original|initial)\s+length\s*(?:is|of|=)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/i,
    /length\s*(?:is|of|=)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();

      if (unit === "mm") return value;
      if (unit === "cm") return value * 10;
      if (unit === "m") return value * 1000;
    }
  }

  return null;
}

/* =========================
   STRESS VALUE HELPER
========================= */

function getStressValue(text) {
  if (typeof text !== "string") return null;

  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(MPa|GPa|kPa|Pa)\b/i
  );

  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === "mpa") return value;
  if (unit === "gpa") return value * 1000;
  if (unit === "kpa") return value / 1000;
  if (unit === "pa") return value / 1000000;

  return null;
}

/* =========================
   STRAIN VALUE HELPER
========================= */

function getStrainValue(text) {
  if (typeof text !== "string") return null;

  const match = text.match(
    /(?:strain|ε|epsilon)\s*(?:is|of|=)?\s*(\d+(?:\.\d+)?)/i
  );

  if (!match) return null;

  return parseFloat(match[1]);
}

/* =========================
   BEAM SPAN
========================= */

function getBeamSpan(text) {
  if (typeof text !== "string") return null;

  const match = text.match(
    /(\d+(?:\.\d+)?)\s*m(?:\s*(?:long|span))?/i
  );

  return match ? parseFloat(match[1]) : null;
}

/* =========================
   POINT LOAD
========================= */

function getPointLoad(text) {
  if (typeof text !== "string") return null;

  /*
    Important:
    Do NOT treat the "kN" part of a UDL such as
    6 kN/m as a point load.
  */

  const match = text.match(
    /(\d+(?:\.\d+)?)\s*kN(?!\s*\/\s*m)\b/i
  );

  return match ? parseFloat(match[1]) : null;
}

/* =========================
   UDL
========================= */

function getUDL(text) {
  if (typeof text !== "string") return null;

  const match = text.match(
    /(\d+(?:\.\d+)?)\s*kN\s*\/\s*m\b/i
  );

  return match ? parseFloat(match[1]) : null;
}

/* =========================
   DISTANCE FROM SUPPORT A
========================= */

function getDistanceFromA(text) {
  if (typeof text !== "string") return null;

  const patterns = [
    /(\d+(?:\.\d+)?)\s*m\s*(?:from|to)\s*(?:support\s*)?A\b/i,

    /(?:at|located|applied)\s*(?:a distance of\s*)?(\d+(?:\.\d+)?)\s*m\s*(?:from|to)\s*A\b/i,

    /(\d+(?:\.\d+)?)\s*m\s*(?:from|to)\s*(?:the\s*)?(?:left\s*)?support\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return parseFloat(match[1]);
    }
  }

  return null;
}

/* =========================
   FACTOR OF SAFETY
========================= */

function calculateFactorOfSafety(problem) {
  const text = problem.toLowerCase();

  if (
    !text.includes("factor of safety") &&
    !text.includes("safety factor")
  ) {
    return null;
  }

  const failureMatch = text.match(
    /(?:failure strength|failure stress|ultimate strength|ultimate stress|failure capacity)\s*(?:is|of|=)?\s*(\d+(?:\.\d+)?)\s*(mpa|gpa|kpa|pa)\b/i
  );

  const workingMatch = text.match(
    /(?:working stress|allowable stress|applied stress|working load)\s*(?:is|of|=)?\s*(\d+(?:\.\d+)?)\s*(mpa|gpa|kpa|pa)\b/i
  );

  if (!failureMatch || !workingMatch) {
    return null;
  }

  function toMPa(value, unit) {
    unit = unit.toLowerCase();

    if (unit === "mpa") return value;
    if (unit === "gpa") return value * 1000;
    if (unit === "kpa") return value / 1000;
    if (unit === "pa") return value / 1000000;

    return value;
  }

  const failureStrength = toMPa(
    parseFloat(failureMatch[1]),
    failureMatch[2]
  );

  const workingStress = toMPa(
    parseFloat(workingMatch[1]),
    workingMatch[2]
  );

  if (workingStress === 0) return null;

  const factorOfSafety =
    failureStrength / workingStress;

  return {
    type: "factorOfSafety",
    failureStrength,
    workingStress,
    factorOfSafety
  };
}

/* =========================
   STRESS / STRAIN
========================= */

function calculateStressStrain(problem) {
  const text = problem.toLowerCase();

  /* STRESS */

  if (
    text.includes("stress") &&
    (
      text.includes("force") ||
      text.includes("load")
    ) &&
    (
      text.includes("area") ||
      text.includes("cross-sectional")
    )
  ) {
    const force = getForceValue(problem);
    const area = getAreaValue(problem);

    if (
      force !== null &&
      area !== null &&
      area !== 0
    ) {
      const stressMPa = force / area;

      return {
        type: "stress",
        force,
        area,
        stressMPa
      };
    }
  }

  /* STRAIN */

  if (
    text.includes("strain") &&
    (
      text.includes("length") ||
      text.includes("elongation") ||
      text.includes("extension") ||
      text.includes("deformation")
    )
  ) {
    const changeInLength =
      getChangeInLength(problem);

    const originalLength =
      getOriginalLength(problem);

    if (
      changeInLength !== null &&
      originalLength !== null &&
      originalLength !== 0
    ) {
      const strain =
        changeInLength / originalLength;

      return {
        type: "strain",
        changeInLength,
        originalLength,
        strain
      };
    }
  }

  /* YOUNG'S MODULUS */

  if (
    text.includes("young") &&
    text.includes("modulus")
  ) {
    const stress = getStressValue(problem);
    const strain = getStrainValue(problem);

    if (
      stress !== null &&
      strain !== null &&
      strain !== 0
    ) {
      const youngsModulus =
        stress / strain;

      return {
        type: "youngsModulus",
        stress,
        strain,
        youngsModulus
      };
    }
  }

  return null;
}

/* =========================
   FORMAT STRESS / STRAIN
========================= */

function formatStressStrainAnswer(calculation) {
  if (calculation.type === "stress") {
    const forceN = calculation.force;
    const area = calculation.area;
    const stressMPa = calculation.stressMPa;

    return `
GIVEN:
F = ${cleanNumber(forceN)} N
A = ${cleanNumber(area)} mm²

FORMULA:
σ = F / A

SOLUTION:
σ = ${cleanNumber(forceN)} / ${cleanNumber(area)}
σ = ${cleanNumber(stressMPa)} MPa

ANSWER:
Stress = ${cleanNumber(stressMPa)} MPa

CONCEPT:
Stress is the internal resisting force per unit area of a material.
`.trim();
  }

  if (calculation.type === "strain") {
    const change = calculation.changeInLength;
    const original = calculation.originalLength;
    const strain = calculation.strain;

    return `
GIVEN:
ΔL = ${cleanNumber(change)} mm
L = ${cleanNumber(original)} mm

FORMULA:
ε = ΔL / L

SOLUTION:
ε = ${cleanNumber(change)} / ${cleanNumber(original)}
ε = ${cleanNumber(strain)}

ANSWER:
Strain = ${cleanNumber(strain)}

CONCEPT:
Strain is the deformation of a material relative to its original length.
`.trim();
  }

  if (calculation.type === "youngsModulus") {
    const stress = calculation.stress;
    const strain = calculation.strain;
    const modulus = calculation.youngsModulus;

    return `
GIVEN:
σ = ${cleanNumber(stress)} MPa
ε = ${cleanNumber(strain)}

FORMULA:
E = σ / ε

SOLUTION:
E = ${cleanNumber(stress)} / ${cleanNumber(strain)}
E = ${cleanNumber(modulus)} MPa

ANSWER:
Young's Modulus = ${cleanNumber(modulus)} MPa

CONCEPT:
Young's modulus is the ratio of normal stress to normal strain within the elastic range.
`.trim();
  }

  return null;
}

/* =========================
   FORMAT FACTOR OF SAFETY
========================= */

function formatFactorOfSafety(calculation) {
  return `
GIVEN:
Failure strength = ${cleanNumber(calculation.failureStrength)} MPa
Working stress = ${cleanNumber(calculation.workingStress)} MPa

FORMULA:
FS = Failure strength / Working stress

SOLUTION:
FS = ${cleanNumber(calculation.failureStrength)} / ${cleanNumber(calculation.workingStress)}
FS = ${cleanNumber(calculation.factorOfSafety)}

ANSWER:
Factor of Safety = ${cleanNumber(calculation.factorOfSafety)}

CONCEPT:
Factor of safety is the ratio between the failure strength or capacity of a material or member and the required or working load or stress.
`.trim();
}

/* =========================
   BEAM REACTIONS
========================= */

function calculateBeamReactions(problem) {
  const text = problem.toLowerCase();

  if (
    !text.includes("reaction") &&
    !text.includes("ra") &&
    !text.includes("rb")
  ) {
    return null;
  }

  const L = getBeamSpan(problem);

  if (!L) return null;

  const w = getUDL(problem);
  const P = getPointLoad(problem);

  /* =========================
     COMBINED UDL + POINT LOAD
  ========================= */

  if (
    w !== null &&
    P !== null
  ) {
    let a = getDistanceFromA(problem);

    if (
      a === null &&
      (
        text.includes("at the center") ||
        text.includes("at center") ||
        text.includes("center of the beam") ||
        text.includes("midspan")
      )
    ) {
      a = L / 2;
    }

    if (
      a !== null &&
      a >= 0 &&
      a <= L
    ) {
      const W = w * L;

      const RB =
        (W * (L / 2) + P * a) / L;

      const RA =
        W + P - RB;

      return {
        type: "combined",
        L,
        w,
        W,
        P,
        a,
        RA,
        RB
      };
    }
  }

  /* =========================
     FULL-SPAN UDL
  ========================= */

  if (
    w !== null &&
    (
      text.includes("uniformly distributed") ||
      text.includes("udl") ||
      text.includes("distributed load")
    )
  ) {
    const W = w * L;
    const RA = W / 2;
    const RB = W / 2;

    return {
      type: "udl",
      L,
      w,
      W,
      RA,
      RB
    };
  }

  /* =========================
     POINT LOAD
  ========================= */

  if (P !== null) {
    let a = getDistanceFromA(problem);

    if (
      a === null &&
      (
        text.includes("at the center") ||
        text.includes("at center") ||
        text.includes("center of the beam") ||
        text.includes("midspan")
      )
    ) {
      a = L / 2;
    }

    if (
      a !== null &&
      a >= 0 &&
      a <= L
    ) {
      const RB =
        (P * a) / L;

      const RA =
        P - RB;

      return {
        type: "point",
        L,
        P,
        a,
        b: L - a,
        RA,
        RB
      };
    }
  }

  return null;
}

/* =========================
   FORMAT BEAM REACTIONS
========================= */

function formatBeamReactions(calculation) {
  if (calculation.type === "udl") {
    return `
GIVEN:
L = ${cleanNumber(calculation.L)} m
w = ${cleanNumber(calculation.w)} kN/m

FORMULA:
W = wL
RA = W / 2
RB = W / 2

SOLUTION:
W = ${cleanNumber(calculation.w)} × ${cleanNumber(calculation.L)}
W = ${cleanNumber(calculation.W)} kN

RA = ${cleanNumber(calculation.RA)} kN
RB = ${cleanNumber(calculation.RB)} kN

ANSWER:
RA = ${cleanNumber(calculation.RA)} kN
RB = ${cleanNumber(calculation.RB)} kN
`.trim();
  }

  if (calculation.type === "point") {
    return `
GIVEN:
L = ${cleanNumber(calculation.L)} m
P = ${cleanNumber(calculation.P)} kN
a = ${cleanNumber(calculation.a)} m
b = ${cleanNumber(calculation.b)} m

FORMULA:
RB = (P × a) / L
RA = P - RB

SOLUTION:
RB = (${cleanNumber(calculation.P)} × ${cleanNumber(calculation.a)}) / ${cleanNumber(calculation.L)}
RB = ${cleanNumber(calculation.RB)} kN

RA = ${cleanNumber(calculation.P)} - ${cleanNumber(calculation.RB)}
RA = ${cleanNumber(calculation.RA)} kN

ANSWER:
RA = ${cleanNumber(calculation.RA)} kN
RB = ${cleanNumber(calculation.RB)} kN
`.trim();
  }

  if (calculation.type === "combined") {
    return `
GIVEN:
L = ${cleanNumber(calculation.L)} m
w = ${cleanNumber(calculation.w)} kN/m
P = ${cleanNumber(calculation.P)} kN
a = ${cleanNumber(calculation.a)} m

FORMULA:
W = wL
RB = [W(L/2) + Pa] / L
RA = W + P - RB

SOLUTION:
W = ${cleanNumber(calculation.w)} × ${cleanNumber(calculation.L)}
W = ${cleanNumber(calculation.W)} kN

RB = ${cleanNumber(calculation.RB)} kN
RA = ${cleanNumber(calculation.RA)} kN

ANSWER:
RA = ${cleanNumber(calculation.RA)} kN
RB = ${cleanNumber(calculation.RB)} kN
`.trim();
  }

  return null;
}

/* =========================
   BENDING MOMENT
========================= */

function calculateBendingMoment(problem) {
  const text = problem.toLowerCase();

  if (
    !text.includes("moment") &&
    !text.includes("bending")
  ) {
    return null;
  }

  const L = getBeamSpan(problem);

  if (!L) return null;

  const w = getUDL(problem);
  const P = getPointLoad(problem);

  /* IMPORTANT FIX:
     Pass problem into getDistanceFromA().
  */

  let a = getDistanceFromA(problem);

  /* Center / midspan wording */

  if (
    a === null &&
    (
      text.includes("at the center") ||
      text.includes("at center") ||
      text.includes("center of the beam") ||
      text.includes("midspan")
    )
  ) {
    a = L / 2;
  }

  /* =========================
     COMBINED UDL + POINT LOAD
  ========================= */

  if (
    w !== null &&
    P !== null &&
    a !== null &&
    a >= 0 &&
    a <= L
  ) {
    const W = w * L;

    const RB =
      (W * (L / 2) + P * a) / L;

    const RA =
      W + P - RB;

    /*
      Check shear before the point load.
      V = RA - wx
    */

    const xBeforePoint =
      RA / w;

    let xMax;
    let Mmax;
    let location;

    if (
      xBeforePoint >= 0 &&
      xBeforePoint <= a
    ) {
      xMax = xBeforePoint;

      Mmax =
        RA * xMax -
        (w * xMax * xMax) / 2;

      location =
        `x = ${cleanNumber(xMax)} m from A, before the point load`;
    } else {
      /*
        Shear after point load:
        V = RA + P - wx

        Set V = 0:
        x = (RA + P) / w
      */

      const xAfterPoint =
        (RA + P) / w;

      if (
        xAfterPoint > a &&
        xAfterPoint < L
      ) {
        xMax = xAfterPoint;

        Mmax =
          RA * xMax +
          P * (xMax - a) -
          (w * xMax * xMax) / 2;

        location =
          `x = ${cleanNumber(xMax)} m from A, after the point load`;
      } else {
        /*
          If shear changes sign at the point load,
          maximum moment occurs directly under the point load.
        */

        xMax = a;

        Mmax =
          RA * a -
          (w * a * a) / 2;

        location =
          `x = ${cleanNumber(a)} m from A, at the point load`;
      }
    }

    return {
      type: "combined",
      L,
      w,
      W,
      P,
      a,
      RA,
      RB,
      Mmax,
      location
    };
  }

  /* =========================
     FULL-SPAN UDL
  ========================= */

  if (
    w !== null &&
    P === null &&
    (
      text.includes("udl") ||
      text.includes("uniformly distributed") ||
      text.includes("distributed load")
    )
  ) {
    const RA =
      (w * L) / 2;

    const Mmax =
      (w * L * L) / 8;

    return {
      type: "udl",
      L,
      w,
      RA,
      Mmax
    };
  }

  /* =========================
     POINT LOAD
  ========================= */

  if (P !== null) {
    if (
      a !== null &&
      a >= 0 &&
      a <= L
    ) {
      const b = L - a;

      const RA =
        (P * b) / L;

      const RB =
        P - RA;

      const Mmax =
        RA * a;

      return {
        type: "point",
        L,
        P,
        a,
        b,
        RA,
        RB,
        Mmax
      };
    }
  }

  return null;
}

/* =========================
   FORMAT BENDING MOMENT
========================= */

function formatBendingMoment(calculation) {
  if (calculation.type === "point") {
    return `
GIVEN:
L = ${cleanNumber(calculation.L)} m
P = ${cleanNumber(calculation.P)} kN
a = ${cleanNumber(calculation.a)} m
b = ${cleanNumber(calculation.b)} m

FORMULA:
RA = (P × b) / L
Mmax = RA × a

SOLUTION:
RA = (${cleanNumber(calculation.P)} × ${cleanNumber(calculation.b)}) / ${cleanNumber(calculation.L)}
RA = ${cleanNumber(calculation.RA)} kN

Mmax = ${cleanNumber(calculation.RA)} × ${cleanNumber(calculation.a)}
Mmax = ${cleanNumber(calculation.Mmax)} kN·m

ANSWER:
Maximum Bending Moment = ${cleanNumber(calculation.Mmax)} kN·m
`.trim();
  }

  if (calculation.type === "udl") {
    return `
GIVEN:
L = ${cleanNumber(calculation.L)} m
w = ${cleanNumber(calculation.w)} kN/m

FORMULA:
Mmax = wL² / 8

SOLUTION:
Mmax = ${cleanNumber(calculation.w)} × ${cleanNumber(calculation.L)}² / 8
Mmax = ${cleanNumber(calculation.Mmax)} kN·m

ANSWER:
Maximum Bending Moment = ${cleanNumber(calculation.Mmax)} kN·m
`.trim();
  }

  if (calculation.type === "combined") {
    return `
GIVEN:
L = ${cleanNumber(calculation.L)} m
w = ${cleanNumber(calculation.w)} kN/m
P = ${cleanNumber(calculation.P)} kN
a = ${cleanNumber(calculation.a)} m

SOLUTION:
RA = ${cleanNumber(calculation.RA)} kN
RB = ${cleanNumber(calculation.RB)} kN

Maximum bending moment occurs at ${calculation.location}.

Mmax = ${cleanNumber(calculation.Mmax)} kN·m

ANSWER:
Maximum Bending Moment = ${cleanNumber(calculation.Mmax)} kN·m
`.trim();
  }

  return null;
}

/* =========================
   QVAC FALLBACK
========================= */

async function getModel() {
  if (modelId) {
    return modelId;
  }

  console.log("Loading QVAC model...");

  modelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    modelType: "llm"
  });

  console.log("QVAC model loaded.");

  return modelId;
}

async function askQVAC(problem) {
  const id = await getModel();

  const history = [
    {
      role: "system",
      content: `
You are Structural Tutor, a civil engineering tutor.

Give short, accurate, student-friendly answers.

IMPORTANT:
- Do not invent information.
- Do not invent loads, dimensions, supports, or reactions.
- Answer only what the question asks.
- For simple conceptual questions, answer in 2 to 5 sentences.
- Do not repeat the same information.
- Do not add unnecessary examples.
- Do not give numerical examples unless requested.

STRUCTURAL DEFINITIONS:

SIMPLY SUPPORTED BEAM:
A beam supported at two ends, typically by a pin and a roller. It allows rotation at the supports and generally has zero bending moment at the supports.

FIXED BEAM:
A beam whose supports restrain translation and rotation. Fixed supports can develop force reactions and support moments.

BEAM:
A structural member that primarily resists bending and shear from transverse loads. A typical beam is generally horizontal.

COLUMN:
A structural member that primarily carries axial compression and transfers loads toward the foundation. A typical column is generally vertical and may also experience bending and shear.

DEAD LOAD:
A permanent load caused by the self-weight of the structure and permanently attached components, such as beams, columns, slabs, walls, roofing, and fixed equipment.

LIVE LOAD:
A variable load caused by occupants, movable furniture, movable equipment, stored materials, and other loads that can change in magnitude or location.

SHEAR FORCE:
Shear force is an internal transverse force in a structural member that tends to cause adjacent portions of the member to slide relative to each other.

The relationship between shear force and bending moment is:
V = dM/dx

BENDING MOMENT:
Bending moment is the internal moment in a structural member caused by external loads and reactions. It represents the member's tendency to bend.

STRESS:
Stress is the internal resisting force per unit area within a material.

STRAIN:
Strain is the deformation of a material relative to its original length.

YOUNG'S MODULUS:
Young's modulus is the ratio of normal stress to normal strain within the elastic range.

FACTOR OF SAFETY:
Factor of safety is the ratio between the failure strength or capacity of a material/member and the required or working load/stress.

TENSION:
Tension is a force that tends to pull or elongate a member.

COMPRESSION:
Compression is a force that tends to push or shorten a member.

ELASTIC BEHAVIOR:
Elastic behavior means a material returns to approximately its original shape after the load is removed, as long as the elastic limit is not exceeded.

PLASTIC BEHAVIOR:
Plastic behavior occurs when permanent deformation remains after the load is removed.

RESPONSE FORMAT:

For conceptual questions:

ANSWER:
CONCEPT:

Keep the answer short and complete.
      `.trim()
    },
    {
      role: "user",
      content: problem
    }
  ];

  const result = completion({
    modelId: id,
    history,
    stream: true
  });

  let answer = "";

  for await (const token of result.tokenStream) {
    answer += token;
  }

  return answer.trim();
}

/* =========================
   API ROUTE
========================= */

app.post("/api/solve", async (req, res) => {
  try {
    const problem = req.body?.problem;

    if (
      !problem ||
      typeof problem !== "string"
    ) {
      return res.status(400).json({
        error: "Please provide a problem."
      });
    }

    /* 1. FACTOR OF SAFETY */

    const factorOfSafety =
      calculateFactorOfSafety(problem);

    if (factorOfSafety) {
      return res.json({
        answer:
          formatFactorOfSafety(
            factorOfSafety
          ),
        source: "deterministic"
      });
    }

    /* 2. STRESS / STRAIN / YOUNG'S MODULUS */

    const stressStrain =
      calculateStressStrain(problem);

    if (stressStrain) {
      return res.json({
        answer:
          formatStressStrainAnswer(
            stressStrain
          ),
        source: "deterministic"
      });
    }

    /* 3. BENDING MOMENT */

    const bendingMoment =
      calculateBendingMoment(problem);

    if (bendingMoment) {
      return res.json({
        answer:
          formatBendingMoment(
            bendingMoment
          ),
        source: "deterministic"
      });
    }

    /* 4. BEAM REACTIONS */

    const reactions =
      calculateBeamReactions(problem);

    if (reactions) {
      return res.json({
        answer:
          formatBeamReactions(
            reactions
          ),
        source: "deterministic"
      });
    }

    /* 5. QVAC FALLBACK */

    const answer =
      await askQVAC(problem);

    return res.json({
      answer,
      source: "qvac"
    });

  } catch (error) {
    console.error("Solve error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "An unexpected error occurred."
    });
  }
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(
    `Structural Tutor running at http://localhost:${PORT}`
  );
});