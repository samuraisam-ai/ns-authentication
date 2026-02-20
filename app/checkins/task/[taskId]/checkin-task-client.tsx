"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Task {
  id: string;
  user_id: string;
  template_key?: string | null;
  template_title?: string | null;
  status: string;
  scheduled_for: string;
  created_at: string;
}

export default function CheckinTaskClient({
  taskId,
  userId,
}: {
  taskId: string;
  userId: string;
}) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const res = await fetch(`/api/checkins/task?taskId=${taskId}`);
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Failed to load task");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setTask(data.task);
      } catch (err) {
        setError("Failed to fetch task");
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId]);

  const handleSubmit = async (answers: Record<string, unknown>) => {
    if (!task) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkins/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          answers,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to submit");
        setSubmitting(false);
        return;
      }

      alert("Check-in submitted successfully!");
      router.replace("/tasks");
      router.refresh();
    } catch (err) {
      alert("Failed to submit check-in");
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading task...</div>;
  }

  if (error || !task) {
    return (
      <div className="text-red-600">
        <p>{error || "Task not found"}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Check-in Task</h1>

      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
        <p className="text-sm text-gray-600">
          <strong>Template:</strong> {task.template_title || task.template_key || "No template assigned"}
        </p>
        <p className="text-sm text-gray-600">
          <strong>Status:</strong> {task.status}
        </p>
        <p className="text-sm text-gray-600">
          <strong>Scheduled for:</strong>{" "}
          {new Date(task.scheduled_for).toLocaleString()}
        </p>
      </div>

      {task.status === "submitted" ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded text-green-800">
          This task has already been submitted.
        </div>
      ) : !task.template_key ? (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
          Task has no template assigned.
        </div>
      ) : (
        <FormRenderer
          templateKey={task.template_key}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
}

function FormRenderer({
  templateKey,
  onSubmit,
  submitting,
}: {
  templateKey: string;
  onSubmit: (answers: Record<string, unknown>) => void;
  submitting: boolean;
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const handleChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (templateKey === "daily_checkin") {
    return (
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <h2 className="text-2xl font-semibold">Daily Check-in</h2>

        <div>
          <label className="block text-sm font-medium mb-2">
            How are you feeling today? (1-10)
          </label>
          <input
            type="number"
            min="1"
            max="10"
            required
            onChange={(e) => handleChange("mood", parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            What are your top 3 priorities today?
          </label>
          <textarea
            required
            rows={4}
            onChange={(e) => handleChange("priorities", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Any blockers or concerns?
          </label>
          <textarea
            rows={3}
            onChange={(e) => handleChange("blockers", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Check-in"}
        </button>
      </form>
    );
  }

  if (templateKey === "daily_checkout") {
    return (
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <h2 className="text-2xl font-semibold">Daily Check-out</h2>

        <div>
          <label className="block text-sm font-medium mb-2">
            Did you complete your priorities? (Yes/No)
          </label>
          <select
            required
            onChange={(e) => handleChange("completed_priorities", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          >
            <option value="">Select...</option>
            <option value="yes">Yes</option>
            <option value="partial">Partially</option>
            <option value="no">No</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            What did you accomplish today?
          </label>
          <textarea
            required
            rows={4}
            onChange={(e) => handleChange("accomplishments", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Energy level at end of day (1-10)
          </label>
          <input
            type="number"
            min="1"
            max="10"
            required
            onChange={(e) => handleChange("energy_level", parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Check-out"}
        </button>
      </form>
    );
  }

  if (templateKey === "weekly_checkin") {
    return (
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <h2 className="text-2xl font-semibold">Weekly Check-in</h2>

        <div>
          <label className="block text-sm font-medium mb-2">
            What were your key wins this week?
          </label>
          <textarea
            required
            rows={4}
            onChange={(e) => handleChange("wins", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            What challenges did you face?
          </label>
          <textarea
            required
            rows={4}
            onChange={(e) => handleChange("challenges", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            What are your goals for next week?
          </label>
          <textarea
            required
            rows={4}
            onChange={(e) => handleChange("next_goals", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Overall satisfaction (1-10)
          </label>
          <input
            type="number"
            min="1"
            max="10"
            required
            onChange={(e) => handleChange("satisfaction", parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Weekly Check-in"}
        </button>
      </form>
    );
  }

  if (templateKey === "onboarding_profile") {
    return (
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <h2 className="text-2xl font-semibold">Onboarding Profile</h2>

        <div>
          <label className="block text-sm font-medium mb-2">
            Full Name
          </label>
          <input
            type="text"
            required
            onChange={(e) => handleChange("full_name", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Role / Position
          </label>
          <input
            type="text"
            required
            onChange={(e) => handleChange("role", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Tell us about yourself
          </label>
          <textarea
            required
            rows={5}
            onChange={(e) => handleChange("bio", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            What are your primary goals?
          </label>
          <textarea
            required
            rows={4}
            onChange={(e) => handleChange("goals", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Complete Onboarding"}
        </button>
      </form>
    );
  }

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
      <p className="font-semibold mb-2">Unknown template: {templateKey}</p>
      <p className="text-sm">This template is not currently supported. Please contact support if you need assistance.</p>
    </div>
  );
}
