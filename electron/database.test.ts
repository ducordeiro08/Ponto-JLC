import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TothDatabase } from "./database";

describe("TothDatabase", () => {
  let database: TothDatabase | undefined;

  beforeEach(() => {
    database = new TothDatabase(":memory:");
  });

  afterEach(() => {
    database.close();
  });

  it("cria sessão apenas para CPF cadastrado e obra ativa", () => {
    const session = database!.createSession("123.456.789-09", "worksite-butanta");
    expect(session.employee.name).toBe("Pedro Almeida");
    expect(session.worksite.name).toBe("Butantã");
    expect(() => database!.createSession("00000000000", "worksite-butanta")).toThrow("Funcionário não localizado");
  });

  it("agrupa registros no formulário diário e alerta duplicidade", () => {
    const input = { employeeId: "employee-pedro", cpf: "12345678909", worksiteId: "worksite-butanta" };
    expect(database!.createTimeEntry(input).kind).toBe("created");
    expect(database!.createTimeEntry(input).kind).toBe("duplicate");
    expect(database!.createTimeEntry({ ...input, allowDuplicate: true }).kind).toBe("created");

    const forms = database!.listForms(input.cpf);
    expect(forms).toHaveLength(1);
    expect(forms[0].entries).toHaveLength(2);
    expect(forms[0].status).toBe("incompleto");
  });

  it("completa o formulário com quatro registros e bloqueia o quinto", () => {
    const input = { employeeId: "employee-pedro", cpf: "12345678909", worksiteId: "worksite-pinheiros", allowDuplicate: true };
    for (let index = 0; index < 4; index += 1) database!.createTimeEntry(input);

    expect(database!.listForms(input.cpf)[0].status).toBe("completo");
    expect(() => database!.createTimeEntry(input)).toThrow("quatro registros permitidos");
  });
});
