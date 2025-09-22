import { supabase } from "./supabaseClient.js";

let calendar; // variável global para o calendário

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

  // --- Atualiza a tabela ---
  const tbody = document.getElementById("lista-agendamentos");
  tbody.innerHTML = "";

  agendamentos.forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${a.professora}</td>
      <td>${a.turma}</td>
      <td>${a.data}</td>
      <td>${a.inicio}</td>
      <td>${a.fim}</td>
    `;
    tbody.appendChild(tr);
  });

  // --- Prepara eventos para o calendário ---
  const eventos = agendamentos.map(a => {
    // Normaliza hora para HH:MM (se vier HH:MM:SS, o FullCalendar aceita, mas vamos padronizar)
    const inicio = a.inicio?.slice(0,5) ?? a.inicio;
    const fim = a.fim?.slice(0,5) ?? a.fim;

    return {
      title: `${a.turma} - ${a.professora}`,
      start: `${a.data}T${inicio}`, // ex: 2025-09-23T11:13
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

  console.log("Eventos para o calendário:", eventos); // debug: confira no console do navegador

  if (!calendar) {
    const calendarEl = document.getElementById("calendar");

    // Em builds globais, esses plugins já estão disponíveis
    // mas indicar explicitamente ajuda em alguns ambientes.
    const dayGridPlugin = FullCalendar.dayGridPlugin || FullCalendar.DayGrid;
    const interactionPlugin = FullCalendar.interactionPlugin || FullCalendar.Interaction;

    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "pt-br",
      buttonText: { today: "Hoje" },
      // plugins podem ser omitidos no index.global, mas manter por segurança:
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

    // Recalcula quando a janela muda
    window.addEventListener("resize", () => {
      calendar.updateSize();
    });

    // Recalcula depois de um pequeno delay (corrige render após CSS/Fonts)
    setTimeout(() => calendar.updateSize(), 50);

  } else {
    // Atualização robusta das fontes de eventos
    calendar.removeAllEventSources();
    calendar.addEventSource(eventos);
    // Em alguns cenários, ajuda também limpar eventos “órfãos”
    calendar.removeAllEvents();
    calendar.addEventSource(eventos);

    calendar.updateSize();
  }
}

document.getElementById("form-agendamento").addEventListener("submit", async (e) => {
  e.preventDefault();

  const professora = document.getElementById("professora").value;
  const turma = document.getElementById("turma").value;
  const data = document.getElementById("data").value;
  const inicio = document.getElementById("inicio").value;
  const fim = document.getElementById("fim").value;

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

// --- Função para abrir o modal ---
function abrirModal(props) {
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modal-content");

  modalContent.innerHTML = `
    <h3>📌 Detalhes do Agendamento</h3>
    <p><strong>Professora:</strong> ${props.professora}</p>
    <p><strong>Turma:</strong> ${props.turma}</p>
    <p><strong>Data:</strong> ${props.data}</p>
    <p><strong>Início:</strong> ${props.inicio}</p>
    <p><strong>Fim:</strong> ${props.fim}</p>
    <button id="fecharModal">Fechar</button>
  `;

  modal.style.display = "block";

  document.getElementById("fecharModal").onclick = () => {
    modal.style.display = "none";
  };
}