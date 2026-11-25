import { CommercialActivitiesPage } from "@/features/activities/pages/CommercialActivitiesPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/atividades-comerciais")({
  component: CommercialActivitiesPage,
});
