import assert from "node:assert";
import test from "node:test";
import { parseDescriptionTokens } from "./src/utils/descriptionUtils.ts";

test("1. A normal https:// URL becomes clickable (extracted as link token)", () => {
  const text = "Check out the official site at https://hackathon.example.com for registration.";
  const tokens = parseDescriptionTokens(text);
  
  const linkToken = tokens.find((t) => t.type === "link");
  assert.ok(linkToken, "Should produce a link token");
  assert.strictEqual(linkToken.url, "https://hackathon.example.com");
  assert.strictEqual(linkToken.text, "https://hackathon.example.com");
});

test("2. An http:// URL becomes clickable if supported", () => {
  const text = "Legacy docs at http://insecure.example.org/guide before update.";
  const tokens = parseDescriptionTokens(text);
  
  const linkToken = tokens.find((t) => t.type === "link");
  assert.ok(linkToken, "Should produce a link token for http://");
  assert.strictEqual(linkToken.url, "http://insecure.example.org/guide");
});

test("3. Multiple URLs are handled in one description", () => {
  const text = "Register at https://reg.event.com and join discord at https://discord.gg/invite123 or check http://info.org.";
  const tokens = parseDescriptionTokens(text);
  
  const linkTokens = tokens.filter((t) => t.type === "link");
  assert.strictEqual(linkTokens.length, 3);
  assert.strictEqual(linkTokens[0].url, "https://reg.event.com");
  assert.strictEqual(linkTokens[1].url, "https://discord.gg/invite123");
  assert.strictEqual(linkTokens[2].url, "http://info.org");
});

test("4. Normal text remains normal text (no arbitrary periods turned into links)", () => {
  const text = "Release version 2.0 is out! E.g. python 3.11. No links here. Dr. Smith will speak.";
  const tokens = parseDescriptionTokens(text);
  
  const linkTokens = tokens.filter((t) => t.type === "link");
  assert.strictEqual(linkTokens.length, 0, "No plain text with periods should become links");
  
  const joined = tokens.map((t) => t.content).join("");
  assert.strictEqual(joined, text);
});

test("5. Punctuation around URLs does not become part of the URL", () => {
  const text = "Visit (https://example.com/portal)! Also check https://example.com/docs, or https://example.com/end.";
  const tokens = parseDescriptionTokens(text);
  
  const linkTokens = tokens.filter((t) => t.type === "link");
  assert.strictEqual(linkTokens.length, 3);
  assert.strictEqual(linkTokens[0].url, "https://example.com/portal");
  assert.strictEqual(linkTokens[1].url, "https://example.com/docs");
  assert.strictEqual(linkTokens[2].url, "https://example.com/end");

  // Verify surrounding punctuation is preserved in text tokens
  const fullText = tokens.map((t) => t.content || t.text).join("");
  assert.ok(fullText.includes("(https://example.com/portal)!"));
  assert.ok(fullText.includes("https://example.com/docs,"));
  assert.ok(fullText.includes("https://example.com/end."));
});

test("6. Markdown links [Anchor](https://...) are parsed cleanly", () => {
  const text = "Read the [Official Guidelines](https://guidelines.dev) before submission.";
  const tokens = parseDescriptionTokens(text);
  
  const linkTokens = tokens.filter((t) => t.type === "link");
  assert.strictEqual(linkTokens.length, 1);
  assert.strictEqual(linkTokens[0].url, "https://guidelines.dev");
  assert.strictEqual(linkTokens[0].text, "Official Guidelines");
});

test("7. Events with no URLs or null render fallback or original text cleanly", () => {
  assert.deepStrictEqual(parseDescriptionTokens(null), []);
  assert.deepStrictEqual(parseDescriptionTokens(""), []);
  
  const plainText = "A completely plain description with no links.";
  const tokens = parseDescriptionTokens(plainText);
  assert.strictEqual(tokens.length, 1);
  assert.strictEqual(tokens[0].type, "text");
  assert.strictEqual(tokens[0].content, plainText);
});

test("8. URLs across separate lines and mixed formatting", () => {
  const multiline = "Line 1: https://first.org\nLine 2: https://second.org\nLine 3: finished.";
  const tokens = parseDescriptionTokens(multiline);
  const linkTokens = tokens.filter((t) => t.type === "link");
  assert.strictEqual(linkTokens.length, 2);
  assert.strictEqual(linkTokens[0].url, "https://first.org");
  assert.strictEqual(linkTokens[1].url, "https://second.org");
});
