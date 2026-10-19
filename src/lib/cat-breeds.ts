export const catBreeds = [
  { id: "mail", name: "英国短毛猫", asset: "british" },
  { id: "document", name: "布偶猫", asset: "ragdoll" },
  { id: "code", name: "孟加拉猫", asset: "bengal" },
  { id: "team", name: "黑白猫", asset: "tuxedo" },
  { id: "general", name: "缅因猫", asset: "maine-coon" },
  { id: "siamese", name: "暹罗猫", asset: "siamese" },
  { id: "persian", name: "波斯猫", asset: "persian" },
  { id: "scottish-fold", name: "苏格兰折耳猫", asset: "scottish-fold" },
  { id: "sphynx", name: "斯芬克斯猫", asset: "sphynx" },
  { id: "american-shorthair", name: "美国短毛猫", asset: "american-shorthair" },
  { id: "russian-blue", name: "俄罗斯蓝猫", asset: "russian-blue" },
  { id: "abyssinian", name: "阿比西尼亚猫", asset: "abyssinian" },
  { id: "norwegian", name: "挪威森林猫", asset: "norwegian" },
  { id: "siberian", name: "西伯利亚猫", asset: "siberian" },
  { id: "birman", name: "伯曼猫", asset: "birman" },
  { id: "exotic", name: "异国短毛猫", asset: "exotic" },
  { id: "bombay", name: "孟买猫", asset: "bombay" },
  { id: "angora", name: "土耳其安哥拉猫", asset: "angora" },
  { id: "turkish-van", name: "土耳其梵猫", asset: "turkish-van" },
  { id: "devon-rex", name: "德文卷毛猫", asset: "devon-rex" },
  { id: "cornish-rex", name: "柯尼斯卷毛猫", asset: "cornish-rex" },
  { id: "somali", name: "索马里猫", asset: "somali" },
  { id: "egyptian-mau", name: "埃及猫", asset: "egyptian-mau" },
  { id: "ocicat", name: "欧西猫", asset: "ocicat" },
  { id: "burmese", name: "缅甸猫", asset: "burmese" },
  { id: "tonkinese", name: "东奇尼猫", asset: "tonkinese" },
  { id: "balinese", name: "巴厘猫", asset: "balinese" },
  { id: "american-curl", name: "美国卷耳猫", asset: "american-curl" },
  { id: "selkirk-rex", name: "塞尔凯克卷毛猫", asset: "selkirk-rex" },
  { id: "chartreux", name: "沙特尔猫", asset: "chartreux" },
] as const;

export type CatBreed = (typeof catBreeds)[number]["id"];
export type BotKind = "mail" | "document" | "code" | "team" | "general";

export function isCatBreed(value: unknown): value is CatBreed {
  return catBreeds.some((breed) => breed.id === value);
}