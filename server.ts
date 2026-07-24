import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parsing with raised limit for base64 images
app.use(express.json({ limit: "15mb" }));

// Firebase web API key (public) used to verify user ID tokens against
// Google Identity Toolkit, so AI endpoints can't be abused anonymously.
const firebaseWebApiKey: string = (() => {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf-8"));
    return cfg.apiKey || "";
  } catch {
    return "";
  }
})();

/**
 * Verifies a Firebase ID token from the Authorization: Bearer header.
 * Returns the user info object on success, or null if missing/invalid.
 */
async function verifyFirebaseToken(req: express.Request): Promise<any | null> {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken || !firebaseWebApiKey) return null;

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseWebApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.users?.[0] || null;
  } catch (err) {
    console.error("Token verification failed:", err);
    return null;
  }
}

// GoogleGenAI is initialized dynamically within endpoints as needed to support custom user-provided API keys and prevent startup crashes when keys are missing.

// API endpoint to test AI provider key
app.post("/api/ai/test-key", async (req, res) => {
  try {
    const { provider = 'gemini', apiKey, model } = req.body;

    if (provider === 'gemini') {
      // Using the server's own Gemini key requires a signed-in user;
      // callers supplying their own key spend their own quota.
      if (!apiKey?.trim()) {
        const authedUser = await verifyFirebaseToken(req);
        if (!authedUser) {
          return res.status(401).json({ success: false, error: 'Sign in required to use the built-in Gemini key, or provide your own API key.' });
        }
      }
      const keyToUse = apiKey?.trim() || process.env.GEMINI_API_KEY;
      if (!keyToUse) {
        return res.status(400).json({ success: false, error: 'Gemini API Key is missing.' });
      }
      const client = new GoogleGenAI({ apiKey: keyToUse });
      const resp = await client.models.generateContent({
        model: model || 'gemini-3.6-flash',
        contents: ['Say Hello in 3 words.'],
      });
      return res.json({
        success: true,
        message: `Connected to Google Gemini! Response: "${resp.text?.trim()}"`,
      });
    }

    if (provider === 'openai') {
      if (!apiKey?.trim()) {
        return res.status(400).json({ success: false, error: 'OpenAI API Key is required.' });
      }
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say Hello in 3 words.' }],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: data.error?.message || 'OpenAI authentication failed.' });
      }
      return res.json({
        success: true,
        message: `Connected to OpenAI (${model || 'gpt-4o-mini'})! Response: "${data.choices?.[0]?.message?.content?.trim()}"`,
      });
    }

    if (provider === 'claude') {
      if (!apiKey?.trim()) {
        return res.status(400).json({ success: false, error: 'Anthropic Claude API Key is required.' });
      }
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-haiku-20241022',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Say Hello in 3 words.' }],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: data.error?.message || 'Anthropic API key verification failed.' });
      }
      return res.json({
        success: true,
        message: `Connected to Anthropic Claude (${model || 'claude-3-5-haiku'})! Response: "${data.content?.[0]?.text?.trim()}"`,
      });
    }

    if (provider === 'groq') {
      if (!apiKey?.trim()) {
        return res.status(400).json({ success: false, error: 'Groq API Key is required.' });
      }
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: model || 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Say Hello in 3 words.' }],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: data.error?.message || 'Groq authentication failed.' });
      }
      return res.json({
        success: true,
        message: `Connected to Groq Llama (${model || 'llama-3.3-70b-versatile'})! Response: "${data.choices?.[0]?.message?.content?.trim()}"`,
      });
    }

    if (provider === 'deepseek') {
      if (!apiKey?.trim()) {
        return res.status(400).json({ success: false, error: 'DeepSeek API Key is required.' });
      }
      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages: [{ role: 'user', content: 'Say Hello in 3 words.' }],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: data.error?.message || 'DeepSeek authentication failed.' });
      }
      return res.json({
        success: true,
        message: `Connected to DeepSeek AI (${model || 'deepseek-chat'})! Response: "${data.choices?.[0]?.message?.content?.trim()}"`,
      });
    }

    if (provider === 'openrouter') {
      if (!apiKey?.trim()) {
        return res.status(400).json({ success: false, error: 'OpenRouter API Key is required.' });
      }
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: model || 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say Hello in 3 words.' }],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({ success: false, error: data.error?.message || 'OpenRouter authentication failed.' });
      }
      return res.json({
        success: true,
        message: `Connected to OpenRouter (${model || 'openai/gpt-4o-mini'})! Response: "${data.choices?.[0]?.message?.content?.trim()}"`,
      });
    }

    return res.status(400).json({ success: false, error: `Unsupported provider: ${provider}` });
  } catch (err: any) {
    console.error('API Test Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to verify API provider key.' });
  }
});

