import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parsing with raised limit for base64 images
app.use(express.json({ limit: "15mb" }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API endpoint for AI Parsing
app.post("/api/ai/parse-transaction", async (req, res) => {
  try {
    const { text, image, currentDate } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured in server secrets." });
    }

    const contents: any[] = [];
    
    const prompt = `Analyze the provided financial transaction inputs and extract details.
Reference current date (today) is: ${currentDate || new Date().toISOString().split('T')[0]}.

If an image of a receipt/bill/paycheck is provided, read the image to extract the amount, date, description, category, and payment method.
If free-text is provided, read the sentence to extract details.
If both are provided, combine them coherently.

Categories must be strictly one of these available keys:
For expense transaction type: 'Food', 'Shopping', 'Housing', 'Transport', 'Utilities', 'Entertainment', 'Healthcare', 'Other_Expense'
For income transaction type: 'Salary', 'Freelance', 'Investments', 'Other_Income'

Payment method must be strictly one of: 'Card', 'Cash', 'Bank Transfer', 'Mobile Pay'. Default to 'Card' if unknown.

If the transaction is an expense/outflow, type must be 'expense'. If it's an income/inflow, type must be 'income'.`;

    contents.push(prompt);

    if (image) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const data = match[2];
        contents.push({
          inlineData: {
            mimeType,
            data
          }
        });
      }
    }

    if (text) {
      contents.push(`User text input: "${text}"`);
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["type", "amount", "category", "date", "description", "paymentMethod"],
          properties: {
            type: {
              type: Type.STRING,
              description: "Must be 'income' or 'expense'"
            },
            amount: {
              type: Type.NUMBER,
              description: "The numeric dollar value of the transaction. Must be positive."
            },
            category: {
              type: Type.STRING,
              description: "The exact category key from the allowed lists"
            },
            date: {
              type: Type.STRING,
              description: "The date of the transaction in YYYY-MM-DD format"
            },
            description: {
              type: Type.STRING,
              description: "A short elegant description of the transaction (max 30 characters)"
            },
            paymentMethod: {
              type: Type.STRING,
              description: "Must be 'Card', 'Cash', 'Bank Transfer', or 'Mobile Pay'"
            }
          }
        }
      }
    });

    const resultText = response.text?.trim() || "{}";
    const resultObj = JSON.parse(resultText);
    res.json(resultObj);
  } catch (error: any) {
    console.error("Gemini Parsing Error:", error);
    res.status(500).json({ error: error.message || "Failed to process transaction using AI." });
  }
});

// Serve static files / Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
