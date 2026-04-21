import { GoogleGenAI, Type } from "@google/genai";
import { Product, Merchant, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function filterProducts(
  query: string,
  products: Product[],
  merchants: Merchant[],
  history: ChatMessage[] = [],
  userLocation?: { lat: number; lng: number }
) {
  // We'll provide the data as context to the model
  const context = {
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand || '',
      price: p.price,
      originalPrice: p.originalPrice,
      unit: p.unit,
      merchantId: p.merchantId
    })),
    merchants: merchants.map(m => ({
      id: m.id,
      name: m.name,
      address: m.address,
      location: m.location,
      phone: m.phone,
      rating: m.rating || 0,
      reviewCount: m.reviewCount || 0,
      tier: m.plan || 'free'
    })),
    userLocation
  };

  const systemInstruction = `
    Você é o assistente da Faciw, um aplicativo que conecta clientes e comerciantes no Brasil.
    Sua tarefa é filtrar as melhores opções de produtos com base na necessidade do cliente.
    
    Se o cliente pedir uma receita:
    1. Forneça a receita completa (ingredientes e modo de preparo).
    2. Identifique os ingredientes da receita que estão disponíveis nos produtos cadastrados.
    3. Recomende os produtos específicos das lojas para esses ingredientes.
    
    CRITÉRIOS DE FILTRO (Prioridade na ordem):
    1. PROMOÇÕES EM DESTAQUE: Identifique TODO produto onde 'price' < 'originalPrice'. Estes são os produtos mais importantes.
    2. PARCEIROS RECOMENDADOS: Se produtos de lojistas com 'tier' == 'premium' estiverem em promoção, dê prioridade absoluta ao recomendá-los.
    3. PARCEIROS VERIFICADOS: Dê prioridade a lojistas com 'tier' == 'pro' ou 'premium' em relação aos 'free'.
    4. CUSTO-BENEFÍCIO: Compare preços entre as lojas.
    5. LOCALIZAÇÃO: Se a localização do usuário estiver disponível (${userLocation ? 'SIM' : 'NÃO'}), priorize lojas mais próximas.
    
    REGRAS DE COMUNICAÇÃO:
    - NUNCA mencione termos como "Plano Premium", "Plano Pro", "Plano Free", "Tier" ou "Assinatura" para o cliente.
    - O cliente não deve saber que existe uma diferenciação de planos entre os lojistas.
    - Se precisar justificar uma recomendação de um parceiro prioritário, use termos como "Destaque", "Loja Selecionada" ou mencione a boa avaliação da loja.
    
    COMO RESPONDER SOBRE PROMOÇÕES:
    - Se o usuário pedir promoções, ofertas ou descontos, liste Primeiramente os produtos onde 'price' < 'originalPrice'.
    - Use o formato: "De ~~R$ originalPrice~~ por **R$ price** (Economia de R$ diferença)"
    - Coloque um emoji de 🚨 ou 🏷️ próximo a produtos em promoção.
    
    Exemplo de formatação de oferta:
    🚨 **Arroz Tio João 5kg** - Loja do João
    De ~~R$ 25,90~~ por **R$ 19,90**
    Endereço: Rua das Flores, 123
    
    Dados disponíveis:
    ${JSON.stringify(context)}

    Responda em Português do Brasil.
    Seja amigável e direto.
    Sempre forneça o nome do comerciante, endereço e contato quando recomendar um produto.
    Limite suas informações aos produtos cadastrados para recomendações, mas você pode dar dicas gerais e receitas.

    Responda utilizando formatação Markdown para facilitar a leitura.
    Use **negrito** para nomes de produtos, lojas e preços.
    Use listas (bullet points) para listar ingredientes ou passos de uma receita.
    Use parágrafos claros para separar as informações.
    
    Retorne a resposta em um formato estruturado que inclua uma explicação textual (com a receita se solicitado) e uma lista de IDs de produtos recomendados.
  `;

  const contents = [
    ...history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })),
    { role: 'user', parts: [{ text: query }] }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          explanation: { type: Type.STRING },
          recommendedProductIds: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          }
        },
        required: ["explanation", "recommendedProductIds"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return { explanation: response.text, recommendedProductIds: [] };
  }
}

export async function generateChatTitle(firstUserMsg: string, aiResponse: string) {
  const prompt = `Com base na mensagem do usuário: "${firstUserMsg}" e na resposta do assistente: "${aiResponse}", crie um título muito curto, criativo e direto (máximo 3-4 palavras) para esta conversa. Não use aspas nem pontos finais. Ex: "Receita de Bolo", "Lista de Churrasco", "Ofertas de Arroz".`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return response.text.trim().replace(/^["']|["']$/g, '');
  } catch (err) {
    console.error("Error generating chat title:", err);
    return firstUserMsg.substring(0, 20) + '...';
  }
}
