import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const page = await readFile(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const renderedCopy = page
  .replace(/\{" "\}/g, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/\s+/g, " ");

test("places the professional introduction before products with the requested copy", () => {
  const hero = page.indexOf("<HeroScene");
  const professional = page.indexOf('id="sobre"');
  const products = page.indexOf('id="produtos"');

  assert.ok(hero >= 0 && hero < professional && professional < products);
  assert.ok(
    renderedCopy.includes(
      "Sou desenvolvedor Full Stack com mais de 2 anos de experiência, especializado em Java, Spring Boot, C#/.NET e React.",
    ),
  );
  assert.ok(
    renderedCopy.includes(
      "Atuo no desenvolvimento de sistemas públicos de Saúde e Financeiro, trabalhando com aplicações críticas, APIs, integração de sistemas, otimização de bancos de dados e arquiteturas offline-first.",
    ),
  );
  assert.ok(
    renderedCopy.includes(
      "Além da experiência profissional, desenvolvo produtos próprios e exploro arquiteturas distribuídas, comunicação em tempo real, automações, DevOps e observabilidade. Meu foco é construir soluções eficientes, confiáveis e sustentáveis, da arquitetura à produção.",
    ),
  );
});

test("keeps the personal section and its interests under the new anchor", () => {
  assert.ok(page.includes('<section className="about" id="alem-do-codigo">'));
  assert.ok(page.includes("JAPÃO & ANIME"));
  assert.ok(page.includes("GAMES & NARRATIVAS"));
  assert.ok(page.includes("ASTRONOMIA & FÍSICA"));
  assert.ok(page.includes("CAMUS & NIETZSCHE"));
});
