import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";

interface Appointment {
  id: number;
  date: string;
  duration: number;
  status: string;
  patient: {
    name: string;
  };
  user: {
    name: string;
  };
}

interface Stats {
  totalPatients: number;
  totalAppointments: number;
  todayAppointments: number;
  scheduledAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
}

const initialStats: Stats = {
  totalPatients: 0,
  totalAppointments: 0,
  todayAppointments: 0,
  scheduledAppointments: 0,
  completedAppointments: 0,
  cancelledAppointments: 0,
};

export const Dashboard: React.FC = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>(initialStats);
  const [upcomingAppointments, setUpcomingAppointments] = useState<
    Appointment[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [patientsResponse, appointmentsResponse] = await Promise.all([
        api.get("/patients"),
        api.get("/appointments"),
      ]);

      const appointments: Appointment[] = appointmentsResponse.data;
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

      setStats({
        totalPatients: patientsResponse.data.length,
        totalAppointments: appointments.length,
        todayAppointments: appointments.filter((appointment) => {
          const appointmentDate = new Date(appointment.date);
          return (
            appointmentDate >= startOfToday && appointmentDate < startOfTomorrow
          );
        }).length,
        scheduledAppointments: appointments.filter(
          (appointment) => appointment.status === "scheduled",
        ).length,
        completedAppointments: appointments.filter(
          (appointment) => appointment.status === "completed",
        ).length,
        cancelledAppointments: appointments.filter(
          (appointment) => appointment.status === "cancelled",
        ).length,
      });

      setUpcomingAppointments(
        appointments
          .filter(
            (appointment) =>
              appointment.status === "scheduled" &&
              new Date(appointment.date) >= now,
          )
          .sort(
            (first, second) =>
              new Date(first.date).getTime() - new Date(second.date).getTime(),
          )
          .slice(0, 5),
      );
    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
      window.alert("Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const statCards = [
    {
      label: "Pacientes",
      value: stats.totalPatients,
      color: "border-blue-500",
    },
    {
      label: "Agendamentos",
      value: stats.totalAppointments,
      color: "border-green-500",
    },
    {
      label: "Hoje",
      value: stats.todayAppointments,
      color: "border-cyan-500",
    },
    {
      label: "Agendados",
      value: stats.scheduledAppointments,
      color: "border-indigo-500",
    },
    {
      label: "Concluídos",
      value: stats.completedAppointments,
      color: "border-emerald-500",
    },
    {
      label: "Cancelados",
      value: stats.cancelledAppointments,
      color: "border-red-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🦷</span>
            <h1 className="text-2xl font-bold text-gray-800">DentalPro</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">Olá, {user?.name}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h2>

        <section
          aria-label="Resumo da clínica"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8"
        >
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`bg-white rounded-lg shadow-sm p-5 border-l-4 ${card.color}`}
            >
              <p className="text-sm text-gray-600 mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-gray-800">
                {loading ? "-" : card.value}
              </p>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">
              Próximos agendamentos
            </h3>
            <button
              onClick={() => navigate("/appointments")}
              className="text-sm font-medium text-green-700 hover:text-green-900"
            >
              Ver agenda
            </button>
          </div>

          {loading ? (
            <p className="px-6 py-8 text-sm text-gray-500">
              Carregando agendamentos...
            </p>
          ) : upcomingAppointments.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-500">
              Não há próximos agendamentos.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcomingAppointments.map((appointment) => (
                <li
                  key={appointment.id}
                  className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {appointment.patient.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      Profissional: {appointment.user.name}
                    </p>
                  </div>
                  <p className="text-sm text-gray-700 sm:text-center">
                    {new Date(appointment.date).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-sm text-gray-500 sm:text-right">
                    {appointment.duration} min
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Ações rápidas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/patients")}
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <span className="text-3xl">👥</span>
              <div className="text-left">
                <p className="font-semibold text-gray-800">
                  Gerenciar pacientes
                </p>
                <p className="text-sm text-gray-600">
                  Ver, adicionar ou editar pacientes
                </p>
              </div>
            </button>

            <button
              onClick={() => navigate("/appointments")}
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
            >
              <span className="text-3xl">📅</span>
              <div className="text-left">
                <p className="font-semibold text-gray-800">Agendamentos</p>
                <p className="text-sm text-gray-600">
                  Ver e criar agendamentos
                </p>
              </div>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
