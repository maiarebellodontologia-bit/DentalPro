import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppointmentForm, {
  AppointmentFormData,
} from "../components/AppointmentForm";
import Modal from "../components/Modal";
import { Toast } from "../components/Toast";
import { useToast } from "../hooks/useToast";
import api from "../services/api";

interface Appointment {
  id: number;
  patientId: number;
  userId: number;
  date: string;
  duration: number;
  status: string;
  notes: string | null;
  patient: {
    id: number;
    name: string;
  };
  user: {
    id: number;
    name: string;
  };
}

interface User {
  id: number;
  name: string;
}

export const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<{ id: number; name: string }[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const { toast, showToast, hideToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [appointmentsResponse, patientsResponse, usersResponse] =
        await Promise.all([
          api.get("/appointments"),
          api.get("/patients"),
          api.get("/users"),
        ]);
      setAppointments(appointmentsResponse.data);
      setPatients(patientsResponse.data);
      setUsers(usersResponse.data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      showToast("Erro ao carregar dados", "error");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingAppointment(null);
    setIsModalOpen(true);
  };

  const openEditModal = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAppointment(null);
  };

  const handleSubmit = async (formData: AppointmentFormData) => {
    try {
      const payload = {
        ...formData,
        notes: formData.notes || null,
      };

      if (editingAppointment) {
        await api.put(`/appointments/${editingAppointment.id}`, payload);
      } else {
        await api.post("/appointments", payload);
      }

      closeModal();
      showToast("Agendamento salvo com sucesso!", "success");
      await loadData();
    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
      showToast("Erro ao salvar agendamento", "error");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/appointments/${id}`);
      setDeleteConfirm(null);
      showToast("Agendamento excluído com sucesso!", "success");
      await loadData();
    } catch (error) {
      console.error("Erro ao excluir agendamento:", error);
      showToast("Erro ao excluir agendamento", "error");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      scheduled: "Agendado",
      completed: "Concluído",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const toLocalDateKey = (dateString: string) => {
    const date = new Date(dateString);
    const pad = (value: number) => String(value).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const filteredAppointments = appointments.filter((appointment) => {
    const matchesStatus =
      filterStatus === "all" || appointment.status === filterStatus;
    const matchesDate =
      !filterDate || toLocalDateKey(appointment.date) === filterDate;

    return matchesStatus && matchesDate;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
          >
            <span>←</span>
            <span>Voltar</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Agendamentos</h1>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + Novo Agendamento
          </button>
        </div>
      </header>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingAppointment ? "Editar Agendamento" : "Novo Agendamento"}
      >
        <AppointmentForm
          initialData={editingAppointment}
          patients={patients}
          users={users}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {appointments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500 text-lg">
              Nenhum agendamento cadastrado.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Criar primeiro agendamento
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div>
                <label
                  htmlFor="appointment-status-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Status
                </label>
                <select
                  id="appointment-status-filter"
                  value={filterStatus}
                  onChange={(event) => setFilterStatus(event.target.value)}
                  className="w-full sm:w-52 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">Todos os status</option>
                  <option value="scheduled">Agendado</option>
                  <option value="completed">Concluído</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="appointment-date-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Data
                </label>
                <input
                  id="appointment-date-filter"
                  type="date"
                  value={filterDate}
                  onChange={(event) => setFilterDate(event.target.value)}
                  className="w-full sm:w-52 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {(filterStatus !== "all" || filterDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus("all");
                    setFilterDate("");
                  }}
                  className="self-end px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {filteredAppointments.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <p className="text-gray-500">
                  Nenhum agendamento corresponde aos filtros.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Data/Hora
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Paciente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Profissional
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredAppointments.map((appointment) => (
                      <tr key={appointment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(appointment.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {appointment.patient.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {appointment.user.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(appointment.status)}`}
                          >
                            {getStatusLabel(appointment.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => openEditModal(appointment)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(appointment.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {deleteConfirm !== null && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Confirmar exclusão"
        >
          <p className="text-gray-600 mb-6">
            Tem certeza que deseja excluir este agendamento? Esta ação não pode
            ser desfeita.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleDelete(deleteConfirm)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Sim, excluir
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
