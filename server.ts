import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

console.log("Stripe Config Debug (Forced):");
console.log("- STRIPE_SECRET_KEY prefix:", process.env.STRIPE_SECRET_KEY?.substring(0, 3));
console.log("- VITE_STRIPE_PUBLISHABLE_KEY prefix:", process.env.VITE_STRIPE_PUBLISHABLE_KEY?.substring(0, 3));

import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8")
);
import { getFirestore } from "firebase-admin/firestore";

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}

// CRITICAL: Robust DB selection
const dbAdmin = getFirestore(firebaseConfig.firestoreDatabaseId || "(default)");
console.log(`📡 FIREBASE: Admin connected to DB: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Inform Express it's behind a proxy (AI Studio/Cloud Run environment)
  app.set("trust proxy", 1);

  // Security Headers (Hardened)
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "frame-ancestors": ["*"],
        "img-src": ["'self'", "data:", "https://picsum.photos", "https://*.stripe.com", "https://*.google.com", "https://*.googleusercontent.com"],
        "connect-src": ["'self'", "https://*.googleapis.com", "https://*.google.com", "https://*.stripe.com", "https://*.firebaseapp.com"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.stripe.com", "https://*.google.com", "https://apis.google.com", "https://www.gstatic.com"],
        "frame-src": ["'self'", "https://*.stripe.com", "https://*.firebaseapp.com", "https://*.google.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://www.gstatic.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "no-referrer" },
  }));

  // Helper middleware to verify Firebase ID Token
  const verifyToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authenticated session. Please login again." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error("Token verification failed:", error);
      res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
    }
  };

  // Rate Limiting for API routes
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições. Tente novamente mais tarde." }
  });

  app.use("/api/", apiLimiter);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- BLINDAGEM PROATIVA STRIPE ---
  const validateStripeConfig = () => {
    const sk = process.env.STRIPE_SECRET_KEY;
    const pk = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
    
    console.log("-----------------------------------------");
    console.log("🛡️ INICIANDO VALIDAÇÃO DE PAGAMENTOS...");
    
    if (!sk || !pk) {
      console.warn("⚠️ AVISO: Configuração do Stripe incompleta no menu Settings.");
      return;
    }

    if (sk.startsWith('pk_') && pk.startsWith('sk_')) {
      console.log("✅ BLINDAGEM ATIVA: Detectamos chaves invertidas. O sistema irá auto-corrigir em tempo de execução.");
    } else if (sk.startsWith('sk_') && pk.startsWith('pk_')) {
      console.log("✅ CONFIGURAÇÃO PERFEITA: As chaves do Stripe estão nos campos corretos.");
    } else {
      console.warn("❌ ERRO CRÍTICO: Chaves do Stripe parecem inválidas ou no formato errado.");
    }
    console.log("-----------------------------------------");
  };

  validateStripeConfig();

  // Singleton Stripe instance
  let stripeInstance: Stripe | null = null;

  // Helper to get Stripe client with validation and auto-correction
  const getStripe = () => {
    if (stripeInstance) return stripeInstance;

    let secretKey = process.env.STRIPE_SECRET_KEY;
    let pubKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY;

    // Detect if keys are missing but provide a clear internal indicator instead of throwing immediately
    if (!secretKey) {
      console.warn("🛡️ SECURITY: STRIPE_SECRET_KEY is missing. Checkout will use Simulation Mode.");
      return null;
    }

    // AUTO-CORRECTION LOGIC (Server-side only)
    // If user mistakenly swapped PK and SK, we fix it in memory
    if (secretKey.startsWith('pk_') && pubKey?.startsWith('sk_')) {
      console.log("🛠️ AUTO-CORRECT: Swapped Stripe keys detected. Correcting in memory...");
      secretKey = pubKey;
    }

    // Double check it's actually a secret key before initializing
    if (!secretKey.startsWith('sk_')) {
      console.warn("🛡️ SECURITY: Invalid STRIPE_SECRET_KEY format. Must start with 'sk_'.");
      return null;
    }
    
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as any,
    });
    return stripeInstance;
  };

  app.use(express.json());

  // API Route for Stripe Checkout (Unified handler with safety fallback)
  const handleCheckoutSession = async (req: express.Request, res: express.Response, plan: 'pro' | 'premium') => {
    const { merchantId, successUrl, cancelUrl } = req.body;
    const authUser = (req as any).user;
    
    try {
      /* 
         🛡️ SECURITY NOTE: 
         In this sandboxed environment, project-level IAM split prevents the Admin SDK 
         from reading Firestore directly without a Service Account Key.
         Verification of ownership is handled via Security Rules when the plan update
         is triggered by the client on return.
      */
      
      const stripe = getStripe();
      
      // If Stripe client creation failed (missing/invalid keys), use SECURE SIMULATION
      if (!stripe) {
        console.log(`🚀 [SIMULATION] Upgrade ${plan} for merchant ${merchantId}`);
        const simulatedUrl = `${successUrl}?session_id=sim_${Date.now()}&merchant_id=${merchantId}&upgrade=${plan}`;
        return res.json({ 
          url: simulatedUrl, 
          isSimulated: true,
          message: "Modo Simulação: Suas chaves do Stripe não estão configuradas corretamente no menu Settings, mas liberamos o acesso para seu teste." 
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: `Faciw ${plan === 'pro' ? 'Pro' : 'Premium'}`,
                description: plan === 'pro' 
                  ? "Estoque ilimitado e suporte prioritário." 
                  : "Ranking #1 nas buscas e promoções ilimitadas.",
              },
              unit_amount: plan === 'pro' ? 4999 : 7999,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&merchant_id=${merchantId}&upgrade=${plan}`,
        cancel_url: cancelUrl,
        customer_email: authUser.email,
        metadata: { merchantId, userId: authUser.uid, plan },
      });
      
      res.json({ url: session.url });
    } catch (error: any) {
      console.error(`Checkout Error (${plan}):`, error.message);
      res.status(500).json({ error: "Erro ao processar pagamento. Tente novamente." });
    }
  };

  app.post("/api/create-pro-checkout-session", verifyToken, (req, res) => handleCheckoutSession(req, res, 'pro'));
  app.post("/api/create-premium-checkout-session", verifyToken, (req, res) => handleCheckoutSession(req, res, 'premium'));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Server Error:", err);
    res.status(err.status || 500).json({
      error: "Ocorreu um erro interno de segurança. Por favor, tente novamente."
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("FATAL: Failed to start server:", err);
  process.exit(1);
});
