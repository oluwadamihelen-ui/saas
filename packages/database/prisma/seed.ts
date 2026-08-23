import { PrismaClient, ProviderCapability, OptimizationMode, QueuePriority } from "@prisma/client";
import { hashPassword } from "@cinerra/config";

const prisma = new PrismaClient();

/**
 * Plan catalog. These are sensible starting defaults — every field here is
 * editable from the admin dashboard afterwards (spec §42, §80). Nothing in
 * application code hard-codes these values; they are only ever read from
 * the Plan table.
 */
async function seedPlans() {
  const plans = [
    {
      key: "free",
      name: "Free",
      description: "Try Cinerra with limited access.",
      priceMonthlyCents: 0,
      priceYearlyCents: 0,
      maxConcurrentGenerations: 1,
      queuePriority: QueuePriority.LOW,
      maxExportResolution: "720p",
      maxStorageGB: 2,
      maxProjectDurationMinutes: 5,
      seats: 1,
      sortOrder: 0,
    },
    {
      key: "creator",
      name: "Creator",
      description: "Unlimited AI movie creation, subject to fair use.",
      priceMonthlyCents: 2900,
      priceYearlyCents: 29000,
      maxConcurrentGenerations: 1,
      queuePriority: QueuePriority.NORMAL,
      maxExportResolution: "1080p",
      maxStorageGB: 50,
      maxProjectDurationMinutes: 30,
      seats: 1,
      sortOrder: 1,
    },
    {
      key: "pro",
      name: "Pro",
      description: "Higher priority queue, higher resolution, more concurrent jobs.",
      priceMonthlyCents: 7900,
      priceYearlyCents: 79000,
      maxConcurrentGenerations: 3,
      queuePriority: QueuePriority.HIGH,
      maxExportResolution: "1080p",
      maxStorageGB: 250,
      maxProjectDurationMinutes: 60,
      seats: 1,
      sortOrder: 2,
    },
    {
      key: "studio",
      name: "Studio",
      description: "Unlimited creation, highest priority, team collaboration.",
      priceMonthlyCents: 19900,
      priceYearlyCents: 199000,
      maxConcurrentGenerations: 10,
      queuePriority: QueuePriority.HIGHEST,
      maxExportResolution: "4K",
      maxStorageGB: 1000,
      maxProjectDurationMinutes: 240,
      seats: 5,
      sortOrder: 3,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      create: plan,
      update: plan,
    });
  }
  console.log(`Seeded ${plans.length} plans.`);
}

/**
 * Coin economy defaults: the single PlatformSettings row (revenue split,
 * settlement period, suggested price ranges — all admin-editable
 * afterwards, never hard-coded elsewhere) and a starter set of purchasable
 * coin packages. Prices here are only sensible starting defaults, not a
 * business decision baked into the code.
 */
async function seedMonetization() {
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  // The platform's own ledger account (double-entry symmetry — see
  // apps/web/src/lib/wallet.ts's getPlatformUserId). Not a real login.
  await prisma.user.upsert({
    where: { email: "platform@cinerra.internal" },
    update: {},
    create: { email: "platform@cinerra.internal", name: "Cinerra Platform", status: "ACTIVE" },
  });

  const packages = [
    { coins: 100, bonusCoins: 0, priceCents: 199, sortOrder: 0 },
    { coins: 500, bonusCoins: 25, priceCents: 799, sortOrder: 1 },
    { coins: 1200, bonusCoins: 100, priceCents: 1499, sortOrder: 2 },
    { coins: 2500, bonusCoins: 300, priceCents: 2999, sortOrder: 3 },
    { coins: 5500, bonusCoins: 750, priceCents: 5999, sortOrder: 4 },
  ];

  for (const pkg of packages) {
    const existing = await prisma.coinPackage.findFirst({ where: { coins: pkg.coins, priceCents: pkg.priceCents } });
    if (!existing) await prisma.coinPackage.create({ data: pkg });
  }

  console.log("Seeded platform settings and coin packages.");
}

/**
 * Model routing table. Rows describe *which* provider/model serves each
 * capability under each optimization mode — the router (packages/ai)
 * never hard-codes a provider. Whether a provider actually works at
 * runtime depends on its API key being present (packages/config); an
 * unconfigured provider fails honestly rather than faking output.
 */
