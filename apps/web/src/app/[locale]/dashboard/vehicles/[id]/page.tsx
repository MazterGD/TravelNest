import VehicleDetailsPageContent from "@/app/[locale]/vehicles/[id]/VehicleDetailsPageContent";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function DashboardVehicleDetailsPage({ params }: PageProps) {
  const { locale, id } = await params;
  return <VehicleDetailsPageContent locale={locale} vehicleId={id} isDashboard />;
}
