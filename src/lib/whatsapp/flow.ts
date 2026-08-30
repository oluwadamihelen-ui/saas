import "server-only";
import { prisma } from "@/lib/prisma";
import { sendText, sendButtons, sendList } from "@/lib/whatsapp/client";
import { createOrder } from "@/lib/orders";
import { getPaystackSecretForBusiness, initializeTransaction } from "@/lib/payments/paystack";
import { formatCurrency } from "@/lib/utils";
import type { Business, WhatsAppAccount, Conversation } from "@prisma/client";

type CartItem = { productId: string; name: string; price: number; quantity: number };
type FlowState = {
  step:
    | "IDLE"
    | "SHOP_CATEGORY"
    | "SHOP_PRODUCTS"
    | "CART"
    | "CHECKOUT_NAME"
    | "CHECKOUT_ADDRESS"
    | "CHECKOUT_CONFIRM"
    | "TRACK_ORDER";
  cart: CartItem[];
  customerName?: string;
  deliveryAddress?: string;
  activeCategoryId?: string;
};

const EMPTY_STATE: FlowState = { step: "IDLE", cart: [] };

function parseState(raw: unknown): FlowState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_STATE };
  const s = raw as Partial<FlowState>;
  return { step: s.step ?? "IDLE", cart: s.cart ?? [], customerName: s.customerName, deliveryAddress: s.deliveryAddress, activeCategoryId: s.activeCategoryId };
}

export type IncomingMessage =
  | { type: "text"; text: string }
  | { type: "interactive_button"; id: string; title: string }
  | { type: "interactive_list"; id: string; title: string };

async function reply(account: WhatsAppAccount, to: string, conversationId: string, text: string) {
  const res = await sendText(account, to, text);
  await prisma.conversationMessage.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      status: "SENT",
      type: "text",
      content: { text },
      providerMessageId: res.messages?.[0]?.id,
    },
  });
}

async function replyButtons(
  account: WhatsAppAccount,
  to: string,
  conversationId: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
) {
  const res = await sendButtons(account, to, bodyText, buttons);
  await prisma.conversationMessage.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      status: "SENT",
      type: "interactive",
      content: { bodyText, buttons },
      providerMessageId: res.messages?.[0]?.id,
    },
  });
}

async function replyList(
  account: WhatsAppAccount,
  to: string,
  conversationId: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>
) {
  const res = await sendList(account, to, bodyText, buttonText, sections);
  await prisma.conversationMessage.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      status: "SENT",
      type: "interactive",
      content: { bodyText, sections },
      providerMessageId: res.messages?.[0]?.id,
    },
  });
}

async function sendWelcome(business: Business, account: WhatsAppAccount, to: string, conversationId: string) {
  await replyList(
    account,
    to,
    conversationId,
    `👋 Welcome to ${business.name}.\n\nWhat would you like to do?`,
    "Choose an option",
    [
      {
        title: "Menu",
        rows: [
          { id: "menu:shop", title: "🛍️ Shop" },
          { id: "menu:orders", title: "📦 My Orders" },
          { id: "menu:track", title: "🚚 Track Order" },
          { id: "menu:talk", title: "💬 Talk to us" },
        ],
      },
    ]
  );
}

async function sendCategories(business: Business, account: WhatsAppAccount, to: string, conversationId: string) {
  const categories = await prisma.productCategory.findMany({
    where: { businessId: business.id, products: { some: { isActive: true } } },
  });

  if (categories.length === 0) {
    await reply(account, to, conversationId, "We don't have any products listed yet — please check back soon!");
    return;
  }

  await replyList(account, to, conversationId, "What are you shopping for today?", "Browse categories", [
    {
      title: "Categories",
      rows: categories.map((c) => ({ id: `category:${c.id}`, title: c.name })),
    },
  ]);
}

async function sendProductsInCategory(
  business: Business,
  account: WhatsAppAccount,
  to: string,
  conversationId: string,
  categoryId: string
) {
  const products = await prisma.product.findMany({
    where: { businessId: business.id, categoryId, isActive: true },
    take: 10,
  });

  if (products.length === 0) {
    await reply(account, to, conversationId, "No products available in that category right now.");
    return;
  }

  await replyList(
    account,
    to,
    conversationId,
    "Here's what we have available:",
    "View products",
    [
      {
        title: "Products",
        rows: products.map((p) => ({
          id: `product:${p.id}`,
          title: p.name,
          description: `${formatCurrency(p.price.toString(), business.currency)} · ${p.stockQuantity > 0 ? "In stock" : "Out of stock"}`,
        })),
      },
    ]
  );
}

