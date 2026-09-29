import React, { useEffect, useState } from "react";

interface PatientOption {
  id: number;
  name: string;
}

interface UserOption {
  id: number;
  name: string;
}

export interface AppointmentFormData {
  patientId: number;
  userId: number;
  date: string;
  duration: number;
  status: string;
  notes: string;
}

interface AppointmentFormInitialData {
  patientId: number;
  userId: number;
  date: string;
  duration: number;
  status: string;
  notes: string | null;
}

interface AppointmentFormProps {
  initialData?: AppointmentFormInitialData | null;
  patients: PatientOption[];
  users: UserOption[];
  defaultUserId?: number;
  onSubmit: (data: AppointmentFormData) => void;
  onCancel: () => void;
}

const statusOptions = [
  { value: "scheduled", label: "Agendado" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

const emptyForm = (defaultUserId?: number) => ({
  patientId: "",
  userId: defaultUserId ? String(defaultUserId) : "",
  date: "",
  time: "",
  duration: 60,
  status: "scheduled",
  notes: "",
});

const toLocalDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
};

export const AppointmentForm: React.FC<AppointmentFormProps> = ({
  initialData,
  patients,
  users,
  defaultUserId,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState(() => emptyForm(defaultUserId));

  useEffect(() => {
    if (initialData) {
      const localDateTime = toLocalDateTime(initialData.date);

      setFormData({
        patientId: String(initialData.patientId),
        userId: String(initialData.userId),
        ...localDateTime,
        duration: initialData.duration || 60,
        status: initialData.status || "scheduled",
        notes: initialData.notes || "",
      });
    } else {
      setFormData(emptyForm(defaultUserId));
    }
  }, [initialData, defaultUserId]);

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: name === "duration" ? Number(value) : value,
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.date || !formData.time) {
      window.alert("Data e hora são obrigatórias");
      return;
    }

    const [year, month, day] = formData.date.split("-").map(Number);
    const [hour, minute] = formData.time.split(":").map(Number);
    const dateTime = new Date(year, month - 1, day, hour, minute);

    if (Number.isNaN(dateTime.getTime())) {
      window.alert("Data ou hora inválida");
      return;
    }

    onSubmit({
      patientId: Number(formData.patientId),
      userId: Number(formData.userId),
      date: dateTime.toISOString(),
      duration: Number(formData.duration),
      status: formData.status,
      notes: formData.notes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Paciente *
        </label>
        <select
          name="patientId"
          value={formData.patientId}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="">Selecione um paciente</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Profissional *
        </label>
        <select
          name="userId"
          value={formData.userId}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="">Selecione um profissional</option>
          {users.map((availableUser) => (
            <option key={availableUser.id} value={availableUser.id}>
              {availableUser.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data *
          </label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hora *
          </label>
          <input
            type="time"
            name="time"
            value={formData.time}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Duração (minutos) *
        </label>
        <input
          type="number"
          name="duration"
          value={formData.duration}
          onChange={handleChange}
          required
          min={15}
          step={15}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status *
        </label>
        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observações
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Procedimento, observações, etc."
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          {initialData ? "Salvar alterações" : "Criar agendamento"}
        </button>
      </div>
    </form>
  );
};

export default AppointmentForm;
