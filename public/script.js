import { supabase } from "./supabaseClient.js";

let calendar;

function formatarData(iso) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function carregarAgendamentos() {
  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select("*")
    .order("data", { ascending: true })
    .order("inicio", { ascending: true });

  if (error) {
    console.error("Erro ao carregar agendamentos:", error.message);
    return;
  }

  const tbody = document.getElementById("lista-agendamentos");
  tbody.innerHTML = "";

  agendamentos.forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${a.professora}</td>
      <td>${a.turma}</td>
      <td>${formatarData(a.data)}</td>
      <td>${a.inicio}</td>
      <td>${a.fim}</td>
    `;
    tbody.appendChild(tr);
  });

  const eventos = agendamentos.map(a => {
    const inicio = a.inicio?.slice(0,5) ?? a.inicio;
    const fim = a.fim?.slice(0,5) ?? a.fim;

    return {
      title: `${a.turma} - ${a.professora}`,
      start: `${a.data}T${inicio}`,
      end: `${a.data}T${fim}`,
      extendedProps: {
        professora: a.professora,
        turma: a.turma,
        data: a.data,
        inicio: a.inicio,
        fim: a.fim
      }
    };
  });

  console.log("Eventos para o calendário:", eventos);

  if (!calendar) {
    const calendarEl = document.getElementById("calendar");
    const dayGridPlugin = FullCalendar.dayGridPlugin || FullCalendar.DayGrid;
    const interactionPlugin = FullCalendar.interactionPlugin || FullCalendar.Interaction;

    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "pt-br",
      buttonText: { today: "Hoje" },
      plugins: [dayGridPlugin, interactionPlugin].filter(Boolean),
      events: eventos,
      displayEventTime: true,
      eventDisplay: "block",
      height: "auto",
      eventClick: function(info) {
        const props = info.event.extendedProps;
        abrirModal(props);
      }
    });

    calendar.render();
    window.addEventListener("resize", () => calendar.updateSize());
    setTimeout(() => calendar.updateSize(), 50);
  } else {
    calendar.removeAllEventSources();
    calendar.removeAllEvents();
    calendar.addEventSource(eventos);
    calendar.updateSize();
  }
}

document.getElementById("form-agendamento").addEventListener("submit", async (e) => {
  e.preventDefault();

  const professora = document.getElementById("professora").value.trim();
  const turma = document.getElementById("turma").value.trim();
  const data = document.getElementById("data").value;
  const inicio = document.getElementById("inicio").value;
  const fim = document.getElementById("fim").value;

  // Validação de horário
  const horaInicio = parseInt(inicio.split(":")[0]);
  const horaFim = parseInt(fim.split(":")[0]);

  if (horaInicio < 7 || horaInicio > 18 || horaFim < 7 || horaFim > 18) {
    alert("Horário fora do período permitido (07:00 às 18:00).");
    return;
  }

  // Validação de dia da semana
  const diaSemana = new Date(data).getDay(); // 0 = domingo, 6 = sábado
  if (diaSemana === 0 || diaSemana === 6) {
    alert("Não é permitido agendar aos finais de semana.");
    return;
  }

  const { error } = await supabase
    .from("agendamentos")
    .insert([{ professora, turma, data, inicio, fim }]);

  if (error) {
    alert("Erro ao salvar: " + error.message);
  } else {
    await carregarAgendamentos();
    document.getElementById("form-agendamento").reset();
  }
});

carregarAgendamentos();

function abrirModal(props) {
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modal-content");

  modalContent.innerHTML = `
    <h3>📌 Detalhes do Agendamento</h3>
    <p><strong>Professora:</strong> ${props.professora}</p>
    <p><strong>Turma:</strong> ${props.turma}</p>
    <p><strong>Data:</strong> ${formatarData(props.data)}</p>
    <p><strong>Início:</strong> ${props.inicio}</p>
    <p><strong>Fim:</strong> ${props.fim}</p>
    <button id="fecharModal">Fechar</button>
  `;

  modal.style.display = "block";

  document.getElementById("fecharModal").onclick = () => {
    modal.style.display = "none";
  };
}