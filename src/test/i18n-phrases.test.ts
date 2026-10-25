import { afterEach, describe, expect, it } from "vitest";
import { _setLangForTest, tz } from "@/lib/i18n";

describe("tz phrase translation", () => {
  afterEach(() => _setLangForTest("zh"));
  it("keeps Chinese for Chinese users", () => {
    _setLangForTest("zh");
    expect(tz("工具与连接")).toBe("工具与连接");
  });
  it("returns English for English users", () => {
    _setLangForTest("en");
    expect(tz("工具与连接")).toBe("Tools & Connections");
  });
  it("fills placeholders", () => {
    _setLangForTest("en");
    expect(tz("已连接 {0}", "Slack")).toBe("Slack connected");
  });
  it("falls back to Chinese for unknown phrases", () => {
    _setLangForTest("en");
    expect(tz("未收录短语")).toBe("未收录短语");
  });
});
