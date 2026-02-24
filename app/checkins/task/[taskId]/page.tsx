import CheckinTaskClient from "./checkin-task-client";

export default function CheckinTaskPage({ params }: { params: { taskId: string } }) {
  return <CheckinTaskClient taskId={params.taskId} />;
}