async function sendProductDetail(
  business: Business,
  account: WhatsAppAccount,
  to: string,
  conversationId: string,
  productId: string
) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.businessId !== business.id) {
    await reply(account, to, conversationId, "That product is no longer available.");
    return;
  }

  const text = [
    `*${product.name}*`,
    product.description ?? "",
    `Price: ${formatCurrency(product.price.toString(), business.currency)}`,
    product.stockQuantity > 0 ? `In stock: ${product.stockQuantity}` : "Out of stock",
  ]
    .filter(Boolean)
    .join("\n");

  await reply(account, to, conversationId, text);

  if (product.stockQuantity > 0) {
    await replyButtons(account, to, conversationId, "Would you like to add this to your cart?", [
      { id: `add:${product.id}`, title: "Add to Cart" },
      { id: "menu:shop", title: "Keep shopping" },
    ]);
  }
}

function cartSummary(cart: CartItem[], currency: string) {
  if (cart.length === 0) return "Your cart is empty.";
  const lines = cart.map((i) => `${i.quantity}× ${i.name} — ${formatCurrency(i.price * i.quantity, currency)}`);
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  return [...lines, "", `Total: ${formatCurrency(total, currency)}`].join("\n");
}

export async function handleIncomingMessage(
  business: Business,
  account: WhatsAppAccount,
  conversation: Conversation,
  fromWaId: string,
  message: IncomingMessage
) {
  const state = parseState(conversation.state);
  const currency = business.currency;
  const conversationId = conversation.id;

  const optionId = message.type === "text" ? undefined : message.id;
  const text = message.type === "text" ? message.text.trim() : "";
  const lower = text.toLowerCase();

  // Global commands available from anywhere in the flow.
  if (optionId === "menu:shop" || /^(shop|menu|hi|hello|hey|start)$/i.test(lower)) {
    await sendCategories(business, account, fromWaId, conversationId);
    return { ...state, step: "SHOP_CATEGORY" } satisfies FlowState;
  }

  if (optionId === "menu:orders") {
    const customer = await prisma.customer.findUnique({ where: { businessId_phone: { businessId: business.id, phone: fromWaId } } });
    const orders = customer
      ? await prisma.order.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" }, take: 5 })
      : [];
    if (orders.length === 0) {
      await reply(account, fromWaId, conversationId, "You don't have any orders with us yet. Type 'Shop' to get started!");
    } else {
      const lines = orders.map((o) => `${o.orderNumber} — ${o.status} — ${formatCurrency(o.total.toString(), currency)}`);
      await reply(account, fromWaId, conversationId, ["Your recent orders:", ...lines].join("\n"));
    }
    return { ...EMPTY_STATE };
  }

  if (optionId === "menu:track") {
    await reply(account, fromWaId, conversationId, "Please reply with your order number (e.g. MAMA-123456) to track it.");
    return { ...EMPTY_STATE, step: "TRACK_ORDER" };
  }

  if (state.step === "TRACK_ORDER" && message.type === "text") {
    const order = await prisma.order.findFirst({ where: { businessId: business.id, orderNumber: text.toUpperCase() } });
    if (!order) {
      await reply(account, fromWaId, conversationId, "We couldn't find that order number. Please double-check and try again.");
    } else {
      await reply(account, fromWaId, conversationId, `Order ${order.orderNumber} is currently: *${order.status}*`);
    }
    return { ...EMPTY_STATE };
  }

  if (optionId === "menu:talk") {
    await reply(
      account,
      fromWaId,
      conversationId,
      "We've let the team know you'd like to chat — someone will reply here shortly."
    );
    await prisma.notification.create({
      data: {
        businessId: business.id,
        type: "NEW_CUSTOMER",
        title: "Customer wants to talk",
        body: `A customer on WhatsApp (${fromWaId}) asked to speak with your team.`,
      },
    });
    return { ...EMPTY_STATE };
  }

  if (optionId?.startsWith("category:")) {
    const categoryId = optionId.split(":")[1];
    await sendProductsInCategory(business, account, fromWaId, conversationId, categoryId);
    return { ...state, step: "SHOP_PRODUCTS", activeCategoryId: categoryId };
  }

  if (optionId?.startsWith("product:")) {
    const productId = optionId.split(":")[1];
    await sendProductDetail(business, account, fromWaId, conversationId, productId);
    return state;
  }

  if (optionId?.startsWith("add:")) {
    const productId = optionId.split(":")[1];
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.businessId !== business.id) {
      await reply(account, fromWaId, conversationId, "Sorry, that product is unavailable.");
      return state;
    }
    const cart = [...state.cart];
    const existing = cart.find((i) => i.productId === productId);
    if (existing) existing.quantity += 1;
    else cart.push({ productId, name: product.name, price: Number(product.price), quantity: 1 });

    await replyButtons(account, fromWaId, conversationId, `Added ${product.name} to your cart.\n\n${cartSummary(cart, currency)}`, [
      { id: "cart:view", title: "Checkout" },
      { id: "menu:shop", title: "Keep shopping" },
    ]);
    return { ...state, cart };
  }

  if (optionId === "cart:view" || /^cart$/i.test(lower)) {
    if (state.cart.length === 0) {
      await reply(account, fromWaId, conversationId, "Your cart is empty. Type 'Shop' to browse products.");
      return state;
    }
    await reply(account, fromWaId, conversationId, `What's your full name for this order?`);
    return { ...state, step: "CHECKOUT_NAME" };
  }

  if (state.step === "CHECKOUT_NAME" && message.type === "text") {
    await reply(account, fromWaId, conversationId, "Thanks! What's the delivery address for this order?");
    return { ...state, step: "CHECKOUT_ADDRESS", customerName: text };
  }

  if (state.step === "CHECKOUT_ADDRESS" && message.type === "text") {
    const summary = [
      cartSummary(state.cart, currency),
      "",
      `Name: ${state.customerName}`,
      `Delivery address: ${text}`,
    ].join("\n");
    await replyButtons(account, fromWaId, conversationId, `Please confirm your order:\n\n${summary}`, [
      { id: "checkout:confirm", title: "Confirm order" },
      { id: "checkout:cancel", title: "Cancel" },
    ]);
    return { ...state, step: "CHECKOUT_CONFIRM", deliveryAddress: text };
  }

  if (optionId === "checkout:cancel") {
    await reply(account, fromWaId, conversationId, "Order cancelled. Type 'Shop' anytime to start again.");
    return { ...EMPTY_STATE };
  }

  if (optionId === "checkout:confirm") {
    const order = await createOrder({
      businessId: business.id,
      customerPhone: fromWaId,
      customerName: state.customerName,
      items: state.cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
      deliveryAddress: state.deliveryAddress,
      source: "WHATSAPP",
    });

    const secretKey = await getPaystackSecretForBusiness(business.id);
    if (!secretKey) {
      await reply(
        account,
        fromWaId,
        conversationId,
        `Order ${order.orderNumber} created! The merchant will reach out to arrange payment — online payment isn't set up yet for this business.`
      );
      return { ...EMPTY_STATE };
    }

    try {
      const reference = `${order.orderNumber}-${Date.now()}`;
      const tx = await initializeTransaction({
        secretKey,
        email: `${fromWaId.replace(/[^0-9]/g, "")}@guest.mamabusiness.com`,
        amountKobo: Math.round(Number(order.total) * 100),
        reference,
        currency: business.currency,
        metadata: { orderId: order.id, businessId: business.id },
      });
      await prisma.payment.create({
        data: {
          businessId: business.id,
          orderId: order.id,
          provider: "PAYSTACK",
          providerReference: reference,
          amount: order.total,
          currency: business.currency,
          status: "PENDING",
          customerPhone: fromWaId,
        },
      });
      await reply(
        account,
        fromWaId,
        conversationId,
        `Order ${order.orderNumber} created! 🧾\n\nPlease complete payment securely here:\n${tx.authorization_url}\n\nWe'll confirm as soon as payment is received.`
      );
    } catch {
      await reply(
        account,
        fromWaId,
        conversationId,
        `Order ${order.orderNumber} created, but we couldn't generate a payment link right now. The merchant will follow up with you shortly.`
      );
    }

    return { ...EMPTY_STATE };
  }

  // Fallback — unrecognized input.
  await sendWelcome(business, account, fromWaId, conversationId);
  return { ...state, step: "IDLE" };
}
