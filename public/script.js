import { supabase } from "./supabaseClient.js";

let calendar;

// utility: formata ISO date (YYYY-MM-DD) para dd/mm/yyyy
function formatarData(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// retorna se estamos em mobile (força list view)
function isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

// fallback CSS mínimo caso main.min.css não carregue
function ensureFullCalendarCss() {
  // verifica se existe alguma regra .fc no CSSOM
  const hasFc = Array.from(document.styleSheets).some(ss => {
    try {
      return ss.href && ss.href.includes("fullcalendar") || Array.from(ss.cssRules || []).some(r => r.selectorText && r.selectorText.includes(".fc"));
    } catch (e) {
      return false;
    }
  });
  if (!hasFc) {
    const style = document.createElement("style");
    style.id = "fc-fallback-style";
    style.textContent = `
      .fc { font-family: inherit; }
      .fc .fc-daygrid-event, .fc .fc-event { background:#fdb913;color:#002855;border-radius:6px;padding:4px 6px;display:block;margin:4px 0; }
      .fc-toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    `;
    document.head.appendChild(style);
  }
}

// converte data + time local strings para ISO local sem timezone changes
function toLocalISO(dateYMD, timeHHMM) {
  // cria um Date no timezone local usando partes, evita shift de UTC
  const [y, m, d] = dateYMD.split("-").map(Number);
  const [hh, mm] = timeHHMM.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  // retorna ISO local truncado (sem Z) — FullCalendar aceita "YYYY-MM-DDTHH:MM"
  const pad = n => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

async function carregarAgendamentos() {
  // carrega do Supabase (assume colunas: data YYYY-MM-DD, inicio HH:MM:SS, fim HH:MM:SS)
  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select("*")
    .order("data", { ascending: true })
    .order("inicio", { ascending: true });

  if (error) {
    console.error("Erro ao carregar agendamentos:", error.message);
    return;
  }

  // tabela
  const tbody = document.getElementById("lista-agendamentos");
  tbody.innerHTML = "";
  agendamentos.forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${a.professora}</td>
      <td>${a.turma}</td>
      <td>${formatarData(a.data)}</td>
      <td>${a.inicio?.slice(0,5) ?? ""}</td>
      <td>${a.fim?.slice(0,5) ?? ""}</td>
    `;
    tbody.appendChild(tr);
  });

  // eventos para FullCalendar (usa ISO local sem Z para evitar shifts)
  const eventos = agendamentos.map(a => {
    const inicio = a.inicio?.slice(0,5) ?? "07:00";
    const fim = a.fim?.slice(0,5) ?? "08:00";
    return {
      title: `${a.turma} - ${a.professora}`,
      start: toLocalISO(a.data, inicio),
      end: toLocalISO(a.data, fim),
      extendedProps: { ...a }
    };
  });

  ensureFullCalendarCss();

  // init / refresh calendar
  if (!calendar) {
    const calendarEl = document.getElementById("calendar");
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: isMobile() ? "listMonth" : "dayGridMonth",
      locale: "pt-br",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: isMobile() ? "listMonth" : "dayGridMonth"
      },
      views: { listMonth: { buttonText: "Lista" } },
      buttonText: { today: "Hoje" },
      height: "auto",
      events: eventos.length ? eventos : [{
        title: "Sem agendamentos",
        start: new Date().toISOString().slice(0,10) + "T09:00",
        end: new Date().toISOString().slice(0,10) + "T09:30"
      }],
      displayEventTime: true,
      eventDisplay: "block",
      dayMaxEventRows: 3,
      moreLinkClick: "popover",
      eventClick: info => {
        abrirModal(info.event.extendedProps);
      }
    });
    calendar.render();
    window.addEventListener("resize", () => {
      const newView = isMobile() ? "listMonth" : "dayGridMonth";
      if (calendar && calendar.view.type !== newView) calendar.changeView(newView);
      calendar.updateSize();
    });
    setTimeout(() => calendar.updateSize(), 80);
  } else {
    calendar.removeAllEvents();
    calendar.addEventSource(eventos);
    calendar.updateSize();
  }
}

function abrirModal(props) {
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modal-content");
  modalContent.innerHTML = `
    <h3>📌 Detalhes do Agendamento</h3>
    <p><strong>Professora:</strong> ${props.professora}</p>
    <p><strong>Turma:</strong> ${props.turma}</p>
    <p><strong>Data:</strong> ${formatarData(props.data)}</p>
    <p><strong>Início:</strong> ${props.inicio?.slice(0,5) ?? ""}</p>
    <p><strong>Fim:</strong> ${props.fim?.slice(0,5) ?? ""}</p>
    <button id="fecharModal">Fechar</button>
  `;
  modal.style.display = "block";
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("fecharModal").onclick = () => {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  };
}

// valida e envia novo agendamento
document.getElementById("form-agendamento").addEventListener("submit", async (e) => {
  e.preventDefault();

  const professora = document.getElementById("professora").value.trim();
  const turma = document.getElementById("turma").value.trim();
  const data = document.getElementById("data").value; // YYYY-MM-DD
  const inicio = document.getElementById("inicio").value; // HH:MM
  const fim = document.getElementById("fim").value;

  if (!professora || !turma || !data || !inicio || !fim) {
    alert("Preencha todos os campos.");
    return;
  }

  // hora válida e ordem
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  const inicioTotal = hi * 60 + mi;
  const fimTotal = hf * 60 + mf;

  if (inicioTotal >= fimTotal) {
    alert("O horário de fim deve ser posterior ao horário de início.");
    return;
  }

  // intervalo permitido 07:00 - 18:00
  const minAllowed = 7 * 60;
  const maxAllowed = 18 * 60;
  if (inicioTotal < minAllowed || fimTotal > maxAllowed) {
    alert("Horário fora do período permitido (07:00 às 18:00).");
    return;
  }

  // bloqueio fim de semana
  const dt = new Date(data + "T00:00");
  const diaSemana = dt.getDay();
  if (diaSemana === 0 || diaSemana === 6) {
    alert("Não é permitido agendar aos finais de semana.");
    return;
  }

  // opcional: verifica conflito simples com agendamentos existentes (sincrono fetch)
  const { data: existentes } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("data", data);

  if (existentes && existentes.length) {
    // converte e checa overlap
    const overlap = existentes.some(x => {
      const s = parseInt((x.inicio || "00:00").slice(0,2)) * 60 + parseInt((x.inicio || "00:00").slice(3,5));
      const e = parseInt((x.fim || "00:00").slice(0,2)) * 60 + parseInt((x.fim || "00:00").slice(3,5));
      return Math.max(s, inicioTotal) < Math.min(e, fimTotal);
    });
    if (overlap) {
      if (!confirm("Já existe um agendamento conflitando nesse horário. Deseja prosseguir?")) {
        return;
      }
    }
  }

  const { error } = await supabase
    .from("agendamentos")
    .insert([{ professora, turma, data, inicio: inicio + ":00", fim: fim + ":00" }]);

  if (error) {
    alert("Erro ao salvar: " + error.message);
    return;
  }

  document.getElementById("form-agendamento").reset();
  await carregarAgendamentos();
});

// inicializa
await carregarAgendamentos();