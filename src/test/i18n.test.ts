import { describe, expect, it } from "vitest";
import { detectLang } from "@/lib/i18n";

describe("detectLang", () => {
  it("saved choice wins over browser language", () => expect(detectLang("zh", "en-GB")).toBe("zh"));
  it("Chinese browsers get Chinese", () => expect(detectLang(null, "zh-CN")).toBe("zh"));
  it("other browsers get English", () => expect(detectLang(null, "fr-FR")).toBe("en"));
});
