import { describe, expect, it } from "vitest";
import { formatCpf, formatDate } from "./formatters";

describe("formatters", () => {
  it("mantém CPF como string e aplica máscara", () => {
    expect(formatCpf("01234567890")).toBe("012.345.678-90");
  });

  it("formata a data do formulário", () => {
    expect(formatDate("2026-05-04")).toBe("04/05/2026");
  });
});
