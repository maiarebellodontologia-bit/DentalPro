import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import PatientForm, { PatientFormData } from "../components/PatientForm";
import { Toast } from "../components/Toast";
import { useToast } from "../hooks/useToast";
import api from "../services/api";

interface Patient {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  birthDate: string | null;
  notes: string | null;
}

export const Patients: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const { toast, showToast, hideToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const response = await api.get("/patients");
      setPatients(response.data);
    } catch (error) {
      console.error("Erro ao carregar pacientes:", error);
      showToast("Erro ao carregar dados", "error");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingPatient(null);
    setIsModalOpen(true);
  };

  const openEditModal = (patient: Patient) => {
    setEditingPatient(patient);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (formData: PatientFormData) => {
    try {
      const payload = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone,
        notes: formData.notes || null,
        birthDate: formData.birthDate
          ? new Date(formData.birthDate).toISOString()
          : null,
      };

      if (editingPatient) {
        await api.put(`/patients/${editingPatient.id}`, payload);
      } else {
        await api.post("/patients", payload);
      }

      closeModal();
      showToast("Paciente salvo com sucesso!", "success");
      await loadPatients();
    } catch (error) {
      console.error("Erro ao salvar paciente:", error);
      showToast("Erro ao salvar paciente", "error");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/patients/${id}`);
      setDeleteConfirm(null);
      showToast("Paciente excluído com sucesso!", "success");
      await loadPatients();
    } catch (error) {
      console.error("Erro ao excluir paciente:", error);
      showToast("Erro ao excluir paciente", "error");
    }
  };

  const filteredPatients = patients.filter((patient) =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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
          <h1 className="text-2xl font-bold text-gray-800">Pacientes</h1>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Novo Paciente
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {patients.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500 text-lg">Nenhum paciente cadastrado.</p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Cadastrar primeiro paciente
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label
                htmlFor="patient-search"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Buscar pacientes
              </label>
              <input
                id="patient-search"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="🔍 Buscar paciente por nome..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {filteredPatients.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <p className="text-gray-500">
                  Nenhum paciente corresponde à busca.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Nome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Telefone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredPatients.map((patient) => (
                      <tr key={patient.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold">
                                {patient.name.charAt(0)}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {patient.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {patient.email || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {patient.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => openEditModal(patient)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(patient.id)}
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

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingPatient ? "Editar Paciente" : "Novo Paciente"}
      >
        <PatientForm
          patient={
            editingPatient
              ? {
                  ...editingPatient,
                  email: editingPatient.email || "",
                  birthDate: editingPatient.birthDate || "",
                  notes: editingPatient.notes || "",
                }
              : null
          }
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      {deleteConfirm !== null && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Confirmar exclusão"
        >
          <p className="text-gray-600 mb-6">
            Tem certeza que deseja excluir este paciente? Esta ação não pode ser
            desfeita.
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
