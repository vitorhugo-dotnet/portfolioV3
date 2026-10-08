import assert from "node:assert/strict";
import { test } from "node:test";
import en from "../i18n/dictionaries/en.ts";
import ptBR from "../i18n/dictionaries/pt-BR.ts";
import {
  formatDate,
  formatDuration,
  formatNumber,
  formatRelativeTime,
  translate,
  translatePlural,
} from "../i18n/translate.ts";

test("dictionaries have the same keys", () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ptBR).sort());
});

test("translate interpolates named values", () => {
  assert.equal(translate("en", "test.greeting", { name: "Hugo" }), "Hello, Hugo");
  assert.equal(translate("pt-BR", "test.greeting", { name: "Hugo" }), "Olá, Hugo");
});

test("translate uses locale plural rules for count messages", () => {
  assert.equal(
    translatePlural("en", "test.item.one", "test.item.other", 1, { count: 1 }),
    "1 item",
  );
  assert.equal(
    translatePlural("en", "test.item.one", "test.item.other", 2, { count: 2 }),
    "2 items",
  );
  assert.equal(
    translatePlural("pt-BR", "test.item.one", "test.item.other", 2, { count: 2 }),
    "2 itens",
  );
});

test("formatters follow each locale", () => {
  const date = new Date("2025-12-31T12:00:00.000Z");
  assert.equal(formatDate("pt-BR", date), "31/12/2025");
  assert.equal(formatDate("en", date), "12/31/2025");
  assert.equal(formatNumber("pt-BR", 123456.789), "123.456,789");
  assert.equal(formatNumber("en", 123456.789), "123,456.789");
  assert.equal(formatDuration("pt-BR", 90), "1 h 30 min");
  assert.equal(formatDuration("en", 90), "1 hr 30 min");
  const now = Date.parse("2025-01-02T12:00:00.000Z");
  const yesterday = Date.parse("2025-01-01T12:00:00.000Z");
  assert.equal(formatRelativeTime("pt-BR", yesterday, now), "há 1 dia");
  assert.equal(formatRelativeTime("en", yesterday, now), "1 day ago");
});
