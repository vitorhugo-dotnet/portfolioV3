import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const page = await readFile(
  new URL("../components/portfolio-page.tsx", import.meta.url),
  "utf8",
);
const portuguese = await readFile(
  new URL("../i18n/dictionaries/pt-BR.ts", import.meta.url),
  "utf8",
);

test("places the professional introduction before products with the requested copy", () => {
  const hero = page.indexOf("<HeroScene");
  const professional = page.indexOf('id="sobre"');
  const products = page.indexOf('id="produtos"');

  assert.ok(hero >= 0 && hero < professional && professional < products);
  assert.ok(page.includes('t("professional.paragraph.one")'));
  assert.ok(page.includes('t("professional.paragraph.two")'));
  assert.ok(page.includes('t("professional.paragraph.three")'));
  assert.ok(
    portuguese.includes(
      "Sou desenvolvedor Full Stack com mais de 2 anos de experiência",
    ),
  );
  assert.ok(portuguese.includes("sistemas públicos de Saúde e Financeiro"));
  assert.ok(
    portuguese.includes(
      "Além da experiência profissional, desenvolvo produtos próprios",
    ),
  );
});

test("keeps the personal section and its interests under the new anchor", () => {
  assert.ok(page.includes('<section className="about" id="alem-do-codigo">'));
  assert.ok(portuguese.includes("JAPÃO & ANIME"));
  assert.ok(portuguese.includes("GAMES & NARRATIVAS"));
  assert.ok(portuguese.includes("ASTRONOMIA & FÍSICA"));
  assert.ok(portuguese.includes("CAMUS & NIETZSCHE"));
});
