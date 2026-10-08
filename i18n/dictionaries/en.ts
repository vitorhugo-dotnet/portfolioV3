import type ptBR from "./pt-BR.ts";

const en = {
  "test.greeting": "Hello, {{name}}",
  "test.item.one": "{{count}} item",
  "test.item.other": "{{count}} items",
} satisfies Record<keyof typeof ptBR, string>;

export default en;