// API endpoint for AI Parsing across providers
app.post("/api/ai/parse-transaction", async (req, res) => {
  try {
    const { text, image, additionalEvidence, currentDate, forcedType, aiConfig } = req.body;

    const provider = aiConfig?.provider || 'gemini';
    const customKey = aiConfig?.apiKey?.trim();
    const targetModel = aiConfig?.model;

    const systemPrompt = `You are a precise financial parsing assistant. Analyze the provided financial transaction details and output strictly a raw JSON object string without any markdown code block formatting or extra conversational text.
Reference current date (today) is: ${currentDate || new Date().toISOString().split('T')[0]}.

Allowed JSON schema output format:
{
  "type": "${forcedType ? forcedType : 'income or expense'}",
  "amount": number (total amount),
  "netAmount": number (net amount before tax/VAT),
  "taxAmount": number (tax/VAT amount if listed, else 0),
  "vendor": string (merchant/vendor name if found),
  "category": string (must be strictly one of allowed categories),
  "date": "YYYY-MM-DD",
  "description": string (short summary max 30 chars),
  "paymentMethod": string ("Card", "Cash", "Bank Transfer", or "Mobile Pay"),
  "currency": string ("USD" or "KHR"),
  "status": string ("Paid" or "Pending"),
  "payUnder": string ("Company Account" or account name if mentioned)
}

Allowed Categories:
For expense: 'Food', 'Shopping', 'Housing', 'Transport', 'Utilities', 'Entertainment', 'Healthcare', 'Other_Expense'
For income: 'Salary', 'Freelance', 'Investments', 'Other_Income'
${forcedType ? `The type MUST be strictly '${forcedType}'.` : ''}`;

    // Helper to clean JSON string output
    const cleanAndParseJson = (rawStr: string) => {
      let cleaned = rawStr.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      return JSON.parse(cleaned);
    };

    // 1. GOOGLE GEMINI
    if (provider === 'gemini') {
      // Server env key is reserved for authenticated users to prevent
      // anonymous quota theft; custom keys spend the caller's own quota.
      if (!customKey) {
        const authedUser = await verifyFirebaseToken(req);
        if (!authedUser) {
          return res.status(401).json({ error: "Sign in required to use the built-in AI, or add your own API key in Settings." });
        }
      }
      const apiKeyToUse = customKey || process.env.GEMINI_API_KEY;
      if (!apiKeyToUse) {
        return res.status(500).json({ error: "Gemini API key is missing." });
      }

      const geminiClient = new GoogleGenAI({
        apiKey: apiKeyToUse,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const contents: any[] = [systemPrompt];

      if (image) {
        const match = image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) contents.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
      if (additionalEvidence) {
        const match = additionalEvidence.match(/^data:([^;]+);base64,(.+)$/);
        if (match) contents.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
      if (text) contents.push(`User text input: "${text}"`);

      const response = await geminiClient.models.generateContent({
        model: targetModel || "gemini-3.6-flash",
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["type", "amount", "category", "date", "description", "paymentMethod"],
            properties: {
              type: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              netAmount: { type: Type.NUMBER },
              taxAmount: { type: Type.NUMBER },
              vendor: { type: Type.STRING },
              category: { type: Type.STRING },
              date: { type: Type.STRING },
              description: { type: Type.STRING },
              paymentMethod: { type: Type.STRING },
              currency: { type: Type.STRING },
              status: { type: Type.STRING },
              payUnder: { type: Type.STRING }
            }
          }
        }
      });

      const resultText = response.text?.trim() || "{}";
      return res.json(JSON.parse(resultText));
    }

    // 2. OPENAI (ChatGPT)
    if (provider === 'openai') {
      if (!customKey) {
        return res.status(400).json({ error: "OpenAI API key is missing. Please add your key in Settings." });
      }

      const userContentArray: any[] = [];
      if (text) userContentArray.push({ type: 'text', text: `Text details: ${text}` });
      if (image) userContentArray.push({ type: 'image_url', image_url: { url: image } });
      if (additionalEvidence) userContentArray.push({ type: 'image_url', image_url: { url: additionalEvidence } });
      if (userContentArray.length === 0) userContentArray.push({ type: 'text', text: 'Parse empty receipt' });

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customKey}`,
        },
        body: JSON.stringify({
          model: targetModel || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContentArray }
          ],
          response_format: { type: "json_object" }
        })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'OpenAI API error.');

      const content = data.choices?.[0]?.message?.content || '{}';
      return res.json(cleanAndParseJson(content));
    }

    // 3. ANTHROPIC CLAUDE
    if (provider === 'claude') {
      if (!customKey) {
        return res.status(400).json({ error: "Claude API key is missing. Please add your key in Settings." });
      }

      const claudeContent: any[] = [];
      if (text) claudeContent.push({ type: 'text', text: `User description: ${text}` });

      if (image) {
        const match = image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          claudeContent.push({
            type: 'image',
            source: { type: 'base64', media_type: match[1], data: match[2] }
          });
        }
      }
      if (additionalEvidence) {
        const match = additionalEvidence.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          claudeContent.push({
            type: 'image',
            source: { type: 'base64', media_type: match[1], data: match[2] }
          });
        }
      }

      if (claudeContent.length === 0) claudeContent.push({ type: 'text', text: 'Extract default' });

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': customKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: targetModel || 'claude-3-5-haiku-20241022',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: claudeContent }]
        })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Claude API error.');

      const textOut = data.content?.[0]?.text || '{}';
      return res.json(cleanAndParseJson(textOut));
    }

    // 4. GROQ / DEEPSEEK / OPENROUTER (OpenAI compatible)
    if (provider === 'groq' || provider === 'deepseek' || provider === 'openrouter') {
      if (!customKey) {
        return res.status(400).json({ error: `${provider.toUpperCase()} API key is missing. Please set your key in Settings.` });
      }

      let endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      if (provider === 'deepseek') endpoint = 'https://api.deepseek.com/chat/completions';
      if (provider === 'openrouter') endpoint = 'https://openrouter.ai/api/v1/chat/completions';

      const promptMsg = `${systemPrompt}\n\nUser text input: ${text || 'Receipt parsing'}`;

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customKey}`
        },
        body: JSON.stringify({
          model: targetModel || (provider === 'groq' ? 'llama-3.3-70b-versatile' : provider === 'deepseek' ? 'deepseek-chat' : 'openai/gpt-4o-mini'),
          messages: [{ role: 'user', content: promptMsg }],
          response_format: { type: "json_object" }
        })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || `${provider} API error.`);

      const textOut = data.choices?.[0]?.message?.content || '{}';
      return res.json(cleanAndParseJson(textOut));
    }

    return res.status(400).json({ error: `Unsupported AI provider: ${provider}` });
  } catch (error: any) {
    console.error("AI Parsing Error:", error);
    res.status(500).json({ error: error.message || "Failed to process transaction using selected AI Provider." });
  }
});

app.post("/api/import-public-sheet", async (req, res) => {
  try {
    const { sheetUrl } = req.body;
    if (!sheetUrl || typeof sheetUrl !== "string") {
      return res.status(400).json({ error: "sheetUrl is required" });
    }

    // Extract spreadsheet ID
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return res.status(400).json({ error: "Invalid Google Sheets URL format. Please make sure it looks like: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit" });
    }

    const spreadsheetId = match[1];

    // Extract gid/tab if any
    const gidMatch = sheetUrl.match(/gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : "0";

    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

    console.log(`[PUBLIC SHEET IMPORT] Fetching CSV export from: ${exportUrl}`);

    const response = await fetch(exportUrl);
    if (!response.ok) {
      return res.status(400).json({ error: "Failed to download Google Sheet. Please verify that the sheet is shared as public ('Anyone with the link can view') and try again." });
    }

    const csvText = await response.text();
    return res.json({ success: true, csv: csvText });
  } catch (err: any) {
    console.error("Public Sheet Import Error:", err);
    return res.status(500).json({ error: err.message || "Failed to import public sheet" });
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
