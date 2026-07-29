export type Employee = {
  id: number;
  name: string;
  cpf: string;
  role: string;
  site: string;
  phone: string;
  status: "Ativo" | "Inativo";
  matricula?: string;
  email?: string;
  cargoId?: number;
};

export type Journey = {
  id: number;
  employee: string;
  date: string;
  start: string;
  lunch: string;
  return: string;
  end: string;
  total: string;
  status: "Regular" | "Atenção" | "Pendente";
  site: string;
};

export const employees: Employee[] = [
  { id: 1, name: "Ana Carolina Lima", cpf: "123.456.789-09", role: "Engenheira Civil", site: "Residencial Aurora", phone: "(11) 98765-4321", status: "Ativo" },
  { id: 2, name: "Bruno Rodrigues", cpf: "987.654.321-00", role: "Mestre de Obras", site: "Residencial Aurora", phone: "(11) 97654-3210", status: "Ativo" },
  { id: 3, name: "Carlos Eduardo Silva", cpf: "456.789.123-12", role: "Pedreiro", site: "Edifício Horizonte", phone: "(11) 96543-2109", status: "Ativo" },
  { id: 4, name: "Daniela Martins", cpf: "321.654.987-00", role: "Técnica de Segurança", site: "Residencial Aurora", phone: "(11) 95432-1098", status: "Ativo" },
  { id: 5, name: "Eduardo Souza", cpf: "789.123.456-44", role: "Eletricista", site: "Edifício Horizonte", phone: "(11) 94321-0987", status: "Inativo" },
  { id: 6, name: "Fernanda Alves", cpf: "654.987.321-11", role: "Arquiteta", site: "Parque Industrial Toth", phone: "(11) 93210-9876", status: "Ativo" },
];

export const journeys: Journey[] = [
  { id: 101, employee: "Ana Carolina Lima", date: "12/06/2026", start: "07:58", lunch: "12:02", return: "13:01", end: "17:06", total: "08h09", status: "Regular", site: "Residencial Aurora" },
  { id: 102, employee: "Bruno Rodrigues", date: "12/06/2026", start: "07:44", lunch: "12:00", return: "13:04", end: "--:--", total: "05h20", status: "Atenção", site: "Residencial Aurora" },
  { id: 103, employee: "Carlos Eduardo Silva", date: "12/06/2026", start: "08:22", lunch: "12:07", return: "13:03", end: "17:10", total: "07h52", status: "Atenção", site: "Edifício Horizonte" },
  { id: 104, employee: "Daniela Martins", date: "12/06/2026", start: "07:55", lunch: "12:01", return: "13:00", end: "17:02", total: "08h08", status: "Regular", site: "Residencial Aurora" },
  { id: 105, employee: "Eduardo Souza", date: "11/06/2026", start: "08:03", lunch: "--:--", return: "--:--", end: "17:01", total: "08h58", status: "Pendente", site: "Edifício Horizonte" },
  { id: 106, employee: "Fernanda Alves", date: "11/06/2026", start: "07:59", lunch: "12:00", return: "13:00", end: "17:04", total: "08h05", status: "Regular", site: "Parque Industrial Toth" },
];

export const sites = [
  { id: 1, name: "Residencial Aurora", address: "Av. das Palmeiras, 840", employees: 28, progress: 68, status: "Em andamento" },
  { id: 2, name: "Edifício Horizonte", address: "Rua das Acácias, 115", employees: 19, progress: 42, status: "Em andamento" },
  { id: 3, name: "Parque Industrial Toth", address: "Rod. Castelo Branco, km 32", employees: 34, progress: 91, status: "Finalização" },
];

export const roles = [
  { name: "Pedreiro", employees: 22, schedule: "08:00 - 17:00" },
  { name: "Eletricista", employees: 8, schedule: "08:00 - 17:00" },
  { name: "Mestre de Obras", employees: 4, schedule: "07:30 - 17:00" },
  { name: "Técnico de Segurança", employees: 5, schedule: "08:00 - 17:00" },
  { name: "Engenheiro Civil", employees: 6, schedule: "08:00 - 18:00" },
];