async function seedAiModels() {
  const models = [
    {
      provider: "anthropic",
      modelId: "claude-sonnet-5",
      capability: ProviderCapability.TEXT,
      optimizationModes: [OptimizationMode.BEST_QUALITY, OptimizationMode.BALANCED],
      priority: 0,
      costUnit: "per_1k_tokens",
    },
    {
      provider: "anthropic",
      modelId: "claude-haiku-4-5-20251001",
      capability: ProviderCapability.TEXT,
      optimizationModes: [OptimizationMode.FASTEST],
      priority: 0,
      costUnit: "per_1k_tokens",
    },
    {
      provider: "openai",
      modelId: "gpt-image-1",
      capability: ProviderCapability.IMAGE,
      optimizationModes: [OptimizationMode.BEST_QUALITY, OptimizationMode.BALANCED, OptimizationMode.FASTEST],
      priority: 0,
      costUnit: "per_image",
    },
    {
      provider: "runway",
      modelId: "gen4_turbo",
      capability: ProviderCapability.IMAGE_TO_VIDEO,
      optimizationModes: [OptimizationMode.BEST_QUALITY, OptimizationMode.BALANCED, OptimizationMode.FASTEST],
      priority: 0,
      costUnit: "per_second",
    },
    {
      provider: "elevenlabs",
      modelId: "eleven_multilingual_v2",
      capability: ProviderCapability.VOICE,
      optimizationModes: [OptimizationMode.BEST_QUALITY, OptimizationMode.BALANCED, OptimizationMode.FASTEST],
      priority: 0,
      costUnit: "per_1k_chars",
    },
  ];

  for (const model of models) {
    await prisma.aiModel.upsert({
      where: { provider_modelId_capability: { provider: model.provider, modelId: model.modelId, capability: model.capability } },
      create: model,
      update: model,
    });
  }
  console.log(`Seeded ${models.length} AI model routes.`);
}

/**
 * Development-only demo project. Never referenced by production application
 * logic — purely so a fresh `pnpm db:seed` gives you something to click
 * through in the UI (spec §86).
 */
