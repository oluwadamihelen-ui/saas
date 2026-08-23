import { describe, expect, it } from "vitest";
import { welcomeEmail, passwordResetEmail, exportReadyEmail, exportFailedEmail, organizationInviteEmail } from "./templates.js";

describe("email templates", () => {
  it("welcomeEmail includes the create-project link in both html and text", () => {
    const { html, text, subject } = welcomeEmail("Ada", "https://example.com/projects/new");
    expect(subject).toContain("Welcome");
    expect(html).toContain("https://example.com/projects/new");
    expect(text).toContain("https://example.com/projects/new");
    expect(html).toContain("Ada");
  });

  it("welcomeEmail falls back gracefully when name is empty", () => {
    const { html } = welcomeEmail("", "https://example.com/projects/new");
    expect(html).toContain("Hi there");
  });

  it("passwordResetEmail includes the reset link and an expiry notice", () => {
    const { html, text } = passwordResetEmail("https://example.com/reset-password?token=abc");
    expect(html).toContain("https://example.com/reset-password?token=abc");
    expect(text).toContain("https://example.com/reset-password?token=abc");
    expect(html.toLowerCase()).toContain("1 hour");
  });

  it("exportReadyEmail names the episode and project", () => {
    const { subject, html } = exportReadyEmail({
      projectTitle: "The Last Horizon",
      episodeTitle: "Episode 1",
      projectUrl: "https://example.com/projects/p1",
    });
    expect(subject).toContain("Episode 1");
    expect(html).toContain("The Last Horizon");
    expect(html).toContain("https://example.com/projects/p1");
  });

  it("exportFailedEmail surfaces the error message", () => {
    const { html, text } = exportFailedEmail({
      projectTitle: "The Last Horizon",
      episodeTitle: "Episode 1",
      errorMessage: "FFmpeg failed while processing the video.",
      projectUrl: "https://example.com/projects/p1",
    });
    expect(html).toContain("FFmpeg failed while processing the video.");
    expect(text).toContain("FFmpeg failed while processing the video.");
  });

  it("organizationInviteEmail names the inviter and organization, and includes the accept link", () => {
    const { subject, html, text } = organizationInviteEmail({
      organizationName: "Horizon Pictures",
      inviterName: "Ada",
      acceptUrl: "https://example.com/studio/invite?token=abc",
    });
    expect(subject).toContain("Horizon Pictures");
    expect(html).toContain("Ada");
    expect(html).toContain("Horizon Pictures");
    expect(html).toContain("https://example.com/studio/invite?token=abc");
    expect(text).toContain("https://example.com/studio/invite?token=abc");
  });
});
