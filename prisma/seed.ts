import { PrismaClient, Prisma, OrderStatus, PaymentStatus, OrderSource } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PLAN_DEFS } from "../src/lib/plans";

const prisma = new PrismaClient();

// Deterministic PRNG so re-running the seed produces the same "realistic" data.
let seed = 42;
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

async function main() {
  console.log("Seeding MAMA Business OS...");

  // ---- Plans ----------------------------------------------------------
  const planRecords: Record<string, { id: string }> = {};
  for (const p of PLAN_DEFS) {
    const plan = await prisma.plan.upsert({
      where: { key: p.key },
      create: {
        key: p.key,
        name: p.name,
        priceMonthly: p.priceMonthly,
        productLimit: p.productLimit,
        aiMessageLimitPerMonth: p.aiMessageLimitPerMonth,
        whatsAppAutomation: p.whatsAppAutomation,
        features: p.features,
      },
      update: {
        name: p.name,
        priceMonthly: p.priceMonthly,
        productLimit: p.productLimit,
        aiMessageLimitPerMonth: p.aiMessageLimitPerMonth,
        whatsAppAutomation: p.whatsAppAutomation,
        features: p.features,
      },
    });
    planRecords[p.key] = plan;
  }

  // ---- Admin user -------------------------------------------------------
  const adminPasswordHash = await bcrypt.hash("Admin12345!", 12);
  await prisma.user.upsert({
    where: { email: "admin@mamabusiness.com" },
    create: {
      name: "MAMA Admin",
      email: "admin@mamabusiness.com",
      passwordHash: adminPasswordHash,
      globalRole: "ADMIN",
    },
    update: { globalRole: "ADMIN" },
  });

  // ---- Demo merchant user + business -------------------------------------
  const demoPasswordHash = await bcrypt.hash("Demo12345!", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@mamabusiness.com" },
    create: {
      name: "Chioma Eze",
      email: "demo@mamabusiness.com",
      phone: "+2348012340000",
      passwordHash: demoPasswordHash,
    },
    update: {},
  });

  let business = await prisma.business.findUnique({ where: { slug: "mama-foodstuff" } });
  if (!business) {
    business = await prisma.business.create({
      data: {
        name: "Mama Foodstuff",
        slug: "mama-foodstuff",
        ownerName: "Chioma Eze",
        phone: "+2348012340000",
        email: "hello@mamafoodstuff.com",
        country: "Nigeria",
        currency: "NGN",
        category: "Food",
        isDemo: true,
        onboardingStep: "COMPLETE",
        onboardingCompletedAt: new Date(),
        members: { create: { userId: demoUser.id, role: "OWNER" } },
        settings: { create: {} },
        paymentSettings: { create: {} },
        marketingSettings: { create: {} },
        subscription: { create: { planId: planRecords.GROWTH.id } },
      },
    });
  }

  console.log(`Business: ${business.name} (${business.id})`);

  // ---- Categories + products ---------------------------------------------
  const categoryDefs = ["Rice", "Grains", "Oil", "Pasta", "Provisions"];
  const categories: Record<string, { id: string }> = {};
  for (const name of categoryDefs) {
    categories[name] = await prisma.productCategory.upsert({
      where: { businessId_name: { businessId: business.id, name } },
      create: { businessId: business.id, name },
      update: {},
    });
  }

  const productDefs = [
    { name: "5kg Rice", category: "Rice", price: 8500, cost: 7200, stock: 40, sku: "RICE-5KG" },
    { name: "10kg Rice", category: "Rice", price: 16500, cost: 14000, stock: 30, sku: "RICE-10KG" },
    { name: "25kg Rice", category: "Rice", price: 38000, cost: 33000, stock: 15, sku: "RICE-25KG" },
    { name: "Beans (4kg)", category: "Grains", price: 3500, cost: 2800, stock: 25, sku: "BEANS-4KG" },
    { name: "Garri (paint bucket)", category: "Grains", price: 1800, cost: 1350, stock: 35, sku: "GARRI-PB" },
    { name: "Semovita (2kg)", category: "Grains", price: 3800, cost: 3100, stock: 20, sku: "SEMO-2KG" },
    { name: "Vegetable Oil (5L)", category: "Oil", price: 9000, cost: 7600, stock: 18, sku: "OIL-5L" },
    { name: "Golden Penny Spaghetti", category: "Pasta", price: 1200, cost: 950, stock: 8, lowStock: 10, sku: "GP-SPAG" },
    { name: "Indomie (carton)", category: "Pasta", price: 8200, cost: 6900, stock: 22, sku: "INDOMIE-CTN" },
    { name: "Tomato Paste (tin)", category: "Provisions", price: 450, cost: 340, stock: 60, sku: "TOMATO-TIN" },
  ];

  const products = [];
  for (const p of productDefs) {
    const product = await prisma.product.upsert({
      where: { businessId_sku: { businessId: business.id, sku: p.sku } },
      create: {
        businessId: business.id,
        categoryId: categories[p.category].id,
        name: p.name,
        description: `${p.name} — quality groceries from Mama Foodstuff.`,
        sku: p.sku,
        price: p.price,
        costPrice: p.cost,
        stockQuantity: p.stock,
        lowStockThreshold: p.lowStock ?? 10,
      },
      update: { stockQuantity: p.stock },
    });
    products.push(product);

    const existingMovement = await prisma.inventoryMovement.findFirst({ where: { productId: product.id, note: "Initial stock" } });
    if (!existingMovement) {
      await prisma.inventoryMovement.create({
        data: { businessId: business.id, productId: product.id, type: "STOCK_ADDED", quantity: p.stock, note: "Initial stock" },
      });
    }
  }

  // ---- Customers ----------------------------------------------------------
  const customerNames = [
    "Adaeze Okafor", "Ifeoma Nwosu", "Chinedu Okoro", "Blessing Uche", "Emeka Obi",
    "Ngozi Eze", "Tunde Bakare", "Aisha Bello", "Funmi Adebayo", "Segun Ade",
    "Grace Effiong", "Chukwu Emmanuel", "Amaka Ibe", "Bola Fashola", "Ebere Nnamdi",
    "Kemi Alabi", "Uche Chukwu", "Yemi Ogundele",
  ];
  const customers = [];
  for (let i = 0; i < customerNames.length; i++) {
    const phone = `+23480${(10000000 + i * 137).toString().slice(0, 8)}`;
    const customer = await prisma.customer.upsert({
      where: { businessId_phone: { businessId: business.id, phone } },
      create: { businessId: business.id, name: customerNames[i], phone },
      update: {},
    });
    customers.push(customer);
  }

  // ---- Orders over the last 30 days ---------------------------------------
  const existingOrderCount = await prisma.order.count({ where: { businessId: business.id } });
  if (existingOrderCount === 0) {
    let orderSeq = 1;
    const now = new Date();

    for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
      const day = new Date(now);
      day.setDate(day.getDate() - dayOffset);
      day.setHours(9, 0, 0, 0);

      // More orders on Fridays/weekends and today, fewer mid-week.
      const dow = day.getDay();
      const isWeekend = dow === 5 || dow === 6;
      const baseOrders = dayOffset === 0 ? 6 : isWeekend ? 5 : randInt(1, 4);

      for (let i = 0; i < baseOrders; i++) {
        const customer = pick(customers);
        const itemCount = randInt(1, 3);
        const chosenProducts = new Set<string>();
        const items = [];
        for (let j = 0; j < itemCount; j++) {
          const product = pick(products);
          if (chosenProducts.has(product.id)) continue;
          chosenProducts.add(product.id);
          const quantity = randInt(1, 3);
          const unitPrice = product.price;
          items.push({
            productId: product.id,
            productName: product.name,
            quantity,
            unitPrice,
            total: unitPrice.times(quantity),
          });
        }
        if (items.length === 0) continue;

        const subtotal = items.reduce((sum, it) => sum.add(it.total), new Prisma.Decimal(0));
        const deliveryFee = randInt(0, 1) === 1 ? 500 : 0;
        const total = subtotal.add(deliveryFee);

        const orderTime = new Date(day);
        orderTime.setHours(randInt(8, 20), randInt(0, 59), 0, 0);

        const roll = rand();
        let status: OrderStatus;
        let paymentStatus: PaymentStatus;
        if (dayOffset === 0) {
          status = roll < 0.6 ? "PAID" : roll < 0.85 ? "PENDING" : "CONFIRMED";
          paymentStatus = status === "PAID" ? "PAID" : "UNPAID";
        } else if (roll < 0.78) {
          status = "DELIVERED";
          paymentStatus = "PAID";
        } else if (roll < 0.9) {
          status = "PAID";
          paymentStatus = "PAID";
        } else if (roll < 0.96) {
          status = "CANCELLED";
          paymentStatus = "UNPAID";
        } else {
          status = "REFUNDED";
          paymentStatus = "REFUNDED";
        }

        const orderNumber = `MAMA-${String(100000 + orderSeq).slice(1)}${orderSeq}`;
        orderSeq += 1;

        const order = await prisma.order.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            orderNumber,
            source: pick<OrderSource>(["WHATSAPP", "WHATSAPP", "STOREFRONT", "DASHBOARD"]),
            status,
            paymentStatus,
            subtotal,
            deliveryFee,
            total,
            deliveryAddress: `${randInt(1, 200)} ${pick(["Allen Avenue", "Adeniran Ogunsanya St", "Opebi Rd", "Awolowo Rd", "Ikorodu Rd"])}, Lagos`,
            createdAt: orderTime,
            updatedAt: orderTime,
            items: { create: items },
          },
        });

        if (paymentStatus === "PAID") {
          await prisma.payment.create({
            data: {
              businessId: business.id,
              orderId: order.id,
              provider: "PAYSTACK",
              providerReference: `SEED-${order.orderNumber}`,
              amount: total,
              currency: "NGN",
              status: "PAID",
              verifiedAt: orderTime,
              customerPhone: customer.phone,
              createdAt: orderTime,
            },
          });

          for (const item of items) {
            await prisma.inventoryMovement.create({
              data: {
                businessId: business.id,
                productId: item.productId,
                type: "SALE",
                quantity: -item.quantity,
                orderId: order.id,
                note: `Order ${order.orderNumber}`,
                createdAt: orderTime,
              },
            });
          }
        } else if (status === "CANCELLED") {
          await prisma.payment.create({
            data: {
              businessId: business.id,
              orderId: order.id,
              provider: "PAYSTACK",
              providerReference: `SEED-FAIL-${order.orderNumber}`,
              amount: total,
              currency: "NGN",
              status: "FAILED",
              customerPhone: customer.phone,
              createdAt: orderTime,
            },
          });
        }
      }
    }
    console.log(`Created ${orderSeq - 1} seed orders.`);
  }

  // ---- Notifications --------------------------------------------------
  const lowStockProduct = products.find((p) => p.name === "Golden Penny Spaghetti");
  if (lowStockProduct) {
    const existing = await prisma.notification.findFirst({ where: { businessId: business.id, type: "LOW_STOCK" } });
    if (!existing) {
      await prisma.notification.create({
        data: {
          businessId: business.id,
          type: "LOW_STOCK",
          title: "Low stock alert",
          body: `${lowStockProduct.name} is running low — only ${lowStockProduct.stockQuantity} left.`,
        },
      });
    }
  }

  // ---- A sample marketing campaign ------------------------------------
  const existingCampaign = await prisma.campaign.findFirst({ where: { businessId: business.id } });
  if (!existingCampaign) {
    const inactiveCustomers = customers.slice(0, 4);
    await prisma.campaign.create({
      data: {
        businessId: business.id,
        name: "Win back inactive customers",
        message: "Hi 👋 We haven't seen you in a while at Mama Foodstuff. Some of your favorite products are back in stock. We'd love to serve you again!",
        segmentType: "INACTIVE",
        status: "SENT",
        sentAt: new Date(),
        recipients: {
          create: inactiveCustomers.map((c) => ({ customerId: c.id, status: "SENT" })),
        },
      },
    });
  }

  console.log("Seed complete.");
  console.log("");
  console.log("Demo merchant login: demo@mamabusiness.com / Demo12345!");
  console.log("Admin login:         admin@mamabusiness.com / Admin12345!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
