import "server-only";

/**
 * Shared with the Mama AI `generate_marketing_message` tool so a campaign
 * drafted from the Marketing page and one drafted through AI chat use the
 * exact same template logic.
 */
export function draftMarketingMessage(businessName: string, segmentLabel: string, occasion?: string) {
  if (occasion) {
    return `Hi! 🎉 ${occasion} — ${businessName} has something special for you. Reply to this message or visit our store to shop now!`;
  }
  if (segmentLabel === "VIP") {
    return `Hi 👑 As one of our most valued customers, we wanted to say thank you — enjoy priority service on your next order at ${businessName}.`;
  }
  if (segmentLabel === "INACTIVE") {
    return `Hi 👋 We haven't seen you in a while at ${businessName}. Some of your favorite products are back in stock. We'd love to serve you again!`;
  }
  if (segmentLabel === "NEW") {
    return `Welcome to ${businessName}! 🎉 Thanks for your first order — let us know if there's anything you need.`;
  }
  return `Hi! 👋 ${businessName} has new arrivals and great prices this week. Come take a look!`;
}