async function seedDemoProject() {
  if (process.env.NODE_ENV === "production") {
    console.log("Skipping demo project seed in production.");
    return;
  }

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@cinerra.app" },
    create: {
      email: "demo@cinerra.app",
      name: "Demo Creator",
      passwordHash: hashPassword("demo-password-1234"),
      emailVerifiedAt: new Date(),
    },
    update: {},
  });

  const creatorPlan = await prisma.plan.findUniqueOrThrow({ where: { key: "creator" } });
  await prisma.subscription.upsert({
    where: { userId: demoUser.id },
    create: {
      userId: demoUser.id,
      planId: creatorPlan.id,
      status: "ACTIVE",
      interval: "MONTH",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {},
  });

  const existing = await prisma.project.findFirst({ where: { title: "The Secret Between Us", ownerId: demoUser.id } });
  if (existing) {
    console.log("Demo project already seeded.");
    return;
  }

  const project = await prisma.project.create({
    data: {
      ownerId: demoUser.id,
      title: "The Secret Between Us",
      mode: "INSPIRATION",
      format: "MINI_SERIES",
      episodeCount: 5,
      aspectRatio: "PORTRAIT_9_16",
      visualStyle: "CINEMATIC_DRAMA",
      status: "DRAFT",
      visibility: "PRIVATE",
      storyBible: {
        create: {
          logline: "An ambitious woman discovers her wealthy husband has been secretly living a double life — and that unraveling it may cost her everything she built.",
          genres: ["Drama", "Mystery", "Psychological"],
          tones: ["Suspenseful", "Emotional", "Cinematic"],
          premise:
            "Maren Cole has spent a decade building a career and a marriage she believed was solid. When a stranger appears at her husband's funeral claiming to be his wife, Maren must uncover which parts of her life were ever real.",
          theme: "The cost of the life we choose not to see.",
          world: "Contemporary upper-class suburban America, told through the contrast between the polished Cole household and the working-class world Maren left behind.",
          setting: "A lakeside suburb outside Chicago, present day.",
          targetAudience: "Adults 25-54 who enjoy psychological drama and mystery series.",
          status: "READY",
        },
      },
    },
    include: { storyBible: true },
  });

  const maren = await prisma.character.create({
    data: {
      projectId: project.id,
      code: "CHAR-MAR-01",
      name: "Maren Cole",
      age: 36,
      face: "warm brown eyes, defined cheekbones, natural low bun",
      hair: "dark brown, tight low bun",
      eyes: "hazel-brown",
      skin: "warm olive, natural texture",
      height: "5'7\"",
      build: "lean, athletic",
      personality: "controlled, fiercely intelligent, guarded",
      voiceProfile: "female, calm, authoritative, low register",
      characterArc: "From composed outsider to a woman who reclaims the truth on her own terms.",
      continuityRules: "Must retain facial identity and low-bun hairstyle across all scenes unless the script explicitly calls for a change.",
      isLocked: true,
      lockedAt: new Date(),
    },
  });

  const nate = await prisma.character.create({
    data: {
      projectId: project.id,
      code: "CHAR-NAT-01",
      name: "Nate Cole",
      age: 41,
      face: "square jaw, salt-and-pepper stubble",
      hair: "short, dark, greying at temples",
      eyes: "grey-blue",
      build: "broad, tall",
      personality: "charming, evasive, compartmentalized",
      voiceProfile: "male, warm, persuasive baritone",
      characterArc: "Revealed in flashback only — the absent center of the mystery.",
      isLocked: true,
      lockedAt: new Date(),
    },
  });

  const coleHouseExterior = await prisma.location.create({
    data: {
      projectId: project.id,
      code: "LOC-COLE-01",
      name: "Cole House Exterior",
      architecture: "Modern lakeside colonial, grey stone and cedar siding",
      lighting: "golden hour, warm practicals visible through windows at dusk",
      colorPalette: "slate grey, warm amber, deep green foliage",
      isLocked: true,
    },
  });

  const coleHouseKitchen = await prisma.location.create({
    data: {
      projectId: project.id,
      code: "LOC-COLE-02",
      name: "Cole House Kitchen",
      architecture: "Open-plan chef's kitchen, marble island, large window over sink",
      lighting: "warm overhead pendant lights, blue dusk light through window",
      colorPalette: "white marble, brushed brass, deep navy cabinetry",
      furniture: "marble island, brass barstools, farmhouse sink",
      isLocked: true,
    },
  });

  const marenKitchenWardrobe = await prisma.wardrobe.create({
    data: {
      projectId: project.id,
      characterId: maren.id,
      code: "WARD-MAR-02",
      name: "Maren home wardrobe",
      clothing: "cream cashmere sweater, tailored dark jeans",
      colors: "cream, charcoal",
      shoes: "bare feet / house slippers",
      continuityNotes: "Worn in all Cole House domestic scenes in Episode 1.",
      isLocked: true,
    },
  });

  const marenPhone = await prisma.prop.create({
    data: {
      projectId: project.id,
      ownerCharacterId: maren.id,
      code: "PROP-PHONE-MAR-01",
      name: "Maren's smartphone",
      description: "Matte black phone, cracked top-right corner of the case.",
      continuityNotes: "Crack must remain visible in every close-up of the phone.",
      isLocked: true,
    },
  });

  const episode1 = await prisma.episode.create({
    data: {
      projectId: project.id,
      number: 1,
      title: "The Woman at the Funeral",
      synopsis: "Maren buries her husband and meets a stranger who unravels everything she thought she knew.",
      status: "DRAFT",
    },
  });

  const scene3 = await prisma.scene.create({
    data: {
      projectId: project.id,
      episodeId: episode1.id,
      number: 3,
      intExt: "INT",
      locationId: coleHouseKitchen.id,
      timeOfDay: "EVENING",
      storyPurpose: "Establish Maren and Nate's domestic normalcy before it fractures.",
      emotionalState: "warm but emotionally tense",
      scriptText:
        "INT. COLE HOUSE - KITCHEN - EVENING\n\nMaren chops vegetables at the island. Nate enters, loosening his tie.\n\nNATE\nYou're not going to believe the day I had.\n\nMAREN\n(not looking up)\nTry me.",
      characters: {
        create: [{ characterId: maren.id, wardrobeId: marenKitchenWardrobe.id }, { characterId: nate.id }],
      },
      props: { create: [{ propId: marenPhone.id }] },
    },
  });

  await prisma.shot.create({
    data: {
      code: "SC03-SH001",
      sceneId: scene3.id,
      order: 1,
      shotType: "WIDE",
      cameraMovement: "LOCKED_OFF",
      lens: "24mm",
      framing: "Wide establishing shot of the kitchen, both characters visible",
      action: "Maren chops vegetables; Nate enters from the hallway.",
      emotion: "warm, domestic calm",
      durationSeconds: 6,
      status: "PENDING",
      characters: { create: [{ characterId: maren.id }, { characterId: nate.id }] },
      wardrobes: { create: [{ wardrobeId: marenKitchenWardrobe.id }] },
    },
  });

  await prisma.shot.create({
    data: {
      code: "SC03-SH002",
      sceneId: scene3.id,
      order: 2,
      shotType: "MEDIUM_CLOSE_UP",
      cameraMovement: "PUSH_IN",
      lens: "50mm",
      framing: "Medium close-up on Nate as he speaks",
      action: "Nate loosens his tie, leans against the island.",
      dialogue: "You're not going to believe the day I had.",
      emotion: "restrained excitement",
      durationSeconds: 4,
      status: "PENDING",
      characters: { create: [{ characterId: nate.id }] },
    },
  });

  console.log(`Seeded demo project "${project.title}" (${project.id}) for ${demoUser.email}.`);
  console.log(`Locked continuity: ${maren.name}, ${nate.name}, ${coleHouseExterior.name}, ${coleHouseKitchen.name}, ${marenKitchenWardrobe.name}, ${marenPhone.name}.`);
}

async function main() {
  await seedPlans();
  await seedMonetization();
  await seedAiModels();
  await seedDemoProject();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
