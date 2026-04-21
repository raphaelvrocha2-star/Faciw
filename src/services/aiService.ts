import { GoogleGenAI, Type } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using Vite's asset handling
// This ensures the worker is bundled and served correctly
// @ts-ignore - Vite specific import
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ParsedProduct {
  name: string;
  brand?: string;
  price: number;
  originalPrice?: number;
  unit: string;
}

export class AIService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not found in environment variables.");
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || "" });
  }

  async extractTextFromPDF(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += pageText + "\n";
    }

    return fullText;
  }

  async parseStockContent(content: string, fileName: string): Promise<ParsedProduct[]> {
    const prompt = `
      Você é um especialista em logística e precificação. 
      Abaixo está o conteúdo de um arquivo de estoque (pode ser texto extraído de um PDF ou conteúdo de um CSV).
      Seu objetivo é extrair uma lista de produtos com seus respectivos preços, marcas e unidades de medida.
      
      Regras:
      1. Identifique o nome do produto de forma clara (ex: Arroz, Feijão, Detergente).
      2. Identifique a MARCA do produto separadamente (ex: Tio João, Camil, Omo). Se não houver marca clara, deixe vazio.
      3. Identifique o PREÇO ATUAL (preço de venda hoje).
      4. Identifique o PREÇO ORIGINAL/ANTERIOR se houver (para detectar promoções). Muitas vezes aparece como "De: R$ XX,XX" ou um valor riscado/maior. Se não houver, deixe nulo.
      5. Identifique a unidade (ex: kg, un, litro, fardo, etc). Se não estiver claro, use "unidade".
      6. Ignore cabeçalhos, rodapés ou informações irrelevantes.
      7. Se houver múltiplas colunas de preço (ex: atacado e varejo), priorize o preço de varejo ou o mais comum.
      
      Arquivo: ${fileName}
      Conteúdo:
      ${content.substring(0, 15000)}
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Nome do produto (sem a marca)" },
                brand: { type: Type.STRING, description: "Marca do produto" },
                price: { type: Type.NUMBER, description: "Preço atual (promoção ou venda)" },
                originalPrice: { type: Type.NUMBER, description: "Preço original (antes do desconto). Nulo se não houver promoção." },
                unit: { type: Type.STRING, description: "Unidade de medida (kg, un, etc)" },
              },
              required: ["name", "price", "unit"],
            },
          },
        },
      });

      const text = response.text;
      if (!text) return [];
      return JSON.parse(text);
    } catch (error) {
      console.error("Error parsing stock with AI:", error);
      throw new Error("Falha ao interpretar o arquivo de estoque de forma inteligente.");
    }
  }
}

export const aiService = new AIService();
